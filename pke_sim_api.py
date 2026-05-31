"""API do Simulador guiado pelo PKE.

Sem estratégia própria: pede spot ao gerador do PKE, guarda o contexto, e na
resposta chama evaluate_decision do PKE. Estado de sessão em memória (single-user).

Modos: livre | leaks (último torneio analisado) | review (repete os erros) | <categoria>.
"""
from __future__ import annotations

import hands_engine as he
from pke import HandContext, engine
from pke.generator import CATEGORY_SPECS, DEFAULT_WEIGHTS, generate_spot, make_spot
from pke.scorer import norm_action

_SPOTS: dict[str, dict] = {}      # spot_id -> {ctx, spot, cat}
_CTX_FIELDS = ("players_left", "paid_places", "ante", "bb_chips", "eff_stack_bb",
               "hero_pos", "hero_cards", "preflop_action", "opener_pos", "table_max")


def _fresh_session():
    return {"maos": 0, "acertos": 0, "soma": 0, "by_cat": {}, "bumps": {},
            "errors": [], "review_queue": [], "leak_focus": [], "source_tid": None}


_SESSION = _fresh_session()


class PkeSimApi:
    # ── geração ─────────────────────────────────────────────────────────────────
    def new_spot(self, mode: str = "livre", category: str | None = None):
        # modo revisão: repete os erros guardados
        if mode == "review":
            spot, ctx, cat = self._next_review()
            if spot is None:
                # sem fila: treina as categorias erradas da sessão
                return self._gen(None, self._error_weights(), source="review")
            self._store(spot, ctx, cat)
            return spot

        if mode == "leaks":
            self._capture_leak_focus()

        cat = mode if mode in CATEGORY_SPECS else (category if category in CATEGORY_SPECS else None)
        return self._gen(cat, self._weights(mode))

    def _gen(self, cat, weights, source=None):
        spot, ctx = generate_spot(cat, weights)
        if spot is None:
            return {"error": "Não consegui gerar um spot graduável agora. Tente outro modo."}
        self._store(spot, ctx, spot["category"])
        return spot

    def _store(self, spot, ctx, cat):
        _SPOTS[spot["spot_id"]] = {
            "ctx": {k: getattr(ctx, k) for k in _CTX_FIELDS},
            "spot": spot, "cat": cat,
        }

    # ── correção ────────────────────────────────────────────────────────────────
    def answer(self, spot_id: str, hero_answer: str):
        cd = _SPOTS.get(spot_id)
        if not cd:
            return {"error": "Spot expirado — gere outro."}
        ctx = HandContext(**cd["ctx"])
        spot, cat = cd["spot"], cd["cat"]
        dec = engine().evaluate_decision(ctx, hero_answer)
        rec = dec.get("acao_recomendada")
        score = dec.get("nota")
        correct = rec is not None and norm_action(hero_answer) == norm_action(rec)

        # estatística da sessão (agrupa pela categoria de treino)
        _SESSION["maos"] += 1
        if score is not None:
            _SESSION["soma"] += score
        if correct:
            _SESSION["acertos"] += 1
        bc = _SESSION["by_cat"].setdefault(cat, {"n": 0, "correct": 0, "soma": 0})
        bc["n"] += 1
        bc["correct"] += 1 if correct else 0
        bc["soma"] += score or 0

        rule_refs = _rule_refs(dec.get("regra_pdf"))
        next_w = {}
        if not correct:
            _SESSION["bumps"][cat] = _SESSION["bumps"].get(cat, 0) + 1
            next_w[cat] = "+1"
            self._record_error(spot, cat, cd["ctx"], hero_answer, rec, score, rule_refs,
                               dec.get("explicacao_iniciante") or dec.get("motivo"))

        return {
            "correct": correct,
            "score": score,
            "recommended_action": rec,
            "rule_refs": rule_refs,
            "explanation": dec.get("explicacao_iniciante") or dec.get("motivo"),
            "common_mistake": _common_mistake(dec),
            "next_training_weight": next_w,
            "category": cat,
        }

    def _record_error(self, spot, cat, ctx_fields, hero_answer, rec, score, rule_refs, explanation):
        sig = (spot["hero_position"], spot["hero_cards"], cat)
        # evita duplicar a MESMA mão na fila de revisão
        if not any(e["_sig"] == sig for e in _SESSION["errors"]):
            _SESSION["review_queue"].append({"cat": cat, "ctx": ctx_fields})
        _SESSION["errors"].append({
            "_sig": sig,
            "category": cat,
            "hero_position": spot["hero_position"],
            "hero_cards": spot["hero_cards"],
            "effective_stack_bb": spot["effective_stack_bb"],
            "phase": spot["phase"],
            "action_before_hero": spot["action_before_hero"],
            "opener_position": spot.get("opener_position"),
            "hero_answer": hero_answer,
            "recommended_action": rec,
            "score": score,
            "rule_refs": rule_refs,
            "explanation": explanation,
        })

    def _next_review(self):
        q = _SESSION["review_queue"]
        if not q:
            return None, None, None
        item = q.pop(0)
        ctx = HandContext(**item["ctx"])
        engine().recommend(ctx)  # garante derivados (phase/spot) p/ o make_spot
        spot = make_spot(item["cat"], ctx)
        return spot, ctx, item["cat"]

    # ── sessão ──────────────────────────────────────────────────────────────────
    def session(self):
        s = _SESSION
        scored = sum(v["n"] for v in s["by_cat"].values())
        media = round(s["soma"] / scored, 2) if scored else None
        cats = []
        for c, v in s["by_cat"].items():
            avg = v["soma"] / v["n"] if v["n"] else 0
            cats.append({"category": c, "n": v["n"], "correct": v["correct"], "media": round(avg, 1)})
        pior = min(cats, key=lambda x: x["media"])["category"] if cats else None
        melhor = max(cats, key=lambda x: x["media"])["category"] if cats else None
        leaks_treino = sorted([c for c in cats if c["media"] < 6], key=lambda x: x["media"])

        # desempenho nos leaks treinados (modo "Meus leaks")
        desempenho_leaks = []
        for cat in s["leak_focus"]:
            v = s["by_cat"].get(cat)
            if v and v["n"]:
                m = round(v["soma"] / v["n"], 1)
                verdict = "bom" if m >= 7 else "melhorando" if m >= 5 else "ainda fraco"
            else:
                m, verdict = None, "não treinado"
            desempenho_leaks.append({"category": cat, "n": v["n"] if v else 0,
                                     "media": m, "verdict": verdict})

        return {
            "maos": s["maos"], "acertos": s["acertos"], "media_notas": media,
            "por_categoria": cats, "pior_categoria": pior, "melhor_categoria": melhor,
            "leaks_treino": leaks_treino,
            "recomendar_treinar": leaks_treino[0]["category"] if leaks_treino else None,
            "erros": [{k: v for k, v in e.items() if k != "_sig"} for e in s["errors"]],
            "leak_focus": s["leak_focus"], "source_tid": s["source_tid"],
            "desempenho_leaks": desempenho_leaks,
            "tem_revisao": len(s["review_queue"]) > 0,
        }

    def reset_session(self):
        global _SESSION
        _SESSION = _fresh_session()
        return {"ok": True}

    # ── regra (texto canônico para o modal "Ver regra") ───────────────────────────
    def rule(self, rule_id: str):
        rid = (rule_id or "").split(" (")[0].strip()
        if not rid:
            return {"found": False, "id": rule_id}
        r = engine().kb.rule(rid)
        if not r:
            return {"found": False, "id": rid}
        src = r.get("source", {}) or {}
        pretty = {"guia_de_bolso": "Guia de Bolso"}.get(src.get("pdf"), src.get("pdf"))
        return {
            "found": True,
            "id": r.get("id"),
            "source": {"pdf": src.get("pdf"), "page": src.get("page")},
            "source_label": pretty,
            "explain_pt": r.get("explain_pt"),
            "common_mistake": r.get("common_mistake"),
            "scope": r.get("scope"),
        }

    # ── pesos por modo ────────────────────────────────────────────────────────────
    def _capture_leak_focus(self):
        try:
            lw = he.leak_weights()  # último torneio analisado
        except Exception:
            lw = {}
        focus = [c for c in lw if c in CATEGORY_SPECS]
        if focus:
            _SESSION["leak_focus"] = focus
            _SESSION["source_tid"] = he.last_analyzed_tid()

    def _weights(self, mode: str) -> dict:
        if mode in CATEGORY_SPECS:
            return {mode: 1}
        base = dict(DEFAULT_WEIGHTS)
        if mode == "leaks":
            try:
                lw = he.leak_weights()
            except Exception:
                lw = {}
            for cat, w in lw.items():
                if cat in CATEGORY_SPECS:
                    base[cat] = base.get(cat, 0) + w
        for cat, n in _SESSION["bumps"].items():  # adaptativo
            if cat in base:
                base[cat] += n * 3
        return base

    def _error_weights(self) -> dict:
        w = {}
        for e in _SESSION["errors"]:
            c = e["category"]
            if c in CATEGORY_SPECS:
                w[c] = w.get(c, 0) + 1
        return w or dict(DEFAULT_WEIGHTS)


def _rule_refs(regra_pdf):
    out = []
    for r in (regra_pdf or []):
        rid = r.split(" (")[0]
        kb_rule = engine().kb.rule(rid)
        src = (kb_rule or {}).get("source", {})
        pretty = {"guia_de_bolso": "Guia de Bolso"}.get(src.get("pdf"), src.get("pdf"))
        out.append({"id": rid, "source": pretty, "page": src.get("page")})
    return out


def _common_mistake(dec):
    rid = (dec.get("regra_pdf") or [None])[0]
    if rid:
        r = engine().kb.rule(rid.split(" (")[0])
        if r and r.get("common_mistake"):
            return r["common_mistake"]
    return None

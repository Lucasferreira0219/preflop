# Especificação — PokerKnowledgeEngine (PKE)

> Camada central de inteligência para Sit & Go low ticket. **Evolução** do sistema atual
> (Simulador, Consulta, Torneios), não reescrita. Base canônica = PDFs, com o
> **Guia de Bolso / Plano de Jogo** como PDF **mestre** (prioridade máxima).
>
> Estado atual do sistema (já existente, a ser reaproveitado):
> - `ranges/sng/ranges_{10,15,30,75}bb.json` — `positions[POS].{RFI, vs_RFI{villain:{3bet,call,fold,shove}}, vs_3bet{villain:{4bet,call}}, _RFI_shove}`
> - `data/insights/sng.json` — `phases{early,middle,late,shortstack}`, `spots`, `open_pct_by_pos`, `by_pos_common_mistakes`
> - `data/insights/universal.json` — `glossary`, `actions`
> - Backends: `api.py` (get_range), `insights_api.py` (Consulta), `simulator_engine.py` (Simulador), `hands_engine.py` + `tournaments_engine.py` (Torneios)

---

## 0. Princípios inegociáveis

1. **Canônico > inferido.** Toda saída carrega *proveniência*. Quatro níveis, sempre separados:
   `RULE` (extraído de PDF) · `INFERENCE` (lógica derivada) · `EXPLORATORY` (ajuste vs field fraco) · `PEDAGOGICAL` (didática).
2. **Mestre vence.** Guia de Bolso = prioridade 100. PDFs específicos = 50. Conflito → reportar, nunca silenciar.
3. **Nunca inventar range exato.** Se não há range no JSON nem regra aplicável → `insufficient_information` + "falta informação", jamais um range fabricado.
4. **Low ticket, decisão simples.** Regra-de-bolso > solver. Push/fold, ICM grosso, linhas simples.
5. **Um motor, três consumidores.** Simulador/Consulta/Torneios chamam o PKE; zero regra solta espalhada.

---

## 1. Visão geral do ecossistema

```
            ┌──────────────────────────────────────────────┐
            │              PokerKnowledgeEngine             │
            │                                               │
  PDFs ───► │  KnowledgeBase   (rules.json + ranges + gloss)│
            │  ContextBuilder  (HandContext normalizado)    │
            │  PhaseClassifier / SpotClassifier             │
            │  RuleResolver    (mestre>específico, conflito)│
            │  RangeProvider   (lê JSON, interpola stack)   │
            │  DecisionEvaluator + Scorer (0–10)            │
            │  HandGenerator   (spots ponderados)           │
            │  LeakDetector    (agregação multi-torneio)    │
            │  Explainer       (didática + proveniência)    │
            └───────▲──────────────▲──────────────▲─────────┘
                    │              │              │
             Simulador        Consulta        Torneios
         generate_spot()   answer_query()  evaluate_hand()/scan_leaks()
```

O PKE é uma **biblioteca Python pura** (`pke/`), sem estado de UI. As 3 áreas continuam
donas das suas rotas FastAPI e telas React; elas passam a **delegar a decisão/conhecimento ao PKE**.

---

## 2. Estrutura da base de conhecimento

Três camadas, todas versionadas:

| Camada | Arquivo | Conteúdo | Canônico? |
|---|---|---|---|
| **Regras** | `pke/knowledge/rules.json` | regras de bolso estruturadas (abaixo) | sim (extraído dos PDFs) |
| **Ranges** | `ranges/sng/*.json` (já existe) | grids 13×13 por stack/posição/cenário | sim (charts dos PDFs) |
| **Léxico** | `data/insights/universal.json` (já existe) | glossário + ações | sim |
| **Fases/erros** | `data/insights/sng.json` (já existe) | fases, open%, erros comuns por posição | sim/derivado |

### 2.1 Catálogo canônico de regras (extraído do PDF mestre — Guia de Bolso)

Cada regra é um objeto (ver §3.2). Abaixo o catálogo inicial com a citação de página:

| id | escopo | gatilho | ação | fonte |
|---|---|---|---|---|
| `RFI.SIZE` | RFI | eff≥75bb / 40–75 / ≤40 | abrir **3bb / 2.5bb / 2bb** | GdB p5 |
| `RFI.RANGE` | RFI | por posição (UTG…BTN), early | usar grid canônico (ranges JSON) | GdB p2–5 |
| `VSRFI.3BET_ONLY` | vs open | hero ≠ BTN e ≠ BB | **só 3-bet (sem call)**, preferir mãos não-naipadas, range sólido | GdB p5 |
| `VSRFI.SHORT_NOCALL` | vs open | eff<30bb e hero≠BB | nunca call; todo range vira 3-bet/shove | GdB p5 |
| `VSRFI.DEEP_LOWPAIR_CALL` | vs open | deep | exceção: 66- pode dar call | GdB p5 |
| `THREEBET.SIZE` | 3-bet | ≥30 / 20–30 / 17–20 / ≤17 | 3x·3.5 / 2.7·3.2 / 2.5·3 / **all-in** (IP·OOP) | GdB p5 |
| `BB.NOFOLD_SUITED` | BB vs open | início, raise ~2x | **não foldar naipadas**; exceção: ICM forte (bolha) | GdB p7 |
| `LIMP.PUNISH` | vs limp | vilão limpou | punir com **raise usando o range de open da posição do limpador**, ou fold; sem limp atrás (exceto SB) | GdB p7 |
| `LIMP.SIZE` | vs limp | ≥40 / 20–40 / 10–20 | 3 / 2.5 / 2 **+1bb por limpador** | GdB p8 |
| `SB.RAISE_ONLY` | blind war SB | hero SB | **todo range em raise**; 3.5x / 3x / 2.25x (≥30 / 20–30 / 10–20) | GdB p8 |
| `BBvLIMP.PLAN` | BB vs SB limp | por stack | ≥40 raise 100% 3.5x; 25–40 polariza+check médias 3x; ≤20 polariza 3x + shove médias (Ax, parzinhos) | GdB p9 |
| `SBvBB.SHORT_JAM` | SBxBB | eff<12bb | all-in muito largo (até 100% em bolha) | GdB p10–11 |
| `OPENSHOVE.10BB` | push/fold | eff≤10bb | **all-in ou fold** por posição (grids `_RFI_shove`) | GdB p11–13 |
| `RESTEAL.SHORT` | resteal | eff≤20bb, vilão abriu CO/BTN, hero BTN/SB/BB | **shove**: todos pares, broadways naipadas, ases naipados | GdB p14 |
| `CBET.IP_BB` | pós-flop | abriu pré + só BB deu call, hero IP | **c-bet 100% @33%** qualquer mão/board; turn 2º barril ~66% em carta boa | GdB p13 |
| `CBET.OOP` | pós-flop | PFR OOP | c-betar valor; **check** boards que não conectam com range | GdB p13 |
| `BETVMISSED` | pós-flop | vilão open CO, hero call BTN, blinds foldam, vilão check flop | **apostar sempre @33%** | GdB p13 |
| `PROBE` | pós-flop | vilão open CO, hero call BB, flop check-check | turn favorável → BB aposta ~66% | GdB p14 |
| `BUBBLE.PLAN` | bolha | 4-left(9p)/5-left(18p) | CL: expandir/pressionar; mid: cuidado (pressionado); short: agressivo buscando dobra | GdB p15 |
| `HU.BTN` | heads-up | HU, hero BTN, ≥10bb | **nunca foldar (100%)**, adicionar limp; IP segue c-bet 100% | GdB p15 |

> Regras de PDFs **específicos** (ICM, bolha, pós-flop early, 3-handed etc.) entram com o mesmo schema e `priority=50`. Se contradisserem o mestre, o RuleResolver marca conflito e o mestre prevalece.

---

## 3. Modelo de dados

### 3.1 `HandContext` (entrada normalizada — coração do sistema)

```python
@dataclass
class HandContext:
    # mesa
    table_max: int            # 9 | 6 | 2 ...
    players_left: int         # vivos no torneio
    prize_structure: list[int] | None   # ex.: [50,30,20] (% ) ; None se desconhecido
    ante: bool
    bb_chips: int
    eff_stack_bb: float       # stack efetivo em BB (hero vs vilão relevante)
    # hero / vilões
    hero_pos: str             # UTG, UTG1, MP, HJ, CO, BTN, SB, BB
    hero_cards: str | None    # "AhKs" | "AKs" | None
    villains: list[dict]      # [{pos, stack_bb, action}]
    action_before: str        # "fold_to_hero" | "limp:HJ" | "raise:CO@2.2" | "shove:BTN@12" ...
    street: str               # "preflop" | "flop" | "turn" | "river"
    board: list[str] | None
    # derivados (preenchidos pelo PKE)
    phase: str | None = None          # early/middle/late/bubble/itm/3handed/hu
    icm: dict | None = None           # {pressure: 0..1, risk_premium: float, role: CL/mid/short}
    spot: str | None = None           # categoria (§4.2)
```

### 3.2 `Rule` (schema do `rules.json`)

```json
{
  "id": "VSRFI.3BET_ONLY",
  "rev": 1,
  "source": {"pdf": "guia_de_bolso", "page": 5, "priority": 100},
  "type": "RULE",
  "scope": {"spot": "vs_open", "phase": ["early","middle"], "eff_bb": [0, 200]},
  "when": {"hero_pos_not_in": ["BTN","BB"]},
  "then": {"primary_action": "3bet", "forbid": ["call"], "size_ref": "THREEBET.SIZE",
            "hand_preference": "nao_naipadas"},
  "exceptions": ["VSRFI.DEEP_LOWPAIR_CALL"],
  "common_mistake": "dar call em vez de 3-bet fora de BTN/BB",
  "explain_pt": "Fora de BTN e BB, simplifica: 3-bet ou fold. Call só te deixa em spot difícil OOP."
}
```

### 3.3 `Decision` (saída de avaliação — formato de 20 campos pedido)

```json
{
  "situacao_mesa": "9-max, 6 vivos, sem premiação informada",
  "fase": "middle",
  "jogadores_restantes": 6,
  "premiacao": null,
  "ante": true,
  "eff_stack_bb": 14.0,
  "hero_pos": "SB",
  "viloes": [{"pos": "CO", "stack_bb": 15, "action": "raise@2"}],
  "acao_antes": "raise:CO@2bb",
  "hero_cards": "AhTs",
  "linha_hero": "call",
  "acao_recomendada": "shove",
  "motivo": "RESTEAL.SHORT: ≤20bb, vilão abriu de CO, hero no SB com As naipado/par/broadway naipada → resteal all-in.",
  "gravidade": "grave",
  "nota": 3,
  "tipo_erro": "passividade_short_stack / call em vez de resteal",
  "regra_pdf": ["RESTEAL.SHORT (GdB p14)"],
  "ajuste_exploratorio": "vs field muito tight que abre forte, pode-se apertar o resteal de ATo offsuit.",
  "explicacao_iniciante": "Com 14bb não pague: ou shova (pressão + fold equity) ou foldа. Call vira spot ruim pós-flop.",
  "resumo": "Resteal-shove era padrão; call desperdiça fold equity.",
  "proveniencia": {"acao_recomendada": "RULE", "ajuste_exploratorio": "EXPLORATORY", "explicacao_iniciante": "PEDAGOGICAL"}
}
```

---

## 4. Motor de análise de mãos

### 4.1 Pipeline
```
hand_history → ContextBuilder → PhaseClassifier → ICM → SpotClassifier
            → RuleResolver (regras aplicáveis, mestre>específico)
            → RangeProvider (range exato do JSON, se existir)
            → DecisionEvaluator (ação recomendada + tipo de erro)
            → Scorer (0–10) → Explainer (proveniência) → Decision
```

### 4.2 SpotClassifier — categorias
`rfi` · `vs_open` (call/3bet/fold) · `bb_defense` · `vs_limp` · `blind_war_sb` · `bb_vs_limp` ·
`resteal_short` · `open_shove_10` · `push_fold` · `sb_vs_bb_short` · `bubble_call` ·
`3handed` · `heads_up` · `postflop_cbet_ip` · `postflop_cbet_oop` · `bet_vs_missed` · `probe`.

Classificação por árvore de decisão sobre `(street, action_before, hero_pos, eff_bb, phase)`.

### 4.3 PhaseClassifier (SNG 9-max single, pgto top 3)
```
players_left >= 7              → early
5 <= players_left <= 6         → middle
players_left == 4              → bubble        (regra BUBBLE.PLAN)
players_left == 3              → itm/3handed
players_left == 2              → heads_up
eff_bb <= 10 (qualquer fase)   → +flag short  (regra OPENSHOVE.10BB tem prioridade de ação)
```
(18-player: bubble = 5-left, conforme GdB p15. Estruturas vêm de `prize_structure`.)

### 4.4 ICM / Risk Premium (modelo simples, low ticket)
Não roda solver. Modelo grosso e explicável:
```
risk_premium = base[phase] * pay_jump_factor * (1 - hero_stack_share_adj)
base = {early:0, middle:0.03, bubble:0.18, itm:0.08, 3handed:0.10, hu:0}
```
Uso: aperta ranges de **call de shove** (calling range encolhe ~ risk_premium) e **libera** shove/fold
(fold equity vale mais). Tudo marcado como `INFERENCE` (derivado), não como regra de PDF.

---

## 5. Motor de notas (Scorer)

### 5.1 Base (match da ação)
```
recommended = engine.recommended_actions(ctx)   # {primary, acceptable[], forbidden[]}

if hero == primary and size_ok            -> 10
elif hero == primary and size_off         -> 8–9
elif hero in acceptable                    -> 6–7
elif hero not in forbidden (−EV leve)      -> 4–5
elif viola ICM/stack/range (forbidden)     -> 1–3
else (punt sem justificativa)              -> 0
```

### 5.2 Modificadores (somam/subtraem, clamp 0–10)
| Fator | Efeito |
|---|---|
| Bolha + ação anti-ICM (call loose) | −2 a −3 |
| Criou spot desnecessário (ex.: raise/fold <10bb) | −1 a −2 |
| Existia alternativa mais simples (push/fold disponível) | −1 |
| Size fora da tabela do PDF | −1 |
| Linha condizente com ajuste exploratório válido vs field fraco | +1 (não passa de 10) |
| Força da mão na fronteira do range (decisão fina) | tolerância maior (não pune −1 de size) |

Saída: `{score, base, modifiers:[{fator,delta}], rationale}` — auditável.

### 5.3 Cooler vs erro
`is_cooler(ctx, result)` separa **decisão** de **resultado**: nota avalia a decisão no momento
(EV/ICM), nunca o river. Bad beat / cooler → nota alta + tag `cooler`, sem penalizar.

---

## 6. Motor de geração de mãos (HandGenerator)

### 6.1 Pesos (spots úteis, não aleatório puro)
```python
WEIGHTS = {
  "push_fold": 18, "bubble_call": 12, "resteal_short": 12, "bb_defense": 10,
  "rfi": 10, "vs_limp": 9, "open_shove_10": 9, "postflop_cbet_ip": 7,
  "vs_open_3bet": 6, "blind_war_sb": 5, "bet_vs_missed": 4, "sb_vs_bb_short": 4,
  "3handed": 2, "heads_up": 2,
}
```
Modos: `weighted` (treino geral), `by_category`, `by_phase`, `by_leak` (puxa do LeakDetector),
`adaptive` (ajusta pesos pela taxa de acerto do usuário por categoria).

### 6.2 Construção de um spot (determinístico a partir de seed)
```
1. categoria = sample(WEIGHTS, mode)
2. eff_bb    = sample dentro do bucket da categoria (ex.: push_fold→6–10; resteal→12–20)
3. posições  = escolher hero/vilão válidos para o escopo da regra
4. action_before = montar conforme categoria (ex.: resteal → "raise:CO@2")
5. hand      = amostrar mão com viés de FRONTEIRA (70% perto da borda do range → decisão instrutiva)
6. ctx       = HandContext(...); engine.evaluate → resposta correta + erro comum
7. pergunta  = template_pt(categoria, ctx)
```
Saída = mão de treino (ver JSON §12). O **gerador nunca inventa range**: amostra a mão e pergunta a
ação; a resposta vem do RangeProvider/RuleResolver. Se o range não existe para aquele bucket,
a categoria é pulada (não gera spot "chutado").

### 6.3 Reuso no Simulador
`simulator_engine.new_question()` passa a chamar `pke.generate_spot(mode, focus)` em vez de sortear
posição/stack solto. O grading da resposta usa o **mesmo** `DecisionEvaluator` da área de Torneios.

---

## 7. Motor de leaks (LeakDetector)

### 7.1 Assinaturas (predicados sobre decisões avaliadas)
Cada leak = predicado `(spot, hero_action vs recommended, ctx)`:
```python
LEAKS = {
 "abre_fraco_utg":     lambda d: d.spot=="rfi" and d.hero_pos in ("UTG","UTG1") and d.hand_out_of_range,
 "folda_demais_btn":   lambda d: d.spot=="rfi" and d.hero_pos=="BTN" and d.action=="fold" and d.in_range,
 "call_demais_vs_open":lambda d: d.spot=="vs_open" and d.action=="call" and "call" in d.forbidden,
 "limp_atras":         lambda d: d.action=="limp" and d.hero_pos!="SB",
 "nao_pune_limp":      lambda d: d.spot=="vs_limp" and d.action=="fold" and d.in_punish_range,
 "nao_shova_short":    lambda d: d.eff_bb<=10 and d.in_shove_range and d.action!="shove",
 "raisefold_sub10":    lambda d: d.eff_bb<10 and d.action=="raise" and d.fold_to_shove,
 "call_shove_loose_bolha": lambda d: d.phase=="bubble" and d.spot=="bubble_call" and d.action=="call" and d.hand_below_icm_threshold,
 "passivo_cl_bolha":   lambda d: d.phase=="bubble" and d.icm_role=="CL" and d.action in ("fold","call") and d.could_pressure,
 "passivo_hu":         lambda d: d.phase=="heads_up" and d.hero_pos=="BTN" and d.action=="fold",
 "blefa_demais_micro": lambda d: d.street!="preflop" and d.action=="bet/raise" and d.spot_low_ev_bluff,
 "ignora_stack_efetivo": lambda d: d.size_off and d.size_ignores_eff,
 "ignora_icm":         lambda d: d.phase in ("bubble","itm") and d.icm_violation,
}
```

### 7.2 Agregação multi-torneio
Para cada leak: `frequencia = hits / oportunidades`, `gravidade = média(perda_de_nota)`,
`fase_predominante`, `exemplo_mao`, `regra_violada`, `como_corrigir`, `exercicio = leak→categoria_geradora`.
Só vira "leak confirmado" se `frequencia ≥ θ` e `oportunidades ≥ N_min` (evita ruído de amostra pequena —
senão reporta como "sinal fraco / amostra insuficiente").

---

## 8. Motor de explicação didática (Explainer)

Monta o texto **separando proveniência** e em linguagem de iniciante:
```
[REGRA] Guia de Bolso (p5): fora de BTN/BB, vs open é 3-bet ou fold.
[POR QUÊ] Call OOP te deixa adivinhando no flop; 3-bet retoma a iniciativa.
[INFERÊNCIA] Com 14bb, o 3-bet vira shove (tabela de size ≤17bb = all-in).
[EXPLORATÓRIO] Se o CO abre só forte, dá pra apertar — opcional, não é a regra.
[FRASE] 3-bet ou fold; nada de call fora de BTN/BB.
```
Níveis de verbosidade: `quiz` (1 frase), `treino` (regra+por quê), `aula` (tudo + exemplo).

---

## 9. Pipeline de processamento dos PDFs

```
PDF → extract_text (PyMuPDF/fitz)            # já validado: fitz lê este PDF
    → split em blocos por "Regra de bolso"   # marcadores do mestre
    → para cada bloco: candidate_rule (id, scope, when, then, size, citação)
    → REVISÃO HUMANA (aprovar/editar)         # rules nunca entram sem revisão
    → merge em rules.json (com rev++ e priority por PDF)
    → grids 13×13 (imagens) → continuam nos ranges/sng/*.json (entrada manual/curada)
```
Os **ranges são imagens** no PDF (grids), então a verdade dos ranges vive nos JSON já existentes;
o ingestor extrai **regras textuais**, não tenta "ler" o grid (evita alucinação).

---

## 10. Conflitos entre PDFs

```python
def resolve(ctx):
    applicable = [r for r in rules if matches(r, ctx)]
    by_action = group_by(applicable, lambda r: r.then.primary_action)
    if len(by_action) > 1:
        top = max(applicable, key=lambda r: r.source.priority)
        conflicts = [r for r in applicable if r.then.primary_action != top.then.primary_action]
        return Resolution(chosen=top, conflicts=conflicts)   # UI mostra "⚠ conflito: mestre venceu"
    return Resolution(chosen=best_priority(applicable), conflicts=[])
```
Conflito **nunca** é escondido: vai no campo `conflicts[]` da resposta, com citações dos dois lados.

---

## 11. Ampliar conhecimento sem alucinar

- Toda saída tem `provenance` por campo. `INFERENCE`/`EXPLORATORY` **nunca** se disfarçam de `RULE`.
- `RangeProvider` só devolve hands que existem no JSON. Faltou? → `insufficient_information`.
- `EXPLORATORY` exige justificativa explícita ("vs field tight/loose") e é sempre opcional/marcado.
- Guard-rail no Explainer: se a confiança < limiar ou faltam dados (mão, stack, ação) → responde
  **"falta informação: me diga X"** em vez de chutar.

---

## 12. Exemplos de JSON

### 12.1 Consulta simples (entrada → saída)
```json
// IN  (Consulta entende contexto, não é só busca textual)
{"pergunta": "Com 10bb no botão, o que faço?",
 "ctx": {"eff_stack_bb": 10, "hero_pos": "BTN", "action_before": "fold_to_hero", "phase": "late"}}

// OUT
{"resposta": "Com 10bb no BTN sem ninguém na mão: push/fold. Shove o range de all-in do BTN (≤10bb).",
 "acao": "shove_or_fold",
 "regras": [{"id":"OPENSHOVE.10BB","fonte":"GdB p11–13","tipo":"RULE"}],
 "range_ref": "ranges/sng/ranges_10bb.json#positions.BTN._RFI_shove",
 "inferencia": "10bb está no limiar; abaixo disso, fold de mãos marginais sobe.",
 "exploratorio": "vs blinds que pagam loose, aperte; vs blinds tight, alargue o shove.",
 "conflitos": [],
 "provenance": {"acao":"RULE","inferencia":"INFERENCE","exploratorio":"EXPLORATORY"}}
```

### 12.2 Mão gerada no Simulador
```json
{"spot_id":"gen_8f3a","categoria":"resteal_short",
 "jogadores":6,"blinds":{"sb":50,"bb":100},"ante":true,
 "stacks_fichas":{"hero":1500,"CO":1600},"stacks_bb":{"hero":15,"CO":16},
 "fase":"middle","icm":{"role":"mid","pressure":0.05},
 "hero_pos":"SB","viloes":[{"pos":"CO","action":"raise@2bb"}],
 "hero_cards":"Ad7d",
 "acao_antes":"raise:CO@2bb",
 "pergunta":"15bb no SB, CO abriu 2bb. Você tem A7s. Ação?",
 "resposta_correta":"shove",
 "explicacao":"RESTEAL.SHORT (≤20bb, vilão CO, hero SB): ás naipado → resteal all-in.",
 "erro_comum":"dar call e jogar OOP, ou foldar um ás naipado com fold equity."}
```

### 12.3 Mão real analisada (Torneios) → formato de 20 campos
*(idêntico ao objeto `Decision` do §3.3)*

### 12.4 Relatório de leaks (após N torneios)
```json
{"torneios_analisados": 24, "maos_avaliadas": 410,
 "leaks": [
   {"id":"nao_shova_short","label":"Não shova short stack",
    "frequencia":0.41,"oportunidades":29,"gravidade":"alta",
    "fase":"late","perda_media_nota":4.2,
    "exemplo":"BTN 9bb, A8o, deu raise/fold em vez de shove",
    "regra_violada":"OPENSHOVE.10BB (GdB p11–13)",
    "como_corrigir":"≤10bb = all-in ou fold. Decore o grid de shove do BTN.",
    "exercicio":"push_fold (foco BTN/CO 8–10bb)"},
   {"id":"call_shove_loose_bolha","label":"Paga shove loose na bolha",
    "frequencia":0.33,"oportunidades":12,"gravidade":"alta","fase":"bubble",
    "regra_violada":"BUBBLE.PLAN + risk premium",
    "como_corrigir":"Na bolha o calling range encolhe; pague só o topo.",
    "exercicio":"bubble_call"}
 ],
 "fase_pior":"late","tipo_erro_top":"passividade_short_stack",
 "amostra_insuficiente":["passivo_hu"]}
```

---

## 13. Pseudocódigo dos algoritmos principais

```python
# ---- avaliação de uma decisão (usado por Torneios E grading do Simulador) ----
def evaluate_decision(ctx: HandContext, hero_action: Action) -> Decision:
    ctx.phase = PhaseClassifier(ctx)
    ctx.icm   = icm_model(ctx)
    ctx.spot  = SpotClassifier(ctx)
    res       = RuleResolver.resolve(ctx)            # regras + conflitos (mestre>específico)
    rng       = RangeProvider.get(ctx)               # buckets do JSON ou None
    rec       = recommended_actions(ctx, res, rng)   # {primary, acceptable, forbidden, size}
    if rec is None:                                  # sem regra e sem range
        return Decision.insufficient(ctx, ask=missing_fields(ctx))
    err_type  = classify_error(hero_action, rec, ctx)
    score     = Scorer.score(hero_action, rec, ctx)  # §5
    return Explainer.build(ctx, hero_action, rec, res, score, err_type)

# ---- geração ponderada de spot ----
def generate_spot(mode="weighted", focus=None, skill=None):
    cat = sample_category(WEIGHTS, mode, focus, skill)
    ctx = build_ctx_for(cat)                 # stack bucket, posições, action_before
    ctx.hero_cards = sample_hand_near_boundary(range_for(ctx))
    rec = recommended_actions(ctx, RuleResolver.resolve(ctx), RangeProvider.get(ctx))
    if rec is None: return generate_spot(mode, focus, skill)   # pula spot sem base
    return TrainingHand(ctx, question=template(cat, ctx),
                        answer=rec.primary, explain=Explainer.quiz(ctx, rec),
                        common_mistake=rec.common_mistake)

# ---- leaks ----
def scan_leaks(decisions: list[Decision]):
    out = []
    for leak_id, pred in LEAKS.items():
        hits = [d for d in decisions if opportunity(d, leak_id) and pred(d)]
        opps = [d for d in decisions if opportunity(d, leak_id)]
        if len(opps) >= N_MIN and len(hits)/max(len(opps),1) >= THETA:
            out.append(build_leak_report(leak_id, hits, opps))
    return rank_by(out, key=lambda l: l.frequencia * l.gravidade)
```

---

## 14. Integração com as áreas existentes

| Área | Chama | Entrada | Saída |
|---|---|---|---|
| **Simulador** (`simulator_engine`) | `pke.generate_spot()` + `pke.evaluate_decision()` | modo/foco/skill; depois a ação do usuário | mão de treino; nota+explicação |
| **Consulta** (`insights_api`) | `pke.answer_query()` | pergunta + ctx parcial (pos, stack, fase, ação) | resposta + regra/inferência/exploratório + conflitos |
| **Torneios** (`hands_engine`) | `pke.evaluate_decision()` por mão + `pke.scan_leaks()` no fim | HandContext de cada mão crítica | `Decision[]` + resumo + leaks + exercícios sugeridos |

- **Reuso/zero duplicação:** as 3 áreas usam o **mesmo** `recommended_actions`/`Scorer`/`RangeProvider`.
  Hoje cada engine tem lógica solta; passam a ser *finos* (parse + apresentação) e delegam ao PKE.
- **Versionamento de regras:** `rules.json` tem `schema_version`; cada regra tem `rev`. Mudou regra →
  `rev++` + changelog. Análises guardam o `rules_version` usado (reprodutibilidade).
- **Novo PDF:** roda ingestor (§9) → regras candidatas → revisão → merge com `priority` do PDF. Ranges
  novos entram nos JSON. Nada quebra: regras antigas seguem com sua `rev`.
- **Como testar melhora:** *golden set* de ~50 mãos rotuladas (ação certa + nota esperada) → regressão a
  cada mudança; métrica de Consulta (acerto vs gabarito de perguntas); A/B no Simulador (taxa de acerto
  sobe por categoria após treino direcionado por leak).

---

## STATUS DA IMPLEMENTAÇÃO

**Núcleo PKE (`pke/`)** — ✅ pronto e testado (golden 9/9): rules.json (catálogo do mestre),
context, knowledge, phase/icm, spot, decision (handlers por spot), scorer, explainer, fachada.

**Integração Torneios** — ✅ pronto e testado (mão real + multi-mão sintético):
- `hand_history_parser.py` — agora extrai `opener_pos`, `villain_action`, `faced_allin`,
  `n_limpers`, `hero_voluntary`, `stack_chips` e o **resultado** (`went_to_showdown`,
  `hero_won`, `pot_total`, `hero_busted`).
- `tournament_analysis.py` (camada fina) — `build_context`, `critical_reasons` (filtro-primeiro),
  `screen_and_analyze`, `analyze_hand`, `classify_outcome` (erro/cooler/decisão boa/insuficiente),
  `detect_leaks`, `build_report`. **Toda estratégia fica no PKE.**
- `hands_engine.py` — migração defensiva (colunas `is_critical`, `pke_*`), grava PKE por mão
  crítica no import, e `analyze_tournament(tid)` (re-parseia raw → filtra → PKE → relatório).
- `hands_api.py` + `server.py` — rota `/api/analyze_tournament`.
- Logs de debug por mão via `PKE_DEBUG=1` (spot, fase, eff, regra, range, motivo da nota,
  motivo da recusa por info insuficiente).

> Cooler/bad-beat: hoje marca `cooler` (decisão boa + perdeu all-in no showdown). `bad_beat`
> com equity exige cálculo de equity — reservado para a fase avançada.

**UI do relatório (Import/Torneios)** — ✅ pronto e validado no navegador:
- `build_report` agora devolve `maos` (lista completa por mão crítica: spot, eff_bb, nota,
  outcome, regra, explicação), `erros_graves`, `tipos_erro_top`, além de leaks/treino.
- `components/tournaments/PkeReport.tsx` — **só exibição** (nenhuma regra estratégica no front):
  resumo (média grande/colorida, críticas, com nota, erros graves, fase pior, tipos de erro),
  leaks (freq/gravidade/fase/exemplo/regra/correção/exercício), treino sugerido, **filtros**
  (todos/erros graves/erros/boas/coolers/insuficientes + por fase + por spot), lista de mãos
  **expansíveis** ordenadas pior→melhor, nota destacada, badge de outcome, aviso de cooler.
- `ImportPage.tsx` — após importar, detecta o(s) torneio(s) e carrega `/api/analyze_tournament`;
  botão **Reanalisar** (re-roda o PKE — pega regras atualizadas); seletor se houver vários torneios.
- Regras de UI atendidas: insuficiente ≠ erro técnico; cooler ≠ leak; deixa claro "decisão boa
  mesmo perdendo"; erros graves primeiro.
- Caveat: reimportar o MESMO arquivo (tudo duplicado) não recarrega o relatório (a tela usa as
  mãos *novas* para achar o torneio); o botão Reanalisar recarrega quando já há relatório.

**Integração Consulta** — ✅ pronto e validado (10/10 casos + UI no navegador):
- `pke/query.py` — entende pergunta em linguagem natural + contexto, monta `HandContext`,
  usa o MESMO motor (`recommend`/`score`) para decisão e o glossário para conceito. Detecta:
  conceito (definição), ação candidata ("posso dar raise?", "call foi ruim?"), spot, opener,
  mão/posição/stack do texto. Anti-alucinação: bolha sem range de call → `insufficient`.
- `engine().query(question, context)` + endpoint `POST /api/pke/query` (body objeto).
- `pages/AskPage.tsx` (rota `/perguntar`, card na Launcher) — campo de pergunta, contexto
  opcional, card principal com **badge de ação** (FOLD/CALL/RAISE/SHOVE/3BET), confiança,
  "Por quê?", "Regra usada" (id + Guia de Bolso + página), "Erro comum", "Faltou informação",
  proveniência. **Só exibe** — zero estratégia no front.

**Integração Simulador** — ✅ MVP pronto e validado (10 testes + UI no navegador):
- `pke/generator.py` — gera spots por categoria, ponderados; **só devolve spot que o motor
  corrige** (descarta `insufficient`); amostra mão ~55% dentro do range relevante; nunca inventa
  range. Categorias MVP (bem cobertas): push_fold, resteal_short, vs_open_3bet, limp_punish, rfi,
  bb_defense, hu_btn. (bolha/ICM e pós-flop ficam de fora até ter range/handler — auto-descartados.)
- `pke_sim_api.py` — pede spot ao gerador, guarda contexto em memória, e na resposta chama
  `evaluate_decision` do PKE. Sessão (mãos/acertos/média/por-categoria/pior-melhor/leaks/recomendação).
  Pesos por modo: específico, `livre` (default), `leaks` (via `hands_engine.leak_weights()` dos
  torneios) + **adaptativo** (reforça categorias erradas na sessão). `next_training_weight` no retorno.
- `hands_engine.leak_weights()` — deriva pesos de treino dos leaks de todas as mãos importadas.
- Endpoints `POST /api/pke/sim/{new,answer,session,reset}`.
- `pages/TrainPage.tsx` (rota `/treinar`, card na Launcher) — seleção de modo, card da mão,
  6 botões (Fold/Call/Raise/3-bet/Shove/Check), feedback (nota destacada, correto/incorreto, melhor
  ação, motivo, regra citada, erro comum), stats da sessão e resumo final (pior/melhor categoria,
  leaks do treino, recomendação). **Só exibe** — zero estratégia no front.

> As 3 áreas (Torneios, Consulta, Simulador) agora usam o MESMO motor central (PKE). MVP completo.

**Fase de endurecimento (validação + ciclo de treino)** — ✅ pronto e validado:
- **P1 — "Meus leaks" ligado ao último torneio:** `analyze_tournament` grava `_LAST_TID`;
  `leak_weights(tid=None)` usa o último torneio analisado; `pke_sim_api` captura `leak_focus` +
  `source_tid` no modo leaks; botão **"Treinar meus leaks"** no relatório → `/treinar?mode=leaks`;
  resumo da sessão mostra **desempenho_leaks** (média + veredito por categoria de leak).
- **P2 — Revisão de erros:** sessão guarda `erros` (mão, sua resposta, correta, nota, regra,
  explicação) + fila de replay; resumo lista os erros e botão **"Treinar esses erros"** (modo
  `review` repõe os spots errados). `next_training_weight` no retorno + adaptativo na sessão.
- **P3 — Golden ampliado:** `pke/tests/golden.py` agora com **24 casos** (push/fold por posição,
  resteal vs CO/BTN, call errado vs open, limp punish, HU, BB defense, pós-flop insuficiente,
  cooler NÃO vira leak, bolha sem range não chuta, raise/fold <10bb punido forte). 24/24 OK.
- Validado no navegador o ciclo completo: importar → analisar → "Treinar meus leaks" →
  treino ponderado → encerrar → resumo com erros revisáveis + desempenho nos leaks.

## 15. Roadmap

**MVP (evolução mínima, reaproveita tudo):**
1. `pke/` com `HandContext`, `PhaseClassifier`, `SpotClassifier`, `RangeProvider` (lê os JSON atuais).
2. `rules.json` com o catálogo do §2.1 (só o mestre).
3. `RuleResolver` + `recommended_actions` + `Scorer` (§5) + `Explainer` básico (proveniência).
4. Ligar no **Torneios**: nota + tipo de erro + regra citada por mão crítica.
5. Ligar na **Consulta**: respostas com regra/inferência/exploratório.
6. `generate_spot` para as 6 categorias top (push_fold, bubble_call, resteal, bb_defense, rfi, vs_limp) no **Simulador**.

**Avançado:**
7. `LeakDetector` multi-torneio + relatório + exercícios sugeridos.
8. Dificuldade adaptativa no Simulador (pesos por desempenho).
9. ICM/risk-premium refinado e tag `cooler` no grading.
10. Ingestor de PDFs com revisão + UI de conflitos.
11. Pós-flop (CBET.IP_BB, BETVMISSED, PROBE) no analisador e no gerador.
12. Camada `EXPLORATORY` por perfil de field (tight/loose) configurável.

---

## 16. Versão mínima viável vs avançada (resumo)

| | MVP | Avançado |
|---|---|---|
| Regras | só mestre (`rules.json`) | mestre + específicos + conflitos |
| Ranges | JSON atuais, push/fold + RFI + vs_open | + pós-flop, exploratório por field |
| Nota | base §5.1 + 2–3 modificadores | rubrica completa + ICM + cooler |
| Simulador | 6 categorias ponderadas | adaptativo + por leak |
| Torneios | nota + erro + regra por mão | + leaks + resumo + exercícios |
| Consulta | regra + proveniência | + conflitos + memória de contexto |
| Anti-alucinação | provenance + "falta info" | + ingestor revisado + versionamento |

---

### Apêndice — mapeamento regra → range JSON

| Regra | Onde o range vive |
|---|---|
| `RFI.RANGE` | `ranges/sng/ranges_{stack}bb.json` → `positions[POS].RFI` |
| `OPENSHOVE.10BB` | `ranges/sng/ranges_10bb.json` → `positions[POS]._RFI_shove` |
| `VSRFI.3BET_ONLY` | `positions[POS].vs_RFI[villain].3bet` |
| `RESTEAL.SHORT` | `positions[{BTN,SB,BB}].vs_RFI[{CO,BTN}].shove` (≤20bb) |
| `BB.NOFOLD_SUITED` | `positions.BB.vs_RFI[villain].call` |

Stacks intermediários → interpola para o bucket mais próximo (10/15/30/75), como o `_pick_file` já faz.

"""
FastAPI server — versão web do Preflop Trainer.

Frontend: SPA React (Vite) em frontend/dist. Em dev, rode o Vite (porta 5173)
com proxy pra cá; em produção, rode `npm --prefix frontend run build` e este
servidor passa a servir os arquivos de frontend/dist.

Servir com:
    uvicorn server:app --host 0.0.0.0 --port 8000

Em produção (atrás de nginx/caddy), use múltiplos workers:
    uvicorn server:app --host 0.0.0.0 --port 8000 --workers 1

Note: --workers > 1 quebra a `_current_question` global no simulator_api,
pois cada worker tem seu próprio estado. Pra single-user use --workers 1.
"""
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api import Api
from simulator_api import SimulatorApi
from insights_api import InsightsApi
from hands_api import HandsApi
from tournaments_api import TournamentsApi
from pke import engine as pke_engine
from pke_sim_api import PkeSimApi
from settings_api import SettingsApi
import api as api_module
import simulator_engine
import insights_api as insights_module


_BASE      = os.path.dirname(os.path.abspath(__file__))
UI_DIR     = os.path.join(_BASE, "ui")            # legado (vanilla JS) — não mais servido
DIST_DIR   = os.path.join(_BASE, "frontend", "dist")
RANGES_DIR = os.path.join(_BASE, "ranges")

app = FastAPI(title="Preflop Trainer", version="1.0")

main_api     = Api()
sim_api      = SimulatorApi()
insights_api = InsightsApi()
hands_api    = HandsApi()
tour_api     = TournamentsApi()
pke_sim      = PkeSimApi()
settings_api = SettingsApi()

# Pré-carrega ranges em memória no startup
@app.on_event("startup")
def _warm_cache():
    n1 = api_module.warm_cache()
    n2 = simulator_engine.warm_cache()
    n3 = insights_module.warm_cache()
    print(f"[startup] Cache: consulta={n1} simulador={n2} insights={n3}")


# ── API REST ─────────────────────────────────────────────────────────────────

async def _read_args(request: Request):
    """Args vêm como JSON array no body."""
    try:
        body = await request.body()
        if not body:
            return []
        import json
        data = json.loads(body)
        return data if isinstance(data, list) else [data]
    except Exception:
        return []


@app.post("/api/new_question")
async def new_question(request: Request):
    args = await _read_args(request)
    return sim_api.new_question(*args)

@app.post("/api/submit_answer")
async def submit_answer(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing user_action")
    return sim_api.submit_answer(*args)

@app.post("/api/get_stats")
async def get_stats():
    return sim_api.get_stats()

@app.post("/api/reset_stats")
async def reset_stats():
    return sim_api.reset_stats()

@app.post("/api/get_analytics")
async def get_analytics(request: Request):
    args = await _read_args(request)
    return sim_api.get_analytics(*args)

@app.post("/api/get_improvement")
async def get_improvement(request: Request):
    args = await _read_args(request)
    return sim_api.get_improvement(*args)

@app.post("/api/get_range")
async def get_range(request: Request):
    args = await _read_args(request)
    if len(args) < 3:
        raise HTTPException(400, "pos, scenario, stack_bb required")
    return main_api.get_range(*args)

@app.post("/api/list_villains")
async def list_villains(request: Request):
    args = await _read_args(request)
    if len(args) < 2:
        raise HTTPException(400, "pos, stack_bb required")
    return main_api.list_villains(*args)

@app.post("/api/get_insights")
async def get_insights(request: Request):
    args = await _read_args(request)
    if len(args) < 2:
        raise HTTPException(400, "mode, stack required")
    return insights_api.get_insights(*args)

@app.post("/api/import_hands")
async def import_hands(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing hand history text")
    return hands_api.import_hands(*args)

@app.post("/api/get_hands_summary")
async def get_hands_summary(request: Request):
    args = await _read_args(request)
    return hands_api.get_hands_summary(*args)

@app.post("/api/analyze_tournament")
async def analyze_tournament(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament_id")
    return hands_api.analyze_tournament(*args)

@app.post("/api/study_overview")
async def study_overview():
    return hands_api.study_overview()

@app.post("/api/all_critical_hands")
async def all_critical_hands(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    only_errors = body.get("only_errors", True) if isinstance(body, dict) else True
    limit = int(body.get("limit", 200)) if isinstance(body, dict) else 200
    return hands_api.all_critical_hands(only_errors=only_errors, limit=limit)

# ── Consulta PKE (linguagem natural + contexto) ───────────────────────────────
@app.post("/api/pke/query")
async def pke_query(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    question = body.get("question", "")
    context = body.get("context") or {}
    return pke_engine().query(question, context)

# ── Simulador PKE ──────────────────────────────────────────────────────────────
async def _read_obj(request: Request) -> dict:
    try:
        b = await request.json()
        return b if isinstance(b, dict) else {}
    except Exception:
        return {}

@app.post("/api/pke/sim/new")
async def pke_sim_new(request: Request):
    b = await _read_obj(request)
    return pke_sim.new_spot(b.get("mode", "livre"), b.get("category"))

@app.post("/api/pke/sim/answer")
async def pke_sim_answer(request: Request):
    b = await _read_obj(request)
    if not b.get("spot_id"):
        raise HTTPException(400, "missing spot_id")
    return pke_sim.answer(b["spot_id"], b.get("hero_answer", ""))

@app.post("/api/pke/sim/session")
async def pke_sim_session():
    return pke_sim.session()

@app.post("/api/pke/sim/reset")
async def pke_sim_reset():
    return pke_sim.reset_session()

# ── Configurações / Manutenção PKE ─────────────────────────────────────────────
@app.get("/api/settings/pke_status")
async def settings_pke_status():
    return settings_api.pke_status()

@app.post("/api/settings/reprocess_pke")
async def settings_reprocess_pke(request: Request):
    b = await _read_obj(request)
    return settings_api.reprocess_pke(b.get("scope", "all"),
                                      bool(b.get("recalculate_sessions", True)))

@app.post("/api/settings/recalculate_sessions")
async def settings_recalculate_sessions():
    return settings_api.recalculate_sessions()

@app.post("/api/pke/rule")
async def pke_rule(request: Request):
    b = await _read_obj(request)
    return pke_sim.rule(b.get("id", ""))

# ── Planilha de torneios ──────────────────────────────────────────────────────

@app.post("/api/import_tournaments")
async def import_tournaments(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament file text")
    return tour_api.import_tournaments(*args)

@app.post("/api/import_tournament_files")
async def import_tournament_files(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament file text")
    return tour_api.import_files(*args)

@app.post("/api/list_tournaments")
async def list_tournaments(request: Request):
    args = await _read_args(request)
    return tour_api.list_tournaments(*args)

@app.post("/api/tournaments_overview")
async def tournaments_overview(request: Request):
    args = await _read_args(request)
    return tour_api.tournaments_overview(*args)

@app.post("/api/update_tournament")
async def update_tournament(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament_id")
    return tour_api.update_tournament(*args)

@app.post("/api/delete_tournament")
async def delete_tournament(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament_id")
    return tour_api.delete_tournament(*args)

@app.post("/api/list_tournament_formats")
async def list_tournament_formats():
    return tour_api.list_formats()

@app.post("/api/list_rooms")
async def list_rooms():
    return tour_api.list_rooms()

@app.post("/api/add_tournament")
async def add_tournament(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing tournament data")
    return tour_api.add_tournament(*args)

@app.post("/api/tournaments_sessions")
async def tournaments_sessions(request: Request):
    args = await _read_args(request)
    return tour_api.tournaments_sessions(*args)

@app.post("/api/grind_active")
async def grind_active():
    return tour_api.grind_active()

@app.post("/api/grind_start")
async def grind_start():
    return tour_api.grind_start()

@app.post("/api/grind_stop")
async def grind_stop():
    return tour_api.grind_stop()

@app.post("/api/grind_blocks_for_day")
async def grind_blocks_for_day(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing day")
    return tour_api.grind_blocks_for_day(*args)

@app.post("/api/delete_grind_block")
async def delete_grind_block(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing block_id")
    return tour_api.delete_grind_block(*args)

@app.post("/api/list_tournament_types")
async def list_tournament_types():
    return tour_api.list_tournament_types()

@app.post("/api/set_tournament_payout")
async def set_tournament_payout(request: Request):
    args = await _read_args(request)
    if len(args) < 2:
        raise HTTPException(400, "type_key e payouts_cents obrigatórios")
    return tour_api.set_tournament_payout(*args)

@app.post("/api/delete_tournament_payout")
async def delete_tournament_payout(request: Request):
    args = await _read_args(request)
    if not args:
        raise HTTPException(400, "missing type_key")
    return tour_api.delete_tournament_payout(*args)

@app.post("/api/reparse_tournaments")
async def reparse_tournaments():
    return tour_api.reparse_missing()


# ── Static files (ranges + assets do SPA) ────────────────────────────────────
# Mounts antes do catch-all do SPA.

app.mount("/ranges", StaticFiles(directory=RANGES_DIR), name="ranges")

_ASSETS_DIR = os.path.join(DIST_DIR, "assets")
if os.path.isdir(_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=_ASSETS_DIR), name="assets")


# ── SPA (React/Vite) ──────────────────────────────────────────────────────────
# Catch-all GET: serve o index.html para as rotas do client-side router
# (/, /sim, /consulta) e qualquer arquivo estático solto em dist/.

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    index_html = os.path.join(DIST_DIR, "index.html")
    if not os.path.isfile(index_html):
        raise HTTPException(
            503,
            "Frontend não foi buildado. Rode: npm --prefix frontend install && "
            "npm --prefix frontend run build",
        )
    # Arquivo solto em dist/ (ex.: favicon) — serve direto se existir.
    if full_path:
        candidate = os.path.normpath(os.path.join(DIST_DIR, full_path))
        if candidate.startswith(DIST_DIR) and os.path.isfile(candidate):
            return FileResponse(candidate)
    return FileResponse(index_html)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)

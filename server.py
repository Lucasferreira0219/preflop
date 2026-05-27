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

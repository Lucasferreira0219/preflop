# Preflop — Frontend (React + Vite + Tailwind)

SPA que substitui o frontend vanilla JS antigo (`../ui/`). Consome a mesma API
FastAPI (`../server.py`) — os contratos não mudaram.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (design tokens da paleta em `tailwind.config.js`)
- **Radix UI** (Dialog/Drawer, Select, Tabs, Tooltip, Collapsible, Slider) + componentes próprios
- **Recharts** (gráfico de evolução na análise)
- **react-router-dom** (`/` launcher · `/sim` simulador · `/consulta`)

## Desenvolvimento

Suba o backend e o dev server do Vite (com proxy de `/api` e `/ranges` → :8000):

```bash
python ../server.py            # backend FastAPI em :8000
npm run dev                    # Vite em http://localhost:5173
```

## Produção / uso local

```bash
npm run build                  # gera frontend/dist
python ../server.py            # FastAPI passa a servir frontend/dist
# abra http://localhost:8000
```

> O `server.py` serve `dist/` com fallback de SPA. Se `dist/` não existir,
> os endpoints `/api/*` seguem funcionando mas as páginas retornam 503 pedindo o build.

## Estrutura

- `src/lib/` — `api.ts` (client REST), `poker.ts` (constantes/helpers), `storage.ts` (SM-2 + histórico), `mode.ts`.
- `src/components/ui/` — primitivos Radix estilizados.
- `src/components/poker/` — `PlayingCards`, `PositionRing`, `RangeMatrix`, `RangeLegend`.
- `src/components/{sim,result,analytics,consulta}/` — blocos por tela.
- `src/pages/` — `LauncherPage`, `SimulatorPage`, `ConsultaPage`.

## Verificação visual

`node scripts/shoot.mjs` (precisa do backend rodando) percorre o fluxo e salva
screenshots em `.shots/` reportando erros de console.

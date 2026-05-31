# Escopo aprovado — Melhorias no modo Torneios (inspiradas no MyGrind)

> Decisões tomadas em 31/05/2026. Fonte de inspiração: análise de `mygrind.pokerdatainsights.com` (ver [PRD_MyGrind.md](PRD_MyGrind.md)).
> Este doc é o **contrato de escopo**: só entra o que está em "Aprovado". O resto fica de fora.

---

## ⛔ Princípio inquebrável
A **funcionalidade principal continua sendo o import de histórico de mão / tournament summary que auto-preenche tudo** (data, buy-in, posição, prêmio, etc.). Nada do que está abaixo pode degradar isso. **Cadastro manual é complemento, nunca substituto.**

---

## ✅ Aprovado — incluir

### A. Quick wins no dashboard (baixo esforço, encaixam no que já existe)
1. **Distribuição de posições** — gráfico de frequência de colocação final (1º, 2º–3º, ITM, fora do ITM). Hoje só existe breakdown por formato (`by_format`).
2. **Presets de período** — botões **Hoje / 7 dias / 30 dias / Mês / Ano / Tudo**, somados ao intervalo manual já existente nos `Filters`.
3. **Stat $/torneio** — lucro médio por torneio jogado, ao lado de ROI / ITM / ABI no `StatsRow`.
4. **Big Win + medalhas** — destaca automaticamente torneios com prêmio **> Nx o buy-in** (limiar configurável, default 30x) com 🥇🥈🥉 na lista e/ou marcador no gráfico de banca.

### B. Entrada e organização de dados
5. **Cadastro manual de torneio** — formulário (nome, sala, buy-in, posição, prêmio, participantes, moeda) para registrar um torneio **sem** o arquivo `.txt`. Estritamente aditivo ao import.
6. **Sessão diária** — agrupar torneios por dia, com hora de início/fim e KPIs do dia (estilo "Sessão Diária" do MyGrind).
7. **Múltiplas salas** — suportar salas além do PokerStars (GGPoker etc.) com rótulo/sigla por sala.
8. **Exportar dados (CSV)** — botão para exportar a planilha de torneios (backup / análise externa).

---

## ❌ Descartado (confirmado)

### Módulos grandes — fora
- Módulo **Bankroll** (saldo por sala + carteiras + movimentações)
- Módulo **Rakeback**
- **Multi-moeda com conversão automática** de câmbio

### Coisas de "produto comercial" — fora
- Monetização / planos / página de preços
- Login / contas / autenticação
- Páginas de marketing (landing, "Para Nerds")
- Sync multi-dispositivo / nuvem
- Versão Coach & Team (multi-jogador)
- Compartilhamento social
- Suporte via Discord
- Modo demo

---

## ⚠️ Considerações de implementação (a resolver na fase de plano)

- **Múltiplas salas + auto-import:** o parser atual é específico do PokerStars. Salas novas só terão auto-preenchimento se ganharem parser próprio; até lá, entram via **cadastro manual** (item 5). O modelo `Tournament` hoje **não tem campo de sala/site** — precisará de um novo campo (ex.: `room`/`site`) + migração da persistência.
- **Sessão diária:** depende de `played_at` com horário; verificar se o parser já captura hora (não só data) para derivar início/fim da sessão.
- **Big Win:** limiar (Nx) deve ficar configurável; reaproveitar `prize_cents` vs custo (`buy_in_cents + fee_cents`).
- **Presets de período:** apenas açúcar de UX sobre os filtros `from_date`/`to_date` já existentes.

---

## Status da implementação — ✅ CONCLUÍDO (31/05/2026)

Todos os 8 itens aprovados foram implementados e verificados (build `tsc`+`vite` OK, endpoints testados via TestClient sem resíduo no banco, página carregada no navegador sem erros de console).

**Backend**
- `tournaments_engine.py` — coluna `room` + `origin` (migração defensiva + backfill "PokerStars"); `add_manual()`; `list_rooms()` (catálogo + salas usadas); `sessions()` (agrupa por dia, "Sem data" por último); `overview()` com `avg_profit_cents`, `position_buckets`, `big_wins`/`big_win_multiplier`; filtro por `room`.
- `tournament_parser.py` — marca `room="PokerStars"` no importado.
- `tournaments_api.py` + `server.py` — rotas `list_rooms`, `add_tournament`, `tournaments_sessions`.

**Frontend**
- `types.ts` / `api.ts` — contratos novos.
- `TournamentsPage.tsx` — presets de período · tile `$/torneio` + `Big wins` · `PositionDistribution` · medalhas 🥇🥈🥉 + badge/marcador 🔥 Big Win (≥30× custo) · botão+modal "Novo torneio" · `RoomTag` + filtro de sala · "Exportar CSV" · `SessionsCard` (por dia, clica pra filtrar).

**Trava respeitada:** o fluxo de importação não foi tocado — só colunas e funções novas.

## Adendo — Cronômetro de grind + tela de Sessões dedicada (31/05/2026)

Após feedback ("o MyGrind tinha tempo de grind com start/stop e separava por dias"), foi adicionado:

**Backend**
- `tournaments_engine.py` — tabela `grind_blocks` (start/stop persistido por dia); `grind_start/stop/active`, `grind_by_day`, `grind_blocks_for_day`, `delete_grind_block`; `sessions()` agora inclui `grind_seconds` por dia (e dias que só tiveram grind, sem torneio).
- `tournaments_api.py` + `server.py` — rotas `grind_active/start/stop`, `grind_blocks_for_day`, `delete_grind_block`.

**Frontend**
- `components/tournaments/badges.tsx` — helpers compartilhados (medalha, Big Win, RoomTag, `fmtDuration`).
- `pages/SessionsPage.tsx` (rota `/sessions`) — **cronômetro ao vivo start/stop** (persistente, "hoje" sempre disponível), **navegação dia a dia** (lista + setas ◀▶), **KPIs do dia** (saldo, torneios, ROI, ITM, ABI, $/torneio, prêmios, tempo de grind), **blocos de grind** (início–fim + duração, apagáveis) e **lista de torneios do dia**.
- Botão "Sessões" no header de Torneios.
- **Importar + Novo torneio na própria tela de Sessões** (fluxo "start no grind → registra torneios → stats do dia atualizam na hora"). Modal de cadastro extraído para `components/tournaments/NewTournamentModal.tsx` (com `defaultDay` = dia selecionado) e reusado nas duas telas.
- **Mobile-first** confirmado: na Sessões a lista de dias vira faixa horizontal e KPIs 2 colunas no celular; Torneios já tinha cards (mobile) vs tabela (desktop).
- **Drag & drop de import** nas duas telas: dropzone extraído para `components/tournaments/TournamentImport.tsx` (clica OU arrasta o .txt), reusado em Torneios e Sessões. Torneios manuais e importados são **idênticos** na tabela `tournaments` (só diferem no campo `origin`) e entram em todas as telas/estatísticas normalmente.

# PRD — MyGrind (by Poker Data Insights)

> Documento de Requisitos de Produto reconstruído a partir da análise do site/app público em `https://mygrind.pokerdatainsights.com/` (landing, páginas de Preços e "Para Nerds", e exploração completa do **Modo Demo** do aplicativo).
> Versão do documento: 1.0 • Data: 31/05/2026 • Autor: engenharia reversa do produto observado.

---

## 1. Visão Geral

**MyGrind** é um aplicativo de **rastreamento e análise de performance para jogadores de poker MTT** (torneios multi-mesa). O produto permite ao jogador registrar torneios, acompanhar bankroll em múltiplas salas e carteiras, controlar rakeback e visualizar a evolução dos resultados por meio de gráficos e estatísticas profissionais.

- **Slogan:** "Rastreamento Profissional de Poker" / "Acompanhe Sua Jornada no Poker".
- **Proposta de valor:** "Analise sua performance em MTT com precisão. Gerencie bankroll, rakeback e visualize seu progresso com gráficos profissionais."
- **Plataforma observada:** aplicativo **Flutter Web** (renderização CanvasKit), com PWA/persistência local. Idioma atual: **Português (BR)**; múltiplos idiomas no roadmap.
- **Modelo de negócio:** **SaaS por assinatura** com período/oferta promocional, acesso total a todos os recursos em qualquer plano.

### Números de marketing exibidos
- **30+** Salas de Poker suportadas
- **50+** Carteiras suportadas
- **5+** Moedas
- **∞** Torneios (ilimitados)

---

## 2. Objetivos do Produto

1. Centralizar o registro de **todos os torneios** jogados, em qualquer sala, em qualquer moeda.
2. Oferecer **métricas profissionais** (ROI, ITM%, ABI, lucro/torneio, $/jogo) automaticamente calculadas.
3. Dar visão consolidada e em tempo real do **bankroll** distribuído entre salas e carteiras.
4. Controlar **rakeback/recompensas** por sala para que nenhum pagamento seja perdido.
5. Suportar **multi-moeda com conversão automática** para análise unificada.
6. Entregar **visualizações ricas** (evolução de saldo, distribuição de posições, marcadores de grandes vitórias).

---

## 3. Público-Alvo / Personas

| Persona | Descrição | Necessidade central |
|---|---|---|
| **Grinder de MTT** | Joga torneios online com volume, em uma ou várias salas. | Tracking preciso de ROI/ITM e evolução de bankroll. |
| **Jogador multi-sala / multi-moeda** | Distribui jogo entre GGPoker, PokerStars, redes EUR/USD, cripto. | Consolidação em uma moeda de exibição única. |
| **Jogador focado em rakeback** | Depende de recompensas/rakeback como parte do resultado. | Registro e acompanhamento de rakeback por sala. |
| **Coach / Time** (roadmap) | Gerencia performance de múltiplos jogadores. | Visão multi-jogador (versão Pro). |

---

## 4. Arquitetura de Navegação do Aplicativo

Menu lateral (sidebar) do app:

1. **Dashboard**
2. **Sessão Diária**
3. **Outras Sessões**
4. **Bankroll**
5. **Rakeback**
6. **Em Breve** (roadmap dentro do app)
7. **Configurações**
8. **Voltar ao site**

Barra superior global: seletor de **Moeda de exibição** ($/€…), botão **Atualizar**, filtros de período e **Export**.

---

## 5. Requisitos Funcionais por Módulo

### 5.1 Dashboard
Tela analítica de performance ("Análise de performance em torneios").

- **Cards de KPI principais:**
  - **Saldo Total** (lucro/prejuízo) + **ROI %**
  - **Buy-In Total**
  - **Prêmios** (total ganho)
- **Gráficos:**
  - **Evolução do Saldo** — linha acumulada com gradiente dinâmico verde/vermelho.
  - **Distribuição de Posições** — distribuição de resultados por sala/cores personalizadas.
- **Cards de estatística secundários:** Dias, Torneios, **ABI** (Average Buy-In), **$/Jogo** (lucro médio por torneio), **ITM/KO %** (com nº de prêmios).
- **Filtros de período (presets):** Hoje, 7 dias, 30 dias, Este mês, Ano, Todos, **Personalizado** (intervalo customizado).
- **Seletor de moeda de exibição** e **Atualizar** (recalcular).
- **Export** de dados.
- Atalhos rápidos para **"Melhor Dia"** e **"Maior Prêmio"** (abrem a sessão correspondente em Outras Sessões).
- Estado vazio: "Sem dados para exibir".

### 5.2 Sessão Diária
Registro do dia atual.

- Cabeçalho com a **data do dia** (ex.: "Hoje – Dom, 31 Mai 2026").
- **Horários da Sessão:** campos **Início** e **Término**.
  - Ao adicionar o primeiro torneio do dia, o app pergunta a **hora de início da sessão** (modal "Hora de início da sessão", HH:MM — com opção de **Pular** ou **Confirmar**).
- **Painel de KPIs do dia:** Saldo, Buy-In, Prêmios, ROI, Torneios, ABI, $/Jogo, ITM/KO, Prêmios.
- **Lista "Torneios do Dia"** com contador ("X torneios registrados") e estado vazio ("Nenhum torneio registrado / Adicione seu primeiro torneio do dia").
- Ações: **Novo Torneio** / **Adicionar Torneio**.

#### Formulário "Novo Torneio" (modelo de dados do torneio)
Campos observados:
- **Nome do Torneio** (texto)
- **Sala** (dropdown das salas habilitadas; ex.: GGPoker)
- **Buy-In** (valor)
- **Resultado** (prêmio/retorno)
- **Posição** (colocação final)
- **Participantes** (tamanho do field)
- **Moeda do torneio** (com opção **Alterar**; default = moeda da sala)
- Ações: **Cancelar** / **Adicionar**

### 5.3 Outras Sessões
Histórico/navegação de sessões passadas.

- **Seletor/calendário** de datas com contador ("141 sessão(ões) disponível(eis)" no demo).
- Navegação por **setas** ou clique na data.
- Painel "Torneios do Dia" da sessão selecionada.
- Estados de orientação: "Selecione uma data à esquerda para visualizar"; acessível também via atalhos do Dashboard ("Melhor Dia"/"Maior Prêmio").

### 5.4 Bankroll
Gestão de caixa, carteiras e movimentações.

- **TOTAL GERAL** consolidado = **Salas + Carteiras**, na moeda de exibição.
- **Abas:**
  - **Resumo** — **saldo por sala** (input editável por sala: GGPoker, PokerStars, PartyPoker, iPoker, Bodog, WPT Global, Ya Poker, etc.), com **seletor de data** e atalho **Hoje**.
  - **Movimentações** — registro de depósitos, saques e transferências.
  - **Check-in** — snapshot/registro do saldo do dia.
  - **Carteiras** — gerenciamento de carteiras externas (incl. cripto).
- Ação **Salvar Bankroll**.

### 5.5 Rakeback
Controle de rakeback/recompensas por sala.

- **Lançar Rakeback** — "Registre o rakeback recebido por sala": seletor de **sala**, **data** e valor.
- **Total Rakeback** consolidado.
- **Histórico de Rakeback** por sala (contador "X salas"; estado vazio "Nenhum rakeback lançado").

### 5.6 Configurações
Abas: **Salas**, **Moedas**, **Avançadas**.

- **Salas** — "Habilite ou desabilite salas para exibição na lista de seleção":
  - Lista de salas com **logo**, **nome**, **Atalho** (código curto, ex. GG, PS, PP), **moeda** (badge $ USD / € EUR), status **Ativa/Desativada** (toggle).
  - Ações por sala: **editar**, **excluir**, **reordenar** (Mover para cima/baixo).
  - **Nova Sala** (cadastro de sala customizada).
  - Salas observadas: GGPoker (GG), PokerStars (PS), WPN (WP), ACR (AC), 888Poker (88), PartyPoker (PP), BetFair (BF), iPoker (IP), Winamax (WN), Bodog, WPT Global, Ya Poker.
- **Moedas** — gerenciamento de moedas e **taxas de câmbio** (com suporte a taxa manual de backup).
- **Avançadas** — configurações avançadas (ex.: limiar de "Big Win", dados/reset, importação/exportação).

---

## 6. Recursos Transversais (destacados no marketing)

| Recurso | Descrição |
|---|---|
| **Análises Avançadas** | ROI, ITM% e estatísticas detalhadas de todas as salas. |
| **Gestão de Bankroll** | Monitora depósitos, saques e bankroll em todas as plataformas. |
| **Controle de Rakeback** | Acompanha todas as recompensas em um só lugar. |
| **Gráficos Visuais** | Progresso ao longo do tempo e distribuição de posições. |
| **Multi-Moeda** | Suporte a USD, EUR, BRL e criptomoedas com conversão em tempo real. |
| **Histórico Completo** | Histórico de torneios com filtros por data, sala, buy-in e mais. |

---

## 7. Motor de Métricas e Cálculos

- **ROI** — retorno sobre investimento.
- **ITM%** — percentual de torneios "in the money".
- **ABI** — `Σ Buy-ins / Total de Torneios` (buy-in médio).
- **Profit/Torneio** — `Lucro Total / Total de Torneios` (lucro médio por entrada).
- **$/Jogo** — resultado médio por torneio.
- **ITM/KO** — desempenho de premiação/bounties.
- **Big Win Detection** — identifica automaticamente torneios com **prêmio > 30× o buy-in** (limiar configurável); destacados nos gráficos com **marcadores especiais e medalhas** (🥇🥈🥉, conforme posição).
- **Visualizações:** evolução acumulada de saldo (gradiente verde/vermelho), distribuição por sala, **marcadores de big win com logo da sala**, **tooltips interativos** com valor convertido e data.

---

## 8. Multi-Moeda (Currency Engine)

- Conversão em tempo real entre múltiplas moedas (USD, EUR, BRL, cripto).
- **Sistema de fallback de duas APIs externas** (ex.: `api.exchangerate.host`, `api.frankfurter.app`).
- **Cache de taxas por data** para evitar requisições repetidas.
- Suporte a **taxas manuais** como backup.
- Cada sala tem moeda padrão; cada torneio pode ter moeda própria; o app converte tudo para a **moeda de exibição** escolhida.

---

## 9. Requisitos Não-Funcionais / Arquitetura Técnica
*(da página "Para Nerds")*

- **Stack:** Flutter + Dart; **SQLite** local; **Provider** (padrão Observer/`ChangeNotifier`) para estado reativo; **REST APIs** para câmbio. Hospedagem com Cloudflare.
- **Arquitetura de estado reativa:** `AppState` centraliza a lógica de negócio e expõe streams que notificam automaticamente os widgets consumidores.
- **Cache inteligente de estatísticas:** cacheado e **invalidado automaticamente após ~5 minutos** para performance.
- **Reactive Updates:** mudanças no banco propagam internamente para todos os widgets.
- **Camada de persistência (SQLite):** esquema otimizado para consultas analíticas, **11+ tabelas** com índices estratégicos.
  - Tabelas observadas/inferidas: `rooms`, `sessions`, `tournaments`, `wallets`, `transactions`, `exchange_rates`, `statistics_cache`.
- **Migrações automatizadas:** versionamento incremental e **não-destrutivo** do banco (na **versão 12** no momento da análise).
- **Loading progress:** tracking granular do progresso de inicialização (tela "Verificando dados…").
- **Modo Demo:** dataset de demonstração carregado a partir de um asset (`extracted_data.json`) para experimentação sem cadastro.

---

## 10. Modelo de Dados (alto nível)

| Entidade | Campos principais (observados/inferidos) |
|---|---|
| **Sala (room)** | nome, atalho/sigla, moeda padrão, logo, ativa/inativa, ordem de exibição. |
| **Sessão (session)** | data, hora de início, hora de término, vínculo com torneios do dia. |
| **Torneio (tournament)** | nome, sala, buy-in, resultado/prêmio, posição, nº de participantes, moeda, data/sessão. |
| **Carteira (wallet)** | nome, moeda, saldo (inclui carteiras de cripto). |
| **Movimentação (transaction)** | tipo (depósito/saque/transferência/check-in), valor, sala/carteira, data. |
| **Rakeback** | sala, data, valor. |
| **Taxa de câmbio (exchange_rate)** | par de moedas, taxa, data, origem (API/manual). |
| **Cache de estatísticas** | chave, valor calculado, validade. |

---

## 11. Monetização e Planos

Página de Preços ("Escolha Seu Plano" — "Oferta por Tempo Limitado — Economize até 60%"). **Todos os planos incluem acesso COMPLETO a todos os recursos. Cancele quando quiser.**

| Plano | Preço | Equivalente mensal | Desconto | Destaque |
|---|---|---|---|---|
| **Mensal** | $4.99/mês | $4.99 | — | Sem compromisso |
| **Anual** | $35.88 total (de $59.88) | $2.99/mês | −40% | — |
| **2 Anos** | $47.76 total (de $119.76) | $1.99/mês | −60% | **Melhor Valor** |

- **Incluso em todos os planos:** Dashboard Completo, Torneios Ilimitados, 30+ Salas de Poker, Controle de Rakeback, Gestão de Bankroll, Gráficos e Relatórios, Multi-Moeda, **Suporte via Discord**.
- **Pagamentos aceitos:** criptomoedas e cartões (ícones no rodapé).
- **FAQ:** cancelamento a qualquer momento; métodos de pagamento; segurança de dados; diferença entre planos; funcionamento do suporte.

---

## 12. Roadmap ("Em Breve")

Tags observadas: **Em Breve**, **Planejado**, **Pro**.

| Funcionalidade | Status | Descrição |
|---|---|---|
| **Dashboard Flexível** | Em Breve | Gráficos/métricas com ou sem rakeback — usuário decide como analisar a performance. |
| **Tabela Personalizada** | Em Breve | Configurar a tabela de salas (ITM, rakeback, maior prêmio etc.). |
| **Compartilhamento Social** | Em Breve | Exibir resultados em redes sociais/comunidades com um clique. |
| **Homegames & Freerolls** | Em Breve | Acompanhar torneios especiais sem misturar com o grind regular. |
| **Grind de Satélites** | Em Breve | Métricas exclusivas para quem busca tickets de grandes eventos. |
| **Drag & Drop – GGPoker** | Em Breve | Importação automática arrastando os *tournament summaries* da GG. |
| **Sumários de Qualquer Sala** | Planejado | Importar dados de qualquer plataforma com facilidade. |
| **Multi-Dispositivo** | Planejado | Acessar a conta de qualquer dispositivo com sincronização segura. |
| **Múltiplos Idiomas** | Planejado | App em vários idiomas para a comunidade global. |
| **Coach & Team Version** | Pro | Versão para coaches e times; gerenciar múltiplos jogadores. |

---

## 13. Fora de Escopo (atual)
- Importação automática de mãos/hand history (apenas planejada via Drag & Drop GGPoker).
- Sincronização multi-dispositivo / conta em nuvem (planejada).
- Cash games (o foco atual é MTT; homegames/freerolls planejados).
- Versão multi-jogador para coaches/times (roadmap Pro).

---

## 14. Métricas de Sucesso (sugeridas)
- Nº de torneios registrados por usuário ativo / semana.
- Retenção (D30/D90) e taxa de conversão trial → assinatura.
- Distribuição de planos (Mensal vs Anual vs 2 Anos).
- Engajamento com Dashboard (sessões/semana) e uso de filtros/export.
- % de usuários multi-sala e multi-moeda (validação da proposta de valor).

---

## 15. Observações da Análise
- O app é um **SPA Flutter/CanvasKit**; o conteúdo é renderizado em canvas (sem DOM textual), exigindo a árvore de acessibilidade do Flutter e capturas de tela para mapeamento.
- A análise foi feita via **Modo Demo** público (dados zerados/demonstração); valores como `$0.00` são do dataset de demo, não limitações do produto.
- Não foi acessada a área autenticada real (cadastro via "Começar Agora"), apenas a experiência de demonstração e as páginas públicas.

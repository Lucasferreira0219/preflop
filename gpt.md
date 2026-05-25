PROMPT PARA CLAUDE — Poker Study Assistant / Preflop Range Trainer MTT

Você é um desenvolvedor Python sênior.
Quero que você me ajude a construir um aplicativo desktop offline para estudo de poker MTT.

O projeto será um Poker Study Assistant, começando como um Preflop Range Trainer, com dois modos principais:

Modo Consulta
Modo Simulador

O app deve ser feito em:

Python 3.11+
pywebview
HTML
CSS
JavaScript vanilla
JSON local
PyInstaller futuramente

Não use React, Electron, banco de dados, servidor web externo ou frameworks pesados.

1. Visão geral do produto

A aplicação será um app desktop offline que exibe uma mesa de poker interativa e uma grade de mãos 13×13.

O usuário poderá consultar ranges preflop de MTT com base em:

Stack efetivo em big blinds
Posição do Hero
Posição do Vilão
Tipo de spot
Ação anterior

Depois, o mesmo sistema será usado para um modo de simulação/treino, onde o app gera situações e o usuário responde qual ação tomaria.

A ideia inicial veio de um PRD já existente de Preflop Range Trainer, que previa Python + pywebview, mesa de poker 9-max, grid 13×13, ranges em JSON e uso offline.

2. Objetivo

Criar uma ferramenta para:

Consultar ranges rapidamente
Treinar decisões preflop
Memorizar ranges por repetição
Salvar estatísticas de treino
Funcionar offline
Permitir edição manual dos ranges em JSON
Evoluir futuramente para all-in, c-bet flop e outros spots

O sistema não precisa ser GTO perfeito.
O objetivo é ser uma ferramenta prática, simples, editável e útil para estudo.

3. Dois modos principais
3.1 Modo Consulta

Esse modo serve para consulta rápida.

Exemplo:

Stack: 35bb
Hero: BB
Vilão: BTN
Spot: BB vs RFI

Resultado:
Mostra a grade 13×13 com mãos de call, 3bet, fold e frequências mistas.

Fluxo:

1. Usuário escolhe o stack.
2. Usuário escolhe o módulo: inicialmente Preflop.
3. Usuário escolhe o spot: RFI, vs RFI, BB vs RFI, SB vs RFI etc.
4. Usuário escolhe a posição do Hero.
5. Se necessário, escolhe a posição do Vilão.
6. Sistema carrega o range correto.
7. Sistema exibe a grade 13×13.
8. Usuário pode passar o mouse/clicar em uma mão para ver detalhes.
3.2 Modo Simulador

Esse modo serve para aprender.

O sistema gera uma situação e o usuário responde.

Exemplo:

Stack: 30bb
Hero: BTN
Vilão: CO abriu RFI
Mão: AJs

Qual sua ação?
[Fold] [Call] [Raise/3bet] [All-in]

Depois da resposta:

Sua resposta: Call

Range correto:
Raise/3bet: 60%
Call: 40%
Fold: 0%

Resultado:
Parcialmente correto.

Fluxo:

1. Usuário entra no modo Simulador.
2. Escolhe módulo de treino.
3. Escolhe stack ou deixa aleatório.
4. Escolhe spot ou deixa aleatório.
5. Sistema sorteia uma situação.
6. Sistema sorteia uma mão.
7. Usuário escolhe ação.
8. Sistema valida a resposta.
9. Sistema mostra correção.
10. Sistema salva estatística local.
11. Usuário avança para próxima mão.
4. Módulos do sistema

O sistema deve nascer preparado para vários módulos, mas o MVP deve implementar somente o Preflop.

4.1 Módulo Preflop — MVP

Spots iniciais:

RFI
vs RFI
BB vs RFI
SB vs RFI
BTN vs RFI
Call vs RFI
3bet vs RFI

Exemplos:

RFI_BTN
RFI_CO
BB_vs_BTN_RFI
SB_vs_BTN_RFI
BTN_vs_CO_RFI
CO_vs_UTG_RFI
4.2 Módulo All-in — Futuro

Não implementar agora, mas deixar arquitetura preparada.

Spots futuros:

Open shove
Call all-in
Rejam
Push/fold
SB shove vs BB
BB call vs SB shove
4.3 Módulo Flop — Futuro

Não implementar agora.

Spots futuros:

C-bet flop IP
C-bet flop OOP
Vs c-bet flop
BB vs RFI multiway

Esse módulo vai precisar considerar board, posição, agressor e tipo de textura.

5. Interface principal

Ao abrir o app, mostrar uma tela inicial simples:

┌────────────────────────────────────────────┐
│          POKER STUDY ASSISTANT             │
│                                            │
│        [ Modo Consulta ]                   │
│        [ Modo Simulador ]                  │
│                                            │
│        Stack padrão: 30bb                  │
│        Módulo ativo: Preflop               │
└────────────────────────────────────────────┘
6. Interface do Modo Consulta

Layout desejado:

┌─────────────────────────────────────────────────────┐
│ CONSULTA DE RANGE                         Stack:30bb │
│                                                     │
│ Módulo: [Preflop ▼]    Spot: [BB vs RFI ▼]          │
│                                                     │
│              [ Mesa de Poker 9-max ]                │
│                                                     │
│ Hero: BB                                            │
│ Vilão: BTN                                          │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │             Grade de Mãos 13×13               │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│ Legenda: Raise / Call / All-in / Fold / Mix         │
└─────────────────────────────────────────────────────┘

Requisitos:

Selecionar stack
Selecionar spot
Selecionar Hero
Selecionar Vilão quando necessário
Mostrar grade 13×13
Mostrar frequências ao clicar ou passar o mouse
Atualizar range ao trocar stack
Mostrar mensagem clara caso não exista range cadastrado
7. Interface do Modo Simulador

Layout desejado:

┌─────────────────────────────────────────────────────┐
│ SIMULADOR PREFLOP                         Stack:30bb │
│                                                     │
│ Spot: BTN vs CO RFI                                 │
│                                                     │
│ Hero: BTN                                           │
│ Vilão: CO abriu                                     │
│ Mão: AJs                                            │
│                                                     │
│ Qual sua ação?                                      │
│                                                     │
│ [Fold] [Call] [Raise/3bet] [All-in]                 │
│                                                     │
│ Acertos: 18   Erros: 5   Precisão: 78%              │
└─────────────────────────────────────────────────────┘

Depois da resposta:

┌─────────────────────────────────────────────────────┐
│ Resultado                                           │
│                                                     │
│ Sua resposta: Call                                  │
│ Correto: Raise 60% / Call 40%                       │
│                                                     │
│ Resultado: Parcialmente correto                     │
│                                                     │
│ [Próxima mão] [Ver grade completa]                  │
└─────────────────────────────────────────────────────┘
8. Mesa de poker 9-max

A mesa deve ter as posições:

UTG
UTG+1
UTG+2
MP
HJ
CO
BTN
SB
BB

A mesa pode ser feita com HTML/CSS, sem necessidade de SVG no primeiro momento.

Cada posição deve ser um botão clicável.

Estados visuais:

Normal
Selecionado como Hero
Selecionado como Vilão
Desabilitado
9. Grade 13×13

A grade deve seguir a ordem:

A K Q J T 9 8 7 6 5 4 3 2

Regras:

Diagonal = pares
Triângulo superior = suited
Triângulo inferior = offsuit

Exemplo:

AA   AKs  AQs  AJs
AKo  KK   KQs  KJs
AQo  KQo  QQ   QJs
AJo  KJo  QJo  JJ

Cada célula deve ser colorida pela ação predominante.

Cores sugeridas:

Verde = raise / RFI / 3bet / 4bet
Amarelo = call
Laranja/vermelho = all-in
Cinza = fold
Listrado ou destaque especial = frequência mista

Ao clicar em uma mão, mostrar:

Mão: AJs
Raise: 60%
Call: 40%
All-in: 0%
Fold: 0%
10. Modelo de dados em JSON

Não usar lista simples de mãos.

Evitar este formato:

"RFI": ["AA", "KK", "AKs"]

Usar formato com frequências, porque o sistema precisa servir tanto para consulta quanto para simulador.

Formato recomendado:

{
  "stack_profile": "21-35bb",
  "module": "preflop",
  "spots": {
    "RFI_BTN": {
      "type": "RFI",
      "hero_position": "BTN",
      "villain_position": null,
      "description": "BTN open raise first in",
      "hands": {
        "AA": {"raise": 100, "call": 0, "allin": 0, "fold": 0},
        "KK": {"raise": 100, "call": 0, "allin": 0, "fold": 0},
        "AKs": {"raise": 100, "call": 0, "allin": 0, "fold": 0},
        "KQo": {"raise": 100, "call": 0, "allin": 0, "fold": 0},
        "72o": {"raise": 0, "call": 0, "allin": 0, "fold": 100}
      }
    },
    "BTN_vs_CO_RFI": {
      "type": "vs_RFI",
      "hero_position": "BTN",
      "villain_position": "CO",
      "description": "BTN facing CO open raise",
      "hands": {
        "AA": {"raise": 100, "call": 0, "allin": 0, "fold": 0},
        "AJs": {"raise": 60, "call": 40, "allin": 0, "fold": 0},
        "KJo": {"raise": 0, "call": 30, "allin": 0, "fold": 70},
        "72o": {"raise": 0, "call": 0, "allin": 0, "fold": 100}
      }
    }
  }
}
11. Stack profiles

O MVP deve trabalhar com perfis fixos:

20bb
35bb
50bb
100bb

Arquivos:

preflop_20bb.json
preflop_35bb.json
preflop_50bb.json
preflop_100bb.json

Regra:

Se usuário escolher 10–25bb → usar 20bb
Se escolher 26–42bb → usar 35bb
Se escolher 43–75bb → usar 50bb
Se escolher 76–100bb → usar 100bb

No começo, pode ser um select em vez de slider.

12. Estrutura de pastas

Criar o projeto assim:

poker_study_assistant/
├── main.py
├── api.py
├── range_engine.py
├── simulator_engine.py
├── stats_engine.py
├── data/
│   ├── ranges/
│   │   ├── preflop_20bb.json
│   │   ├── preflop_35bb.json
│   │   ├── preflop_50bb.json
│   │   └── preflop_100bb.json
│   └── user_stats.json
└── ui/
    ├── index.html
    ├── style.css
    └── app.js
13. Responsabilidade dos arquivos
main.py

Responsável por:

Iniciar o app
Criar a janela pywebview
Carregar index.html
Registrar a API Python para o JavaScript
api.py

Responsável por ser a ponte entre frontend e backend.

Funções esperadas:

get_available_stacks()
get_available_spots(module, stack)
get_range(module, stack, spot_key)
generate_simulation_question(config)
answer_simulation_question(question_id, selected_action)
get_stats()
reset_stats()
range_engine.py

Responsável por:

Carregar JSONs
Escolher arquivo correto por stack
Validar se spot existe
Retornar range completo
Retornar dados de uma mão específica
Gerar lista de todas as mãos 13×13
Normalizar dados ausentes como fold 100%

Importante:

Se uma mão não estiver cadastrada no JSON, considerar:

{"raise": 0, "call": 0, "allin": 0, "fold": 100}
simulator_engine.py

Responsável por:

Sortear spot
Sortear mão
Criar pergunta
Validar resposta
Classificar como acerto, parcial ou erro
Retornar explicação curta

Critério de correção:

Ação com maior frequência = acerto total
Ação com frequência maior que 0 = acerto parcial
Ação com frequência 0 = erro

Exemplo:

"AJs": {"raise": 60, "call": 40, "allin": 0, "fold": 0}

Resposta:

raise = correto
call = parcial
fold = errado
allin = errado
stats_engine.py

Responsável por salvar estatísticas locais em JSON.

Salvar:

Total de perguntas
Acertos
Parciais
Erros
Histórico dos últimos erros
Erros por spot
Erros por posição
Erros por mão

Formato sugerido:

{
  "total": 0,
  "correct": 0,
  "partial": 0,
  "wrong": 0,
  "by_spot": {},
  "by_hand": {},
  "mistakes": []
}
ui/index.html

Responsável pela estrutura da tela.

Deve conter:

Tela inicial
Tela Modo Consulta
Tela Modo Simulador
Área da mesa
Área da grid
Área de detalhes da mão
Área de resultado do simulador
ui/style.css

Responsável pelo visual.

Estilo desejado:

Tema escuro
Mesa central
Botões claros e legíveis
Grade 13×13 compacta
Cores bem diferentes para ações
Interface simples, sem poluição
ui/app.js

Responsável por:

Controlar navegação entre telas
Chamar API Python via pywebview
Renderizar mesa
Renderizar grid 13×13
Pintar células conforme ações
Exibir detalhes da mão
Controlar fluxo do simulador
Enviar resposta do usuário
Mostrar resultado
Atualizar estatísticas na tela
14. Ações suportadas

No MVP usar estas ações:

raise
call
allin
fold

Mapeamento visual:

raise = RFI / 3bet / 4bet dependendo do spot
call = call
allin = shove / jam
fold = fold

No JSON usar sempre os nomes técnicos:

{
  "raise": 100,
  "call": 0,
  "allin": 0,
  "fold": 0
}

Na interface, o texto pode mudar conforme o spot.

Exemplo:

Em RFI:
raise aparece como Open Raise

Em vs RFI:
raise aparece como 3bet

Em vs 3bet:
raise aparece como 4bet
15. MVP 1 — Consulta Preflop

Primeiro objetivo do projeto.

Implementar:

App abre com pywebview
Tela inicial com dois botões
Modo Consulta funcional
Select de stack
Select de spot
Mesa 9-max clicável
Grid 13×13
Leitura de JSON local
Tooltip ou painel de detalhes da mão

Ranges podem ser fake no começo.

Criar pelo menos estes spots de exemplo:

RFI_BTN
RFI_CO
RFI_UTG
BB_vs_BTN_RFI
SB_vs_BTN_RFI
BTN_vs_CO_RFI

Não precisa popular ranges reais agora.
Pode usar dados de teste para validar funcionamento.

16. MVP 2 — Simulador Preflop

Depois do Modo Consulta funcionar.

Implementar:

Modo Simulador
Gerar pergunta aleatória
Mostrar stack, spot, hero, vilão e mão
Botões de ação
Validar resposta
Mostrar resultado
Salvar estatísticas
Botão próxima mão
Botão ver grade completa
17. Critérios de aceite — MVP 1

O MVP 1 estará aceito quando:

1. O app abrir como desktop usando pywebview.
2. O usuário conseguir entrar em Modo Consulta.
3. O usuário conseguir escolher stack.
4. O usuário conseguir escolher spot.
5. O usuário conseguir selecionar Hero e Vilão quando necessário.
6. O sistema carregar o JSON correto.
7. O sistema renderizar a grade 13×13.
8. Cada mão tiver cor conforme ação predominante.
9. Clicar em uma mão mostrar frequências.
10. Se o spot não existir, mostrar mensagem amigável.
18. Critérios de aceite — MVP 2

O MVP 2 estará aceito quando:

1. O usuário conseguir entrar em Modo Simulador.
2. O sistema gerar uma situação válida.
3. O sistema mostrar mão, stack, hero, vilão e spot.
4. O usuário conseguir responder Fold, Call, Raise ou All-in.
5. O sistema corrigir a resposta.
6. O sistema diferenciar acerto, parcial e erro.
7. O sistema salvar estatísticas em user_stats.json.
8. O usuário conseguir ir para próxima mão.
9. O usuário conseguir abrir a grade do spot da pergunta.
19. Regras de desenvolvimento

Muito importante:

Desenvolver em pequenos passos.
Não implementar tudo de uma vez.
Não pular etapas.
Sempre entregar arquivos completos.
Não entregar só trechos soltos.
Manter o código simples.
Evitar arquitetura exagerada.
Evitar dependências desnecessárias.
Priorizar funcionamento antes de beleza.

Sempre que criar ou alterar um arquivo, entregar o arquivo completo.

20. Ordem obrigatória de implementação

Siga esta ordem:

1. Criar estrutura de pastas.
2. Criar main.py abrindo pywebview.
3. Criar index.html simples.
4. Criar style.css básico.
5. Criar app.js com navegação entre telas.
6. Criar range_engine.py carregando JSON.
7. Criar api.py expondo funções ao JS.
8. Criar JSON fake de range.
9. Renderizar grid 13×13.
10. Pintar grid com base no range.
11. Criar mesa 9-max clicável.
12. Conectar seleção de spot/posição com range.
13. Implementar detalhes da mão ao clicar.
14. Só depois iniciar simulator_engine.py.
15. Só depois iniciar stats_engine.py.

Não começar pelo simulador.

21. Observações importantes

O sistema deve ser voltado para estudo.

Não implementar automação de clique em site de poker.
Não implementar leitura de tela de poker.
Não implementar bot para jogar automaticamente.
Não tomar decisões automaticamente em mesa real.

O app é uma ferramenta de consulta e treino.

22. Primeira entrega esperada

A primeira entrega deve conter somente:

Estrutura de pastas
main.py
api.py
range_engine.py
ui/index.html
ui/style.css
ui/app.js
data/ranges/preflop_35bb.json

Funcionalidade da primeira entrega:

Abrir app desktop
Entrar em Modo Consulta
Selecionar stack 35bb
Selecionar spot RFI_BTN
Mostrar grid 13×13
Pintar algumas mãos conforme JSON fake
Clicar em uma mão e ver frequências

Não implementar simulador ainda.

23. Comece agora

Comece criando a primeira versão funcional mínima.

Entregue todos os arquivos completos.

Não explique demais.
Priorize código funcional e organizado.
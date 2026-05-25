# PRD — Preflop Range Trainer (MTT)

## Visão geral

Aplicação desktop em Python + webview que exibe uma mesa de poker interativa. O usuário seleciona sua posição e o contexto de ação do vilão; a aplicação responde com o range preflop correto visualizado em uma grade de mãos 13×13.

---

## Problema

Estudar ranges preflop de forma eficiente requer uma ferramenta rápida de consulta. Soluções existentes (planilhas, PDFs, apps genéricos) são lentas de navegar e não reproduzem o fluxo natural de uma mão — "estou aqui, vilão fez isso, o que faço?".

---

## Objetivo

Construir uma ferramenta de consulta/treino de ranges preflop para MTT que:
- Responda a consultas em ≤ 2 cliques
- Cubra as 4 ações principais: RFI, Call vs RFI, 3bet, 4bet
- Considere profundidade de stack em BBs
- Funcione offline, como app desktop

---

## Usuário-alvo

Jogador de MTT semi-sério que quer memorizar ou consultar rapidamente ranges simplificados (exploitative) durante estudo, não durante a partida.

---

## Escopo — MVP

### Tela principal

```
┌─────────────────────────────────────────────────────┐
│  PREFLOP RANGES — MTT                    Stack: 30bb │
│                                                     │
│              [ Mesa de Poker ]                      │
│          (clique na sua posição)                    │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │         Grade de Mãos 13×13                   │  │
│  │  (aparece após seleção de contexto)           │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Legenda: [RFI] [3bet] [Call] [4bet] [Fold]        │
└─────────────────────────────────────────────────────┘
```

### Fluxo de navegação

```
1. Usuário ajusta stack depth (slider: 10–100bb)
2. Usuário clica na sua posição na mesa
   → Se posição pode abrir (ninguém abriu): mostra RFI
   → Se alguém pode ter aberto antes: pede contexto do vilão
3. Usuário clica na posição do vilão (ou "limpo / sem raise")
4. Grade 13×13 é exibida com as ações coloridas
5. Usuário pode clicar em qualquer mão para ver o breakdown
   (ex: AJs → 3bet 100%, ou KQo → 3bet 40% / Call 60%)
```

### Mesa de poker — layout 9-max

Posições em sentido horário: UTG, UTG+1, UTG+2, MP, HJ, CO, BTN, SB, BB

- Mesa renderizada em HTML/CSS/SVG como elipse
- Cada assento é um botão clicável
- Assento selecionado fica destacado

### Grade de mãos 13×13

- Eixos: A K Q J T 9 8 7 6 5 4 3 2 (linhas e colunas)
- Triângulo superior = suited (ex: AKs), inferior = offsuit (ex: AKo), diagonal = pares (AA)
- Cada célula colorida pela ação predominante:
  - Verde escuro → RFI / 3bet / 4bet (agressivo)
  - Amarelo → Call
  - Cinza → Fold
  - Gradiente ou listrado → frequência mista (ex: 50% raise / 50% call)
- Hover em qualquer célula mostra tooltip com frequências exatas

### Ranges — estrutura de dados

```json
{
  "stack_range": "25-40bb",
  "positions": {
    "UTG": {
      "RFI": ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo", "AQs", ...],
      "vs_3bet": {
        "CO": { "4bet": [...], "call": [...], "fold": [...] },
        "BTN": { ... }
      }
    },
    "CO": {
      "RFI": [...],
      "vs_RFI": {
        "UTG": { "3bet": [...], "call": [...], "fold": [...] },
        ...
      }
    }
  }
}
```

Ranges armazenados em arquivos JSON por stack depth (ex: `ranges_20bb.json`, `ranges_30bb.json`, `ranges_50bb.json`, `ranges_100bb.json`).

---

## Stack depths cobertos — MVP

| Perfil     | Stack range |
|------------|-------------|
| Short      | 10–20bb     |
| Mid-short  | 21–35bb     |
| Mid        | 36–50bb     |
| Deep       | 51–100bb    |

A aplicação interpola para o perfil mais próximo.

---

## Ações cobertas

| Situação                    | Ação exibida       |
|-----------------------------|--------------------|
| Nenhum raise antes          | RFI por posição    |
| Vilão abriu, sou IP/OOP     | Call ou 3bet       |
| Vilão 3betou meu RFI        | Call ou 4bet       |
| 4bet feito, decision pré-5  | _(fora do MVP)_    |

---

## Stack — UI vs lógica

- Slider ou input numérico no topo: `Stack: [___] bb`
- Cada mudança de stack recarrega os ranges do perfil mais próximo
- Stack ativo fica visível o tempo todo

---

## Fora do escopo — MVP

- Ranges GTO / solver outputs
- Cash game
- Ante / ICM adjustments (post-MVP opcional)
- Modo quiz/drill (possível v2)
- Multiplayer / sync online

---

## Stack tecnológico

| Componente     | Escolha          | Motivo                                      |
|----------------|------------------|---------------------------------------------|
| Backend        | Python 3.11+     | Lógica de range, carregamento de JSON       |
| UI             | pywebview         | Window nativa com HTML/CSS/JS embutido      |
| Frontend       | HTML + Vanilla JS | Sem framework — app pequeno, sem build step |
| Dados          | JSON local        | Simples, editável pelo usuário              |
| Empacotamento  | PyInstaller       | Distribuição como `.exe` sem Python         |

---

## Estrutura de pastas

```
preflop/
├── main.py              # entry point, abre janela pywebview
├── api.py               # bridge Python ↔ JS (expõe funções ao frontend)
├── ranges/
│   ├── ranges_20bb.json
│   ├── ranges_35bb.json
│   ├── ranges_50bb.json
│   └── ranges_100bb.json
└── ui/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Critérios de aceite — MVP

1. Usuário seleciona posição → range RFI exibido em < 200ms
2. Usuário seleciona posição + posição do vilão → range de resposta exibido corretamente
3. Hover em célula da grade mostra frequências exatas
4. Mudança de stack recalcula e exibe novo range
5. App funciona offline sem instalação de dependências extras (após build)
6. Ranges para todas as posições × todas as situações presentes nos JSONs

---

## Próximos passos pós-PRD

1. Definir ou importar os ranges (fonte: treino próprio, charts públicos, ou entrada manual)
2. Implementar a estrutura base Python + pywebview
3. Construir a grade 13×13 interativa em JS
4. Construir a mesa SVG clicável
5. Conectar bridge JS → Python para carregar ranges
6. Popular os JSONs com ranges reais
7. Build com PyInstaller + teste no Windows

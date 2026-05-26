# Base de Conhecimento SnG — Índice Mestre

> Notas extraídas dos PDFs da **Comunidade Reg Life — Desafio 2K** (curso SnG).
> Conteúdo licenciado para Lucas Ferreira. PDFs originais em `pdfs/`.

## Organização

```
sng_arq/
  pdfs/                          PDFs originais
  extracted_txt/                 Texto puro extraído (uso interno)
  notes/                         ← VOCÊ ESTÁ AQUI
    00-INDEX.md                  Este arquivo
    ranges/                      Conteúdo que vira dados (JSON)
    teoria/                      Contexto e fundamentos
    posflop/                     Fora do escopo atual do app (preflop-only)
```

## Status de implementação

| # | Arquivo | Fase | Stack | Status | App |
|---|---------|------|-------|--------|-----|
| 1 | [ranges/01-open-raise-early.md](ranges/01-open-raise-early.md) | Early | ~75bb | ✅ Implementado | `ranges/sng/ranges_75bb.json` (RFI) |
| 2 | [ranges/02-open-raise-short.md](ranges/02-open-raise-short.md) | Middle | 10-30bb | ⏳ Pendente | Falta JSON 30bb, 15bb |
| 3 | [ranges/03-vs-open-raise.md](ranges/03-vs-open-raise.md) | Early | ~75bb | 🟡 Parcial (3 spots) | `ranges_75bb.json` vs_RFI |
| 4 | [ranges/04-open-shove-short.md](ranges/04-open-shove-short.md) | Mid/Late | ~10bb | ⏳ Pendente | Falta JSON 10bb (push/fold) |
| 5 | [ranges/05-resteal.md](ranges/05-resteal.md) | Middle | 10-20bb | ⏳ Pendente | Falta cenário "resteal" |
| 6 | [teoria/icm-fundamentos.md](teoria/icm-fundamentos.md) | All | — | 📚 Contexto | (futura UI educacional) |
| 7 | [teoria/bolha-itm.md](teoria/bolha-itm.md) | Bolha | — | 📚 Contexto | (futura UI educacional) |
| 8 | [teoria/middle-game.md](teoria/middle-game.md) | Middle | — | 📚 Contexto | — |
| 9 | [teoria/late-game.md](teoria/late-game.md) | Late | — | 📚 Contexto | — |
| 10 | [teoria/3handed-e-hu.md](teoria/3handed-e-hu.md) | 3h/HU | — | 📚 Contexto | (modo HU futuro) |
| 11 | [posflop/teoria-geral.md](posflop/teoria-geral.md) | Early | — | 🚫 Fora escopo | (preflop-only) |
| 12 | [posflop/short-stack.md](posflop/short-stack.md) | Mid/Late | ≤20bb | 🚫 Fora escopo | (preflop-only) |
| 13 | [posflop/pratica.md](posflop/pratica.md) | Early | — | 🚫 Fora escopo | (preflop-only) |

**Legenda**: ✅ feito • 🟡 parcial • ⏳ pendente • 📚 contexto • 🚫 fora de escopo

## Mapa: PDF → conteúdo

### Ranges (viram dados)
| PDF | Conteúdo principal |
|-----|---------|
| Ranges_de_Open_Raise | RFI das 6 posições em early game (~75bb) |
| Open_Raise_Short_Stack | Fragmentação do range em 10-30bb (raise/shove/fold) |
| Ranges_vs_Open_Raise | Defesa contra opens — 3 spots (UTG1, CO, BTN) |
| Ranges_de_Open_Shove_Short_Stack | Push/fold ranges em 10bb |
| Resteal | 3-bet all-in vs raises (12-18bb) |

### Teoria (contexto)
| PDF | Conteúdo principal |
|-----|---------|
| ICM_em_SNG | Risk Premium, cálculos, impacto de stacks |
| Bolha_do_ITM | 5 estudos de caso em RP alto |
| Introducao_Middle_Game | Definição e tópicos do middle |
| Introducao_Late_Game | Definição e tópicos do late, mentalidade |
| handed_e_HU | 3-handed e HU (limp/raise 80/20, resteal) |

### Pós-flop (fora do escopo atual)
| PDF | Conteúdo principal |
|-----|---------|
| Pos-flop_Teoria_e_Guidelines_Gerais | C-bet 1/3 100% IP vs BB |
| Pos-flop_Short_Stack | Bets pequenos 25-33%, frequência 100% |
| Aula_Pos-Flop_na_Pratica | 4 erros comuns + 2 spots OK pra atolar |

## Próximas implementações sugeridas (em ordem de impacto)

### 🥇 Curto prazo (preflop-only, alto valor)
1. **Open Shove 10bb** (`04-open-shove-short.md`) — adiciona o cenário push/fold, faltando hoje no app.
2. **Open Raise Short 30bb e 15bb** — preenche o "gap" entre 75bb e 10bb.
3. **Resteal** — feature distintiva e bem documentada no PDF.

### 🥈 Médio prazo
4. **Defesa BB** (TODO — falta fonte).
5. **Heads-Up** mode (2 jogadores).
6. **Modo "Bolha"** com adaptações de RP.

### 🥉 Longo prazo
7. **Ação Limp** (necessária pra SB Blind War e HU).
8. **Calculadora de RP** simples.
9. **Modais educacionais** com conteúdo dos PDFs de teoria.

## Notas de uso pra Claude (assistente IA)

- Sempre que precisar de detalhes de um PDF, leia o `.md` correspondente (são curtos).
- Pra dados de ranges, prefira os arquivos em `ranges/`.
- Não invente ranges — quando algo não estiver no PDF, deixa como TODO.
- Quando popular novos JSONs, manter o template (`_target_pct`, `_notes`, `source`).
- Sempre validar % combo após gerar ranges (regra de 1326).

---
source: Reg-Life-SNG-Ranges_vs_Open_Raise.pdf
pages: 5
scope: ranges
phase: early_game
stack_bb: ~75
related_data: ranges/sng/ranges_75bb.json (vs_RFI populado parcial — 3 spots)
status: implementado parcial
---

# Ranges vs Open Raise — Early Game (SnG)

## Resumo executivo
- Estratégia de reação a um raise do vilão: definir quando dar **call** e quando dar **3-Bet**.
- Para iniciantes: 3-Bet apenas com **premium** (AA, KK, QQ, JJ, TT, AK, AQ) — evita spots pós-flop complicados.
- Calls devem ser **seletos**, priorizando equidade contra o range do agressor.
- Defesa de BB será aprofundada no módulo Middle Game.

## Spots cobertos pelo PDF (3 apenas)

### 1. UTG+1 vs UTG (~8%)
- Range **extremamente tight**, favorecendo 3-Bet sobre call para evitar multiway.
- Implementado:
  - 3bet: AA-TT, AKs/o, AQs/o (62 combos)
  - call: 99-66, AJs, ATs, KQs, KJs (40 combos)
  - Total: 7.7% ≈ 8% ✓

### 2. CO vs MP (~15%)
- MP abre range mais amplo; CO se expande consequentemente.
- Menos jogadores restantes → menos chance de mão forte aparecer.
- Possibilidade de jogar em posição.
- Implementado (também em CO vs HJ como aproximação):
  - 3bet: AA-TT, AKs/o, AQs/o
  - call: 99-22, AJs-A5s, KQs-KTs, QJs-QTs, JTs, T9s, 98s, 87s, AJo, KQo, KTo
  - Total: 15.8% ✓

### 3. CO vs Botão / BTN vs CO (~24%)
- **Um dos spots mais importantes do jogo** (ranges amplos).
- CO abre ~33%, BTN responde com ~24%.
- Estratégia: 3-Betar com valor (**TT+, AQ+**), expandir call pela posição.
- Implementado (BTN vs CO):
  - 3bet: AA-TT, AKs/o, AQs/o
  - call: 99-22, A2s+, K8s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, AJo, ATo, KQo-KTo, QJo-QTo
  - Total: 24.6% ≈ 24% ✓

## Erros comuns destacados
1. **Jogar passivamente com mãos de valor** (call em vez de 3-bet com QQ, etc).
2. **Pagar raises com mãos marginais** especialmente contra opens de EP.
3. **Foldar demais no BB** (defesa precisa de range adequado).

## Conceitos-chave
- **Implied Odds**: deep stack dá valor a pares baixos (22-66) por implied odds de set.
- **Jogabilidade deep**: suited connectors ganham valor por sequências/flushes.
- **3-Bet light**: 3-bet sem mão premium — requer experiência pós-flop, evitar como iniciante.

## Spots NÃO cobertos pelo PDF (TODO ranges)
O PDF dá apenas 3 spots. Faltam ranges para:
- UTG2 vs UTG (atualmente usando mesmo de UTG1 vs UTG)
- MP vs UTG, MP vs UTG+1/2
- HJ vs UTG, HJ vs MP
- BTN vs MP, BTN vs HJ
- SB vs todos
- BB vs todos (PDF diz que será no Middle Game)

## Heurísticas pro app
- **Já implementado**: 3 spots no `ranges_75bb.json`.
- API `list_villains` retorna apenas vilões com range cadastrado.
- UI consulta marca pills de vilão sem dados com `∅` (cinza).

## TODO de implementação
- [x] Popular UTG1 vs UTG (~8%)
- [x] Popular CO vs MP e CO vs HJ (~15%)
- [x] Popular BTN vs CO (~24%)
- [ ] Conseguir ranges adicionais para spots intermediários (precisa de fonte)
- [ ] Defesa de BB (módulo Middle Game, ainda não chegou)

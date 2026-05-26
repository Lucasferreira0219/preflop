---
source: Reg-Life-SNG-Pos-flop_Short_Stack.pdf
pages: 3
scope: posflop
phase: middle_game / late_game
stack_bb: ≤20
status: fora-do-escopo-atual
---

# Pós-Flop Short Stack

## Resumo executivo
- Pós-flop com **20bb ou menos** em Middle Game.
- Foco principal: **IP vs BB**.
- Estratégia: **bets pequenos (25-33% pot) com frequência ~100%**.

## Razões pra bets pequenos no short
- Mantém espaço pra apostar Turn e River sem overbet.
- Reduz a frequência de defesa que o vilão precisa ter.
- Field não atinge essa frequência → exploit aumenta EV.
- Permite **bet 100%** das vezes.

## Análise GTO (referência)
- Check apenas 30% das vezes.
- Bet 33% é o mais comum (~50% das mãos).
- Bets maiores raros.
- **Simplificação SnG**: arredondar 70% → 100% pelo desajuste do field.

## Ajustes baseados em field
- Ex: Board K55, GTO diz check 75%.
- Na prática, vilão defende menos → **bet 100% explora isso**.

## Guidelines práticas

### Bot abre, BB defende → flop
- **Sempre apostar 25-33% do pote**, independente do flop.
- Vilões não contra-atacam na frequência correta.

### Turn — quando continuar apostando
- Cartas **altas (A, K, Q, J, T)** favorecem nosso range → continuar.
- Tamanhos podem ser maiores (até 2/3 pot).
- Cartas **baixas e conectadas** → check para controle de pote.

### Slow play
- **Evitar** — se tem valor, aposta e constrói pote.
- Check só quando estratégico.

## 3-bet pots
- **Sempre apostar se tem valor**.
- Ajustar tamanhos conforme SPR (stack-to-pot ratio).

## Cuidados OOP
- Estratégia de 100% bet **não** se aplica fora de posição.
- Cenário mais complexo, requer estudo dedicado.

## Conceitos-chave
- **SPR** (Stack-to-Pot Ratio): relação do stack efetivo com o pot.
- **Field não-adaptativo**: simplificações funcionam porque vilão não defende corretamente.
- **Bet 1/3 100%** é a heurística-âncora do IP vs BB short.

## Heurísticas pro app
- Fora do escopo atual (preflop-only).
- Mantém como referência educacional.

## TODO de implementação
- [ ] Fora do escopo atual.

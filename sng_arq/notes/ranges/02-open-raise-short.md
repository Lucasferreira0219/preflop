---
source: Reg-Life-SNG-Open_Raise_Short_Stack.pdf
pages: 4
scope: ranges
phase: middle_game
stack_bb: 10-30 (com referências a 75bb)
related_data: ranges/sng/* (NÃO IMPLEMENTADO)
status: pendente
---

# Open Raise — Short Stack (SnG)

## Resumo executivo
- Conforme stack diminui, o range de open raise se **fragmenta**: parte vira mini-raise, parte vira shove direto, parte vira fold.
- Abaixo de 12bb, vira jogo **push/fold** puro (ver `04-open-shove-short.md`).
- A composição do range muda: mãos premium polarizam (mini-raise + 4-bet), mãos médias shovam, fracas foldam ou viram steal.

## Evolução do range de abertura (BTN como referência)

| Stack (bb) | % open | Estratégia |
|------------|--------|------------|
| 75 BBs | ~50% | Range amplo, sem shoves diretos |
| 30 BBs | ~45% | Redução leve, ajuste de composição |
| 15 BBs | (fragmentado) | Mini-raise + shoves diretos misturados |
| ≤12 BBs | (push/fold) | Frequência alta de shove, jogo direto |

## Fragmentação do range (10-20 BBs)
Com stack reduzido, o range se divide em **3 categorias**:

1. **Mãos premium** → Mini-raise (induz re-steal e extrai valor)
   - Exemplos: TT+, AJs+, AQo+
2. **Mãos médias** → Shove direto (maximiza fold equity)
   - Exemplos: pares médios, ATo+, KQo, suited connectors fortes
3. **Mãos fracas/marginais** → Mini-raise/fold (fold equity pré-flop)
   - Exemplos: broadways offsuit fracas, suited fracos

## Impacto da posição
- **EP (UTG/MP)**: % maior de open raise normal, menor % de shove.
- **LP (CO/BTN)**: aumento de shove e mini-raises polarizados.
- **SB**: range mais linear (não fragmentado).
- **BB**: defesa adaptada vs opens.

## Adaptações exploratórias (nodelock)
- Vilões defendem POUCO → aumentar frequência de open raise.
- Vilões restealam DEMAIS → priorizar shoves diretos, reduzir mini-raises.
- Field tight no resteal → abrir MAIS e shovar MENOS.

## Conceitos-chave
- **Fragmentação**: divisão do range em 3 buckets (mini-raise / shove / fold) — não é uma única ação por mão.
- **Polarização**: mãos premium e fracas usam mini-raise; mãos médias shovam.
- **Fold equity**: probabilidade do vilão foldar — fonte principal de EV no short stack.

## Heurísticas pro app
- **NÃO IMPLEMENTADO**: SnG só tem 75bb. Falta toda a faixa 10-30bb.
- Cada stack profile precisa de **3 buckets de ação** (raise, shove, fold) em vez de só (raise/fold).
- Para 15bb, o simulador deveria permitir 3 ações: "Mini-raise", "Shove", "Fold".
- Para ≤12bb, virar push/fold puro (ver shove file).

## TODO de implementação
- [ ] Adicionar `ranges_30bb.json` e `ranges_15bb.json` na pasta `sng/`
- [ ] Atualizar STACK_PROFILES.sng para incluir esses stacks
- [ ] Suportar **bucket "shove"** no JSON além de raise/call/fold
- [ ] Simulador: adicionar ação "Shove" quando stack ≤ 15bb
- [ ] UI consulta: mostrar 3 cores diferentes (raise / shove / fold) no grid

---
source: Reg-Life-SNG-Ranges_de_Open_Shove_Short_Stack.pdf
pages: 7
scope: ranges
phase: middle_game / late_game
stack_bb: ~10
related_data: ranges/sng/* (NÃO IMPLEMENTADO)
status: pendente
---

# Open Shove — Short Stack (Push/Fold ~10bb)

## Resumo executivo
- Com ~10bb, a estratégia padrão é **Push-Fold puro**.
- Objetivo: identificar mãos lucrativas pra all-in em cada posição.
- EV é soma de 3 cenários: vilão folda (+), vilão paga e perdemos (-), vilão paga e ganhamos (+).
- Calculado com HRC / ICMizer.

## Ranges de Open Shove por posição (10bb)

| Posição | % shove | Composição |
|---------|---------|------------|
| **UTG** | ~9.4% | Pares médios+, AJo+, A5s+. Evitar marginais. |
| **HJ**  | ~15% | Pares pequenos, ases suited, broadways fortes. Offsuit reduzido. |
| **CO**  | ~26% | Pares, ases suited, broadways. Raises opcionais — simplificar pra push. |
| **BTN** | ~32% | Todos ases, pares, broadways. Não perder Q9o, T8s. |
| **SB vs BB** | ~54% | Muito amplo — J2o, K6o, T7o entram. AA/KK podem raise. |

**Recomendação**: iniciantes devem **all-in puro** (sem mix de raises), evita decisões pós-flop complicadas.

## Ranges de Call vs Shove (BB defendendo)

| Cenário | % call | Mãos típicas |
|---------|--------|--------------|
| **BB vs SB shove** | ~18% | A6o+, K9s+, KTo+, 55+ |
| **BB vs BTN shove** | ~16% | (mais tight que vs SB) |
| **BB vs UTG shove** | ~8% | (bem restrito) |

Regra: mais jogadores envolvidos → call mais tight.

## Adaptações exploratórias
- BB paga MENOS do que teórico → expandir shove para ~68%.
- BB paga MAIS → reduzir para ~40%.

## Conceitos-chave
- **Push/Fold**: simplificação binária da decisão (sem mix de ações).
- **Fold equity**: EV de fazer o vilão foldar — fonte principal pra mãos médias.
- **Equilíbrio range push vs range call**: shove muito amplo se o call do vilão for tight; reduzir se call for loose.

## Heurísticas pro app
- **NÃO IMPLEMENTADO**: precisa de `ranges_10bb.json` SnG.
- Esquema do JSON precisa de novo cenário: `open_shove` (em vez de RFI normal).
- Buckets: apenas `shove` e `fold` (binário).
- Para BB defendendo, novo cenário `call_vs_shove` com bucket único `call`.
- Simulador: quando stack = 10bb, ação muda de "Raise/Fold" para "Shove/Fold".

## TODO de implementação
- [ ] Criar `ranges/sng/ranges_10bb.json` com ranges de shove
- [ ] Esquema: `positions.{pos}.open_shove = [mãos]`
- [ ] Esquema: `positions.BB.vs_shove.{villain} = { call: [...] }`
- [ ] Atualizar simulator_engine para gerar perguntas de shove quando stack ≤ 12
- [ ] UI consulta: novo cenário no toggle de vilão "Shove vs ele"
- [ ] Add ação "Shove" no simulator UI

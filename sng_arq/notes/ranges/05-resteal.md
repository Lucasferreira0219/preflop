---
source: Reg-Life-SNG-Resteal.pdf
pages: 7
scope: ranges
phase: middle_game
stack_bb: 10-20 (geralmente 12-15)
related_data: ranges/sng/* (NÃO IMPLEMENTADO)
status: pendente
---

# Resteal — 3-Bet All-in Short Stack

## Resumo executivo
- **Resteal** = re-roubo. Vilão abre tentando roubar blinds; nós devolvemos all-in.
- Ferramenta exclusiva de short stack (20bb ou menos, ideal 10-15bb).
- EV depende de **2 variáveis do vilão**: (1) range de open raise, (2) range de call vs nosso shove.
- Quanto mais ele abre e menos ele paga, maior nossa frequência de resteal.

## Spots cobertos

### BB vs BTN (15bb)
- BTN abre 33%.
- Nosso range de shove inclui **muitas suited e pares baixos**.
- Ax offsuit têm blockers → lucrativos para all-in.

### BTN vs CO (12bb)
- CO abre 27%.
- Estratégia: **push/fold puro**.
- **Erro comum**: call especulativo com 12bb. Sempre shove ou fold.

### SB vs HJ (15bb)
- HJ abre 21%.
- Sem calls — apenas shove ou fold.
- Suited e pares pequenos lucrativos pra resteal.

### HJ vs UTG (18bb)
- UTG tem range tight (~14-18%) → poucos spots de resteal.
- Melhor abordagem: **3-bet não all-in** ou fold.
- Resteal contra range forte é -EV.

## Conceitos-chave
- **Resteal** ≠ regular 3-bet (resteal é sempre all-in, no short stack).
- **Posição estratégica**: resteal eficiente do BB (1 adversário restante) e SB.
- **Range de open do vilão é o gatilho**: shove só se ele abrir LARGO.
- **Posições finais (BTN/CO/HJ) abrem mais** → alvos preferenciais de resteal.

## Adaptações exploratórias
- Vilão abre MAIS do que deveria e paga MENOS → expandir resteal.
- Exemplo: BTN abre 40% (em vez de 33%) com mesma frequência de call → BB pode ser muito mais agressivo.

## Heurísticas pro app
- **NÃO IMPLEMENTADO**: novo cenário `resteal` (3-bet all-in vs RFI).
- Atualmente o cenário `vs_RFI` aceita `3bet` + `call`. Para resteal, faz sentido adicionar `shove` como bucket separado.
- Em stacks 12-18bb, vs_RFI muda de "3bet normal" para "resteal shove".
- Boa feature: ao mostrar vs_RFI no app, se stack ≤ 18bb, renomear "3-Bet" para "Resteal (shove)".

## TODO de implementação
- [ ] Criar `ranges/sng/ranges_15bb.json` SnG
- [ ] Esquema: `positions.{pos}.vs_RFI.{villain} = { shove: [...], call: [...] }`
- [ ] No simulador, quando vs_RFI e stack ≤ 18bb, ação 3-Bet vira "Shove (Resteal)"
- [ ] UI: avisar "spot de resteal — push/fold" como dica contextual

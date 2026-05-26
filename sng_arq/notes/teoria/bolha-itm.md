---
source: Reg-Life-SNG-Bolha_do_ITM.pdf
pages: 4
scope: teoria
phase: bolha
status: contexto / estudos-de-caso
---

# Bolha do ITM — Análise Prática

## Resumo executivo
- Aula prática de **5 estudos de caso** na bolha usando HRC.
- Bolha = momento mais crítico do torneio (cada erro = alto custo, cada acerto = max EV).
- Reforça **Risk Premium aplicado**: como RP muda decisões.

## Mão 1: CO com A5o (Chip Leader)
- CL no CO, adversários todos com RP > 15%.
- CO tem RP baixo (~4%).
- **Range teórico do CO**: push any two cards (qualquer mão).
- Ajuste se field der call loose: priorizar **raises** em vez de pushes.

## Mão 2: SB shove vs BB (10bb)
- RP do BB vs SB: ~10%.
- Range teórico do SB: ~67% shove.
- Cenário ajustado para SB mais tight (~50%): BB calla menos.
- Conclusão: **identificar tendências do field** é essencial.

## Mão 3: AKo fold no BB vs SB shove (25bb)
- RP BB vs SB: **~23%** (extremo).
- Em teoria SB pode shovar any two cards.
- Field real não shova tão loose → AKo fica ainda pior.
- **RP > 20% pode justificar fold de AKo**.

## Mão 4: Blind War com 15% RP simétrico
- Range de shove SB amplo (RP alto).
- Se vilão calla MAIS que teórico → muda estratégia para **raises e limps**.
- Field tende a overfold → raises e limps ficam +EV vs shove direto.

## Mão 5: Blind War com 10-3o (chip leader)
- CL com RP favorável (~4%).
- T3o **não foldar**: vantagem de CL.
- Raise e shove são viáveis, dependendo do vilão.
- Field que overfolda → raise é mais lucrativo.

## Conceitos-chave
- **RP simétrico**: quando ambos os jogadores têm RP similar (típico em blind war heads-up).
- **CL vs short**: CL deve atacar agressivamente, short pode foldar mais (paradoxalmente).
- **Field tendency**: dados reais do vilão mudam a estratégia ótima.
- **Limp como ferramenta**: blind war na bolha às vezes pede limp em vez de raise/shove.

## Heurísticas pro app (futuro)
- Modo "Bolha" com adaptações:
  - SB Blind War com **limp como ação válida** (não só raise/fold).
  - CL com ranges mais amplos.
  - Mid stacks com calls mais tight.
- Dica contextual: "RP > 20% — considere foldar AKo" (situacional).

## TODO de implementação
- [ ] Suporte a ação Limp (mencionado em vários PDFs)
- [ ] Modo de estudo "casos da bolha" — perguntas inspiradas nas 5 mãos do PDF
- [ ] Calculadora de RP simples baseada em stacks

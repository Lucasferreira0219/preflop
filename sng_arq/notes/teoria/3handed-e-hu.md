---
source: Reg-Life-SNG-handed_e_HU.pdf  (3-handed e Heads-Up)
pages: 3
scope: teoria
phase: 3-handed / hu
status: contexto + heurística clara para HU
---

# 3-Handed e Heads-Up

## Resumo executivo
- **3-Handed**: RP cai para ~7.1% (pay jump 3º→2º menor que da bolha) → jogo mais solto.
- **Heads-Up**: ICM **desaparece** → joga 100% ChipEV.
- HU pede VPIP altíssimo, especialmente em posição.

## 3-Handed

### RP médio (com stacks iguais)
- **7.1%** — bem menor que bolha (15.2%).
- Se houver um super-short → pode subir até 16%, mas raramente atinge 25%.

### Estratégia
- Shorts entre si podem jogar mais loose (RP menor).
- CL abusa do short sem medo.
- Se for o 2º em fichas: **evitar confronto direto com CL**.

## Heads-Up (HU)

### Conceito-chave
- **ICM = 0** → 100% ChipEV.
- Objetivo: acumular fichas sem se preocupar com pay jumps.

### Estratégia geral
- **Alto VPIP** — joga muitas mãos.
- Adversários geralmente jogam mal HU → explorar.
- Dividir estudo por **stack size** (10/15/20 bb diferentes).

### Em posição (BTN/SB no HU)
1. **Nunca foldar em posição** — joga 100% das mãos.
2. **80% Limp / 20% Raise**:
   - Mãos fortes E lixos completos → Raise.
   - Mãos medianas → Limp.
3. **Exploração do vilão**:
   - Vilão folda muito para raise → aumenta raise.
   - Vilão 3-beta muito → mais limps.
   - Vilão pune limps demais → induza com mãos fortes (slow play).
4. **Push/Fold ~10bb**:
   - Ampliar shove se vilão calla menos que teórico.

### Fora de posição (BB no HU)
- **Contra Raise**:
  - Fold mínimo (~18% em 15bb).
  - **Resteal shove** com pares pequenos e Ax off.
  - Call mais amplo devido ao ChipEV.
- **Contra Limp**:
  - Push agressivo com Ax off e pares baixos.
  - Ajustar raises conforme tendência do vilão.
- **Call vs All-in curto (<10bb)**:
  - Pot odds puras.
  - Vilão shova muito → call mais amplo.
  - Vilão shova tight → reduz calls.

## Conceitos-chave
- **Limp/Raise 80/20** é a heurística-âncora do HU IP.
- **Resteal no BB** com pares pequenos e Ax off (blockers + equidade).
- **ChipEV puro** no HU → ranges padrão sem ajuste ICM.

## Heurísticas pro app (futuro)
- Modo HU específico (2 jogadores apenas).
- Ação **Limp** disponível (crítica no HU).
- Slider de "tendência do vilão" para exploração?
- Cenários por stack size (10/15/20 bb).

## TODO de implementação
- [ ] Modo Heads-Up (player_count = 2 já existe na enum, mas falta ranges)
- [ ] Ação Limp no simulador (HU + SB Blind War)
- [ ] Ranges HU por stack (10, 15, 20 bb)
- [ ] 3-handed (3 jogadores) com ranges adaptados

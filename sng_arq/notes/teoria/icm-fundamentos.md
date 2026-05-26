---
source: Reg-Life-SNG-ICM_em_SNG.pdf
pages: 9
scope: teoria
phase: all
status: contexto / não-acionável-diretamente
---

# ICM em SnG — Fundamentos

## Resumo executivo
- **ICM (Independent Chip Model)**: modelo que converte fichas em valor monetário esperado considerando o pay structure.
- **RP (Risk Premium)**: penalidade em fichas para entrar em mãos devido à pressão do ICM.
- Software de referência: **HRC** (Holdem Resources Calculator).
- ICM impacta diretamente ranges em todas as fases, mas é máximo na **bolha**.

## RP médio por field (na bolha)

| Field | RP médio |
|-------|----------|
| SnG 9 jogadores | 15.2% |
| SnG 18 jogadores | 14.7% |
| SnG 45 jogadores | 17% |

**Tese**: independente do field, a bolha gera RP alto → exige adaptação.

## Impacto da distribuição de stacks

### Cenário A: Chip leader 40bb + 3 shorts
- Shorts vs CL: **20% RP** (alto)
- CL vs shorts: **RP baixo** (pode jogar loose)
- Shorts entre si: 11.4% RP (menor, mas ainda relevante)

### Cenário B: CL 40bb + 2 mid 20bb + 1 short 10bb
- Mid vs CL: **21.4% RP** (mais alto que A)
- CL vs short: **3% RP** (pode atacar livremente)

### Cenário C: CL 30bb + 2 mid 20bb + super-short 3bb
- Mid vs CL: **25% RP** (pressão extrema)
- Super-short tem RP **baixo (3-4%)** → pode arriscar muito

**Regra geral**: **mid stacks sofrem mais ICM**, CL e super-short são os mais "livres".

## Ajuste de ranges com RP (15bb BTN — open shove)

| Fase | RP | Range shove |
|------|----|--|
| Early (RP 4.8%) | baixo | ~40% |
| Middle (RP 8.1%) | médio | aumenta |
| Bolha (RP 15.2%) | alto | **mais tight**, raise só premium |

## Ajuste de call ranges na bolha (BB vs SB 10bb shove)

| Fase | RP | Call range |
|------|----|------------|
| Early (ChipEV) | 0% | **44%** |
| Middle | 8.1% | 29% |
| Bolha | 15.2% | **16%** |

**Conclusão**: na bolha, call range cai de 44% → 16%.

## Conceitos-chave
- **ChipEV** = valor esperado em fichas (ignora pay structure).
- **$EV / ICM EV** = valor esperado em dinheiro (considera estrutura de premiação).
- Decisões devem maximizar **$EV**, não ChipEV, especialmente na bolha.
- Se há um super-short na mesa, mid stacks são pressionados extra → call range cai mais.

## Aplicação prática (citado no PDF)
1. Revisar mãos passadas identificando erros baseados em RP.
2. Simular cenários no HRC.
3. Implementar ajustes na prática.

## Heurísticas pro app (futuro)
- **Modo "Bolha"**: ranges separados com RP alto aplicado — TODO.
- Dica contextual no app: "Você está na bolha — RP ~15%, reduza calls".
- Calculadora de RP simples baseada em (stacks, pay structure).
- Diferenciar ranges ChipEV vs ICM em alguma UI futura.

## TODO de implementação
- [ ] Eventual feature "fase do torneio" (early / middle / bolha / late) que ajusta ranges.
- [ ] Tooltip educacional sobre RP no app.
- [ ] Comparativo ChipEV vs ICM (educacional).

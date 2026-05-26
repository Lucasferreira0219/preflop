---
source: Reg-Life-SNG-Ranges_de_Open_Raise.pdf
pages: 8
scope: ranges
phase: early_game
stack_bb: ~75
related_data: ranges/sng/ranges_75bb.json (RFI populado)
status: implementado
---

# Open Raise — Early Game (SnG)

## Resumo executivo
- Estamos no Early Game (~75bb, 1500 fichas, 9-handed, ICM ligado, HRC).
- ICM reduz o range de UTG em ~3% por causa do Risk Premium (4.8%) → ChipEV 17% vs ICM 14%.
- Recomendado raise 3x BB para stacks deep; mini-raises geram muitos calls.
- SnG 18 players tem ranges quase idênticos (UTG 13% vs 12.8%, BTN 54% vs 50%).

## Ranges por posição

| Posição | % de abertura | Mãos típicas |
|---------|--------------|--------------|
| **UTG** | 13% | 77+, A3s+, AJo, KQo, broadways suited |
| **MP**  | 16% | (sem detalhamento no PDF) |
| **HJ**  | 25% | Expande suited: K8s, T9s |
| **CO**  | 33% | Expande K2s+, J7s+, T7s+, K9o, J9o |
| **BTN** | 50% | 64s+, K6o, J3o, todos os ases e pares |
| **SB**  | "Blind War" | Estratégia diferente, inclui muitos limps |

## Conceitos-chave
- **RFI (Raise First In)**: range usado quando todos foldam até nós.
- **Risk Premium**: penalidade em fichas para entrar em mão devido ao ICM. Médio na bolha 9p = 15.2%.
- **ChipEV vs ICM**: ChipEV ignora o pay structure; ICM considera o valor real das fichas.

## Erros comuns destacados
1. **Limpar** em qualquer posição (sempre raise quando entrar).
2. **Abrir mãos marginais no UTG** (ex: JTo).
3. **Pouca agressividade no Button** (devíamos atacar mais).

## Anti-limp (jogar contra limps)
- Tamanho de raise vs 1 limp: deep 3.5-4x, short 2.5-3x.
- 2 limps: +1bb no size.
- Para definir RANGE de punição: usar o range de RFI da posição do limper (limp UTG → punir com range UTG).
- Erro comum: dar limp atrás. Sempre raise.

## Heurísticas pro app
- **Já implementado**: ranges_75bb.json tem RFI das 6 posições + UTG/UTG1/UTG2 compartilham.
- **Não modelado**: limp como ação válida. SB blind war hoje é só Raise/Fold — limps faltam.
- Possível feature futura: modal/dica explicando RP e ChipEV vs ICM ao usuário.

## TODO de implementação
- [x] Popular RFI das 6 posições no JSON SnG 75bb
- [ ] Adicionar ação Limp para SB (Blind War)
- [ ] UI: tooltip/badge explicando "% RP" ao mostrar o range

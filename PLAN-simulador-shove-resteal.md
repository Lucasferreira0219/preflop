# Plano: Reformular o Simulador (Shove/Resteal + Explicação contextual)

## Contexto

O Simulador hoje ([ui/simulator.html](ui/simulator.html) + [ui/simulator.js](ui/simulator.js)) gera perguntas com 3 cenários fixos (RFI, vs_RFI, vs_3bet) e ações fixas (Raise/Fold, 3-Bet/Call/Fold, 4-Bet/Call/Fold). O feedback é minimalista — só "CORRETO/ERRADO" + grid de mãos. Tudo isso já funciona bem mas:

- **Faltam ações de short stack**: Shove (all-in) e Resteal (3-bet all-in)
- **A explicação é genérica** (`getExplanation` em [ui/simulator.js](ui/simulator.js) linhas 339-370) — não puxa da base de conhecimento rica que já existe pra Consulta
- **Stacks SnG limitados** a 75bb (só early game) — não cobre middle/late/push-fold
- **Material dos PDFs** ([sng_arq/notes/ranges/04-open-shove-short.md](sng_arq/notes/ranges/04-open-shove-short.md), [05-resteal.md](sng_arq/notes/ranges/05-resteal.md)) ainda não foi convertido em dados

**Objetivo**: cobrir toda a curva de stack do SnG (push/fold → resteal → fragmentação → deep) com ações apropriadas e, após cada resposta, dar uma explicação **sólida e contextual** reusando a infraestrutura de insights da Consulta.

**Decisões já tomadas com o usuário**:
- Ações novas: **Shove** (≤12bb) e **Resteal** (vs_RFI em 10-18bb). **Sem Limp** por enquanto.
- Criar ranges SnG para **10, 15, 30 e 75bb**.
- **Fase derivada do stack** (auto). Sem seletor manual de fase no simulador.

---

## Arquitetura

### 1. Modelo de dados — ranges

**Novos arquivos JSON** baseados nos MDs em `sng_arq/notes/ranges/`:
- [ranges/sng/ranges_10bb.json](ranges/sng/ranges_10bb.json) — push/fold puro (fonte: `04-open-shove-short.md`)
- [ranges/sng/ranges_15bb.json](ranges/sng/ranges_15bb.json) — resteal + fragmentação (fonte: `05-resteal.md` + `02-open-raise-short.md`)
- [ranges/sng/ranges_30bb.json](ranges/sng/ranges_30bb.json) — transição middle (fonte: `02-open-raise-short.md`)

**Schema**: mantém o existente, **adiciona apenas dois buckets opcionais por posição**:

```json
"BTN": {
  "RFI": ["AA","KK","QQ","JJ","AKs","AKo","AQs"],     // mini-raise (premium) em 15bb
  "_RFI_shove": ["TT","99","88","77","ATo+","KQo","K9s+","98s","87s","..."],  // shove direto
  "vs_RFI": {
    "CO": {
      "shove": ["TT+","AQ+","A8s+","KQs","99","88","77","K9s+","Q9s+"],  // resteal (3-bet all-in)
      "call":  [],
      "3bet":  []  // vazio = sem 3-bet normal em short
    }
  },
  "vs_3bet": { ... }
}
```

- `_RFI_shove` (prefixo `_`): bucket de open shove em short stack. Lido junto com `RFI` quando stack ≤18bb.
- `shove` dentro de `vs_RFI.{villain}`: bucket de resteal. Substitui `3bet` em short stack.
- `RFI` (raise mini) vazio em 10bb (push/fold puro), populado em 15bb (fragmentação com premium em mini-raise) e 30/75bb.

**Por que esse schema**: invariante "1 mão → 1 ação correta" preservada. Engine decide qual bucket consultar baseado no stack. Frontend continua usando o mesmo lookup. Consulta também ganha esses ranges automaticamente.

**Adicionar em [data/insights/universal.json](data/insights/universal.json)** (na seção `actions`):
```json
"shove":   { "name": "Shove (All-in)", "color": "#d32f2f", "emoji": "🔴", "long_desc": "All-in pré-flop. Em short stack (≤12bb) é a ação padrão. EV vem de fold equity + equidade quando paga." },
"resteal": { "name": "Resteal", "color": "#d81b60", "emoji": "💥", "long_desc": "3-bet all-in num vilão que abriu pra roubar (12-18bb). Range largo do vilão + nosso short = -EV pra ele pagar." }
```

**Adicionar em [data/insights/sng.json](data/insights/sng.json)** (na seção `spots`, dos MDs `04` e `05`):
- `RFI`: `UTG@10`, `HJ@10`, `CO@10`, `BTN@10`, `SB@10` — com `summary`, `key_hands` (shove), `common_mistakes`, `icm_note`, `source_md`
- `vs_RFI`: `BB_vs_BTN@15`, `BB_vs_SB@15`, `BTN_vs_CO@15`, `SB_vs_HJ@15`, `HJ_vs_UTG@15` — com `summary` mencionando resteal, fold equity
- `RFI`: `BTN@15`, `CO@15`, `HJ@15` (fragmentação — premium mini-raise + médias shove)

### 2. Backend — engine + API

**[simulator_engine.py](simulator_engine.py)**:
- Atualizar `STACK_PROFILES.sng` (linha 8-17) para incluir 10/15/30/75:
  ```python
  "sng": [
      (10, "sng/ranges_10bb.json"),
      (15, "sng/ranges_15bb.json"),
      (30, "sng/ranges_30bb.json"),
      (75, "sng/ranges_75bb.json"),
  ],
  ```
- Atualizar `_get_buckets(pos, scenario, stack_bb, mode)` para coletar `_RFI_shove` + `RFI` em RFI, e `shove` em vs_RFI:
  ```python
  if scenario == 'RFI':
      out = {'call': []}
      if pos_data.get('RFI'):        out['raise'] = pos_data['RFI']
      if pos_data.get('_RFI_shove'): out['shove'] = pos_data['_RFI_shove']
      return out
  if scenario == 'vs_RFI':
      villain = REPRESENTATIVE_VILLAIN.get(pos)
      vs_rfi  = pos_data.get('vs_RFI', {}).get(villain) or ...
      if not vs_rfi: return {}
      out = {'call': vs_rfi.get('call', [])}
      if vs_rfi.get('3bet'):  out['3bet']  = vs_rfi['3bet']
      if vs_rfi.get('shove'): out['shove'] = vs_rfi['shove']
      return out
  ```
- `_correct_action` (linha 145) já genérico — não muda.
- Em `generate_question`, ao montar pool de `vs_3bet`, considerar `raise+shove` como "mãos que você abriria":
  ```python
  if scenario == 'vs_3bet':
      rfi_b   = _get_buckets(pos, 'RFI', stack_bb, mode)
      pool    = list(set(rfi_b.get('raise', []) + rfi_b.get('shove', []))) or hands
  ```
- Adicionar campo `phase` derivado ao retorno de `generate_question` (mesma lógica de [insights_api.py](insights_api.py) linhas 31-35).

**[simulator_api.py](simulator_api.py)**:
- Importar `InsightsApi`, instanciar `_insights = InsightsApi()`.
- Em `new_question`, expor `phase` no retorno.
- Em `submit_answer`, **chamar `_insights.get_insights(...)` após `check_answer`** e mesclar no payload:
  ```python
  result['insights'] = {
      'spot':              insights.get('spot'),
      'spot_derived':      insights.get('spot_derived'),
      'scenario_derived':  insights.get('scenario_derived'),
      'universal_derived': insights.get('universal_derived'),
      'phase':             insights.get('phase'),
      'stack_context':     insights.get('stack_context'),
      'position_mistakes': insights.get('position_mistakes'),
      'action':            (insights.get('actions') or {}).get(result['correct']),
  }
  ```

**[api.py](api.py)**:
- Espelhar `STACK_PROFILES.sng` (linha 13-15).
- Em `get_range` cenário `RFI`, devolver buckets extras se presentes (`raise`, `shove`). Em `vs_RFI`, idem (`3bet`, `shove`, `call`). **Mantém Consulta sincronizada** sem mais código.

**Cache warm** não precisa mexer — já itera por `STACK_PROFILES`.

### 3. Frontend — ações dinâmicas + explicação

**[ui/shared/api.js](ui/shared/api.js)** (linha 79): atualizar `STACKS_BY_MODE.sng = [10, 15, 30, 75]`.

**[ui/shared/core.js](ui/shared/core.js)**:
- Em `ACTION_COLOR`/`ACTION_NAME` adicionar `shove` (vermelho), `limp` (futuro).
- Em `actionDisplayName(action, scenario, stack)`: se `action === 'shove' && scenario === 'vs_RFI' && stack <= 18` retorna `'Resteal'`; senão `'Shove (All-in)'`.
- Em `buildLookup` (linha 76): incluir `shove` no array `priority` (acima de `call`).

**[ui/simulator.js](ui/simulator.js)** — duas mudanças centrais:

1. Substituir constante `ACTION_CONFIG` (linhas 32-47) por função `getActions(q)`:
   ```js
   function getActions(q) {
     const { scenario, stack, mode } = q;
     const sng = mode === 'sng';
     if (scenario === 'RFI') {
       if (sng && stack <= 12) return mk(['shove','fold']);          // push/fold
       if (sng && stack <= 18) return mk(['raise','shove','fold']); // fragmentação
       return mk(['raise','fold']);
     }
     if (scenario === 'vs_RFI') {
       if (sng && stack <= 18) return mk(['shove','call','fold']);  // resteal mode
       return mk(['3bet','call','fold']);
     }
     if (scenario === 'vs_3bet') return mk(['4bet','call','fold']);
     return [];
   }
   ```
   Em `renderQuestion`, trocar `const actions = ACTION_CONFIG[q.scenario] || ACTION_CONFIG.RFI;` por `const actions = getActions(q);`.

2. Reescrever `getExplanation()` (linhas 339-370) e bloco final do `showResult` (linhas 388-394) usando o novo `result.insights` retornado pelo backend:
   ```js
   function renderRichExplanation(res, q) {
     const ins = res.insights || {};
     // 5 seções HTML: ação correta, por que, mãos-chave, erros comuns, contexto da fase
     // (vide planejamento detalhado abaixo)
   }
   ```

**5 seções na tela de resultado**:
1. **Ação correta** — badge grande colorido com nome + `action.long_desc` da `universal.actions`
2. **Por que essa ação?** — `spot.summary` OU `universal_derived.summary` + flag "spot derivado" se aplicável
3. **Mãos-chave do range** — chips com `spot.key_hands` (ou `key_hands_3bet`/`key_hands_call`)
4. **Erros comuns** — união de `spot.common_mistakes` + `position_mistakes` (top 5, dedupe)
5. **Contexto da fase** — `phase.label` + RP + `phase.mentality` + `spot.icm_note` se presente

**[ui/simulator.html](ui/simulator.html)**: o div `#resultExplain` (já existe, hoje vazio) recebe esse HTML. Bump versão CSS/JS pra forçar refresh.

**[ui/simulator.css](ui/simulator.css)**:
- `.action-btn.shove` (vermelho gradiente), `.action-btn.resteal` (visual = shove com label "Resteal").
- `.rg-cell.action-shove` (vermelho) no mini-grid de resultado.
- Bloco `.explain-section`, `.explain-action`, `.explain-title`, `.explain-body`, `.explain-list`, `.explain-mistakes`, `.explain-chips`, `.explain-chip`, `.explain-phase`, `.explain-rp`, `.explain-icm`, `.explain-flag` (~80 linhas seguindo a paleta da Consulta).
- Atalho de teclado: `onKeyDown` expandir regex `/^[1-3]$/` → `/^[1-4]$/` (caso de 4 ações).

---

## Arquivos

### Novos (criar)
| Arquivo | O que tem |
|---|---|
| [ranges/sng/ranges_10bb.json](ranges/sng/ranges_10bb.json) | Push/fold 10bb: `_RFI_shove` por posição + `vs_RFI.{villain}.call` no BB |
| [ranges/sng/ranges_15bb.json](ranges/sng/ranges_15bb.json) | Fragmentação: `RFI` (premium mini-raise) + `_RFI_shove` (médias) + `vs_RFI.{v}.shove` (resteal) |
| [ranges/sng/ranges_30bb.json](ranges/sng/ranges_30bb.json) | Transição: igual a 75bb mas range OR ~5% menor, sem shove |

### Modificar
| Arquivo | Mudança |
|---|---|
| [simulator_engine.py](simulator_engine.py) | `STACK_PROFILES.sng`, `_get_buckets` (multi-bucket), pool `vs_3bet`, `phase` no retorno |
| [simulator_api.py](simulator_api.py) | Importar/instanciar `InsightsApi`, expor `phase`, enriquecer `submit_answer` com `result.insights` |
| [api.py](api.py) | Espelhar `STACK_PROFILES.sng`, devolver `shove`/extras em `get_range` |
| [data/insights/universal.json](data/insights/universal.json) | +2 entradas em `actions`: `shove`, `resteal` |
| [data/insights/sng.json](data/insights/sng.json) | +spots RFI@10 (5 posições) e vs_RFI@15 (4-5 spots de resteal) |
| [ui/shared/api.js](ui/shared/api.js) | `STACKS_BY_MODE.sng = [10,15,30,75]` |
| [ui/shared/core.js](ui/shared/core.js) | `ACTION_COLOR`/`ACTION_NAME`/`actionDisplayName`/`buildLookup` — suportar `shove` |
| [ui/simulator.js](ui/simulator.js) | `getActions(q)` dinâmico, `renderRichExplanation` substitui `getExplanation` |
| [ui/simulator.html](ui/simulator.html) | Bump versão CSS/JS |
| [ui/simulator.css](ui/simulator.css) | Classes `.action-btn.shove/resteal`, `.rg-cell.action-shove`, bloco `.explain-*` |

---

## Roteiro de execução (6 passos testáveis isoladamente)

1. **Dados — JSONs de ranges**: criar `ranges_10bb.json`, `ranges_15bb.json`, `ranges_30bb.json` com base nos MDs `04`/`05`/`02`. Validar com Python que combos batem com % alvos do PDF.

2. **Dados — insights**: adicionar `actions.shove/resteal` em `universal.json` + spots novos em `sng.json` (10bb push, 15bb resteal, 15bb fragmentação).

3. **Backend engine + api**: atualizar `STACK_PROFILES.sng` em [simulator_engine.py](simulator_engine.py) e [api.py](api.py). Atualizar `_get_buckets` para multi-bucket. Adicionar `phase` em `generate_question`. Testar com curl: `new_question` em 10bb deve devolver `correct_action ∈ {shove, fold}`.

4. **Backend insights na resposta**: integrar `InsightsApi` em `simulator_api.submit_answer`. Testar: `submit_answer('fold')` retorna `result.insights.spot.title`, `result.insights.phase.label`, `result.insights.action.long_desc`.

5. **Frontend ações dinâmicas**: implementar `getActions(q)`, atualizar `core.js` (cores, nomes, `actionDisplayName`, `buildLookup`), CSS dos botões `.shove/.resteal`. Validar atalhos 1-4. Trocar dropdown stack pra `[10,15,30,75]` em SnG.

6. **Frontend explicação rica**: implementar `renderRichExplanation` com 5 seções. CSS dos blocos `.explain-*`. Validar matriz de casos abaixo.

---

## Verificação (matriz de casos)

| Caso | Esperado |
|---|---|
| SnG 10bb UTG, mão A5s | 2 botões: Shove / Fold. Resposta correta: Shove. Explicação mostra "UTG ~9.4% shove range", erros de UTG, fase Push/Fold com RP 12% |
| SnG 10bb BB vs SB shove, mão K9s | Cenário vs_RFI. 2 botões: Call / Fold (não tem shove pq estamos defendendo). Correta: Call. Explicação cita "BB vs SB shove 18% call range" |
| SnG 15bb BTN vs CO, mão TT | 3 botões: Resteal / Call / Fold. Correta: Resteal. Explicação cita "BTN vs CO push/fold zone, 27% open do CO" |
| SnG 15bb BTN RFI, mão 88 | 3 botões: Raise / Shove / Fold. Correta: Shove (88 está em `_RFI_shove`). Explicação cita fragmentação |
| SnG 30bb BTN RFI, mão T9s | 2 botões: Raise / Fold. Correta: Raise (mesmo range middle game) |
| SnG 75bb UTG RFI, mão JTo | 2 botões: Raise / Fold. Correta: Fold. Explicação cita erro #1 de UTG "abrir JTo" + RP 4.8% |
| MTT qualquer stack | Continua funcionando como hoje (sem buckets shove). 2-3 botões clássicos. Insights degrada pra glossário + descrições |
| Resultado quando spot é derivado (ex: BTN vs HJ @75) | Card de "Por que" mostra flag "⚙ Spot derivado dos princípios do PDF" |
| Histórico de mãos depois da feature | Itens novos com `correct='shove'` aparecem com label "Shove (All-in)" via `actionDisplayName` |

**Como rodar end-to-end**:
- Reiniciar uvicorn (`python -m uvicorn server:app --host 127.0.0.1 --port 8000`)
- Abrir http://127.0.0.1:8000/sim com hard refresh (Ctrl+Shift+R) — bump CSS/JS versões pra garantir
- Trocar modo pra SnG, escolher cada stack (10/15/30/75) e validar cada caso da matriz

---

## Fora do escopo (não fazer agora)

- **Limp como ação** — confirmado adiar.
- **Seletor de fase manual** no simulador — confirmado adiar (fase auto pelo stack).
- **Slider contínuo de stack** — manter dropdown discreto nos 4 buckets.
- **Cenário `call_vs_shove` separado** — BB defendendo shove continua sendo `vs_RFI` com bucket `call`.
- **Adaptações exploratórias** (vilão folda demais → expandir shove) — exige slider de ajuste.
- **Ranges MTT em short stack** — foco é SnG.
- **Endpoint novo** — `new_question`/`submit_answer` apenas retornam payload maior.
- **SM-2 e analytics** — funcionam com novos `correct_action='shove'` automaticamente (são strings opacas pra eles).
</content>
</invoke>
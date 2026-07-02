# 45: `sendToClickUp` — criar task nova (lead inédito)

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Quando o dedup (issue 44) não achar task, criar a task na lista `CLICKUP_LIST_ID` com `name` = nome e os custom fields do mapeamento da spec, incluindo o dropdown 🔻 Funil mapeado pelo funil de origem.

## Cenários

### Happy Path
1. Monta `custom_fields` (omitindo os vazios):
   - `7f70363f-9fc4-4d34-aab1-0a81d4a6f45d` = nome
   - `24f5a3d3-e21e-4e08-b396-8a4ce2133a98` = email
   - `3f24aa2d-050f-4be2-ab63-09b91307919b` = instagram
   - `97d8308d-d6b2-4dd6-9bd7-76f6662d5de2` = faturamento
   - `754a41c9-2835-48d5-a70e-8b61841e0037` = phoneE164
   - `a663b002-661c-4dc1-86c3-612e94f3a447` = opção do funil (ver mapa)
   - `6fd27248-beb5-49e1-9626-f1ab7ed81e5a` = `6cf677ce-5592-4ff7-9f63-d18d52d42be5` (🛒 Produto = AE, fixo)
   - `64ffa839-dac1-4995-9cbb-7bd50f9dc5d5` = utm_source
   - `e367ce2e-a06c-43b6-ac9b-0feb4923f007` = utm_medium
   - `5710cb4d-a375-464b-8ac6-5267745eaddc` = utm_content
2. `POST /api/v2/list/{CLICKUP_LIST_ID}/task` body `{ name, custom_fields }`.
3. Retorna a task criada (para a issue 48 notificar "Novo lead").

**Mapa funil → opção do dropdown `a663b002…`:**
- `diagnostico` (e default/desconhecido) → `a158d342-c1ac-4705-a6da-ce39019f0a2a` (SESSÃO ESTRATÉGICA)
- `lives-semanais-v1` → `e6893b0b-5a69-4f48-9c99-a3c0a415a118` (LIVES SEMANAIS)

### Edge Cases
- Campos vazios (ex.: instagram, UTMs) → **não** incluir no array (segue o padrão do `/tracker` de não mandar `""`).
- `name` vazio → usar o email como fallback do título (evita task sem nome).
- Funil desconhecido → fallback SESSÃO ESTRATÉGICA (nunca deixa o dropdown vazio).

### Cenário de Erro
- Falha no POST → tratada pela issue 47 (retry + log + alerta). Aqui a função só propaga o erro/resultado.

## Arquivos

- **Modificar:** `functions/tracker.js` — no `sendToClickUp`, ramo "não achou": montar custom_fields + `createClickUpTask(...)`; adicionar `mapFunnelToOption(funnel)`.

## Dependências Externas

- ClickUp API v2 — `POST /list/{list_id}/task`. Dropdown recebe o **UUID da opção** como `value`.

## Checklist

- [x] `mapFunnelToOption(funnel)` com o mapa acima + fallback SESSÃO ESTRATÉGICA
- [x] Montar `custom_fields` omitindo vazios
- [x] `createClickUpTask(name, customFields, env)` → POST e retorna a task
- [x] Fallback de `name` para email quando nome vazio

# Plano: entrada no grupo de WhatsApp como conversão no Meta

Cobre as issues 151-174 (spec.md). Um plano só, porque o código é um módulo puro
+ um endpoint + uma migration — quebrar em 24 planos separados criaria papel, não
clareza.

## Código reutilizado (pesquisa feita antes de planejar)

| O que | Onde | Como entra aqui |
|---|---|---|
| `sendToMeta` | `functions/tracker.js:392` | envio CAPI; recebe `pixelId`/`accessToken` por parâmetro, então mandar só para o pixel 2 é passar as vars `_2` |
| `sha256` + `normalizePhone` | `functions/tracker.js:62` e `:83` | hoje vivem DENTRO de `onRequestPost` e não são importáveis → extrair para `functions/api/_hash.js` e importar nos dois lugares |
| `sendThrottledAlert` | `functions/tracker.js:821` | avisos das issues 171/172, com o mesmo controle anti-enxurrada |
| Padrão de endpoint de sync | `functions/api/sync/meta-leads.js` | auth `x-sync-secret`, laço por item, `sync_log` no fim |
| Padrão de módulo puro + teste | `functions/api/_canal.js` + `tests/canal.test.js` | a lógica de elegibilidade/dedup vai para `_grupo-conversao.js`, testável sem D1 |
| Fonte dos dados | `whatsapp_group_events` (migration 0026) | `action='entrou'`, `participant_jid` = `<numero>@s.whatsapp.net` |

## Banco

**Modificar `whatsapp_groups_tracked`** (migration 0029):
- `send_conversion` (INTEGER, default 0) — issue 157. Só Lives Semanais recebe 1.
- `conversion_since` (INTEGER, unix) — issue 158, o marco de corte, por grupo.
  NULL ou 0 = não envia nada.

**Criar `whatsapp_group_conversions`** — o registro de conversões:
- `group_jid`, `phone` (só dígitos, sem o sufixo do JID)
- `event_id` (TEXT UNIQUE) — identificador estável do evento (issue 167)
- `occurred_at` (TEXT) — momento REAL da entrada, não do envio (issue 165)
- `status` (`pendente` | `enviada` | `falha`) — issues 169/170
- `tentativas` (INTEGER), `erro` (TEXT)
- `enriquecida` (INTEGER 0/1) — issue 164
- `criado_em`, `enviado_em` (unix)
- **`UNIQUE (group_jid, phone)`** — esta é a dedup da issue 159. Sendo restrição
  de banco, e não checagem na aplicação, duas execuções simultâneas não
  conseguem furar.

A dedup mora aqui e **não toca `whatsapp_group_events`** — por isso a aba Grupos
continua contando tudo, inclusive reentradas (exigência da spec).

## Arquivos

- **Criar:** `migrations/0029_grupo_conversao.sql`
- **Criar:** `functions/api/_hash.js` — `sha256` e `normalizePhone` compartilhados
- **Criar:** `functions/api/_grupo-conversao.js` — lógica pura: telefone do JID,
  elegibilidade, `event_id` estável
- **Criar:** `tests/grupo-conversao.test.js`
- **Criar:** `functions/api/sync/grupo-conversoes.js` — o despachante
- **Modificar:** `functions/tracker.js` — passa a importar de `_hash.js` em vez
  de definir as funções dentro do handler
- **Modificar:** `functions/api/grupos.js` — números do card (issues 173/174)
- **Modificar:** `public/dash/index.html` — o card na aba Grupos
- **Criar:** `scripts/grupo-conversoes-sync/` — o cron da VPS

## Cenários

**Happy path:** pessoa entra no grupo da live → Evolution → n8n → webhook grava em
`whatsapp_group_events` → o cron chama `/api/sync/grupo-conversoes` → a entrada é
elegível e o telefone ainda não converteu → linha `pendente` criada → busca lead
pelo telefone → achou, anexa `fbp`/`fbc`/`external_id` → envia `EntrouGrupo` ao
pixel 2 → marca `enviada`.

**Edge cases:**
- Reentrada da mesma pessoa → `UNIQUE(group_jid, phone)` barra, nada é enviado, e
  a aba Grupos continua contando as duas entradas.
- `participant_jid` sem número utilizável (ex.: `@lid`) → pulada, o lote segue.
- Entrada anterior ao `conversion_since` → ignorada para sempre.
- Grupo dos Workshops → ignorado enquanto `send_conversion = 0`.
- Lead não encontrado → envia só com telefone hasheado, `enriquecida = 0`.
- Dois leads com o mesmo telefone → usa o mais recente.

**Erro:** falha de rede/recusa do Meta → linha fica `pendente` com `tentativas+1`
e o erro guardado; a execução seguinte tenta de novo; após 5 tentativas vira
`falha` e para. Como o `event_id` é estável, um reenvio que o Meta já tinha
recebido é deduplicado por ele, não vira segunda conversão. Vars `_2` ausentes →
não envia e registra o motivo (nunca morte silenciosa).

## Checklist

- [ ] `_hash.js` criado e `tracker.js` importando dele (suíte segue verde)
- [ ] `_grupo-conversao.js` com testes cobrindo elegibilidade, JID sem número,
      marco de corte e estabilidade do `event_id`
- [ ] Migration 0029 aplicada com `d1 execute --file` (NUNCA `migrations apply`)
- [ ] Endpoint despachante enviando ao pixel 2 apenas
- [ ] Enriquecimento por telefone
- [ ] Retentativa com limite + alertas
- [ ] Card no dash
- [ ] Cron na VPS
- [ ] Validação com entrada real no grupo

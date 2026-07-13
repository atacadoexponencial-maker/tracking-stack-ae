# 67: Backend — mapeamento do campo Cargo nos encaminhamentos

**Tipo:** Implementação
**Página:** Página de Aplicação (`/aplicacao-mentoria`)

## Descrição

Verificar e, se necessário, implementar o mapeamento do novo campo `cargo` no backend de captação: persistência junto ao lead e inclusão nos encaminhamentos existentes (task do ClickUp e CRM Supabase), para que a resposta de cargo chegue ao time comercial como os demais campos. O backend já aceita justificativa/objetivo; esta issue cobre apenas o que faltar para o cargo — se a investigação mostrar que o payload genérico já o transporta ponta a ponta, registrar a conclusão e encerrar sem alterações.

## Investigação (2026-07-13)

**O que já funciona sem mudança (payload genérico):**
- **CRM Supabase e barramento WhatsApp:** o `/tracker` repassa `...leadData` inteiro no `sendToCRM` (`functions/tracker.js`, ~linha 456) — `cargo` já chega a esses dois destinos ponta a ponta. Nada a fazer.
- **Falha de sync:** `logClickUpFailure` grava `JSON.stringify(leadData)` completo em `clickup_sync_failures` — `cargo` já é preservado no caminho de erro. Nada a fazer.

**O que NÃO funciona (é o escopo desta issue):**
- **ClickUp:** `sendToClickUp` só envia campos mapeados em `CU_FIELD` — `cargo` é descartado tanto na criação da task quanto no comentário de lead repetido.

**Verificação na lista 205126080 (🤑 CRM) via API do ClickUp (2026-07-13):**
1. **Não existe custom field para Cargo.** Conferidos todos os campos da lista; os campos de lead são: 👤 Nome, 📩 E-mail, 📺 Instagram, 🤑 Faturamento Mensal, ☎️ Whatsapp, ✍️ JUSTIFICATIVA, 🎯 Objetivo 2025, 🔻 Funil, 🛒 Produto, utm_source/medium/content. **Decisão: NÃO criar o campo** (decisão da dona do workspace) — o cargo vai nas linhas de texto (comentário/descrição), padrão já usado para justificativa/objetivo no comentário.
2. **O dropdown 🔻 Funil (id `a663b002-661c-4dc1-86c3-612e94f3a447`) NÃO tem opção para `aplicacao-mentoria`.** Opções existentes relevantes: SESSÃO ESTRATÉGICA (`a158d342-c1ac-4705-a6da-ce39019f0a2a`, default do código), LIVES SEMANAIS (`e6893b0b-5a69-4f48-9c99-a3c0a415a118`), WORKSHOP (`b5e04cdb-f62d-4159-b89b-751726a61831`), WEBINAR (`e2eb5e61-2c1b-435d-a51f-265a7f6fde98`). Comportamento atual: `mapFunnelToOption` carimba qualquer funil ≠ `lives-semanais-v1` como SESSÃO ESTRATÉGICA — o funil novo `aplicacao-mentoria` cairá nesse default até a opção ser criada (ver Pendências).

## Cenários

### Happy Path
1. Lead inédito envia o formulário de `/aplicacao-mentoria` com cargo preenchido.
2. `sendToClickUp` não encontra task por telefone/email → cria a task com os custom fields de sempre **e** com `description` contendo a linha `Cargo: <valor>` (não há custom field para cargo).
3. O comercial vê o cargo na descrição da task; Supabase e barramento WhatsApp recebem o `cargo` no payload como já recebem hoje.

### Edge Cases
- **Lead repetido (task já existe):** o comentário "Lead Voltou ao CRM" ganha a linha `Cargo: ${cargo}` junto de Justificativa/Objetivo — mesmo padrão das demais linhas (aparece mesmo vazia, como Justificativa/Objetivo hoje).
- **Cargo vazio/ausente (leads de outros funis, ex.: `lives-semanais-v1`, que não têm o campo):** na criação, **não** adiciona `description` (task fica exatamente como hoje — sem linha `Cargo:` vazia); no comentário, a linha sai vazia como as demais.
- **Fallback do telefone 400:** a segunda tentativa de criação (sem o campo phone) já usa `description` para o WhatsApp cru — as duas linhas precisam ser **mescladas** (Cargo + WhatsApp não validado), não sobrescritas.
- **Funil `aplicacao-mentoria` no dropdown 🔻 Funil:** cai no default SESSÃO ESTRATÉGICA (comportamento atual documentado acima). Sem mudança de código nesta issue; ver Pendências.

### Cenário de Erro
- Escrita no ClickUp falha após retry → caminho existente intacto: `logClickUpFailure` grava o `leadData` completo (incluindo `cargo`) em `clickup_sync_failures` + alerta WhatsApp com throttle. Nenhuma mudança necessária.

## Arquivos

- **Modificar:** `functions/tracker.js` — apenas dentro de `sendToClickUp` (~linhas 669–756):
  1. Extrair o campo junto dos demais (~linha 678): `const cargo = (leadData.cargo || '').toString().trim();`
  2. **Comentário de lead repetido** (~linha 707): adicionar a linha `Cargo: ${cargo}` após `Faturamento` (junto de Justificativa/Objetivo).
  3. **Criação de task nova** (~linhas 734–752): montar `description` condicional — `cargo ? 'Cargo: ' + cargo : ''` — e incluí-la no primeiro `createTask` só quando não vazia. No fallback do 400 do telefone, concatenar as duas linhas (`[descriptionCargo, 'WhatsApp (não validado pelo ClickUp): ...'].filter(Boolean).join('\n')`) para o fallback não engolir o cargo nem vice-versa.
  4. **Não mexer** em: `CU_FIELD` (sem novo id — campo não existe), `mapFunnelToOption`, `sendToCRM`, `buildLeadNotif`, caminho de erro/D1.

## Checklist

- [x] `const cargo` extraído de `leadData` em `sendToClickUp`, com o mesmo trim/toString dos demais campos
- [x] Comentário "Lead Voltou ao CRM" inclui a linha `Cargo:` junto de Justificativa/Objetivo
- [x] Task nova criada com `description` contendo `Cargo: <valor>` quando o cargo vier preenchido
- [x] Task nova SEM cargo não ganha `description` (payload idêntico ao atual para os funis existentes)
- [x] Fallback do 400 do telefone mescla a linha do cargo com a linha do WhatsApp não validado na `description`
- [x] Nenhum outro caminho alterado (CU_FIELD, mapFunnelToOption, sendToCRM, notifs, D1)

## Pendências (fora do escopo desta issue)

- [x] ~~Criar custom field "Cargo" na lista 205126080~~ — **RESOLVIDO 2026-07-13**: usuária criou o campo **🎖️ Cargo** (`150014bc-01ca-466f-90b6-9711ec19408e`, short_text). Código atualizado: `CU_FIELD.cargo` mapeado, `push(CU_FIELD.cargo, cargo)` na criação da task, e o workaround da `description` removido (o fallback do 400 do telefone voltou a usar a description só para o WhatsApp cru). A linha `Cargo:` no comentário de lead repetido foi mantida (mesmo padrão de Justificativa/Objetivo).
- [ ] Criar a opção do funil de aplicação/mentoria no dropdown 🔻 Funil (id `a663b002-661c-4dc1-86c3-612e94f3a447`) no ClickUp e mapear `aplicacao-mentoria` → id da nova opção em `mapFunnelToOption`. Até lá, leads desse funil entram como SESSÃO ESTRATÉGICA (default atual). (Conferido 2026-07-13: a opção ainda não existe.)

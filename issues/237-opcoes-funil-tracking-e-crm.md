# 237: Carregar opções de funil do tracking e do campo Funil do CRM

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Expor no servidor as opções do formulário: os funis reconhecidos pelo tracking (mais `aquisicao`) e as opções atuais do campo "🔻 Funil" lidas do CRM, tratando a falha de leitura.

## Comportamentos cobertos

- Carregar opções do funil do tracking: os mesmos da classificação manual da aba Meta Ads, mais `aquisicao`
- Carregar opções do CRM: lê as opções atuais do campo "🔻 Funil" da lista do CRM
- Falha ao carregar opções do CRM: formulário mostra "Não foi possível ler as opções do CRM agora" e desabilita "Salvar"; funis já cadastrados continuam visíveis

## Cenários

### Happy Path
1. A aba "Funis do relatório" abre e chama `GET /api/funis-relatorio-opcoes?key=...`.
2. O servidor lê em paralelo `listarFunisConhecidos(env.DB)` e `GET /list/{CLICKUP_LIST_ID}/field` no ClickUp.
3. Responde `{ funis_tracking: [...funis, 'aquisicao'], crm: { ok: true, opcoes: [{ id, nome }] } }`.
4. O formulário preenche o `<select>` de funil do tracking e as caixas de opção do CRM, com "Salvar" habilitado.

### Edge Cases
- `aquisicao` já presente na lista → não duplica (`Set`).
- Campo buscado pelo **id** `CU_FIELD.funil` (`a663b002-…`): a lista tem um campo de texto homônimo "🔻 FUNIL" que não é este.
- Opções devolvidas na ordem do CRM (`orderindex`); opção sem id ou sem nome é descartada; nomes aparados.
- Valor já escolhido no `<select>` é preservado ao redesenhar.

### Cenário de Erro
- ClickUp fora do ar, token ausente, HTTP de erro ou campo ausente/malformado → `crm: { ok: false, erro: 'Não foi possível ler as opções do CRM agora' }` (nunca lança; nunca vira "lista vazia"). O formulário mostra a mensagem do backend e desabilita "Salvar"; a lista de funis é desenhada à parte e continua visível.
- Endpoint inteiro falhando (ex.: D1) → o front mostra a mesma mensagem, desabilita "Salvar" e não derruba a lista.
- Sem chave do dashboard → `401`.

## Banco de Dados

Só leitura: `event_log` / `sessions` via `listarFunisConhecidos` (já existente). Nenhuma migration.

## Arquivos

- **Criar:** `functions/api/_crm-opcoes-funil.js` — `extrairOpcoesFunil(resposta)` (puro) e `lerOpcoesFunilCrm(env)` (GET no ClickUp, `{ ok, opcoes | erro }`, nunca lança).
- **Criar:** `functions/api/funis-relatorio-opcoes.js` — `GET` com `DASH_KEY`; devolve `funis_tracking` e `crm`.
- **Criar:** `tests/crm-opcoes-funil.test.js` — parser e leitura com `fetch` simulado.
- **Modificar:** `public/dash/index.html` — `R['funis-relatorio']` passa a buscar as opções no servidor (remove as opções fixas do protótipo) e trata a falha.

## Dependências Externas

- ClickUp API v2 — `GET /list/{list_id}/field` (só leitura), com `CLICKUP_API_TOKEN` e `CLICKUP_LIST_ID` (fallback `205126080`) já configurados. Formato conferido em 15/09/2026: o campo "🔻 Funil" é `drop_down` com `type_config.options[{ id, name, orderindex }]`.

## Reuso (pesquisado na base)

- `listarFunisConhecidos` (`_funil-campanha.js`) + `CANAL_AQUISICAO` (`_canal.js`) — exatamente a lista de `/api/campaign-funnel`.
- `CU_FIELD.funil`, `CU_DEFAULT_LIST`, `clickupFetch` (`_clickup.js`).
- Padrão de teste com `fetch` simulado e `node --test`.

## Checklist

- [x] `extrairOpcoesFunil` pelo id do campo, na ordem do CRM, `null` quando ausente/malformado
- [x] `lerOpcoesFunilCrm` com `{ ok: false, erro }` em qualquer falha, sem lançar
- [x] `GET /api/funis-relatorio-opcoes` com `DASH_KEY`, funis do tracking + `aquisicao`
- [x] Testes do parser e da leitura (sucesso, sem token, HTTP de erro, rede, campo ausente)
- [x] Formulário preenchido pelo servidor; opções fixas do protótipo removidas
- [x] Falha do CRM: mensagem do backend + "Salvar" desabilitado; lista continua visível
- [x] `npm test` passando

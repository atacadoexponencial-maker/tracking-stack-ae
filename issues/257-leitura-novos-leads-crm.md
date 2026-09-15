# 257: Contar novos leads do CRM por funil e origem

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Ler os cards criados no período no CRM e atribuir cada um ao bloco pela opção do "🔻 Funil" combinada com a origem (utm_source), tratando exclusões e indisponibilidade do CRM.

## Comportamentos cobertos

- Novo lead = card criado no período (Brasília) com opção do funil e origem compatível
- `SESSÃO ESTRATÉGICA` com anúncio → origem "Tráfego pago" (SE); bio, ManyChat, outra UTM ou sem utm_source → "Qualquer origem exceto tráfego pago" (AQUISIÇÃO)
- Card de lead que voltou não conta
- Card de teste ou bot marcado no tracking não conta
- Card com opção de funil "Venda na Greenn" nunca conta como lead; card com opção de funil "Manual" não conta em bloco nenhum nem nos totais
- CRM indisponível: leads, MQLs e CPL vazios (nunca zero) com aviso "Não foi possível ler o CRM — leads e MQLs não informados."
- Opção cadastrada que não existe mais: calcula com as que existem e avisa "A opção <x> do bloco <nome> não existe mais no CRM."

## Cenários

### Happy Path
1. O endpoint resolve o período (issue 254) e calcula `limitesDoPeriodoUnix` (meia-noite de Brasília do 1º dia até a meia-noite do dia seguinte ao último).
2. Em paralelo com as leituras do investimento (issue 256), faz UMA leitura dos cards do CRM: `GET /list/205126080/task` com `date_created_gt = desde×1000 − 1`, `date_created_lt = ate×1000`, `include_closed=true`, `subtasks=false`, `page=0,1,…` até `last_page = true` — só os cards criados no período, nunca a lista inteira. Também em paralelo, `lerOpcoesFunilCrm` (opções atuais do "🔻 Funil", para o aviso de opção que sumiu).
3. Com os `id` dos cards lidos, UMA consulta ao D1 devolve os que são teste/bot: `task_id` em `lead_dispatch` ligado a evento com `is_junk = 1` ou `is_bot = 1` (mesmo critério da aba de leads).
4. `atribuirCards` (puro) distribui cada card: opção do "🔻 Funil" (campo por ID; o valor do card vem como `orderindex` ou `id` e é resolvido pelas `type_config.options` do próprio card) + origem (`utm_source` do card; "Tráfego pago" = `canalDeLead` devolve `meta-ads`, a mesma regra do CPL por canal).
   - `SESSÃO ESTRATÉGICA` + `facebookads` → SE (origem "Tráfego pago");
   - `SESSÃO ESTRATÉGICA` + `organico`/`instagram`/sem `utm_source` → AQUISIÇÃO ("Qualquer origem exceto tráfego pago").
5. Cada bloco do tipo lead recebe `metricas.novos_leads` = quantidade de cards atribuídos.

### Edge Cases
- **Lead que voltou:** card antigo tem `date_created` fora do período — nem vem da API; a função pura recorta de novo (defesa) e não conta.
- **Cards estruturais** (nome começando por `FUNIL`, `GERAL` ou `LEADS MÊS ANTERIOR`, sem diferenciar caixa; ou nome vazio): ignorados — mesma regra do relatório atual (`task_is_structural`).
- **Teste/bot:** card cujo `id` voltou na consulta de exclusão não conta em nada.
- **Comprador:** opção pertencente a funil ativo `venda_greenn` → nunca conta (nem bloco, nem "sem funil").
- **Opção de funil `manual`:** não conta em bloco nenhum nem em "sem funil".
- **Opção sem funil ativo** (ex.: `TRAFEGO PAGO`, `ISCAS`): vai para "sem funil" rotulado pela opção.
- **Card sem opção** (ou valor que não resolve para opção): "sem opção de funil no CRM".
- **Opção cadastrada, origem sem funil ativo** (ex.: só SE ativo e card orgânico): "opção <x> com origem não cadastrada". Se duas origens cadastradas cobrirem o card (o cadastro impede): "opção <x> em mais de um funil" — nunca o primeiro.
- **Mesmo card em duas páginas** (card criado durante a paginação): conta uma vez.
- **Opção cadastrada que não existe mais no CRM:** o bloco conta com as opções que casam; aviso "A opção <x> do bloco <nome> não existe mais no CRM." Se as opções não puderem ser lidas, nenhum aviso (sem ler não dá para afirmar que sumiu).
- **"Sem funil":** a contagem por opção sai de `atribuirCards` (a mesma leitura), mas o bloco da resposta é montado na issue 264.

### Cenário de Erro
- **CRM indisponível** (sem token, status ≠ 2xx, erro de rede, resposta sem `tasks`): `novos_leads: null` nos blocos do tipo lead (nunca 0) e aviso "Não foi possível ler o CRM — leads e MQLs não informados."; investimento segue.
- **Teto de páginas** (30 páginas = 3.000 cards; o Worker estoura "Too many subrequests" em 50): para de ler, `novos_leads: null` e aviso "O CRM tem mais de 3000 cards criados no período — leads e MQLs não informados; divida o período em consultas menores." Número parcial nunca sai como completo. (Volume real medido em 15/09: ~150 cards em 30 dias → 2 páginas; 92 dias ≈ 5 páginas.)

## Banco de Dados

Só leitura, sem migration:
- `SELECT DISTINCT d.task_id FROM lead_dispatch d JOIN event_log e ON e.event_id = d.event_id WHERE d.task_id IN (SELECT value FROM json_each(?)) AND (e.is_junk = 1 OR e.is_bot = 1)` — um bind só (JSON dos ids, sem estourar o limite de parâmetros), `idx_lead_dispatch_task` + `idx_event_log_event_id`. Não roda quando não há card.
- `funis_relatorio` ativos passa a ler também `opcoes_crm` e `origem_lead`.

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-crm.js` — `normalizarTexto`, `valorDoCampo`, `lerCampo`, `cardEstrutural`, `opcaoFunilDoCard`, `ehTrafegoPago`, `atribuirCards`, `avisosOpcoesInexistentes` (puros); `lerCardsCriadosNoPeriodo(env, limites)` e `lerTaskIdsDeTesteOuBot(db, ids)` (I/O).
- **Criar:** `tests/feedback-marketing-crm.test.js`
- **Modificar:** `functions/api/feedback-marketing.js` — leitura do CRM, exclusão, atribuição, `novos_leads` real nos blocos do tipo lead, avisos.

## Dependências Externas

- ClickUp API v2 — Get Tasks (`GET /list/{list_id}/task`, doc oficial): `date_created_gt`/`date_created_lt` em unix **milissegundos** (estritamente maior/menor), `include_closed` (padrão exclui fechados), `subtasks` (padrão exclui), `page` a partir de 0, 100 tasks por página, `last_page` na resposta. `custom_fields` dos cards vêm com `type_config.options` (dropdown: `value` = `orderindex`, conferido no CRM real). Token: `CLICKUP_API_TOKEN` (o mesmo de `_clickup.js`). Só GET.

## Reuso (pesquisado na base)

- `clickupFetch`, `CU_FIELD.funil`/`utmSource`, `CU_DEFAULT_LIST` (`_clickup.js`); `lerOpcoesFunilCrm` (`_crm-opcoes-funil.js`); `lerOpcoesCrmGravadas` (`_funis-relatorio.js`); `canalDeLead` (`_canal.js`); `limitesDoPeriodoUnix` (`_feedback-marketing-periodo.js`).
- Porte fiel de `parse_custom_field_value`, `field_value`, `task_is_structural` e `normalize_text` de `/root/ae_weekly_comparative_report.py` (VPS).

## Checklist

- [x] Leitura paginada só dos cards criados no período, `include_closed`, sem subtasks, com teto e aviso
- [x] Opção do funil resolvida por `id`/`orderindex` do campo por ID
- [x] Origem pela regra de canal (`meta-ads` = tráfego pago)
- [x] Estruturais, teste/bot, comprador e manual fora da contagem
- [x] "Sem funil" por opção / sem opção / origem não cadastrada (dados para a 264)
- [x] CRM indisponível → `novos_leads: null` + aviso
- [x] Aviso de opção que não existe mais no CRM
- [x] Exclusão de teste/bot numa consulta só, por índice
- [x] Testes do módulo (puro + I/O com fetch simulado)
- [x] `npm test` passando

## Ajustes pós-revisão

- **Comprador de funil de venda arquivado:** `atribuirCards` recebe `funisDeVenda` (linhas `venda_greenn` de qualquer situação, lidas em `feedback-marketing.js`); card com opção que é ou FOI de funil de venda não vira lead nem vai para "sem funil". Se um funil ATIVO lead+MQL usa hoje essa opção, o ativo vence. Testes em `tests/feedback-marketing-crm.test.js`.
- **Teste/bot pelo mesmo critério da aba de leads:** `lerTaskIdsDeTesteOuBot` passou a fazer `LEFT JOIN sessions` e aplicar o corte por IP de `clausulasBotIpSql('s')`, negado em bloco (`NOT (1 = 1 ...)`) para selecionar os bots — seguro porque as cláusulas usam `COALESCE` e nunca dão NULL; sem sessão não é bot. Medido no D1 remoto (só leitura): plano `idx_lead_dispatch_task` → `idx_event_log_event_id` → `sqlite_autoindex_sessions_1`, sem SCAN; 3 task_ids leem 13 linhas (a forma anterior lia 12). Teste com SQLite em memória cobrindo junk, UA, IP exato, /24, /64, sem sessão e IP nulo.

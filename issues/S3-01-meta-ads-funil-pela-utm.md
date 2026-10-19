# S3-01: Aba Meta Ads com o funil pela UTM e os leads novos

**Tipo:** Implementação
**Página:** Regra do funil do lead + Aba Meta Ads
**Spec:** `spec-funil-pela-utm.md`

## Descrição

Cria a regra única que decide o funil de cada lead (portas da SE seguem a origem;
formulários de produto ficam no próprio funil) e a aplica no cálculo de CPL que
alimenta a aba Meta Ads. A tabela CPL por funil e os KPIs da aba ganham os leads novos.

## Pronto quando

Na aba Meta Ads, aquisição aparece com investimento E leads (bio + ManyChat),
aplicacao-mentoria e iscas-manychat somem como funil, e a tabela CPL por funil mostra
leads novos e CPL lead novo, com o KPI "CPL lead novo (pago)" no topo.

## Critérios de aceite

- **CA-S3-01** (automática) — Aplicação vinda da bio conta como aquisição. Dado um lead da /aplicacao-mentoria com campanha `bioperfil-felipe`, quando o dash calcula o funil dele, então ele aparece em aquisição, e `aplicacao-mentoria` não aparece como funil.
- **CA-S3-02** (automática) — Qualquer porta da SE vinda da bio conta como aquisição. Dado um lead do formulário da home (sessão estratégica) com campanha `bioperfil-atacadoexponencial`, quando o dash calcula o funil dele, então ele aparece em aquisição.
- **CA-S3-03** (automática) — Isca do ManyChat conta como aquisição. Dado um lead de /materiais/icp (isca do ManyChat), com ou sem UTM, quando o dash calcula o funil dele, então ele aparece em aquisição, e `iscas-manychat` não aparece como funil.
- **CA-S3-04** (automática) — Aplicação vinda de anúncio de SE conta como sessão estratégica. Dado um lead da /aplicacao-mentoria com campanha `ae_leads_publico-frio_evento-ra_sessao-estrategica`, quando o dash calcula o funil dele, então ele aparece em sessão estratégica.
- **CA-S3-05** (automática) — Porta da SE vinda de anúncio de outro funil conta nesse funil. Dado um lead do formulário de SE com campanha `ae_leads_publico-frio_evento-lead_lives-semanais`, quando o dash calcula o funil dele, então ele aparece no funil das lives semanais.
- **CA-S3-06** (automática) — O ajuste manual da campanha vale para o lead. Dado a campanha `ae_leads_publico-frio_evento-lead_workshops-gratuitos`, que a regra automática não reconhece, classificada manualmente como workshop na aba Meta Ads, e um lead de porta da SE vindo dessa campanha, quando o dash calcula o funil dele, então ele aparece em workshop.
- **CA-S3-07** (automática) — Sem origem reconhecível, sessão estratégica. Dado três leads da /aplicacao-mentoria: um sem UTM, um com campanha `{{campaign.name}}` e um com campanha que não existe no Meta, quando o dash calcula o funil deles, então os três aparecem em sessão estratégica.
- **CA-S3-08** (automática) — Workshop fica no workshop. Dado um inscrito no formulário do workshop com campanha de sessão estratégica e outro com `bioperfil-felipe`, quando o dash calcula o funil deles, então os dois aparecem em workshop.
- **CA-S3-09** (automática) — Os outros produtos ficam no próprio funil. Dado leads de lives semanais, tráfego atacado e calculadora vindos de anúncio de SE e da bio, quando o dash calcula o funil deles, então cada um aparece no funil do próprio formulário.
- **CA-S3-10** (automática) — Aquisição com investimento e leads na mesma linha. Dado um período com R$ 100 em posts impulsionados, 3 leads da /aplicacao-mentoria vindos da bio e 1 isca do ManyChat, quando a aba Meta Ads calcula o CPL por funil, então a linha aquisição mostra R$ 100, 4 leads e CPL de R$ 25.
- **CA-S3-11** (automática) — Tabela mostra leads novos e CPL lead novo. Dado um funil com R$ 300, 6 leads, dos quais 3 viraram card novo no CRM, quando a aba Meta Ads mostra a tabela CPL por funil, então a linha mostra 6 leads, 3 leads novos, CPL R$ 50 e CPL lead novo R$ 100.
- **CA-S3-12** (automática) — KPI do CPL lead novo pago. Dado R$ 400 em anúncios (fora impulsionamento) e 8 leads vindos de anúncio, dos quais 4 viraram card novo, quando a aba Meta Ads mostra os KPIs, então aparece "CPL lead novo (pago)" de R$ 100 ao lado do "CPL Meta (pago)" de R$ 50.
- **CA-S3-13** (manual) — Aba Meta Ads no ar com dado real. Dado a semana 12–18/10 no dash em produção, quando a usuária abre a aba Meta Ads, então aquisição tem leads, aplicacao-mentoria e iscas-manychat não aparecem como funil, e as colunas e o KPI de lead novo aparecem.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S3-01 | Lead com UTM quebrada `{{campaign.name}}` (anúncio do Meta sem nome) vai para sessão estratégica, e não tenta adivinhar a campanha | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-02 | `diagnostico` (nome antigo da SE) é tratado como porta da SE | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-05 | A tabela "Funil × canal" da aba Meta Ads passa a usar o funil pela regra, e o quadro separado "estimativa de aquisição" sai, porque a linha aquisição da tabela por funil passa a fazer essa conta | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-06 | Formulário de produto próprio = workshop (todas as variantes), lives semanais, tráfego atacado e calculadora. Uma página de captação nova é porta da SE até alguém dizer o contrário | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S3-01 | Inscrito no workshop vindo de anúncio de SE: conta como SE ou workshop? | respondida | Workshop é exceção: fica no workshop (usuária, 19/10) |
| PER-S3-03 | O que manda para aquisição? | respondida | Campanha `bioperfil*` e todo lead do ManyChat (usuária, 19/10) |
| PER-S3-04 | Como ver leads novos na aba Meta Ads? | respondida | Colunas na tabela CPL por funil + KPI "CPL lead novo (pago)" (usuária, 19/10) |
| PER-S3-05 | Os outros produtos (lives, tráfego atacado, calculadora) também ficam no próprio funil? | respondida | Sim. A UTM só decide nas portas da SE (usuária, 19/10) |

## Cenários

### Happy Path
1. O `/api/cpl` lê os gastos do período, os leads (funil do formulário + UTM da sessão + material + card novo), os ajustes manuais e **a lista de todas as campanhas do Meta já vistas** (nome → id).
2. Monta o mapa campanha → funil com a mesma regra do investimento (ajuste manual por id vence; senão o automático pelo nome).
3. Para cada lead, `funilDoLead` decide: formulário de produto (workshop*, lives-semanais*, trafego-atacado, calculadora) fica no próprio funil; nas portas da SE, ManyChat → aquisição, `bioperfil*` → aquisição, campanha mapeada → esse funil, senão → sessão estratégica.
4. Funil de porta vindo do mapa (`aplicacao-mentoria`, `diagnostico`) vira `sessao-estrategica` e `iscas-manychat` vira `aquisicao` — tanto do lado do lead quanto do gasto, para os dois lados casarem.
5. `por_funil`, `cruzado` e `por_canal` saem com o funil novo; `por_canal` ganha `leads_novos`/`cpl_novos`; `aquisicao_estimativa` sai.
6. A aba Meta Ads desenha as colunas Leads novos e CPL lead novo e o tile "CPL lead novo (pago)" (linha meta-ads de `por_canal`).

### Edge Cases
- `{{campaign.name}}` não tem `_` nem está no mapa → sessão estratégica (o automático puro devolveria `aquisicao` para nome sem `_`; por isso o automático só é usado em nome com `_`).
- Campanha classificada como `sem-funil` (sem ajuste e sem automático) → lead de porta vai para sessão estratégica.
- Campanha do lead sem gasto no período continua reconhecida (o mapa usa todas as campanhas, não só as do período).
- Comparação de nome de campanha sem diferença de maiúsculas e espaços nas pontas.
- Lead com funil vazio é porta → sessão estratégica (antes caía em `sem-funil`).

### Cenário de Erro
- Falha ao ler a lista de campanhas: o mapa usa só as campanhas do período (gastos já lidos); o CPL não cai.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S3-01 | automática | `tests/funil-lead.test.js` | aplicação + bioperfil-felipe → aquisicao; e `calcularCpl` não tem linha aplicacao-mentoria |
| CA-S3-02 | automática | `tests/funil-lead.test.js` | home (sessao-estrategica) + bioperfil-atacadoexponencial → aquisicao |
| CA-S3-03 | automática | `tests/funil-lead.test.js` | isca com e sem UTM → aquisicao; `calcularCpl` sem linha iscas-manychat |
| CA-S3-04 | automática | `tests/funil-lead.test.js` | aplicação + campanha `..._sessao-estrategica` → sessao-estrategica |
| CA-S3-05 | automática | `tests/funil-lead.test.js` | porta SE + campanha `..._lives-semanais` → lives-semanais-v1 |
| CA-S3-06 | automática | `tests/funil-lead.test.js` | campanha `..._workshops-gratuitos` com ajuste manual workshop → workshop |
| CA-S3-07 | automática | `tests/funil-lead.test.js` | sem UTM, `{{campaign.name}}` e campanha desconhecida → sessao-estrategica |
| CA-S3-08 | automática | `tests/funil-lead.test.js` | workshop com UTM de SE e com bioperfil → workshop |
| CA-S3-09 | automática | `tests/funil-lead.test.js` | lives, tráfego atacado e calculadora com UTM de SE/bio → próprio funil |
| CA-S3-10 | automática | `tests/cpl-calculo.test.js` | linha aquisicao: R$ 100, 4 leads, CPL 25 |
| CA-S3-11 | automática | `tests/cpl-calculo.test.js` | linha do funil: 6 leads, 3 novos, CPL 50, CPL novo 100 |
| CA-S3-12 | automática | `tests/cpl-calculo.test.js` | `por_canal` meta-ads: CPL 50, CPL novo 100 (o tile lê esses dois campos) |
| CA-S3-13 | manual | roteiro abaixo | aba Meta Ads em produção com a regra nova |

### Roteiro manual — CA-S3-13
1. Abrir o dash em produção, aba Meta Ads, período 12/10 a 18/10.
2. Na tabela CPL por funil: a linha aquisição tem leads (não "sem lead no período"); não existem as linhas aplicacao-mentoria nem iscas-manychat.
3. A tabela tem as colunas "Leads novos" e "CPL lead novo".
4. No topo, ao lado de "CPL Meta (pago)", aparece "CPL lead novo (pago)".

## Banco de Dados

Sem mudança de esquema. Leitura nova: `SELECT campaign_id, MAX(campaign_name) FROM ad_spend WHERE platform='meta' GROUP BY campaign_id`.

## Arquivos

- **Criar:** `functions/api/_funil-lead.js` — `funilDoLead(lead, mapaCampanhas)`, `mapaCampanhas({ campanhas, overrides, funisConhecidos })` e `normalizarFunil(funil)`; reusa `canalDeLead` (`_canal.js`), `resolverFunilAuto` e `FUNIL_SEM_CLASSIFICACAO` (`_funil-campanha.js`), `CANAL_AQUISICAO`.
- **Criar:** `tests/funil-lead.test.js` — CA-S3-01 a CA-S3-09.
- **Modificar:** `functions/api/_cpl-calculo.js` — funil do lead via `funilDoLead`; gasto normalizado por `normalizarFunil`; `por_canal` com leads novos; remove `aquisicao_estimativa`.
- **Modificar:** `functions/api/cpl.js` — lê a lista de campanhas e passa para `calcularCpl`.
- **Modificar:** `tests/cpl-calculo.test.js` — CA-S3-10 a 12; ajusta os testes antigos que esperavam `aplicacao-mentoria`/`sem-funil` como funil de lead e `aquisicao_estimativa`.
- **Modificar:** `public/dash/index.html` — `R.metaads`: colunas novas, tile novo, tira o push de `aquisicao_estimativa`.

## Checklist

- [x] `_funil-lead.js` com a regra e o mapa de campanhas
- [x] `_cpl-calculo.js` usando a regra (lead e gasto), `por_canal` com leads novos, sem `aquisicao_estimativa`
- [x] `cpl.js` lendo todas as campanhas do Meta
- [x] Aba Meta Ads: colunas Leads novos / CPL lead novo e tile CPL lead novo (pago)
- [x] Testes `tests/funil-lead.test.js` e `tests/cpl-calculo.test.js` passando, e `tests/reunioes-calendly.test.js` continua passando

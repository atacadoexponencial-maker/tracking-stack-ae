# 70: Mecanismo de conversão dos CTAs da /trafego-atacado

**Tipo:** Implementação
**Página:** LP do serviço de gestão de tráfego (`/trafego-atacado`) + nova página de formulário (`/aplicacao-trafego-atacado`)

## Descrição

Implementar o mecanismo de conversão da LP `/trafego-atacado` (Pendência 5 da spec — **DECIDIDA em 2026-07-14**, ver Decisões abaixo): os 3 CTAs da página (botão compacto da barra do hero, botão principal do hero e botão do CTA final) passam a levar para uma **nova página de formulário multi-etapas `/aplicacao-trafego-atacado`**, idêntica em estilo/estrutura à `/aplicacao-mentoria`, com uma pergunta a mais (investimento mensal em tráfego pago). Pós-envio, o backend devolve o redirect para o Calendly do serviço. Invariantes da spec mantidos: evento **Lead** com funil **`trafego-atacado`** e atribuição da visita, dedup navegador/servidor pelo mesmo `event_id` (pixels 1 e 2 + CAPI); roteamento pós-envio decidido pelo backend (thin-client); zero menção a "consultoria/diagnóstico/sessão gratuita" em qualquer texto (form, título, meta description).

## Decisões da usuária (2026-07-14) — desbloqueio

1. **Mecanismo:** CTAs → nova página `/aplicacao-trafego-atacado`, form multi-etapas no mesmo estilo/estrutura da `/aplicacao-mentoria`, com **uma pergunta a mais**: "Quanto você investe em tráfego pago por mês?" — **dropdown** com estas 5 opções exatas:
   - Ainda não invisto
   - Até R$ 1.500/mês
   - De R$ 1.500 a R$ 3.000/mês
   - De R$ 3.000 a R$ 10.000/mês
   - Acima de R$ 10.000/mês
2. **Pós-envio:** redirect para **https://calendly.com/gruposete/aplicacao-trafego-pago** — decidido pelo backend (mesmo padrão thin-client da aplicacao-mentoria: o `/tracker` devolve `{ redirect }` e a página só segue).
3. **Funil de tracking interno** (lead_data.funnel, dashboard, eventos Lead browser+CAPI): **`trafego-atacado`**.
4. **ClickUp (lista 205126080)** — campos reais confirmados via API:
   - 💵 Investimento em Tráfego — id `1e87bc05-95ba-444c-a728-eddf5fb603de`, tipo short_text → recebe o texto da faixa escolhida
   - 🔻 Funil (dropdown) — id `a663b002-661c-4dc1-86c3-612e94f3a447`, opção **APLICAÇÃO** (option id `51f77888-2ba1-4f83-9b33-d8ef516b80be`)
   - 🛒 Produto (dropdown) — id `6fd27248-beb5-49e1-9626-f1ab7ed81e5a`, opção **ACELERAÇÃO** (option id `5a98b2d7-bfe0-4c29-9de4-2c15721bd9a7`)

## Plano (pesquisa realizada 2026-07-14)

### Como a /aplicacao-mentoria funciona ponta a ponta (precedente a reutilizar)

- **Página/form:** `src/pages/aplicacao-mentoria.astro` é um arquivo único (~360 linhas): form em cartão com 3 etapas (`.aplicacao__etapa[data-etapa]`), 8 campos, validação client-side por campo (`FIELDS` + `STEP_FIELDS`), máscara de telefone, navegação ←/→ e submit na etapa 3. Detalhe que viabiliza o reuso: `validateAll`/`validateStep` fazem `if (!el) continue` — campos declarados em `FIELDS` que não existem no DOM são ignorados, então uma lista superset de campos serve às duas páginas.
- **Submit (thin-client):** o script monta `lead_data` com os campos + `funnel: 'aplicacao-mentoria'`, gera `event_id` (`'lead-' + Date.now() + ...`), dispara `fbq('track','Lead',{},{eventID})` (browser — os DOIS pixels são inicializados no BaseLayout, então a cópia do navegador vai para ambos) e faz `POST /tracker` com o mesmo `event_id` (espelho CAPI, deduplicado; pixel 2 recebe Lead via `pixel2Eligible`). Segue `json.redirect` ou fallback `/obrigada`. Sem retry (evita lead duplicado).
- **Redirect no backend:** `functions/tracker.js`, bloco "Roteamento pós-captação" (linhas 313–332): roteia por `leadFunnel` — `workshop` e `lives-semanais-v1` têm ramos próprios (`env.LEAD_REDIRECT_* || fallback`); o `else` (onde a aplicacao-mentoria cai) roteia por faixa de faturamento (WhatsApp vs Calendly). **`trafego-atacado` precisa de um ramo próprio ANTES do else** — todo lead deste funil vai ao Calendly do serviço, independente do faturamento.
- **ClickUp:** `sendToClickUp` (linhas 670–769) mapeia só campos com id em `CU_FIELD`. **Sem divergência a registrar:** o tracker já usa os DROPDOWNS — `CU_FIELD.funil = 'a663b002-…'` e `CU_FIELD.produto = '6fd27248-…'` (linhas 528–529), exatamente os ids confirmados pela usuária; os campos short_text parecidos ("🔻 FUNIL" `1bfecba1-…`, "🛒 PRODUTO" `c4378280-…`) não aparecem no código. Hoje: `mapFunnelToOption` (linha 541) → LIVES SEMANAIS ou default SESSÃO ESTRATÉGICA; produto fixo `CU_PRODUTO_AE` (linha 732). Para `trafego-atacado`: mapear funil → APLICAÇÃO e produto → ACELERAÇÃO.
- **Supabase/CRM + barramento WhatsApp:** `sendToCRM` (linha 453) repassa `...leadData` inteiro no topo do payload — **`investimento` viaja automaticamente**, mesma conclusão da investigação do `cargo` (issue 67). Nenhuma mudança no repo; se a tabela do Supabase precisar de coluna nova, é ajuste externo (ver Dependências Externas).
- **PageView da nova página:** vem de graça do `BaseLayout.astro` (fbq PageView browser nos 2 pixels + espelho `POST /tracker` com `event_id` `pv-…`). Nenhum mecanismo novo.
- **Atribuição/UTMs:** o middleware (`functions/_middleware.js`) captura UTMs/fbclid first-touch na criação da sessão (cookie `_krob_sid`, 400 dias) e o UPSERT preserva first-touch. Navegação interna LP → form mantém o cookie, então **os CTAs NÃO precisam propagar query string** — link simples `/aplicacao-trafego-atacado` (é assim que a atribuição já chega ao `/tracker` em todos os funis: via sessão D1, não via URL). Acesso direto de anúncio à página do form também funciona (middleware captura normalmente).
- **Whitelist do relatório de conversão:** `/aplicacao-mentoria` consta em `KNOWN_PAGE_PATHS` (`functions/api/conversion.js`, linha 135) → `/aplicacao-trafego-atacado` também precisa entrar. (`/trafego-atacado` já entrou via issue 71.)
- **Dashboard:** o seletor de funil popula dinamicamente a partir dos leads (pesquisa da issue 71) — `trafego-atacado` aparece sozinho no filtro quando o primeiro lead chegar. Nenhuma mudança no `public/dash/`.

### Decisão de reuso: extrair componente compartilhado (não duplicar)

Extrair o cartão do formulário (markup + estilos + script de validação/etapas/envio) de `aplicacao-mentoria.astro` para um componente **`src/components/AplicacaoForm.astro`**, parametrizado por props — mesmo racional da parametrização das seções da se-v1 na issue 69:

- **Props:** `funnel: string` (vai para `data-funnel` no `<form>`; o script lê `form.dataset.funnel` em vez do literal hardcoded) e `showInvestimento?: boolean` (renderiza condicionalmente o `<select name="investimento">`).
- **Por que não duplicar:** são ~250 linhas de lógica idêntica (validação, máscara de telefone, navegação de etapas, envio com event_id/dedup, redirect) — duplicar cria duas cópias a sincronizar em toda correção futura. O custo da parametrização é baixo porque o script já tolera campos ausentes (`if (!el) continue`): a lista `FIELDS`/`STEP_FIELDS` vira superset com `investimento` incluído e a página sem o campo simplesmente o ignora; o `lead_data` só inclui `investimento` quando o elemento existe (payload da aplicacao-mentoria permanece idêntico ao atual).
- **Posição do campo novo:** etapa 2, logo após "Faturamento mensal" (perguntas de qualificação financeira juntas; `STEP_FIELDS[1] = ['email','faturamento','investimento','cargo']`). Validação igual à dos outros selects: válido quando `value !== ''`.
- **Risco controlado:** o comportamento da `/aplicacao-mentoria` (funil ao vivo) não muda em nada observável — checklist tem item de verificação explícita.

## Cenários

### Happy Path
1. Visitante chega em `/trafego-atacado?utm_source=...&fbclid=...` — middleware cria a sessão com UTMs first-touch (já funciona; nada muda).
2. Clica em qualquer um dos 3 CTAs → navega para `/aplicacao-trafego-atacado` (link interno, mesmo cookie `_krob_sid` → atribuição preservada).
3. BaseLayout dispara PageView (browser 2 pixels + espelho /tracker deduplicado) — de graça, sem código novo.
4. Preenche as 3 etapas (etapa 2 tem o dropdown de investimento com as 5 opções exatas) e envia.
5. Script dispara `fbq('track','Lead')` com `event_id` único (browser, pixels 1 e 2) e `POST /tracker` com o mesmo `event_id` e `lead_data.funnel = 'trafego-atacado'` + `investimento`.
6. Backend: CAPI pixel 1 + pixel 2 + GA4 `generate_lead` (com funnel/UTMs), log em `event_log` com `funnel = 'trafego-atacado'`, persiste `sessions.funnel`, fan-out Supabase/CRM + barramento WhatsApp (investimento no payload via spread) e ClickUp: task criada com 💵 Investimento em Tráfego (texto da faixa), 🔻 Funil = APLICAÇÃO, 🛒 Produto = ACELERAÇÃO, demais campos como hoje.
7. `/tracker` responde `{ redirect: 'https://calendly.com/gruposete/aplicacao-trafego-pago' }` (via `env.LEAD_REDIRECT_CALENDLY_TRAFEGO`, com a URL como fallback hardcoded) — página segue o redirect.
8. Dashboard: lead aparece filtrável por `trafego-atacado` (seletor dinâmico) e `/aplicacao-trafego-atacado` entra na tabela "Conversão por LP" (whitelist).

### Edge Cases
- **Faturamento "Menos de 20 Mil" no funil trafego-atacado:** NÃO cai no roteamento por faturamento do `else` — o ramo `trafego-atacado` vem antes e manda todo lead ao Calendly do serviço (decisão da usuária: redirect único).
- **Lead repetido (task já existe no ClickUp):** comentário "Lead Voltou ao CRM" ganha a linha `Investimento em Tráfego: ${investimento}` junto de Cargo/Justificativa/Objetivo (mesmo padrão; a linha sai vazia para funis sem o campo, como Cargo hoje).
- **Leads de outros funis (sem investimento):** `push()` ignora valor vazio — task criada exatamente como hoje, sem o custom field 💵.
- **`/aplicacao-mentoria` após o refactor:** mesmos 8 campos, mesmo funnel, mesmo redirect por faturamento, mesmo payload (`investimento` não é enviado — o campo não existe no DOM da página).
- **Acesso direto a `/aplicacao-trafego-atacado` de anúncio (com UTMs):** middleware captura atribuição normalmente; a página é destino válido por si só.
- **Enter num input das etapas 1/2:** tratado como "avançar" (comportamento herdado do componente).
- **Bot (UA de crawler):** CAPI/GA4 suprimidos, evento logado — comportamento existente do /tracker, sem mudança.
- **Telefone que o ClickUp rejeita (400):** fallback existente (recria sem o campo phone, número cru na description) intacto — investimento vai nos custom fields normalmente.

### Cenário de Erro
- **`POST /tracker` falha (rede/500):** sem retry (evitaria lead duplicado); página segue o fallback `/obrigada` — padrão herdado da aplicacao-mentoria.
- **Escrita no ClickUp falha após retry:** `logClickUpFailure` grava `leadData` completo (incluindo `investimento`) em `clickup_sync_failures` + alerta WhatsApp com throttle — caminho existente, nada a mudar.
- **Meta CAPI recusa o Lead:** alerta com throttle (camadas existentes, pixels 1 e 2) — nada a mudar.
- **Env `LEAD_REDIRECT_CALENDLY_TRAFEGO` ausente:** fallback hardcoded para a URL do Calendly no próprio ramo — o redirect nunca sai `null` para este funil.

## Banco de Dados

Nenhuma mudança de schema. `sessions.funnel` e `event_log.funnel` recebem `'trafego-atacado'` pelos caminhos existentes; `clickup_sync_failures` já guarda o `lead_json` completo.

## Arquivos

- **Criar:** `src/components/AplicacaoForm.astro` — componente do formulário multi-etapas extraído de `aplicacao-mentoria.astro` (logo + cartão + estilos + script de validação/etapas/máscara/envio). Props: `funnel` (→ `data-funnel` no form, lido pelo script) e `showInvestimento` (renderiza o `<select name="investimento">` na etapa 2, após faturamento). `FIELDS`/`STEP_FIELDS` viram superset com `investimento` (validação `v !== ''`); `lead_data` inclui `investimento` só quando o elemento existe.
- **Criar:** `src/pages/aplicacao-trafego-atacado.astro` — página fina: `BaseLayout` (`showHeader={false}`, `showFooter={false}`) + `<AplicacaoForm funnel="trafego-atacado" showInvestimento />`. Title/description próprios de reunião comercial — **sem** "consultoria/diagnóstico/sessão gratuita" (ex.: "Aplicação — Gestão de Tráfego para Atacado | Atacado Exponencial").
- **Modificar:** `src/pages/aplicacao-mentoria.astro` — passa a renderizar `<AplicacaoForm funnel="aplicacao-mentoria" />` no lugar do form inline (title/description e BaseLayout inalterados; comportamento observável idêntico).
- **Modificar:** `src/pages/trafego-atacado.astro` — `const ctaHref = '/aplicacao-trafego-atacado'` (remove o comentário PLACEHOLDER da issue 70); remover o `id="agendar"` do `FinalCta` (âncora morta). Sem propagação de query string (atribuição via sessão/middleware).
- **Modificar:** `functions/tracker.js` —
  1. `CU_FIELD.investimento = '1e87bc05-95ba-444c-a728-eddf5fb603de'` (💵 Investimento em Tráfego, short_text).
  2. Consts `CU_FUNIL_APLICACAO = '51f77888-2ba1-4f83-9b33-d8ef516b80be'` e `CU_PRODUTO_ACELERACAO = '5a98b2d7-bfe0-4c29-9de4-2c15721bd9a7'`.
  3. `mapFunnelToOption`: `'trafego-atacado'` → `CU_FUNIL_APLICACAO` (demais inalterados).
  4. Produto deixa de ser fixo: `'trafego-atacado'` → `CU_PRODUTO_ACELERACAO`, demais → `CU_PRODUTO_AE` (helper `mapProdutoToOption(funnel)` ao lado de `mapFunnelToOption`, substituindo o push hardcoded da linha 732).
  5. `sendToClickUp`: extrair `const investimento = (leadData.investimento || '').toString().trim();`, `push(CU_FIELD.investimento, investimento)` na criação, e linha `Investimento em Tráfego: ${investimento}` no comentário de lead repetido (após Cargo).
  6. Bloco "Roteamento pós-captação": novo ramo `else if (leadFunnel === 'trafego-atacado') { leadRedirect = env.LEAD_REDIRECT_CALENDLY_TRAFEGO || 'https://calendly.com/gruposete/aplicacao-trafego-pago'; }` antes do `else` do faturamento.
- **Modificar:** `functions/api/conversion.js` — adicionar `'/aplicacao-trafego-atacado',` ao Set `KNOWN_PAGE_PATHS` (junto de `'/aplicacao-mentoria'`; `'/trafego-atacado'` já entrou via issue 71).

Nada mais é tocado: `functions/_middleware.js`, `BaseLayout.astro`, `public/dash/`, `sendToCRM`, `buildLeadNotif` e o schema D1 permanecem como estão.

## Dependências Externas

- **Calendly:** evento `https://calendly.com/gruposete/aplicacao-trafego-pago` (fornecido pela usuária) — conferir que está publicado/ativo antes do go-live.
- **ClickUp lista 205126080:** campos 💵 Investimento em Tráfego, opção APLICAÇÃO do 🔻 Funil e opção ACELERAÇÃO do 🛒 Produto já existem (ids confirmados via API em 2026-07-14). Nada a criar.
- **Cloudflare Pages (produção):** setar `LEAD_REDIRECT_CALENDLY_TRAFEGO` é opcional — o fallback hardcoded já aponta para a URL correta; a env existe para trocar o destino sem deploy (mesmo padrão de `LEAD_REDIRECT_WORKSHOP`).
- **Supabase (fora do repo):** `investimento` chega no payload do fan-out automaticamente; se o time quiser a coluna no CRM, é ajuste na ingestão do Supabase (mesmo tratamento dado ao `cargo` — pendência externa, não bloqueia).

## Checklist

- [x] Extrair `src/components/AplicacaoForm.astro` de `aplicacao-mentoria.astro` com props `funnel` (via `data-funnel`) e `showInvestimento`; `FIELDS`/`STEP_FIELDS` superset com `investimento`; `lead_data` só inclui `investimento` quando o campo existe
- [x] Dropdown de investimento com as 5 opções EXATAS da decisão, na etapa 2 após "Faturamento mensal", validação `v !== ''` com mensagem própria ("Escolha a faixa de investimento.")
- [x] `aplicacao-mentoria.astro` refatorada para usar o componente — comportamento observável idêntico (8 campos, funnel `aplicacao-mentoria`, redirect por faturamento, payload sem `investimento`; payload conferido via astro preview + intercept do fetch: mesmas 9 chaves de antes)
- [x] Criar `src/pages/aplicacao-trafego-atacado.astro` com `funnel="trafego-atacado"` + `showInvestimento`; title/meta description sem qualquer menção a consultoria/diagnóstico/sessão gratuita (grep no HTML gerado: 0 ocorrências)
- [x] `trafego-atacado.astro`: `ctaHref = '/aplicacao-trafego-atacado'` nos 3 CTAs (hero nav, hero principal, CTA final), placeholder e âncora `#agendar` removidos
- [x] `functions/tracker.js`: `CU_FIELD.investimento` + consts APLICAÇÃO/ACELERAÇÃO + `mapFunnelToOption('trafego-atacado')` → APLICAÇÃO + produto por funil (ACELERAÇÃO para trafego-atacado, AE para os demais, via `mapProdutoToOption`) + `push` do investimento + linha no comentário de lead repetido
- [x] `functions/tracker.js`: ramo de redirect `trafego-atacado` → `env.LEAD_REDIRECT_CALENDLY_TRAFEGO || 'https://calendly.com/gruposete/aplicacao-trafego-pago'` antes do roteamento por faturamento
- [x] `functions/api/conversion.js`: `'/aplicacao-trafego-atacado'` no `KNOWN_PAGE_PATHS`
- [x] Verificar dedup: mesmo `event_id` no `fbq('track','Lead')` e no `POST /tracker` (herdado do componente — script gera `eventId` uma vez e usa nos dois; conferido no bundle gerado e no teste de submit)
- [ ] Pós-deploy: enviar um lead de teste em produção e conferir (a) redirect ao Calendly, (b) task no ClickUp com 💵/🔻 APLICAÇÃO/🛒 ACELERAÇÃO, (c) lead no dashboard filtrável por `trafego-atacado`, (d) linha `/aplicacao-trafego-atacado` no relatório de conversão, (e) Lead deduplicado nos Events Managers dos pixels 1 e 2

## Observações fora do escopo (registrar, não implementar)

- `mapFunnelToOption` continua carimbando `aplicacao-mentoria` como SESSÃO ESTRATÉGICA (pendência da issue 67). Com a opção APLICAÇÃO agora existente, a usuária pode querer remapear também a aplicacao-mentoria — decisão não tomada; não mexer nesta issue.
- Coluna `investimento` no CRM Supabase: ajuste externo opcional (payload já chega).

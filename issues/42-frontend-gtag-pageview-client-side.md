# 42: Ligar o gtag client-side no BaseLayout (pageviews/sessões no GA4)
**Tipo:** Implementação
**Página:** Site inteiro (via `src/layouts/BaseLayout.astro`)

## Descrição
Carregar o GA4 no navegador (via o proxy first-party que já existe) e disparar o `config` no `<head>` do layout compartilhado, para que o GA4 passe a receber **PageView e sessões** — hoje ele só recebe conversões (server-side). Isso dá ao GA4 o denominador que falta (tráfego/sessões) para virar ferramenta de análise.

## Contexto / Reuso (NÃO reconstruir)
- O proxy first-party do gtag JÁ EXISTE: `functions/scripts/[[path]].js` serve o `googletagmanager.com/gtag/js` pelo seu domínio, usando `?id=` ou o fallback `env.GA4_MEASUREMENT_ID`. Endpoint: `/scripts/<qualquer-nome>.js?id=G-3C24BQVR59`.
- `GA4_MEASUREMENT_ID` (G-3C24BQVR59) já está em produção. O Measurement ID **não é secreto** (aparece em todo site com GA) — pode ir literal no client OU via env pública `PUBLIC_GA4_MEASUREMENT_ID` (preferível para fonte única). Escolher UMA abordagem e documentar.
- `BaseLayout.astro` é o layout único usado pelas páginas; o snippet vai no `<head>` (após os `<title>`/`preload`). Verificar que TODAS as páginas relevantes (home, `lives-semanais-v1`, vsl, workshop, calculadora, obrigada) usam este layout; se alguma não usar, cobri-la também.
- O `client_id` do GA4 vem do cookie `_ga`. O server-side (`tracker.js`) JÁ lê o mesmo `_ga` (`extractGA4ClientId`) — então pageview client-side e conversão server-side vão casar na mesma sessão automaticamente. Não inventar client_id novo.

## O que fazer
1. No `<head>` do `BaseLayout.astro`, carregar o gtag pelo proxy first-party (`<script async src="/scripts/gtag.js?id=...">`) e inicializar: `dataLayer`, `gtag('js', ...)`, `gtag('config', '<measurement-id>')`.
2. Usar o Measurement ID de fonte única (env pública ou constante), sem duplicar o valor espalhado.
3. NÃO configurar o gtag para enviar `generate_lead`/`purchase` no client — esses continuam saindo só do server-side (`tracker.js`), para evitar contagem dupla de conversão. O client manda apenas o `page_view` automático.
4. Não quebrar LCP/preloads existentes (script `async`).

## Critérios de aceite
- Ao abrir qualquer página (ex.: `/lives-semanais-v1/`), o GA4 Tempo real/DebugView registra um `page_view`.
- Nenhuma conversão duplicada: `generate_lead` continua vindo só do server-side (1 por lead, não 2).
- O `page_view` client e o `generate_lead` server compartilham o mesmo `client_id` (`_ga`) — ficam na mesma sessão no GA4.
- Sem regressão visível de performance (script `async`; preloads intactos).

## Arquivos
- MODIFICAR: `src/layouts/BaseLayout.astro`
- (Se aplicável) qualquer página que não use o `BaseLayout`.
- NÃO tocar em `functions/scripts/[[path]].js` (já pronto) nem em `functions/tracker.js`.

## Fora de escopo
- Envio de conversões pelo client (mantém server-side).
- Consent Mode / banner de cookies (se for requisito, vira issue própria).
- Dashboard interno puxando dados do GA4 via Data API (spec separada).
- Issues 40/41 (params + dimensões de criativo) — independentes desta.

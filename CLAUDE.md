# Tracking Atacado Exponencial

@AGENTS.md

As regras e o fluxo estão no `AGENTS.md`, importado acima. Aqui fica só o que é deste
projeto.

> ⚠️ **Este repositório é público.** Nada de segredo, token, IP da VPS, id de conta,
> telefone ou dado de lead em arquivo commitado, nem em comentário de código.

## O que é

O site e o sistema de marketing do Atacado Exponencial: as landing pages (LPs) dos funis
(workshop, sessão estratégica, imersão, mentoria, materiais), o rastreamento de visitas e
leads, que envia ao Meta CAPI, ao GA4 e ao CRM, e o **dash** interno (`/dash`). O dash
reúne funis, leads, CPL, reuniões, A/B, e-mail, agenda própria e outras abas usadas pela
equipe. A dona do projeto não é técnica: explique em linguagem simples, sem jargão.

## Stack

- **Site:** Astro 6, páginas estáticas em `src/pages/`.
- **Backend:** Cloudflare Pages Functions (`functions/`), em JavaScript puro.
- **Banco:** Cloudflare D1 (binding `DB`), com migrations em `migrations/`. Também existe um
  Postgres na Neon, usado pelo Argo, que roda na VPS.
- **Hospedagem:** projeto Pages `tracking-ae`, conectado ao GitHub. **Push na `main` =
  deploy em produção** (atacadoexponencial.com). Plano Workers Paid desde 03/11/2026.
- **Integrações:** Meta CAPI (2 pixels), GA4, ClickUp (CRM comercial), ManyChat,
  Postmark (e-mail), Calendly/Google Agenda, Greenn e Zouti (checkout), Windsor
  (investimento Meta), Evolution API (WhatsApp, saindo da stack).
- **VPS (Hostinger):** n8n, crons de coleta, backup do D1 e o Hermes/Argo. Só se acessa por
  SSH da máquina local; uma sessão na nuvem não alcança a VPS.

## Pastas

```
src/pages/          uma LP por arquivo .astro (variantes A/B: se-v3, se-v5, workshop-gratuito-v4…)
src/components/     componentes das LPs (reaproveitar antes de criar)
functions/          rotas do backend; arquivos com "_" na frente são módulos internos
functions/api/      API do dash e das integrações (_argo-*, _email-*, _agenda-*…)
functions/webhook/  webhooks de entrada (ClickUp e plataformas de venda)
public/dash/        frontend do dash (um .js por aba). Cache de 4h em /dash/*.js
public/_redirects   redirects (casa exato: com e sem barra final são regras separadas)
migrations/         migrations do D1, numeradas (0001…)
tests/              testes com node --test (*.test.js)
scripts/            coletas e sincronizações que rodam na VPS
painel/             OUTRO projeto Pages (painel de clientes da agência), com deploy próprio
issues/             issues antigas do fluxo (00 a 4xx)
pre-desenvolvimento/ specs e issues novas do fluxo anti-vibe (pasta que o auditor lê)
spec-*.md           specs ativas (as concluídas vão para docs/specs-arquivadas/)
docs/               arquitetura, schema, data-flow, manuais
DESIGN.md           sistema visual (dash claro "Etiqueta"; site e painel escuros)
```

## Comandos

- rodar o site: `npm run dev`
- build: `npm run build`
- testes: `npm test` (o auditor usa `node --test` com o reporter de `.claude/`)
- migration no D1 remoto: `npx wrangler d1 migrations apply tracking-ae-db --remote`
  (aplicar **antes** do merge que depende dela)

## Regras deste projeto

**Deploy e produção**
- Na lista de deploys do Pages, `Active` quer dizer que o build **ainda está rodando**. Só
  diga que está no ar quando a linha virar tempo relativo ("3 minutes ago"). `Failure` =
  produção continua no commit anterior.
- Secret novo no Pages só passa a valer no **próximo** deploy (commit vazio serve). Grave
  por `printf '<valor>' | npx wrangler pages secret put NOME --project-name tracking-ae`,
  nunca colando no painel (já entrou BOM invisível e quebrou token).
- Deploy do `painel/` só com `cd painel && pwd` no mesmo comando. Na raiz, o wrangler
  publica no site de produção e corrompe a configuração do build.
- Nunca repita um segredo na resposta, nem copiado de cima. Use um marcador
  (`SEGREDO_NOVO`).

**Dados**
- D1 tem limite de leitura: confira o plano com `EXPLAIN QUERY PLAN` antes de query pesada.
  Índice novo só funciona junto com `ANALYZE`.
- Não confira teste A/B ativo com curl fingindo navegador: isso grava sessão e exposição
  falsas em produção. Use o UA padrão do curl ou leia `ab_tests`/`ab_variants`.
- Bloqueio de bot é por IP/bloco, nunca por padrão de e-mail.
- `REGRAS_FUNIL` em `functions/_lead-bloqueio.js` bloqueia `lives-semanais*`. Se a live
  semanal voltar, tire essa regra.
- Payload da Evolution traz a apikey em texto claro: nunca grave o corpo cru.

**Texto e visual**
- Nada de travessão (— ou –) em texto de página. Use vírgula, ponto ou "|".
- Trabalho visual (página, seção, componente) passa por skill de design
  (`impeccable:impeccable` ou `frontend-design:frontend-design`), e diga qual está em uso.
  A skill de marca (`atacado-exponencial-brand`) só entra com `/id-ae` na mensagem.
- Se o pedido trouxer uma referência visual (URL), abra e estude antes de desenhar.
- Ela valida o visual no site no ar, não em prints locais. Não deixe screenshots no repo.
- Copy passa pela skill `anti-vibe-copy` antes da entrega.

**Jeito de trabalhar**
- Spec só avança com aprovação explícita ("aprovado", "pode seguir"). Confirmar a direção
  não é aprovar.
- Depois de um "sim", execute. Não pergunte de novo.
- Não proponha Evolution/WhatsApp não oficial para recurso novo.

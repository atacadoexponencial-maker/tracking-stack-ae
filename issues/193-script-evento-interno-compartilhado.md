# 193: Módulo `funil.ts` com o envio de evento interno

**Tipo:** Implementação
**Página:** src/scripts/
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar `src/scripts/funil.ts` com `enviarEventoInterno()` — o `POST /tracker` que hoje está escrito à mão dentro do `form-start.ts` — e fazer o `form-start.ts` passar a usá-lo.

## Por que assim

Refatoração sem mudança de comportamento: o `FormStart` continua idêntico. Existe para que `CTAClick` e `FormStep` não criem uma segunda e uma terceira cópia do mesmo `fetch`. O `form-start.ts` continua com a responsabilidade única de disparar o `FormStart` no primeiro toque.

## Pesquisa da base de codigo

- **`src/scripts/form-start.ts`** e o codigo a extrair. Hoje ele monta o corpo e
  chama `fetch('/tracker', ...)` inline dentro do listener, com `.catch()` mudo.
  Campos enviados: `event_name`, `event_id` (prefixo `fs-` + `Date.now()` +
  sufixo aleatorio), `event_time` em segundos, `event_source_url` e
  `lead_data: { funnel, material }`.
- **Quem importa o `form-start.ts` hoje** (4 arquivos, nenhum deles muda nesta
  issue): `AplicacaoForm.astro:195`, `LeadChat.astro:183`,
  `LeadFormModal.astro:91`, `materiais/[slug].astro:110`. A assinatura de
  `ativarFormStart` **nao pode mudar** -- so o corpo.
- **Padrao de import nos `.astro`:** `import { ativarFormStart } from
  '../scripts/form-start';` dentro de `<script>` (bundlado, aceita `import`).

## Cenarios

### Happy Path

1. `funil.ts` exporta `enviarEventoInterno(nome, prefixo, extras)`, que monta o
   corpo e faz o `POST /tracker`.
2. `form-start.ts` passa a chamar
   `enviarEventoInterno('FormStart', 'fs-', { lead_data: { funnel, material } })`.
3. O evento que chega ao `/tracker` e **byte a byte o mesmo** de antes: mesmo
   nome, mesmo formato de `event_id`, mesmos campos.

### Edge Cases

- **`navigator.sendBeacon` indisponivel:** a funcao tenta o beacon e cai para
  `fetch` com `keepalive: true`. Para o `FormStart` isso e indiferente (nao ha
  navegacao em curso); existe para o `CTAClick` da issue 194, onde o clique
  navega e o `fetch` comum seria cancelado.
- **`sendBeacon` retorna `false`** (fila cheia): cair para o `fetch`, nao perder
  o evento em silencio.

### Cenario de Erro

Qualquer falha e engolida com `.catch(() => {})`, como hoje. Um evento de
medicao nunca pode travar quem esta preenchendo o formulario. O `try/catch` cobre
tambem o `sendBeacon`, que lanca `TypeError` em alguns navegadores quando o
`Blob` tem tipo nao permitido.

## Arquivos

- **Criar:** `src/scripts/funil.ts` -- `enviarEventoInterno(nome, prefixo, extras)`:
  monta `event_id`, `event_time` e `event_source_url`, e envia por
  `sendBeacon` com reserva em `fetch`.
- **Modificar:** `src/scripts/form-start.ts` -- o listener passa a chamar
  `enviarEventoInterno`; some o `fetch` inline. `ativarFormStart` mantem nome,
  assinatura e comportamento.

## Checklist

- [x] `src/scripts/funil.ts` criado com `enviarEventoInterno`
- [x] `event_id` no formato existente: `<prefixo> + Date.now() + '-' + random`
- [x] `sendBeacon` primeiro, `fetch({keepalive:true})` de reserva, tudo em `try/catch`
- [x] `form-start.ts` usa a funcao nova; `ativarFormStart` com assinatura intacta
- [x] Os 4 arquivos que importam `form-start` **nao** sao tocados
- [x] `npm run build` passa
- [x] Comportamento do `FormStart` inalterado (mesmo nome, mesmo `fs-`, mesmos campos)

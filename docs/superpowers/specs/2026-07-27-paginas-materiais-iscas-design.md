# Páginas de materiais (iscas do ManyChat)

**Data:** 2026-07-27
**Status:** Design aprovado, pronto para plano de implementação

## Problema

A operação vai entregar materiais ricos (PDFs) através do ManyChat. Cada material
precisa de uma página própria onde a pessoa preenche nome, email e WhatsApp e é
levada ao arquivo no Google Drive. O primeiro material é o guia de ICP.

Sem uma estrutura definida, cada material viraria uma landing page copiada e
colada — duplicação de HTML/CSS e manutenção multiplicada por material. E sem
decidir como o material é identificado no tracking, os leads de todas as iscas
ficariam indistinguíveis no dashboard.

## Decisões

| Assunto | Decisão |
| --- | --- |
| Hospedagem do PDF | Google Drive, link público |
| Estrutura das páginas | Rota dinâmica `/materiais/[slug]` + catálogo |
| Funil | `iscas-manychat`, único para todos os materiais |
| Identificação do material | Coluna própria `material` no `event_log` |
| Destino do lead | Card no ClickUp, como os demais funis |
| Entrega | Redirect direto para o Drive após o submit |
| Alerta interno | Sim, notificação de WhatsApp como os demais funis |

## Arquitetura

### Catálogo de materiais

`src/data/materiais.js` é a única fonte de verdade sobre quais materiais existem:

```js
export const MATERIAIS = [
  {
    slug: 'icp',
    titulo: 'Como definir o seu ICP',
    subtitulo: 'Pare de vender para quem nunca vai comprar.',
    destino: 'https://drive.google.com/file/d/1vxZUBN71vJF7SUbuN7GtkV6TQYL03rMz/view',
  },
];
```

Lançar um material novo é acrescentar uma entrada. Nenhum código novo, nenhum
risco de quebrar os materiais já publicados.

O link do Drive fica no catálogo, não em variável de ambiente. Adicionar um
material já exige deploy — a página é pré-renderizada no build —, então uma env
var só acrescentaria um passo manual no painel da Cloudflare sem ganho: o link
do Drive é público, não é secret.

O catálogo é importado tanto pela página Astro quanto por `functions/tracker.js`.
Quem resolve o destino do redirect continua sendo o backend; o frontend nunca
conhece a URL do arquivo.

### Página

`src/pages/materiais/[slug].astro`, com `getStaticPaths()` gerando uma rota por
entrada do catálogo. O projeto é `output: 'static'`, então cada material vira um
HTML pré-renderizado (`/materiais/icp`).

Conteúdo: `BaseLayout.astro` (que já carrega o tracking), logo, título e
subtítulo vindos do catálogo, e o formulário. Três campos apenas — **nome, email
e WhatsApp** —, com o estilo herdado de `LeadFormModal.astro` para não introduzir
um visual novo no site.

No submit, `POST /tracker` com:

```json
{
  "event_name": "Lead",
  "lead_data": { "funnel": "iscas-manychat", "material": "icp", ... }
}
```

O backend responde com `{ ok: true, redirect: "<link do Drive>" }` e o frontend
apenas executa o redirect.

### Backend — `functions/tracker.js`

1. **Roteamento pós-captação:** novo ramo para o funil `iscas-manychat`, que
   resolve o destino pelo `material` no catálogo. Slug desconhecido cai em
   `/obrigada` em vez de quebrar o fluxo.
2. **Log:** grava `material` no `event_log`, ao lado de `funnel`.
3. **Meta CAPI, GA4 e CRM Supabase:** fluxo normal, sem exceção.
4. **ClickUp:** card criado como nos demais funis. 🔻 Funil recebe a opção
   **ISCAS** (`b1d0bc63-3d66-41f0-ad31-4a74d7b541ed`) via `mapFunnelToOption`;
   🛒 Produto segue no default AE. O nome do material entra na descrição do card.
5. **WhatsApp:** notificação interna como nos demais funis, com o nome do
   material na mensagem.

### Banco

`migrations/0027_event_log_material.sql`:

```sql
ALTER TABLE event_log ADD COLUMN material TEXT;
```

⚠️ Aplicar com `wrangler d1 execute --remote --file=...`. **Nunca** rodar
`wrangler d1 migrations apply --remote` neste projeto: as migrations 0021, 0022 e
0025 quebram ao serem reaplicadas.

### Dashboard

Bloco novo "Materiais mais baixados": leads por `material` no período
selecionado, respeitando os filtros de data já existentes.

O filtro de funil não precisa de alteração — `functions/api/leads.js` popula o
seletor com `SELECT DISTINCT` do banco, então `iscas-manychat` aparece sozinho
assim que o primeiro lead entrar.

## Por que não `utm_content`

`utm_content` carrega o criativo do anúncio e alimenta o breakdown por criativo
já existente. Reaproveitá-lo para o nome do material poluiria esse relatório.

## Por que não a `landing_url`

`sessions.landing_url` já registra a página de entrada e o endpoint
`/api/conversion` já agrupa por ela — daria o número por material sem escrever
nada. Mas a atribuição é *first-touch da sessão*: quem chegou por outra página
antes, ou baixa dois materiais na mesma sessão, teria os leads colados na
primeira página vista. A coluna própria é imune a isso.

## Texto da página do ICP

O título e o subtítulo da primeira entrada do catálogo são um rascunho, escrito a
partir do conteúdo do próprio PDF. A usuária revisa e ajusta na implementação —
trocar o texto é editar uma linha do catálogo.

## Fora de escopo

- Nenhuma alteração nas LPs existentes.
- Upload dos PDFs para o Drive (feito pela usuária).
- Segunda oferta ou CTA de continuidade na página do material.

## Passos manuais (dependem da usuária)

1. ~~Criar a opção **ISCAS** no dropdown 🔻 Funil do ClickUp~~ — feito em
   2026-07-27, ID `b1d0bc63-3d66-41f0-ad31-4a74d7b541ed`.
2. Confirmar que o PDF do ICP está com link público de visualização no Drive.
3. Aplicar a migration em produção com `wrangler d1 execute --remote`.

## Testes

`tests/materiais.test.js`, no padrão `node --test` já usado pelo projeto:

- resolução do destino a partir de um slug válido;
- slug desconhecido cai no fallback `/obrigada`;
- unicidade dos slugs do catálogo.

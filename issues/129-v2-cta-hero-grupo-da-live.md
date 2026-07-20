# 129: CTA do hero leva ao /grupo-da-live

**Tipo:** Implementação
**Página:** /lives-semanais-v2

## Descrição

Fazer o botão do hero "QUERO MINHA VAGA NA LIVE →" apontar para o endereço interno `/grupo-da-live` (redirecionador do grupo de WhatsApp já existente). O link real do grupo nunca aparece na página — apenas o caminho interno.

## Decisão

O CTA do hero deixa de apontar para a âncora `#inscricao` (placeholder da issue 128) e passa a apontar **direto** para `/grupo-da-live`. Motivo: a spec define que o clique no CTA do hero "leva o visitante ao endereço interno do redirecionador do grupo (`/grupo-da-live`)" — a v2 é a variante de menor atrito, sem parada intermediária na seção de inscrição. O redirecionador já existe em `functions/grupo-da-live.js` (302 server-side para `env.LEAD_REDIRECT_LIVE`), então nada precisa ser criado no backend; o link do grupo continua sem aparecer no HTML.

Navegação na mesma aba (sem `target="_blank"`): é o mesmo padrão de redirect já usado no pós-formulário da v1, e em mobile o próprio WhatsApp assume a navegação.

## Cenários

### Happy Path
1. Visitante abre `/lives-semanais-v2` e clica em "QUERO MINHA VAGA NA LIVE →" no hero.
2. O navegador vai para `/grupo-da-live` (mesmo domínio).
3. `functions/grupo-da-live.js` responde 302 com `Location: env.LEAD_REDIRECT_LIVE` e o visitante cai no grupo de WhatsApp da live.

### Edge Cases
- **Dev local com `astro dev`:** Pages Functions (`functions/`) não rodam no dev server do Astro — o clique dará 404 local. Comportamento esperado; validar o fluxo completo em preview/produção (Cloudflare Pages) ou via `wrangler pages dev`.
- **Mobile:** o 302 abre o `chat.whatsapp.com`, que dispara o app do WhatsApp — nada extra a fazer na página.
- **Clique com modificador (ctrl/cmd+clique, abrir em nova aba):** funciona normalmente por ser um `<a>` comum com caminho relativo.

### Cenário de Erro
- **`LEAD_REDIRECT_LIVE` ausente/vazia no ambiente:** o endpoint já trata isso — redireciona para `/` (fallback embutido em `functions/grupo-da-live.js`, linha 12). Nenhum tratamento novo é necessário nesta issue.

## Arquivos

- **Modificar:** `src/pages/lives-semanais-v2.astro` — linha 33: trocar `href="#inscricao"` por `href="/grupo-da-live"` no CTA do hero. Antes:
  ```html
  <a href="#inscricao" class="btn-cta lv-hero__cta">QUERO MINHA VAGA NA LIVE →</a>
  ```
  Depois:
  ```html
  <a href="/grupo-da-live" class="btn-cta lv-hero__cta">QUERO MINHA VAGA NA LIVE →</a>
  ```
  Nada mais muda: classes, texto do botão e estilos permanecem idênticos. **Não tocar** no CTA da seção final (`href="#"` na seção `#inscricao`, linha 78) — é escopo da issue 130. A âncora `id="inscricao"` da seção final também fica como está.

## Checklist

- [x] `src/pages/lives-semanais-v2.astro`: CTA do hero com `href="/grupo-da-live"` (texto e classes inalterados)
- [x] CTA da seção final permanece com `href="#"` (não invadir a issue 130)
- [x] Nenhum outro arquivo tocado (o endpoint `functions/grupo-da-live.js` já existe e não muda)
- [x] Build local passa (`npm run build`)
- [ ] Verificação em preview/produção: clicar no CTA do hero leva ao grupo de WhatsApp via 302 do `/grupo-da-live`

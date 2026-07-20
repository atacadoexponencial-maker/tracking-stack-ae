# 130: CTA da seção final leva ao /grupo-da-live

**Tipo:** Implementação
**Página:** /lives-semanais-v2

## Descrição

Fazer o botão único da seção final "Garanta sua vaga gratuita" apontar para o mesmo destino do CTA do hero: o endereço interno `/grupo-da-live`. Sem disparo de evento de Lead e sem qualquer captura de dados — é só o link.

## Plano

A mudança é uma única linha em `src/pages/lives-semanais-v2.astro`, na seção final (`<section id="inscricao">`, linha 74). Hoje o botão está assim (linha 78):

```html
<a href="#" class="btn-cta inscricao__cta">QUERO PARTICIPAR DA LIVE →</a>
```

Deve ficar assim — espelhando exatamente o CTA do hero (linha 33, `<a href="/grupo-da-live" class="btn-cta lv-hero__cta">…`):

```html
<a href="/grupo-da-live" class="btn-cta inscricao__cta">QUERO PARTICIPAR DA LIVE →</a>
```

Nada mais muda: texto do botão, classes CSS (`btn-cta inscricao__cta`), estilos e demais elementos da seção permanecem intactos. Não usar `target="_blank"`, não anexar UTMs manualmente e não adicionar JS/handler de clique — conforme a spec, o `/grupo-da-live` é um redirecionador resolvido no servidor e o link do grupo nunca aparece no conteúdo da página.

## Cenários

### Happy Path
- Visitante rola até a seção final "Garanta sua vaga gratuita" em `/lives-semanais-v2` e clica em "QUERO PARTICIPAR DA LIVE →".
- O navegador navega para `/grupo-da-live` (mesma aba), que redireciona para o grupo de WhatsApp da live — mesmo comportamento do CTA do hero (issue 129).
- Nenhum evento de Lead é disparado e nenhum dado é capturado no clique.

### Edge Cases
- **Visitante chegou com UTMs na URL da LP:** o link é interno e simples (`/grupo-da-live`), sem repasse de query string — igual ao CTA do hero. A atribuição da visita já foi registrada pelo layout base no pageview; nada a fazer no link.
- **Clique com botão do meio / Ctrl+clique:** abre `/grupo-da-live` em nova aba normalmente, por ser um `<a>` nativo sem JS.
- **Ambos os CTAs da página:** hero e seção final devem apontar para o mesmo destino; se o destino do grupo mudar no futuro, troca-se só a configuração central do `/grupo-da-live`, sem tocar nesta página.

### Cenário de Erro
- **`/grupo-da-live` fora do ar ou mal configurado:** o clique leva à resposta que esse endereço der (erro/404 do redirecionador). Não é escopo desta issue tratar isso — a issue é só o `href`; o comportamento de erro pertence ao redirecionador.

## Arquivos

- **Modificar:** `src/pages/lives-semanais-v2.astro` — na linha 78 (seção `id="inscricao"`), trocar `href="#"` por `href="/grupo-da-live"` no `<a class="btn-cta inscricao__cta">`. Única mudança; nenhum outro arquivo é tocado.

## Checklist

- [x] Em `src/pages/lives-semanais-v2.astro`, o `<a>` da seção `#inscricao` tem `href="/grupo-da-live"` (antes: `href="#"`)
- [x] Texto do botão ("QUERO PARTICIPAR DA LIVE →") e classes (`btn-cta inscricao__cta`) inalterados
- [x] Nenhum JS, evento de Lead, `target="_blank"` ou parâmetro extra adicionado ao link
- [x] Hero e seção final apontam para o mesmo destino (`/grupo-da-live`)
- [x] `npm run build` passa e, no preview, o clique no CTA final navega para `/grupo-da-live`

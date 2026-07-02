# 51: Página dedicada /consultoria-gratuita-atacado (só o chat, estilo Typebot)

**Tipo:** Implementação
**Página:** /consultoria-gratuita-atacado

## Descrição

Criar uma página que contém apenas o chat de captação da home, em tela cheia estilo Typebot: abre sozinho no load, sem header/footer e sem botão de fechar. Mesmo funil da home (`sessao-estrategica`).

## Cenários

### Happy Path
1. Visitante abre `/consultoria-gratuita-atacado` → o `<LeadChat>` abre automaticamente em tela cheia.
2. Responde as perguntas → submit vai ao `/tracker` (funil sessao-estrategica) → mesmo roteamento/redirect da home.

### Edge Cases
- Sem botão de fechar e sem fechar ao clicar no fundo (é uma página dedicada).
- Não afeta o uso do `<LeadChat>` na home/vsl (modo `fullPage` é opt-in, default false).

## Arquivos

- **Criar:** `src/pages/consultoria-gratuita-atacado.astro` — BaseLayout sem header/footer + `<LeadChat funnel="sessao-estrategica" fullPage={true} />`.
- **Modificar:** `src/components/LeadChat.astro` — prop `fullPage` (data-full-page + classe `lead-chat--full`); no script, auto-open no load e sem fechar por fundo; CSS esconde o `×`.

## Checklist

- [x] Prop `fullPage` no LeadChat (opt-in, não quebra a home)
- [x] Auto-open no load + sem fechar por backdrop quando fullPage
- [x] CSS esconde o botão de fechar em modo fullPage
- [x] Página nova usando BaseLayout sem header/footer
- [x] Build gera a rota /consultoria-gratuita-atacado

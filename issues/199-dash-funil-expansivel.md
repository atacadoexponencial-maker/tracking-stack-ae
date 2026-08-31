# 199: Funil expansível na tabela Conversão por LP

**Tipo:** Implementação
**Página:** public/dash/index.html
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 198

## Descrição

Fazer a linha da tabela "Conversão por LP" abrir o funil daquela página ao ser clicada, com número absoluto e percentual de passagem por degrau, maior queda destacada, e o asterisco com a data de início da coleta.

## Por que assim

Fechada, a tabela continua idêntica à de hoje. O asterisco fica só nos degraus novos (`CTAClick` e `FormStep`) e aparece apenas quando o período consultado começa antes do início da coleta — que é quando o número engana; depois some sozinho. Páginas com formulário de etapa única não exibem seção de etapas (não mostrar lista vazia).

## Checklist

- [x] Clique na linha abre o funil daquela LP; clicar de novo fecha
- [x] Absoluto, passagem sobre o degrau anterior e barra proporcional ao 1o degrau
- [x] Maior queda destacada em vermelho
- [x] Asterisco so nos degraus novos (`CTAClick` e etapas)
- [x] Nota com a data so quando o periodo comeca antes da coleta
- [x] Formulario de etapa unica nao exibe secao de etapas
- [x] Fechada, a tabela e identica a de antes
- [x] Verificado no navegador com dado real no D1 local

> **Divergencia consciente da spec:** o funil abre logo ABAIXO da tabela, nao
> como uma linha inserida dentro dela. Inserir a linha exigiria alterar a
> funcao `tabela()` do dash, compartilhada por todas as abas — risco
> desproporcional para um ganho apenas visual. O gatilho (clicar na linha) e o
> resultado (ver o funil daquela LP) sao os que a spec pediu.

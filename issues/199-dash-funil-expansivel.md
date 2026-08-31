# 199: Funil expansível na tabela Conversão por LP

**Tipo:** Implementação
**Página:** public/dash/index.html
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 198

## Descrição

Fazer a linha da tabela "Conversão por LP" abrir o funil daquela página ao ser clicada, com número absoluto e percentual de passagem por degrau, maior queda destacada, e o asterisco com a data de início da coleta.

## Por que assim

Fechada, a tabela continua idêntica à de hoje. O asterisco fica só nos degraus novos (`CTAClick` e `FormStep`) e aparece apenas quando o período consultado começa antes do início da coleta — que é quando o número engana; depois some sozinho. Páginas com formulário de etapa única não exibem seção de etapas (não mostrar lista vazia).

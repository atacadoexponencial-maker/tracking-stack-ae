# 351: Abas Funis do relatório e Testes A/B na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Funis do relatório e Testes A/B
**Spec:** `spec.md` (Módulos 13 e 14)

## Descrição

Reestilizar as duas abas de cadastro com os componentes da fundação: Funis do relatório com tabela de funis (chave de ativo e ordem), formulário "Novo funil"/"Editar funil" e bloco "Metas mensais" com um formulário por funil, erro em coral abaixo do campo, funil bloqueado apagado, avisos e histórico; Testes A/B com um sub-bloco por teste (tabela de variantes e veredito em carimbo) e formulário "Novo teste". Inclui a correção de comportamento da spec: encerrar um teste escolhe a vencedora na própria linha, sem `prompt()` do navegador.

## Pronto quando

- Na preview, as duas abas aparecem no mundo claro com os mesmos dados de produção.
- Cadastrar um funil o coloca na lista; salvar meta mostra confirmação; meta inválida mostra o erro embaixo do campo em coral.
- Cadastrar um teste com as duas páginas funciona; o veredito aparece em carimbo.
- Encerrar um teste escolhe a vencedora dentro da própria linha e nunca abre `prompt()` do navegador.

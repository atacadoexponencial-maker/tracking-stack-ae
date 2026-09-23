# 303: Troca de tema

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Ligar o botão de tema do cabeçalho: escuro por padrão, com opção de trocar para
claro, e a preferência lembrada na próxima visita.

## Escopo

- Escuro é o padrão, seguindo o `DESIGN.md`.
- O botão alterna para claro e de volta, e a tela troca na hora, sem recarregar.
- A preferência fica guardada e vale na próxima visita.
- O tema claro é legível de verdade: contraste de texto, de campo e de aviso
  conferidos, não só a cor de fundo invertida.
- O tema não afeta a saída: PDF e papel saem claros de qualquer jeito.
- A página não pisca no tema errado antes de aplicar o tema guardado.

## Pronto quando

Dá para clicar no botão e ver a página trocar entre escuro e claro na hora, nos
quatro blocos e no portão. Recarregar mantém o tema escolhido, sem piscar o
tema anterior antes. Imprimir no tema escuro produz a mesma folha clara que
imprimir no tema claro.

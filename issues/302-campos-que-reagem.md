# 302: Os campos que reagem

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

O comportamento dos campos que não é conta: escolha de narrativa, a Black VIP
que aparece e some, os campos de texto que crescem e a forma como cada tipo de
campo aceita o que a pessoa digita. É o que faz o preenchimento correr em duas
horas em vez de travar.

## Escopo

- **Narrativa é escolha de uma só.** Marcar uma das três do Pico 1 desmarca as
  outras; o mesmo no Pico 2. As duas escolhas são independentes entre si.
- **Narrativa própria prevalece.** Escrever no campo de narrativa própria
  desmarca a opção que estava escolhida naquele pico.
- **Black VIP condicional.** Responder "não" tira da tela o dia e o local da VIP;
  responder "sim" traz os dois de volta, com 11/11/2026 já posto.
- **Itens de oferta são marcação livre.** Sem limite, sem exclusão mútua, nos
  dois picos.
- **Campos de número recusam letra.**
- **Campos de dinheiro mostram o valor formatado em reais**, do jeito brasileiro.
- **Campos de texto longo crescem** conforme a pessoa escreve, sem barra de
  rolagem interna — vale para as dez semanas do bloco 3 e para os campos de
  condição, diferencial, 27/11 e as fases.
- **Todo campo de data é editável** e carrega o apoio "Data sugerida para 2026.
  Clique para trocar."
- **A data de hoje** do cabeçalho vem preenchida com o dia corrente e aceita
  troca.

## Pronto quando

Dá para escolher uma narrativa e ver a anterior desmarcar; escrever a narrativa
própria e ver a escolha cair; responder "não" para a Black VIP e ver os dois
campos sumirem, e "sim" e vê-los voltar com a data posta. Escrever num campo de
semana faz a caixa crescer em vez de rolar. Um campo de dinheiro mostra
R$ 12.500,00 depois de digitado, e um campo de peças não aceita letra.

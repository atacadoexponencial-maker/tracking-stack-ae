# 301: As contas do planner

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Ligar os números. São três contas derivadas e dois amarrados entre blocos — o
que transforma o planner de formulário em ferramenta, e o que faz a promessa da
página de vendas virar número na tela.

## Escopo

**A soma da base (bloco 1).** Ativos hoje + revendedores novos + inativos
reativados. Soma pura: nenhum percentual, nenhuma projeção. Recalcula a cada
tecla. Campo vazio conta como zero e a conta continua aparecendo sem quebrar. O
painel mostra o total e a frase que compara com a base de hoje.

**As faixas do desconto progressivo (bloco 2).** A coluna "Se comprar" é o
mínimo reduzido, o dobro e o triplo, recalculada a cada tecla. Sem mínimo
reduzido preenchido, as faixas mostram lacuna em vez de número e a tabela
continua legível. Os percentuais vêm com 5%, 10% e 15% e são editáveis.

**O aviso de margem (bloco 2).** Quando um desconto encosta ou passa a margem
bruta declarada, aparece "Seu desconto de [x]% passa da margem de [y]% que você
escreveu. Confere antes de seguir." O aviso não bloqueia nada. Corrigir o
desconto ou a margem faz ele sumir. Sem margem preenchida não há aviso, porque
não há régua para comparar.

**O pedido mínimo atravessando (bloco 1 → bloco 2).** O que for digitado no
pedido mínimo de primeira compra aparece sozinho no bloco 2, em campo só de
leitura.

**O nome da marca atravessando (cabeçalho → bloco 2).** As seis narrativas
sugeridas mostram um marcador de lacuna até a marca ser nomeada, e passam a
mostrar o nome assim que ele é escrito.

## Pronto quando

Digitar 40 ativos, 60 novos e 20 reativados faz o painel dizer 120 na hora.
Digitar 30 no mínimo reduzido faz a tabela mostrar 30, 60 e 90. Escrever margem
de 12% com desconto de 15% faz o aviso aparecer, e subir a margem para 20% faz
ele sumir. O pedido mínimo do bloco 1 aparece no bloco 2 sem ser redigitado, e
escrever o nome da marca no topo muda as seis narrativas de uma vez.

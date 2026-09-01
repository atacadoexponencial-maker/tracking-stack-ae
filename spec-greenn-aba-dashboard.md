# Spec: Aba Greenn no Dashboard

## Visão Geral

Uma aba nova no dashboard, dedicada às vendas do produto que roda na Greenn
(hoje, o Workshop Black Exponencial). Ela responde a uma pergunta que hoje não
tem resposta em lugar nenhum: **quanto o workshop pago arrecadou, quanto custou
para arrecadar isso, e qual campanha está pagando a conta.**

**Para quem é:** a usuária do dashboard, que decide diariamente se mantém,
aumenta ou desliga o investimento nos anúncios do workshop.

**Qual problema resolve.** As vendas da Greenn chegam corretamente e ficam
guardadas com atribuição completa — campanha, criativo, origem — mas nenhuma
tela as lê. Os números de receita do dashboard vêm de outra fonte, que não é
alimentada pela Greenn e hoje está vazia. Resultado: quem olha o dashboard vê
"aguardando conversões do CRM" enquanto o produto vende. A única visibilidade
existente é o card avulso no CRM, que não soma, não compara com investimento e
não separa por campanha.

**Por que uma aba separada.** O produto da Greenn é um ciclo à parte do resto do
negócio: ticket baixo, compra imediata, sem formulário e sem passagem pelo
comercial. Misturar essa receita com a do produto principal contaminaria as duas
leituras — o volume de vendas viria do produto barato e o valor viria do caro,
e nenhuma das duas médias diria qualquer coisa útil. A aba é isolada de
propósito.

### O que a aba vai revelar já no primeiro acesso

Com os dados de hoje (01/09), a aba mostra um fato que estava invisível: a
primeira campanha do workshop investiu **R$ 305,92** e devolveu **R$ 81,00** —
ROAS de 0,26, ou seja, cada real investido voltou como 26 centavos. A campanha
nova, no ar há dois dias, está em ROAS 1,66. Esse contraste é a razão de ser da
tela.

### Decisões tomadas na criação

1. **Vendas de teste da própria equipe não aparecem.** Duas das seis vendas
   registradas são testes feitos pela própria conta durante a construção da
   página. Elas somam R$ 54 — 50% a mais sobre a receita real — e distorceriam
   tanto o total quanto o ROAS. Ficam fora de todos os números e de todas as
   listas da aba, sem linha de menção. (Decisão da usuária: "excluir e não
   mostrar".) O dado permanece intacto no banco; o que muda é só a exibição.

2. **Cada campanha é lida pelo seu ciclo inteiro, não pelo filtro de datas do
   topo.** Uma campanha investe em dias que nem sempre coincidem com os dias em
   que as vendas caem. Sob um filtro de "últimos 7 dias", uma campanha que
   gastou há duas semanas apareceria com investimento zero e ROAS infinito. Por
   isso cada linha soma todo o investimento e toda a receita daquela campanha,
   do primeiro dia até hoje. (Decisão da usuária.) A tela deve deixar isso
   explícito para quem lê, porque diverge do comportamento das outras abas.

3. **Só venda paga entra na receita.** Reembolsos, recusas e carrinhos
   abandonados não somam receita. Quando existirem, aparecem contados à parte,
   nunca misturados ao arrecadado.

---

## Páginas / Módulos

### Módulo 1 — Origem dos dados de venda

**Descrição:** Reúne, a partir do que já está guardado, o conjunto de vendas do
produto da Greenn com sua atribuição de origem. É a base que alimenta todo o
resto da aba; não tem tela própria.

**Componentes:**

- **Venda:** cada compra registrada, com data, valor, forma de pagamento, nome
  do comprador e status (paga, reembolsada, recusada).
- **Atribuição da venda:** a campanha, o criativo, a origem e a mídia que
  levaram aquela pessoa até a página de vendas. Vem do rastreamento gravado no
  momento da visita e devolvido pela plataforma de checkout junto com a compra.
- **Venda sem atribuição:** compra que aconteceu sem nenhuma campanha
  identificada — acesso direto, link compartilhado, indicação. É um grupo
  legítimo e precisa de um rótulo próprio, nunca ser tratada como erro ou
  descartada.
- **Venda de teste interno:** compra feita pela própria equipe. Identificada por
  uma lista explícita de endereços de e-mail conhecidos, mantida em um único
  lugar e fácil de estender quando houver novo teste. Não pode ser por domínio:
  os testes foram feitos de um endereço pessoal comum, e excluir o domínio
  inteiro apagaria clientes reais.

**Comportamentos:**

- Reunir todas as vendas do produto da Greenn.
- Excluir do conjunto toda venda identificada como teste interno.
- Separar as vendas pagas das não pagas.
- Associar cada venda à sua campanha de origem.
- Marcar como "sem campanha" a venda cuja origem não foi identificada.
- Continuar funcionando quando a atribuição de uma venda não for encontrada —
  a venda entra na receita mesmo assim, apenas sem campanha.

---

### Módulo 2 — Cruzamento com investimento

**Descrição:** Casa cada campanha que vendeu com quanto foi investido nela, para
produzir o retorno. Não tem tela própria.

**Componentes:**

- **Investimento por campanha:** o total gasto em anúncios naquela campanha,
  desde o primeiro dia dela.
- **Campanha sem venda:** campanha que teve investimento mas nenhuma venda. Não
  pode sumir da tela — é justamente o caso que mais importa ver.
- **Campanha sem investimento:** origem que trouxe venda sem gasto associado,
  como tráfego orgânico ou o próprio grupo. Aparece com investimento zerado e
  sem retorno calculado.

**Comportamentos:**

- Somar o investimento de cada campanha do produto ao longo de todo o seu ciclo.
- Casar cada campanha investida com as vendas que vieram dela.
- Calcular o retorno de cada campanha: receita dividida por investimento.
- Calcular o custo por venda de cada campanha: investimento dividido por número
  de vendas.
- Exibir o retorno como indisponível — nunca como zero ou infinito — quando a
  campanha não tiver investimento registrado.
- Manter na lista as campanhas que investiram e não venderam.

---

### Módulo 3 — Aba Greenn

**Descrição:** A tela em si, acessível pelo menu lateral do dashboard, ao lado
das abas existentes. Mostra o resultado do produto pago em três blocos: o
resumo, o desempenho por campanha e a lista de vendas.

**Componentes:**

- **Indicador de receita:** total arrecadado em vendas pagas.
- **Indicador de vendas:** quantidade de vendas pagas.
- **Indicador de ticket médio:** valor médio por venda.
- **Indicador de investimento:** total investido nas campanhas do produto.
- **Indicador de retorno geral:** receita total dividida por investimento total.
- **Aviso de período:** texto curto e visível explicando que os números desta
  aba consideram o ciclo inteiro de cada campanha e não seguem o filtro de datas
  do topo do dashboard.
- **Tabela de campanhas:** uma linha por campanha, com nome, investimento,
  receita, número de vendas, retorno e custo por venda.
- **Destaque de campanha no prejuízo:** sinal visual na linha cujo retorno é
  menor que 1, isto é, que gastou mais do que trouxe.
- **Tabela de vendas:** uma linha por venda paga, com data, nome do comprador,
  valor, forma de pagamento, campanha e criativo de origem.
- **Estado vazio:** mensagem clara quando ainda não houver nenhuma venda,
  distinguindo "nenhuma venda ainda" de "falha ao carregar".
- **Estado de erro:** mensagem quando os dados não puderem ser carregados, sem
  deixar a tela em branco nem exibir números falsos.

**Comportamentos:**

- Abrir a aba Greenn pelo menu lateral.
- Ver a receita total do produto pago.
- Ver a quantidade de vendas pagas.
- Ver o ticket médio das vendas.
- Ver o total investido em anúncios do produto.
- Ver o retorno geral sobre o investimento.
- Ler o aviso de que a aba não segue o filtro de datas do topo.
- Ver a lista de campanhas com o desempenho de cada uma.
- Identificar visualmente quais campanhas estão dando prejuízo.
- Ordenar a tabela de campanhas por qualquer coluna numérica.
- Ver a lista das vendas individuais.
- Identificar, em cada venda, de qual campanha e de qual criativo ela veio.
- Ordenar a tabela de vendas por data ou por valor.
- Distinguir vendas vindas de campanha das vendas sem origem identificada.
- Ver uma mensagem explicativa quando não houver vendas no período.
- Ver uma mensagem de erro quando o carregamento falhar.
- Continuar navegando para as outras abas sem que esta interfira nos números
  delas.
- Voltar para a aba Greenn por link direto, sem perder o estado de qual aba está
  aberta.

---

## Fora de escopo

Registrado explicitamente para não virar decisão silenciosa durante a
implementação:

- **Não** unificar a receita da Greenn com a receita do produto principal, nem
  alimentar a contabilidade existente com essas vendas.
- **Não** enviar essas vendas para plataformas de anúncio como conversão.
- **Não** criar card no CRM — isso já acontece hoje e continua como está.
- **Não** alterar a página de vendas nem o recebimento das compras: a captura
  funciona e não é tocada.
- **Não** exibir carrinhos abandonados nesta entrega.

# Spec: Uso da Cloudflare no dash (requisições por dia contra o teto)

> série: S1
> estado: aprovada em 15/10/2026

## Visão Geral

**O que faz.** Cria no dash uma aba "Cloudflare" que mostra quantas requisições de Functions a conta consumiu hoje, nos últimos 30 dias e no mês corrente, comparando o dia com o teto diário do plano. Mostra também, por dia, quantas requisições morreram por estourar o limite de CPU, que são os 503/1102 que aparecem desde 04/10.

**Para quem.** A gestora (Marcelle), que hoje só descobre que o limite apertou quando o dash ou um webhook quebra.

**Qual problema resolve.** O consumo e os estouros só podem ser vistos hoje por consulta manual à API da Cloudflare, feita numa sessão com o agente. Depois da pausa dos crons de e-mail e do agenda-sync em 13/10, não há como ela acompanhar sozinha se o consumo caiu, se os estouros sumiram e quanta folga resta antes do teto.

**Fatos que a tela respeita (decididos com ela em 15/10):**

- O plano da conta é o **Free**. O teto é de **100 mil requisições de Functions por dia**, somando **todos os projetos da conta** (tracking-ae, painel e qualquer Worker), e zera à meia-noite UTC, **21h no horário de Brasília**.
- O Free **não tem limite mensal**. O mês aparece só como acumulado, sem comparação.
- Conta só **Functions**: requisições que rodam código. Arquivo estático servido direto, sem passar por código, não entra.
- O limite de CPU (10 ms por requisição no Free) não é um volume. A tela mostra **quantas requisições estouraram** esse limite, não a CPU em si.

---

## Páginas / Módulos

### 1. Aba "Cloudflare" no dash

**Descrição:** Aba nova do dash, aberta com a mesma chave das outras abas. Tem quatro blocos: hoje, por projeto, últimos 30 dias e mês corrente.

**Componentes:**
- **Hoje contra o teto:** total da conta no dia atual (dia que zera às 21h de Brasília), a barra contra 100 mil, a porcentagem usada e o horário em que o contador zera. A barra muda de cor conforme a folga: verde até 60%, amarelo de 60% a 80% e vermelho acima de 80%, sempre com uma palavra junto (a cor sozinha não basta).
- **Por projeto:** abaixo da barra, quanto cada projeto da conta consumiu hoje, do maior para o menor.
- **Últimos 30 dias:** para cada dia, o total da conta, o teto de 100 mil como referência e quantas requisições estouraram a CPU naquele dia.
- **Mês corrente:** total acumulado de requisições do mês e total de estouros de CPU do mês.
- **Rodapé de origem:** horário da última leitura dos números na Cloudflare.

**Comportamentos:**
- **Abrir a aba:** a gestora entra na aba e vê os quatro blocos preenchidos com os números mais recentes disponíveis.
- **Ver a folga de hoje:** a gestora lê na barra quanto do teto diário já foi usado e quanto resta.
- **Perceber que o teto está perto:** a cor da barra e a palavra ao lado mudam conforme a porcentagem usada.
- **Ver quem consome:** a gestora vê quais projetos puxam o consumo do dia.
- **Comparar os dias:** a gestora vê o consumo e os estouros dia a dia, o que mostra, por exemplo, se a pausa de 13/10 derrubou o consumo.
- **Ver o mês:** a gestora vê o total do mês corrente.
- **Saber de quando é o número:** a gestora vê o horário da última leitura.
- **Abrir sem a chave:** quem tenta ler os números sem a chave do dash não recebe nada.
- **Cloudflare fora do ar ou credencial inválida:** a aba avisa que os números estão indisponíveis e não mostra zero no lugar.

**Critérios de aceite:**

#### CA-S1-01 — A barra de hoje soma todos os projetos da conta · prova: automática

- **Dado** que hoje (dia UTC) o tracking-ae fez 30.000 requisições de Functions e o painel fez 5.000
- **Quando** a gestora abre a aba Cloudflare
- **Então** a barra de hoje mostra 35.000 de 100.000 (35%), e não só o número do tracking-ae

#### CA-S1-02 — O dia da barra é o dia que o teto usa · prova: automática

- **Dado** que são 21h30 de Brasília (00h30 UTC), o dia que terminou às 21h teve 80.000 requisições e houve 500 desde as 21h
- **Quando** a gestora abre a aba
- **Então** a barra de hoje mostra 500, e as 80.000 aparecem no dia anterior da lista dos 30 dias. A aba informa que o contador zera às 21h de Brasília

#### CA-S1-03 — Consumo de hoje separado por projeto · prova: automática

- **Dado** que hoje o tracking-ae fez 30.000 requisições e o painel 5.000
- **Quando** a gestora abre a aba
- **Então** abaixo da barra aparecem "tracking-ae 30.000" e depois "painel 5.000", do maior para o menor, e os valores somam o total da barra

#### CA-S1-04 — Lista dos últimos 30 dias com total e estouros de CPU · prova: automática

- **Dado** que em 12/10 a conta fez 9.649 requisições, das quais 874 estouraram a CPU
- **Quando** a gestora abre a aba
- **Então** a linha de 12/10 mostra 9.649 requisições e 874 estouros, os 30 dias mais recentes aparecem e o teto de 100 mil aparece como referência

#### CA-S1-05 — Dia sem nenhuma requisição aparece como zero · prova: automática

- **Dado** que a Cloudflare não devolveu nenhuma requisição para um dos últimos 30 dias, mas a leitura deu certo
- **Quando** a gestora abre a aba
- **Então** esse dia aparece com 0 requisições e 0 estouros, e não some da lista

#### CA-S1-06 — Total acumulado do mês sem comparação com limite · prova: automática

- **Dado** que de 1º até hoje a conta somou 150.000 requisições e 3.000 estouros de CPU
- **Quando** a gestora abre a aba
- **Então** o bloco do mês mostra 150.000 requisições e 3.000 estouros, sem barra nem porcentagem de limite

#### CA-S1-07 — Horário da última leitura visível · prova: automática

- **Dado** que os números foram lidos da Cloudflare às 14h05 de Brasília
- **Quando** a gestora abre a aba
- **Então** o rodapé mostra "lido às 14:05" (horário de Brasília)

#### CA-S1-08 — Abrir a aba várias vezes não gera consulta nova a cada abertura · prova: automática

- **Dado** que os números foram lidos da Cloudflare há menos de 15 minutos
- **Quando** a aba é aberta de novo
- **Então** os números vêm da última leitura, a Cloudflare não é consultada outra vez e o horário do rodapé não muda

#### CA-S1-09 — Sem a chave do dash não há números · prova: automática

- **Dado** que alguém pede os números de uso sem a chave do dash, ou com uma chave errada
- **Quando** o pedido chega
- **Então** a resposta é recusa de acesso e não traz nenhum número

#### CA-S1-10 — Falha na Cloudflare aparece como indisponível, nunca como zero · prova: automática

- **Dado** que a Cloudflare está fora do ar, recusou a credencial ou devolveu erro
- **Quando** a gestora abre a aba
- **Então** a aba diz que os números de uso estão indisponíveis e por quê (ex.: "credencial recusada"), e nenhum bloco mostra 0

#### CA-S1-13 — A barra muda de cor perto do teto · prova: automática

- **Dado** que o consumo de hoje é de 59.999, 60.000, 80.000 ou 80.001 requisições
- **Quando** a gestora abre a aba
- **Então** a barra fica verde em 59.999, amarela em 60.000 e em 80.000 e vermelha em 80.001, com a palavra "folga", "atenção" ou "perto do teto", nessa ordem

#### CA-S1-11 — Os números batem com o painel da Cloudflare · prova: manual

- **Dado** que a aba está no ar com a credencial de produção
- **Quando** a gestora compara o total de ontem e o de hoje da aba com a página de uso de Workers & Pages no painel da Cloudflare
- **Então** os números são iguais, com tolerância de alguns minutos de atraso

#### CA-S1-12 — A aba segue o visual do dash · prova: manual

- **Dado** que a aba está no ar
- **Quando** a gestora abre no computador e no celular
- **Então** a aba segue a direção "Etiqueta" do dash, a barra e a lista dos 30 dias são legíveis nos dois e não há rolagem lateral

---

## Fora de escopo

- Aviso no Slack quando o consumo chegar perto do teto (decisão dela em 15/10).
- Total de requisições do domínio, incluindo arquivo estático (decisão dela em 15/10: só Functions).
- Comparar o mês com algum limite mensal: o Free não tem (decisão dela em 15/10).
- Reduzir o consumo: `_routes.json`, crons, bloqueio de bots. Continua como proposta separada, nada decidido.
- Trocar de plano.
- Mostrar CPU por requisição (média, percentis) ou tempo de resposta.
- Histórico além de 30 dias.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | Números com até 15 minutos de atraso servem para o uso dela (a aba não precisa de tempo real). | confirmada | Marcelle, 15/10 |
| SUP-S1-02 | O mês corrente e os dias da lista seguem o relógio UTC, o mesmo do teto. Um dia na lista vai das 21h de Brasília do dia anterior até as 21h. | confirmada | Marcelle, 15/10 |
| SUP-S1-03 | Ela cria na Cloudflare uma credencial só de leitura de Analytics da conta, que fica guardada no servidor. A credencial que o agente usa nas investigações vence em poucas horas e não serve. | confirmada | Marcelle, 15/10: ela cria a credencial |
| SUP-S1-04 | As chamadas dos crons da VPS contam como requisições de Functions e aparecem misturadas ao resto, sem separação própria. | confirmada | Marcelle, 15/10 |
| SUP-S1-05 | A barra de hoje não muda de cor nem dá alerta perto do teto. Mostra só número e porcentagem. | invalidada | Marcelle, 15/10: a barra muda de cor (verde até 60%, amarelo de 60% a 80%, vermelho acima de 80%), ver CA-S1-13 |
| SUP-S1-06 | O teto de 100 mil aparece como texto no título do gráfico dos 30 dias ("teto: 100.000 por dia"), não como linha no gráfico: com os dias em torno de 10 mil, uma linha em 100 mil achataria as barras até ficarem ilegíveis. Os estouros de CPU aparecem como barras vermelhas para baixo no mesmo gráfico. | aberta | — |
| SUP-S1-07 | O nome de cada projeto vem de uma tabela fixa no servidor (tracking-ae, painel-atacadoexponencial), porque a credencial de Analytics não lê a lista de projetos do Pages. Projeto novo aparece com o nome técnico da Cloudflare até entrar na tabela. A versão de prévia de um projeto aparece separada, como "tracking-ae (prévia)", porque também conta no teto. | confirmada | Marcelle, 15/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-01 | Qual é o plano da conta? | respondida | Free, 100 mil por dia. Marcelle, 15/10 |
| PER-S1-02 | O que conta como requisição? | respondida | Só Functions. Marcelle, 15/10 |
| PER-S1-03 | Mostrar os estouros de CPU? | respondida | Sim, por dia. Marcelle, 15/10 |
| PER-S1-04 | Onde fica no dash? | respondida | Aba nova "Cloudflare". Marcelle, 15/10 |
| PER-S1-05 | Contra o que comparar o mês? | respondida | Nada, só o acumulado. Marcelle, 15/10 |
| PER-S1-06 | Alerta no Slack? | respondida | Não, só a tela. Marcelle, 15/10 |
| PER-S1-07 | Total da conta ou só o tracking-ae? | respondida | Total da conta e o consumo de cada projeto. Marcelle, 15/10 |

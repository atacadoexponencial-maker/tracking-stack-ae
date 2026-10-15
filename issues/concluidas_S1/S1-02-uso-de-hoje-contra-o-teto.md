# S1-02: Uso de hoje contra o teto, com números reais

**Tipo:** Implementação
**Página:** Aba "Cloudflare" do dash
**Spec:** `spec-uso-cloudflare.md`

## Descrição

Ler da Cloudflare o consumo de Functions de hoje da conta inteira, guardar a leitura por 15 minutos e ligar os blocos "Hoje contra o teto", "Por projeto" e o rodapé de origem do protótipo a esses números reais, protegidos pela chave do dash.

## Pronto quando

A gestora abre a aba "Cloudflare" e vê o consumo real de hoje da conta contra 100 mil, com a cor da folga, quanto cada projeto consumiu e o horário da última leitura. Se a Cloudflare falhar, a aba diz que está indisponível e por quê. Os blocos de 30 dias e do mês continuam com o exemplo do protótipo.

## Critérios de aceite

- **CA-S1-01** (automática) — A barra de hoje soma todos os projetos da conta. Dado que hoje (dia UTC) o tracking-ae fez 30.000 requisições de Functions e o painel fez 5.000, quando a gestora abre a aba Cloudflare, então a barra de hoje mostra 35.000 de 100.000 (35%), e não só o número do tracking-ae.
- **CA-S1-03** (automática) — Consumo de hoje separado por projeto. Dado que hoje o tracking-ae fez 30.000 requisições e o painel 5.000, quando a gestora abre a aba, então abaixo da barra aparecem "tracking-ae 30.000" e depois "painel 5.000", do maior para o menor, e os valores somam o total da barra.
- **CA-S1-07** (automática) — Horário da última leitura visível. Dado que os números foram lidos da Cloudflare às 14h05 de Brasília, quando a gestora abre a aba, então o rodapé mostra "lido às 14:05" (horário de Brasília).
- **CA-S1-08** (automática) — Abrir a aba várias vezes não gera consulta nova a cada abertura. Dado que os números foram lidos da Cloudflare há menos de 15 minutos, quando a aba é aberta de novo, então os números vêm da última leitura, a Cloudflare não é consultada outra vez e o horário do rodapé não muda.
- **CA-S1-09** (automática) — Sem a chave do dash não há números. Dado que alguém pede os números de uso sem a chave do dash, ou com uma chave errada, quando o pedido chega, então a resposta é recusa de acesso e não traz nenhum número.
- **CA-S1-10** (automática) — Falha na Cloudflare aparece como indisponível, nunca como zero. Dado que a Cloudflare está fora do ar, recusou a credencial ou devolveu erro, quando a gestora abre a aba, então a aba diz que os números de uso estão indisponíveis e por quê (ex.: "credencial recusada"), e nenhum bloco mostra 0.
- **CA-S1-13** (automática) — A barra muda de cor perto do teto. Dado que o consumo de hoje é de 59.999, 60.000, 80.000 ou 80.001 requisições, quando a gestora abre a aba, então a barra fica verde em 59.999, amarela em 60.000 e em 80.000 e vermelha em 80.001, com a palavra "folga", "atenção" ou "perto do teto", nessa ordem.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | Números com até 15 minutos de atraso servem para o uso dela (a aba não precisa de tempo real). | confirmada | Marcelle, 15/10 |
| SUP-S1-03 | Ela cria na Cloudflare uma credencial só de leitura de Analytics da conta, que fica guardada no servidor. A credencial que o agente usa nas investigações vence em poucas horas e não serve. | confirmada | Marcelle, 15/10: ela cria a credencial |
| SUP-S1-04 | As chamadas dos crons da VPS contam como requisições de Functions e aparecem misturadas ao resto, sem separação própria. | confirmada | Marcelle, 15/10 |
| SUP-S1-05 | A barra de hoje não muda de cor nem dá alerta perto do teto. Mostra só número e porcentagem. | invalidada | Marcelle, 15/10: a barra muda de cor (verde até 60%, amarelo de 60% a 80%, vermelho acima de 80%), ver CA-S1-13 |
| SUP-S1-07 | O nome de cada projeto vem de uma tabela fixa no servidor (tracking-ae, painel-atacadoexponencial), porque a credencial de Analytics não lê a lista de projetos do Pages. Projeto novo aparece com o nome técnico da Cloudflare até entrar na tabela. A versão de prévia de um projeto aparece separada, como "tracking-ae (prévia)", porque também conta no teto. | confirmada | Marcelle, 15/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-01 | Qual é o plano da conta? | respondida | Free, 100 mil por dia. Marcelle, 15/10 |
| PER-S1-02 | O que conta como requisição? | respondida | Só Functions. Marcelle, 15/10 |
| PER-S1-06 | Alerta no Slack? | respondida | Não, só a tela. Marcelle, 15/10 |
| PER-S1-07 | Total da conta ou só o tracking-ae? | respondida | Total da conta e o consumo de cada projeto. Marcelle, 15/10 |

## Cenários

### Happy Path
1. A gestora abre a aba Cloudflare. O dash chama `GET /api/cloudflare-uso?key=…`.
2. O servidor confere a chave do dash na primeira linha.
3. Se há leitura guardada há menos de 15 minutos, devolve essa leitura sem consultar a Cloudflare.
4. Senão, consulta a API GraphQL da Cloudflare (conta `1f66a02c2442fa044eea07c5c1ec5ea2`, credencial `CF_ANALYTICS_TOKEN`) pedindo, de 00:00 UTC de hoje até agora, a soma de `requests` por `scriptName` em `pagesFunctionsInvocationsAdaptiveGroups` (Pages Functions) e em `workersInvocationsAdaptive` (Workers soltos, hoje nenhum).
5. Soma por projeto, traduz o nome técnico (`pages-worker--14963629-production` → `tracking-ae`), ordena do maior para o menor e calcula total, porcentagem do teto, faixa (`folga` abaixo de 60.000, `atencao` de 60.000 a 80.000, `perto` acima de 80.000) e a palavra da faixa. Guarda a leitura com o horário (em Brasília, "HH:MM") e devolve.
6. O dash desenha a etiqueta, a régua com a cor da faixa, o carimbo com a palavra, a tabela por projeto e o rodapé "lido às HH:MM". Os blocos de 30 dias e do mês continuam de exemplo, marcados como exemplo (são da S1-03).

### Edge Cases
- **Nenhuma requisição hoje** (logo depois das 21h): a resposta da Cloudflare vem vazia; o total é 0, a faixa é folga e a lista por projeto fica vazia com "nenhuma requisição desde as 21h". Isso é leitura que deu certo, então 0 é verdade.
- **Projeto desconhecido:** entra na lista com o nome técnico.
- **Mesmo projeto em várias linhas** (um status por linha, como `success` e `exceededResources`): tudo é somado no mesmo projeto.

### Cenário de Erro
- **Credencial ausente** no ambiente: "credencial da Cloudflare não configurada".
- **Credencial recusada** (HTTP 401/403 ou erro de autenticação no corpo do GraphQL): "credencial recusada pela Cloudflare".
- **Cloudflare fora do ar** (erro de rede, HTTP 5xx ou corpo inválido): "a Cloudflare não respondeu".
- Em qualquer falha a resposta é `{ indisponivel: true, motivo }`, sem nenhum campo de número, e **não é guardada**: a próxima abertura tenta de novo. O dash mostra só o aviso "Números de uso indisponíveis: <motivo>." e esconde todos os blocos, inclusive os de exemplo.

## Prova

Os critérios dizem "quando a gestora abre a aba", e quem decide cada número, cor e palavra é o servidor; a tela só copia. Por isso os testes conferem a resposta de `/api/cloudflare-uso` (com a Cloudflare simulada), que é exatamente o que a aba exibe.

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S1-01 | automática | `tests/cloudflare-uso.test.js` | tracking-ae 30.000 e painel 5.000 dão total 35.000, teto 100.000 e 35% |
| CA-S1-03 | automática | `tests/cloudflare-uso.test.js` | a lista por projeto vem como tracking-ae 30.000 e depois painel 5.000, e soma o total |
| CA-S1-07 | automática | `tests/cloudflare-uso.test.js` | leitura feita às 17:05 UTC traz `lido_as` "14:05" |
| CA-S1-08 | automática | `tests/cloudflare-uso.test.js` | segunda leitura 10 min depois não chama a Cloudflare e devolve o mesmo `lido_as`; 16 min depois chama de novo |
| CA-S1-09 | automática | `tests/cloudflare-uso.test.js` | sem `key` e com `key` errada o handler responde 401 e o corpo não tem números |
| CA-S1-10 | automática | `tests/cloudflare-uso.test.js` | Cloudflare fora do ar, 401 e erro de autenticação no GraphQL dão `indisponivel` com o motivo certo, nenhum campo numérico, e a falha não fica guardada |
| CA-S1-13 | automática | `tests/cloudflare-uso.test.js` | 59.999 → folga/"folga", 60.000 e 80.000 → atencao/"atenção", 80.001 → perto/"perto do teto" |

## Banco de Dados

Nenhum. A leitura fica no cache da Cloudflare (`caches.default`), por 15 minutos, sem tocar no D1.

## Arquivos

- **Criar:** `functions/api/_cloudflare-uso.js` — regras: teto, faixas e palavras, tabela de nomes de projeto, consulta GraphQL, soma por projeto, horário em Brasília, tradução de falhas em motivo e o cache de 15 minutos (cache e `fetch` injetáveis para teste; sem `caches` no node, segue sem cache).
- **Criar:** `functions/api/cloudflare-uso.js` — rota `GET /api/cloudflare-uso`: `recusarSemChave` de `_argo-auth.js` na primeira linha e devolve o resultado de `_cloudflare-uso.js`.
- **Criar:** `tests/cloudflare-uso.test.js` — testes da tabela Prova.
- **Modificar:** `public/dash/cloudflare.js` — tira os exemplos de hoje e por projeto e o seletor de estado; busca `/api/cloudflare-uso` via `ctx.api` e desenha o que vier; mantém 30 dias e mês com exemplo, marcados como exemplo; em falha, só o aviso.
- **Modificar:** `public/dash/index.html` — `R.cloudflare` passa `api: saudeApi` no ctx e trata erro de carga como as outras abas.

Reaproveitados: `recusarSemChave` (`functions/api/_argo-auth.js`), `FUSO_BRT` (`functions/api/_data-brt.js`), `saudeApi` (index.html).

## Dependências Externas

- API GraphQL de Analytics da Cloudflare (`https://api.cloudflare.com/client/v4/graphql`), datasets `pagesFunctionsInvocationsAdaptiveGroups` e `workersInvocationsAdaptive`, conferidos com a credencial nova em 15/10 (14/10: tracking-ae 7.848, painel 4).
- Secret `CF_ANALYTICS_TOKEN` no Pages (produção), gravado em 15/10.

## Checklist

- [x] Criar `functions/api/_cloudflare-uso.js`
- [x] Criar `functions/api/cloudflare-uso.js`
- [x] Ligar `public/dash/cloudflare.js` e `R.cloudflare` à rota
- [x] Escrever `tests/cloudflare-uso.test.js` e rodar a suíte
- [x] Publicar e conferir a aba no ar com números reais

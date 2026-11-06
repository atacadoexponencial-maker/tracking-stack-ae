# S6-02: Funil do dash pelo nome da pergunta

**Tipo:** Implementação
**Página:** Dash, Conversão por LP (funil ao expandir a página)
**Spec:** `spec-etapas-com-nome.md`

## Descrição

O funil de micro-conversões passa a agrupar e rotular as etapas pelo nome da pergunta, na ordem atual do formulário, e marca com aviso de data a etapa que começou a ser medida dentro do período.

## Pronto quando

A usuária abre a Conversão por LP nos últimos 30 dias, expande a home e vê "responderam o faturamento", "responderam o cargo" (com "medida desde 05/11") e "responderam o desafio" com o período inteiro somado.

## Critérios de aceite

- **CA-S6-11** (automática) — O funil mostra o nome da pergunta. Dado etapas concluídas do chat com os nomes "faturamento" e "cargo", quando o funil da página é montado, então os degraus aparecem como "responderam o faturamento" e "responderam o cargo", e não como "concluíram a etapa 5" e "concluíram a etapa 6".
- **CA-S6-12** (automática) — A mesma pergunta soma o período todo, mesmo mudando de posição. Dado 10 pessoas que responderam o desafio quando ele era a etapa 6 e 5 que responderam quando ele passou a ser a etapa 7, quando o funil do período que cobre as duas fases é montado, então o degrau "responderam o desafio" mostra 15.
- **CA-S6-13** (automática) — Os degraus seguem a ordem atual do formulário. Dado um período com etapas do chat antes e depois da entrada do cargo, quando o funil é montado, então o cargo aparece entre o faturamento e o desafio.
- **CA-S6-14** (automática) — Etapa nova no período aparece com aviso e sem comparação. Dado um período que começa antes de 05/11 e termina depois, quando o funil do chat é montado, então o degrau do cargo aparece com o aviso "medida desde 05/11", não tem percentual de passagem, não é apontado como a maior queda e não altera os números dos degraus vizinhos.
- **CA-S6-15** (automática) — Período todo depois da mudança mostra o cargo normalmente. Dado um período que começa depois de 05/11 20h32, quando o funil do chat é montado, então o degrau do cargo aparece sem aviso e com percentual de passagem como os outros.
- **CA-S6-16** (automática) — Etapa sem nome continua aparecendo. Dado uma etapa concluída que ficou sem nome (CA-S6-06), quando o funil é montado, então ela aparece como "concluíram a etapa N", como antes, e não some.
- **CA-S6-17** (manual) — Conferência no ar. Dado a mudança no ar e a carga do histórico feita, quando a usuária abre a Conversão por LP nos últimos 30 dias e expande a home, então vê as etapas com o nome das perguntas, o cargo entre o faturamento e o desafio com o aviso de data, e o número do desafio coerente com o período inteiro.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S6-01 | Os nomes internos das etapas são: chat = nome, whatsapp, email, instagram, faturamento, cargo, desafio; cartão = contato, perfil. No dash aparecem como "responderam o …" (chat) e "preencheram o contato / o perfil" (cartão). | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-04 | A "data em que começou a ser medida" de cada etapa é a primeira vez que aquele nome aparece no banco para aquela página, e não uma data escrita à mão. | confirmada | Usuária, 05/11 (aprovação da spec) |
| SUP-S6-05 | Nome de etapa que o dash não conhece (pergunta nova sem rótulo cadastrado) aparece como "responderam: <nome>", em vez de sumir ou virar "etapa N". | confirmada | Usuária, 06/11 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S6-01 | Num período que cruza 05/11, como a etapa do cargo aparece? | respondida | Aparece com aviso "medida desde 05/11" e sem comparação com as vizinhas (usuária, 05/11) |

## Cenários

### Happy Path
1. O dash pede `/api/conversion` (tabela Conversão por LP).
2. O backend conta as sessões por página, posição e nome da etapa, e guarda também quando cada grupo foi visto pela última vez. Uma segunda consulta pega, por página e nome, a primeira vez que o nome apareceu no banco.
3. `montarFunil` (functions/api/_funil-etapas.js) junta as linhas pelo nome (soma as posições), põe na ordem da posição mais recente de cada nome, dá o rótulo ("responderam o cargo") e marca `medidaDesdeMs` na etapa que começou depois do início do período.
4. A etapa marcada fica fora da normalização e da passagem: não tem percentual, não é a maior queda, e o degrau seguinte calcula a passagem sobre o degrau anterior a ela.
5. O dash só desenha: rótulo, número, passagem e, na etapa marcada, "medida desde 05/11".

### Edge Cases
- Etapa sem nome (JS antigo, nome inválido): fica como antes, "concluíram a etapa N", ordenada pela posição.
- Nome que o dash não conhece (pergunta nova sem rótulo cadastrado): aparece como "responderam: <nome>" (SUP-S6-05).
- Período inteiro depois do começo da etapa: sem aviso, com passagem normal.
- Resposta antiga guardada no cache de período fechado: o dash passa a pedir com `&v=s6`, que é outra chave de cache (lição L-03); a marca só vale depois do deploy.

### Cenário de Erro
- A consulta da primeira aparição falha: o funil sai sem nenhum `medidaDesdeMs` (pior caso, igual ao comportamento antigo), sem derrubar a tabela.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S6-11 | automática | `tests/funil-etapas.test.js` | etapas com nome "faturamento" e "cargo" viram degraus "responderam o faturamento" e "responderam o cargo" |
| CA-S6-12 | automática | `tests/funil-etapas.test.js` | 10 sessões de desafio na posição 6 e 5 na posição 7 dão um degrau "responderam o desafio" com 15 |
| CA-S6-13 | automática | `tests/funil-etapas.test.js` | com o desafio visto por último na posição 7, os degraus saem faturamento → cargo → desafio |
| CA-S6-14 | automática | `tests/funil-etapas.test.js` | período que começa antes da primeira aparição do cargo: degrau do cargo com `medidaDesdeMs`, sem passagem, não é maior queda, e faturamento/desafio têm os mesmos números e a passagem do desafio é sobre o faturamento |
| CA-S6-15 | automática | `tests/funil-etapas.test.js` | período que começa depois da primeira aparição: cargo sem aviso e com passagem |
| CA-S6-16 | automática | `tests/funil-etapas.test.js` | etapa sem nome aparece como "concluíram a etapa N" |
| CA-S6-17 | manual | roteiro abaixo | a tela no ar |

### Roteiro manual — CA-S6-17
1. Abrir o dash depois do deploy, aba da Conversão por LP, período dos últimos 30 dias.
2. Clicar na linha da home (`/`) para abrir o funil.
3. Ver os degraus com nome: responderam o nome, o WhatsApp, o e-mail, o Instagram, o faturamento, o cargo (com "medida desde 05/11" e sem percentual) e o desafio.
4. Ver que o número do desafio é parecido com o do faturamento (soma o período inteiro), e não um número pequeno.

## Banco de Dados

Sem mudança (a coluna `event_log.step_nome` veio na S6-01).

## Arquivos

- **Modificar:** `functions/api/_funil-etapas.js` — `montarFunil` agrupa por nome, ordena pela posição mais recente, rotula e marca `medidaDesdeMs`; etapa marcada fica fora da normalização e da passagem.
- **Modificar:** `functions/api/conversion.js` — consulta das etapas traz `step_nome` e a última vez vista; nova consulta da primeira aparição por página e nome; repassa ao `montarFunil`.
- **Modificar:** `public/dash/index.html` — desenha "medida desde DD/MM" na etapa marcada; o pedido da tabela leva `&v=s6`.
- **Modificar:** `tests/funil-etapas.test.js` — testes de CA-S6-11 a CA-S6-16.

Reuso: `normalizePath` e `isKnownPage` já fazem o merge por página em conversion.js; o padrão do asterisco/`funil-nota` do dash para o aviso.

## Checklist

- [x] `montarFunil` por nome em `functions/api/_funil-etapas.js`
- [x] Consultas de `functions/api/conversion.js`
- [x] Desenho e `&v=s6` em `public/dash/index.html`
- [x] Testes em `tests/funil-etapas.test.js` e suíte inteira verde

## Observações para o plano

- Depende da S6-01 (nome já gravado e histórico carregado).
- Lição L-03: não conferir a tela nova contra a API de produção antes do deploy se houver cache de período fechado; trocar a marca de versão só depois do deploy.

## Testes manuais

| Critério | Conferido por | Dia |
|---|---|---|
| CA-S6-17 | Marcelle | 06/11/2026 |

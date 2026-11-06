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

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S6-01 | Num período que cruza 05/11, como a etapa do cargo aparece? | respondida | Aparece com aviso "medida desde 05/11" e sem comparação com as vizinhas (usuária, 05/11) |

## Observações para o plano

- Depende da S6-01 (nome já gravado e histórico carregado).
- Lição L-03: não conferir a tela nova contra a API de produção antes do deploy se houver cache de período fechado; trocar a marca de versão só depois do deploy.

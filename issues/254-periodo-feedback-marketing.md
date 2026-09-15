# 254: Período da consulta de feedback de marketing

**Tipo:** Implementação
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Resolver e validar o período da consulta em dias de Brasília, com o padrão ontem/sexta a domingo e o limite de 92 dias.

## Comportamentos cobertos

- Sem período: ontem; segunda-feira → sexta a domingo; marcado como padrão
- Só uma data: aquele dia; data inicial e final: intervalo inclusivo
- Formato inválido ou data inexistente: "Data inválida: use AAAA-MM-DD."
- Final anterior à inicial: "A data final é anterior à inicial."
- 1 a 92 dias aceito; acima: "O período pode ter no máximo 92 dias — divida em mais de uma consulta."
- Futuro: "O período não pode terminar no futuro."
- Inclui hoje: marcado parcial, com aviso "Dia de hoje ainda em andamento — números parciais."
- Recorte de todos os dados pelo dia de Brasília; rótulo pronto; sem tratamento de feriado; sem cálculo de variação

## Cenários

### Happy Path
1. O agente chama `GET /api/feedback-marketing` (autenticado) sem parâmetros numa terça-feira, 15/09/2026, 08:30 de Brasília.
2. `resolverPeriodo({}, agora)` devolve `{ inicio: '2026-09-14', fim: '2026-09-14', dias: 1, rotulo: '14/09', padrao: true, parcial: false }`.
3. O endpoint coloca o período em `periodo` e usa `inicio`/`fim` para recortar os dados (as issues seguintes usam `limitesDoPeriodoUnix` para tabelas com data em unix).

### Edge Cases
- **Segunda-feira sem parâmetros:** sexta a domingo (ex.: segunda 14/09 → `2026-09-11` a `2026-09-13`, 3 dias, rótulo `11/09 a 13/09`), `padrao: true`.
- **Dia da semana e "hoje" sempre em Brasília:** segunda 00:30 de Brasília (03:30 UTC) já é segunda; domingo 23:30 de Brasília (segunda 02:30 UTC) ainda é domingo → padrão = sábado.
- **Só `inicio` ou só `fim`:** aquele único dia, `padrao: false`.
- **`inicio` e `fim`:** intervalo inclusivo nas duas pontas; `dias` = diferença + 1.
- **Parâmetro vazio (`?inicio=`):** tratado como não informado.
- **1 e 92 dias:** aceitos; **93 dias:** "O período pode ter no máximo 92 dias — divida em mais de uma consulta."
- **Fim = hoje (Brasília):** aceito, `parcial: true` e aviso "Dia de hoje ainda em andamento — números parciais." em `avisos`.
- **Rótulo:** `DD/MM` para um dia; `DD/MM a DD/MM` para intervalo (sem ano, como no exemplo da spec).
- **Recorte em unix para as próximas issues:** `limitesDoPeriodoUnix` → `{ desde: meia-noite de Brasília do início, ate: meia-noite de Brasília do dia seguinte ao fim }` (intervalo semiaberto `[desde, ate)`), via `inicioDoDiaBrt`. `ad_spend.date` já é dia de Brasília e é recortado direto por `inicio`/`fim`.
- **Feriado:** nenhum tratamento; **variação entre períodos:** não calculada.

### Cenário de Erro
- **Formato inválido (`14/09/2026`, `2026-9-14`, `abc`):** `400 { "error": "Data inválida: use AAAA-MM-DD." }`.
- **Data inexistente (`2026-09-31`, `2026-02-29`):** mesma mensagem.
- **Fim anterior ao início:** `400 { "error": "A data final é anterior à inicial." }`.
- **Fim depois de hoje:** `400 { "error": "O período não pode terminar no futuro." }`.
- Ordem das conferências: formato → fim antes do início → futuro → limite de 92 dias. A autenticação (issue 253) vem antes de tudo: sem chave, nenhum detalhe do período é revelado.

## Banco de Dados

Não se aplica.

## Arquivos

- **Criar:** `functions/api/_feedback-marketing-periodo.js` — puro: `resolverPeriodo({ inicio, fim }, agoraUnix)` → `{ ok: true, periodo, avisos }` ou `{ ok: false, erro }`; `limitesDoPeriodoUnix(periodo)`.
- **Criar:** `tests/feedback-marketing-periodo.test.js` — padrão (dia comum, segunda, viradas de fuso), uma data, intervalo, vazio, formato inválido, data inexistente, ordem, futuro, 92/93 dias, parcial, rótulo, limites em unix.
- **Modificar:** `functions/api/feedback-marketing.js` — lê `inicio`/`fim` da query, devolve 400 com a mensagem quando inválido, e troca o `periodo` fixo pelo resolvido (avisos do período em `avisos`, no lugar do aviso fixo do protótipo).

## Reuso (pesquisado na base)

- `ymdBrt` e `inicioDoDiaBrt` (`functions/api/_data-brt.js`) — mesmo dia de Brasília do resto do dashboard.

## Checklist

- [x] Padrão ontem / segunda → sexta a domingo, em dias de Brasília, marcado `padrao`
- [x] Uma data = um dia; duas datas = intervalo inclusivo
- [x] "Data inválida: use AAAA-MM-DD." para formato e data inexistente
- [x] "A data final é anterior à inicial."
- [x] "O período não pode terminar no futuro."
- [x] 1 a 92 dias; acima, mensagem da spec
- [x] `parcial` + aviso quando inclui hoje
- [x] Rótulo pronto e `dias`
- [x] `limitesDoPeriodoUnix` para recorte por dia de Brasília
- [x] Endpoint usa o período resolvido
- [x] Testes do módulo puro
- [x] `npm test` passando

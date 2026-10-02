# 362: Lista de agendamentos no dash

**Tipo:** Implementação
**Página:** Dash, aba Agendamentos (módulo 8)

## Descrição

Lista com filtros por período, tipo e situação, números do período, detalhe
com respostas e histórico, link para o card no CRM, cancelar e remarcar pela
equipe, sincronização com mudanças feitas direto no Google, presença ou falta
pela sala do Meet no dia seguinte (com "sem informação" e correção manual).

## Pronto quando

A usuária vê os agendamentos de teste, filtra, abre o detalhe, cancela e
remarca um pela equipe (a agenda do Google acompanha), e no dia seguinte a
reunião aparece como realizada ou faltou, podendo corrigir à mão.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Rota `/api/agenda/reunioes` (lista, detalhe, cancelar, remarcar, presença). Sync em `/api/sync/agenda`, cron */15 na VPS (`/root/scripts/agenda-sync/sync.sh`, apontando para a prévia até o merge).

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

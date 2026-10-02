# 363: Lead remarca e cancela sozinho

**Tipo:** Implementação
**Página:** Site, página de gerenciamento da reunião (módulo 6)

## Descrição

Link único do agendamento (na página de confirmação e na descrição do convite
do Google) abrindo a reunião marcada; remarcar para horário livre mantendo o
Meet, cancelar com motivo opcional, registro no card do CRM, bloqueio abaixo da
antecedência mínima com contato e tratamento de reunião passada ou cancelada.

## Pronto quando

Pelo link do convite, a usuária remarca uma reunião de teste (a agenda muda e
o Meet é o mesmo) e depois cancela (some da agenda, o card registra), e em cima
da hora a página não deixa e mostra o contato.

## Observações

- Sem e-mail de aviso nesta issue: os e-mails ficam para a entrega posterior.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. `/api/agenda/publico/reuniao`; link de gestão na página de confirmação e na descrição do convite do Google.

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

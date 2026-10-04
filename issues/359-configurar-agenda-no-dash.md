# 359: Configurar agendas, grades e tipos de reunião no dash

**Tipo:** Implementação
**Página:** Dash, seção Agenda (módulos 1, 2 e 3)

## Descrição

Ligar as telas da 356 ao backend: conectar contas @seteads.com e ler as agendas
pela credencial Google que já existe, marcar conflito e destino, alerta de
conexão quebrada no aviso diário, CRUD de grades (faixas, datas bloqueadas,
exceções, duplicar) e de tipos (todos os campos, pausar, duplicar, perguntas
extras, prévia dos horários livres).

## Pronto quando

A usuária conecta felipe@seteads.com, vê SETE | COMERCIAL, cria as duas grades
atuais do Calendly e os tipos de reunião, e o "ver horários livres" de um tipo
mostra exatamente os horários que batem com a agenda real do Felipe.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Rotas `/api/agenda/agendas|grades|tipos|horarios`; regras em `functions/api/_agenda-regras.js`; Google em `functions/api/_google-agenda.js` (secret `GOOGLE_AGENDA_SA_JSON`, produção e prévia). Agenda sem leitura entra no alerta de saúde (`agenda_problema`).

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

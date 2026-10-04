# 361: Reuniões agendadas no dash, registro no CRM e conversão Schedule

**Tipo:** Implementação
**Página:** Backend do agendamento + Visão geral do dash (resto do módulo 5)

## Descrição

Ao confirmar um tipo comercial: contar a reunião em **Reuniões agendadas** do
funil, ligada ao lead do formulário (sem criar lead novo), registrar dia,
horário e tipo no card do ClickUp que o formulário criou, e enviar `Schedule`
para o pixel atual do Meta (navegador + servidor, sem duplicar) e para o GA4.
Tipos não comerciais não geram nada disso.

## Pronto quando

Depois de um agendamento de teste, o painel por funil mostra +1 em Reuniões
agendadas (e o lead não conta duas vezes), o card do ClickUp tem a reunião
registrada e o `Schedule` aparece no Gerenciador de Eventos do pixel
2800317883678788 e no GA4. Uma entrevista de RH não aparece em nenhum deles.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Reuniões agendadas = `/api/agenda/reunioes?por=funil` (data em que agendou, sem e-mail de teste). Card do ClickUp ganha comentário; `Schedule` vai pelo próprio `/tracker` (pixel atual, GA4, fila de reenvio) com espelho no navegador pelo mesmo event_id. Na prévia não há credenciais do ClickUp nem do Meta: lá o CRM fica `sem_credencial` e o Schedule entra na fila de reenvio, que a rotina da produção envia.

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

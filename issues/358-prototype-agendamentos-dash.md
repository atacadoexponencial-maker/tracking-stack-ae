# 358: Protótipo da tela de Agendamentos e de Reuniões agendadas (dash)

**Tipo:** Protótipo
**Página:** Dash: aba **Agendamentos** dentro da seção Agenda (spec, módulo 8) e o número **Reuniões agendadas** no painel por funil da Visão geral (spec, módulo 5)

## Descrição

Desenhar a lista de reuniões com filtros, números do período, detalhe com
respostas e histórico, ações de cancelar e remarcar pela equipe, situação de
presença (realizada, faltou, sem informação) e onde aparece "Reuniões
agendadas" por funil na Visão geral.

## Pronto quando

Na prévia, a usuária vê a lista, o detalhe e o painel por funil com
Reuniões agendadas, em todos os estados, e aprova o desenho.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Construída direto na aba Agenda (vista Agendamentos) e na Visão geral (cartão Reuniões agendadas + linha no painel por funil).

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

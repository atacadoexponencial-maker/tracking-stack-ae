# 369: Reuniões agendadas, realizadas e custo por reunião na Visão geral

**Tipo:** Implementação
**Página:** Visão geral do dash, painel geral e painel por funil (spec `spec-conversao-agenda.md`, módulo 4)

## Descrição

Mostrar no painel geral e em cada funil as reuniões agendadas (pela data em que
agendou), as realizadas (pela data da reunião), o custo por reunião agendada e o
custo por reunião realizada, usando o mesmo investimento por funil do CPL e o
funil do formulário de onde o lead veio. No painel geral, só entra o
investimento dos funis que agendam reunião.

## Pronto quando

Com reuniões de teste em sessão estratégica, o painel do funil mostra as
contagens e os dois custos batendo com investimento ÷ reuniões, o painel geral
soma só os funis que agendam, e os estados "sem investimento" e "nenhuma
reunião" aparecem quando cabem.


## Implementação (02/10/2026)

Feito na branch `agenda-propria` (commit "conversao da agenda"). Conferido na prévia pela Visão geral. Falta a conferência da usuária; nada vai para a `main` até ela liberar a agenda.

# 368: Reunião realizada como conversão (Meta e GA4)

**Tipo:** Implementação
**Página:** Backend da presença (sync do Meet e marcação à mão) (spec, módulo 3)

## Descrição

Quando uma reunião comercial vira "realizada" (Meet ou à mão), mandar uma
conversão para o pixel atual do Meta e para o GA4, uma vez só por reunião, sem
desfazer em correção posterior, sem enviar fora do prazo de 7 dias (registrado
como "fora do prazo") e nunca para e-mail de teste ou tipo não comercial.

## Pronto quando

Uma reunião de teste marcada como realizada aparece no Gerenciador de Eventos
do pixel 2800317883678788 e no GA4; marcar de novo não reenvia; o detalhe da
reunião mostra a situação do envio.

## Observações

- Depois do primeiro envio real, a equipe cria a conversão personalizada no Meta.
- Só vale de verdade quando a agenda for ativada nas LPs (issue 364).

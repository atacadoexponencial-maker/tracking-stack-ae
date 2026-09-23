# 315: Campanha de tráfego comparada com o próprio passado

**Tipo:** Implementação
**Página:** Monitor de tráfego na VPS — spec `spec-argo-regua-editavel.md`, módulo 3

## Descrição

Trocar a comparação com as outras campanhas pela comparação do custo por visita da janela recente com a janela anterior da própria campanha, com tolerância e gasto mínimo da régua; campanha sem passado suficiente não é julgada.

## Pronto quando

O relatório das 8h50 mostra, para cada campanha, custo recente, custo do próprio passado e corte, e marca "sem passado suficiente" nas campanhas novas; nenhuma comparação com outras campanhas sobra.

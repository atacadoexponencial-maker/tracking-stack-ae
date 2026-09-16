# 278: Tabela de aceitação por tipo e evolução diária

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Calcular no servidor, para o período e pelo horário original do evento, total, aceitas na primeira tentativa, aceitas por reenvio, aguardando, falhou de vez e taxa por tipo (com EntrouGrupo lido da fila existente), a série diária e os avisos de conversões sem situação, estado vazio e dados anteriores à ativação.

## Comportamentos cobertos

- Calcular a taxa de aceitação
- Tipo sem nenhuma conversão no período
- Total zero
- Conversões ainda aguardando
- Componentes: evolução diária da aceitação, aviso de conversões sem situação, estado vazio, aviso de dados anteriores

## Critérios de aceite relacionados

- 10, 11, 12, 16, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — por tipo, diário, sem situação, ativação
- **Modificar:** `public/dash/index.html`

## Checklist

- [x] Aceitas 1ª tentativa × reenvio, pendentes, falhas, taxa
- [x] EntrouGrupo como tipo
- [x] Taxa "—" com total zero
- [x] Aviso sem situação e dados anteriores
- [x] Estado vazio

# 296: Alerta das proteções pelo Slack

**Tipo:** Implementação
**Página:** Módulo 4 — Alerta das proteções
**Spec:** spec-protecoes-integracoes.md

## Descrição

Condições "credencial com problema" e "horário suspeito" no mesmo alerta do Slack, com item novo avisado na hora e recuperação única.

## Critérios de aceite relacionados

- 1
- 6
- 7
- 9

## Arquivos

- **Modificar:** `functions/api/_meta-envio.js` — títulos das condições
- **Modificar:** `functions/api/_meta-alerta.js` — itens por condição
- **Criar:** `functions/api/_saude-alertas.js` — junta Meta, credenciais e horário

## Checklist

- [x] Mensagem só com nome e tipo do problema
- [x] Item novo em condição ativa: alerta só com ele
- [x] Recuperação sem números do Meta quando não é do Meta

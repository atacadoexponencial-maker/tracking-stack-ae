# 293: Checagem das credenciais (1x/dia + Checar agora)

**Tipo:** Implementação
**Página:** Módulo 1 — Checagem das credenciais
**Spec:** spec-protecoes-integracoes.md

## Descrição

Conferir forma (ausente, vazia, invisível, pontas, aspas, formato) e aceitação no Meta e no ClickUp, sem nunca gravar ou exibir valor.

## Critérios de aceite relacionados

- 1
- 2
- 3
- 4
- 5
- 8

## Arquivos

- **Criar:** `migrations/0042_protecoes_integracoes.sql`
- **Criar:** `functions/api/_credenciais.js` — catálogo e regras puras
- **Criar:** `functions/api/_credenciais-checagem.js` — rodada, aceitação, trava e intervalo
- **Modificar:** `functions/api/sync/meta-reenvio.js` — rodada automática diária
- **Criar:** `tests/protecoes-regras.test.js`, `tests/protecoes-integracao.test.js`

## Checklist

- [x] Catálogo com as credenciais em uso de verdade
- [x] `\s` do JavaScript casa com BOM: lista explícita de espaços
- [x] Não confirmado vira problema só na 2ª automática
- [x] Manual recusada antes de 1 minuto
- [x] Nenhum valor no banco, log ou resposta

# 297: Telefone no padrão em todas as portas de entrada

**Tipo:** Implementação
**Página:** Módulo 5 — Telefone no padrão na entrada
**Spec:** spec-protecoes-integracoes.md

## Descrição

Regra única (55 + DDD + nono dígito) usada por todas as entradas e destinos, com busca que reconhece o lead antigo sem o 9 e identificadores inalterados.

## Critérios de aceite relacionados

- 14
- 15
- 16
- 17
- 18
- 19

## Arquivos

- **Criar:** `functions/_telefone.js` e `tests/telefone.test.js`
- **Modificar:** `functions/api/_hash.js`, `functions/webhook/_core.js`, `functions/api/_clickup.js`, `functions/api/_grupo-conversao.js` — delegam à regra única
- **Modificar:** `functions/tracker.js`, `functions/api/webhooks/greenn.js` — busca por variantes; lead_dispatch com original e situação

## Checklist

- [x] Telefones antigos não corrigidos (decisão)
- [x] event_id da fila de grupo continua com o telefone cru
- [x] Impossível segue o fluxo e fica sinalizado

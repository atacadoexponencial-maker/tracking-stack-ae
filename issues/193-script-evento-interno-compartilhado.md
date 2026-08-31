# 193: Módulo `funil.ts` com o envio de evento interno

**Tipo:** Implementação
**Página:** src/scripts/
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`

## Descrição

Criar `src/scripts/funil.ts` com `enviarEventoInterno()` — o `POST /tracker` que hoje está escrito à mão dentro do `form-start.ts` — e fazer o `form-start.ts` passar a usá-lo.

## Por que assim

Refatoração sem mudança de comportamento: o `FormStart` continua idêntico. Existe para que `CTAClick` e `FormStep` não criem uma segunda e uma terceira cópia do mesmo `fetch`. O `form-start.ts` continua com a responsabilidade única de disparar o `FormStart` no primeiro toque.

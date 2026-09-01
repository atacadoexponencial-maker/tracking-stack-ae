# 208: Continuar funcionando sem a atribuição

**Tipo:** Implementação
**Página:** Módulo 1 — Origem dos dados de venda

## Descrição

Quando a atribuição de uma venda não for encontrada, a venda ainda entra na receita, apenas sem campanha. Nada pode quebrar nem sumir por causa disso.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — tolerância à ausência de atribuição

## Checklist

- [ ] Venda sem `sf_trk` entra na receita
- [ ] `sf_trk` órfão (sem sessão) entra na receita
- [ ] Nenhuma exceção lançada nesses casos
- [ ] Teste para os dois cenários

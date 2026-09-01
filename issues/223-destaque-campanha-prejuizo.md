# 223: Identificar visualmente as campanhas no prejuízo

**Tipo:** Implementação
**Página:** Módulo 3 — Aba Greenn

## Descrição

Sinal visual na linha cujo retorno é menor que 1, isto é, que gastou mais do que trouxe.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `public/dash/index.html` — destaque de prejuízo

## Checklist

- [x] Sinal visual quando ROAS < 1
- [x] Não aplicar quando o ROAS é indisponível
- [x] Não depender só de cor (acessibilidade)

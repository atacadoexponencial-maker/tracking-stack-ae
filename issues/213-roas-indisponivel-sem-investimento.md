# 213: Exibir retorno indisponível quando não há investimento

**Tipo:** Implementação
**Página:** Módulo 2 — Cruzamento com investimento

## Descrição

Quando a campanha não tiver investimento registrado, o retorno aparece como indisponível — nunca como zero e nunca como infinito.

## Spec

`spec-greenn-aba-dashboard.md`

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — guarda de divisão
- **Modificar:** `public/dash/index.html` — desenho do valor ausente

## Checklist

- [ ] Nunca devolve `Infinity` nem `NaN`
- [ ] Dashboard desenha `—` para `null`
- [ ] Teste cobrindo investimento zero

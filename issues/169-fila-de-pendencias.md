# 169: Manter como pendente a conversão que falhou

**Tipo:** Implementação
**Página:** Módulo 4 — Falhas e reprocessamento

## Descrição

Não marcar como enviada a conversão cujo envio falhou: ela fica pendente. Reprocessar uma pendência não pode gerar conversão duplicada nem consumir a dedup duas vezes.

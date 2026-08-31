# 196: Evento `FormStep` no chat de captura

**Tipo:** Implementação
**Página:** src/components/LeadChat.astro
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 192, 193

## Descrição

Chamar `enviarFormStep(n)` a cada pergunta respondida do chat, na ordem do `STEPS`, com a mesma regra da issue 195: dispara na conclusão, e a última pergunta não emite (é o `Lead`).

## Por que assim

Mesmo comportamento do formulário de aplicação, com outra roupa: no chat, cada pergunta é uma etapa.

# 195: Evento `FormStep` no formulário de aplicação

**Tipo:** Implementação
**Página:** src/components/AplicacaoForm.astro
**Spec:** `docs/superpowers/specs/2026-08-31-funil-micro-conversoes-design.md`
**Depende de:** 192, 193

## Descrição

Acrescentar `enviarFormStep(n)` ao `funil.ts` e chamá-lo dentro do `avancar()`, depois de a validação da etapa passar. A última etapa não emite `FormStep` — concluí-la é o `Lead`.

## Por que assim

O evento marca a CONCLUSÃO da etapa, não a chegada nela: é o que faz a desistência no campo "Faturamento mensal" aparecer como queda entre a etapa 1 e a etapa 2. Não reenviar a mesma etapa no mesmo carregamento (quem volta e avança de novo conta uma vez).

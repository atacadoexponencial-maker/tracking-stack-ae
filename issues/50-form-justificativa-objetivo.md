# 50: Adicionar perguntas Justificativa e Objetivo ao chat + mapear no ClickUp

**Tipo:** Implementação
**Página:** Home (chat de captação) + backend ClickUp

## Descrição

Voltar as duas perguntas abertas — desafio (justificativa) e objetivo — ao chat de diagnóstico da home, e mapeá-las nos campos correspondentes do ClickUp (que hoje ficam vazios porque o form não as coleta).

## Cenários

### Happy Path
1. Após o faturamento, o chat pergunta o principal desafio e depois o maior objetivo (2 inputs de texto).
2. As respostas vão no `lead_data` (`justificativa`, `objetivo`).
3. `sendToClickUp` grava nos campos ✍️ Justificativa (`bc6b9579…`) e 🎯 Objetivo 2025 (`64e17f77…`) na criação, e inclui os dois no comentário de lead repetido.

### Edge Cases
- Campos vazios → omitidos do `custom_fields` (padrão já existente do `push`).

## Arquivos

- **Modificar:** `src/components/LeadChat.astro` — 2 novos passos `input` (justificativa, objetivo) no `STEPS`; incluir ambos no `lead_data` do submit; ajustar a copy "Por fim," do Instagram (deixa de ser a última).
- **Modificar:** `functions/tracker.js` — adicionar `justificativa`/`objetivo` no `CU_FIELD`, extrair de `leadData`, incluir no `custom_fields` da criação e nas linhas do comentário.

## Checklist

- [ ] 2 passos no `STEPS` (justificativa, objetivo) após faturamento
- [ ] Incluir `justificativa`/`objetivo` no `lead_data`
- [ ] `CU_FIELD.justificativa` + `CU_FIELD.objetivo` e push no create
- [ ] Justificativa/Objetivo no texto do comentário

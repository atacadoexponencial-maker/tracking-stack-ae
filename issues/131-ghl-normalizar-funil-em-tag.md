# 131: Normalizar funil em tag do GHL

**Tipo:** Implementação
**Página:** —  (backend — `functions/tracker.js`)

## Descrição

Criar uma função pura que recebe o funil efetivo do lead e devolve a tag `funil-<nome>`, aplicando duas regras: `lives-semanais-v1`/`lives-semanais-v2` → `funil-lives-semanais` e `diagnostico` → `funil-sessao-estrategica`; qualquer outro funil passa direto com o prefixo. Funil vazio → sem tag.

## Cenários

### Happy Path
- `ghlFunnelTag('workshop')` → `'funil-workshop'`
- `ghlFunnelTag('lives-semanais-v1')` → `'funil-lives-semanais'`
- `ghlFunnelTag('lives-semanais-v2')` → `'funil-lives-semanais'`
- `ghlFunnelTag('diagnostico')` → `'funil-sessao-estrategica'`
- `ghlFunnelTag('calculadora')` → `'funil-calculadora'` (funil futuro sai de graça)

### Edge Cases
- Entrada vazia/`undefined`/só espaços → retorna `null` (sinaliza "sem tag").
- Maiúsculas/espaços nas bordas → normalizados com `.toLowerCase().trim()` (mesmo padrão de `mapFunnelToOption`).

### Cenário de Erro
- Função pura, sem I/O — não falha. Quem chama trata o `null` pulando a etapa de tag.

## Arquivos

- **Modificar:** `functions/tracker.js` — adicionar a função `ghlFunnelTag(funnel)` junto dos outros helpers de funil (perto de `mapFunnelToOption`, ~linha 568).

## Checklist

- [ ] Criar `ghlFunnelTag(funnel)` com `.toLowerCase().trim()`
- [ ] Regra: `lives-semanais-v1`/`v2` → `funil-lives-semanais`
- [ ] Regra: `diagnostico` → `funil-sessao-estrategica`
- [ ] Default: `funil-<funil>` para qualquer outro valor não-vazio
- [ ] Entrada vazia → `null`

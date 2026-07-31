# 180: Repassar as UTMs ao destino final

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Encaminhar ao destino do redirect os parâmetros de UTM presentes na URL do disparo, preservando os que o destino já tiver, para que o tracking da página que recebe continue funcionando.

## Cenários

### Happy Path
`/links?utm_source=grupo&utm_medium=whatsapp` com destino `https://atacadoexponencial.com/lives-semanais-v2` → redireciona para `.../lives-semanais-v2?utm_source=grupo&utm_medium=whatsapp`, e o middleware da LP captura as UTMs normalmente.

### Edge Cases
- **Destino já tem a mesma UTM cadastrada:** o valor do destino vence. O que a usuária cadastrou é explícito; o da URL é herdado.
- **Sem UTMs na URL:** o destino é usado como está, sem `?` sobrando.
- **Destino com fragmento (`#secao`):** preservado.
- **Parâmetros que não são UTM** (ex.: `fbclid`) não são repassados — o escopo é UTM, e repassar tudo arriscaria vazar parâmetro interno para fora do domínio.

### Cenário de Erro
Destino que não parseia como URL → redireciona para o destino cru, sem tentar montar query. A validação de URL acontece na gravação (issue 182), não aqui.

## Arquivos

- **Modificar:** `functions/links.js` — montar a URL final antes de responder o 302.

## Checklist

- [x] Repassar apenas `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- [x] Não sobrescrever parâmetro que o destino já define
- [x] Preservar query e fragmento existentes no destino
- [x] Não quebrar quando o destino não for URL absoluta parseável

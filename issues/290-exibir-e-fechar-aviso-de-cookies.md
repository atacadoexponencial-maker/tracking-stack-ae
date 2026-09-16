# 290: Exibir, fechar e lembrar o aviso por 12 meses sem atrapalhar a conversão

**Tipo:** Implementação
**Página:** Módulo 1 — Aviso de cookies (páginas públicas)
**Spec:** spec-aviso-cookies.md

## Descrição

Mostrar o aviso nas páginas públicas até o "Entendi", lembrar o fechamento por 12 meses e posicioná-lo sem cobrir CTA fixo, balão de prova social, campo em foco ou modal.

## Comportamentos cobertos

- Onde aparece
- Quando aparece
- Ações
- Não atrapalhar a conversão
- Acessibilidade

## Critérios de aceite relacionados

- 1
- 2
- 3
- 6
- 7
- 8
- 9
- 10
- 11
- 12
- 13
- 20
- 21

## Arquivos

- **Modificar:** `src/components/AvisoCookies.astro` — script de exibição, memória (armazenamento local), posição acima da barra fixa, some com campo em foco no celular, foco após "Entendi"

## Checklist

- [x] Memória `ae_aviso_cookies_fechado` com data; vale 365 dias
- [x] Armazenamento bloqueado: fecha só na página atual
- [x] Acima de `[data-sticky-cta][data-visivel]` e empurra `#prova-social`
- [x] Esc não fecha; foco vai para o conteúdo principal
- [x] Sem animação com menos movimento

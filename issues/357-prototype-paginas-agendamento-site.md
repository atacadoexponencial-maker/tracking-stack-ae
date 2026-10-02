# 357: Protótipo das páginas de agendamento (site)

**Tipo:** Protótipo
**Página:** Site: página pública do tipo (`/agendar/<tipo>`), página de confirmação e página de gerenciamento da reunião (spec, módulos 4, 5 e 6)

## Descrição

Desenhar, na identidade visual do site, a escolha de dia e horário com fuso,
o resumo com os dados do lead já preenchidos (tipo comercial) ou o formulário
(tipo não comercial), a confirmação com Meet e botões, a página de remarcar e
cancelar e as mensagens de agenda indisponível, horário tomado e reunião
passada ou cancelada.

## Pronto quando

Na prévia, a usuária percorre as três páginas em todos os estados, no celular
e no computador, e aprova o desenho.


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. Construída direto (sem prévia estática), em `src/pages/agendar.astro`, `src/pages/reuniao.astro` e `src/scripts/agenda-calendario.js`. Servidas por `functions/agendar/[slug].js` e `functions/reuniao/[token].js`.

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

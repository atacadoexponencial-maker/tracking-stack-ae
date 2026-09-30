# 345: Aba Leads na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, aba Leads
**Spec:** `spec.md` (Módulo 2)

## Descrição

Reestilizar a aba Leads com os componentes da fundação (issue 344): bloco de metas detalhado com régua por funil e indicador em carimbo, bloco CRM com pílulas novos × retornando, chips e sub-blocos por origem e estágio, etiquetas de leads por funil e materiais, Conversão por LP com o funil de micro-conversões abrindo abaixo da linha, Leads recentes com selos e status de envio, modal de detalhe do lead com jornada. Nenhum dado ou chamada muda.

## Pronto quando

- Na preview, a aba Leads inteira usa o vocabulário da Visão geral (etiquetas, tabela-grade, carimbos, pílulas, chips, avisos).
- Alternar novos × retornando, remover filtro pelo chip, paginar leads recentes e abrir o histórico de metas em `details` funcionam como hoje.
- Clicar numa linha de conversão abre o funil de micro-conversões daquela página embaixo (caminho em mono, barra de proporção, maior queda em coral); clicar de novo fecha.
- Clicar num lead abre o modal com foco preso; Esc ou o botão fecha.
- Status de envio Meta/GA4 aparece com ✓ apagado e ✕ coral; "form Meta" aparece como selo.
- Números iguais aos de produção para o mesmo filtro.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Específico: indicadores de meta no detalhe (`.meta-ind`) ganharam a régua da Visão geral e a situação dentro/perto/fora em carimbo, sem cor no valor. Conferida na preview com dados simulados: metas, CRM em etiquetas, tabelas, selos e ✓/✕.

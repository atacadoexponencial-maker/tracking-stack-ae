# 354: Aba Instagram na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, aba Instagram
**Spec:** `spec.md` (Módulo 19)

## Descrição

Reestilizar a aba de marketing com os componentes da fundação: cabeça com vistas em pílulas, filtros de período e nota da última coleta com selo; etiquetas de seguidores com variação e trio de números; "Evolução diária" em gráfico; "Desempenho por formato" em cartões-etiqueta com o líder em fio forte; ranking de posts e reels em tabela-grade com miniatura; grade de stories com dados embaixo; mapa de calor de horários em células na tinta com legenda; demografia em barras horizontais na tinta.

## Pronto quando

- Na preview, a aba aparece no mundo claro com os mesmos dados de produção (Neon, schema `marketing`).
- Trocar a vista (perfil, conteúdo, público) nas pílulas funciona.
- Mouse numa célula do mapa de calor mostra o valor.
- Clicar numa miniatura abre o post no Instagram em outra aba.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Específico: líder por formato marcado com fio forte no topo; barras horizontais da demografia e das navegações de story na tinta; gênero em tinta/informação/apagado. Conferida na preview só no estado de erro dos blocos (sem dados simulados da Neon).

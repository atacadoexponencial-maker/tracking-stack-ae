# 348: Abas Workshops, Jornada e Eventos na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Workshops, Jornada e Eventos
**Spec:** `spec.md` (Módulos 8, 15 e 16)

## Descrição

Reestilizar as três abas de consulta com os componentes da fundação: Workshops com tabela-grade (presença em carimbo) e bloco de detalhe com etiquetas e tabela de presentes; Jornada com bloco de busca, etiqueta do lead e linha do tempo vertical (ponto na tinta, fio, hora apagada); Eventos com etiquetas de saúde da captura, pílulas de tipo e tabela de eventos recentes com payload em mono dentro de `details`.

## Pronto quando

- Na preview, as três abas aparecem no mundo claro com os mesmos dados de produção.
- Clicar num workshop abre o detalhe abaixo com o título dele; o botão secundário fecha.
- Buscar jornada por e-mail ou telefone mostra a linha do tempo; sem resultado, o estado vazio ensina o que apareceria.
- Em Eventos, filtrar por tipo nas pílulas e abrir o payload de um evento funcionam.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Jornada: `.tl-dot` agora na tinta. Eventos: `pre` em papel com fio.

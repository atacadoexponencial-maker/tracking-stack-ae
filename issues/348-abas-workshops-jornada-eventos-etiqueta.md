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

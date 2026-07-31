# 177: Redirecionar /links para o destino válido

**Tipo:** Implementação
**Página:** Rota pública /links

## Descrição

Criar `functions/links.js` respondendo `GET /links` com `302` e `Cache-Control: no-store`, escolhendo o destino nesta ordem: janela agendada que contém o instante do clique (em empate, a que começou mais tarde), destino padrão, e por fim `/`.

## Cenários

### Happy Path
Alguém clica no link do disparo. A rota consulta o D1, acha a janela agendada que contém o instante do clique e devolve `302` para o destino dela, sem cache.

### Edge Cases
- **Fora de qualquer janela** (link antigo circulando no grupo): usa o destino padrão.
- **Duas janelas sobrepostas:** vence a que começou mais tarde (`ORDER BY starts_at DESC`), regra fixa para nunca haver empate ambíguo.
- **Destinos apagados** (`apagado_em` preenchido) nunca são elegíveis.
- **Nenhum destino cadastrado:** redireciona para `/`.

### Cenário de Erro
Falha na consulta ao D1 → redireciona para o destino padrão se já conhecido, senão `/`. Quem clicou nunca vê erro nosso.

## Arquivos

- **Criar:** `functions/links.js` — rota `GET /links`.
- **Criar:** `functions/_links-destino.js` — a regra de escolha do destino, isolada e pura (recebe as linhas e o instante, devolve o destino). O prefixo `_` impede o Pages de transformá-la em rota, e a issue 181 importa a MESMA função para o dash nunca discordar do redirect.

> A rota vive em `functions/` (não em `src/pages/`) porque as Pages Functions têm
> prioridade sobre os assets estáticos do Astro — mesmo padrão de `functions/grupo-da-live.js`.

## Código reutilizável

- `functions/grupo-da-live.js` — padrão de redirect 302 com `Cache-Control: no-store`.

## Checklist

- [x] Criar `functions/_links-destino.js` com a regra de escolha, como função pura
- [x] Criar `functions/links.js` com `onRequestGet`
- [x] Selecionar a janela válida no instante do clique, desempatando por `starts_at DESC`
- [x] Cair no destino padrão (`starts_at`/`ends_at` nulos) quando não houver janela
- [x] Cair em `/` quando não houver nem padrão
- [x] Ignorar destinos com `apagado_em` preenchido
- [x] Responder 302 com `Cache-Control: no-store`
- [x] Tratar falha do D1 sem mostrar erro a quem clicou

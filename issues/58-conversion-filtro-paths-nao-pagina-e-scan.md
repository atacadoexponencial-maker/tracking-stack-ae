# 58: `/api/conversion` — filtro de paths não-página + `'scan'` na lista de bots

**Tipo:** Implementação
**Página:** Módulo: Endpoint de conversão por LP (`functions/api/conversion.js`)

## Descrição

Higienizar o histórico já poluído por scanners **só no read path**, sem apagar nem alterar dado nenhum: (a) excluir das rows os paths que não são páginas do site — ponto em algum segmento ou prefixo `/wp-` — e (b) adicionar `'scan'` à `BOT_UA_SUBSTRINGS`, cobrindo os UAs `TLM-Audit-Scanner/1.0` e `pathscan/1.0` vistos em produção que não casam com a lista atual.

## Comportamentos

- **Filtro de path não-página:** predicado aplicado **após** `normalizePath(row.landing_url)` e **antes** de acumular no `byPath` / montar `rows` — o path excluído não entra no resultado (nem em `visitors`, nem em `leads`, nem como linha). Duas regras em **OU**:
  1. Algum segmento do path contém ponto — cobre `/wp-admin/setup-config.php`, `/.env`, `/admin.php` (extensão no último segmento) e `/.git/HEAD` (ponto no segmento `.git`). Nota de decisão: a spec fixa "ponto em **qualquer** segmento" (não só no último) por ser o menor predicado que cobre todos os exemplos; nenhuma página legítima do site (Astro, URLs limpas) tem ponto no path.
  2. Path começa com `/wp-` — cobre `/wp-admin` (normalizado, sem ponto) e todo o ecossistema WordPress (`/wp-login.php`, `/wp-content/...`).
- A raiz `'/'` **nunca** é excluída (sem ponto em segmento, não começa com `/wp-`).
- O bucket `'(sem página)'` **continua existindo**: o predicado só se aplica a paths reais (strings começando com `/` devolvidas pelo `normalizePath`); o rótulo passa direto como hoje.
- Paths legítimos (`/`, `/lives-semanais-v1`, `/consultoria-gratuita-atacado`, `/obrigado`, etc.) não casam com nenhuma regra e aparecem normalmente.
- A exclusão é por linha do resultado, **não** por sessão no banco: nenhuma escrita, nenhum DELETE — as sessões de scanner continuam no D1, só não aparecem no dashboard.
- **`'scan'` em `BOT_UA_SUBSTRINGS`:** sessões com UA contendo `scan` (case-insensitive, semântica do `LIKE` do SQLite para ASCII) saem do denominador e, por consequência, do numerador — em **qualquer** LP, inclusive nas legítimas que scanners às vezes atingem. `'scan'` cobre `scanner` e `pathscan` por substring.
- A entrada `'scan'` fica visivelmente separada/anotada com comentário pt-BR como adição **ALÉM** da lista replicada do `detectBot` de `functions/tracker.js` (que não pode ser alterado), para não confundir uma futura ressincronização. O comentário de cabeçalho existente permanece válido para as entradas replicadas.
- A geração das cláusulas SQL (`AND s.user_agent NOT LIKE '%scan%'`) continua vindo da lista estática do módulo — nenhum input de request entra na string; sem risco de injeção.
- Ordenação, formato de resposta (`{ days, funnel, rows }`), autenticação por `DASH_KEY`, filtro `&funnel=` e período `days`/`from`/`to` permanecem idênticos.

## Dependências

- Nenhuma. Independente da issue 57 — podem ser feitas em qualquer ordem. (Pressupõe o endpoint da issue 55, já implementado.)

## Cenários

### Happy Path

1. `GET /api/conversion?key=<DASH_KEY>&days=30` → 200 com `rows` sem nenhum path de scanner: `/wp-admin/setup-config.php` (e qualquer coisa sob `/wp-admin/`, ex.: `/wp-admin/user/index.php`), `/.env`, `/admin.php`, `/.git/HEAD` e `/wp-admin` não aparecem.
2. Paths reais do site aparecem normalmente: `/`, `/calculadora-atacado`, `/lives-semanais-v1`, `/consultoria-gratuita-atacado`, `/obrigada` (nenhum tem ponto em segmento nem prefixo `/wp-`).
3. Sessões com UA `TLM-Audit-Scanner/1.0` ou `pathscan/1.0` deixam de contar como visitantes em qualquer LP (`'scan'` é substring de ambos, case-insensitive no `LIKE`) — a tabela "Conversão por LP" volta a refletir só tráfego real.

### Edge Cases

- **`/.git/HEAD`:** excluído pelo ponto em segmento **do meio** (`.git`); o último segmento `HEAD` não tem ponto — por isso a regra é "ponto em **qualquer** segmento", não só no último.
- **`/wp-admin/` normalizado para `/wp-admin`:** sem ponto em segmento nenhum — excluído pela regra do prefixo `/wp-`.
- **Raiz `'/'`:** nunca excluída — `'/'.split('/')` = `['', '']`, nenhum segmento com ponto, e não começa com `/wp-`.
- **`'(sem página)'`:** continua existindo nas rows — não começa com `/`, então o predicado não se aplica (não tem ponto de "extensão" nem prefixo `/wp-`); passa direto como hoje.
- **Exclusão zera todas as rows:** se no período só houver tráfego de scanner, a resposta é `{ days, funnel, rows: [] }` — o front (issue 56) já trata rows vazias com estado vazio condicional; nada a fazer aqui.
- **`'scan'` vs. browsers reais:** nenhum UA de browser real (Chrome, Firefox, Safari, Edge, Opera, Samsung Internet) contém a substring `scan` — falso positivo real só em ferramenta de scanning, que é exatamente o alvo. Teórico UA legítimo com `scan` é aceito como falso positivo raro, consistente com o trade-off da lista existente (`'bot'`, `'axios'`...).

### Cenário de Erro

- Nenhum novo caminho de erro e nenhuma mudança no tratamento existente: auth 401, 500 `{ error: err.message }` e demais respostas permanecem exatamente como na issue 55.

## Banco de Dados

Somente leitura — **nenhuma migration**, nenhum dado histórico deletado ou alterado.

## Arquivos

- **Modificar:** `functions/api/conversion.js` — único arquivo tocado. Duas mudanças cirúrgicas:
  1. **Predicado novo** — função privada de módulo (junto de `normalizePath`, com comentário pt-BR no padrão do arquivo):
     ```js
     // Path que não é página do site (sonda de scanner): ponto em algum
     // segmento (/.env, /admin.php, /.git/HEAD) OU prefixo /wp-. Só se
     // aplica a paths reais ('/...'); '(sem página)' passa direto.
     function isNonPagePath(lp) {
       if (!lp.startsWith('/')) return false; // '(sem página)'
       return lp.startsWith('/wp-') || lp.split('/').some((seg) => seg.includes('.'));
     }
     ```
     **Ponto de inserção:** no laço `for (const row of grouped.results || [])` (hoje linhas 75–81), logo após `const lp = normalizePath(row.landing_url);` e antes de `byPath.get(lp)`:
     ```js
     if (isNonPagePath(lp)) continue;
     ```
     Assim o path excluído não entra em `visitors`, `leads` nem como linha — e a montagem de `rows`/sort (linhas 83–92) fica intocada.
  2. **`'scan'` em `BOT_UA_SUBSTRINGS`** (hoje linhas 107–118): nova linha ao final do array, separada das réplicas, com comentário pt-BR na própria linha marcando que é adição **local** (ALÉM da réplica do `detectBot` de `functions/tracker.js`, que não pode ser alterado nesta feature) e citando os UAs `TLM-Audit-Scanner/1.0` e `pathscan/1.0` vistos em produção. O comentário de cabeçalho existente ("Replicado de detectBot()... manter em sincronia manualmente") permanece como está — válido para as 25 entradas replicadas.
- **Não tocar:** `functions/tracker.js`, `functions/_middleware.js` (issue 57), `public/dash/index.html`, `migrations/`.

## Checklist

- [x] `isNonPagePath(lp)` criado como função privada de módulo e aplicado com `if (isNonPagePath(lp)) continue;` no laço do `byPath`, logo após `const lp = normalizePath(row.landing_url);` — nada muda na query SQL nem na montagem/sort de `rows`
- [x] `/wp-admin/setup-config.php`, `/.env`, `/admin.php`, `/.git/HEAD` e `/wp-admin` excluídos; `/`, `/calculadora-atacado`, `/lives-semanais-v1` e demais páginas legítimas preservados; `'(sem página)'` continua nas rows
- [x] `'scan'` adicionado ao final de `BOT_UA_SUBSTRINGS` com comentário pt-BR marcando como adição local (além da réplica do `detectBot`), citando `TLM-Audit-Scanner/1.0` e `pathscan/1.0`; comentário de cabeçalho da lista intocado
- [x] Nenhuma escrita/DELETE no D1; nenhuma migration; resposta `{ days, funnel, rows }`, auth por `DASH_KEY`, `&funnel=` e período `days`/`from`/`to` inalterados
- [x] Nenhum outro arquivo modificado (`git status` mostra só `functions/api/conversion.js`)
- [x] Teste local: `npx wrangler pages dev dist --port 8791` com D1 local semeado — sessões com paths de scanner (`/wp-admin/user/index.php`, `/.env`, `/admin.php`, `/.git/HEAD`) e uma sessão em página legítima com UA `TLM-Audit-Scanner/1.0`; sessões em `/`, `/calculadora-atacado`, `/lives-semanais-v1` com UA de browser real. `curl "http://localhost:8791/api/conversion?key=<DASH_KEY>&days=30"` → nenhum path de scanner nas rows, o visitante `TLM-Audit-Scanner` não conta na LP legítima, e as páginas reais aparecem com contagens corretas
- [x] Caso extremo verificado: com só tráfego de scanner no período, resposta `{ days, funnel, rows: [] }` (front já trata)

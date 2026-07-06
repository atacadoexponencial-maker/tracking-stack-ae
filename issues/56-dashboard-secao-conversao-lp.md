# 56: Seção "Conversão por LP" no dashboard

**Tipo:** Implementação
**Página:** Módulo: Seção "Conversão por LP" na aba Leads do dashboard (`public/dash/index.html`)

## Descrição

Adicionar na aba Leads do dashboard um card novo "Conversão por LP" com tabela **LP | Visitantes | Leads | Taxa de conversão**, alimentada exclusivamente pelo `/api/conversion` (issue 55). Segue o padrão visual dos cards existentes (`.card`, cabeçalho `font-semibold` + subtítulo `text-xs`, `thead` uppercase, `row-hover`, wrapper `overflow-x-auto`), todo em PT-BR — o front só formata e injeta o que o endpoint devolve.

## Comportamentos

- **Card novo:** `<section class="card p-5 fade-in" data-tab="leads">` na aba Leads (sugestão: entre "Leads por funil" e "Leads recentes"), título "Conversão por LP" e subtítulo explicativo (ex.: "Visitantes únicos por landing page vs. leads capturados, sem bots").
- **Tabela:** 4 colunas — "LP" (esquerda), "Visitantes", "Leads" e "Taxa de conversão" (direita, fonte `mono` para números). `<tbody id="conversion-tbody">` com placeholder "Carregando…" (`colspan` centralizado, como os outros cards).
- **`loadConversion()`:** busca `/api/conversion?${periodQuery}${funnelQuery}` via o helper `fetchJson` existente (que já anexa a `key`) e renderiza `data.rows` no tbody.
- **Carga inicial:** `loadConversion()` entra no `Promise.all` de `loadAll()`.
- **Filtro de data:** usa a variável `periodQuery` existente; recarrega via o `loadAll()` que os botões 7/30/90 e o intervalo personalizado já chamam — sem novos listeners de data.
- **Filtro de funil:** o listener `change` do `#funnel-picker` (que hoje chama só `loadLeads()`) passa a chamar **também** `loadConversion()`.
- **Renderização por linha:** `lp` escapado com `escapeHtml`; `visitors` e `leads` com `fmtInt` (pt-BR); `rate` como percentual pt-BR com 1 casa decimal (ex.: `0.0325` → "3,3%") — formatação é só apresentação, o valor vem pronto.
- **Ordenação:** exibe na ordem que chega do endpoint (visitantes desc) — o front não reordena nem recalcula nada.
- **LP sem lead:** linha normal com Leads "0" e taxa "0,0%". Bucket `(sem página)` renderizado como qualquer outra linha.
- **Estado vazio:** `rows` ausente/vazio → linha única centralizada "Nenhuma visita no período." (ou "Nenhuma visita deste funil no período." com funil ativo — mesmo padrão condicional do `loadLeads()`).
- **Erro:** exceção no fetch ou resposta com `error` → linha única "Não foi possível carregar a conversão por LP." em vermelho (`--accent-red`), com o `catch` dentro de `loadConversion()` para não quebrar o restante do `loadAll()`.
- **Somente-leitura:** linhas sem clique, sem modal, sem aplicar filtros (diferente de "Leads recentes").

## Dependências

- **Issue 55** (`/api/conversion`) — ✅ implementada (`functions/api/conversion.js`). Devolve `{ days, funnel, rows: [{ lp, visitors, leads, rate }] }` com `rate` como fração 0–1 (nunca `NaN`/`null`), ordenado por `visitors` desc (empate: `lp` alfabético); erro = `{ error: '...' }` com status 401/500. Esta seção não calcula nada, só exibe.

## Cenários

### Happy Path

1. Usuária abre o dash com a `key` válida → `openDashboard()` chama `loadAll()`.
2. `loadConversion()` (dentro do `Promise.all`) faz `fetchJson('/api/conversion?days=30')` — `fetchJson` já anexa `&key=`.
3. Resposta chega com `rows` (ex.: `[{ lp: '/lives-semanais-v1', visitors: 812, leads: 26, rate: 0.032 }, ...]`).
4. `#conversion-tbody` troca o "Carregando…" pelas linhas, na ordem recebida: `/lives-semanais-v1 | 812 | 26 | 3,2%`.
5. Usuária clica em "7 dias" → o listener existente de `#range-picker` atualiza `periodQuery` e chama `loadAll()` → a tabela recarrega junto com tudo, sem código novo de data.
6. Usuária seleciona um funil no `#funnel-picker` → o listener atualiza `funnelQuery` e chama `loadLeads()` **e** `loadConversion()` → a tabela passa a mostrar só as LPs/leads daquele funil.

### Edge Cases

- **`rows` vazio ou ausente** (`!data.rows || data.rows.length === 0`): linha única `colspan="4"` centralizada — "Nenhuma visita no período." sem funil ativo, "Nenhuma visita deste funil no período." com funil ativo (mesmo condicional `funnelQuery ? ... : ...` do `loadLeads()`).
- **`rate: 0`** (LP com visitantes e 0 leads): formatador exibe "0,0%"; a linha aparece normalmente com Leads "0" — LP que não converte é informação, não é omitida.
- **`lp: '(sem página)'`**: bucket vem pronto do backend; renderiza como qualquer linha (passa pelo `escapeHtml` normalmente — não contém HTML).
- **Troca de período**: já coberta — os botões 7/30/90 e o "Aplicar" do intervalo personalizado chamam `loadAll()`, que agora inclui `loadConversion()`. **Nenhum listener novo de data.**
- **Troca de funil**: o listener `change` do `#funnel-picker` ganha a chamada `loadConversion()` ao lado do `loadLeads()` existente; o comentário acima do listener ("afeta só o KPI Leads e a tabela Leads recentes") é atualizado para citar também a conversão por LP.
- **Lista longa de LPs**: renderiza **todas** as linhas, sem limite nem `max-height` — o site tem poucas páginas distintas (o endpoint normaliza path e agrega), então dezenas de linhas é o teto realista; o wrapper `overflow-x-auto` cuida só do transbordo horizontal em telas estreitas, como nas outras tabelas. Não adicionar paginação/scroll vertical (seria funcionalidade além do pedido).
- **`rate` no limite** (`1` = 100%): `Intl.NumberFormat` pt-BR com `style: 'percent'` exibe "100,0%" sem tratamento especial.

### Cenário de Erro

- `fetch` lança (rede) **ou** a resposta traz `error` (401/500 — atenção: o `fetchJson` existente não checa `r.ok`, então um 500 resolve normalmente com `{ error }`; `loadConversion()` deve checar `data.error` e lançar).
- O `catch` **interno** de `loadConversion()` escreve no tbody a linha única `colspan="4"` centralizada "Não foi possível carregar a conversão por LP." com `text-[color:var(--accent-red)]`.
- Como `loadConversion()` nunca rejeita (catch interno), o `Promise.all` do `loadAll()` não é derrubado — KPI Leads, Leads por funil, Leads recentes e Saúde continuam carregando normalmente.

## Arquivos

- **Modificar:** `public/dash/index.html` — **único arquivo tocado**. Quatro pontos de edição:

### 1. HTML do card (aba Leads)

Inserir a nova `<section>` **imediatamente após** o fechamento da section "Leads por funil" (hoje linhas 100–105, fecha em `</section>` na linha 105) e antes da section "KPIs de venda" (`data-tab="vendas"`). As seções são filtradas por `data-tab` pelo `setupDashTabs()`, então na aba Leads o card aparece entre "Leads por funil" e "Leads recentes", como sugere a spec. Sem classe `hidden` (a aba Leads é a padrão, igual às demais sections `data-tab="leads"`).

Estrutura, clonando o padrão do card "Detalhamento por UTM" (linhas 236–264) e o cabeçalho com subtítulo de "Leads recentes" (linhas 268–273):

```html
<!-- Conversão por LP (aba Leads) -->
<section class="card p-5 fade-in" data-tab="leads">
  <div class="flex items-center justify-between mb-3">
    <div>
      <div class="font-semibold">Conversão por LP</div>
      <div class="text-xs text-[color:var(--muted)]">Visitantes únicos por landing page vs. leads capturados, sem bots</div>
    </div>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-xs uppercase tracking-wider text-[color:var(--dim)] border-b border-[color:var(--border)]">
        <tr>
          <th class="text-left py-2 pr-4">LP</th>
          <th class="text-right py-2 pr-4">Visitantes</th>
          <th class="text-right py-2 pr-4">Leads</th>
          <th class="text-right py-2">Taxa de conversão</th>
        </tr>
      </thead>
      <tbody id="conversion-tbody" class="mono">
        <tr><td colspan="4" class="py-6 text-center text-[color:var(--muted)]">Carregando…</td></tr>
      </tbody>
    </table>
  </div>
</section>
```

Reuso: `.card p-5 fade-in`, `data-tab="leads"`, `font-semibold` + `text-xs text-[color:var(--muted)]`, thead uppercase idêntico ao de `#utm-tbody`/`#leads-tbody`, `tbody class="mono"` (números tabulares como no card UTM; a coluna LP recebe `font-sans` no `<td>`, igual à coluna "Valor" do UTM), placeholder `colspan="4"` no mesmo formato dos outros. **Nenhum CSS novo.**

### 2. Função `loadConversion()`

Inserir no bloco `// -------- Carregadores de dados --------`, logo após `loadLeads()` (que termina na linha ~604), seguindo o formato dos loaders existentes:

```js
// Conversão por LP: visitantes × leads × taxa vêm prontos do /api/conversion
// (issue 55) — aqui só formata e injeta; nada é calculado nem reordenado.
async function loadConversion() {
  const tbody = qs('#conversion-tbody');
  try {
    const data = await fetchJson(`/api/conversion?${periodQuery}${funnelQuery}`);
    if (data.error) throw new Error(data.error);
    if (!data.rows || data.rows.length === 0) {
      const emptyMsg = funnelQuery ? 'Nenhuma visita deste funil no período.' : 'Nenhuma visita no período.';
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[color:var(--muted)]">${emptyMsg}</td></tr>`;
      return;
    }
    tbody.innerHTML = data.rows.map(r => `
      <tr class="row-hover border-b border-[color:var(--border)]">
        <td class="py-2 pr-4 font-sans">${escapeHtml(r.lp)}</td>
        <td class="py-2 pr-4 text-right">${fmtInt(r.visitors)}</td>
        <td class="py-2 pr-4 text-right">${fmtInt(r.leads)}</td>
        <td class="py-2 text-right">${fmtRate(r.rate)}</td>
      </tr>
    `).join('');
  } catch (_) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-[color:var(--accent-red)]">Não foi possível carregar a conversão por LP.</td></tr>';
  }
}
```

Diferenças deliberadas vs. `loadLeads()`/`loadUtm()`: `try/catch` interno (requisito de erro isolado — os outros loaders não têm, aqui é obrigatório), **sem** `cursor-pointer`, **sem** `data-idx` e **sem** `addEventListener` nas linhas (somente-leitura).

### 3. Helper de formatação da taxa

Adicionar **um** helper novo no bloco `// -------- Helpers --------`, ao lado de `money`/`fmtInt` (linhas 442–443), no mesmo estilo `Intl.NumberFormat` pt-BR:

```js
const fmtRate = r => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(r || 0));
```

`style: 'percent'` recebe a **fração** que o backend devolve e produz o percentual pt-BR com vírgula e 1 casa: `0.0325` → "3,3%", `0` → "0,0%", `1` → "100,0%". O front não faz nem a multiplicação por 100 — é só formatação de apresentação.

### 4. Pontos de integração

- **`loadAll()`** (linhas 892–902): adicionar `loadConversion(),` à lista do `Promise.all` — sugerido logo após `loadLeads(),`. Isso cobre a carga inicial **e** os filtros de data (botões 7/30/90 na linha 913 e `#apply-range` na linha 936 já chamam `loadAll()`).
- **Listener do `#funnel-picker`** (linhas 941–945): acrescentar `loadConversion();` após `loadLeads();` e ajustar o comentário das linhas 939–940 para mencionar que o funil agora afeta também a conversão por LP.

**Não tocar:** `fetchJson`, `fmtInt`, `escapeHtml`, `periodQuery`/`funnelQuery` (usar como estão), `setupDashTabs`, nenhum endpoint, nenhum outro arquivo.

## Checklist

- [x] Section nova `class="card p-5 fade-in" data-tab="leads"` inserida entre a section "Leads por funil" e a section "KPIs de venda" no HTML (na aba Leads fica entre "Leads por funil" e "Leads recentes")
- [x] Título "Conversão por LP" (`font-semibold`) e subtítulo "Visitantes únicos por landing page vs. leads capturados, sem bots" (`text-xs text-[color:var(--muted)]`)
- [x] Tabela com wrapper `overflow-x-auto`, thead uppercase no padrão existente, 4 colunas: "LP" (`text-left`), "Visitantes", "Leads", "Taxa de conversão" (`text-right`), `tbody id="conversion-tbody" class="mono"`
- [x] Placeholder inicial `<tr><td colspan="4" class="py-6 text-center text-[color:var(--muted)]">Carregando…</td></tr>`
- [x] Helper `fmtRate` com `Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })` junto aos demais helpers
- [x] `loadConversion()` criada após `loadLeads()`, usando `fetchJson`, `periodQuery` e `funnelQuery` existentes, com `if (data.error) throw` (o `fetchJson` não checa `r.ok`)
- [x] Linhas com `escapeHtml(r.lp)` + `font-sans` na 1ª coluna, `fmtInt` em visitantes/leads, `fmtRate(r.rate)` na taxa; classes `row-hover border-b` sem `cursor-pointer`, sem `data-idx`, sem listener de clique
- [x] Estado vazio condicional: "Nenhuma visita deste funil no período." com `funnelQuery`, senão "Nenhuma visita no período."
- [x] `catch` interno renderizando "Não foi possível carregar a conversão por LP." em `text-[color:var(--accent-red)]` — `loadConversion()` nunca rejeita o `Promise.all`
- [x] `loadConversion()` adicionada ao `Promise.all` de `loadAll()`; **nenhum** listener novo de data criado
- [x] Listener `change` do `#funnel-picker` chamando `loadLeads()` **e** `loadConversion()`, com o comentário acima atualizado
- [x] Nenhum cálculo/reordenação no front (ordem = a do endpoint); nenhum CSS novo; nenhum outro arquivo tocado
- [x] Verificar em preview: tabela carrega na aba Leads, "3,25%" nunca aparece (sempre 1 casa: "3,3%"), responde a 7/30/90/personalizado e ao funil, e com o endpoint falhando (key inválida na chamada, por ex.) só este card mostra erro e o resto do dash carrega — verificado localmente com `wrangler pages dev dist` + D1 local semeado (taxas "50,0%"/"100,0%"/"0,0%", filtro de funil, estados vazios condicionais e erro isolado sem derrubar o restante do `loadAll()`)

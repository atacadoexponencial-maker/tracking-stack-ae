# 336: Protótipo da tela Instagram (Central de Marketing)

**Tipo:** Protótipo
**Página:** Dash (`public/dash/index.html`), grupo novo **Marketing** → **Instagram** — spec `spec-central-marketing-instagram.md`, módulos 2 a 9

## Descrição

Levar para dentro do dash de verdade o desenho da prévia aprovada em 29/09: grupo
Marketing no menu, cabeçalho com frescor dos dados, as quatro sub-abas
(Crescimento, Conteúdo, Stories, Público) e os estados de carregamento, erro e
"coleta ainda não rodou", alimentados por um arquivo de exemplo com o formato que
os endpoints vão devolver.

## Pronto quando

Abrindo o dash localmente, o item Marketing → Instagram mostra as quatro sub-abas
com todos os blocos da spec (inclusive vazio, coleta atrasada, "inclui anúncios",
impulsionado, story "no ar" e "captura parcial", público de quem interagiu vazio),
no computador e no celular, e a usuária confirmou que ficou igual à prévia.

## Observações

- A prévia aprovada (HTML com dados reais) está no scratchpad da sessão de 29/09 e
  é a referência visual; ela não entra no repositório.
- Os dados de exemplo **não entram no repositório**: o proxy local responde os
  endpoints com um arquivo do scratchpad, como foi feito na issue 307.
- O /plan desta issue fixa o **contrato dos endpoints** (formato do JSON) que as
  issues 340 a 343 implementam. O backend entrega tudo calculado (orgânico,
  saldo, taxa de engajamento, conversão de fuso); a tela só exibe.
- Branch própria, sem merge na `main` até a 340 existir em produção.

## Mudança de rota (30/09/2026)

As coletas (337–339) já estão no ar, então não há por que desenhar com dados de
exemplo. A tela é construída **ligada à Neon de verdade** no branch
`central-marketing`, e a usuária vê no **link de prévia do Pages**
(`central-marketing.tracking-ae.pages.dev/dash/`) — ela prefere validar no ar.
Um commit por issue (336 casca e cabeçalho, 340 Crescimento, 341 Conteúdo, 342
Stories, 343 Público). **Nada vai para a `main` sem o ok dela na prévia.**

**Alcance não soma:** a Meta entrega alcance único por dia; somar dias conta a
mesma pessoa várias vezes. O cartão vira **"Alcance médio por dia"** (padrão do
Metricool). Visualizações e interações somam.

## Cenários

### Happy Path
1. Depois da chave de acesso, Marketing → Instagram abre a sub-aba Crescimento.
2. A tela chama `/api/marketing/instagram/resumo` (cabeçalho) e o endpoint da
   sub-aba aberta, com o `from`/`to` e o período anterior do filtro do dash.
3. Tudo chega calculado; a tela só desenha.
4. Trocar de sub-aba chama só o endpoint dela; o estado mora na URL (`#instagram?v=conteudo`).

### Edge Cases
- Coleta ainda não rodou para o período: bloco explica que os números aparecem
  depois da primeira coleta.
- Coleta atrasada (última bem-sucedida há mais de 26h na diária ou 3h nos
  stories): aviso âmbar com hora e motivo da última falha.
- Dia sem coleta: lacuna no gráfico, nunca zero.
- Público de quem interagiu vazio: aviso em vez de gráfico.
- Métrica que não se aplica ao formato: "—" (a regra do DESIGN.md para sem dado),
  nunca zero.

### Cenário de Erro
- Neon fora ou sem credencial: o bloco mostra erro com "Tentar de novo"; o resto
  da tela continua.
- Chave errada: 401, igual às outras rotas do dash.

## Banco de Dados

Só leitura, papel `marketing_ro`, schema `marketing` (tabelas da 337–339).
Nenhuma tabela nova.

## Arquivos (branch `central-marketing`)

- **Criar:** `functions/api/_marketing-db.js` — conexão Neon com `MARKETING_RO_DATABASE_URL` (espelho de `_argo-db.js`)
- **Criar:** `functions/api/_ig-painel.js` — funções puras que montam cada resposta (cabeçalho e frescor, crescimento, conteúdo, stories, público); testáveis com `node --test`
- **Criar:** `functions/api/marketing/instagram/resumo.js`, `crescimento.js`, `conteudo.js`, `stories.js`, `publico.js` — rotas GET: chave (`recusarSemChave` de `_argo-auth.js`), consulta, `_ig-painel.js`
- **Criar:** `tests/ig-painel.test.js` — testes das funções puras
- **Modificar:** `public/dash/index.html` — grupo Marketing no menu, `#secao-instagram`, CSS da tela, `R.instagram`, sub-abas; reaproveita `tile`, `deltaChip`, `grafico` (ganha lacunas e marcas de publicação, sem mudar quem já usa) e cria `barrasIg` (barras verticais para seguidores e horários)

## Dependências Externas

- `@neondatabase/serverless` — já no `package.json` (usado pelo Argo)
- Variável `MARKETING_RO_DATABASE_URL` no Pages (produção e prévia), gravada pela API da Cloudflare sem BOM

## Checklist

- [ ] Branch `central-marketing`
- [ ] `tests/ig-painel.test.js` e `_ig-painel.js` até passar
- [ ] `_marketing-db.js` e as 5 rotas
- [ ] Tela no `index.html` (menu, casca, cabeçalho, 4 sub-abas, estados)
- [ ] `MARKETING_RO_DATABASE_URL` em prévia e produção
- [ ] Push do branch, conferir a prévia no computador e no celular
- [ ] Ok da usuária na prévia → merge na `main`

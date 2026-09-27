# 325: Protótipo — Registro com veredito e placar na aba Argo

**Tipo:** Protótipo
**Página:** Dash → aba Argo → vista Controle (card Registro e bloco Régua) — spec `spec-argo-veredito-acoes.md`, módulos 3, 4 e 6

## Descrição

Desenhar, com dados fictícios servidos por um proxy local (nunca no repo), como a vista Registro fica com o selo de veredito em cada ação, o detalhe antes × depois ao abrir, os cartões do placar no topo e os campos novos da régua de avaliação. A gestora aprova o visual antes de qualquer backend.

## Pronto quando

Abrindo `localhost:8788/dash/#argo` com o proxy de fixtures na frente do `wrangler pages dev`, o card Registro mostra: cartões do placar (geral do Argo, um por tipo, manual) com taxa, "—" quando vazio e aviso "régua alterada em DD/MM"; lista de ações com selos *Acertou* (verde), *Errou* (coral), *Inconclusivo* (âmbar), *Aguardando — avalia em DD/MM* (neutro) e *Sem avaliação — desfeita/não aplicada*; uma linha "manual"; filtro por veredito; detalhe com tabela antes × depois; e, no bloco Régua, o grupo "Avaliação do resultado" com janela, pisos por bloco, tolerância, limite de releitura e chave de mudanças manuais. Segue o `DESIGN.md` (fundo escuro, Satoshi, verde alta/coral queda/âmbar alerta, números tabulares). Prints em 1440px e 390px para a gestora aprovar.

## Onde o protótipo vive

Como nas issues 307 e 308: o protótipo é a **tela de verdade** em
`public/dash/index.html`, numa branch `argo-veredito`, desenhada a partir do
contrato de dados fixado aqui. O proxy local do scratchpad intercepta
`GET /api/argo/registro` e `GET /api/argo/config` (acrescenta os campos novos
às respostas reais ou devolve fixtures inteiras) e repassa o resto ao
`wrangler pages dev . --port 8788`. `POST /api/argo/config` no proxy recusa
gravação. Nada de fixture entra no repositório.

A branch pode ir para a `main` **antes** do backend existir: todos os campos
novos são opcionais e a tela trata ausência como "veredito indisponível" e
"régua de avaliação ainda não disponível". Isso é o contrário da 307 (que
chamava endpoint inexistente) e é intencional: o protótipo já é a tela final.

## Contrato de dados (as issues 328, 329 e 330 implementam)

Thin client: a tela **não calcula** veredito, "aguardando até", taxa nem
aviso de régua. Tudo chega pronto e a aba só desenha. Rótulos em português
moram na tela (como `ARGO_ROTULOS`); a classificação mora no backend.

### `GET /api/argo/registro` — campos novos por ação e um bloco de placar

```json
{
  "cabecalho": { "...": "como hoje" },
  "placar": {
    "periodo": { "de": "2026-08-28", "ate": "2026-09-27", "preset": 30 },
    "regua_alterada_em": "2026-09-23T14:10:00Z",
    "manuais_ligadas": true,
    "cartoes": [
      { "chave": "argo",  "origem": "argo",   "tipo": null,
        "avaliadas": 12, "acertos": 8, "erros": 2, "inconclusivas": 2,
        "taxa_pct": 80, "gasto_erradas_centavos": 41250 },
      { "chave": "pausar_campanha_trafego", "origem": "argo", "tipo": "pausar_campanha_trafego",
        "avaliadas": 5, "acertos": 4, "erros": 1, "inconclusivas": 0, "taxa_pct": 80, "gasto_erradas_centavos": 10300 },
      { "chave": "reduzir_orcamento", "origem": "argo", "tipo": "reduzir_orcamento",
        "avaliadas": 3, "acertos": 0, "erros": 0, "inconclusivas": 3, "taxa_pct": null, "gasto_erradas_centavos": 0 },
      { "chave": "manual", "origem": "manual", "tipo": null,
        "avaliadas": 0, "acertos": 0, "erros": 0, "inconclusivas": 0, "taxa_pct": null, "gasto_erradas_centavos": 0 }
    ]
  },
  "rodadas": [{
    "...": "como hoje",
    "acoes": [{
      "...": "como hoje (alvo_nome, desfecho, motivo)",
      "origem": "argo",
      "veredito": {
        "situacao": "acertou",
        "situacao_rotulo": "Acertou",
        "motivo": "Custo por visita das campanhas ativas ficou em R$ 0,21, abaixo da referência de R$ 0,25.",
        "avaliada_em": "2026-09-27T11:52:00Z",
        "janela_dias": 7,
        "numeros": [
          { "rotulo": "Custo por visita", "antes": "R$ 0,74", "depois": "R$ 0,21", "referencia": "referência R$ 0,25" },
          { "rotulo": "Gasto", "antes": "R$ 32,59", "depois": "R$ 28,10" },
          { "rotulo": "Visitas", "antes": "44", "depois": "134" }
        ]
      }
    }]
  }]
}
```

`veredito.situacao` ∈ `acertou`, `errou`, `inconclusivo`, `aguardando`,
`avaliando`, `sem_avaliacao`, `indisponivel`. Para `aguardando` vem
`"avalia_em": "2026-10-02"`; para `sem_avaliacao` e `inconclusivo` o `motivo`
já traz a frase ("desfeita antes da janela", "não aplicada", "anterior ao
módulo", "alvo mudou de novo em 24/09 antes de completar a janela"). Campo
`veredito` **ausente** ou `null` = a tela mostra "veredito indisponível".
Ação com `origem: "manual"` traz `"feita_por": "não identificado"` ou o nome.

### `GET /api/argo/config` — chaves novas dentro de `regua`

Entram em `regua.valores`, `regua.padroes`, `regua.limites` e `regua.ativas`
pelo mesmo `montarRegua`, sem formato novo:

| chave | tipo | padrão | min–max |
|---|---|---|---|
| `avaliacao_janela_dias` | inteiro | 7 | 1–30 |
| `avaliacao_piso_visita_reais` | número | 30 | 0–5000 |
| `avaliacao_piso_lead_multiplicador` | número | 3 | 1–10 |
| `avaliacao_tolerancia_pct` | inteiro | 30 | 0–100 |
| `avaliacao_releitura_dias` | inteiro | 3 | 0–30 |
| `avaliacao_manuais` | booleano | true | — |

No protótipo, `ativas` **não** inclui essas chaves: a tela já mostra o aviso
"Ainda sem efeito — entra em vigor com a régua nova", que o código atual
produz sozinho para chave fora de `ativas`.

## Cenários

### Happy Path
1. Abrir `#argo`: o card Registro ganha, acima da lista de rodadas, o bloco de placar com os cartões (grid reutilizando `.grid-kpi`/`.kpi`), o seletor de período (30/60/90/personalizado, mesmos valores do seletor global, mas local ao placar) e, quando houver, o aviso "régua alterada em DD/MM".
2. Cada `<li>` de ação dentro da rodada mostra o selo de veredito ao lado do desfecho (reusando `.argo-resultado` com variantes `ok`, `falha`, `desconhecido` e uma neutra nova para "aguardando").
3. Clicar na ação abre um `<details>` com o motivo em uma frase e a tabela antes × depois (3 colunas: rótulo, antes, depois; referência em `small`), reaproveitando o padrão visual de `.argo-numero`.
4. Filtro por veredito: pílulas `.tipo-pill` acima da lista (Todas · Acertos · Erros · Inconclusivas · Aguardando · Manuais). Filtrar esconde rodadas que ficarem sem ação visível.
5. Clicar num cartão de tipo do placar aplica o filtro por aquele tipo e rola até a lista.
6. No bloco Régua, grupo novo "Avaliação do resultado" em `ARGO_REGUA_GRUPOS` com as seis chaves (a booleana `avaliacao_manuais` como chave liga/desliga de um texto explicativo, sem número).

### Edge Cases
- Placar sem ação avaliada conclusiva: taxa "—" (usar `.kpi .semdado`), nunca "0%"; cartão com só inconclusivas mostra o total e "—" na taxa.
- Cartão manual com `manuais_ligadas: false` → "desligado".
- Ação dentro da janela → selo "Aguardando" com "avalia em DD/MM" (data vem pronta em `avalia_em`; a tela só formata com `toLocaleDateString('pt-BR')`).
- Ação `avaliando` → selo "Aguardando" com "avaliando agora".
- Ação desfeita → "Sem avaliação — desfeita"; a linha continua clicável só se houver `numeros`.
- Número faltando em antes ou depois → "—".
- Rodada com todas as ações filtradas → rodada escondida; lista vazia após filtro → "Nenhuma ação com este veredito no período."
- Celular (390px): cartões em coluna única, tabela antes × depois com rótulo em cima e antes/depois lado a lado.

### Cenário de Erro
- Resposta sem `placar` → bloco do placar mostra "não foi possível ler o placar" e a lista de rodadas aparece normal.
- Ação sem `veredito` → selo neutro "veredito indisponível"; nada mais muda na linha.
- `regua` sem as chaves novas → o grupo "Avaliação do resultado" mostra os padrões esmaecidos com o aviso de "ainda sem efeito" (comportamento atual para chave fora de `ativas`); se `regua.valores` não existir, o bloco inteiro já cai no aviso atual "A régua ainda não está disponível neste servidor".

## Banco de Dados

Não se aplica: protótipo sem backend. As tabelas nascem na 326 e 331.

## Arquivos

- **Modificar:** `public/dash/index.html`
  - HTML de `#secao-argo`: dentro do card Registro, `div#argo-placar` (cartões + período + aviso) e `div#argo-filtro-veredito` (pílulas) antes de `#argo-registro`. O `<h2>` do card ganha o `<small>` "com o veredito de cada ação".
  - CSS: `.argo-placar` (grid de `.kpi` com `.rotulo`/`.valor`/`.semdado`), `.argo-placar-grupo` (Argo · por tipo · manual), `.argo-veredito` (selo, variantes `ok`/`falha`/`alerta`/`neutro`, herdando de `.argo-resultado`), `.argo-antes-depois` (tabela 3 colunas com `tabular-nums`, coluna única no celular), `.argo-regua-grupo` já existe.
  - JS:
    - `ARGO_VEREDITO_CLASSE` ao lado de `ARGO_DESFECHO_CLASSE`: mapeia `situacao` → classe visual; rótulo vem de `situacao_rotulo`, nunca da tela.
    - `desenharRegistroArgo(rodadas)`: cada ação passa a incluir `argoVereditoSeloHtml(a.veredito)` e, quando há `numeros`, um `<details>` com `argoAntesDepoisHtml(a.veredito)`. Respeita `argoFiltroVeredito`.
    - `desenharPlacarArgo(placar)` novo, chamado por `carregarArgo()` com `registro.placar`; reusa `argoQuando` para o aviso de régua e `argoRotulo` para o título dos cartões por tipo.
    - `argoFiltroVeredito` (estado) + clique nas pílulas e nos cartões, pelo mesmo `document.addEventListener('click')` que já trata `[data-argo-vista]`.
    - `ARGO_REGUA_GRUPOS`: grupo novo "Avaliação do resultado" com as cinco chaves numéricas no formato `[chave, rótulo, frase, unidade, tipo, liga?]` já usado. A booleana `avaliacao_manuais` entra como linha própria só com o interruptor, sem número: pequeno ajuste em `desenharReguaArgo` para desenhar só `chaveLiga` quando a linha vier sem chave numérica (`[null, rótulo, frase, null, null, 'avaliacao_manuais']`).
- **Não versionado (scratchpad da sessão):** `proxy-argo-veredito.mjs` (servidor Node que reescreve as duas rotas e repassa o resto para `:8788`) e as fixtures `argo-registro-veredito.json` e `argo-config-veredito.json`, uma amostra de cada situação.

## Código a reutilizar (não recriar)

- `argoApi`, `comFallback`, `carregarArgo` — leitura; nenhuma chamada nova.
- `argoQuando`, `esc`, `$` — formatação e escape.
- `argoNumerosHtml` — base visual dos números; a tabela antes × depois é uma variante com duas colunas de valor.
- `.argo-resultado` e variantes; `.grid-kpi`/`.kpi`/`.semdado`; `.tipo-pill[aria-pressed]`; `.argo-regua-grupo`/`desenharReguaArgo`.
- `ARGO_ROTULOS`/`argoRotulo` para os títulos dos cartões por tipo (acrescentar `reativar_anuncio`, hoje ausente).
- Padrão do proxy das issues 307/308.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Criar a branch `argo-veredito` a partir da `main` atualizada (`git fetch` + rebase antes).
- [x] Proxy local + fixtures no scratchpad com uma amostra de cada situação (7 situações de veredito, cartão vazio, cartão só inconclusivas, manual desligado, régua alterada). Modos do proxy: `cheio`, `vazio`, `sem-novos`, `manuais-desligadas` (arquivo `modo.txt`).
- [x] Bloco do placar: cartões, período local, aviso de régua, "—" sem dado, clique filtra.
- [x] Selo de veredito em cada ação; "veredito indisponível" quando ausente.
- [x] Detalhe antes × depois com motivo e referência.
- [x] Filtro por veredito e por manuais; estado vazio após filtro.
- [x] Grupo "Avaliação do resultado" na régua com as seis chaves, esmaecido como "ainda sem efeito".
- [x] Ausência de `placar`/`veredito`/chaves novas não quebra nada (modo `sem-novos` do proxy: 0 erros de console, 10 selos "indisponível", grupo da régua ausente, Salvar não trava).
- [x] Prints em 1440px e 390px para a gestora aprovar (`.playwright-mcp/print-1440-argo.png`, `print-1440-registro.png`, `print-1440-placar-vazio.png`, `print-390-registro.png`; pasta ignorada pelo git).
- [x] `npm test` verde (836).
- [ ] Aprovação visual da gestora.

## Desvios do plano (registrados na execução, 27/09)

- **Régua sem as chaves novas NÃO desenha o grupo esmaecido**, ao contrário do
  cenário de erro escrito no plano. Motivo: um campo numérico vazio trava o
  Salvar da grade inteira (`sincronizarReguaArgo`) e mandaria ao backend uma
  chave que `validarRegua` recusa. Regra adotada: regra cuja chave não está em
  `regua.valores` não é desenhada; grupo sem regra conhecida some. O "ainda
  sem efeito" aparece quando o backend manda a chave fora de `ativas` (é o que
  a 328 fará até a régua valer).
- A classe `argo-acao` já existia (linhas da grade, `display: grid`); o
  detalhe da ação usa `argo-acao-detalhe`.
- `ARGO_ROTULOS` ganhou `reativar_anuncio` (faltava; aparece no placar).
- O período do placar manda `placar_dias` / `placar_de` / `placar_ate` na
  query de `/api/argo/registro`; hoje o backend ignora. Contrato para a 330.

# S1-01: Protótipo da aba "Cloudflare" no dash

**Tipo:** Protótipo
**Página:** Aba "Cloudflare" do dash
**Spec:** `spec-uso-cloudflare.md`

## Descrição

Criar a aba "Cloudflare" no dash com os quatro blocos da spec (hoje contra o teto, por projeto, últimos 30 dias, mês corrente) e o rodapé de origem, preenchidos com números de exemplo fixos e marcados como exemplo. Ainda não há leitura da Cloudflare.

## Pronto quando

A gestora abre a aba "Cloudflare" no dash e vê o layout completo com números de exemplo: a barra de hoje nas três cores (verde, amarela e vermelha, com a palavra ao lado), a lista por projeto, os 30 dias com os estouros de CPU e o teto de referência, o total do mês, o rodapé "lido às" e o estado "indisponível". Ela aprova o visual antes de os números reais entrarem.

## Critérios de aceite

Nenhum.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-05 | A barra de hoje não muda de cor nem dá alerta perto do teto. Mostra só número e porcentagem. | invalidada | Marcelle, 15/10: a barra muda de cor (verde até 60%, amarelo de 60% a 80%, vermelho acima de 80%), ver CA-S1-13 |
| SUP-S1-06 | O teto de 100 mil aparece como texto no título do gráfico dos 30 dias ("teto: 100.000 por dia"), não como linha no gráfico: com os dias em torno de 10 mil, uma linha em 100 mil achataria as barras até ficarem ilegíveis. Os estouros de CPU aparecem como barras vermelhas para baixo no mesmo gráfico. | confirmada | Marcelle, 15/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-04 | Onde fica no dash? | respondida | Aba nova "Cloudflare". Marcelle, 15/10 |

## Cenários

### Happy Path
1. A gestora abre o dash, vai em Números → Diagnóstico → **Cloudflare** (`#cloudflare`).
2. O topo mostra o título "Cloudflare" e, no lugar das datas, a nota "uso da conta · não usa o filtro de datas".
3. A aba mostra o selo **PROTÓTIPO · números de exemplo** e os blocos, nesta ordem:
   - **Hoje contra o teto:** etiqueta com "35.000 de 100.000", a régua preenchida em 35%, o carimbo "folga" em verde e a nota "zera às 21h de Brasília".
   - **Por projeto hoje:** tabela com tracking-ae 30.000 e painel 5.000, do maior para o menor, e a linha de total.
   - **Últimos 30 dias:** gráfico de barras com o total de cada dia, o teto de 100 mil escrito no título (ver SUP-S1-06), os estouros de CPU para baixo em vermelho e, abaixo, uma tabela com dia, requisições e estouros de CPU (o exemplo inclui 12/10 com 9.649 e 874).
   - **Mês corrente:** duas etiquetas, uma com as requisições acumuladas e outra com os estouros de CPU, sem régua nem porcentagem.
   - **Rodapé:** "lido às 14:05 (horário de Brasília)".
4. Um seletor "ver estado do exemplo" troca o exemplo entre **folga** (35 mil), **atenção** (70 mil), **perto do teto** (92 mil) e **indisponível**, para a gestora aprovar cada cor.

### Edge Cases
- **Celular:** a tabela dos 30 dias vira lista empilhada e o gráfico encolhe sem rolagem lateral.
- **Dia com zero no exemplo:** um dos 30 dias aparece com 0 e 0, para mostrar que o dia não some da lista.

### Cenário de Erro
- No estado **indisponível**, todos os blocos de número somem e aparece um aviso: "Números de uso indisponíveis: credencial recusada pela Cloudflare." Nenhum bloco mostra 0.

## Prova

Protótipo sem critérios de aceite: nada a provar por teste. A aprovação do visual pela gestora é o "pronto".

## Banco de Dados

Não se aplica.

## Arquivos

- **Criar:** `public/dash/cloudflare.js` — desenha a aba com os números de exemplo fixos e o seletor de estado. Segue o padrão de `argo-contexto.js`: IIFE que expõe `window.CloudflareUso.abrir(raiz, ctx)` e recebe `esc`/`fmt` do index. Na S1-02 os números de exemplo saem e entra a chamada ao backend.
- **Modificar:** `public/dash/index.html` — (1) link `<a href="#cloudflare" data-secao="cloudflare">Cloudflare</a>` no grupo Diagnóstico, depois de "Saúde das integrações"; (2) `<section class="secao" id="secao-cloudflare">` vazia, preenchida pelo JS; (3) `cloudflare: 'Cloudflare'` em `TITULOS` e `cloudflare: { nota: 'uso da conta · não usa o filtro de datas' }` em `FILTROS`; (4) `R['cloudflare']` chamando `CloudflareUso.abrir`; (5) `<script src="/dash/cloudflare.js"></script>` junto dos outros; (6) poucas regras CSS `.cf-*` só para a linha do teto no gráfico e as cores da régua por faixa.

Reaproveitados do dash, sem criar outros: `.etiqueta`/`.grid-etiquetas` (números), `.regua` (barra contra o teto, a mesma das metas), `.carimbo.alta`/`.carimbo.alerta`/`.carimbo.queda` (verde, amarelo e vermelho com palavra), `.bloco` + `.tabela-wrap`, `.aviso.falha` (indisponível), `.em-proto`/`.em-proto__selo` (selo de protótipo), `.grafico .barra` (barras dos 30 dias).

## Dependências Externas

Nenhuma.

## Checklist

- [x] Criar `public/dash/cloudflare.js` com os quatro blocos, o rodapé, o seletor de estado e o estado indisponível
- [x] Ligar a aba em `public/dash/index.html` (nav, seção, TITULOS, FILTROS, R, script, CSS `.cf-*`)
- [x] Conferir em largura de computador e de celular sem rolagem lateral
- [x] Publicar na prévia e pedir a aprovação visual da gestora

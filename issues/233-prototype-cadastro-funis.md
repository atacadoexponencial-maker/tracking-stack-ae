# 233: Protótipo da aba Funis do relatório

**Tipo:** Protótipo
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Montar a aba "Funis do relatório" no menu lateral do dashboard com dados fixos, no padrão visual das abas Links e Bloqueios: lista, controles de ordem, ações por linha, filtro de situação, formulário, área de erro, aviso de conflito e estado vazio — sem chamar o servidor.

## Comportamentos cobertos

- Aba nova no menu lateral, mesmo padrão das abas de cadastro existentes
- Lista com posição, nome, tipo de medição, funil do tracking, opção(ões) do CRM, origem do lead, trecho, situação e última alteração
- Botões "subir"/"descer", "Editar", "Arquivar" e "Reativar" por linha
- Filtro "ativos" (padrão) / "todos"
- Formulário "Novo funil" / "Editando: <nome>" com Nome, Tipo de medição, Funil do tracking, Opção do CRM, Origem do lead, Trecho, botões "Salvar"/"Cancelar edição" e área de erro
- Caixa de aviso de conflito de campanhas acima da lista
- Estado vazio: "Nenhum funil cadastrado — todo o investimento do relatório vai aparecer em 'sem funil'."

## Cenários

### Happy Path
1. A usuária clica em "Funis do relatório" no menu lateral (ou abre `/dash/#funis-relatorio`).
2. A seção aparece com: caixa de aviso de conflito (exemplo fixo), filtro "ativos"/"todos", a lista com os quatro blocos do cadastro inicial (dados fixos) na ordem do relatório, e o formulário "Novo funil".
3. Cada linha ativa mostra "subir"/"descer" (o primeiro "subir" e o último "descer" desabilitados), "Editar" e "Arquivar"; a linha arquivada de exemplo mostra "Reativar".
4. As demais abas seguem inalteradas.

### Edge Cases
- O cabeçalho não anuncia o intervalo de datas: a aba não segue o filtro do topo (mesmo tratamento da aba Greenn).
- A tabela não é ordenável por coluna: a ordem da lista É a ordem do relatório (colunas sem `campo` no `tabela()`).
- Nome de campanha/opção longa → a tabela rola horizontalmente (`.tabela-wrap`).
- Estado vazio: o texto fixo existe no protótipo (elemento `#funisrel-vazio`, escondido enquanto há funis ativos).

### Cenário de Erro
Nenhuma chamada ao servidor neste protótipo. Se o renderer lançar, o `try/catch` de `render()` insere o `.aviso.falha` no primeiro `.card` da seção (a seção começa com `.card`).

## Banco de Dados

Não se aplica (dados fixos no front; a tabela nasce na issue 236).

## Arquivos

- **Modificar:** `public/dash/index.html` — link `#funis-relatorio` no `#nav`; `<section id="secao-funis-relatorio">` (aviso de conflito, filtro de situação, lista, estado vazio, formulário com área de erro); verbete em `TITULOS`; renderer `R['funis-relatorio']` desenhando os dados fixos com `tabela()` e `esc()`.

## Reuso (pesquisado na base)

- `tabela(el, colunas, linhas)` — escape, rolagem e desenho da lista (colunas sem `campo` = sem ordenação).
- Estilos `.card`, `.abas`, `.aviso.alerta`, `.aviso.falha`, `.btn`, `.btn.sec`, `.mini` — nada de CSS novo.
- Formulário no mesmo formato de `#links-form` / `#ab-form` (grid, `max-width:640px`, área de erro `.aviso.falha` escondida, "Cancelar edição" escondido).
- Roteador por hash + `try/catch` de `render()`.

## Checklist

- [x] `<a href="#funis-relatorio" data-secao="funis-relatorio">Funis do relatório</a>` no `#nav`
- [x] `<section class="secao" id="secao-funis-relatorio">` com `.card` como primeiro filho
- [x] Verbete `'funis-relatorio': 'Funis do relatório'` em `TITULOS`
- [x] Caixa de aviso de conflito acima da lista
- [x] Filtro "ativos"/"todos"
- [x] Lista com as 9 colunas + ações (subir/descer, Editar, Arquivar/Reativar)
- [x] Estado vazio com o texto da spec
- [x] Formulário com os 6 campos, Salvar, Cancelar edição e área de erro
- [x] Dados fixos, sem chamada ao servidor

# 235: Protótipo do aviso da aba Greenn sobre o funil de venda

**Tipo:** Protótipo
**Página:** Módulo 3 — Migração do reconhecimento do workshop pago
**Spec:** spec-feedback-marketing.md

## Descrição

Desenhar na aba Greenn, com dados fixos, a faixa de aviso que aparece quando não há funil ativo do tipo "Venda na Greenn" ou quando ele não tem trecho do nome da campanha.

## Comportamentos cobertos

- Faixa com o texto "Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório."
- Variante "O funil <nome> não tem trecho do nome da campanha."
- Filtro de datas da aba Greenn continua como hoje (ciclo inteiro da campanha)

## Cenários

### Happy Path
1. A usuária abre a aba Greenn.
2. Se a resposta de `/api/greenn` trouxer `aviso_funil_venda` (texto pronto), a faixa `.aviso.alerta` aparece no primeiro card, logo abaixo do aviso de ciclo inteiro, com esse texto.
3. Sem o campo (hoje, e sempre que houver funil de venda com trecho), a faixa fica escondida e a aba é idêntica à atual.

### Edge Cases
- Os dois textos da faixa (sem funil / funil sem trecho) são montados no **servidor** (issue 267); a tela só exibe — nenhuma regra nem texto de negócio no front.
- Texto com caracteres especiais (nome do funil) → passa por `esc()`.
- O aviso de ciclo inteiro e o subtítulo "não segue o filtro de datas" continuam exatamente como estão.

### Cenário de Erro
Se `/api/greenn` falhar, o `try/catch` de `render()` mostra o `.aviso.falha` de sempre; a faixa não aparece.

## Protótipo: dados fixos

O protótipo não altera `/api/greenn` (isso é da issue 267). Os dois textos fixos da faixa são:

- `Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório.`
- `O funil <nome> não tem trecho do nome da campanha.` (mesma consequência: campanhas que só gastaram não aparecem)

Para ver a faixa localmente: no console, `R.greenn` com uma resposta contendo `aviso_funil_venda`.

## Banco de Dados

Não se aplica.

## Arquivos

- **Modificar:** `public/dash/index.html` — `<div id="greenn-aviso-funil" class="aviso alerta" hidden>` no primeiro card de `#secao-greenn`; em `R.greenn`, exibe `d.aviso_funil_venda` quando presente.

## Reuso (pesquisado na base)

- Classe `.aviso.alerta` (a mesma do aviso de ciclo inteiro e dos avisos do `/api/cpl`).
- `esc()` e o padrão `hidden` + `textContent` usado em `#bloqueios-erro`.

## Checklist

- [x] Elemento da faixa no primeiro card da aba Greenn, escondido por padrão
- [x] `R.greenn` mostra o texto vindo do backend (`aviso_funil_venda`) e esconde sem ele
- [x] Textos fixos das duas variantes registrados
- [x] Aviso de ciclo inteiro e filtro de datas inalterados

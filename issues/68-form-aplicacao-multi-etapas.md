# 68: Converter LP de Aplicação para formulário multi-etapas

**Tipo:** Implementação
**Página:** Página de Aplicação (`/aplicacao-mentoria`)

## Descrição

Converter o formulário da LP `/aplicacao-mentoria` (hoje single-page, issues 64/65) para o formato **multi-etapas** definido na spec atualizada, no estilo da referência ecommercenext.com.br/form-organico: cartão centralizado com título curto exibindo **uma etapa por vez** — Etapa 1: Nome, WhatsApp, @instagram; Etapa 2: Email, Faturamento, Cargo; Etapa 3: Principal desafio, Maior objetivo — e barra de navegação no rodapé do cartão com seta "→" para avançar (valida apenas os campos da etapa atual; bloqueia com erros e foca o primeiro inválido), seta "←" para voltar (sem validar, sem perder valores) e o botão "ENVIAR APLICAÇÃO →" apenas na etapa 3. Todos os campos permanecem no mesmo formulário único (names inalterados: nome, telefone, email, instagram, faturamento, cargo, justificativa, objetivo) e a validação por campo da issue 65 é reaproveitada — muda somente o escopo da validação (por etapa) e a exibição (etapa visível). O envio real continua sendo a issue 66 (ponto de inserção preservado no handler de submit). Indicador discreto de etapa ("1 de 3") opcional.

## Plano de Implementação

### Markup (dentro do `<form id="aplicacao-form-el">` existente)

O `<form>` vira o **cartão**: título curto `FORMULÁRIO DE APLICAÇÃO` no topo (elemento novo `.aplicacao__card-titulo`, com o indicador `.aplicacao__card-etapa` "1 de 3" ao lado/abaixo), corpo com as 3 etapas e a barra de navegação colada no rodapé.

- **Etapas:** agrupar os 8 `.aplicacao__field` existentes (labels intactos, apenas movidos) em 3 containers:
  - `<div class="aplicacao__etapa" data-etapa="1">` — nome, telefone, instagram (o campo email sai da 2ª posição atual e vai para a etapa 2)
  - `<div class="aplicacao__etapa" data-etapa="2" hidden>` — email, faturamento, cargo
  - `<div class="aplicacao__etapa" data-etapa="3" hidden>` — justificativa, objetivo
- **Erro geral:** `<p id="aplicacao-erro">` permanece fora das etapas, entre as etapas e a barra de navegação (continua `hidden`; é usado pela issue 66).
- **Barra de navegação** `.aplicacao__nav` no rodapé do cartão (full-bleed, fundo escuro):
  - `<button type="button" id="aplicacao-voltar" aria-label="Voltar" hidden>←</button>` (esquerda; visível nas etapas 2 e 3)
  - `<button type="button" id="aplicacao-avancar" aria-label="Avançar">→</button>` (direita; visível nas etapas 1 e 2)
  - `<button type="submit" id="aplicacao-submit" class="btn-cta aplicacao__submit" hidden>ENVIAR APLICAÇÃO →</button>` (direita; visível só na etapa 3 — mesmo botão/id atual, movido para dentro da barra)
- Logo, headline, subtítulo e nota de privacidade fora do cartão: inalterados.

### CSS (no `<style>` scoped da página)

- `.aplicacao__form` vira o cartão: `background: hsl(var(--card))`, `border: 1px solid hsl(var(--border))`, `border-radius`, `overflow: hidden` (para a barra do rodapé encostar nas bordas), `padding: 0` com padding interno no título/etapas.
- `.aplicacao__card-titulo`: fonte pequena, uppercase, letter-spacing (mesmo padrão dos `span` dos fields); `.aplicacao__card-etapa` em `hsl(var(--muted-foreground))`.
- `.aplicacao__etapa`: `display: flex; flex-direction: column; gap: 1rem;` + regra `.aplicacao__etapa[hidden] { display: none; }` (obrigatória, pois `display: flex` sobrescreve o default do atributo `hidden`).
- `.aplicacao__nav`: `display: flex; justify-content: space-between; align-items: center;` fundo escuro (`hsl(var(--primary-foreground))` ≈ preto do tema), padding confortável para toque; botões de seta sem borda, cor clara, área de toque ≥ 44px; `[hidden]` também forçado a `display: none` nos botões da barra.
- `.aplicacao__submit` deixa de ser `width: 100%` (agora vive na barra, alinhado à direita).

### Script (no `<script>` existente — mudanças mínimas)

Tudo da issue 65 é reaproveitado sem alteração: `FIELDS`, `getEl`, `getErrEl`, `showError`, `clearError`, `validateAll`, máscara de telefone e os listeners de correção em tempo real (funcionam mesmo com o campo oculto — inofensivo). Adições:

- `const STEP_FIELDS = [['nome','telefone','instagram'], ['email','faturamento','cargo'], ['justificativa','objetivo']]` (ordem = ordem no DOM).
- `let currentStep = 1`.
- `validateStep(n)`: igual ao `validateAll`, mas iterando só os `FIELDS` cujo `name` está em `STEP_FIELDS[n-1]`; devolve o primeiro inválido da etapa (ou null). Campos de outras etapas não são tocados (etapas não visitadas nunca exibem erro).
- `showStep(n)`: seta `hidden` nos containers `[data-etapa]` (só o da etapa `n` visível), alterna visibilidade dos botões (voltar: `n > 1`; avançar: `n < 3`; submit: `n === 3`), atualiza o indicador "n de 3" e `currentStep = n`. Não valida, não limpa valores.
- Clique em "→": `validateStep(currentStep)`; se houver inválido, foca-o e não avança; senão `showStep(currentStep + 1)`.
- Clique em "←": `showStep(currentStep - 1)` direto (sem validação).
- Handler de `submit` (mesmo listener atual): `preventDefault()`; **se `currentStep < 3`** (Enter num input das etapas 1/2 dispara submit), tratar como clique em "→" e retornar; senão `validateAll()` — se o primeiro inválido estiver numa etapa anterior (caso defensivo), `showStep` daquela etapa antes de focar; se tudo válido, cai no ponto de inserção da issue 66 (comentário preservado exatamente onde está).

### Acessibilidade mínima

- Etapas ocultas usam o atributo `hidden` no container — remove os campos do fluxo de tab e da árvore de acessibilidade sem `tabindex` manual.
- Botões de seta são icon-only: `aria-label="Avançar"` / `aria-label="Voltar"` e `type="button"` (não disparam submit).
- `aria-invalid` + mensagens por campo continuam como na issue 65.

## Cenários

### Happy Path

1. Visitante abre `/aplicacao-mentoria`: vê logo, headline, subtítulo e o cartão com título "FORMULÁRIO DE APLICAÇÃO", indicador "1 de 3", os campos Nome/WhatsApp/@instagram e a barra no rodapé só com "→" (sem "←", sem botão de envio).
2. Preenche os 3 campos, clica em "→": etapa 2 aparece (Email, Faturamento, Cargo), indicador "2 de 3", barra com "←" e "→".
3. Preenche e avança: etapa 3 (Principal desafio, Maior objetivo), indicador "3 de 3", barra com "←" e "ENVIAR APLICAÇÃO →" (sem "→").
4. Preenche e clica em enviar: `validateAll` passa e a execução chega ao ponto de inserção da issue 66 (hoje: nada acontece visualmente — igual ao comportamento atual da página).

### Edge Cases

- **Avançar com campo inválido:** na etapa 1 com WhatsApp de 8 dígitos, clicar "→" não avança; erro "Digite um WhatsApp válido com DDD." aparece sob o campo e ele recebe foco. Campos das etapas 2/3 seguem sem erro.
- **Voltar não valida nem perde valores:** na etapa 2 com Email vazio, clicar "←" volta à etapa 1 sem mostrar erro no email; Nome/WhatsApp/@instagram continuam preenchidos; avançar de novo mostra a etapa 2 com o que já tinha sido digitado.
- **Enter no meio do formulário:** pressionar Enter num input da etapa 1 ou 2 dispara `submit`, que é interceptado e tratado como "→" (valida a etapa atual e avança) — nunca envia antes da etapa 3.
- **Correção em tempo real:** erro exibido some assim que o campo fica válido (listener existente da issue 65, inalterado).
- **Etapas não visitadas:** nenhum erro aparece em campos de etapas à frente, mesmo após tentativas falhas de avançar.
- **Máscara de telefone:** continua funcionando na etapa 1 exatamente como hoje.
- **Tab/leitor de tela:** com a etapa 2 visível, Tab não alcança campos das etapas 1 e 3 (containers com `hidden`).

### Cenário de Erro

- **Enviar na etapa 3 com campo inválido:** clicar "ENVIAR APLICAÇÃO →" com "Principal desafio" com 1 caractere bloqueia o envio, mostra "Conta um pouquinho pra gente." e foca o campo; valores das etapas 1/2 intactos.
- **Defensivo — campo de etapa anterior inválido no submit:** se por qualquer caminho um campo das etapas 1/2 estiver inválido no submit, `validateAll` o detecta, a página navega (`showStep`) até a etapa dele e o foca — dado inválido nunca chega ao ponto da issue 66.

## Arquivos

- **Modificar:** `src/pages/aplicacao-mentoria.astro` — único arquivo. Markup: campos agrupados em 3 `div.aplicacao__etapa` (email movido para a etapa 2), título/indicador do cartão, barra de navegação no rodapé com voltar/avançar/submit. CSS: form como cartão, barra escura full-bleed, `[hidden] { display: none }` para etapas e botões. Script: `STEP_FIELDS`, `currentStep`, `validateStep(n)`, `showStep(n)`, listeners de avançar/voltar, guarda de Enter no handler de submit. Names dos 8 campos, `FIELDS`, validadores, máscara e o comentário da issue 66 preservados.

## Checklist

- [x] Campos agrupados em 3 containers de etapa na ordem da spec (1: nome/telefone/instagram; 2: email/faturamento/cargo; 3: justificativa/objetivo), com etapas 2 e 3 iniciando `hidden`
- [x] Todos os `name` inalterados: nome, telefone, email, instagram, faturamento, cargo, justificativa, objetivo
- [x] Cartão com título "FORMULÁRIO DE APLICAÇÃO" e indicador "1 de 3" atualizado a cada etapa
- [x] Barra de navegação colada no rodapé do cartão: "←" (etapas 2–3), "→" (etapas 1–2), "ENVIAR APLICAÇÃO →" só na etapa 3; setas com `type="button"` e `aria-label`
- [x] "→" valida só a etapa atual via `validateStep(n)` (reusa `FIELDS`/`showError`/`clearError`); bloqueia, exibe erros e foca o primeiro inválido
- [x] "←" volta sem validar e sem perder nenhum valor preenchido
- [x] Etapas não visitadas nunca exibem erro antecipadamente
- [x] Enter nas etapas 1–2 age como "→" (nunca envia antes da etapa 3)
- [x] Submit na etapa 3: `preventDefault` + `validateAll`; ponto de inserção da issue 66 preservado no mesmo lugar do fluxo
- [x] Containers ocultos usam atributo `hidden` (fora do fluxo de tab); regra CSS `[hidden] { display: none }` onde houver `display` explícito
- [x] Máscara de telefone e correção em tempo real (issue 65) continuam funcionando sem alteração
- [x] Visual segue tokens de `global.css` (cartão `--card`/`--border`, barra escura, tema do site); usável em celular (coluna única, alvos de toque confortáveis)
- [x] Nenhum outro arquivo modificado

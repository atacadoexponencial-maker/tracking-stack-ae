# 64: Protótipo da LP de Aplicação (formulário single-page)

**Tipo:** Protótipo
**Página:** Página de Aplicação (`/aplicacao-mentoria`)

## Descrição

Criar a página estática `/aplicacao-mentoria` com a identidade visual atual do site (fundo escuro, detalhes em bege, tipografia Satoshi), contendo: logotipo centralizado no topo, headline curta, subtítulo de reforço e o formulário de aplicação completo com os 8 campos visíveis de uma vez, na ordem Nome, WhatsApp, Email, @instagram, Faturamento mensal (10 faixas), Cargo (4 opções), Principal desafio e Maior objetivo — todos com rótulo marcado com `*` —, botão único de envio destacado ocupando a largura do formulário ("ENVIAR APLICAÇÃO →") e nota opcional de privacidade abaixo. Sem menu, sem rodapé de navegação e sem seções extras; layout em coluna única totalmente utilizável em celular. Apenas estrutura e visual — sem validação nem envio (comportamentos ficam nas issues de implementação). A página usa o layout-base existente do site para que a captura de UTMs e o registro de visita pelo rastreamento padrão continuem funcionando sem nenhum mecanismo novo.

## Plano

### Padrões e código reutilizados (pesquisa feita na base)

- **Layout:** `src/layouts/BaseLayout.astro` já injeta GA4, Meta Pixel (browser) e o espelho de PageView server-side via `POST /tracker` — que é onde a captura de UTMs acontece. Basta usar `<BaseLayout showHeader={false} showFooter={false}>` e o rastreamento padrão funciona sem nenhum mecanismo novo.
- **Modelo de página enxuta:** `src/pages/lives-semanais-v1.astro` (BaseLayout sem header, logo no topo via `astro:assets`, formulário em coluna única com `max-width: 32rem`, `<style>` escopado com tokens HSL).
- **Padrão de campos com rótulo:** `src/components/LeadFormModal.astro` (`.lform__field` = `<label>` com `<span>` de rótulo + input/select; select de faturamento com `<option value="" disabled selected>Selecione…</option>`). É o único formulário do site com rótulos visíveis — a LP replica esse padrão em versão de página (não modal).
- **As 10 faixas de faturamento:** copiar exatamente a lista já usada em `src/components/LeadFormModal.astro` (linhas 41–49) e `src/components/LeadChat.astro` (`FAT_OPTIONS`, linhas 188–192): `Menos de 20 Mil` … `Mais de 500 Mil`. O backend (`functions/tracker.js`) roteia por `faturamento.includes('menos de 20')` — manter os textos idênticos.
- **As 4 opções de Cargo** (campo novo, definido na spec.md): `Dono(a) / Sócio(a)`, `Gestor(a)`, `Funcionário(a)`, `Outro`.
- **Perguntas/placeholder de desafio e objetivo:** mesmos textos do `src/components/LeadChat.astro` (linhas 206–207): "Qual o principal desafio do seu negócio hoje?" e "E qual o seu maior objetivo para os próximos meses?", placeholder "Conte em poucas palavras" (chaves futuras `justificativa` e `objetivo` — nomes de `name` já definidos agora para as issues 65/66 não renomearem nada).
- **Tema:** tokens de `src/styles/global.css` (`--background` #1e1e1e, `--light-bg` bege p/ detalhes, `--input`, `--card`, `--muted-foreground`, `--destructive`), utilitárias `.container` e `.btn-cta` (branca sobre fundo escuro), fonte Satoshi já self-hosted com preload no BaseLayout.
- **Logotipo:** `src/assets/brand/logo.png` via `<Image>` de `astro:assets` — mesmo asset e mesmo uso sobre fundo escuro do `LeadFormModal.astro` (sem filtro; o filtro `brightness(0)` do lives-semanais-v1 é só para fundo claro).

### Estrutura da página (protótipo)

`<BaseLayout title="…" description="…" showHeader={false} showFooter={false}>` contendo um único bloco central (`max-width: ~32rem`, coluna única):

1. Logo centralizado no topo (`<Image src={logo} …>`).
2. `<h1>` headline curta (ex.: "Aplique para a sua sessão estratégica gratuita").
3. `<p>` subtítulo de reforço (análise do negócio + contato do time).
4. `<form id="aplicacao-form-el">` com os 8 campos, cada um no padrão label+span (rótulo com `*`):
   - `nome` — `input type="text"`, rótulo "Nome *", placeholder "Nome"
   - `telefone` — `input type="tel"`, rótulo "WhatsApp *", placeholder "WhatsApp" (name `telefone`, como nos formulários existentes e no payload do /tracker)
   - `email` — `input type="email"`, rótulo "Email *", placeholder "Email"
   - `instagram` — `input type="text"`, rótulo "@instagram da marca *", placeholder "@suamarca"
   - `faturamento` — `select` com placeholder "Selecione…" + as 10 faixas na ordem crescente
   - `cargo` — `select` com placeholder "Selecione…" + as 4 opções
   - `justificativa` — `input type="text"`, rótulo "Qual o principal desafio do seu negócio hoje? *", placeholder "Conte em poucas palavras"
   - `objetivo` — `input type="text"`, rótulo "E qual o seu maior objetivo para os próximos meses? *", placeholder "Conte em poucas palavras"
   - `<p class="…__erro" hidden>` reservado (padrão lives-semanais-v1) — usado pela issue 65
   - `<button type="submit" class="btn-cta">ENVIAR APLICAÇÃO →</button>` ocupando 100% da largura do form
5. `<p>` nota de privacidade pequena abaixo do botão ("Seus dados ficam seguros. O time entra em contato pelo WhatsApp/email informados.").

Sem atributos `required`/máscara (validação é a issue 65) e sem listener de submit (envio é a issue 66).

## Cenários

### Happy Path

1. Visitante chega em `/aplicacao-mentoria?utm_source=...` (com ou sem UTMs).
2. O BaseLayout dispara o PageView padrão (GA4 + fbq browser + espelho `POST /tracker`), que registra a visita e as UTMs no D1 — nenhum código novo de tracking na página.
3. A página renderiza: fundo escuro, logo centralizado, headline, subtítulo e o formulário completo com os 8 campos visíveis de uma vez, na ordem definida, todos com rótulo marcado com `*`.
4. Os selects de Faturamento (10 faixas) e Cargo (4 opções) abrem e permitem escolher uma opção.
5. O botão "ENVIAR APLICAÇÃO →" aparece destacado, na largura do formulário, com a nota de privacidade abaixo.
6. Em celular (≥320px de largura), tudo fica em coluna única, campos com altura confortável de toque, sem scroll horizontal.

### Edge Cases

- **Clique no botão de envio (nesta issue):** não há listener nem `action`; o submit nativo recarrega a página com querystring. Comportamento conhecido e aceito no protótipo — a issue 66 assume o controle do submit (`preventDefault`). Não adicionar handler provisório.
- **Selects intocados:** exibem a opção placeholder "Selecione…" (`value="" disabled selected`), padrão do LeadFormModal — nenhuma faixa/opção vem pré-escolhida.
- **Textos longos em desafio/objetivo:** inputs de linha única aceitam texto longo com scroll interno nativo; sem limite de caracteres nesta issue.
- **Tela estreita (320px):** `.container` + `max-width` do form garantem coluna única; conferir que os rótulos longos (perguntas de desafio/objetivo) quebram linha sem estourar.
- **JS desabilitado / adblock:** a página é 100% estática e renderiza inteira; apenas os scripts de tracking do BaseLayout deixam de rodar (comportamento idêntico às demais páginas).

### Cenário de Erro

- **Falha no `POST /tracker` do PageView:** já tratada no BaseLayout com `.catch()` silencioso — a página nunca quebra por causa do tracking.
- **Fonte Satoshi não carrega:** fallback `system-ui` da pilha `--font-sans` em `global.css` — página continua legível.
- **Logo não carrega:** `<Image>` exige `alt` ("Atacado Exponencial"); o texto alternativo aparece no lugar.
- Mensagens de erro de validação por campo **não** fazem parte desta issue (issue 65); apenas o elemento `<p hidden>` reservado existe no markup.

## Arquivos

- **Criar:** `src/pages/aplicacao-mentoria.astro` — a LP completa (BaseLayout sem header/footer + logo + headline + subtítulo + form com os 8 campos + botão + nota de privacidade + `<style>` escopado com os tokens do tema).
- **Modificar:** `functions/api/conversion.js` — adicionar `'/aplicacao-mentoria'` ao set `KNOWN_PAGE_PATHS` (linha ~132), para que as visitas da nova LP apareçam na tabela "Conversão por LP" do dashboard (a spec exige comparação de conversão no painel existente; sem isso os pageviews caem fora da whitelist).

Nenhum outro arquivo é tocado: BaseLayout, global.css, LeadFormModal e LeadChat são apenas referências/reuso, não sofrem alteração.

## Dependências Externas

Nenhuma — Astro, `astro:assets` e a fonte Satoshi self-hosted já estão no projeto.

## Checklist

- [x] Criar `src/pages/aplicacao-mentoria.astro` usando `BaseLayout` com `showHeader={false}` e `showFooter={false}`, `title` e `description` próprios
- [x] Logo `src/assets/brand/logo.png` centralizado no topo via `<Image>` (padrão LeadFormModal, sem filtro)
- [x] Headline `<h1>` curta + subtítulo `<p>` de reforço
- [x] Formulário com os 8 campos na ordem: nome, telefone (WhatsApp), email, instagram, faturamento, cargo, justificativa (desafio), objetivo — `name`s exatamente esses
- [x] Todos os rótulos visíveis com `*` (padrão label+span do LeadFormModal)
- [x] Select de faturamento com as 10 faixas idênticas ao LeadFormModal/LeadChat + placeholder "Selecione…"
- [x] Select de cargo com as 4 opções da spec (`Dono(a) / Sócio(a)`, `Gestor(a)`, `Funcionário(a)`, `Outro`) + placeholder "Selecione…"
- [x] Campos de desafio/objetivo com as perguntas e o placeholder "Conte em poucas palavras" (textos do LeadChat)
- [x] `<p>` de erro `hidden` reservado no form (padrão lives-semanais-v1) sem lógica
- [x] Botão `type="submit"` com classe `.btn-cta`, texto "ENVIAR APLICAÇÃO →", largura 100% do form
- [x] Nota de privacidade pequena abaixo do botão
- [x] Estilos escopados usando só tokens de `global.css` (fundo escuro, detalhes bege via `--light-bg`, inputs no padrão `--input`/`--card`)
- [x] Sem `required`, sem máscara, sem listener de submit (issues 65/66)
- [x] Adicionar `'/aplicacao-mentoria'` a `KNOWN_PAGE_PATHS` em `functions/api/conversion.js`
- [x] `npm run build` passa e a página renderiza em coluna única em viewport de 320px e 1440px

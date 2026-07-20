# 128: Protótipo da página /lives-semanais-v2

**Tipo:** Protótipo
**Página:** /lives-semanais-v2

## Descrição

Criar `src/pages/lives-semanais-v2.astro` como réplica visual e de copy da `/lives-semanais-v1` (mesmo layout base, hero com logo centralizado, seção "Nesta hora, você vai entender", "Para quem é a live" e grade de depoimentos com lazy loading), substituindo a seção final de inscrição: sai o formulário, entra um botão único de CTA sob o título "Garanta sua vaga gratuita" com a frase de garantia ajustada (ex.: "Vaga gratuita. É só entrar no grupo que o link e os lembretes da live chegam por lá."). Neste protótipo os CTAs ainda não precisam apontar para o destino final (links inertes ou placeholder); nenhum campo de captura, validação ou envio de lead deve existir na página.

## Plano de Implementação

A página nova é um copy-paste dirigido de `src/pages/lives-semanais-v1.astro`, com três operações:

**1. Copiar sem alterar (da v1, linhas 1–71 e 91–118):**
- **Frontmatter inteiro** (linhas 1–19): imports de `BaseLayout`, `Image` de `astro:assets` e `logo` de `../assets/brand/logo.png`; o array `aprender` com os 4 itens; e o carregamento dos depoimentos via `import.meta.glob('../assets/proof/*.{jpg,png}', { eager: true })` + sort por nome de arquivo (hoje resolve para `proof-1.jpg` … `proof-9.jpg` em `src/assets/proof/`). Nenhum asset novo é criado — o glob reaproveita os existentes.
- **`<BaseLayout …>`** com o mesmo `title`, mesma `description` e `showHeader={false}` (o footer fica no padrão do layout, visível, igual à v1). O tracking de PageView (GA4 + Pixel browser + espelho `/tracker` server-side) já vem de graça do `BaseLayout` — nada a fazer na página.
- **Hero** (`<header class="lv-hero">`): logo centralizado, badge, título, subtítulo e o CTA `QUERO MINHA VAGA NA LIVE →`. No protótipo, manter o `href="#inscricao"` como âncora para a seção final (placeholder — a issue 129 troca para `/grupo-da-live`).
- **Seções "Nesta hora, você vai entender"** (`.aprender`), **"Para quem é a live"** (`.paraquem`) e **Depoimentos** (`.lv-prints`, grade 2 col mobile / 3 col ≥768px, `loading="lazy"` nas imagens): idênticas à v1.
- **`<style>`:** copiar os blocos `.lv-hero*`, `.aprender*`, `.paraquem*`, `.lv-prints*` e, da família `.inscricao`, apenas `__inner`, `__reforco` e `__garantia`.

**2. Substituir — seção final de inscrição (v1, linhas 73–87):**
- Manter `<section id="inscricao" class="section inscricao">` (o id sustenta a âncora do hero), o `<h2>Garanta sua vaga gratuita</h2>` e o reforço `Quinta-feira, 12h · ao vivo e online`.
- **Remover** todo o `<form id="inscricao-form-el">` (3 inputs, `#inscricao-erro`, botão submit).
- **No lugar**, um link único estilizado como botão: `<a href="#" class="btn-cta inscricao__cta">QUERO PARTICIPAR DA LIVE →</a>` (mesmo texto do botão da v1; `href="#"` é o placeholder — a issue 130 troca para `/grupo-da-live`). Adicionar no `<style>` a regra `.inscricao__cta { margin-top: 1rem; }` (substitui o espaçamento que `.inscricao__form` dava).
- **Trocar a frase de garantia:** de "Vaga gratuita. Você recebe o link e os lembretes direto no seu WhatsApp." para "Vaga gratuita. É só entrar no grupo que o link e os lembretes da live chegam por lá."

**3. Remover por completo — o `<script>` do fim da v1 (linhas 121–180):**
- Não copiar o bloco `<script>` que importa `../scripts/lead-validacao` (máscara/validação de telefone, sugestão de email) e faz o submit → `fbq('track', 'Lead')` + `POST /tracker` + redirect. A v2 não tem nenhum script próprio — nem evento de Lead, nem fetch, nem estado "Enviando…". Também não copiar as regras de CSS órfãs do form (`.inscricao__form`, `.inscricao__input`, `.inscricao__erro`, `.inscricao__submit`).

**Não tocar:** `src/pages/lives-semanais-v1.astro`, `functions/grupo-da-live.js`, `src/layouts/BaseLayout.astro`, `src/scripts/lead-validacao` e qualquer asset — tudo permanece como está.

## Cenários

### Happy Path
1. Visitante abre `/lives-semanais-v2` (direto ou via anúncio com UTMs).
2. O `BaseLayout` registra o PageView automaticamente (GA4 + Pixel browser + espelho server-side no `/tracker` com dedup por `event_id`) — mesmo comportamento de todas as páginas; nada específico da v2.
3. Vê o hero (logo centralizado, badge, título, subtítulo) sem o cabeçalho padrão do site.
4. Clica no CTA do hero → a página rola até a seção final `#inscricao` (âncora, comportamento de protótipo).
5. Rola pelas seções "Nesta hora, você vai entender", "Para quem é a live" e a grade de depoimentos — os prints carregam preguiçosamente conforme entram na tela.
6. Na seção final vê "Garanta sua vaga gratuita", o reforço de dia/hora, o botão único e a frase de garantia nova. Clicar no botão não navega para lugar nenhum (`href="#"` placeholder — destino real entra nas issues 129/130).

### Edge Cases
- **Sem JavaScript / adblock:** a página renderiza 100% (é estática); só o tracking do layout deixa de disparar — igual às demais páginas.
- **Pasta `src/assets/proof/` alterada no futuro (print adicionado/removido):** o `import.meta.glob` resolve em build; a grade se ajusta sozinha, como na v1.
- **Mobile estreito:** grade de depoimentos em 2 colunas, hero com `clamp()` no título — herdado da v1 sem ajustes.
- **Visitante da v1 esperando formulário:** não existe nenhum input na v2; quem chegar por link compartilhado vê apenas o botão — comportamento intencional da variante.
- **Busca/robôs:** `title` e `description` iguais aos da v1 (réplica de copy); nenhuma tag noindex — mesmo tratamento da v1.

### Cenário de Erro
- **Não há estados de erro próprios:** sem formulário não existe validação, mensagem "Enviando…", `#inscricao-erro` nem fallback de redirect. O único fetch da página é o espelho de PageView do `BaseLayout`, que já é fire-and-forget com `catch` silencioso.
- **Falha ao carregar um print de depoimento:** o `<Image>` do Astro mantém o `alt` ("Depoimento N"); a grade continua íntegra.
- **Clique no CTA placeholder:** `href="#"` apenas rola ao topo — sem erro de console e sem 404; risco aceito por ser protótipo (resolvido nas issues 129/130).

## Arquivos
- **Criar:** `src/pages/lives-semanais-v2.astro` — LP réplica da v1 (frontmatter, hero, aprender, paraquem, depoimentos e estilos copiados) com a seção final trocada para botão único + frase de garantia nova, sem `<form>` e sem o `<script>` de lead.

Nenhum outro arquivo é modificado. Sem assets novos, sem mudanças em layout, functions ou scripts compartilhados.

## Checklist
- [x] Criar `src/pages/lives-semanais-v2.astro` copiando da v1: frontmatter completo (imports, array `aprender`, glob de `../assets/proof/`)
- [x] Copiar o `<BaseLayout>` com mesmo `title`/`description` e `showHeader={false}`
- [x] Copiar hero, seção "Nesta hora, você vai entender", "Para quem é a live" e grade de depoimentos (com `loading="lazy"`) sem alteração de copy
- [x] Na seção `#inscricao`: manter título e reforço; remover o `<form>` inteiro e colocar `<a href="#" class="btn-cta inscricao__cta">QUERO PARTICIPAR DA LIVE →</a>`
- [x] Trocar a frase de garantia para "Vaga gratuita. É só entrar no grupo que o link e os lembretes da live chegam por lá."
- [x] Copiar o `<style>` sem as regras do form (`.inscricao__form`, `.inscricao__input`, `.inscricao__erro`, `.inscricao__submit`) e adicionar `.inscricao__cta { margin-top: 1rem; }`
- [x] NÃO copiar o bloco `<script>` da v1 (validação, fbq Lead, POST /tracker, redirect)
- [x] Rodar `npm run build` (ou dev) e conferir: página renderiza, zero inputs no DOM, nenhum request de Lead, âncora do hero rola até a seção final
- [x] Confirmar que `lives-semanais-v1.astro` não foi tocada (git diff limpo fora do arquivo novo)

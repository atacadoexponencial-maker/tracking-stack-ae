# 370: Protótipo da página de aplicação do plano ao vivo

**Tipo:** Protótipo
**Página:** /aplicacao-plano-ao-vivo (spec-aplicacao-plano-ao-vivo.md)

## Descrição

Montar a página `/aplicacao-plano-ao-vivo` (fora do Google, sem cabeçalho nem
rodapé). Ela tem a folha de rosto com o texto da arte, no estilo das iscas, e o
cartão com as 4 etapas e as 13 perguntas, no estilo de /aplicacao-mentoria. As
telas de agradecimento e de "aplicações encerradas" também entram, mas ainda sem
envio de verdade.

## Pronto quando

- No celular e no desktop, a página abre na folha de rosto e o botão leva à etapa
  1.
- Dá para avançar e voltar entre as 4 etapas sem perder as respostas.
- Cada etapa só avança com os campos válidos. O erro aparece embaixo do campo, o
  foco vai para o primeiro campo inválido e o erro some quando o campo é
  corrigido.
- O WhatsApp aceita só número brasileiro com DDD.
- Nas perguntas de uma opção, marcar outra desmarca a anterior. Nas perguntas 6 e
  7 dá para marcar várias, e é preciso marcar pelo menos uma.
- O Enter avança nos campos de texto. Na caixa da pergunta 11, o Enter quebra a
  linha.
- Na última etapa, o botão enviar mostra a tela de agradecimento com o texto da
  spec (aviso "na quarta, 07/10, até o meio-dia"). Por enquanto nada é gravado.
- O estado "aplicações encerradas" pode ser visto pelo protótipo, com o aviso no
  lugar do botão da folha de rosto.
- Não sai nenhum evento de tracking (Meta, GA4, /tracker) e nenhuma outra página
  muda. /aplicacao-mentoria e /materiais/* continuam iguais.

## Cenários

### Happy Path
1. A pessoa abre `/aplicacao-plano-ao-vivo` pelo link do disparo e vê a folha de
   rosto com o selo, o título, o subtítulo, a pílula da data, o texto de
   abertura e o botão "Quero aplicar a minha marca".
2. Ao tocar no botão, o cartão troca para a etapa 1 de 4 ("A marca") e a tela
   rola até o topo do cartão, se ele tiver saído dela.
3. Ela preenche nome, WhatsApp (com a máscara), marca e @, e o que vende. Toca
   em → e vai para a etapa 2.
4. Na etapa 2, escolhe faturamento, investimento e pessoas no comercial (uma
   opção cada) e marca uma ou mais opções nas perguntas 6 e 7. Toca em →.
5. Na etapa 3, escolhe a recompra e escreve o que trava na caixa de várias
   linhas. Toca em →.
6. Na etapa 4, escolhe as respostas das perguntas 12 e 13 e toca em "ENVIAR
   APLICAÇÃO →".
7. O cartão dá lugar à tela de agradecimento, com o texto da spec. No protótipo
   nada é enviado.

### Edge Cases
- **Voltar:** ← volta uma etapa com tudo preenchido. Na etapa 1 não há ←.
- **Enter:** num campo de texto das etapas 1 a 3, funciona como →. Na etapa 4
  (que só tem opções) não faz nada além do envio normal. Na caixa da pergunta 11
  o Enter quebra linha.
- **Opções múltiplas (6 e 7):** marcar e desmarcar à vontade. Erro se nenhuma
  estiver marcada.
- **Uma opção (5, 8, 9, 10, 12, 13):** botões de rádio. Marcar outra desmarca a
  anterior.
- **Telefone:** usa a mesma regra dos outros formulários do site (BR com DDD, ou
  internacional começando com "+"). É a validação compartilhada, não uma nova.
- **Prévia do estado encerrado:** `?previa=encerradas` mostra a folha de rosto com
  o aviso de encerradas no lugar do botão. É só para conferir o visual: a 372
  troca esse parâmetro pela decisão do servidor.
- **Recarregar:** volta à folha de rosto, sem nada guardado.
- **Página fora do dash:** a visita não vira sessão nem PageView. Não carrega GA4,
  Pixel, Clarity nem aviso de cookies, e não chama /tracker.

### Cenário de Erro
- Campo vazio ou inválido ao tocar →: o erro aparece embaixo do campo (ou do grupo
  de opções), o foco vai para o primeiro inválido e a etapa não muda.
- O erro some assim que o campo fica válido, seja digitando ou marcando.
- No envio da etapa 4, se algum campo de etapa anterior estiver inválido (caso
  defensivo), o cartão volta até essa etapa e mostra o erro.

## Banco de Dados

Não se aplica. A planilha entra na issue 371.

## Arquivos

- **Criar:** `src/data/aplicacao-plano-ao-vivo.js` — fonte única das perguntas:
  `name`, rótulo, tipo (texto, caixa, uma opção, várias opções), lista de opções
  e etapa de cada uma das 13 perguntas, além dos textos do agradecimento e do
  aviso de encerradas. É `.js` puro, como `src/data/materiais.js`, para que o
  servidor (371) valide pelas mesmas listas.
- **Criar:** `src/layouts/SemRastreioLayout.astro` — layout curto: `global.css`,
  preload das fontes Satoshi, `noindex, nofollow`, sem GA4, Pixel, Clarity,
  PageView ou aviso de cookies. É o mesmo raciocínio do `PlannerLayout.astro`,
  sem o tema e o CSS do planner.
- **Criar:** `src/components/AplicacaoPlanoAoVivoForm.astro` — o cartão: logo,
  folha de rosto, 4 etapas geradas a partir do arquivo de dados, nav ←/→,
  agradecimento e aviso de encerradas. Estilos copiados de
  `src/components/AplicacaoForm.astro` (cartão, campos, nav) e da folha de rosto
  de `src/pages/materiais/[slug].astro` (selo, título, subtítulo, CTA claro),
  mais o estilo novo dos rádios e caixas de marcar. Importa `telefoneValido`,
  `TELEFONE_ERRO` e `aplicarMascaraTelefone` de `src/scripts/lead-validacao.ts`.
  Não importa `form-start`, `funil` nem chama `fbq` ou `/tracker`.
  > Por que um componente novo em vez do `AplicacaoForm`: ele é amarrado ao
  > /tracker (Lead, FormStart, FormStep, fbq e redirect) e é usado pela mentoria
  > e pelas iscas. Torná-lo configurável mexeria em duas páginas que estão no ar
  > por causa de uma página de uso único.
- **Criar:** `src/pages/aplicacao-plano-ao-vivo.astro` — página fina:
  `SemRastreioLayout` + `AplicacaoPlanoAoVivoForm`.
- **Modificar:** `functions/_middleware.js` — acrescentar
  `&& !url.pathname.startsWith('/aplicacao-plano-ao-vivo')` à lista de exclusões
  de sessão, com comentário no padrão do planner, para a visita não virar sessão
  no dash.
- **Criar:** `tests/aplicacao-plano-ao-vivo.test.js` — confere o arquivo de
  dados: 13 perguntas, `name` únicos, 4 etapas, opções exatamente como na spec, e
  as perguntas 6 e 7 marcadas como várias opções.

## Dependências Externas

Nenhuma.

## Checklist

- [ ] Criar `src/data/aplicacao-plano-ao-vivo.js` com as 13 perguntas, as opções
      exatas da spec e os textos de agradecimento e encerradas
- [ ] Criar `tests/aplicacao-plano-ao-vivo.test.js` e rodar `npm test`
- [ ] Criar `src/layouts/SemRastreioLayout.astro` (noindex, sem nenhum script de
      medição)
- [ ] Criar `src/components/AplicacaoPlanoAoVivoForm.astro`: folha de rosto,
      etapas a partir dos dados, validação por etapa (texto, rádio, caixas com
      "pelo menos uma"), máscara de telefone, ←/→, Enter, foco no primeiro
      inválido, erro que some ao corrigir
- [ ] Botão enviar → tela de agradecimento (sem envio); `?previa=encerradas` →
      aviso de encerradas
- [ ] Criar `src/pages/aplicacao-plano-ao-vivo.astro`
- [ ] Acrescentar a exclusão em `functions/_middleware.js`
- [ ] `npm run build` sem erro
- [ ] Na prévia: conferir celular e desktop. No DevTools, nenhuma chamada a
      /tracker, gtag, fbevents ou clarity
- [ ] Conferir que /aplicacao-mentoria e /materiais/icp continuam iguais
- [ ] Sem travessão (—) nos textos visíveis

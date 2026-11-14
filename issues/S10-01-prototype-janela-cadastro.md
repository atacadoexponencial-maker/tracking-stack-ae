# S10-01: Protótipo da janela de cadastro

**Tipo:** Protótipo
**Página:** Página do ingresso da Imersão (/imersao-planejamento-atacado)
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Desenhar a janela de cadastro (nome, e-mail, WhatsApp, botão de confirmar, botão de fechar e mensagem de erro) no visual da página do ingresso, para a usuária aprovar antes de ligar o envio.

## Pronto quando

A usuária abre a janela na página, no celular e no computador, vê os três campos, o botão e a mensagem de erro de exemplo, e aprova o visual. Nada é gravado ainda.

## Critérios de aceite

- **CA-S10-09** (manual) — Janela legível e utilizável no celular. Dado um celular com a página do ingresso aberta, quando a usuária abre a janela e preenche os três campos, então os campos, o botão e a mensagem de erro aparecem inteiros, sem cortar com o teclado aberto, e o visual acompanha o da página.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-06 | O WhatsApp é aceito com ou sem o nono dígito e sem exigir +55, como nos outros formulários do site. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-22 | A janela é simples, só o formulário e o botão (sem título, lote ou preço): campos "Nome", "E-mail" e "WhatsApp com DDD"; botão "Garantir ingresso"; erros "Digite o seu nome.", "Digite um e-mail válido, como nome@exemplo.com." e "Digite o WhatsApp com DDD. Número de fora do Brasil começa com +.". | confirmada | Marcelle, 14/11/2026: "O pop deve ser bem simples, apenas o form e o botão garantir ingresso". |

## Perguntas em aberto

Nenhuma.

## Cenários

### Happy Path
A usuária abre a página do ingresso, toca em um botão de compra e vê a janela: folha bege como o cartão de preço, só com os três campos com rótulo e o botão escuro da página.

### Edge Cases
- Celular: a janela encosta no alto da tela e nunca passa da altura que sobra com o teclado aberto; o botão acompanha a rolagem da janela e continua à vista.
- Computador: a janela fica no centro.
- Quem pediu menos movimento no aparelho: a janela abre sem animação.

### Cenário de Erro
Confirmar com campo vazio ou inválido mostra a mensagem em vermelho logo abaixo do campo, com a borda do campo marcada.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S10-09 | manual | roteiro abaixo | campos, botão e erro inteiros no celular, com o teclado aberto, no visual da página |

### Roteiro manual — CA-S10-09
1. No celular, abrir `https://atacadoexponencial.com/imersao-planejamento-atacado/` e tocar em um botão de compra (não o do topo).
2. Tocar em "Garantir ingresso" sem preencher nada: a mensagem de erro aparece inteira abaixo do campo Nome.
3. Preencher os três campos, um por vez, com o teclado aberto: o campo em que se digita e o botão continuam à vista.
4. Conferir que o visual acompanha o da página (bege, carvão, mesma letra, mesmo botão).

## Arquivos

- **Modificar:** `src/pages/imersao-planejamento-atacado.astro` — marcação e visual da janela (feito no mesmo commit da S10-04, que liga a janela ao envio)

## Checklist

- [x] Janela desenhada com a skill de design (impeccable), no visual da página
- [x] Conferida na prévia local em 390 px e 1280 px, com erro e com sugestão de e-mail

# S10-04: Cadastro antes do checkout, com planilha

**Tipo:** Implementação
**Página:** Página do ingresso da Imersão (/imersao-planejamento-atacado)
**Spec:** `spec-popup-checkout-imersao.md`

## Descrição

Ligar os botões de compra (menos o do topo) à janela de cadastro: validar, gravar a linha na planilha com UTM completa e levar a pessoa ao checkout da Zouti com as UTMs, sem dado pessoal no endereço.

## Pronto quando

A usuária toca em um botão de compra no celular, preenche a janela, cai no checkout da Zouti e encontra a linha dela na planilha com as UTMs do link.

## Critérios de aceite

- **CA-S10-01** (automática) — Botão do topo não abre o cadastro. Dado a página do ingresso com vendas abertas, quando a pessoa toca no botão do topo, então a página rola até a seção de preço e a janela de cadastro continua fechada.
- **CA-S10-02** (automática) — Os outros botões abrem o cadastro. Dado a página do ingresso com vendas abertas e uma pessoa que ainda não se cadastrou, quando ela toca em qualquer botão de compra que não seja o do topo, então a janela de cadastro abre e a pessoa continua na página (não vai ao checkout ainda).
- **CA-S10-03** (automática) — Quem já se cadastrou na visita vai direto. Dado uma pessoa que já enviou o cadastro nesta visita e voltou para a página, quando ela toca em um botão de compra, então vai para o checkout sem ver a janela de novo.
- **CA-S10-04** (automática) — Cadastro completo leva ao checkout. Dado a janela aberta, quando a pessoa preenche nome, e-mail e WhatsApp válidos e confirma, então ela é levada ao checkout da Zouti do ingresso.
- **CA-S10-05** (automática) — Campo vazio ou inválido não envia. Dado a janela aberta, quando a pessoa confirma sem nome, com e-mail sem formato de e-mail ou com WhatsApp sem DDD e número, então a janela mostra qual campo corrigir, nada é gravado e a pessoa não sai da página.
- **CA-S10-06** (automática) — Fechar a janela mantém a pessoa na página. Dado a janela aberta, quando a pessoa fecha pelo botão, pela tecla Esc ou tocando fora, então a janela some, nada é gravado e a página fica onde estava.
- **CA-S10-07** (automática) — Falha ao gravar não impede a compra. Dado a janela preenchida com dados válidos e o serviço de gravação fora do ar, quando a pessoa confirma, então ela vai ao checkout em até 3 segundos.
- **CA-S10-08** (automática) — Dois toques gravam um cadastro só. Dado a janela preenchida com dados válidos, quando a pessoa toca duas vezes seguidas em confirmar, então existe uma linha na planilha e um card no CRM para aquele cadastro, não dois.
- **CA-S10-10** (automática) — UTMs da visita seguem para o checkout. Dado uma visita que chegou com UTMs de origem, mídia, campanha, conteúdo e termo, quando a pessoa confirma o cadastro, então o endereço do checkout leva essas cinco UTMs com os mesmos valores.
- **CA-S10-11** (automática) — Dado pessoal não aparece no endereço do checkout. Dado um cadastro confirmado, quando a pessoa é levada ao checkout, então o endereço não contém o nome, o e-mail nem o WhatsApp dela.
- **CA-S10-12** (automática) — Cadastro vira linha com UTM completa. Dado uma visita com as cinco UTMs e um cadastro confirmado, quando a gravação termina, então a planilha ganha uma linha com data e hora de Brasília, nome, e-mail, WhatsApp no padrão com DDI e DDD, as cinco UTMs, o lote e o preço daquele momento.
- **CA-S10-13** (automática) — Visita sem UTM também é gravada. Dado uma visita sem nenhuma UTM e um cadastro confirmado, quando a gravação termina, então a linha entra na planilha com as colunas de UTM vazias.
- **CA-S10-32** (automática) — A página não manda início de checkout em dobro. Dado um cadastro confirmado, quando a pessoa é levada ao checkout, então a página não envia ao Meta um início de checkout próprio (o da Zouti é o único).
- **CA-S10-14** (manual) — Cadastro de verdade aparece na planilha. Dado a página no ar, quando a usuária faz um cadastro pelo celular vindo de um link com UTMs, então ela encontra a linha na planilha com os dados e as UTMs daquele link.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S10-01 | "Mesma visita" quer dizer a mesma aba do navegador: se a pessoa fechar a aba e voltar outro dia, a janela aparece de novo. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-03 | Depois do cadastro a pessoa vai sempre ao checkout, nunca a página de obrigado, agenda ou grupo. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-04 | A planilha é nova, criada na conta marcelle@seteads.com, separada das outras. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-05 | O checkout da Zouti aceita receber as UTMs no endereço e não quebra com elas. Sem documentação da Zouti; a conferir com um clique de verdade. | confirmada | Conferido em 14/11/2026: o checkout abriu normalmente com as cinco UTMs no endereço. Se a Zouti as repassa no pedido é a SUP-S10-09. |
| SUP-S10-06 | O WhatsApp é aceito com ou sem o nono dígito e sem exigir +55, como nos outros formulários do site. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-14 | Como a Zouti já avisa o Meta do início de checkout e da compra, a página deixa de enviar o próprio início de checkout ao Meta, para não contar duas vezes. | confirmada | Marcelle, 14/11/2026 |
| SUP-S10-22 | A janela é simples, só o formulário e o botão (sem título, lote ou preço): campos "Nome", "E-mail" e "WhatsApp com DDD"; botão "Garantir ingresso"; erros "Digite o seu nome.", "Digite um e-mail válido, como nome@exemplo.com." e "Digite o WhatsApp com DDD. Número de fora do Brasil começa com +.". | confirmada | Marcelle, 14/11/2026: "O pop deve ser bem simples, apenas o form e o botão garantir ingresso". |
| SUP-S10-23 | As UTMs da chegada ficam guardadas na aba: se a pessoa recarregar a página ou voltar do checkout sem elas no endereço, as da chegada continuam valendo para a planilha e para o link do checkout. | confirmada | Marcelle, 14/11/2026 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-04 | Para onde vão os dados: planilha com UTM completa e CRM. | respondida | Marcelle, 13/11: "Quero planilha com UTM completa + CRM". |
| PER-S10-05 | Quais botões abrem a janela. | respondida | Marcelle, 13/11: todos menos o do topo. |

## Cenários

### Happy Path
1. A pessoa toca em um botão de compra (qualquer um, menos o do topo). A janela de cadastro abre por cima da página, só com o formulário e o botão.
2. Ela preenche nome, e-mail e WhatsApp e toca em "Garantir ingresso".
3. A página envia o cadastro a `/api/imersao-cadastro` com as UTMs da visita. O servidor confere os campos, padroniza o WhatsApp e acrescenta a linha na planilha, com data e hora de Brasília, o lote e o preço daquele momento.
4. A pessoa é levada ao checkout da Zouti com as cinco UTMs no endereço e nenhum dado pessoal.

### Edge Cases
- Botão do topo: continua rolando até a seção de preço; não abre a janela.
- Quem já se cadastrou nesta aba: o botão leva direto ao checkout, sem janela e sem novo envio.
- Dois toques seguidos em confirmar: um envio só e uma ida ao checkout.
- Visita sem UTM: a linha entra com as colunas de UTM vazias e o link do checkout vai sem UTM.
- Recarregou a página sem as UTMs no endereço: valem as da chegada, guardadas na aba.
- Fechar pelo X, pelo Esc ou tocando fora: a janela some, nada é enviado e a página fica onde estava.
- Navegador sem JavaScript: o botão leva direto ao checkout (a venda vem antes do cadastro).
- Vendas encerradas: os botões somem (regra que já existe) e a janela não abre.
- Robô (mesmas listas do `/tracker`): recebe ok e não vira linha.

### Cenário de Erro
- Campo vazio ou inválido: a janela mostra a mensagem junto do campo, põe o cursor nele, não envia nada e a pessoa continua na página.
- Gravação fora do ar ou lenta: a página espera no máximo 2,5 s e leva a pessoa ao checkout do mesmo jeito.
- Planilha fora do ar: o servidor responde 502 e registra a falha no log; a pessoa já foi ao checkout.

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S10-01 | automática | `tests/imersao-cadastro.test.js` | o botão do topo aponta para a seção de preço e não é botão de compra |
| CA-S10-02 | automática | `tests/imersao-cadastro.test.js` | os cinco botões de compra pedem a janela e ninguém sai da página |
| CA-S10-03 | automática | `tests/imersao-cadastro.test.js` | depois de um cadastro, o toque seguinte vai ao checkout sem janela e sem novo envio |
| CA-S10-04 | automática | `tests/imersao-cadastro.test.js` | cadastro válido leva ao checkout da Zouti do ingresso |
| CA-S10-05 | automática | `tests/imersao-cadastro.test.js` | nome vazio, e-mail sem formato e WhatsApp sem DDD devolvem o campo a corrigir, sem envio e sem saída da página |
| CA-S10-06 | automática | `tests/imersao-cadastro.test.js` | abrir e fechar não envia nem navega; a página tem os três jeitos de fechar |
| CA-S10-07 | automática | `tests/imersao-cadastro.test.js` | com a gravação falhando ou travada, a ida ao checkout acontece em menos de 3 s |
| CA-S10-08 | automática | `tests/imersao-cadastro.test.js` | dois toques seguidos resultam em um envio só |
| CA-S10-10 | automática | `tests/imersao-cadastro.test.js` | o endereço do checkout leva as cinco UTMs com os mesmos valores |
| CA-S10-11 | automática | `tests/imersao-cadastro.test.js` | o endereço do checkout não contém nome, e-mail nem WhatsApp |
| CA-S10-12 | automática | `tests/imersao-cadastro.test.js` | a linha gravada tem data e hora de Brasília, nome, e-mail, WhatsApp com DDI e DDD, as cinco UTMs, o lote e o preço do momento |
| CA-S10-13 | automática | `tests/imersao-cadastro.test.js` | visita sem UTM grava a linha com as colunas de UTM vazias |
| CA-S10-32 | automática | `tests/imersao-cadastro.test.js` | a página não tem envio próprio de início de checkout |
| CA-S10-14 | manual | roteiro abaixo | a linha do cadastro de verdade aparece na planilha com as UTMs do link |

### Roteiro manual — CA-S10-14
1. No celular, abrir `https://atacadoexponencial.com/imersao-planejamento-atacado/?utm_source=teste&utm_medium=celular&utm_campaign=conferencia&utm_content=janela&utm_term=marcelle`.
2. Tocar em um botão de compra (não o do topo), preencher a janela e confirmar.
3. Conferir que abriu o checkout da Zouti.
4. Abrir a planilha "Imersão Planejamento Atacado 2027 (cadastros antes do checkout)", aba Cadastros: a linha está lá com os dados, as cinco UTMs do link, o lote e o preço.

## Arquivos

- **Criar:** `src/scripts/cadastro-imersao.js` — regras da janela: quando abre, quando vai direto, validação, envio único, espera máxima e endereço do checkout com UTMs
- **Criar:** `functions/api/imersao-cadastro.js` — recebe o cadastro, confere, decide o lote do momento e grava a linha na planilha
- **Criar:** `tests/imersao-cadastro.test.js` — testes dos 13 critérios automáticos
- **Modificar:** `src/pages/imersao-planejamento-atacado.astro` — link do checkout da Zouti, janela de cadastro (marcação, visual e ligação dos botões) e retirada do rastreio de compra antigo (`checkout-venda`)
- **Modificar:** `functions/api/hotseat-giulliano-puga.js` — só exporta `dataHoraBrasilia`, para a gravação nova reusar

Reuso: `acrescentarLinha` de `functions/api/_google-planilha.js`, `padronizarTelefone` de `functions/_telefone.js`, `detectBot` de `functions/_bots.js`, `loteVigente` de `src/data/lotes-workshop.js`, máscara e validação de `src/scripts/lead-validacao.ts`.

Planilha: "Imersão Planejamento Atacado 2027 (cadastros antes do checkout)", criada em 14/11/2026 pela VPS na conta marcelle@seteads.com, aba Cadastros (criada no primeiro cadastro).

## Checklist

- [x] Planilha nova criada na conta marcelle@seteads.com
- [x] Regras da janela em `cadastro-imersao.js`
- [x] Gravação em `/api/imersao-cadastro`, com lote e preço decididos no servidor
- [x] Janela na página, ligada aos botões de compra (menos o do topo)
- [x] Link do checkout da Zouti com UTMs e sem dado pessoal
- [x] Página sem envio próprio de início de checkout
- [x] Testes dos 13 critérios automáticos passando

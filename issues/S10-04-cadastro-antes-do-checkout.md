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
| SUP-S10-01 | "Mesma visita" quer dizer a mesma aba do navegador: se a pessoa fechar a aba e voltar outro dia, a janela aparece de novo. | aberta | — |
| SUP-S10-03 | Depois do cadastro a pessoa vai sempre ao checkout, nunca a página de obrigado, agenda ou grupo. | aberta | — |
| SUP-S10-04 | A planilha é nova, criada na conta marcelle@seteads.com, separada das outras. | aberta | — |
| SUP-S10-05 | O checkout da Zouti aceita receber as UTMs no endereço e não quebra com elas. Sem documentação da Zouti; a conferir com um clique de verdade. | aberta | — |
| SUP-S10-06 | O WhatsApp é aceito com ou sem o nono dígito e sem exigir +55, como nos outros formulários do site. | aberta | — |
| SUP-S10-14 | Como a Zouti já avisa o Meta do início de checkout e da compra, a página deixa de enviar o próprio início de checkout ao Meta, para não contar duas vezes. | aberta | — |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S10-04 | Para onde vão os dados: planilha com UTM completa e CRM. | respondida | Marcelle, 13/11: "Quero planilha com UTM completa + CRM". |
| PER-S10-05 | Quais botões abrem a janela. | respondida | Marcelle, 13/11: todos menos o do topo. |

# 371: Aplicação enviada vira linha na planilha

**Tipo:** Implementação
**Página:** /aplicacao-plano-ao-vivo (spec-aplicacao-plano-ao-vivo.md, "Registro das aplicações na planilha")

## Descrição

Ligar o envio da página ao servidor do site. O servidor confere os dados de novo
e acrescenta uma linha na planilha `1tWAeZMaAp_hSE-6vymyN8Cx3kAqVo-zKEZfGySHuOHU`
(aba `Página1`), usando a conta de serviço do Google que já existe. O cabeçalho é
criado uma vez, antes do primeiro envio.

## Pronto quando

- Uma aplicação real, enviada pela prévia, aparece como linha nova na planilha.
  As colunas seguem a ordem da spec, com data e hora no horário de Brasília,
  textos das opções (não códigos), as opções múltiplas separadas por vírgula e as
  UTMs na coluna Origem.
- A pessoa só vê o agradecimento depois que a linha foi gravada. O botão fica
  desabilitado durante o envio, e um clique duplo não gera duas linhas.
- Se o envio falhar (sem internet, erro do servidor, Google fora do ar ou acesso
  negado), a pessoa vê o pedido de tentar de novo, as respostas continuam
  preenchidas e a falha fica registrada para a equipe.
- O servidor recusa e não grava nada quando falta campo obrigatório, quando a
  opção não existe na lista ou quando o texto é longo demais.
- Texto que começa com `=`, `+`, `-` ou `@` aparece na planilha como texto, não
  como fórmula.
- Robô barrado pelas proteções que o site já usa não vira linha.
- Enviar de novo com o mesmo WhatsApp gera outra linha, e as linhas antigas não
  são tocadas.
- Nada sai para lead, CRM, ManyChat, GHL, Meta, GA4 ou dash. A chave do Google
  nunca chega ao navegador.

# 377: Configuração, envio de teste e recebimento dos resultados

**Tipo:** Implementação
**Página:** Dash › E-mail › Configuração (spec `spec-email-proprio.md`, módulos 1 e 8)

## Descrição

Ligar o dash ao serviço de envio: a tela de configuração salva remetentes, resposta e rodapé, mostra a situação da conta e dos domínios, manda um e-mail de teste e recebe de volta os resultados (entregue, voltou, spam, abriu, clicou, descadastrou) por um endereço protegido, sem contar aviso repetido. Credencial quebrada entra no aviso diário. Nada do GHL é tocado.

## Pronto quando

A usuária edita os remetentes, manda um teste para o próprio e-mail e vê, no dash, esse envio marcado como entregue e depois como aberto e clicado. Um aviso sem a senha correta é recusado.

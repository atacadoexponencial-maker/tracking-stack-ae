# 372: Aplicações encerram sozinhas em 06/10 às 23h59

**Tipo:** Implementação
**Página:** /aplicacao-plano-ao-vivo (spec-aplicacao-plano-ao-vivo.md, "Encerramento das aplicações")

## Descrição

A partir de terça, 06/10/2026, às 23h59 (horário de Brasília), a página continua
no ar, mas mostra "As aplicações foram encerradas." no lugar do formulário. O
servidor passa a recusar envios. Quem decide se está aberto ou fechado é o
servidor, nunca o relógio do aparelho.

## Pronto quando

- Com o prazo simulado no passado, a página abre direto no aviso de encerradas,
  com o lembrete do Meet, e não há como abrir o formulário.
- Se a página foi aberta antes do prazo e o envio sai depois, o servidor recusa,
  nada é gravado e a pessoa vê o aviso de encerradas, não o "tente de novo".
- Mudar o relógio do celular não reabre o formulário.
- Antes do prazo, tudo segue funcionando como na issue 371.

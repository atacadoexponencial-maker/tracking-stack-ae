# 306: Os avisos de saída

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Os três recados que protegem duas horas de trabalho: o que avisa que falta
preencher, o que avisa que a meta está vazia e o que segura a pessoa antes de
ela fechar a aba sem levar nada. Nenhum deles bloqueia — todos avisam e deixam
seguir.

## Escopo

- **Bloco incompleto.** Ao clicar em baixar PDF ou imprimir com campos faltando,
  aparece "Faltam campos no bloco [nome]. Continuar assim mesmo?", nomeando o
  bloco. Seguir assim mesmo produz a folha com os vazios; **voltar abre a aba do
  bloco que falta**, em vez de só fechar o aviso — a pessoa pode estar em outro
  bloco e não ter como saber onde está o buraco.
- **Meta vazia.** Campo de meta do bloco 1 sem número, na hora de sair, mostra
  "Coloque um número, mesmo que seja chute. Meta redonda é melhor que meta
  nenhuma."
- **Fechar a aba.** Com o planner preenchido e sem ter baixado nem impresso, o
  navegador pergunta "Você preencheu o planner e ainda não baixou nem imprimiu.
  Sair mesmo?"
- **Aba vazia sai calada.** Planner sem nada preenchido fecha sem pergunta.
- Depois de baixar o PDF ou imprimir, fechar a aba não pergunta mais nada.

## Pronto quando

Clicar em imprimir com o bloco 3 em branco nomeia o bloco 3 no aviso e deixa
seguir assim mesmo. Deixar uma meta vazia mostra o recado do chute. Preencher
alguma coisa e tentar fechar a aba faz o navegador perguntar; baixar o PDF antes
faz a pergunta não aparecer; e uma aba em que nada foi preenchido fecha direto.

# 305: Baixar o planner em PDF

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Ligar o botão "Salvar meu planner em PDF": o arquivo é gerado e baixado direto
no aparelho de quem preencheu, sem ela precisar achar o "Salvar em PDF"
escondido dentro do menu de impressão. É o que ela leva embora — o rascunho no
navegador não sai do navegador.

Depende da issue 304: o PDF e o papel produzem a mesma folha.

## Escopo

- Um clique baixa o arquivo. Sem diálogo intermediário de impressão.
- **O PDF traz os quatro blocos**, esteja a pessoa na aba que estiver. A
  navegação esconde blocos da tela; o arquivo ignora isso.
- O layout do PDF é idêntico ao da folha impressa: um bloco por página, claro,
  sem botão e sem fundo.
- O arquivo tem nome reconhecível, com o nome da marca e a data, para não virar
  "documento(3).pdf" na pasta de downloads.
- Sem nome de marca preenchido, o arquivo recebe um nome genérico do planner e o
  download acontece do mesmo jeito.
- Funciona no celular: o arquivo vai para os downloads do aparelho e pode ser
  compartilhado dali, com o mesmo layout da versão de computador.
- Baixar duas vezes produz dois arquivos, cada um com o conteúdo do momento do
  clique. Sem histórico de versões.
- O texto do PDF é texto de verdade, selecionável e pesquisável — não uma foto
  da tela.

## Risco declarado

O navegador não gera PDF sozinho; a página precisa montar o arquivo. Se a rota
escolhida no `/plan` não couber no prazo até 23/09, a queda combinada é o botão
abrir o diálogo de impressão já apontando para "Salvar em PDF" — funciona em
todo navegador e custa quase nada. Essa troca precisa ser avisada, não feita em
silêncio.

## Pronto quando

Clicar em "Salvar meu planner em PDF" baixa um arquivo com nome que traz a marca
e a data. Abrir esse arquivo mostra as mesmas cinco folhas da impressão, com o
texto selecionável. O mesmo clique no celular baixa o mesmo arquivo.

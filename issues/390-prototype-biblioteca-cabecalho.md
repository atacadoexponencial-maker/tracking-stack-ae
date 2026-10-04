# 390: Protótipo da biblioteca de imagens e do cabeçalho padrão

**Tipo:** Protótipo
**Página:** Marketing › E-mail: biblioteca de imagens e Configuração › Cabeçalho padrão (spec `spec-editor-email.md`, módulos 3 e 4)

## Descrição

Desenhar a biblioteca de imagens (grade com miniatura, nome, tamanho, peso, data, onde é usada, busca, subir por botão e arrastando, avisos de formato, peso acima de 1 MB e largura acima de 1200 px, apagar com trava de imagem em uso) e o cabeçalho padrão da Configuração, montado com blocos (mudança de 04/10: o cabeçalho não é só imagem), com fundo da faixa, prévia e quantos modelos usam.

## Pronto quando

Na prévia, ela navega pela biblioteca com estados de vazio, subindo, erro de formato, erro de peso e imagem em uso, abre a biblioteca como escolha de imagem, mexe no cabeçalho padrão vendo a prévia, e aprova o desenho. Nada sobe nem é salvo.

## Implementação (04/10/2026)

Protótipo só de front, em `public/dash/email-blocos.js` (função `biblioteca` e o editor em modo `cabecalho`); em `public/dash/email-mkt.js` só as entradas (botão "Ver a biblioteca de imagens" na faixa de Modelos e "Ver o cabeçalho padrão novo" na Configuração); CSS `eb-bib`/`eb-cab-intro` no `index.html`. Nada sobe nem é salvo: o que ela sobe fica só no navegador.

- Biblioteca: busca, contagem e peso total, área "Arraste imagens para cá" e "Subir imagens" (várias de uma vez), fila de envio com barra, erro de formato, erro de peso (1 MB) e aviso de largura acima de 1200 px (dispensáveis), grade com miniatura, nome, tamanho, peso, data e "Em uso · N" ou "Não usada"; painel da imagem com nome editável, endereço público permanente (copiar), onde é usada e apagar (travado quando em uso; confirmação avisando que e-mails já enviados continuam mostrando). "Ver estado": com imagens, vazia, subindo, envios com erro.
- Cabeçalho padrão: o editor de blocos só com a faixa (blocos, paleta, arrastar, fundo da faixa, campos, avisos de contraste), prévia com o lugar do corpo marcado, "Usado hoje por 4 modelos" e confirmação ao salvar.
- A biblioteca como escolha de imagem já existe dentro do editor (389).

Conferido no navegador (1440 e 390 px) com gravações bloqueadas.

Falta: aprovação dela na prévia.

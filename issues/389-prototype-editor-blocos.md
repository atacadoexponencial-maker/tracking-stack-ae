# 389: Protótipo do editor de modelo por blocos

**Tipo:** Protótipo
**Página:** Marketing › E-mail › Modelos, editor do modelo (spec `spec-editor-email.md`, módulos 1, 2, 3 na parte do modelo e 5)

## Descrição

Desenhar no dash, no estilo "Etiqueta", o editor por blocos: pilha de blocos com subir, descer, arrastar, duplicar e apagar; "Adicionar bloco" entre blocos e no fim; os campos de cada tipo (título, texto, imagem, botão, divisória, espaço, imagem com texto); a escolha de cor; a faixa do cabeçalho do modelo (padrão, outra imagem, sem); a prévia ao lado em computador e celular; os avisos (campo desconhecido, link inválido, imagem sem texto alternativo, contraste baixo, modelo sem bloco).

## Pronto quando

Na prévia, ela monta um e-mail de exemplo com todos os tipos de bloco, troca cores, troca o cabeçalho, vê a prévia mudar e os avisos aparecerem, no computador e no celular, e aprova o desenho. Nada é salvo nem enviado (selo "Protótipo").

## Implementação (04/10/2026)

Protótipo só de front, com dados de exemplo no navegador: nada chama a API de gravação, nada é salvo nem enviado (selo "Protótipo"). Código novo em `public/dash/email-blocos.js` (vira a base do editor de verdade na 394); em `public/dash/email-mkt.js` só o botão "Ver o editor novo" em Modelos; em `public/dash/index.html` o `<script>` e o CSS prefixado `eb-`. A prévia do protótipo é montada no navegador; no editor de verdade quem monta é o servidor.

Como abrir: https://email-proprio.tracking-ae.pages.dev/dash/#mkt-email?v=modelos → faixa "Protótipo" → "Ver o editor novo".

O que dá para fazer: adicionar bloco no fim e entre blocos (7 tipos), selecionar, subir, descer, arrastar pela alça, duplicar, apagar, desfazer e refazer (botões e Ctrl+Z/Ctrl+Y); editar título, texto rico (negrito, itálico, link, tirar link, lista), imagem da biblioteca de exemplo (texto alternativo, largura, alinhamento, link), botão (estilo, alinhamento, cores), imagem com texto, divisória e espaço; cor por paleta, código, atalhos da marca e últimas usadas; fundo do e-mail; cabeçalho do modelo (padrão, outra imagem, sem); campos no cursor; avisos no bloco e no topo (campo desconhecido, link inválido, imagem sem texto alternativo, contraste baixo no botão, bloco vazio, modelo sem bloco); prévia ao vivo em computador, celular e só texto, com clique na prévia selecionando o bloco; aviso ao sair sem salvar.

Conferido no navegador (1440 e 390 px), com gravações bloqueadas: nenhuma tentativa de gravar, sem rolagem lateral no celular.

Ajustes pedidos por ela (04/10):
- "Subir imagem" visível no bloco (botão principal), área "Arraste uma imagem aqui" quando o bloco não tem imagem, e "+ Subir imagem" como primeiro quadrado da biblioteca. Formato, 1 MB e largura acima de 1200 px conferidos.
- Arrastar e soltar no próprio e-mail (prévia): reordenar blocos, arrastar bloco novo da paleta "Arraste para o e-mail" (clique põe no fim) e soltar imagem do computador (em cima de uma imagem troca; entre blocos cria bloco de imagem).

Falta: aprovação dela na prévia.

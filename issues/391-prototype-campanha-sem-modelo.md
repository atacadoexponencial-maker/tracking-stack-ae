# 391: Protótipo da campanha com e-mail escrito na hora

**Tipo:** Protótipo
**Página:** Marketing › E-mail › Campanhas, gaveta da campanha (spec `spec-editor-email.md`, módulo 8)

## Descrição

Desenhar na gaveta da campanha a escolha "Usar um modelo" ou "Escrever o e-mail aqui", o editor de blocos dentro da campanha (assunto, prévia, cabeçalho, blocos), "Salvar como modelo", a troca entre as duas opções (copiar do modelo; aviso de descarte) e os passos do que falta contando "e-mail escrito".

## Pronto quando

Na prévia, ela abre uma campanha nova, escreve um e-mail com blocos, troca entre modelo e e-mail escrito vendo os avisos, e aprova o desenho. Nada é salvo nem disparado.

## Implementação (04/10/2026)

Protótipo só de front: o editor de blocos em modo `campanha` (`public/dash/email-blocos.js`), aberto por "Ver a campanha nova" na faixa "Protótipo" de Campanhas (`public/dash/email-mkt.js`). Tela inteira em vez de gaveta, porque o editor e a prévia precisam de espaço. Nada é salvo nem disparado.

- Passos do que falta (conteúdo, segmento, teste como conselho); "Revisar e disparar" espera conteúdo e segmento, com o motivo ao lado.
- "Usar um modelo": escolha do modelo, assunto, prévia só de leitura e "Escrever a partir deste modelo" (copia; o modelo não muda).
- "Escrever o e-mail aqui": assunto, pré-visualização, cabeçalho, blocos, paleta e prévia do editor; "Salvar como modelo".
- Voltar para modelo com e-mail escrito pede confirmação de descarte.
- Segmentos, quando enviar, resumo com quantas pessoas, conteúdo, assunto e o alerta de teste; disparo com confirmação (só aviso de protótipo).

Conferido no navegador com gravações bloqueadas (nenhuma tentativa de gravar, sem erros).

Falta: avaliação dela (pediu para seguir com tudo e avaliar no fim).

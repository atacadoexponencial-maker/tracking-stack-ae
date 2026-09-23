# 299: Portão de senha

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Pôr o planner atrás de uma senha única, compartilhada com a turma do workshop. A
senha é conferida no servidor e o planner só é entregue depois que ela bate —
nem o código-fonte da página revela o conteúdo para quem não entrou.

## Escopo

- Senha guardada em variável de ambiente no backend. Nunca no código, nunca no
  frontend.
- Servidor sem a senha configurada recusa todo mundo. Deploy incompleto não vira
  porta aberta.
- Quem chega sem ter entrado recebe só o portão: logo, título, campo de senha
  escondido, botão e área de recado vazia.
- Senha correta: o servidor valida, guarda o acesso no navegador e entrega o
  planner.
- Senha errada: recado de senha incorreta, o visitante continua no portão e o
  campo fica pronto para nova tentativa.
- Campo vazio: aviso de obrigatório, sem chamar o servidor.
- Enter dentro do campo equivale a clicar no botão.
- Quem já entrou recarrega, fecha o navegador e volta depois: entra direto,
  enquanto o acesso valer.
- Acesso expirado: volta ao portão, e o preenchimento guardado continua intacto
  para quando ele entrar de novo.
- Tentativas repetidas de adivinhar a senha são desaceleradas a partir de certo
  volume.

## Pronto quando

Abrir `/planner-workshop-black` numa janela anônima mostra só o portão, e o
planner não aparece em lugar nenhum do que o navegador recebeu. Digitar a senha
errada dá o recado e não deixa passar. Digitar a senha certa abre o planner, e
recarregar a página não pede senha de novo. Apagar a variável de ambiente e
recarregar recusa o acesso, mesmo para quem tinha acabado de entrar com a senha
certa.

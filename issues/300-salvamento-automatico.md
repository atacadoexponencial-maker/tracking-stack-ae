# 300: Salvamento automático e recuperação

**Tipo:** Implementação
**Página:** `/planner-workshop-black`

## Descrição

Fazer o planner guardar sozinho o que está sendo preenchido, no navegador de
quem preenche, e devolver tudo como estava quando a pessoa voltar. É a promessa
do aviso do cabeçalho sendo cumprida — e o que impede duas horas de workshop
virarem pó num toque errado.

## Escopo

- Qualquer campo preenchido é gravado sozinho pouco depois, sem clique.
- O indicador do cabeçalho mostra "Salvo agora há pouco" depois de cada gravação.
  Ele fala do rascunho no navegador, não do PDF.
- Recarregar a página devolve tudo: textos, números, datas, marcações de canal,
  itens de oferta, narrativa escolhida, resposta da Black VIP e tema.
- Fechar o navegador e voltar no dia seguinte, no mesmo aparelho e navegador,
  devolve o preenchimento inteiro.
- Outro aparelho ou outro navegador encontra o planner vazio — como o aviso do
  cabeçalho já diz.
- Canal desmarcado guarda o nome do responsável mesmo assim; desmarcar não apaga
  o que foi escrito.
- Navegador em modo privado ou com gravação bloqueada: o planner continua
  preenchível e as duas saídas continuam funcionando na sessão, e a página avisa
  que não vai conseguir guardar o rascunho e que o PDF é a única saída.
- Entrar de novo depois do acesso expirar e digitar a senha outra vez encontra o
  preenchimento intacto.

## Pronto quando

Dá para preencher campos dos quatro blocos, ver o indicador confirmar o
salvamento, apertar F5 e encontrar tudo exatamente como estava — inclusive as
marcações e o tema. Numa janela anônima, o planner preenche e imprime
normalmente e mostra o aviso de que não vai guardar.

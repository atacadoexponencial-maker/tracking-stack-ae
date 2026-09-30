# 349: Abas Grupos e Disparos na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Grupos e Disparos
**Spec:** `spec.md` (Módulos 9 e 10)

## Descrição

Reestilizar as duas abas de WhatsApp com os componentes da fundação: Grupos com etiqueta de estado da conexão em selo, lista de grupos monitorados com chave liga/desliga no estilo da tinta e busca, etiquetas de conversão no Meta e tabela de eventos (entrou/saiu com sinal); Disparos com bloco "Compor" (campos, área de soltar arquivo com contorno tracejado, prévia em balão de WhatsApp), grade da semana com o dia de hoje em fio forte e itens agendados como etiquetas pequenas, tabela "Já foram". Inclui a correção de comportamento da spec: cancelar um disparo confirma na própria linha, sem diálogo do navegador.

## Pronto quando

- Na preview, Grupos e Disparos aparecem no mundo claro com os mesmos dados de produção.
- Ligar ou desligar o monitoramento de um grupo pela chave e buscar pelo nome funcionam; estado da conexão aparece como selo com texto.
- Arrastar um arquivo sobre a área acende a borda; a prévia do texto aparece em balão antes de agendar; clicar num dia mostra os itens dele; item que falhou fica em coral.
- Cancelar um disparo pede confirmação dentro da própria linha e nunca abre `confirm()` do navegador.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Específico: balão de prévia em etiqueta com sombra curta; dia de hoje com fio forte no topo; item agendado como etiqueta pequena com contorno; área de soltar acende na tinta. Cancelar disparo já confirmava na própria linha (`pedirConfirmacao`), nada a mudar. Disparos conferida na preview.

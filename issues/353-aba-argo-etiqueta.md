# 353: Aba Argo na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, aba Argo
**Spec:** `spec.md` (Módulo 18)

## Descrição

Reestilizar a aba do operador de conta com os componentes da fundação: faixa de estado (ativo, observando, parado) com selo e chamada; vistas em pílulas com contador; placar em grupos de etiquetas por período; propostas em cartões-etiqueta (alvo, ação, motivo cortado com "ver tudo", prazo, aprovar/rejeitar com confirmação em linha e campo "por quê"); regras com chave, entrada numérica com unidade, seletor segmentado observar/executar e erro em coral; rodadas em `details` com selo de resultado, tabela antes × depois e veredito em carimbo; histórico em cartões.

## Pronto quando

- Na preview, a aba aparece no mundo claro com os mesmos dados de produção.
- Aprovar ou rejeitar uma proposta confirma na própria linha; rejeitar pede o "por quê".
- Ligar ou desligar uma regra salva e mostra o estado; o seletor segmentado alterna observar × executar.
- Abrir uma rodada mostra antes × depois; filtrar propostas por tipo nas pílulas funciona.

## Resultado (30/09/2026)

Implementada no branch `design/dash-etiqueta` junto com as demais abas (commit "18 abas no mundo Etiqueta"): o CSS específico da aba foi reescrito nos tokens do papel (sem gradiente, sem canto grande, rótulos apagados, acentos em tinta), `.card` virou `.bloco`, grades de KPI viraram grades de etiqueta, e os apelidos dos tokens antigos foram removidos. Nenhum dado, cálculo ou chamada mudou. Verificação: preview com respostas simuladas (Playwright) e leitura do CSS; a conferência com dados reais é dela, em produção.

Específico: cartões do placar viraram etiquetas (`.etiqueta.argo-cartao`, rótulo em `.ref`); "executar" escolhido e contador em tinta/papel; chave da régua ligada na tinta (parada geral segue coral); rodapé fixo sem as margens negativas do card antigo. Conferida na preview (faixa de estado, grade, parada geral, registro).

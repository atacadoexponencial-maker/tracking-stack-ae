# 320: Pausar conjunto quando todos os anúncios ativos estão ruins

**Tipo:** Implementação
**Página:** Monitor de anúncios (gestor-ae) + executor + aba Argo — spec `spec-argo-plano-3.md`, módulos 1, 5 e 6

## Descrição

O monitor de anúncios passa a avaliar o conjunto: quando todos os anúncios ativos de um conjunto de funil julgável seriam pausados pela régua de anúncio, vira uma única ação "pausar conjunto" (reduzindo antes se o conjunto tiver orçamento próprio), obedecendo à grade, às travas, ao máximo de pausas por rodada e ao desfazer.

## Pronto quando

Com a grade em Propor, uma rodada sobre dados simulados cria uma proposta "Pausar conjunto" no lugar das N propostas de anúncio; aprovada no dash, o executor pausa o conjunto e registra antes/depois; Desfazer reativa o conjunto; o relatório do Slack mostra o bloco; conjunto com um anúncio bom ou ainda sem piso não vira candidato; e a ação sai do grupo "Ainda não implementadas" na grade.

## Cenários

### Happy Path
1. A rodada de anúncios (8h55) avalia os anúncios como hoje (`argo_anuncios.avaliar_anuncios`).
2. Lê no Meta os conjuntos ATIVOS da conta e os anúncios ATIVOS de cada um (`argo_conjuntos.ler_estrutura`).
3. Conjunto cujos anúncios ativos são TODOS candidatos (por nome) vira candidato a pausar conjunto.
4. Os `ad_ids` desse conjunto saem dos candidatos individuais; candidato de anúncio que fica sem `ad_ids` some.
5. Trava (aprendizado/intervalo) lida para o conjunto e a campanha dele (`argo_travas.dados_do_conjunto`).
6. Com orçamento diário próprio, sem redução nos últimos 30 dias, `reduzir_antes` ligado e "Reduzir orçamento" em Propor/Executar: vira redução do conjunto (mesmo caminho da 317, `alvo_tipo = "conjunto"`).
7. Senão: "Pausar conjunto" em Executar (e sem parada geral) pausa via `argo_executor._pausar_com_registro` no adset; em Propor, `registrar_proposta(tipo="pausar_conjunto")`.
8. Aprovada no dash, o executor pausa o `alvo_id` (adset) e registra; Desfazer reativa pelo caminho que já existe (`desfazer_um`, resultado "pausou").

### Edge Cases
- Conjunto com um anúncio bom, ou com anúncio abaixo do piso ("não julgado"), não vira candidato.
- Conjunto sem anúncio ativo não é avaliado.
- Mesmo nome de anúncio em outro conjunto que não é candidato: só os `ad_ids` do conjunto candidato saem da proposta individual.
- Grade de "Pausar conjunto" Desligada: nada muda em relação a hoje.
- Conjunto já pausado na hora de agir: "já estava".

### Cenário de Erro
- Falha ao ler a estrutura no Meta: o relatório diz "não consegui ler os conjuntos" e os anúncios seguem pelo caminho de hoje.
- Falha ao ler a trava: segura (como hoje).

## Arquivos

- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_conjuntos.py` — lê conjuntos/anúncios ativos no Meta e decide quais conjuntos têm todos os anúncios ruins (função pura `conjuntos_todos_ruins`).
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_conjuntos.py`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_travas.py` — `dados_do_conjunto(adset_id)`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — bloco "Pausar conjunto", antes das pausas de anúncio.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_executor.py` — `objetos_da_proposta` e `ROTULOS` para `pausar_conjunto`.
- **Modificar:** `test_ae_anuncios_monitor.py`, `test_argo_executor.py`.
- **Modificar (tracking):** `functions/api/_argo-config.js` — `pausar_conjunto` em `ACOES_COM_CONSUMIDOR`.

Reusar: `argo_executor._pausar_com_registro`, `argo_orcamento.reduzir`/`novo_orcamento`/`cabe_no_limite`, `argo_estado.ja_reduziu`, `registrar_proposta`, `vencer_ausentes`, `ae_trafego_monitor.meta_get`.

## Checklist

- [x] `argo_conjuntos.py` + testes da regra "todos ruins".
- [x] `dados_do_conjunto` nas travas.
- [x] Bloco no monitor: executar / propor / desligado / reduzir antes.
- [x] Executor: pausar_conjunto aprovado + desfazer.
- [x] Testes do monitor com `_regua`, pausas e Meta simulados (nunca pausa real).

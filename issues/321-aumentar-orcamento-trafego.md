# 321: Aumentar orçamento de campanha de tráfego que está bem abaixo da média

**Tipo:** Implementação
**Página:** Monitor de tráfego (gestor-ae) + executor + aba Argo — spec `spec-argo-plano-3.md`, módulos 3, 5 e 6

## Descrição

O monitor de tráfego passa a propor (ou executar) +20% no orçamento diário da campanha com CPV dos últimos 7 dias ≤ 70% da média das ativas em 30 dias, limitado pelo limite por ação e pela folga do teto mensal de Meta (sem teto, nunca aumenta), respeitando travas, um aumento por rodada e desfazer.

## Pronto quando

Com a grade em Propor e dados simulados, uma campanha barata vira proposta "Aumentar orçamento" com orçamento antes → depois e folga do mês; aprovada, o executor aumenta, relê e registra; Desfazer volta ao valor anterior; sem teto ou sem folga, o relatório diz o motivo e nada é proposto; a grade mostra o aviso "Sem teto, o Argo não aumenta orçamento"; e a ação sai do grupo "Ainda não implementadas".

## Cenários

### Happy Path
1. Na rodada de tráfego, depois das candidatas a pausa, o monitor procura campanhas BOAS: gasto na janela ≥ gasto mínimo da régua, CPV ≤ 70% da média das ativas, sem trava.
2. Escolhe a de menor CPV relativo (uma por rodada) e lê o orçamento dela (`argo_orcamento.orcamento_da_campanha`).
3. Aumento = 20% do orçamento diário, arredondado para baixo em reais inteiros (`argo_orcamento.valor_do_movimento`).
4. Folga: teto mensal de Meta da grade, gasto do mês da conta no Meta, soma dos orçamentos diários ativos (`argo_orcamento.folga_do_mes`). Só segue se soma + aumento ≤ (teto − gasto) ÷ dias restantes.
5. "Aumentar orçamento" em Executar, sem parada, dentro do limite por ação: `argo_orcamento.mudar_orcamento(tipo="aumentar_orcamento")` com write-ahead. Em Propor (ou acima do limite): proposta.
6. Aprovada, o executor aplica, relê e registra; Desfazer volta ao valor anterior (`argo_orcamento.desfazer_orcamento`).

### Edge Cases
- Sem teto na grade: não avalia, e o relatório diz "sem teto — o Argo não aumenta".
- Sem folga: "sem folga no teto (disponível R$ X/dia, orçamentos somariam R$ Y)".
- Movimento abaixo de R$ 5/dia: não vira ação.
- Campanha sem orçamento diário próprio: não aumenta.
- Orçamento mudou entre a proposta e a execução: "mudou", não mexe.
- Desfazer quando o orçamento já foi mexido depois: não mexe, diz que mudou.

### Cenário de Erro
- Falha ao ler gasto do mês ou orçamentos: não aumenta, relatório diz por quê.

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_orcamento.py` — `valor_do_movimento`, `mudar_orcamento` (generaliza `reduzir`), `folga_do_mes`, `desfazer_orcamento`, constantes (20%, 70%, R$ 5).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_trafego_monitor.py` — config (estado/permite/teto) e bloco "Aumentar orçamento".
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_executor.py` — executar `aumentar_orcamento`; desfazer de orçamento em `desfazer_um`.
- **Modificar:** `test_argo_orcamento.py`, `test_argo_executor.py`; **Criar:** `test_ae_trafego_aumentar.py`.
- **Modificar (tracking):** `functions/api/_argo-config.js` — `aumentar_orcamento` com consumidor.

## Checklist

- [x] Funções de orçamento + testes (arredondamento, folga, write-ahead, desfazer).
- [x] Bloco no monitor de tráfego + testes (sem teto, sem folga, trava, limite, executar/propor).
- [x] Executor: aprovado + desfazer.

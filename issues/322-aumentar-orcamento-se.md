# 322: Aumentar orçamento de alvo da SE com CPL bem abaixo da média

**Tipo:** Implementação
**Página:** Monitor de anúncios (gestor-ae) + aba Argo — spec `spec-argo-plano-3.md`, módulos 3 e 6

## Descrição

O monitor de anúncios passa a propor (ou executar) +20% no orçamento diário de onde ele mora (campanha ou conjunto de SE) quando o CPL dos últimos 7 dias é ≤ 70% do CPL médio do mês, com pelo menos um MQL e acima do piso de julgamento — reusando o teto, a folga, o executor e o desfazer da 321.

## Pronto quando

Com dados simulados, um conjunto de SE com CPL baixo e MQL vira proposta de aumento com resultado × média e folga do mês; sem MQL, abaixo do piso ou em funil não julgável não vira; aprovada, executa e pode ser desfeita; o relatório do Slack mostra o bloco.

## Cenários

### Happy Path
1. A rodada de anúncios lê, além dos 30 dias de hoje, os últimos 7 dias: gasto por anúncio no Meta (com `adset_id`) e leads pelo endpoint (`dias=7`, `maturacao_dias=0`).
2. Agrupa os anúncios de SE por DONO DO ORÇAMENTO: a campanha, se ela tem orçamento diário; senão, o conjunto (`argo_conjuntos.dono_do_orcamento`).
3. CPL 7d do dono = gasto 7d ÷ leads 7d. Candidato se CPL ≤ 70% do CPL médio do funil (janela da régua), com ≥ 1 MQL nos 30 dias e acima dos pisos da régua de anúncio (3× CPL e impressões, somados no dono).
4. Um por funil por rodada (menor CPL relativo), trava, limite por ação e folga do teto — mesmas funções da 321.
5. Executar/Propor como na 321.

### Edge Cases
- Anúncio do dono com o mesmo nome em OUTRO dono: não dá para separar os leads, então "não avaliável" com o motivo — nunca aumenta.
- Sem lead nos 7 dias: sem CPL, não é candidato.
- Funil não julgável: nunca.
- Junção abaixo do piso: nada de aumento (dado ruim não vira ação).

### Cenário de Erro
- Falha na leitura de 7 dias: o relatório diz que o aumento não foi avaliado; o resto da rodada segue.

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_anuncios.py` — `gasto_por_anuncio` passa a trazer `adset_ids` por nome.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_conjuntos.py` — `dono_do_orcamento`, `candidatos_a_aumentar_se` (pura).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — bloco "Aumentar orçamento" da SE.
- **Modificar:** testes correspondentes.

Reusar: tudo de orçamento da 321; `_juncao_do_periodo`; `argo_travas.dados_da_campanha`/`dados_do_conjunto`.

## Checklist

- [x] `adset_ids` na junção + teste.
- [x] Regra pura de candidato a aumentar na SE + testes (nome duplicado, sem lead, sem MQL, pisos).
- [x] Bloco no monitor + testes.

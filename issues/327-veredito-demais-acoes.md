# 327: Veredito dos demais tipos de ação

**Tipo:** Implementação
**Página:** Monitor de anúncios e executor (gestor-ae) — spec `spec-argo-veredito-acoes.md`, módulo 1 (decisões D2, D5, D6)

## Descrição

Estender a avaliação da issue 326 aos outros tipos: pausa de anúncio, pausa de conjunto, reduzir, aumentar, realocar e reativar. A rodada de anúncios também passa a avaliar e a mostrar o bloco "Vereditos de hoje". Desfazeres não recebem veredito.

## Pronto quando

Com uma ação de cada tipo registrada há 7 dias completos, a rodada de anúncios grava um veredito para cada uma com a regra da spec, e o relatório do Slack do monitor de anúncios mostra o mesmo bloco da issue 326. Um `desfazer_pausa` ou `desfazer_orcamento` marca a ação original como "desfeita antes da janela" e não recebe veredito próprio.

## Cenários

### Happy Path
1. **Pausa de anúncio** (D2): CPL do conjunto do anúncio nos dias depois ≤ CPL de antes (dentro da tolerância) = acertou; piorou e nenhum outro anúncio do conjunto absorveu o gasto com CPL melhor = errou; conjunto gastou abaixo de 3× o CPL médio do funil (D5) = inconclusivo.
2. **Pausa de conjunto**: mesma regra, no nível da campanha.
3. **Reduzir orçamento**: CPL (ou custo por visita, se o alvo for de tráfego) do alvo depois ≤ referência = acertou; acima = errou; sem gasto no piso = inconclusivo.
4. **Aumentar orçamento**: alvo gastou o novo orçamento E CPL ≤ referência = acertou; CPL acima = errou; não chegou a gastar o aumento = inconclusivo.
5. **Realocar verba**: destino com CPL ≤ referência e origem não piorou = acertou; destino pior que a origem estava antes = errou; um dos dois sem gasto no piso = inconclusivo. Um único veredito para o par.
6. **Reativar anúncio**: dentro do CPL médio do funil = acertou; acima = errou; sem gasto no piso = inconclusivo.
7. Leads e MQL vêm do endpoint `/api/argo/leads-por-anuncio` do tracking, como o monitor já faz; gasto vem do Meta por `time_range`.

### Edge Cases
- Alvo mudou de novo dentro da janela → inconclusivo (D6), para todos os tipos.
- Pausa de anúncio cujo conjunto também foi pausado dentro da janela → inconclusivo "conjunto pausado em DD/MM".
- Realocação em que a origem foi reduzida e o destino não recebeu (ação pela metade) → fora da fila com motivo "aplicação incompleta".

### Cenário de Erro
- Endpoint do tracking indisponível → mesma regra de releitura da issue 326 (fica na fila, conta nos erros do relatório).

## Como cada ação está gravada hoje (pesquisa de 27/09 — não reinvestigar)

| Tipo em `argo.acoes` | `alvo_tipo` | `alvo_id` | `estado_anterior` | Observação |
|---|---|---|---|---|
| `pausar_anuncio` | `anuncio` | **id do objeto** (um registro por anúncio homônimo) | `{status}` | `alvo_nome` = nome do anúncio (chave dos leads) |
| `pausar_conjunto` | `conjunto` | adset_id | `{status}` | |
| `reduzir_orcamento` / `aumentar_orcamento` | `campanha` ou `conjunto` (nível do dono) | objeto_id | `{daily_budget}` | `estado_posterior` `{daily_budget}` |
| `realocar_verba` | nível de cada lado | objeto_id | `{daily_budget}` | **DOIS registros** na mesma rodada, `motivo` termina em "(origem)" e "(destino)" (`argo_orcamento.realocar`) |
| reativação | `desfazer_pausa` | id do anúncio | `{status}` | `desfaz_acao_id` aponta a pausa; motivo "desfazer pedido no dash (proposta reativação, ação N)" quando automática, ou proposta numérica de tipo `reativar_anuncio` (`propostas.acao_id`) |
| desfazer da gestora | `desfazer_pausa` / `desfazer_orcamento` | objeto | | `desfaz_acao_id` = a original; **`acoes.desfeita_em` NUNCA é escrito** (ninguém grava; a 326 assumiu errado) |

Consequências para o desenho:
- "Desfeita" = existe `d` em `argo.acoes` com `d.desfaz_acao_id = a.id AND d.aplicada`. A fila da 326 passa a calcular `desfeita_em` assim (`MIN(d.criada_em)`), em vez de ler a coluna.
- "Reativação" = `desfazer_pausa` que veio do Argo: `EXISTS propostas p WHERE p.acao_id = a.id AND p.tipo = 'reativar_anuncio'` OU `motivo LIKE '%proposta reativação%'`. Só essas entram na fila como `tipo_efetivo = 'reativar_anuncio'`; os outros `desfazer_*` nunca entram.
- Realocação: o par é avaliado UMA vez. A fila entrega a linha "(origem)"; a "(destino)" é localizada na mesma rodada e recebe `sem_avaliacao` "avaliada junto com a origem (ação N)" para sair da fila.

## Regras por tipo (D2, D5, D6)

Referências comuns:
- **Leads por nome** vêm do tracking por `ae_anuncios_monitor._leads_por_nome(dias)` (últimos `dias` até agora). Janela passada por diferença, como a 324: leads em [d1, d2] = `f((hoje−d1).days + 1) − f((hoje−d2).days)`, com `f(k<=0) = {}` e resultado nunca negativo. Aproximação assumida e documentada no código.
- **Gasto por conjunto** em datas passadas: `argo_conjuntos.gasto_dos_conjuntos([ids], desde, ate)`.
- **CPL médio do funil** e **funil do anúncio**: `ae_anuncios_monitor._juncao_do_periodo(regua lead_janela_cpl_dias)` → `linhas[nome].funil`, `.julgavel`, `.cpl_medio_funil`. É a média de HOJE (o endpoint não olha o passado); documentado como referência corrente.
- **Piso de lead (D5):** gasto do alvo na janela ≥ `avaliacao_piso_lead_multiplicador` (padrão 3) × CPL médio do funil. Sem CPL médio → inconclusivo "sem referência".
- **Tolerância:** `avaliacao_tolerancia_pct` (padrão 30). "Dentro" = `≤ referência × (1 + tol)`.
- **D6:** `updated_time` do alvo (e do conjunto/campanha dele) entre `criada_em + 5 min` e o fim da janela → inconclusivo "alvo mudou de novo em DD/MM". Leitura por `argo_travas.dados_do_anuncio([id])`, `dados_do_conjunto(id)`, `dados_da_campanha(id)` conforme o `alvo_tipo`.
- Anúncios/conjuntos de funil **não julgável** (LIVE, WO PAGO) → `sem_avaliacao` "funil não é julgável por lead".

| Tipo | Antes | Depois | Referência | Acertou | Errou |
|---|---|---|---|---|---|
| `pausar_anuncio` | CPL do **conjunto** do anúncio (gasto dos conjuntos ÷ leads dos nomes do conjunto, incluindo o pausado) nos 7 dias antes | CPL do conjunto nos dias da janela (anúncios que ficaram) | CPL do conjunto antes | depois ≤ antes × (1+tol) | depois > antes × (1+tol) **e** nenhum outro anúncio do conjunto teve CPL ≤ CPL médio do funil na janela |
| `pausar_conjunto` | CPL da **campanha** (soma dos conjuntos ativos dela) 7 dias antes | idem na janela | CPL da campanha antes | idem | idem (nível campanha) |
| `reduzir_orcamento` | CPL do alvo 7 dias antes (ou custo por visita se o alvo é de tráfego: `ae_trafego_monitor.campaign_metrics`) | CPL do alvo na janela | CPL médio do funil (ou média do custo por visita das ativas, tráfego) | depois ≤ ref × (1+tol) | acima |
| `aumentar_orcamento` | CPL do alvo 7 dias antes | CPL do alvo na janela + gasto médio/dia na janela | CPL médio do funil | gastou ≥ 80% do novo orçamento diário × dias **e** CPL ≤ ref × (1+tol) | CPL acima; não gastou o aumento → inconclusivo "não chegou a gastar o aumento" |
| `realocar_verba` | CPL da origem e do destino 7 dias antes | CPL dos dois na janela | CPL médio do funil | destino ≤ ref × (1+tol) **e** origem não piorou além da tol | destino pior que a origem estava antes |
| `reativar_anuncio` | CPL do anúncio antes da pausa original (7 dias antes de `desfaz_acao_id.criada_em`) | CPL do anúncio na janela | CPL médio do funil | depois ≤ ref × (1+tol) | acima |

Anúncios do conjunto (inclusive pausados) para o CPL do conjunto: `t.meta_get(f"/{adset_id}/ads", {"fields": "id,name,effective_status"})`; conjuntos da campanha: `t.meta_get(f"/{campaign_id}/adsets", {"fields": "id,name,effective_status"})`. O conjunto de um anúncio: `argo_travas.dados_do_anuncio([ad_id])` já devolve o `adset` (id) do objeto.

`numeros` gravados por tipo, sempre no formato da aba: métrica-guia (CPL do conjunto / CPL / CPL do destino), Gasto, Leads maduros com MQL ("6 (3 MQL)"), e Orçamento diário para os de orçamento ("R$ 20,00 → R$ 14,00").

`REGRA_VERSAO`: `pausa_anuncio/1`, `pausa_conjunto/1`, `reduzir/1`, `aumentar/1`, `realocar/1`, `reativar/1`.

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py`
  - `REGRA_VERSAO`/`TIPOS_AVALIAVEIS`/`ROTULO_TIPO` com os 7 tipos (`reativar_anuncio` é o `tipo_efetivo` das reativações).
  - `regua_avaliacao` ganha `piso_lead_multiplicador` (chave `avaliacao_piso_lead_multiplicador`, padrão 3) e `lead_janela_cpl_dias` (reusa a chave existente da régua, padrão 30).
  - Funções puras, uma por tipo, todas devolvendo `(situacao, motivo, numeros)`: `julgar_pausa_lead(antes, depois, referencia, regua, mudou_em, algum_bom)` (serve anúncio e conjunto), `julgar_orcamento(tipo, antes, depois, referencia, regua, mudou_em, gastou_aumento)`, `julgar_realocacao(origem, destino, referencia, regua, mudou_em)`, `julgar_reativacao(...)`.
  - Leitores com I/O: `_leads_janela(nomes, d1, d2)` (diferença de `_leads_por_nome`), `_cpl_periodo(adset_ids, nomes, d1, d2)`, `ler_pausa_lead(acao, regua, contexto)`, `ler_orcamento(acao, regua, contexto)`, `ler_realocacao(acao, par, regua, contexto)`, `ler_reativacao(acao, regua, contexto)`. `contexto` = `{"juncao": _juncao_do_periodo(...), "hoje": date}` lido UMA vez por rodada (uma chamada ao tracking, não uma por ação).
  - `avaliar_pendentes` despacha por `tipo_efetivo`; para `realocar_verba` busca a linha do destino (`argo_estado.par_da_realocacao`) e a fecha como `sem_avaliacao`; funil não julgável → `sem_avaliacao`.
  - `_linha_veredito` mostra a métrica-guia do tipo (rótulo do 1º item de `numeros`).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py`
  - `fila_de_avaliacao`: `desfeita_em` calculado pelo `desfaz_acao_id`; coluna `tipo_efetivo` (`CASE` para reativação); `desfazer_*` só entram como reativação; devolve também `desfaz_acao_id`, `rodada_id` e `executor` da rodada.
  - `fila_resumo`: mesma regra de desfeita e de tipos.
  - Nova `par_da_realocacao(acao_id, rodada_id)`: a outra linha `realocar_verba` da mesma rodada.
  - Nova `criada_em_da_acao(acao_id)` para a data da pausa original na reativação.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — em `_build_report_lines`, logo antes de `_antes_depois_se`/`_reativacoes` (final do bloco de decisões, antes das linhas que hoje fecham o relatório): mesmo trecho protegido da 326 (`argo_veredito.avaliar_pendentes(CONTA, rodada_id, agora)` + `bloco_relatorio`), com `rodada_id` nulo virando a linha de aviso. `_conclusao` continua achando "*Propostas de pausa*"/"*Candidatos*" primeiro, então o bloco não vira conclusão.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_veredito.py` — um bloco por tipo (acertou / errou / inconclusivo por piso / D6 / não julgável), par da realocação, reativação lendo a pausa original, fila com `desfeita` por `desfaz_acao_id`, `_leads_janela` por diferença com clamp em zero, monitor de anúncios chamando o bloco (patch de `argo_veredito.avaliar_pendentes`).

Nenhum arquivo do tracking muda nesta issue.

## Dependências Externas

Nenhuma nova.

## Deploy e verificação

Igual à 326: `scp` dos 4 arquivos, `unittest discover` na VPS, **sem rodar monitor à mão**. Como o `aplicar.py` não é tocado, nada de migration. Verificação real: cron das 8h50 (tráfego) e 8h55 (anúncios) de 28/09.

## Checklist

- [x] Regras dos 6 tipos com testes (acertou/errou/inconclusivo cada) — 48 casos em test_argo_veredito.py.
- [x] Desfazer tira a original da fila (calculado pelo `desfaz_acao_id`; a coluna `desfeita_em` nunca é escrita).
- [x] Bloco no relatório do monitor de anúncios (`_vereditos` → `argo_veredito.bloco_no_relatorio`).
- [ ] Rodada real: cron de 28/09 (8h50 tráfego, 8h55 anúncios). VPS sincronizada em 27/09 (gestor-ae), 387 testes verdes lá; fila hoje vazia, 1 ação aguardando (vence 29/09).

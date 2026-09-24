# 323: Realocar verba dentro do mesmo funil

**Tipo:** Implementação
**Página:** Monitores (gestor-ae) + executor + aba Argo — spec `spec-argo-plano-3.md`, módulos 2, 5 e 6

## Descrição

Forma no máximo um par por funil por rodada — origem que a régua de reduzir apontaria, destino que a régua de aumentar aprovaria, mesmo funil — e move 20% do orçamento da origem (mínimo R$ 5/dia, origem nunca abaixo de R$ 1/dia, teto no limite por ação), com precedência sobre aumentar, aplicação dos dois lados em sequência e devolução da origem se o destino falhar.

## Pronto quando

Com dados simulados, uma rodada com alvo ruim e alvo bom no mesmo funil cria uma proposta "Realocar verba" com os dois lados antes → depois (e não uma de aumentar); funis diferentes nunca formam par; aprovada, o executor aplica os dois lados; falha simulada no destino devolve a origem e registra "não completou" em destaque; Desfazer volta os dois; e a ação sai do grupo "Ainda não implementadas" (o grupo some).

## Nota — origem na SE

Na SE não existe régua de reduzir própria: anúncio não tem orçamento. A origem de SE é o conjunto (ou campanha) que a 320 mandaria **reduzir antes de pausar** — todos os anúncios ativos ruins e orçamento diário próprio. No tráfego, a origem é a campanha que a régua de reduzir da 317 já aponta. Depende de 320, 321 e 322.

## Cenários

### Happy Path
1. Tráfego: com "Realocar verba" em Propor/Executar, se há uma campanha para REDUZIR (a lista de reduções da 317) e uma campanha BOA (a da 321), forma o par. A origem sai da redução; o destino sai do aumento.
2. SE: origem = conjunto que a 320 mandaria reduzir; destino = dono que a 322 aumentaria; mesmo funil; objetos de orçamento diferentes.
3. Valor = 20% do orçamento da origem, arredondado para baixo em reais; origem nunca abaixo de R$ 1/dia; mínimo R$ 5/dia; teto no limite por ação.
4. Executar: `argo_orcamento.realocar` relê os dois lados, grava a intenção dos dois, reduz a origem e aumenta o destino; se o destino falhar, devolve a origem ("não completou").
5. Propor: proposta `realocar_verba` com os dois lados; o executor aplica igual.
6. Desfazer: os dois lados voltam ao valor anterior.

### Edge Cases
- Sem par no funil: redução e aumento seguem cada um pelo seu caminho (e pela sua grade).
- "Realocar" Desligado: nada muda em relação a 317/321/322.
- Qualquer lado mudou desde a decisão: não mexe, "mudou".
- A realocação conta como redução para o passo seguinte da origem (`ja_reduziu` enxerga o lado origem).

### Cenário de Erro
- Destino falha e a devolução da origem também falha: "não completou" em destaque, pedindo conferência no Gerenciador, com os dois estados.

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_orcamento.py` — `realocar`, `valor_realocacao`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py` — `ja_reduziu` enxerga o lado origem da realocação.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_trafego_monitor.py`, `ae_anuncios_monitor.py` — formar o par antes de reduzir/aumentar.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_executor.py` — executar `realocar_verba`.
- **Modificar:** testes correspondentes.
- **Modificar (tracking):** `functions/api/_argo-config.js` — `realocar_verba` com consumidor (o grupo "Ainda não implementadas" some).

## Checklist

- [x] `realocar` com devolução + testes.
- [x] Par no tráfego + testes.
- [x] Par na SE + testes.
- [x] Executor + desfazer dos dois lados.

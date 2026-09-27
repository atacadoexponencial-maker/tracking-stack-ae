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

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — regra por tipo; leitura de CPL por conjunto/campanha reusa `argo_conjuntos.gasto_dos_conjuntos` e a junção por nome de `ae_anuncios_monitor._leads_por_nome`.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — chama a avaliação no fim da rodada e anexa o bloco.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_estado.py` — ao concluir um desfazer, marca a ação original como fora da fila.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/test_argo_veredito.py` — um bloco de testes por tipo.

## Checklist

- [ ] Regras dos 6 tipos com testes (acertou/errou/inconclusivo cada).
- [ ] Desfazer tira a original da fila.
- [ ] Bloco no relatório do monitor de anúncios.
- [ ] Rodada real na VPS conferida.

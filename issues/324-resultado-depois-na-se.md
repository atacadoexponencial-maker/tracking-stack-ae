# 324: Antes e depois das mudanças de orçamento na SE

**Tipo:** Implementação
**Página:** Monitor de anúncios (gestor-ae) — relatório — spec `spec-argo-plano-3.md`, módulo 4

## Descrição

Levar para a SE o que o tráfego já tem (issue 316): toda mudança recente de orçamento num alvo de SE, de quem for, aparece no relatório com CPL e MQL nos 7 dias antes × depois e o veredito "manteve" ou "piorou" — só relatando, sem desfazer sozinho.

## Pronto quando

Com dados simulados de um conjunto de SE que teve o orçamento mudado, o relatório da rodada mostra a linha antes × depois com veredito; sem mudança recente, não aparece nada; se piorou além da média, o alvo cai na régua normal de reduzir na rodada seguinte.

## Cenários

### Happy Path
1. Na rodada de anúncios, para cada dono de orçamento da SE, as travas já leem `updated_time`.
2. Mudança recente (dentro de 30 dias): CPL e MQL dos 7 dias antes × depois — gasto no Meta com `time_range` e leads pelo endpoint.
3. Linha no relatório: "mudou em DD/MM: CPL antes R$ X (N MQL) → depois R$ Y (M MQL) — manteve/piorou". "Piorou" = CPL depois acima do CPL médio do funil.

### Edge Cases
- Menos de um dia completo depois: "ainda sem dia completo".
- Sem lead numa das janelas: CPL "—".

### Cenário de Erro
- Falha de leitura: a linha diz "não consegui ler antes/depois (Tipo)"; nada mais muda.

## Arquivos

- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — bloco "Mudanças recentes — antes e depois" da SE.
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_conjuntos.py` — função pura do veredito.
- **Modificar:** testes correspondentes.

O endpoint de leads só aceita `dias` (janela até agora). Leads "antes" = leads(dias até o início da janela antes) − leads(dias até a mudança), por nome. Sem mudança no tracking.

## Checklist

- [x] Veredito puro + testes.
- [x] Bloco no relatório + testes.

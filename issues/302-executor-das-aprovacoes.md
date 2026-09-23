# 302: Executor das aprovações

**Tipo:** Implementação
**Página:** Argo na VPS (repo `gestor-ae`) + histórico da aba Propostas — spec `spec-argo-aprovar-propostas.md`, módulo 4

## Descrição

Rotina na VPS a cada ~10 min que executa cada proposta aprovada uma única vez: confere parada geral e estado atual do alvo, grava intenção e estado anterior antes de agir, pausa (anúncio: todos com o mesmo nome), relê o alvo e marca conferido/falhou/desconhecido. O histórico da tela passa a mostrar os selos de execução.

## Pronto quando

Aprovar uma proposta no dash faz o alvo aparecer pausado no Gerenciador em até ~10 min e a proposta aparece como "Executada e conferida"; com parada geral ligada ela fica "aguardando"; rodar o executor duas vezes ao mesmo tempo não age duas vezes.

## Plano (executado em 23/09)

- **Banco:** migration `gestor-ae/migrations/argo/0003_propostas_execucao.sql`
  — `execucao_estado` (executando/conferida/nao_conferida/nao_executou),
  `execucao_em`, `acao_id` → `argo.acoes`, `execucao_detalhe`; índice das
  aprovadas a executar.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_executor.py` e
  `test_argo_executor.py`; `venv_do_perfil.py` (troca para o Python do perfil
  — o do Hermes não tem `psycopg`).
- **Modificar:** `argo_estado.py` (`reivindicar_aprovada`,
  `liberar_reivindicacao`, `concluir_execucao`);
  `functions/api/_argo-propostas.js` e `argo/propostas.js` (situação a partir
  da execução; "executando" há mais de 15 min vira "não conferida");
  `tests/argo-propostas.test.js`.
- **VPS:** job Hermes `5f38f2a95279`, `*/10 * * * *`, no-agent, Slack.

### Cenários cobertos por teste
Parada geral / grade ilegível → não age; nada aprovado → silêncio sem rodada;
intenção gravada antes da pausa; já pausada → não chama o Meta; erro do Meta
depois da intenção → não conferida; anúncio pausa todos os ids; falha ao abrir
a rodada devolve a proposta; teto de 10 por execução; erro sai só com o tipo.

## Checklist

- [x] Migration 0003 aplicada na Neon
- [x] Executor com write-ahead, reivindicação atômica e conferência
- [x] Monitor de anúncios roda no Python do perfil (achado durante a 302)
- [x] Histórico da aba mostra os selos de execução
- [x] Testes: 232 no gestor-ae (local e VPS), 788 no tracking
- [x] Job do Hermes criado
- [ ] Ponta a ponta com uma aprovação real — depende da usuária aprovar no dash

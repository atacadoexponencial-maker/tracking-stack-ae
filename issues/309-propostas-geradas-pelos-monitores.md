# 309: Monitores geram propostas de verdade

**Tipo:** Implementação
**Página:** Argo na VPS (repo `gestor-ae`) — spec `spec-argo-aprovar-propostas.md`, módulo 5

## Descrição

Fazer os dois monitores respeitarem Desligado/Propor/Executar da grade e gravar propostas versionadas (uma pendente por alvo; versão nova substitui a anterior; vence na rodada seguinte; rejeitado respeita o intervalo mínimo), agendar o monitor de anúncios nos dias úteis logo após o de tráfego e fazer o Slack trazer sempre "N propostas aguardando" com link para a aba. "Pausar anúncio" em Executar se comporta como Propor nesta issue (o monitor de anúncios não pausa até a régua nova, issue 314), e o relatório diz isso.

## Pronto quando

Com "Pausar campanha de tráfego" em Propor, a rodada real grava uma proposta para cada candidata e o Slack mostra a contagem e o link — inclusive "0 aguardando"; o monitor de anúncios roda sozinho no dia útil seguinte; os testes dos dois monitores passam na VPS.

## Cenários

### Happy Path
1. 8h50, monitor de tráfego, "Pausar campanha de tráfego" em **Propor**: para
   cada candidata grava (ou atualiza) uma proposta e lista no Slack como hoje.
2. Se já existe proposta **pendente** para o mesmo alvo, ela ganha uma versão
   nova (motivo, números e validade atualizados, `versao + 1`) em vez de
   duplicar.
3. Pendentes do mesmo tipo cujo alvo **não** é mais candidato nesta rodada
   viram `vencida` (decidida_por = `argo`), com o motivo "não é mais candidata".
4. 8h55, monitor de anúncios (agendado nesta issue), mesmo comportamento para
   "Pausar anúncio".
5. Os dois relatórios terminam com "📋 N propostas aguardando você —
   https://atacadoexponencial.com/dash/#argo?v=propostas" (também com 0).

### Edge Cases
- Estado **Desligado**: só relata; não grava proposta nem vence as existentes.
- Estado **Executar** no tráfego: pausa sozinho, como hoje (nada muda).
- Estado **Executar** em "Pausar anúncio": trata como Propor e escreve no
  relatório "Executar ainda não vale para anúncio — virou proposta".
- Alvo **rejeitado** há menos de 3 dias (intervalo mínimo, fixo até a 304):
  não vira proposta; o relatório diz "rejeitada em <data>, reavalia a partir
  de <data>".
- Parada geral ligada: propostas continuam sendo geradas (propor não age); o
  relatório lembra que nada será executado.
- Validade (`vence_em`): próximo dia útil às 10h (BRT) — cobre a rodada
  seguinte; se ela não rodar, a proposta vence pelo relógio.
- Dois monitores rodando ao mesmo tempo: índice único parcial garante uma só
  pendente por (conta, tipo, alvo).

### Cenário de Erro
- Banco fora do ar ao gravar proposta: a candidata continua listada no Slack
  com "⚠️ não gravada como proposta — aprovar pela aba indisponível"; a rodada
  não quebra.
- Falha ao contar pendentes: a linha do rodapé diz "não consegui contar as
  propostas", nunca "0".

## Banco de Dados

- Tabela: `argo.propostas` (migration nova `0002_propostas_versao.sql`)
  - `versao` (INTEGER NOT NULL DEFAULT 1) — incrementa a cada rodada que
    reafirma a proposta pendente; a aprovação (301) é presa a ela
  - `atualizada_em` (TIMESTAMPTZ) — quando a versão atual foi gravada
  - `por_que` (TEXT) — motivo opcional da rejeição (preenchido pela 301)
  - `decisao` passa a aceitar `aprovada`, `rejeitada`, `vencida` (CHECK)
  - índice único parcial `(conta, tipo, alvo_id) WHERE decisao IS NULL`

## Arquivos

Repositório `gestor-ae`:
- **Criar:** `migrations/argo/0002_propostas_versao.sql` — colunas, CHECK e
  índice acima.
- **Modificar:** `profiles/gestor-ia/scripts/argo_estado.py` —
  `estado_da_acao(grade, acao)` (desligado/propor/executar, negando por
  padrão), `propor(...)` (insere ou versiona, respeita rejeição recente),
  `vencer_ausentes(conta, tipo, alvos, rodada_id)`, `contar_pendentes(conta)`,
  `proximo_vencimento(agora)`. Reaproveita `_conectar` e o estilo de
  `registrar_proposta` (que passa a delegar para `propor`).
- **Modificar:** `profiles/gestor-ia/scripts/ae_trafego_monitor.py` — no ramo
  "não pausei", quando o estado é Propor, chama `propor`/`vencer_ausentes` e
  acrescenta o rodapé de pendentes.
- **Modificar:** `profiles/gestor-ia/scripts/ae_anuncios_monitor.py` — lê o
  estado de `pausar_anuncio`; Desligado não grava; Propor/Executar gravam via
  `propor`; vence ausentes; rodapé.
- **Modificar:** `profiles/gestor-ia/scripts/test_argo_estado.py`,
  `test_ae_anuncios_monitor.py`, `test_ae_trafego_registro.py` — testes dos
  cenários acima.

Na VPS (não é arquivo do repo):
- Job novo no Hermes: `55 8 * * 1-5`, `--script ae_anuncios_monitor.py
  --no-agent --deliver slack:C0BJK31RGM9`, perfil `gestor-ia`.

## Checklist

- [x] Migration 0002 escrita e aplicada na Neon
- [x] `argo_estado`: estado_da_acao, propor (insere/versiona/respeita rejeição), vencer_ausentes, contar_pendentes, proximo_vencimento
- [x] Monitor de tráfego grava propostas em Propor e mostra o rodapé
- [x] Monitor de anúncios respeita o estado e mostra o rodapé
- [x] Testes novos passando localmente e na VPS
- [x] Scripts enviados à VPS (scp) e job do monitor de anúncios criado
- [x] Rodada real dos dois monitores conferida no Slack e no banco

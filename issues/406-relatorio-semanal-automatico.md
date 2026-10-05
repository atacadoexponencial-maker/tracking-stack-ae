# 406: Relatório toda segunda às 07h, com aviso no Slack e histórico

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 4: geração, aviso e histórico)

## Descrição

O relatório passa a ser gerado sozinho toda segunda às 07h cobrindo os 7 dias anteriores, avisa no canal dos monitores do Slack (pronto ou falhou, com o motivo), e a aba ganha o histórico de semanas, a abertura de relatórios antigos como foram publicados, a comparação de duas semanas lado a lado e o "gerar de novo" que guarda a versão anterior como substituída.

## Pronto quando

Numa segunda às 07h o relatório aparece na aba sem ninguém pedir e a mensagem chega no Slack com o link; uma falha forçada aparece como "falhou" na aba e no Slack com o motivo; ela abre uma semana antiga, compara duas semanas e refaz uma semana vendo a versão anterior marcada como substituída.

## Cenários

### Happy Path
Toda segunda às 07h o job `argo_relatorio_semanal.py` (gestor-ae, Hermes `no_agent`) chama `POST /api/argo/relatorio-agendado` com a `ARGO_KEY`. O tracking gera o relatório dos 7 dias anteriores e devolve a mensagem curta (situação, até 3 destaques, link). O Hermes entrega no canal dos monitores (`C0BJK31RGM9`).

### Edge Cases
- "Gerar de novo" na mesma semana: linha nova; a anterior fica marcada como substituída, com quem a substituiu, e continua abrindo no histórico.
- Comparar: só semanas diferentes; o padrão compara as duas semanas mais recentes não substituídas.
- Gerado fora da segunda: cobre os 7 dias que terminam ontem.

### Cenário de Erro
Tracking fora ou sem resposta: o job imprime mensagem fixa "não foi gerado" (sem segredo). Geração que falha grava `falhou` e o Slack diz o motivo.

## Arquivos

- **Criar:** `functions/api/argo/relatorio-agendado.js`, `functions/api/_argo-relatorio-comparar.js`.
- **Criar:** `gestor-ae/profiles/gestor-ia/scripts/argo_relatorio_semanal.py` e `test_argo_relatorio_semanal.py`.
- **Modificar:** `functions/api/argo/relatorio.js` (histórico, `?id=`, `?comparar=`).

## Checklist

- [x] Rota agendada com `ARGO_KEY` e mensagem curta
- [x] Histórico com substituída e falhou, abrir semana antiga, comparar duas semanas
- [x] Job do Hermes escrito e testado (4 testes)
- [ ] Job cadastrado no `jobs.json` da VPS: só depois do merge (a rota não existe em produção antes disso)

## Implementação (04/10/2026)

Conferido localmente com o Neon real: duas semanas geradas, a regeração da mesma semana marcou a anterior como substituída, comparação lado a lado. O cadastro do job (`0 7 * * 1`, `deliver: slack:C0BJK31RGM9`) fica para depois do merge.

## Atualização (05/10/2026): a análise é escrita pelo próprio Argo

Decisão da gestora: sem chave de API separada. Sem `ANTHROPIC_API_KEY`, o relatório nasce `aguardando_analise` com um pedido em `argo.analise_pedidos` (migration `0011_analise_pelo_argo.sql`, aplicada em 05/10). O job `argo_relatorio_semanal.py` (modos `gerar` e `fila`) pega o pedido em `GET /api/argo/analise-pedidos`, roda `hermes -p gestor-ia chat --query-file ... -Q --oneshot -t ""` e devolve em `POST /api/argo/analise-pedidos`; a checagem (`_argo-relatorio-pedidos.js` sobre `_argo-relatorio-checagem.js`) decide e publica. Com chave configurada, o caminho direto pela API continua valendo.

Ponta a ponta com o Argo real (05/10, semana de 28/09 a 04/10, relatório de teste apagado depois): 27 mil caracteres de consulta, resposta em 56 s, passou na checagem na primeira tentativa, todas as frases com fatos citados, "sem conclusão" nos fatos de amostra pequena e nas ações sem veredito.

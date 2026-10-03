# 384: Relatório de campanha e visão do canal

**Tipo:** Implementação
**Página:** Dash › E-mail › Campanhas e Visão geral (spec `spec-email-proprio.md`, módulo 7)

## Descrição

Relatório por campanha (destinatários, entregues, voltaram, spam, aberturas e cliques únicos, descadastros, taxas, links clicados, listas filtráveis com link para o contato) e visão geral do canal por período com uso do limite do mês e alerta de spam/devolução acima do limite no aviso diário.

## Pronto quando

A usuária abre o relatório da campanha de teste, vê os números atualizarem conforme abre e clica, filtra quem clicou, abre o contato, e vê na visão geral quanto do limite do mês foi usado.

> **Notas do plano:**
> - **Limites de reputação (Postmark):** spam abaixo de 0,1% (1 em 1.000) e devolução abaixo de 10%. Acima disso o Postmark pode suspender a conta; a recomendação dele para devolução saudável é "bem abaixo de 5%". O alerta dispara quando, nos últimos 30 dias e com pelo menos 100 e-mails no canal, o **spam passa de 0,1%** ou a **devolução passa de 5%**, para avisar antes do limite de suspensão. A conta é por canal (transacional e marketing), como o Postmark mede.
> - **Pessoas únicas:** cada pessoa recebe um envio por campanha (382), então aberturas e cliques do relatório já são de pessoas únicas.
> - **Atualização sozinha:** com o relatório aberto, o dash pede os números de novo a cada 30 segundos. Os números mudam porque o webhook da 377 grava cada resultado.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Números por pessoa:** `email_envios` (origem `campanha`, `ref_id` = campanha) com `entregue_em`, `aberto_em`, `clicado_em`, `voltou_em`, `spam_em` e `descadastrou_em`, preenchidos pelo webhook (377).
- **Links clicados e motivo da devolução:** `email_eventos` (`tipo = 'clicado'` com `detalhe_json.link`; `tipo = 'voltou'` com `detalhe_json.tipo_devolucao`).
- **Contato:** `email_contatos` pelo e-mail; o nome leva ao `detalheContatoReal` (380) do dash.
- **Uso do mês:** `usoDoMes()` e `LIMITE_MES` de `functions/api/_email-campanhas.js` (382).
- **Datas:** `ymdBrt()` e `inicioDoDiaBrt()` de `functions/api/_data-brt.js`.
- **Aviso de integrações:** mesmo caminho do `email_agenda_falha` (379): `condicoesDasProtecoes()` em `_saude-alertas.js`, título em `TITULOS_CONDICAO` (`_meta-envio.js`) e item em `CONDICOES_COM_ITENS` (`_meta-alerta.js`).
- **Tela:** protótipo aprovado em `public/dash/email-mkt.js` (`relatorio` e `relatorioCampanha`): visão geral com período, régua do limite com projeção, etiquetas de entrega, spam, devolução e descadastro, lista de campanhas enviadas; relatório com etiquetas, números secundários, "Quem fez o quê" com filtro e links clicados.

### Pesquisa externa (Postmark)

- Limites: "keep your bounce rate below 10% and spam complaint rate below 0.1%"; "a healthy bounce rate should be well under 5%" ([Servers FAQ](https://postmarkapp.com/support/article/1137-servers-faq), [Terms of Service](https://postmarkapp.com/terms-of-service/)).

## Cenários

### Happy Path

1. Em Campanhas, "Ver relatório" (engrenagem ou detalhe da campanha enviada) abre o relatório.
2. O relatório mostra: destinatários, entregues (taxa de entrega), aberturas e cliques (pessoas únicas, taxa sobre entregues), voltaram, spam, descadastros e clique sobre abertura.
3. "Quem fez o quê": filtro Abriram, Clicaram, Voltaram, Descadastraram (com a contagem de cada um), 50 por página, com nome (ou e-mail), quando e o link clicado ou o motivo da devolução. Clicar no nome abre o contato.
4. "Links clicados": cada link com quantas pessoas clicaram.
5. Com o relatório aberto, os números se atualizam a cada 30 segundos.
6. "Visão geral do canal": período (este mês, mês passado, últimos 90 dias). Mostra a régua do limite do mês (usados, restam, projeção para o fim do mês, quanto foi de marketing e quanto foi da agenda), as etiquetas de enviados, entrega, spam, devolução e descadastro do período, e as campanhas enviadas no período com entrega, abertura e clique.
7. Se a reputação passar do limite, a visão geral mostra o alerta, e ele entra no aviso de integrações.

### Edge Cases

- **Campanha ainda enviando:** o relatório abre com os números parciais e o percentual enviado.
- **Campanha que falhou no meio:** relatório do que saiu; os que não saíram não contam como destinatários entregues.
- **Rascunho, agendada ou cancelada:** não tem relatório (o botão não aparece; a rota responde 409).
- **Nenhum envio no período:** etiquetas vazias com "nenhum envio no período".
- **Taxas sem base** (zero entregues): mostram "–", nunca divisão por zero.
- **Pessoa que não é mais contato** (removida do cadastro): aparece pelo e-mail, sem link.
- **Testes** (origem `teste`) ficam fora das taxas do canal, mas contam no limite do mês (saíram de verdade).
- **Pouco volume** (menos de 100 e-mails no canal em 30 dias): nada de alerta de reputação, para não alarmar por uma devolução em dez.

### Cenário de Erro

- **Campanha inexistente:** 404 "Campanha não encontrada."
- **Falha ao carregar:** aviso na tela "Não foi possível carregar o relatório (…)". A atualização automática tenta de novo no ciclo seguinte, sem apagar o que já está na tela.

## Banco de Dados

- Nenhuma tabela nova. Tudo sai de `email_envios`, `email_eventos`, `email_campanhas` e `email_contatos`.

## Arquivos

- **Criar:** `functions/api/_email-relatorios.js` — `relatorioCampanha(env, id)` (números e links clicados), `pessoasDaCampanha(env, id, filtro, pagina)`, `visaoCanal(env, periodo)` (enviados por canal, taxas, campanhas do período, uso do mês com projeção), `reputacao(env, t)` (taxas de 30 dias por canal e se passou do limite).
- **Criar:** `functions/api/email/relatorios.js` — `GET ?campanha=<id>[&lista=abriram|clicaram|voltaram|descadastraram&pagina=]` e `GET ?periodo=mes|mes-passado|90`, protegido por `DASH_KEY`.
- **Modificar:** `functions/api/_saude-alertas.js` — condição `email_reputacao` com os itens de `reputacao()` (ex.: "Marketing: spam 0,15% nos últimos 30 dias (limite 0,10%)").
- **Modificar:** `functions/api/_meta-envio.js` — título "Reputação do e-mail acima do limite" em `TITULOS_CONDICAO`.
- **Modificar:** `functions/api/_meta-alerta.js` — `email_reputacao` em `CONDICOES_COM_ITENS`.
- **Modificar:** `public/dash/email-mkt.js` — vistas `relatorio` e `relatorioCampanha` ligadas ao backend (sem selo de protótipo), atualização a cada 30 s com o relatório aberto, nome abrindo `detalheContatoReal`; em Campanhas, "Ver relatório" na engrenagem e no detalhe das campanhas que saíram.
- **Criar:** `tests/email-relatorios.test.js` — números e taxas da campanha a partir de envios e avisos do webhook, links clicados por pessoa única, listas filtradas com página e contato, campanha sem relatório (rascunho), visão do canal por período (mês, mês passado, 90 dias; testes fora das taxas), uso do mês com projeção, reputação (acima, abaixo, pouco volume) e a condição no aviso.

> Não toca: fluxos (385+), `functions/tracker.js`, GHL.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] `_email-relatorios.js` com relatório da campanha, listas, visão do canal e reputação
- [ ] `GET /api/email/relatorios`
- [ ] Condição `email_reputacao` no aviso de integrações
- [ ] Relatório e visão geral ligados ao backend, com atualização a cada 30 s
- [ ] "Ver relatório" nas campanhas que saíram
- [ ] Testes `email-relatorios` passando (`npm test`)
- [ ] Usuária abre o relatório da campanha de teste, vê os números mudarem conforme abre e clica, filtra quem clicou, abre o contato e vê na visão geral quanto do limite do mês foi usado

# 398: Campanha com e-mail escrito na hora

**Tipo:** Implementação
**Página:** Marketing › E-mail › Campanhas (spec `spec-editor-email.md`, módulo 8)

## Descrição

Deixar a campanha escolher entre usar um modelo e escrever o e-mail nela com o editor de blocos (assunto, prévia, cabeçalho, blocos), com teste, rascunho, revisar e disparar, agendar, salvar como modelo novo, partir de um modelo (cópia), aviso de descarte ao voltar para modelo, duplicar levando o e-mail, relatório mostrando o e-mail que saiu e e-mail travado depois de enviado.

## Pronto quando

Ela cria uma campanha sem modelo, manda teste, agenda ou dispara com o resumo de sempre, salva o e-mail como modelo novo, e o relatório mostra o e-mail que saiu.

## Cenários

### Happy Path
1. "Nova campanha" (e abrir um rascunho ou uma agendada) abre a tela inteira aprovada no protótipo 391: painel da campanha (nome, conteúdo, segmentos, quando enviar, passos) e, embaixo, o editor de blocos.
2. "Usar um modelo": escolhe o modelo de marketing; a prévia mostra o modelo (só leitura); "Escrever a partir deste modelo" copia o conteúdo para a campanha.
3. "Escrever o e-mail aqui": assunto, pré-visualização, cabeçalho e blocos ficam guardados na própria campanha (`assunto`, `previa`, `corpo`).
4. Mandar teste: com modelo, o teste do modelo; com e-mail escrito, o teste sai do que está na tela (`ref_id = campanha:<id>`), e o resumo mostra o último teste.
5. Revisar e disparar / agendar: o mesmo resumo de hoje (quem recebe, quem fica de fora, sem nome, último teste, limite) e a mesma confirmação.
6. No disparo (agora ou na hora agendada), o conteúdo é **congelado na campanha**: os lotes e o relatório usam o e-mail que saiu, mesmo que o modelo mude depois.
7. "Salvar como modelo" cria um modelo de marketing novo com uma cópia do e-mail escrito (a campanha continua com o próprio e-mail).
8. Relatório da campanha mostra o e-mail que saiu.

### Edge Cases
- Trocar de "Escrever o e-mail aqui" para "Usar um modelo" com e-mail escrito: pede confirmação de descarte.
- Duplicar: com modelo, a cópia aponta para o modelo; com e-mail escrito, a cópia leva o e-mail.
- Campanha enviada: o e-mail fica como saiu; só abre o detalhe e o relatório (sem editar).
- Nome de modelo repetido em "Salvar como modelo": erro do servidor, a tela continua.
- Campanhas antigas (com modelo, sem conteúdo congelado): continuam saindo do modelo.

### Cenário de Erro
- E-mail escrito inválido (campo desconhecido, link sem https, sem bloco): o resumo e o agendar recusam com o motivo, como hoje com modelo.
- Falha ao salvar: mensagem no topo, nada se perde na tela.

## Banco de Dados

- Tabela: `email_campanhas` (migration `0061_email_campanhas_conteudo.sql`)
  - `previa` (TEXT) — texto de pré-visualização do e-mail da campanha
  - `corpo` (TEXT) — documento de blocos do e-mail da campanha (escrito nela ou congelado no disparo)
  - (`assunto` já existe)

## Arquivos

- **Criar:** `migrations/0061_email_campanhas_conteudo.sql`.
- **Modificar:** `functions/api/_email-campanhas.js` — conteúdo do modelo ou da campanha (`conteudoDe`), salvar e duplicar com conteúdo, resumo e agendar com conteúdo, congelar no disparo, envio pelo conteúdo congelado, teste da campanha, salvar como modelo.
- **Modificar:** `functions/api/email/campanhas.js` — resumo por campanha, `enviar_teste`, `salvar_como_modelo`.
- **Modificar:** `functions/api/_email-relatorios.js` — relatório devolve o e-mail que saiu.
- **Modificar:** `public/dash/email-blocos.js` — modo campanha de verdade.
- **Modificar:** `public/dash/email-mkt.js` — campanhas abrem a tela nova; resumo e disparo reaproveitados; relatório com "Ver o e-mail que saiu"; sai o botão do protótipo.
- **Modificar:** `tests/email-campanhas.test.js` — e-mail escrito, congelamento, duplicar, teste, salvar como modelo.

## Checklist

- [x] Migration 0061 aplicada no remoto
- [x] Servidor: conteúdo da campanha, congelamento, teste e salvar como modelo
- [x] Tela da campanha de verdade
- [x] Relatório com o e-mail que saiu
- [x] Testes passando e conferido na prévia (sem disparar)

## Execução (04/10/2026)

- Migration 0061 aplicada no remoto antes do código (colunas `previa` e `corpo` conferidas).
- Servidor: e-mail escrito na campanha, conteúdo congelado no disparo (agora e agendado), envio pelo congelado, teste do e-mail escrito (`campanha:<id>`), salvar como modelo (confere antes de criar), duplicar, relatório com o e-mail que saiu. 4 testes novos; 1098 passando.
- Tela: Nova campanha, rascunho e agendada abrem a tela inteira; o formulário antigo em gaveta saiu (o resumo e o disparo foram reaproveitados em `mostrarResumo`). Campanha enviada segue no detalhe e no relatório, agora com "Ver o e-mail que saiu".
- Conferido na prévia: campanha nova com e-mail escrito, passos, "Revisar" travado sem segmento (não há segmento cadastrado), salvar, voltar e reabrir com o e-mail guardado. O rascunho de teste foi apagado. Disparo, agendamento, teste e salvar como modelo ficaram bloqueados na conferência (cobertos pelos testes).

Pendente (limpeza): o código só de protótipo em `public/dash/email-blocos.js` (dados de exemplo, prévia montada no navegador, painel do protótipo) não é mais chamado e pode sair.

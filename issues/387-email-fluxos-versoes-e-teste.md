# 387: Fluxos: editar ativo com segurança e testar

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Mudanças num fluxo ativo ficam em rascunho até publicar (o fluxo no ar segue rodando a versão anterior), descartar mudanças, publicar mudanças movendo quem está dentro sem perder ninguém (quem estava em cartão excluído sai com registro), e teste com endereço da equipe pulando esperas e escolhendo sim/não nos desvios.

## Pronto quando

A usuária edita um fluxo ativo, confere que ninguém recebeu nada novo, descarta, edita de novo e publica; roda o teste e recebe na hora todos os e-mails do caminho escolhido.

> **Notas do plano:**
> - **Duas versões já existem desde a 385 e a 386:** o quadro sempre salva no rascunho (`rascunho_json`) e o motor só lê a versão publicada (`publicado_json`). Por isso, editar um fluxo ativo já não afeta ninguém. Esta issue dá à tela o aviso "mudanças não publicadas" e os botões "Descartar mudanças" e "Publicar mudanças", e cuida de quem está dentro ao publicar.
> - **Quem está dentro, ao publicar mudanças:** continua no cartão em que está, se ele ainda existir (com as configurações novas valendo do próximo passo em diante; uma espera já em curso mantém o prazo que tinha). Quem está num cartão que foi excluído sai do fluxo com o registro "o cartão em que estava foi excluído". A confirmação diz antes quantas pessoas sairão.
> - **Teste:** anda pelo **rascunho** (dá para testar antes de publicar ou antes de publicar mudanças), um cartão por vez, conduzido pela tela. Os e-mails saem na hora para o endereço da equipe, com os dados de exemplo e o mesmo registro do teste de modelo (aparecem em Configuração › Últimos testes). Esperas são puladas. Em cada desvio e em cada espera "até algo acontecer", a equipe escolhe o caminho. O teste não coloca ninguém no fluxo e não conta nos números.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Versões:** `email_fluxos.rascunho_json` e `publicado_json` (385/386); `salvarFluxo`, `publicarFluxo`, `problemas` e `lerFluxo` em `functions/api/_email-fluxos.js`.
- **Pessoas dentro:** `email_fluxo_pessoas` e `email_fluxo_passos` (386); o passo `saiu` com o motivo é o mesmo que o motor grava.
- **Envio de teste:** `enviarTeste()` de `functions/api/email/config.js` (origem `teste`, mesma checagem de marketing liberado, registro em `email_envios`), `montarEmail()` de `_email-render.js` e `exemplos('marketing')` de `_email-campos.js`, como o teste de modelo (378).
- **Saídas por tipo:** `TIPOS[tipo].saidas(dados)` do catálogo em `_email-fluxos.js`.
- **Tela:** o protótipo aprovado já tinha, na barra, "Mudanças não publicadas", "Descartar mudanças" e "Publicar mudanças", e a gaveta "Testar o fluxo" passo a passo, com o endereço e a escolha de "sim" ou "não" nos desvios (`testar` e `desenharSituacao` do protótipo 376). A gaveta (`U().gaveta`) e o `pedirConfirmacao` do dash continuam valendo.
- **Testes:** banco compartilhado `tests/_fluxos-banco.js` (386).

### Pesquisa externa

- Nenhuma.

## Cenários

### Happy Path

1. A usuária abre um fluxo ativo e muda um cartão. O rascunho é salvo sozinho, e a barra mostra "Mudanças não publicadas · o fluxo no ar segue a versão anterior". O motor continua rodando a versão publicada; ninguém recebe nada novo.
2. **Descartar mudanças** (com confirmação): o quadro volta para a versão no ar.
3. Edita de novo e clica em **Publicar mudanças**. A confirmação diz quantas pessoas estão em cartões excluídos e vão sair ("Ninguém sai" quando for zero). Ao confirmar, a versão no ar passa a ser a nova; quem está em cartão que continua existe segue dali; quem está em cartão excluído sai com o registro.
4. **Testar** (rascunho, ativo ou pausado, sem problemas no quadro): a gaveta pede o endereço da equipe e começa no início:
   - e-mail: sai na hora para o endereço, com os dados de exemplo ("E-mail enviado: assunto");
   - espera por tempo ou até dia e hora: "Espera pulada";
   - desvio: botões "Seguir por sim" e "Seguir por não";
   - espera até algo acontecer: "Aconteceu" e "Não aconteceu";
   - objetivo: "Chegou ao objetivo";
   - ir para outro fluxo: "Iria para o fluxo X" (o teste para aí);
   - fim: "Concluiu o fluxo".
5. A usuária recebe na hora todos os e-mails do caminho escolhido.

### Edge Cases

- **Fluxo em rascunho:** sem "Publicar mudanças" e "Descartar" (só "Publicar" da 386); "Testar" funciona.
- **Mudança desfeita até ficar igual à versão no ar:** o aviso de mudanças some sozinho (as duas versões são comparadas no servidor).
- **Publicar mudanças com problemas no quadro:** recusado com a lista; o quadro aponta os cartões.
- **Pessoa reservada pela rodada na hora de publicar:** a troca de versão é uma escrita só; a rodada seguinte já lê a versão nova. Quem estava andando num cartão excluído sai na rodada, com o mesmo registro do motor ("o cartão em que estava não existe mais").
- **Espera alterada (ex.: de 1 para 3 dias):** vale para quem chegar nela depois; quem já está esperando mantém o prazo de antes.
- **Saída de desvio religada:** quem estava esperando antes do desvio segue pela ligação nova.
- **Teste com marketing não liberado:** os e-mails do teste são recusados com a mesma mensagem do teste de modelo; o passo mostra o motivo, e dá para seguir.
- **Teste com e-mail sem modelo ou incompleto:** o teste não começa enquanto houver problema no quadro.
- **Laço no teste:** cada clique anda um cartão; não existe repetição automática.
- **Duas abas:** descartar e publicar mudanças usam a versão do rascunho; se a outra aba salvou antes, recusa ("Este fluxo foi mudado em outra aba. Recarregue para continuar.").

### Cenário de Erro

- **Serviço de envio sem resposta no teste:** o passo mostra "Não foi possível falar com o serviço de envio agora" e oferece tentar de novo o mesmo cartão.
- **Endereço de teste inválido:** "Digite um e-mail válido para receber o teste."
- **Fluxo inexistente:** 404.

## Banco de Dados

- Nenhuma tabela nova. Usa `email_fluxos`, `email_fluxo_pessoas` e `email_fluxo_passos`.

## Arquivos

- **Modificar:** `functions/api/_email-fluxos.js` — `mudancas` (rascunho diferente do publicado) e `saem_ao_publicar` (quantos estão em cartões que não existem no rascunho) na leitura e no salvamento; `publicarFluxo` passa a aceitar fluxo ativo ou pausado ("publicar mudanças", com a saída de quem estava em cartão excluído); `descartarMudancas`; `passoDeTeste(env, id, { para, no, saida })` (executa um cartão do rascunho e devolve o que aconteceu e o próximo).
- **Modificar:** `functions/api/email/fluxos.js` — `POST { acao: 'descartar', id, versao }` e `{ acao: 'testar', id, para, no?, saida? }`; `publicar` aceita `versao`.
- **Modificar:** `public/dash/email-fluxos.js` — na barra, "Mudanças não publicadas", "Descartar mudanças" e "Publicar mudanças" (com a contagem de quem sai), e "Testar"; a gaveta do teste passo a passo, com as escolhas de saída.
- **Criar:** `tests/email-fluxos-versoes.test.js` — editar ativo não muda o que o motor roda, aviso de mudanças (e some ao desfazer), descartar, publicar mudanças (quem fica, quem sai com registro, contagem antes), recusa com problemas e com versão velha, teste passo a passo (e-mail sai na hora com dados de exemplo, espera pulada, desvio pela escolha, objetivo, ir para outro fluxo para, fim), teste não coloca ninguém no fluxo.

> Não toca: o motor (`_email-motor.js`), números e quem está dentro (388), `functions/tracker.js`.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] Aviso de mudanças e contagem de quem sai, vindos do servidor
- [ ] Descartar mudanças
- [ ] Publicar mudanças num fluxo ativo ou pausado, com a saída registrada de quem estava em cartão excluído
- [ ] Teste passo a passo pelo rascunho (e-mail na hora, espera pulada, escolha nos desvios)
- [ ] Barra e gaveta do teste no quadro
- [ ] Testes `email-fluxos-versoes` passando (`npm test`)
- [ ] Usuária edita um fluxo ativo, confere que ninguém recebeu nada novo, descarta, edita de novo e publica; roda o teste e recebe na hora todos os e-mails do caminho escolhido

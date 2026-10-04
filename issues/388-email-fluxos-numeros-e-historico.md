# 388: Fluxos: números no quadro e histórico do contato

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos e Contatos (spec `spec-email-proprio.md`, módulos 4 e 9)

## Descrição

Números em cada cartão (recebidos/abertos/clicados, sim/não em desvios, quantos esperando), filtro por período, quem está dentro e em qual cartão (clicando no número), abrir o contato, totais na lista de fluxos, e o fluxo no histórico do contato (entrou, cartões, saiu e por quê).

## Pronto quando

A usuária abre um fluxo publicado e vê os números em cada cartão, clica numa espera e vê quem está lá, abre um contato e vê o caminho que ele fez no fluxo.

> **Notas do plano:**
> - **De onde saem os números:** do caminho de cada pessoa (`email_fluxo_passos`, gravado pelo motor da 386) e da entrega de cada e-mail (`email_envios`, atualizado pelo webhook da 377). Não há tabela nova. Cada pessoa passa no máximo uma vez por cartão de e-mail, então recebidos, abertos e clicados já são de pessoas únicas.
> - **Período:** 7 dias, 30 dias ou desde o início, contando pela data do passo. "Esperando agora" e "dentro agora" são sempre do momento atual.
> - **Seguindo até o fim:** a usuária autorizou planejar e executar sem parar para aprovação (03/10).

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Caminho das pessoas:** `email_fluxo_pessoas` (cartão atual, situação, motivo de saída) e `email_fluxo_passos` (`entrou`, `email` com `envio_id`, `espera` com a saída, `desvio` com sim/não, `objetivo`, `ir_fluxo`, `fim`, `saiu`) da 386.
- **Entrega dos e-mails:** `email_envios` (`message_id`, `aberto_em`, `clicado_em`), origem `fluxo`.
- **Saída manual:** `tirarManual()` de `functions/api/_email-motor.js` (386).
- **Contato:** `detalheContatoReal` em `public/dash/email-mkt.js` (380), que já mostra "Fluxos" (386). O `util.abrirContato` usado pelo quadro ainda aponta para o detalhe de exemplo do protótipo; passa a abrir o real.
- **Tela:** o protótipo aprovado (376) já tinha os números no cartão (`numerosHtml`), o número da saída ("Sim 655"), o botão "N esperando agora", o seletor de período, a gaveta "Pessoas no fluxo" com "Tirar do fluxo" e, na lista, "Dentro agora", "Concluíram" e "Clique". O CSS (`.fx-nums`, `.fx-esperando`) continua no `index.html`.
- **Testes:** banco compartilhado `tests/_fluxos-banco.js`.

### Pesquisa externa

- Nenhuma.

## Cenários

### Happy Path

1. A usuária abre um fluxo publicado. Cada cartão mostra os números da versão no ar, no período escolhido na barra (7 dias, 30 dias, desde o início):
   - início: entraram;
   - e-mail: receberam, abriram (e a taxa), clicaram (e a taxa);
   - espera: "N esperando agora" (clicável) e, na espera "até algo acontecer", quantos foram por "aconteceu" e "não aconteceu";
   - desvio: quantos foram por "sim" e por "não", ao lado de cada saída;
   - objetivo: chegaram;
   - ir para outro fluxo: passaram;
   - fim: concluíram.
2. Clicar em "N esperando agora" (ou em "Pessoas no fluxo", na barra) abre a gaveta com quem está dentro: nome ou e-mail, cartão em que está, desde quando e "Tirar do fluxo". Clicar no nome abre o contato.
3. A lista de fluxos mostra, para cada um: dentro agora, concluíram e taxa de clique (pessoas que clicaram sobre pessoas que receberam algum e-mail do fluxo).
4. No detalhe do contato, cada fluxo da seção "Fluxos" mostra o caminho: entrou (e por qual gatilho), cada cartão por onde passou (e-mail com o assunto e se abriu ou clicou, espera, desvio com o lado, objetivo) e como terminou (concluiu, saiu e por quê, ou onde está agora).

### Edge Cases

- **Fluxo em rascunho:** sem números (ninguém entrou); a barra não mostra "Pessoas no fluxo".
- **Mudanças não publicadas:** os números são da versão no ar; cartão que só existe no rascunho aparece sem números; cartão excluído no rascunho some do quadro, mas o histórico dele continua no contato.
- **Período sem nada:** os cartões mostram zero, sem taxa ("–").
- **E-mail que falhou ao sair** (recusado ou sem confirmação): não conta em "receberam".
- **Pessoa que entrou por "ir para outro fluxo":** conta em "entraram" do fluxo de destino.
- **Contato excluído do cadastro:** aparece pelo e-mail no histórico, sem link.
- **Muitas pessoas dentro:** a gaveta mostra 100 por vez, com "Mostrar mais".

### Cenário de Erro

- **Falha ao carregar os números:** o quadro abre normalmente e os cartões ficam com "sem números agora"; a próxima troca de período tenta de novo.
- **Tirar do fluxo quem já saiu ou concluiu:** "Este contato não está andando nesse fluxo."
- **Fluxo inexistente:** 404.

## Banco de Dados

- Nenhuma tabela nova. Usa `email_fluxo_passos`, `email_fluxo_pessoas`, `email_envios` e `email_contatos`.

## Arquivos

- **Criar:** `functions/api/_email-fluxos-numeros.js` — `numerosDoFluxo(env, id, periodo)` (por cartão, da versão no ar), `pessoasDentro(env, id, { no, pagina })`, `totaisDosFluxos(env, ids)` (dentro agora, concluíram, taxa de clique) e `caminhoDoContato(env, contatoId)` (passos por fluxo, com assunto e abertura/clique dos e-mails).
- **Modificar:** `functions/api/email/fluxos.js` — `GET ?id=&numeros=7|30|tudo`, `GET ?id=&pessoas=1[&no=&pagina=]`, totais na lista, e `POST { acao: 'tirar', id, contato_id }` (usa `tirarManual`).
- **Modificar:** `functions/api/email/contatos.js` — no detalhe, cada fluxo traz o `caminho`.
- **Modificar:** `public/dash/email-fluxos.js` — números nos cartões e nas saídas, seletor de período, "N esperando agora", gaveta de quem está dentro (com abrir contato e tirar do fluxo), "Pessoas no fluxo" na barra, e as colunas Dentro agora, Concluíram e Clique na lista.
- **Modificar:** `public/dash/email-mkt.js` — `util.abrirContato` abre o detalhe real; no detalhe do contato, o caminho de cada fluxo.
- **Criar:** `tests/email-fluxos-numeros.test.js` — números por cartão a partir de um fluxo rodado pelo motor (receberam, abriram, clicaram, sim/não, esperando agora, aconteceu/não aconteceu, chegaram, concluíram), período, e-mail que falhou fora de "receberam", quem está dentro (por cartão e página), totais da lista, tirar do fluxo, caminho no contato.

> Não toca: o motor, `functions/tracker.js`, as demais vistas.

## Dependências Externas

- Nenhuma.

## Checklist

- [ ] `_email-fluxos-numeros.js` com números por cartão, quem está dentro, totais da lista e caminho do contato
- [ ] Rotas de números, pessoas e tirar do fluxo; totais na lista; caminho no detalhe do contato
- [ ] Números nos cartões com período, "esperando agora" e gaveta de quem está dentro
- [ ] Colunas da lista de fluxos
- [ ] Caminho do fluxo no histórico do contato
- [ ] Testes `email-fluxos-numeros` passando (`npm test`)
- [ ] Usuária abre um fluxo publicado e vê os números em cada cartão, clica numa espera e vê quem está lá, abre um contato e vê o caminho que ele fez no fluxo

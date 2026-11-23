# Princípios do projeto

Página de princípios: toda etapa do fluxo anti-vibe começa lendo este arquivo. O que é
específico do projeto (o que ele é, stack, pastas, comandos e as regras que só valem aqui)
fica no `CLAUDE.md`, que importa este arquivo; leia os dois.

## Regras sempre ativas

1. Só são mexidos os arquivos listados na tarefa atual.
2. Nenhuma funcionalidade além do que foi pedido é adicionada.
3. Código existente é reutilizado: antes de criar algo, procura-se por nomes parecidos.
4. Lógica de negócio fica no backend, nunca no frontend.
5. Chaves de API, segredos e tokens nunca ficam no frontend.

## Arquitetura

- **Cliente fino, servidor gordo.** O frontend só captura a intenção da pessoa e mostra a
  resposta. Validação, regra de negócio e autorização ficam no backend.
- **Isolamento por comportamento.** O código se organiza por comportamento, não por tipo de
  arquivo: cada funcionalidade na sua pasta, e mexer numa não afeta outra.
- **Segurança.** Segredos ficam em variáveis de ambiente do backend (o `.env` nunca é
  commitado). Permissão se confere no servidor, nunca só na tela.
- **Reuso.** Antes de criar, procure na base de código por nomes parecidos e importe o que
  já existe.
- **Padrões documentados.** Para dependência externa, siga a documentação oficial; não
  reinvente o que ela já resolve.

## Fluxo

Toda tarefa começa pela triagem (`/anti-vibe:triagem`), que escolhe a marcha:

- **Sonda**: pergunta de viabilidade. Responde e para.
- **Delimitada**: mudança num fluxo que já existe. Perguntas, desenho no chat, sim da
  pessoa, issue avulsa e esteira.
- **Arquitetural**: subsistema novo ou mudança de interface. `/anti-vibe:spec` (a pessoa
  aprova) e `/anti-vibe:break`, que grava as issues e inicia a esteira.

A esteira (`/anti-vibe:esteira`) leva cada issue por planejador, escritor de testes (testes
falhando antes do código), executor, auditor e revisor independente, e faz um commit por
issue no branch da série. Ela só para quando precisa de uma decisão da pessoa. Push, pull
request e merge são feitos pelo agente, sozinho, quando os checks passam (ver "Git").

Na dúvida entre duas marchas, escolha a mais pesada; complexidade que aparece no meio do
caminho sobe a marcha, nunca desce.

## Auditor

Pronto é veredito do auditor, nunca leitura. O auditor (skill `anti-vibe:auditor`) confere
se cada critério de aceite tem teste com o código dele e se o teste passou, se não há
suposição ou pergunta em aberto, se só os arquivos da issue foram mexidos, se nenhum teste
antigo foi alterado e se as regras por script foram respeitadas.

- Teste manual pendente não trava o commit, mas mantém a issue aberta.
- Exceção ao auditor só escrita na issue, com o motivo, quem aprovou e o dia.
- A configuração dele fica em `.claude/auditor.json`; as regras por script do projeto, em
  `.claude/auditor-regras.json`.

## Git

A dona do projeto não é dev e não revisa pull request. Subir é automático: o agente faz
tudo sozinho, sem pedir aprovação, quando os checks passam.

- Todo trabalho anda num branch próprio. A esteira usa `esteira/<série>`, um commit por issue.
- Ao terminar, o agente faz push do branch, abre o pull request e faz o merge na `main`
  **sem pedir aprovação**, desde que tudo isto passe:
  1. o auditor da issue deu "alinhada" (ou "alinhada com teste manual pendente");
  2. `npm test` passou;
  3. `npm run build` passou.
- Se algum check falhar, não sobe: corrige e roda de novo. Se não conseguir corrigir, para e
  explica em linguagem simples o que aconteceu.
- Merge na `main` = deploy em produção. Depois do merge, confira o check do Cloudflare Pages
  no commit e só diga que está no ar quando ele passar.
- **Exceções, que param e pedem um "pode" da dona antes do merge:** a mudança precisa de
  migration no D1 remoto ou de secret novo (aplicar antes do merge), ou apaga ou altera
  dados de produção.
- Depois do merge, conte o que mudou em linguagem simples, com o link do pull request.
- Nunca se commita `.env` nem arquivo com segredo.

# 385: Fluxos: montar no quadro e salvar rascunho

**Tipo:** Implementação
**Página:** Dash › E-mail › Fluxos (spec `spec-email-proprio.md`, módulo 9)

## Descrição

Lista de fluxos e o quadro visual funcionando: criar fluxo, todos os tipos de cartão com o painel de edição (gatilhos e filtros, e-mail com criar modelo sem sair, espera nos 3 modos com janela, desvio com condições e/ou, objetivo, ir para outro fluxo, fim), "+", ligar/desligar, mover, organizar, duplicar cartão, copiar e colar (inclusive para outro fluxo), excluir, desfazer/refazer, notas, zoom, mapa, salvamento automático, validação de fluxo quebrado, duplicar e arquivar fluxo. Montado de forma que novos tipos de cartão possam entrar depois.

## Pronto quando

A usuária monta do zero um fluxo com gatilho filtrado, dois e-mails, espera, desvio e objetivo, fecha e reabre e está tudo salvo; o quadro aponta onde está o problema quando falta ligação ou modelo.

> **Notas do plano:**
> - **O que é desta issue:** montar e salvar. O quadro do protótipo aprovado (376) já tem quase todos os gestos (mover, ligar, "+", organizar, zoom, mapa, notas, desfazer/refazer, painel de cada tipo). Aqui ele passa a ler e gravar no servidor, com opções reais nos gatilhos e o problema apontado pelo servidor. Publicar, pausar e rodar ficam para a 386. Testar e editar ativo com segurança ficam para a 387. Números nos cartões e quem está dentro ficam para a 388. Até lá, o quadro mostra só o rascunho, sem números e sem botão de publicar.
> - **Contagem dos últimos 30 dias no gatilho:** a spec a coloca junto da execução (386), porque usa a mesma leitura dos acontecimentos. Nesta issue, a estimativa falsa do protótipo sai do painel.
> - **Copiar e colar:** o protótipo não tinha. Entra seleção de vários cartões (Shift + clique), Ctrl+C e Ctrl+V (e botões "Copiar" e "Colar" na barra). A cópia fica na memória da página, então dá para abrir outro fluxo e colar lá. O cartão de início não é copiado.
> - **Novos tipos de cartão depois:** o servidor tem um catálogo de tipos (saídas e validação de cada um). Um tipo novo entra no catálogo e no desenho do cartão, sem mexer no resto.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Quadro:** `public/dash/email-fluxos.js` (protótipo 376): gestos com Pointer Events, `mudar()` com desfazer/refazer, `problemas()`, `organizar()`, mapa, painel lateral por tipo, `saidasDe()`, catálogo `TIPOS`, `EVENTOS` e `FILTRO_ROTULO`.
- **Modelos:** criar sem sair do fluxo usa `POST /api/email/modelos { acao: 'salvar', modelo: { nome, canal: 'marketing' } }` (378). Trava de uso: `consultasDeUso` em `functions/api/_email-modelos.js`.
- **Segmentos:** lista e trava (`consultasDeUso`) em `functions/api/_email-segmentos.js` (381).
- **Opções reais dos filtros:**
  - funis: `email_contatos_entradas` (380);
  - páginas: `FUNIL_POR_PAGINA` de `functions/api/_funil-paginas.js`;
  - canal: `CANAIS` de `functions/api/_canal.js`;
  - UTMs (origem, campanha, anúncio): valores distintos de `sessions` dos últimos 90 dias, até 50 de cada;
  - formulário de aplicação: funis de aplicação do tracking;
  - material: `MATERIAIS` de `src/data/materiais.js`;
  - produto e situação da compra: `greenn_webhook_event` (produto e nome no `raw_json`);
  - tipo de reunião: `agenda_tipos`;
  - grupo: `whatsapp_groups_tracked` com o nome de `whatsapp_groups_catalogo`;
  - estágio: `crm_status_log`;
  - evento do site: os eventos internos medidos (`ctaclick`, `formstep`, `formstart`, `storyopen`);
  - segmento: `email_segmentos`;
  - campanha: `campanhasEnviadas()` (382).
  
  Cada fonte é lida à parte; se uma falhar, só ela fica vazia.
- **Endpoint e testes:** padrão de `functions/api/email/segmentos.js` e `tests/email-segmentos.test.js`.

### Pesquisa externa

- Nenhuma.

## Cenários

### Happy Path

1. A usuária abre Marketing › E-mail › Fluxos: lista com nome, gatilhos e situação (por enquanto, rascunho). "Novo fluxo" cria no servidor e abre o quadro com o cartão de início e o painel aberto.
2. No início, adiciona o gatilho "Preencheu formulário" com filtro "funil: workshop". As opções vêm do servidor.
3. Pelo "+" na saída, adiciona "E-mail" e escolhe o modelo (só marketing, não arquivado). Ou cria um modelo novo ali mesmo (nome e assunto), que já fica escolhido. O texto completo se escreve depois em Modelos.
4. Adiciona espera (por um tempo, até dia e hora, ou até algo acontecer com prazo, com ou sem janela), desvio (condições com "e" ou "ou"), outro e-mail, objetivo e fim.
5. Cada mudança é salva sozinha (até 1 segundo depois de parar de mexer) e a barra mostra "Rascunho salvo às 10:42". O servidor responde com os problemas, e o quadro marca os cartões com problema.
6. Fecha e reabre: está tudo como deixou (posição, ligações, notas, nome).
7. Na lista: duplicar fluxo (vira rascunho "Cópia de …") e arquivar (sai da lista; filtro "Arquivados" mostra e permite tirar do arquivo).

### Edge Cases

- **Problemas que impedem publicar** (calculados no servidor, marcados no cartão e listados no topo com link para o cartão): fluxo sem gatilho, cartão solto (nada leva até ele, exceto objetivo), saída sem destino, desvio sem condição, e-mail sem modelo ou com modelo arquivado ou incompleto (sem assunto ou corpo), espera "até algo acontecer" sem o e-mail de referência, objetivo sem condição, ir para outro fluxo sem destino ou com destino arquivado.
- **Excluir cartão:** as ligações somem e os cartões seguintes ficam soltos (apontados).
- **Copiar e colar:** os cartões colados ganham ids novos e mantêm as ligações entre eles; as ligações para fora do grupo não vêm junto. Colado num fluxo diferente, o e-mail de referência de uma espera ou condição que não veio junto fica vazio (e é apontado).
- **Duas abas mexendo no mesmo fluxo:** cada salvamento leva a versão; se a outra aba salvou antes, o servidor recusa ("Este fluxo foi mudado em outra aba. Recarregue para continuar.") e nada se perde em silêncio.
- **Quadro grande demais** (mais de 200 cartões ou 200 KB): recusado com a mensagem.
- **Desfazer depois de salvar:** volta o estado e salva de novo.
- **Modelo ou segmento usado em fluxo** (não arquivado): arquivar o modelo e excluir o segmento são recusados ("Este modelo está em uso em: fluxo "Boas-vindas"").
- **Ir para outro fluxo:** a lista de destinos não mostra o próprio fluxo nem os arquivados.
- **Fluxo arquivado:** não aparece como destino; pode voltar do arquivo.

### Cenário de Erro

- **Falha ao salvar** (rede ou servidor): a barra mostra "Não foi possível salvar. Tentando de novo…" e tenta outra vez na mudança seguinte ou em 10 segundos; as mudanças continuam na tela.
- **Estrutura inválida** (tipo desconhecido, ligação para cartão que não existe, dois cartões de início): 400 com a mensagem; nada gravado.
- **Fluxo inexistente:** 404 "Fluxo não encontrado."

## Banco de Dados

Migration `migrations/0057_email_fluxos.sql` (só adição):

- Tabela: `email_fluxos`
  - `id` (INTEGER, PK)
  - `nome` (TEXT)
  - `situacao` (TEXT) — `rascunho` (a 386 acrescenta `ativo` e `pausado`)
  - `arquivado` (INTEGER, 0/1)
  - `rascunho_json` (TEXT) — o quadro em edição: `{ nos, arestas, notas }`
  - `versao` (INTEGER) — sobe a cada salvamento (conflito entre abas)
  - `publicado_json` (TEXT) — versão no ar (vazio até a 386)
  - `criado_em`, `atualizado_em` (INTEGER)
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0057_email_fluxos.sql`.

## Arquivos

- **Criar:** `migrations/0057_email_fluxos.sql` — tabela `email_fluxos`.
- **Criar:** `functions/api/_email-fluxos.js` — catálogo de tipos de cartão (saídas e validação de cada um, para tipos novos entrarem depois) e de acontecimentos e filtros dos gatilhos; `normalizarGrafo` (estrutura, tamanhos, ids); `problemas(env, grafo, fluxoId)`; criar, salvar com versão, duplicar, arquivar e tirar do arquivo; `opcoes(env)` (valores reais dos filtros); `modeloEmFluxos` e `segmentoEmFluxos` (travas).
- **Criar:** `functions/api/email/fluxos.js` — `GET` (lista, com filtro de arquivados), `GET ?id=` (fluxo com problemas e opções) e `POST { acao: 'criar' | 'salvar' | 'duplicar' | 'arquivar' | 'desarquivar' }`, protegido por `DASH_KEY`.
- **Modificar:** `functions/api/_email-modelos.js` — `consultasDeUso` ganha `modeloEmFluxos`.
- **Modificar:** `functions/api/_email-segmentos.js` — `consultasDeUso` ganha `segmentoEmFluxos`.
- **Modificar:** `public/dash/email-fluxos.js` — lista e quadro ligados ao backend:
  - salvamento sozinho com versão e problemas vindos do servidor;
  - opções reais nos filtros;
  - criar modelo sem sair pela API de modelos;
  - seleção múltipla, copiar e colar entre fluxos;
  - duplicar e arquivar fluxo, filtro de arquivados.
  
  Sem selo de protótipo, sem os fluxos de exemplo, sem números falsos, sem estimativa falsa e sem os botões de publicar, testar e pessoas (386–388).
- **Modificar:** `public/dash/email-mkt.js` — `VISTAS_REAIS` ganha `fluxos`.
- **Criar:** `tests/email-fluxos.test.js` — criar, salvar e reabrir igual, versão em conflito, estrutura inválida, cada problema, modelo incompleto e arquivado, ir para fluxo arquivado, duplicar, arquivar e tirar do arquivo, travas de modelo e segmento, opções (com fonte faltando).

> Não toca: publicar e rodar (386), teste e edição de ativo (387), números (388), `functions/tracker.js`, GHL.

## Dependências Externas

- Nenhuma. O quadro continua em JS puro.

## Checklist

- [x] Migration `0057_email_fluxos.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] `_email-fluxos.js` com catálogo, estrutura, problemas, salvar com versão, duplicar, arquivar, opções e travas
- [x] `GET/POST /api/email/fluxos`
- [x] Travas de modelo e segmento usados em fluxo
- [x] Quadro ligado ao backend com salvamento sozinho e problemas do servidor
- [x] Opções reais nos filtros dos gatilhos e condições
- [x] Criar modelo sem sair do fluxo
- [x] Seleção múltipla, copiar e colar (inclusive para outro fluxo)
- [x] Testes `email-fluxos` passando (`npm test`)
- [ ] Usuária monta do zero um fluxo com gatilho filtrado, dois e-mails, espera, desvio e objetivo, fecha e reabre e está tudo salvo; o quadro aponta onde está o problema quando falta ligação ou modelo

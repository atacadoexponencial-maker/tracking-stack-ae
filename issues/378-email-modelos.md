# 378: Modelos de e-mail

**Tipo:** Implementação
**Página:** Dash › E-mail › Modelos (spec `spec-email-proprio.md`, módulo 2)

## Descrição

Biblioteca de modelos por canal com layout comum: criar, editar assunto/pré-visualização/corpo, inserir campos, pré-visualizar (computador e celular), mandar teste, duplicar e arquivar, com aviso de campo desconhecido e trava para não arquivar modelo em uso.

## Pronto quando

A usuária cria um modelo com {{nome}}, vê a pré-visualização nos dois tamanhos, recebe o teste com o nome preenchido, duplica, e não consegue arquivar um modelo que esteja em uso.

> Nota do plano: nesta issue ainda nada usa modelos (agenda, campanhas e fluxos vêm na 379, 382/383 e 385/386). A trava de "em uso" é construída aqui e coberta por teste automático; na tela ela passa a aparecer quando a 379 ligar o primeiro modelo a um e-mail da agenda.

## Plano (03/10/2026)

### Pesquisa interna (o que reaproveitar)

- **Endpoint do dash:** mesmo padrão da 377 (`functions/api/email/config.js`): `autorizado` com `DASH_KEY`, `GET` lista e `POST { acao }`.
- **Envio:** `enviar()` de `functions/api/_postmark.js` (377), com `Tag: 'teste-modelo'` e `Metadata: { origem: 'teste', envio_id }`. Registro em `email_envios` igual ao teste da 377 (a linha nasce, ganha o `MessageID`, e os resultados chegam pelo webhook que já existe).
- **Remetente, resposta e rodapé:** `lerConfig()` de `functions/api/_email-config.js`.
- **Protótipo aprovado:** `public/dash/email-mkt.js`, vista `modelos` e `editorModelo`: lista por canal, filtro de arquivados, editor com assunto, pré-visualização, corpo, botões de formatação (negrito, link, botão), chips de campos, pré-visualização computador/celular, aviso de campo desconhecido. A formatação do corpo já combinada no protótipo: `**negrito**`, `[texto](link)` e `[[Texto do botão | link]]`, parágrafos separados por linha em branco.
- **Lista de campos e dados de exemplo:** hoje em `CAMPOS` dentro do `email-mkt.js` (front). Passa para o backend, que é quem valida e preenche.
- **Testes:** padrão de `tests/email-config.test.js` (SQLite real e Postmark simulado).
- **Logo:** `src/assets/brand/logo-horizontal-preto.png` (versão escura, para fundo claro de e-mail).

### Pesquisa externa (Postmark)

- `POST /email` não preenche campos sozinho (só `/email/withTemplate` e a Bulk API fazem). Para o e-mail de teste e os transacionais, o próprio backend preenche os campos antes de enviar. Na Bulk API (campanhas, 382) o Postmark preenche por destinatário, então o HTML montado aqui mantém os `{{campos}}` intactos quando pedido.
- No stream de marketing (`broadcast`), o Postmark aceita o marcador `{{{ pm:unsubscribe }}}` para o link de descadastro de um clique. O layout de marketing usa esse marcador no rodapé; se ele faltar, o Postmark acrescenta o link por conta própria.

## Cenários

### Happy Path

1. A usuária abre Marketing › E-mail › Modelos. O dash busca `GET /api/email/modelos` e mostra os modelos por canal (lista vazia na primeira vez, com chamada para criar o primeiro).
2. Clica em "Novo modelo", escolhe o canal e dá um nome. O backend cria em rascunho e abre o editor.
3. Escreve assunto, pré-visualização e corpo e clica num chip de campo para inserir `{{primeiro_nome}}`.
4. A pré-visualização (computador e celular) vem do backend (`POST { acao: 'previa' }`): o HTML final com cabeçalho, logo, corpo formatado, rodapé da configuração e, no marketing, o link de descadastro, com os campos preenchidos pelos dados de exemplo.
5. Salva. O backend valida (nome, assunto e corpo obrigatórios, campos conhecidos no canal) e grava.
6. Clica em "Mandar teste", informa o e-mail e recebe o modelo com os campos preenchidos pelos dados de exemplo, saindo pelo remetente do canal.
7. Duplica o modelo: nasce "Cópia de ..." com o mesmo conteúdo.
8. Arquiva um modelo sem uso: some da lista principal e aparece no filtro "Arquivados", de onde pode voltar.

### Edge Cases

- **Campo desconhecido** (`{{nmoe}}`): a pré-visualização marca o campo; salvar é recusado com a mensagem do servidor citando o campo e sugerindo o mais parecido ("Você quis dizer {{nome}}?").
- **Campo de outro canal** (`{{link_reuniao}}` num modelo de marketing): tratado como desconhecido naquele canal.
- **Espaços dentro das chaves** (`{{ nome }}`): aceito, igual a `{{nome}}`.
- **Trocar o canal** de um modelo que já tem texto: permitido só enquanto não está em uso; campos que não existem no canal novo passam a ser apontados.
- **Modelo em uso:** arquivar e trocar o canal são recusados com "Este modelo está em uso em: ..." (a lista vem das issues seguintes; aqui a regra existe e é testada).
- **Nome repetido no mesmo canal:** recusado ("Já existe um modelo com esse nome").
- **Corpo com HTML digitado** (`<script>`): tratado como texto; tudo é escapado antes da formatação.
- **Link sem `https://`** em `[texto](link)` ou no botão: recusado ao salvar, com o trecho apontado (exceção: o link pode ser um campo, como `{{link_reuniao}}`).
- **Rodapé vazio na configuração:** a pré-visualização mostra o aviso "Rodapé vazio: preencha em Configuração" (não impede salvar nem testar).
- **Duplo clique em salvar ou testar:** botão trava enquanto a chamada corre.

### Cenário de Erro

- **Teste recusado pelo Postmark** (`ErrorCode` diferente de 0): toast com o motivo traduzido; o envio fica como "falhou".
- **Postmark sem resposta:** "Não foi possível falar com o serviço de envio agora. Tente de novo."; nada gravado como enviado.
- **Marketing desligado na configuração:** teste de modelo de marketing recusado com a mesma regra da 377.
- **Modelo apagado ou inexistente** (id inválido): 404 com "Modelo não encontrado".
- **Falha no banco:** mensagem genérica de erro e nada pela metade (cada ação é uma escrita só).

## Banco de Dados

Migration `migrations/0051_email_modelos.sql`:

- Tabela: `email_modelos`
  - `id` (INTEGER, PK)
  - `nome` (TEXT) — nome interno
  - `canal` (TEXT) — `transacional` | `marketing`
  - `assunto` (TEXT)
  - `previa` (TEXT) — texto de pré-visualização da caixa de entrada
  - `corpo` (TEXT) — texto formatado (`**`, `[..](..)`, `[[.. | ..]]`)
  - `arquivado` (INTEGER, 0/1)
  - `criado_em`, `atualizado_em` (INTEGER) — epoch
  - Índice único: `(canal, nome)`
- Sem sementes: a biblioteca começa vazia (os modelos da agenda nascem na 379).
- Aplicação no remoto com `wrangler d1 execute tracking-ae-db --remote --file migrations/0051_email_modelos.sql`.

## Arquivos

- **Criar:** `migrations/0051_email_modelos.sql` — tabela `email_modelos`.
- **Criar:** `functions/api/_email-campos.js` — campos por canal com rótulo e valor de exemplo (transacional: `nome`, `primeiro_nome`, `email`, `tipo_reuniao`, `data_reuniao`, `hora_reuniao`, `link_reuniao`, `link_remarcar`; marketing: `nome`, `primeiro_nome`, `email`, `funil`), achar campos desconhecidos e sugerir o mais parecido.
- **Criar:** `functions/api/_email-render.js` — monta o e-mail final: escapa o texto, aplica a formatação do corpo, envolve no layout comum (logo, corpo, rodapé da configuração e, no marketing, `{{{ pm:unsubscribe }}}`), gera também a versão em texto puro, e preenche os campos com valores dados (ou mantém os marcadores, para a Bulk API). Usado pela prévia, pelo teste e, depois, por agenda, campanhas e fluxos.
- **Criar:** `functions/api/_email-modelos.js` — regras do modelo: validar, salvar, duplicar, arquivar e desarquivar, e `usosDoModelo(env, id)` (lista vazia por enquanto; 379, 383 e 385 acrescentam as próprias consultas).
- **Criar:** `functions/api/email/modelos.js` — `GET` (modelos, campos por canal) e `POST { acao: 'salvar' | 'previa' | 'enviar_teste' | 'duplicar' | 'arquivar' | 'desarquivar' }`, protegido por `DASH_KEY`.
- **Criar:** `public/email/logo.png` — cópia de `src/assets/brand/logo-horizontal-preto.png`, servida em endereço público para aparecer no e-mail.
- **Modificar:** `functions/api/email/config.js` — o e-mail de teste da 377 passa a usar `_email-render.js` (mesmo layout dos modelos), em vez do HTML próprio.
- **Modificar:** `public/dash/email-mkt.js` — vista `modelos` e `editorModelo` ligadas ao backend (lista, filtro, editor, chips de campos vindos do servidor, prévia vinda do servidor, salvar, teste, duplicar, arquivar), sem selo de protótipo nelas; `CAMPOS` e `MODELOS_BASE` do front deixam de alimentar esta vista (continuam só onde outras vistas ainda são protótipo).
- **Criar:** `tests/email-render.test.js` — formatação, escape, layout por canal, texto puro, campos preenchidos e mantidos.
- **Criar:** `tests/email-modelos.test.js` — fluxo contra SQLite real e Postmark simulado: criar, campo desconhecido com sugestão, link sem https, nome repetido, duplicar, arquivar e desarquivar, trava de uso (com `usosDoModelo` simulado), teste enviado e recusado.

> Não toca: `functions/tracker.js`, `functions/api/sync/ghl-email.js`, a aba `email` do GHL e `public/dash/agenda.js`.

## Dependências Externas

- Nenhuma nova. Postmark pelo `_postmark.js` da 377.

## Checklist

- [x] Migration `0051_email_modelos.sql` aplicada no D1 remoto com `d1 execute --file`
- [x] `_email-campos.js` com campos por canal, exemplos e sugestão do mais parecido
- [x] `_email-render.js` com formatação, escape, layout, texto puro e preenchimento
- [x] `_email-modelos.js` com validação, duplicar, arquivar/desarquivar e `usosDoModelo`
- [x] `GET/POST /api/email/modelos`
- [x] Logo público em `public/email/logo.png`
- [x] Teste da Configuração usando o mesmo layout
- [x] Vista Modelos do dash ligada ao backend
- [x] Testes `email-render` e `email-modelos` passando (`npm test`)
- [ ] Usuária cria um modelo com `{{nome}}`, vê a prévia nos dois tamanhos, recebe o teste preenchido e duplica, na prévia

# 392: Biblioteca de imagens com endereço público permanente

**Tipo:** Implementação
**Página:** Marketing › E-mail › Imagens (spec `spec-editor-email.md`, módulo 4)

## Descrição

Guardar as imagens de e-mail num armazenamento público e permanente e entregar a biblioteca: subir (botão, arrastar, várias de uma vez), recusar formato fora de JPG, PNG, GIF ou WebP e peso acima de 1 MB, avisar largura acima de 1200 px, renomear, buscar, mostrar onde é usada e apagar só imagem sem uso (com o aviso de que e-mails já enviados continuam mostrando).

## Pronto quando

Ela sobe uma imagem pela biblioteca, a imagem aparece na grade com um endereço público que abre no navegador sem a chave do dash, e as recusas e a trava de apagar funcionam.

## Cenários

### Happy Path
1. Ela abre Marketing › E-mail › **Imagens** (item novo na barra), arrasta 3 imagens ou usa "Subir imagens".
2. Cada arquivo sobe numa chamada própria; a fila mostra a barra e a imagem entra na grade com miniatura, nome, tamanho em px, peso e data.
3. O servidor confere o tipo pelos **bytes** (assinatura PNG, JPEG, GIF, WebP), não pelo nome; lê largura e altura do cabeçalho do arquivo; guarda os bytes no KV `EMAIL_IMAGENS` e a ficha no D1.
4. A imagem ganha o endereço público permanente `https://<domínio>/email/i/<chave>.<ext>`, que abre sem a chave do dash e tem cache longo (o conteúdo de uma chave nunca muda).
5. Clicar na imagem abre o painel: renomear, copiar o endereço, ver onde é usada e apagar.

### Edge Cases
- Arquivo de outro tipo (PDF, SVG, HEIC) ou com extensão de imagem mas bytes de outra coisa: recusado (415) com "Formato não aceito. Use JPG, PNG, GIF ou WebP."
- Acima de 1 MB: recusado (413) com o peso e a dica de exportar menor.
- Largura acima de 1200 px: aceita, com aviso na fila e selo no painel.
- GIF animado: aceito como imagem comum.
- Imagem em uso (o endereço ou a chave aparece num modelo, no cabeçalho padrão ou numa campanha não enviada): apagar é recusado (409) com a lista de onde está.
- Apagar imagem livre: a ficha ganha `apagada_em` e sai da lista; **os bytes ficam** no KV e o endereço continua respondendo, porque e-mails já enviados apontam para ele.
- Nome vazio ao renomear: mantém o anterior.
- Busca sem resultado: "Nenhuma imagem com ... no nome."

### Cenário de Erro
- KV sem binding (ambiente sem `EMAIL_IMAGENS`): upload responde 503 "Armazenamento de imagens indisponível neste ambiente" e nada é gravado no D1.
- Falha no meio (bytes gravados, ficha não): o arquivo fica órfão no KV, sem aparecer; a tela mostra o erro e dá para subir de novo.
- Endereço de chave inexistente: 404 texto simples.

## Banco de Dados

- Tabela: `email_imagens` (migration `0060_email_imagens.sql`)
  - `id` (INTEGER PK)
  - `chave` (TEXT UNIQUE) — 32 hex aleatórios; chave no KV e parte do endereço
  - `nome` (TEXT) — nome para achar na biblioteca (sem extensão)
  - `extensao` (TEXT) — png, jpg, gif ou webp
  - `mimetype` (TEXT)
  - `largura`, `altura` (INTEGER) — lidos dos bytes
  - `tamanho` (INTEGER) — bytes
  - `criada_em` (INTEGER), `apagada_em` (INTEGER NULL)

## Arquivos

- **Criar:** `migrations/0060_email_imagens.sql` — tabela acima.
- **Criar:** `functions/api/_email-imagens.js` — regras: identificar tipo e medidas pelos bytes, limites (1 MB, aviso acima de 1200 px), guardar (KV + D1), listar com usos, renomear, apagar com trava; `consultasDeUsoImagem` (registro, como o dos modelos) e `urlImagem(origem, ficha)`.
- **Criar:** `functions/api/email/imagens.js` — GET lista (com busca) · POST multipart `arquivo` (sobe uma) · POST JSON `{ acao: 'renomear' | 'apagar', id }`.
- **Criar:** `functions/email/i/[arquivo].js` — rota pública que serve os bytes (Content-Type da ficha, `Cache-Control: public, max-age=31536000, immutable`, cache da borda).
- **Criar:** `tests/email-imagens.test.js` — tipos pelos bytes, medidas, limites, uso trava apagar, apagada continua servindo.
- **Modificar:** `public/dash/email-blocos.js` — a biblioteca do protótipo 390 passa a falar com a API (lista, subir com fila, renomear, apagar); o protótipo do editor segue com a biblioteca de exemplo até a 394/395.
- **Modificar:** `public/dash/email-mkt.js` — vista `imagens` (VISTAS, títulos, seletor do celular) chamando `EmailBlocos.biblioteca`; tira o botão de protótipo da biblioteca em Modelos.
- **Modificar:** `public/dash/index.html` — item "Imagens" na barra do E-mail.
- **Infra (fora do repositório):** criar o KV `EMAIL_IMAGENS` e ligar o binding na prévia e em produção pela API do Pages (mesmo procedimento do `MIDIA`, fotografando a configuração antes).

## Dependências Externas

- Cloudflare KV (binding `EMAIL_IMAGENS`) — bytes das imagens. R2 não está habilitado na conta (erro 10042); `_email-imagens.js` é a única porta, então migrar depois é trocar um arquivo.

## Checklist

- [x] Migration 0060 escrita e aplicada no remoto (`d1 execute --file`)
- [x] `_email-imagens.js` com tipos e medidas pelos bytes, limites e trava de uso
- [x] Rotas `/api/email/imagens` e `/email/i/<arquivo>`
- [x] Testes passando (`npm test`)
- [x] KV criado e binding na prévia e em produção
- [x] Vista Imagens no dash ligada à API
- [x] Conferido na prévia: subir, recusas, renomear, endereço abre sem chave, apagar com trava

## Execução (04/10/2026)

- KV `EMAIL_IMAGENS` (id 82d902dd4e3d4640b05dee10108ea196) criado e ligado na prévia e em produção pela API do Pages (configuração fotografada antes e depois: D1 e variáveis iguais; `MIDIA` mantido).
- Migration 0060 aplicada no remoto.
- Testado na prévia: logo da casa subida (939 × 253 px, 41 KB), endereço público abre sem chave com `Cache-Control: public, max-age=31536000, immutable` e `CF-Cache-Status: HIT`; arquivo falso com nome .png recusado (415). A logo ficou na biblioteca, pronta para o cabeçalho.
- Imagem enviada pela prévia tem endereço no domínio da prévia; depois do merge, as novas ficam no domínio de produção (o endereço segue o domínio de quem sobe). Os bytes são os mesmos nos dois (KV único).

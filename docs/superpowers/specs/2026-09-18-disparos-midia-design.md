# Aba Disparos — mídia agendada e calendário da semana

**Data:** 2026-09-18
**Status:** desenho aprovado, pronto para plano de implementação
**Continua:** `docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md` (Fase 1, no ar desde 17/09)

## Problema

A Fase 1 entregou a agenda de ações, mas com dois defeitos que a usuária apontou
no dia seguinte:

1. **Mora no lugar errado.** Os blocos foram enxertados na aba Grupos, que é uma
   aba de medição. Compor um disparo no meio de gráfico e tabela de eventos
   espreme as duas coisas.
2. **Só manda texto.** A operação real da live manda vídeo, imagem e áudio — o
   texto puro é a minoria.

E faltava enxergar a semana: com os disparos só em lista, não dá para ver que
sobrou tudo na quarta e não sobrou nada na sexta.

## Objetivo

Uma aba própria, **Disparos**, onde se compõe o disparo vendo o que vai sair,
se enxerga a semana inteira em calendário, e se agenda **texto, imagem, vídeo,
áudio ou documento**.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Lugar | Aba própria `Disparos`, grupo "Operação" | Compor não é medir. A aba Grupos volta a ser só medição |
| Onde o arquivo mora | **KV** da Cloudflare (`MIDIA`) | Agendar cria um buraco no tempo: o arquivo precisa persistir até a hora do envio, alcançável pela Evolution. O R2 é a ferramenta certa mas **não está habilitado na conta**; o KV já está, e o teto de 25 MB por valor cobre todos os limites do WhatsApp |
| Como a Evolution recebe | **URL pública** com chave aleatória | Bug aberto #1885: vídeo em base64 derruba a Evolution com `Maximum call stack size exceeded`. base64 está fora para vídeo, e misturar caminhos por tipo seria pior |
| Prévia | Conteúdo fiel, **sem** a paleta do WhatsApp | Balão verde violaria "Noite Sempre" e "Cor Com Motivo" do DESIGN.md. O que importa é ver a mídia, a legenda e o tamanho do texto |
| Calendário | Semana em **7 colunas** (um dia por coluna) | Grade hora × dia fica quase toda vazia com 2 a 5 disparos por semana. Coluna por dia mostra o mesmo (concentração e buraco) e lê melhor |
| Multi-número | **Fora** | Decisão da usuária em 18/09: um número só. A instância segue vindo de `EVOLUTION_INSTANCE` |
| Tipos | texto, imagem, vídeo, áudio, documento | Sticker e vídeo-redondo (`sendPtv`) ficam fora: não aparecem na operação |

## Descobertas da pesquisa que viraram regra

Fonte: `evolution-foundation/evolution-api`, lido no código, porque a doc oficial
está com 404 nas páginas de mídia.

- **Grupo recebe mídia como recebe texto**: `number` aceita o JID `@g.us`. Não há
  caminho separado.
- 🚨 **`fileName` sobrescreve o `mimetype`.** O service faz
  `mimeTypes.lookup(fileName)`, e extensão desconhecida devolve `false` — que
  vira a **string `"false"`** e entrega o arquivo corrompido. Regra: sempre
  mandar `fileName` com extensão correta, e **nunca** mandar `mimetype` junto.
- 🚨 **`404 Group not found` com o grupo existindo.** Quando o cache de metadados
  da Evolution está frio, o envio para grupo falha. Regra: o executor consulta
  `findGroupInfos` antes de enviar (aquecimento).
- **Nota de voz é sempre PTT e não aceita legenda.** `sendWhatsAppAudio` não tem
  campo `caption`. Texto junto de áudio = uma segunda mensagem.
- **A Evolution converte áudio sozinha** (ffmpeg → ogg/opus). mp3 e m4a entram
  normalmente; `encoding` fica no default.
- **`delay` bloqueia a requisição HTTP** enquanto "digita". Fica em 0: quem
  controla horário é o cron.
- A URL de áudio recebe `?timestamp=` da própria Evolution — a rota que serve o
  arquivo precisa ignorar query desconhecida.

## Arquitetura

```
Painel (aba Disparos)
   │
   ├─ POST /api/grupos-midia ──▶ _midia.js ──▶ KV (bytes)
   │                                  └─────▶ D1 whatsapp_group_media (ficha)
   │
   └─ POST /api/grupos-acoes ─────────▶ D1 whatsapp_group_actions
                                             ▲
cron VPS (5/5 min) ─ POST /api/sync/grupo-acoes
                          │
                          ▼
                 _grupos-acoes.js (executor)
                          │
                          ▼
                _evolution-grupos.js ──▶ Evolution
                                             │
                    GET /m/<chave>  ◀────────┘  (a Evolution baixa o arquivo)
                          │
                          ▼
                      _midia.js ──▶ KV
```

`_midia.js` é a **única** porta para o armazenamento, pela mesma razão que
`_evolution-grupos.js` é a única porta para a Evolution: migrar KV → R2 um dia
deve ser trocar um arquivo, não a feature.

### Arquivos

| Arquivo | Papel |
|---|---|
| `functions/api/_midia.js` | Única porta para o KV: guardar, ler, apagar, montar URL |
| `functions/api/grupos-midia.js` | `POST` upload (multipart), autenticado por `DASH_KEY` |
| `functions/m/[chave].js` | `GET` público que serve o arquivo para a Evolution baixar |
| `functions/api/_evolution-grupos.js` | ganha `aquecerGrupo`, `enviarMidia`, `enviarAudio` |
| `functions/api/_grupos-acoes.js` | tipos novos, aquecimento, áudio+texto, expurgo |
| `public/dash/index.html` | aba Disparos; os blocos saem da aba Grupos |

### Tabela `whatsapp_group_media` (migration 0044)

| Coluna | Observação |
|---|---|
| `id` | INTEGER PK |
| `chave` | 32 hex aleatórios. É a URL e é a chave no KV |
| `nome` | nome original, **com extensão** — é o `fileName` mandado à Evolution |
| `mimetype` | guardado para servir o arquivo com o `Content-Type` certo |
| `mediatype` | `image` \| `video` \| `audio` \| `document` |
| `tamanho` | bytes |
| `criada_em` / `apagada_em` | `apagada_em` marca o expurgo |

`whatsapp_group_actions` não muda de forma: `tipo` ganha os valores novos e
`payload` passa a carregar `{ midia_id, caption }`.

### Tipos de ação

| `tipo` | payload | como vai |
|---|---|---|
| `mensagem` | `{texto}` | `sendText` |
| `imagem` | `{midia_id, caption}` | `sendMedia` `mediatype:image` |
| `video` | `{midia_id, caption}` | `sendMedia` `mediatype:video` |
| `documento` | `{midia_id, caption}` | `sendMedia` `mediatype:document` |
| `audio` | `{midia_id, texto}` | `sendWhatsAppAudio` **e depois** `sendText`, se houver texto |
| `renomear` | `{titulo, aplicar_no_par}` | `updateGroupSubject` |

### Limites (validados no backend)

| Tipo | Teto | Motivo |
|---|---|---|
| imagem | 5 MB | limite prático do WhatsApp |
| vídeo | 16 MB | limite prático do WhatsApp |
| áudio | 16 MB | limite prático do WhatsApp |
| documento | 20 MB | abaixo do teto de 25 MB do KV |

Extensão e mimetype conferidos contra uma lista fechada. Arquivo sem extensão
reconhecida é recusado **no upload**, não na hora do envio — descobrir isso às
12h da live é tarde demais.

## Regras de execução novas

As quatro regras da Fase 1 continuam valendo sem alteração (trava de corrida,
janela de 30 min, mensagem nunca retenta, falha grita). Somam-se:

5. **Aquecimento antes do envio.** Toda ação de grupo consulta `findGroupInfos`
   antes de agir. Falha de aquecimento **não** aborta o envio — só o `404 Group
   not found` do envio importa, e o aquecimento é uma tentativa de evitá-lo.
6. **Áudio com texto são duas mensagens.** O áudio vai primeiro. Se o áudio
   falha, o texto **não** é enviado (texto solto sem o áudio confunde). Se o
   áudio vai e o texto falha, a ação fica `falhou` com o motivo, mas o áudio
   já saiu — o histórico diz isso em letras claras.
7. **Expurgo de arquivo.** Mídia de ação concluída, falhada ou cancelada há mais
   de 30 dias é apagada do KV pelo mesmo cron, e a ficha marca `apagada_em`. O
   histórico permanece; só o arquivo some.
8. **Mídia nunca vira base64.** Sempre URL. Não há caminho alternativo.

## Painel — aba Disparos

Fundo carvão, cards grafite, contorno cinza quente, tudo do DESIGN.md.

**1. Compor** — card com duas colunas.

*Esquerda:* grupo, tipo (cinco pílulas), arquivo (arrastar ou escolher), legenda
ou texto, data e hora. Botões **Agendar** (primário, branco) e **Fazer agora**
(secundário, com confirmação inline).

*Direita:* a prévia. A mídia aparece **antes de subir**, lida do computador, para
o erro de arquivo trocado ser visto na hora. Abaixo, o texto como legenda e a
hora marcada em cinza. Sem paleta do WhatsApp: é grafite alto com cantos de
0.75rem, a linguagem do painel.

Quando o tipo é `audio` e há texto, a prévia mostra **dois** blocos empilhados,
porque é isso que vai chegar: a nota de voz e, depois, a mensagem.

**2. Semana** — sete colunas, uma por dia, com os disparos de cada dia em ordem
de hora. Cabeçalho com dia da semana e número; hoje com o ponto bege do sistema
de navegação. Setas para a semana anterior e a próxima. Clicar num dia vazio
preenche a data no form acima; clicar num disparo abre o cancelar.

**3. Já foram** — histórico, como hoje: verde para feita, coral só para falha,
com o motivo ao lado.

Estados vazios em cinza texto, dizendo o que fazer, nunca só "sem dados".

## Erros e como aparecem

Some-se aos da Fase 1:

| Situação | O que acontece |
|---|---|
| Arquivo maior que o teto | recusado no upload, com o tamanho e o teto na mensagem |
| Extensão não reconhecida | recusado no upload |
| Mídia apagada pelo expurgo, ação reagendada | recusado ao agendar: a ficha existe mas `apagada_em` está preenchida |
| `404 Group not found` mesmo após aquecer | `falhou` com o motivo cru da Evolution |
| Áudio foi, texto não | `falhou`, e o motivo diz que o áudio já saiu |

## Testes

Com `node:sqlite` real e KV dublado por um Map:

- upload recusa tamanho acima do teto, por tipo
- upload recusa extensão desconhecida e extensão que não bate com o tipo
- a rota pública devolve o `Content-Type` guardado e 404 para chave inexistente
- a rota pública ignora query desconhecida (o `?timestamp=` da Evolution)
- envio de mídia manda `fileName` **e não manda** `mimetype`
- áudio com texto faz duas chamadas, na ordem; áudio que falha não manda o texto
- aquecimento é chamado antes do envio, e aquecimento que falha não aborta
- agendar com mídia já expurgada é recusado
- expurgo apaga do KV e marca `apagada_em`, e não toca em mídia de ação recente

## Fora de escopo

- Sticker e vídeo-redondo (`sendPtv`)
- Vários números / várias instâncias (decisão de 18/09)
- Editar mídia de ação já agendada (cancela e agenda de novo, como o resto)
- Adicionar/remover participantes — continua sendo a Fase 4 da spec anterior

# Link redirecionador `/links` com agendamento

**Data:** 2026-07-31
**Status:** desenho aprovado, pronto para plano de implementação

## Problema

Os disparos no grupo de WhatsApp precisam de um endereço estável para divulgar.
Hoje, cada disparo carrega o link final direto na mensagem: se o destino muda —
outra LP, outro grupo, carrinho que abre e fecha — todas as mensagens já enviadas
apontam para o lugar errado, e não existe forma de saber quantas pessoas clicaram.

A solução é um link único do próprio domínio, `atacadoexponencial.com/links`, cujo
destino é trocável (inclusive com data e hora marcadas) e cujos cliques são contados.

## Decisões

| Decisão | Escolha |
|---|---|
| Formato | **Um link fixo** (`/links`), sem slugs. Não é um encurtador. |
| Como trocar o destino | **Telinha no `/dash`**, gravando no D1. Sem redeploy, sem painel do Cloudflare. |
| Rastreamento | **Conta cliques**, com data/hora e o destino que estava no ar. |
| Visualização | **Histórico por destino, com rótulo** que a usuária escreve. |
| Agendamento | **Janela com início e fim**, em horário de Brasília. |
| Fora da janela | **Destino padrão** cadastrado uma vez. |

### Por que não precisa de cron

O Cloudflare Pages não tem cron trigger. Mas a rota consulta o D1 a cada clique,
então o agendamento é resolvido na **leitura**: cada destino guarda sua janela e a
rota entrega o que está valendo naquele instante. Nada precisa "virar" a meia-noite,
nada depende da VPS.

### Por que uma tabela de cliques em vez de um contador

Um contador (`UPDATE ... SET cliques = cliques + 1`) responde "quantos", nunca
"quando". Num disparo de grupo, a curva por hora é justamente o sinal útil: saber se
o clique veio nos primeiros minutos ou pingou a semana toda. O volume é baixo
(centenas por disparo), então uma linha por clique não pesa.

### Por que não reusar `event_log`

A `event_log` é sobre leads identificados e alimenta funil, CPL e Conversão por LP.
Gravar clique anônimo ali contaminaria relatório que hoje está correto.

## Componentes

### 1. Rota pública — `functions/links.js`

`GET /links` → `302` com `Cache-Control: no-store`.

Sem cache é obrigatório: com cache, o Cloudflare continuaria servindo o destino
antigo depois da virada da janela, que é exatamente o que a feature existe para evitar.

**Ordem de escolha do destino:**

1. A janela agendada que contém o instante do clique.
   Em sobreposição acidental, vence a que **começou mais tarde** — regra fixa, sem empate ambíguo.
2. Não havendo janela válida, o **destino padrão**.
3. Não havendo nem padrão, `/` — rede de segurança para ninguém ver erro.

**Fuso:** todo horário é interpretado e exibido em **Brasília (-03:00)**, igual ao
resto do projeto (`day_local`). A usuária digita "05/08 19:00" e significa 19h daqui.

**UTMs:** parâmetros presentes na URL do disparo são repassados ao destino final,
para que o tracking da LP que recebe continue funcionando.

**Middleware:** `/links` entra na lista de exclusão de `functions/_middleware.js`.
Sem isso, cada clique que sai direto para o WhatsApp criaria uma sessão e cookies de
tracking, inflando o tráfego do site com visitas que nunca existiram.

### 2. Dados — migration `0030`

Duas tabelas novas. Nenhuma tabela existente é alterada.

**`short_links`** — um destino por linha:
- `id`, `label` (rótulo escrito pela usuária, ex.: "Disparo Live 05/08")
- `target_url`
- `starts_at`, `ends_at` — unix seconds; **ambos nulos = este é o destino padrão**
- `criado_em`, `apagado_em`

**Existe no máximo um destino padrão.** Cadastrar um novo padrão substitui o
anterior (o antigo vira apagado), em vez de criar dois e tornar a escolha ambígua.

**Apagar é marcação, não remoção** (`apagado_em`). O destino some da telinha e deixa
de ser elegível no redirect, mas a linha continua existindo para que os cliques que
ele recebeu ainda mostrem rótulo e URL no histórico.

**`short_link_clicks`** — um registro por clique:
- `id`, `link_id` (qual destino serviu), `occurred_at`, `day_local` (`YYYY-MM-DD` em -03:00)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- `user_agent`, `ip`

Apagar um destino **não** apaga seus cliques — o histórico mentiria.
Por isso o apagar é marcação (`apagado_em`), descrito acima.

### 3. API — `functions/api/links.js`

Mesmo padrão autenticado das demais APIs do dash: `?key=<DASH_KEY>`.

- `GET` → lista de destinos com a contagem de cliques já agregada, e qual está no ar agora.
- `POST` → criar, editar, apagar.

Toda validação vive **no backend**, nunca no formulário. Em especial:

- `target_url` só pode ser `http` ou `https`. Uma rota que redireciona para qualquer
  coisa que chegue é vetor de abuso clássico — `javascript:` ou phishing usando o
  domínio da marca como fachada.
- `ends_at` anterior a `starts_at` é recusado.
- Ou a linha tem as duas datas, ou nenhuma (destino padrão). Nunca só uma.

### 4. Telinha — aba "Links" no `/dash`

**Em cima:** o que está no ar agora — destino atual, o motivo (janela X ou destino
padrão) e um botão de copiar o link. Responde de imediato a "posso disparar?".

**Embaixo:** tabela de destinos — rótulo, URL, janela, situação
(agendado / no ar / encerrado / padrão) e cliques recebidos. Dali se cria, edita e apaga.

Criar é um formulário curto: rótulo, URL, início e fim — ou marcar "é o destino
padrão", que dispensa as datas.

O frontend apenas coleta e exibe; decisão e validação são do backend.

## Erros e casos de borda

- **D1 fora do ar no clique:** cai no destino padrão em vez de mostrar erro. Quem
  clicou nunca vê falha nossa.
- **Gravar o clique nunca pode atrasar ou quebrar o redirect.** Falha ao registrar é
  silenciosa para o visitante.
- **Link antigo circulando no grupo:** cai no destino padrão — clique atrasado não se perde.

## Como validar

1. Aplicar a migration.
2. Cadastrar um destino padrão e um agendado com janela de poucos minutos.
3. Clicar **antes**, **durante** e **depois** da janela → conferir os três destinos corretos.
4. Conferir na aba que os cliques aparecem separados por destino.

## Fora de escopo

- Slugs (`/links/algo`) — decidido: um link só.
- Página de "link expirado" — o destino padrão cobre o caso.
- Cron ou qualquer dependência da VPS.

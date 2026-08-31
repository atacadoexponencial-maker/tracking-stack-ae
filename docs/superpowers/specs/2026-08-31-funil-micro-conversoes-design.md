# Funil de micro-conversões por página

**Data:** 2026-08-31
**Status:** design aprovado, aguardando plano de implementação

## Problema

Hoje o dashboard responde "quantos acessaram esta LP e quantos viraram lead". Entre as duas pontas há um buraco: uma página que converte 7% não diz **onde** perdeu os outros 93%.

O formulário de aplicação (`AplicacaoForm.astro`) tem três etapas. Quem preenche nome e WhatsApp e desiste ao ver "Faturamento mensal" na etapa 2 não deixa rastro nenhum — some junto com quem só passou os olhos pela página e nunca tocou em nada. São duas pessoas muito diferentes, contadas do mesmo jeito.

Sem esse recorte, qualquer mudança na página é palpite: não dá para saber se o problema é o anúncio (ninguém clica), a promessa (clicam e não começam), ou o formulário (começam e abandonam numa pergunta específica).

## Objetivo

Medir, por página, quantas sessões atravessam cada degrau entre a chegada e a conversão — e mostrar isso no lugar onde a pergunta já é feita hoje, a tabela "Conversão por LP".

**Uso exclusivamente interno.** Nenhum evento desta spec vai para Meta, GA4, ClickUp ou GoHighLevel. Um clique em botão não é conversão; mandá-lo ao pixel poluiria a otimização das campanhas e o CRM receberia lead que ainda não existe.

## O que já existe

Metade da fundação está pronta e vem do teste A/B de páginas (spec de 2026-08-01):

- **`src/scripts/form-start.ts`** dispara `FormStart` no primeiro toque do visitante em qualquer formulário.
- **`functions/tracker.js:379`** já tem o conceito de evento que não sai de casa:

  ```js
  const EVENTOS_INTERNOS = new Set(['formstart']);
  ```

  Eventos nessa lista são gravados na `event_log` e param aí — o `/tracker` pula Meta, GA4 e o fan-out do CRM.
- **`event_log`** já carrega `session_id`, `funnel`, `is_bot`, `is_junk` e `origin`.
- **LP do workshop:** o clique em qualquer botão de compra já dispara `InitiateCheckout` (`workshop-black-exponencial-2026.astro:1757`).

Esta spec não reinventa nada disso. Ela adiciona os dois degraus que faltam e a tela que lê o conjunto.

## Os degraus

| Degrau | Evento | Situação |
|---|---|---|
| Acessou a página | `PageView` | já existe |
| Clicou num CTA | `CTAClick` | **novo**, interno |
| Tocou no formulário | `FormStart` | já existe |
| Concluiu a etapa N | `FormStep` (com `step`) | **novo**, interno |
| Virou lead | `Lead` | já existe |

Exemplo do que o dashboard passa a mostrar:

```
/aplicacao-mentoria
  acessaram         1000
  clicaram no CTA    320  (32%)
  tocaram no form    180  (56%)
  concluíram etapa 1 140  (78%)
  concluíram etapa 2  95  (68%)  ← maior queda
  viraram lead        70  (74%)
```

O percentual de cada linha é sobre o degrau **imediatamente anterior**, não sobre o total: é o que localiza a perda. A maior queda é destacada.

## Decisões

### 1. Cada degrau conta sessões distintas, não eventos

Quem clica em três botões conta uma vez. Quem volta da etapa 2 para a 1 e avança de novo conta uma vez. É o que garante que o funil seja sempre decrescente — um funil que sobe no meio não é lido, é debugado.

Implementação: `COUNT(DISTINCT session_id)` por degrau. A dedup vive na **leitura**, não na escrita — mesmo precedente da regra de escolha de destino em `functions/_links-destino.js`. O cliente ainda assim evita reenviar a mesma etapa no mesmo carregamento, para não engordar a tabela à toa.

### 2. CTA é `.btn-cta`, sem nome

Toda página do site já usa essa classe nos botões de ação. Ligando o listener uma vez no `BaseLayout.astro`, **toda LP existente e toda LP futura** entram no funil sem instrumentação própria. Nada para esquecer de ligar.

O evento **não** registra qual botão foi clicado. Foi decisão explícita da usuária (2026-08-31): a pergunta é "quantos clicaram", não "qual seção converte". Nenhuma coluna é criada "por precaução" — quando a pergunta aparecer, ela vem com uma migration própria e um uso real.

No máximo um `CTAClick` por carregamento de página.

### 3. A LP do workshop não ganha evento duplicado

Lá o clique já dispara `InitiateCheckout`. Emitir `CTAClick` no mesmo dedo geraria dois eventos para um clique só, e o número de "cliques" da página passaria a depender de qual dos dois o leitor escolhesse.

Por isso o seletor do `ativarCtaClick()` é `.btn-cta:not([data-checkout])`: o atributo `data-checkout` é a marca de "este botão já se anuncia sozinho", e a única página que o usa hoje é a do workshop. O degrau "clicou" é então lido como:

> a sessão tem **`CTAClick` ou `InitiateCheckout`**

Consequência assumida: o `InitiateCheckout` continua indo ao Meta, porque ali ele é conversão de verdade. O funil apenas o **lê**; não muda o que ele faz.

### 4. `FormStep` dispara ao CONCLUIR a etapa, não ao chegar nela

O evento sai no clique em "→" **depois** de a validação passar. "Concluiu a etapa 1" significa: nome, WhatsApp e Instagram preenchidos e válidos.

A diferença importa. Medindo a chegada, saberíamos quantos *viram* a pergunta do faturamento; medindo a conclusão, sabemos quantos *passaram* dela — e a perda no faturamento aparece como a queda entre a etapa 1 e a etapa 2, que é a leitura acionável.

A **última** etapa não emite `FormStep`: concluí-la é enviar o formulário, o que já é o `Lead`. Um `FormStep` ali seria um degrau gêmeo do último, sempre com o mesmo número.

### 5. Formulários de uma etapa não emitem `FormStep`

As páginas de materiais e o `LeadFormModal` têm formulário único. O funil deles é acessou → clicou → tocou → lead, sem degraus no meio. O dashboard omite a seção de etapas quando não há nenhuma — não mostra lista vazia.

No `LeadChat` (chat de captura), cada pergunta respondida é uma etapa, na ordem do `STEPS`.

### 6. A etapa é um número em coluna própria, não parte do nome do evento

`FormStep` + `step: 2`, e não `FormStep2`.

Nomes-com-número transformariam o `event_name` em depósito e exigiriam a lista de nomes escrita à mão na query do dashboard. No dia em que o formulário de aplicação virasse de 3 para 4 etapas, a etapa nova simplesmente não apareceria — falha silenciosa, a pior categoria. Com o número em coluna, o dashboard descobre as etapas existentes a partir do próprio dado.

### 7. O painel avisa desde quando os degraus novos existem

Os degraus `CTAClick` e `FormStep` nascem no dia do deploy. Um período que comece antes disso mostra `PageView` e `Lead` com o histórico inteiro e os degraus novos zerados ou pela metade — um funil que parece ter desabado, quando na verdade a medição é que não existia.

Ao lado dos degraus fica um asterisco com a nota:

> \* Cliques e etapas passaram a ser medidos em DD/MM/AAAA. Períodos anteriores a essa data mostram esses degraus incompletos.

**A data vem do dado, não do código:** é o `MIN(timestamp)` do primeiro `CTAClick` ou `FormStep` da tabela, devolvido pelo endpoint. Escrever a data à mão no HTML criaria uma segunda verdade para alguém esquecer de atualizar — e ela já nasceria errada se o deploy escorregasse um dia.

**A data é FIXA, e é isso que o `MIN` global garante.** A consulta que a calcula não leva filtro de página, de funil nem de período: é o instante do primeiro evento novo que já existiu no site inteiro. Como eventos só entram no futuro, esse mínimo fica congelado a partir do primeiro clique depois do deploy — é a data do deploy, descoberta sozinha em vez de digitada.

Calcular esse mínimo **dentro** do filtro da consulta seria o erro a evitar: a data passaria a mudar conforme a página e o período escolhidos, virando um número sem significado. Tem teste para isso.

A única coisa capaz de mudá-la seria apagar os eventos mais antigos da `event_log`. Nada purga essa tabela hoje; se um dia alguém criar essa rotina, este aviso passa a mentir e precisa virar data fixa.

**Quando aparece:** só quando o período consultado começa antes dessa data — que é exatamente quando o número engana. Passado o primeiro mês de coleta, o aviso some sozinho das consultas normais e volta a aparecer se alguém pedir um período histórico longo.

## Arquitetura

### Fluxo de um evento interno

```
navegador → POST /tracker → EVENTOS_INTERNOS reconhece o nome
                                    │
                                    ├─ NÃO envia a Meta / GA4
                                    ├─ NÃO dispara o fan-out de CRM
                                    └─ INSERT event_log (com session_id, funnel, step)
```

É exatamente o caminho que o `FormStart` já percorre hoje. `EVENTOS_INTERNOS` passa a ser:

```js
const EVENTOS_INTERNOS = new Set(['formstart', 'ctaclick', 'formstep']);
```

### Dados

**Migration `0034_event_log_step.sql`:**

```sql
ALTER TABLE event_log ADD COLUMN step INTEGER;
```

`NULL` para todo evento que não seja `FormStep` — inclusive todo o histórico anterior, que é o comportamento correto: não havia etapa para registrar.

> ⚠️ **Aplicação em produção:** neste projeto o `wrangler d1 migrations apply --remote` está quebrado (as migrations 0021/0022/0025 estouram ao reaplicar). A coluna vai por comando direto:
>
> ```
> wrangler d1 execute <DB> --remote --command "ALTER TABLE event_log ADD COLUMN step INTEGER"
> ```
>
> O arquivo de migration existe para o banco local e para o histórico do schema.

**Volume:** uma sessão que preenche o formulário inteiro passa de 2 eventos (`PageView`, `Lead`) para ~6. Nas páginas sem formulário o acréscimo é de no máximo 1 evento por sessão. No tráfego atual (a maior LP fez ~4.900 visitas em julho) isso é irrelevante para os limites do D1, mas a `event_log` passa a crescer mais rápido e o `/api/events` lê dela — vale reavaliar índices se a tabela incomodar.

### Componentes e limites

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `migrations/0034_event_log_step.sql` | criar | a coluna `step` |
| `src/scripts/funil.ts` | criar | `enviarEventoInterno()`, `ativarCtaClick()`, `enviarFormStep(n)` |
| `src/scripts/form-start.ts` | modificar | passa a usar `enviarEventoInterno` em vez de repetir o `fetch` |
| `src/layouts/BaseLayout.astro` | modificar | liga `ativarCtaClick()` globalmente, uma vez |
| `src/components/AplicacaoForm.astro` | modificar | `enviarFormStep(n)` no `avancar()`, após a validação |
| `src/components/LeadChat.astro` | modificar | idem, a cada pergunta respondida |
| `functions/tracker.js` | modificar | `EVENTOS_INTERNOS` + gravar `step` no INSERT |
| `functions/api/_funil-etapas.js` | criar | módulo **puro**: linhas do banco → degraus e percentuais |
| `functions/api/conversion.js` | modificar | devolve os degraus junto de cada LP |
| `public/dash/index.html` | modificar | linha da tabela vira expansível |
| `tests/funil-etapas.test.js` | criar | testes do módulo puro |

**Por que `_funil-etapas.js` é um módulo separado e puro:** a aritmética do funil (ordenar degraus, calcular a passagem de cada um, achar a maior queda) fica testável com `node --test`, sem subir Worker nem banco. Mesmo precedente de `_ab-estatistica.js`, `_canal.js` e `_cpl-calculo.js`.

**Por que `funil.ts` e não crescer o `form-start.ts`:** o `form-start.ts` faz uma coisa (dispara `FormStart` no primeiro toque) e continua fazendo só isso. O que sai dele é o `fetch` copiado, que vira função compartilhada — a duplicação seria de três cópias se cada evento escrevesse o seu.

### O envio

O `POST /tracker` segue o formato que o `FormStart` já usa: `event_name`, `event_id` com prefixo próprio (`cta-` e `stp-`, ao lado do `fs-` que o `FormStart` já usa), `event_time`, `event_source_url` e `lead_data.funnel`. O `FormStep` acrescenta `step`.

Cliques em CTA são links que navegam. O envio usa `navigator.sendBeacon` quando disponível, com `fetch` como reserva: sem isso, a navegação cancela a requisição e o clique nos botões mais importantes seria justamente o que menos apareceria no funil.

## Painel

A tabela "Conversão por LP" ganha um clique na linha, que abre o funil daquela página. Fechada, a tabela continua idêntica à de hoje — quem só quer a taxa não vê nada de novo.

O período e o filtro de funil vigentes no dashboard valem para os degraus, e o recorte é o mesmo da tabela: coorte por visita (`sessions.created_at` dentro da janela).

Cada degrau exibe o número absoluto e a passagem em relação ao degrau anterior. A maior queda recebe destaque visual.

Os degraus `CTAClick` e `FormStep` levam um asterisco quando o período consultado começa antes do início da coleta (decisão 7), com a nota logo abaixo do funil informando a data em que passaram a ser medidos. Os degraus `PageView`, `FormStart` e `Lead` não levam asterisco — esses já existiam.

## Tratamento de erro

**O envio falha em silêncio.** `.catch()` vazio, como no `form-start.ts`. Um evento de medição jamais pode travar quem está preenchendo o formulário nem atrasar a ida ao checkout.

Consequência aceita: quem perde a conexão no meio some do funil. Já é verdade hoje para o `FormStart`, e o erro empurra o número para baixo (subnotifica), nunca para cima.

**Etapa ausente no meio.** Se um `FormStep` se perde e o `Lead` chega, a sessão aparece no degrau final sem aparecer no do meio — o funil sobe. O módulo `_funil-etapas.js` normaliza isso na leitura: cada degrau conta no mínimo o valor do degrau seguinte, e a página nunca exibe um funil que cresce.

**Coluna `step` ausente** (se alguém rodar o código antes da migration): o INSERT falharia. O plano de implementação deve aplicar a coluna antes do deploy do código.

## Testes

`tests/funil-etapas.test.js`, com `node --test`, cobrindo o módulo puro:

- degraus na ordem certa a partir de linhas fora de ordem;
- percentual de passagem calculado sobre o degrau anterior;
- degrau anterior zerado não vira divisão por zero;
- funil que "sobe" (etapa perdida) é normalizado, nunca exibido crescendo;
- página sem etapas devolve funil sem a seção de etapas, não uma lista vazia;
- clique lido como `CTAClick` **ou** `InitiateCheckout`, sem contar a sessão duas vezes quando existem os dois;
- número de etapas descoberto a partir do dado (um formulário de 4 etapas aparece inteiro, sem mudar código);
- início da coleta = data do primeiro `CTAClick`/`FormStep`, e o aviso aparece **apenas** quando o período pedido começa antes dela;
- a data de início **não muda** com o filtro: mesma resposta consultando uma página ou outra, um período ou outro (trava o `MIN` global contra um `MIN` acidentalmente filtrado);
- sem nenhum evento novo gravado ainda, o funil não quebra: os degraus novos ficam em zero e o aviso é omitido (não há data de início para anunciar).

Validação manual após o deploy: preencher o formulário de aplicação até a etapa 2 e abandonar; confirmar na `event_log` que existem `CTAClick`, `FormStart` e `FormStep` com `step = 1`, que **não** existe `Lead`, e que `sent_to_meta = 0` e `sent_to_ga4 = 0` nos três.

## Fora de escopo

- **Retroatividade.** O funil começa vazio e enche a partir do deploy. Não há como reconstruir cliques que ninguém gravou — o que existe é o aviso da decisão 7, que declara a data de início em vez de deixar o vazio passar por queda.
- **Nome do botão clicado.** Decisão da usuária. Sem coluna reservada "para o futuro".
- **Rolagem, tempo na página, mapa de calor.** Outra classe de medição, outra spec.
- **Qual campo travou a pessoa dentro de uma etapa.** O degrau é a etapa; medir campo a campo multiplica o volume de eventos por pouco ganho.
- **Alterar a LP do workshop.** Ela já tem o `InitiateCheckout`; o funil apenas o lê.
- **Enviar qualquer um desses eventos a Meta, GA4, ClickUp ou GoHighLevel.** É o ponto central da spec, repetido aqui de propósito: se alguém um dia quiser "aproveitar" o `CTAClick` como conversão no pixel, isso é uma decisão nova, com discussão própria.

# Integração tracking ↔ CRM — perguntas em aberto

**Status:** congelado como plano. Não implementar até estas perguntas estarem respondidas.
**Aberto em:** 2026-07-28
**Motivo da pausa:** operação ainda não tem maturidade de processo no CRM para sustentar a integração.

---

## Contexto (estado real hoje, verificado em 28/07/2026)

O tracking sabe **tudo até o lead chegar**: sessão, UTMs, funil, material da isca, LP de origem,
custo do anúncio e ROAS — mas só de produto digital com checkout.

Do lead em diante ele **entrega e perde de vista**. O `/tracker` faz fan-out do lead para o
ClickUp e para o Supabase (`functions/tracker.js`). A única coisa que volta é o estágio do
ClickUp, gravado em `crm_status_log` (migration `0020_crm_bridge.sql`).

O CRM em Supabase é o que vai ficar. O ClickUp está de saída.

**Consequência prática:** não existe ROAS do funil high-ticket. Não dá para dizer qual anúncio
traz lead que **compra** — só qual traz lead que **preenche formulário**.

---

## Decisão já tomada

**Qual é o objetivo da integração?**

Das três leituras possíveis:

1. O dashboard vira a tela do CRM (mexer no lead, mudar de etapa, anotar — Supabase só como banco)
2. ✅ **ESCOLHIDA** — O tracking passa a **enxergar** o que acontece no CRM. Continua painel de
   métricas, mas sabe em que pé cada lead está e quando fecha venda. O trabalho com os leads
   continua sendo feito no CRM.
3. Os dois viram um sistema só (um absorve o outro)

---

## Perguntas a responder

### 1. O que precisa voltar do CRM para o tracking?

Do mais barato ao mais caro. Marcar o que entra:

- [ ] **a) Estágio do lead** — toda mudança de etapa (novo → contatado → reunião → proposta) fica
  registrada. Dá funil por origem: "dos leads do anúncio X, quantos chegaram a reunião".
- [ ] **b) Venda fechada (valor + data)** — o tracking grava a receita amarrada à origem.
  É o que fecha **ROAS de verdade** no high-ticket.
- [ ] **c) Venda também empurrada para o Meta (conversão offline)** — além de gravar, manda
  Purchase para o Meta CAPI. Não é relatório: **ensina o algoritmo a procurar quem compra**,
  não quem preenche formulário. Costuma ser o item de maior impacto real na campanha.
- [ ] **d) Perda com motivo** — mostra qual anúncio traz lead ruim, não só lead caro.

> Recomendação: **a + b + c** é o núcleo. O (d) só entra se o CRM registrar o motivo da perda em
> campo estruturado — se for texto livre, vira lixo no relatório.

**Resposta:**

---

### 2. Como o dado volta — o CRM avisa ou o tracking pergunta?

- **Push:** o Supabase chama um endpoint do tracking a cada mudança (tempo real, mas exige mexer
  no CRM e tratar falha de entrega/retry).
- **Pull:** um cron lê o Supabase de tempos em tempos (mais simples e tolerante a falha, com
  atraso de minutos/horas — e o tracking precisa de credencial de leitura no Supabase).

> Não precisa responder de cara: depende de quem mexe no CRM e com que frequência.

**Resposta:**

---

### 3. Como o tracking reconhece que "aquele lead do CRM" é "aquela sessão"?

Hoje o payload enviado ao Supabase já leva `external_id`, e-mail e telefone. A pergunta é o que
sobrevive **do lado do CRM** depois que um humano mexe no registro:

- O `external_id` é armazenado e preservado no Supabase?
- Se o vendedor corrigir o e-mail ou o telefone do lead, o casamento quebra?
- Lead que chega por fora do site (indicação, WhatsApp direto) — entra na conta ou fica de fora?

**Resposta:**

---

### 4. Quais estágios do CRM existem, e quais deles importam?

Precisa da lista real das etapas do pipeline no Supabase. Nem toda etapa merece virar métrica —
duas ou três que marcam avanço de verdade (ex.: reunião realizada, proposta enviada, ganho)
valem mais que quinze microestágios.

**Resposta:**

---

### 5. O que conta como "venda" para efeito de ROAS?

- Valor do contrato fechado, ou valor efetivamente pago (primeira parcela)?
- Se for parcelado ou recorrente, o ROAS usa o valor cheio ou o que já entrou?
- Como tratar reembolso / cancelamento depois de contabilizado?

**Resposta:**

---

### 6. Janela de atribuição

Um lead que entrou em maio e fechou em agosto conta o ROAS de qual mês — o do **gasto** (maio)
ou o do **fechamento** (agosto)? No high-ticket essa diferença é grande e muda a leitura do
painel inteiro.

**Resposta:**

---

### 7. Onde isso aparece?

Aba nova no `/dash`? Colunas a mais na tabela de conversão por LP que já existe? Ou um bloco
dentro da aba do Meta?

**Resposta:**

---

## Quando retomar

Com as respostas de 1 a 7 em mãos, retomar pelo `/spec` — este arquivo vira o insumo da spec.

Relacionado: `docs/superpowers/specs/` (specs anteriores), migration `0020_crm_bridge.sql`
(a ponte que já existe para o ClickUp serve de molde para a do Supabase).

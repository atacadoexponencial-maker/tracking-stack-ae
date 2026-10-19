# S3-02: Visão geral, aba Leads, conversão e reuniões com o funil pela UTM

**Tipo:** Implementação
**Página:** Visão geral e aba Leads + Conversão por funil + Reuniões por funil
**Spec:** `spec-funil-pela-utm.md`

## Descrição

Leva a regra do funil (criada na S3-01) para o resto do dash: contagem e filtro de
leads, seletor de funil, lista de leads, conversão por funil e reuniões por funil.

## Pronto quando

Na Visão geral e na aba Leads, aquisição é um funil filtrável com os leads de bio e
ManyChat, aplicacao-mentoria e iscas-manychat não aparecem mais como funil, e a
conversão e as reuniões por funil batem com a mesma regra.

## Critérios de aceite

- **CA-S3-14** (automática) — Leads por funil seguem a regra. Dado os leads dos critérios CA-S3-01 a CA-S3-08 num mesmo período, quando a Visão geral conta leads e leads novos por funil, então as contagens batem com o funil que a regra deu a cada lead, e a soma é igual ao total de leads.
- **CA-S3-15** (automática) — Seletor de funil lista funis, não formulários. Dado leads de /aplicacao-mentoria, isca do ManyChat, home e workshop, quando o dash monta a lista do seletor de funil, então a lista tem aquisição, sessão estratégica e workshop, e não tem aplicacao-mentoria nem iscas-manychat.
- **CA-S3-16** (automática) — Filtrar por aquisição. Dado os leads do critério CA-S3-15, quando a pessoa filtra o dash por aquisição, então só aparecem os leads da bio e do ManyChat.
- **CA-S3-17** (automática) — Lista de leads mostra funil e página de entrada. Dado um lead da /aplicacao-mentoria vindo da bio, quando a aba Leads lista esse lead, então a coluna de funil diz aquisição e a página de entrada continua visível como /aplicacao-mentoria.
- **CA-S3-18** (automática) — Visita conta no funil pela mesma regra. Dado uma visita à /aplicacao-mentoria vinda da bio que não virou lead, e outra vinda de anúncio de SE que virou lead, quando o dash calcula a conversão por funil, então a primeira conta como visita de aquisição sem lead, e a segunda como visita e lead de sessão estratégica.
- **CA-S3-19** (automática) — Reunião herda o funil do lead pela regra. Dado um lead da /aplicacao-mentoria vindo da bio que agendou consultoria, quando o dash conta reuniões por funil, então a reunião conta em aquisição.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S3-03 | Na conversão por funil, a visita a uma porta da SE segue a mesma regra pela UTM da visita (CA-S3-18). Visita a página de produto continua no funil da página | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |
| SUP-S3-04 | Aceita-se que taxas, metas e Argo (pelo ClickUp) mostrem números diferentes das contagens do tracking no mesmo funil, sobretudo em aquisição, que não existe no ClickUp | confirmada | usuária aprovou a spec como escrita ("pode implementar agora"), 19/10 |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S3-02 | Taxas, metas e Argo (campo do ClickUp) também seguem a UTM? | respondida | Não. Só o que o tracking calcula (usuária, 19/10) |

## Cenários

### Happy Path
1. `/api/leads` lê os leads com funil do formulário + UTM da sessão + material, carrega o mapa de campanhas (`carregarMapaCampanhas`) e aplica `funilDoLead` em JS: contagens por funil, filtro `&funnel=`, material da isca e a lista (com `funnel` pela regra, `formulario` e `pagina` de entrada).
2. O seletor recebe `funisDoSeletor`: os funis do formulário normalizados (porta vira o funil de verdade) + aquisição.
3. `/api/conversion` agrupa também pelo funil do lead da sessão e pela campanha (bio e ManyChat num rótulo só) quando há `&funnel=` ou `&by=funnel`; visita e lead passam pela mesma regra.
4. As reuniões (agendadas e realizadas) pegam o funil do lead do mesmo e-mail pela regra (`funisDasReunioes`); sem lead, o funil gravado na agenda normalizado, ou SE no Calendly.
5. O painel por funil da Visão geral deixa de esconder aquisição; a lista de leads mostra as colunas Funil e Entrada.

### Edge Cases
- Com filtro de funil, a lista de leads é lida sem LIMIT e cortada depois do filtro (o funil é decidido em JS).
- O GROUP BY extra da conversão foi medido no D1 remoto em 19/10: 12.932 linhas lidas contra 12.921 antes (30 dias).
- Sessão com leads em dois funis: vale o primeiro lead, como antes.

### Cenário de Erro
- Falha ao ler campanhas ou funis conhecidos: o mapa sai vazio e a regra continua separando bio, ManyChat, produto e SE.
- Falha ao buscar os leads das reuniões: vale o funil gravado (agenda) ou SE (Calendly).

## Prova

| Critério | Prova | Onde | O que confere |
|---|---|---|---|
| CA-S3-14 | automática | `tests/leads-funil-utm.test.js` | contagens por funil (leads e leads novos) batem com a regra e somam o total |
| CA-S3-15 | automática | `tests/leads-funil-utm.test.js` | seletor tem aquisição, SE e workshop, sem aplicacao-mentoria nem iscas-manychat |
| CA-S3-16 | automática | `tests/leads-funil-utm.test.js` | `&funnel=aquisicao` traz só os leads da bio e do ManyChat |
| CA-S3-17 | automática | `tests/leads-funil-utm.test.js` | lead da aplicação via bio sai com funil aquisição e página /aplicacao-mentoria |
| CA-S3-18 | automática | `tests/conversion-por-funil.test.js` | visita da bio = aquisição sem lead; visita de anúncio de SE = visita e lead de SE |
| CA-S3-19 | automática | `tests/reunioes-calendly.test.js` | reunião (Calendly e agenda) de lead da aplicação via bio conta em aquisição |

## Arquivos

- **Modificar:** `functions/api/_funil-lead.js` — `carregarMapaCampanhas` e `funisDoSeletor`.
- **Modificar:** `functions/api/leads.js` — funil pela regra em contagens, filtro, lista e seletor.
- **Modificar:** `functions/api/conversion.js` — visita e lead pela regra (`&funnel=` e `&by=funnel`).
- **Modificar:** `functions/api/_reunioes-agendadas.js` — `funisDasReunioes`; agendadas pelo lead do e-mail.
- **Modificar:** `functions/api/cpl.js` — realizadas pelo lead do e-mail.
- **Modificar:** `public/dash/index.html` — painel por funil com aquisição; colunas Funil e Entrada na lista de leads.
- **Criar:** `tests/leads-funil-utm.test.js` — CA-S3-14 a 17.
- **Modificar:** `tests/conversion-por-funil.test.js` — CA-S3-18 e fixture no formato novo.
- **Modificar:** `tests/reunioes-calendly.test.js` — CA-S3-19.

## Checklist

- [x] `/api/leads` com o funil pela regra (contagens, filtro, lista, seletor)
- [x] `/api/conversion` com visita e lead pela regra, custo do D1 medido
- [x] Reuniões agendadas e realizadas pelo funil do lead
- [x] Painel por funil com aquisição e lista de leads com Funil e Entrada
- [x] Suíte inteira passando

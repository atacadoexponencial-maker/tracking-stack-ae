# Argo julga cada campanha pelo objetivo dela — design (plano 2)

Data: 2026-09-20
Status: rascunho para revisão
Antecessor: `2026-09-20-argo-controle-ae-design.md` (plano 1, no ar)

## O problema

O Argo opera hoje sobre **R$ 192 de R$ 2.632** investidos na semana — 7% —
e justamente a fatia sem desfecho mensurável.

Medido em 13 a 19/09, pelo `/api/feedback-marketing`:

| Bloco | Investido | Resultado | Custo |
|---|---:|---|---:|
| SE (sessão estratégica) | R$ 1.528,75 | 12 leads, 7 MQLs | CPL R$ 127,40 |
| LIVE | R$ 595,47 | contagem manual | — |
| WO PAGO | R$ 315,61 | 8 compras | CPA R$ 39,45 |
| **AQUISIÇÃO** (o que ele vigia) | **R$ 192,61** | **0 leads, 0 MQLs** | não calculável |

O bloco de aquisição são impulsionamentos que levam ao perfil do Instagram. O
tracking não alcança o que acontece lá dentro, então **não existe métrica de
dinheiro para aquelas campanhas** — não por falta de código, por falta de dado.

Enquanto isso, os R$ 1.528 que geram MQL e os R$ 315 que geram venda ele não
toca, porque só olha campanhas com objetivo de tráfego.

## A descoberta que torna isto possível

Cada lead no CRM já carrega, desde junho de 2024, a origem completa. Conferido
no card `86akmhjk8`, criado hoje:

```
utm_campaing : ae_leads_publico-frio_evento-lead_sessao-estrategica
utm_content  : ad15_faturamento-travado_vd
utm_source   : facebookads
```

**A atribuição desce até o anúncio.** O `utm_content` identifica o criativo. O
card também tem o marcador de MQL.

Nada disso é lido de volta: `_feedback-marketing-crm.js` usa só `utm_source`,
para decidir se o lead é tráfego pago. O funil é derivado do **nome da
campanha** no lado do gasto. Por isso hoje só existe CPL por funil, nunca por
campanha nem por anúncio.

## O que este ciclo entrega

Cada campanha passa a ser julgada pela régua do objetivo dela, e não por uma
régua só:

- **Campanhas de lead e venda** (SE, LIVE, WO PAGO) passam a ser julgadas no
  nível do **anúncio**, pelo que produzem: lead qualificado e compra.
- **Campanhas de visita** (o bloco de aquisição) continuam julgadas por **custo
  por visita**, que é a régua certa para o objetivo delas. O que muda é a
  referência se recalcular sozinha, para nunca mais congelar como congelou de
  julho a setembro.

## Decisões tomadas

**Nível de ação: o anúncio.** O dado permite, é a ação mais cirúrgica e mais
reversível, e é o que um gestor faria à mão. Pausar campanha inteira leva junto
o criativo bom.

**A régua sai do histórico da própria conta**, não de uma meta digitada. É o que
impede congelar de novo — o defeito que custou dois meses de régua errada no
plano 1.

**Só conta lead que já teve tempo de virar MQL.** Um lead de ontem ainda está na
fila do comercial; contá-lo como "não qualificou" mata anúncio bom. A janela de
maturação é configurável e exclui os dias mais recentes da conta de MQL.

**A regra é "gastou e não trouxe nada", não um ranking.** Esta é a decisão que
mais importa e vem da medição de volume: a SE traz ~12 leads e 7 MQLs por
semana. Distribuídos entre os anúncios ativos, dá um ou dois leads por anúncio
por semana. **Ranquear anúncios por custo por MQL nesse volume é ruído com
aparência de análise.** Zero sobrevive a amostra pequena; a diferença entre um e
dois MQLs não sobrevive.

Então o candidato a pausa é o anúncio que **gastou acima de um piso e produziu
zero leads qualificados** na janela madura. Comparações finas de eficiência
ficam na tela, para a gestora olhar — não viram ação automática.

**O bloco de aquisição continua julgado por custo por visita**, porque não
existe nada melhor disponível para ele. O que muda é a referência deixar de ser
um campo que alguém precisa lembrar de atualizar.

**O piso de gasto é por bloco, não um número só** (decisão da gestora em
22/09). O piso existe para que "zero qualificado" signifique alguma coisa, e o
que é pouco dinheiro num bloco é muito no outro:

| Bloco | Piso em 7 dias |
|---|---:|
| Lead e venda (SE, LIVE, WO PAGO) | R$ 100 |
| Visita (aquisição) | R$ 30 |

O de R$ 100 na aquisição não impedia a ação — impedia que ela fosse **em
tempo**. As quatro pausas reais foram todas entre R$ 103 e R$ 121, ou seja, o
Argo só agia depois que a campanha já tinha consumido quase todo o orçamento
semanal do bloco sozinha. Com ~R$ 13/dia, R$ 30 é cerca de R$ 4,30/dia por uma
semana: dinheiro suficiente para julgar, cedo o bastante para importar.

## Arquitetura

**Quem tem qual metade do dado, medido antes de desenhar:** o tracking
sincroniza o Meta apenas em `level=campaign` (`functions/api/sync/meta-ads.js`),
então **não existe gasto por anúncio no D1**. Quem tem é o Argo, que já consulta
anúncios no Meta com o token do profile.

Daí a divisão:

```
CRM (ClickUp) ── leads + MQL por utm_content ──> /api/argo/leads-por-anuncio (novo)
                                                             │
Meta API ─────── gasto por anúncio ─────────> Argo (VPS) <───┘
                                                  │  junta, mede a taxa,
                                                  │  aplica a régua
                                                  v
                                        Neon, schema `argo`
                                                  │
                              aba Argo <── /api/argo/*
```

O endpoint novo entrega só a metade que o tracking tem: por `utm_content`,
quantos leads e quantos qualificados na janela madura. Sem gasto. O Argo traz a
outra metade e faz a junção — é ele que tem os dois lados, e por isso é ele que
mede a taxa de junção.

Rejeitado: sincronizar o Meta em `level=ad` para o D1 e fazer tudo no tracking.
Duplicaria um dado que o Argo já busca, criaria tabela nova no D1 e sincronia
para manter, sem ganho — a aba já lê o resultado da rodada pela Neon, que é o
padrão do plano 1.

**Consequência a aceitar:** a aba mostra a visão da última rodada, não ao vivo.
É o mesmo comportamento do resto da aba.

## Peça 1 — O endpoint de desempenho por anúncio

Entrega, por anúncio, no período pedido: gasto, leads atribuídos, leads
qualificados, e as datas que delimitam a janela madura. `null` onde não há
denominador, nunca `0` inventado.

A junção entre o lead e o anúncio é por **`utm_content` contra o nome do anúncio
no Meta**.

**Medido em 20/09, antes de escrever esta spec:** a convenção bate. O lead do
card `86akmhjk8` traz `utm_content = ad15_faturamento-travado_vd`, e existe na
conta um anúncio com exatamente esse nome, ativo. O padrão é sistemático
(`adNN_slug_tipo`) nos 92 anúncios da conta.

**Mas os nomes não são únicos.** `ad14_atacado-e-relacionamento_vd` e
`ad08_pov-print-wilinha_vd` aparecem cada um em dois anúncios distintos — o
mesmo criativo rodando em campanhas diferentes. Consequências, e as duas
precisam de decisão explícita na implementação:

- **Do lado da leitura**, juntar por nome **agrega** o gasto dos homônimos. Isso
  provavelmente é o que se quer — a pergunta "este criativo traz MQL?" é sobre o
  criativo, não sobre a instância —, mas tem que ser dito, não acontecer por
  acidente.
- **Do lado da ação**, "pausar o anúncio" fica ambíguo: são dois `ad_id`. Pausar
  os dois é coerente com a leitura agregada; pausar um só produziria um estado em
  que a tela e a realidade discordam.

**Taxa de junção medida em 20/09, sobre 71 leads reais de tráfego pago: 85,9%**
(61 casaram). E **100% dos leads têm `utm_content`** — a instrumentação é
completa. O portão está passado.

Os 10 que não casaram são o achado mais útil da medição:

| Valor | Vezes | O que é |
|---|---:|---|
| `ad13_tweet-se_img` | 8 | anúncio **renomeado** — hoje é `ad13_tweet-se-322_img` |
| `{{ad.name}}` | 1 | o Meta não substituiu o placeholder — anúncio mal configurado |
| `link_in_bio` | 1 | não é anúncio |

**Renomear anúncio quebra a atribuição histórica, e esse é o modo de falha mais
perigoso do desenho.** O anúncio renomeado passa a parecer que nunca trouxe
lead — exatamente o sinal que dispararia uma pausa. Oito dos dez órfãos vêm de
um único rename.

Daí três regras que passam a ser duras:

- **`utm_content` sem correspondência é "não atribuível", nunca "anúncio sem
  lead".** Um lead órfão não pode contar contra nenhum anúncio.
- **A taxa de junção aparece na tela, por rodada.** Se alguém renomear anúncios
  em massa, a taxa cai e isso fica visível antes de virar decisão errada. Sem
  isso, a degradação é silenciosa.
- **Abaixo de um piso de junção, o Argo não propõe pausa naquela rodada** e diz
  por quê. Dado ruim não vira ação.

Escala da não-unicidade, medida junto: **92 anúncios, 48 nomes distintos** —
quase metade são homônimos.

**Recomendação fora do escopo deste plano:** incluir `{{ad.id}}` no template de
UTM dos anúncios. O id não muda quando o anúncio é renomeado, e resolveria a
fragilidade na origem — mas só para leads futuros, e é mudança de configuração
na conta, não de código.

## Peça 2 — A régua no Argo

O `objetivos.md` da conta ganha, para os funis de lead e de venda: piso de gasto
para um anúncio ser julgado, janela de maturação em dias, e janela de avaliação.

A referência de custo por visita do bloco de aquisição passa a ser recalculada a
cada rodada a partir do histórico real, substituindo o campo manual. A correção
à mão de 20/09 é o remendo que esta peça aposenta.

## Peça 3 — Pausar anúncio

A ação `pausar_anuncio` já existe na grade, hoje em `desligado`, e no
`executor.py` da esteira — que nunca executou. Este ciclo é o primeiro uso real
dela.

Nasce em **propor**, não em executar. A gestora vê as propostas na aba por
algumas rodadas antes de liberar a execução — o mesmo caminho que o plano 1 não
pôde seguir, porque lá a pausa automática já estava no ar.

## Peça 4 — A aba mostra o desempenho por anúncio

Tabela por anúncio com gasto, leads, qualificados e custo por qualificado,
ordenável, com marcação clara de quem está abaixo do piso de volume — para a
leitura não sugerir precisão que o dado não tem.

## Regras duras

**Amostra pequena não vira ação.** Anúncio abaixo do piso de gasto ou de leads
não é candidato a nada; aparece na tela marcado como sem volume suficiente.

**Lead imaturo não conta como não-qualificado.** A janela de maturação é
obrigatória, não opcional.

**A régua sai do histórico e se recalcula.** Nenhum número de referência fica
guardado em campo que precise de manutenção manual.

**A aba não decide nada.** Toda classificação vem pronta do backend.

**`pausar_anuncio` nasce em `propor`.**

## Fora de escopo

Realocar verba e aumentar orçamento (plano 3); o desfazer; as contas da
agência; e resolver o rastreio do que acontece
dentro do perfil do Instagram — que é o que tornaria o bloco de aquisição
mensurável, e é um projeto de outra natureza.

## Riscos conhecidos

**A junção por nome de anúncio é o risco principal.** Se `utm_content` e o nome
no Meta divergirem, a consequência é silenciosa e enganosa: todo anúncio parece
não trazer lead. A verificação da Peça 1 existe para matar o plano cedo se for o
caso.

**O volume é baixo para julgar anúncio.** Mesmo com a regra do "zero", um
anúncio novo e bom pode passar uma semana sem MQL por acaso. Por isso o piso de
gasto e a janela importam mais que a fórmula.

**A esteira continua sem nunca ter executado.** `pausar_anuncio` em produção
será o primeiro uso real do `executor.py`.

**O campo de dinheiro da aba depende da locale do navegador** (pendência do
plano 1). Vira pré-requisito se este ciclo introduzir configuração de valores.

# CPL por funil e canal — design

**Data:** 2026-07-28
**Status:** aprovado, pronto para virar plano de implementação

---

## Problema

O dashboard já mostra um CPL geral na aba Meta Ads: investimento total ÷ leads totais
(`public/dash/index.html:581`). Esse número esconde o que importa — uma oferta pode estar
custando R$ 20 por lead e outra R$ 200, e a média não denuncia nenhuma das duas.

Falta quebrar o custo por **funil** (a oferta) e por **canal** (o caminho).

## Descoberta que redefiniu o escopo

O pedido original era "agrupar as campanhas por funil, já que a nomenclatura está correta".
A checagem nos dados reais (D1 de produção, 28/07) mostrou que isso não basta.

### 1. A nomenclatura não casa com os slugs de funil

| Campanha (últimos 30d) | Gasto | Funil no `event_log` | Casa por igualdade? |
|---|---|---|---|
| `ae_leads_publico-frio_evento-lead_sessao-estrategica` | R$ 2.484 | `sessao-estrategica` | sim |
| `ae_leads_publico-frio_form-nativo_sessao-estrategica` | R$ 1.034 | `sessao-estrategica` | sim |
| `ae_leads_publico-frio_evento-lead_lives-semanais` | R$ 956 | `lives-semanais-v1` | **não** (sufixo `-v1`) |
| `ae_leads_publico-frio_evento-lead_trafego-pago` | R$ 896 | `trafego-atacado` | **não** (nome diferente) |
| `Post do Instagram: ...` (3 campanhas) | R$ 222 | — | **não** (impulsionamento) |

Casamento por igualdade exata classificaria ~55% do gasto e descartaria o resto em silêncio.

`trafego-pago` → `trafego-atacado` é uma equivalência que só existe no conhecimento da operação;
nenhuma regra automática a descobre. Precisa ser declarada uma vez, por uma pessoa.

### 2. `funnel` está sendo usado para duas coisas diferentes

O tracking tem um campo só, `funnel`, e ele mistura oferta com origem:

| Valor | O que realmente é |
|---|---|
| `sessao-estrategica`, `lives-semanais-v1`, `aplicacao-mentoria`, `workshop`, `trafego-atacado` | funil (oferta) |
| `iscas-manychat` | **canal** (ManyChat) |

Isso trava a análise. Casos concretos levantados pela usuária:

- Os links da bio apontam para `/aplicacao-mentoria` desde 13/07 (54 sessões, perfis felipe,
  barbara, day, marcelle, atacadoexponencial). Jogar esses leads num funil `aquisicao` os
  **removeria** de `aplicacao-mentoria`, onde de fato estão.
- Uma campanha paga futura de aplicação de mentoria cairá no mesmo funil vindo por outro canal.
  Com uma dimensão só, os dois custos aparecem somados e a campanha nova fica impossível de
  avaliar.
- Sessão estratégica recebe lead de anúncio, indicação, e-mail e bio. Sem canal, tudo vira uma
  linha só.

**Conclusão:** canal e funil são dimensões independentes. Todo lead responde as duas.

### 3. O dado de canal já existe

`sessions` já grava `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`. O canal pode ser
**derivado** do que já está gravado — sem coluna nova, sem alterar landing pages, e valendo
retroativamente para todo o histórico.

---

## Decisões

1. **Canal é dimensão derivada, não campo digitado.** Regra única no backend traduz UTM → canal.
2. **Campanha → funil: automático com override manual.** O automático resolve o previsível; a
   usuária corrige o resto uma vez, na interface, sem deploy.
3. **Nada que não casa é descartado.** Gasto sem classificação aparece como "Sem funil".
4. **O painel declara suas próprias limitações** em vez de exibir número inventado.
5. **Escopo é relatório e classificação.** Nenhuma mudança no que as páginas gravam.
6. **`iscas-manychat` não é corrigido agora.** Está na gaveta errada, mas ainda não tem lead
   nenhum (no ar desde 27/07). Fica como pendência registrada ao final.

---

## Componentes

### A. Regra de canal (módulo compartilhado)

Um módulo novo, consumido por todos os endpoints que precisarem de canal. Uma fonte de verdade —
a regra não pode ser reescrita em cada consulta.

Cascata, **na ordem** (primeira que casar vence):

| Condição na sessão | Canal |
|---|---|
| `event_log.material` preenchido (veio de `/materiais/*`) | `manychat` |
| `utm_campaign` começa com `bioperfil` | `bio` |
| `utm_source` = `facebookads` | `meta-ads` |
| `utm_source` contém `email`/`ghl` | `email` |
| `utm_source` preenchido, nenhuma acima | `outro` |
| sem UTM | `direto` |

`manychat` vem antes de tudo porque as páginas de material podem chegar com ou sem UTM.

**`aquisicao` não aparece nesta cascata, e isso é proposital.** Post impulsionado não manda
ninguém para o site — não existe sessão com canal `aquisicao`. Ele é um rótulo do lado do
**investimento** (campanhas de impulsionamento, via `campaign_funnel_map`), não do lado do lead.

O CPL de `aquisicao` é, portanto, um cruzamento declarado:

```
CPL aquisicao = gasto das campanhas de impulsionamento ÷ (leads canal bio + leads canal manychat)
```

É a única linha do relatório em que numerador e denominador vêm de origens diferentes. Por isso
ela carrega a marcação de estimativa — decisão consciente da usuária, registrada aqui para que
ninguém a "corrija" depois achando que é bug.

O módulo exporta a expressão SQL usada nos `GROUP BY` e a lista canônica de canais para o
frontend. Nenhuma regra de negócio no navegador.

### B. Mapeamento campanha → funil

**Tabela nova** `campaign_funnel_map`:

| coluna | conteúdo |
|---|---|
| `campaign_id` | id da campanha no Meta (chave primária) |
| `campaign_name` | nome no momento do mapeamento, para leitura humana |
| `funnel` | slug do funil, ou `aquisicao` para impulsionamento |
| `origem` | `auto` \| `manual` |
| `atualizado_em` | unix seconds |

**Resolução automática**, aplicada a campanha ainda não mapeada:

1. Nome sem `_` (ex.: `Post do Instagram: ...`) → `aquisicao`.
2. Último segmento após `_`, normalizado, comparado com os funis conhecidos
   (`SELECT DISTINCT funnel FROM event_log`), aceitando **prefixo**:
   `lives-semanais` casa `lives-semanais-v1` — e continuará casando se surgir `-v2`.
3. Sem casamento → não grava linha; a campanha cai em "Sem funil" no relatório.

**Override manual** sempre vence e nunca é sobrescrito pelo automático. Aplica-se ao histórico
inteiro, porque a resolução acontece na consulta, não na ingestão.

### C. Endpoints

**`GET /api/cpl`** — autenticado por `DASH_KEY`, mesmo padrão de período (`days` ou `from`/`to`)
dos endpoints existentes. Retorna três recortes num payload só:

- `por_funil`: funil, investimento, leads, CPL, flag de estimativa
- `por_canal`: canal, investimento, leads, CPL, flag de estimativa
- `cruzado`: funil × canal, com leads e — quando atribuível — investimento

Investimento vem de `ad_spend` (`platform='meta'`) via `campaign_funnel_map`.
Leads vêm de `event_log` com `event_name='Lead'` e `COALESCE(is_junk,0)=0`, mesmo intervalo.

**`GET /api/campaign-funnel`** — lista campanhas do período com o funil resolvido e a origem
(`auto`/`manual`/`sem-funil`), para montar a coluna editável.

**`POST /api/campaign-funnel`** — grava override manual. Autenticado pela mesma `DASH_KEY`.
Valida que o funil enviado pertence à lista conhecida (funis do `event_log` + `aquisicao`) e
rejeita valor arbitrário.

### D. Interface — aba Meta Ads

Reusa os helpers `tabela()` e `tile()` já existentes em `public/dash/index.html`. Sem tela nova,
sem autenticação nova.

1. **Tabela "CPL por funil"** — Funil | Investimento | Leads | CPL | % do gasto.
   Linha "Sem funil" aparece sempre que houver gasto não classificado.
2. **Tabela "CPL por canal"** — mesmas colunas, agrupado por canal.
3. **Tabela "Funil × canal"** — leads por cruzamento, com investimento onde atribuível.
4. **Coluna "Funil" na tabela de campanhas** — `<select>` com os funis conhecidos. Alterar salva
   via `POST` e recarrega as tabelas de CPL. Campanha resolvida automaticamente mostra o valor
   com marcação discreta de "automático".

---

## Casos-limite e o que o painel comunica

| Situação | Comportamento |
|---|---|
| Funil/canal com investimento e **zero lead** | CPL exibe `—` com o motivo, nunca `∞` |
| Canal `aquisicao` (turbinar) | CPL calculado sobre leads de `bio` + `manychat`, **marcado como estimativa** — a ligação turbinar → lead é dedução, não rastreio |
| Campanha `form-nativo` (R$ 1.034, zero lead) | Nota explícita: sync de leads do Meta pendente de cron (issue 145), não é a campanha que está ruim |
| Campanha sem mapeamento | Linha "Sem funil" com gasto visível |
| Leads sem `funnel` (8 registros hoje) | Agrupados como "Sem funil", visíveis |
| Lead sem UTM | Canal `direto` |

**Invariante:** a soma do investimento das linhas — incluindo "Sem funil" — é igual ao
investimento total do período já exibido no KPI da aba. Se não fechar, há bug de classificação.

---

## Testes

- Resolução automática: `..._sessao-estrategica` → igualdade; `..._lives-semanais` →
  prefixo de `lives-semanais-v1`; `Post do Instagram: ...` → `aquisicao`; `..._trafego-pago` →
  sem casamento.
- Override manual vence o automático e sobrevive a nova execução da resolução.
- `POST` rejeita funil fora da lista conhecida e rejeita chave inválida.
- Derivação de canal: um caso por linha da cascata, incluindo precedência de `manychat` sobre UTM.
- CPL com denominador zero devolve `null`, não `Infinity`.
- Invariante da soma: total das linhas = total do período.

---

## Restrição operacional

`wrangler d1 migrations apply --remote` **não pode ser executado neste projeto** — as migrations
0021, 0022 e 0025 quebram ao reaplicar. A tabela `campaign_funnel_map` deve ir para produção com
`wrangler d1 execute tracking-ae-db --remote --file=migrations/0028_campaign_funnel_map.sql`,
e o arquivo precisa ser idempotente (`CREATE TABLE IF NOT EXISTS`).

---

## Fora de escopo

- Corrigir `iscas-manychat` de funil para canal — seguro fazer depois que houver leads.
- Integração com o CRM em Supabase — congelada em `docs/crm-integracao/perguntas-em-aberto.md`.
- Investigar as 239 sessões com `utm_campaign={{campaign.name}}` (macro do Meta não substituída
  em algum anúncio) — tráfego pago chegando sem identificação de campanha. Achado durante esta
  análise, não relacionado à entrega.
- Google Ads: `ad_spend` já prevê `platform='google'`, mas não há dado.

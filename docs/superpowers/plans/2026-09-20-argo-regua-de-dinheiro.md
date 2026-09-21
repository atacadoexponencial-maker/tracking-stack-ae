# Argo julga anúncio por dinheiro — Implementation Plan (plano 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Argo passa a identificar anúncios que gastaram e não trouxeram nenhum lead qualificado, em vez de julgar campanhas por custo por visita.

**Architecture:** O tracking entrega a metade que ele tem — leads e MQLs agrupados por `utm_content`, que é o nome do anúncio. O Argo traz a outra metade, gasto por anúncio da Meta API, faz a junção, mede a taxa de acerto dessa junção e grava tudo na Neon. A aba lê de lá. Nenhuma tabela nova no D1, nenhum dado duplicado: o Argo já consulta anúncios no Meta com o token dele.

**Tech Stack:** Cloudflare Pages Functions + `node --test` (tracking); Python 3 no venv do profile (`/root/.hermes/profiles/gestor-ia/.venv/bin/python`) + `python -m unittest` (VPS); Postgres na Neon, schema `argo`.

**Spec:** `docs/superpowers/specs/2026-09-20-argo-regua-de-dinheiro-design.md`

## Global Constraints

- **Amostra pequena não vira ação.** A régua é "gastou acima do piso e trouxe **zero** qualificados". Ranking por custo por MQL não vira ação automática — com ~12 leads e 7 MQLs por semana distribuídos entre os anúncios, a diferença entre 1 e 2 MQLs é ruído.
- **`utm_content` sem correspondência é "não atribuível", nunca "anúncio sem lead".** Um lead órfão não conta contra nenhum anúncio. Medido: 85,9% de junção, e 8 dos 10 órfãos vieram de **um rename** (`ad13_tweet-se_img` → `ad13_tweet-se-322_img`).
- **A taxa de junção aparece na tela, por rodada.** Sem isso a degradação por rename é silenciosa.
- **Abaixo do piso de junção, o Argo não propõe pausa naquela rodada** e diz por quê.
- **Lead imaturo não conta como não-qualificado.** A janela de maturação exclui os dias recentes da conta de qualificados.
- **`pausar_anuncio` nasce em `propor`**, nunca em `executar`, mesmo que a grade permita.
- **Nomes de anúncio não são únicos:** 92 anúncios, 48 nomes distintos. A junção agrega homônimos por nome, e uma proposta de pausa nomeia **todos** os `ad_id` daquele nome.
- **A aba não decide nada.** Toda classificação vem pronta do backend.
- Segredos nunca aparecem em código, log, resposta ou mensagem de erro.
- A conta é uma só: `atacado-exponencial`, `act_4577256079174658`.
- VPS: `ssh root@31.97.241.169`, base `/root/.hermes/profiles/gestor-ia/`.

---

### Task 1: Módulo puro que agrupa leads por anúncio

**Files:**
- Create: `functions/api/_argo-leads-anuncio.js`
- Test: `tests/argo-leads-anuncio.test.js`

**Interfaces:**
- Consumes: `ehMql(card)` de `./_feedback-marketing-mql.js`; `ehTrafegoPago(utmSource)` e `lerCampo(card, {id})` de `./_feedback-marketing-crm.js`; `CU_FIELD` de `./_clickup.js`.
- Produces: `agruparPorAnuncio({ cards, maduroAteMs })` → `{ anuncios, sem_utm_content, nao_trafego_pago }` onde cada item de `anuncios` é `{ utm_content, leads_maduros, qualificados, leads_recentes }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/argo-leads-anuncio.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorAnuncio } from '../functions/api/_argo-leads-anuncio.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

// Um card do ClickUp como a API devolve: custom_fields é lista de {id, value}.
function card({ criadoMs, content, source = 'facebookads', status = 'qualificação', faturamento = 'Mais de 50 Mil' }) {
  return {
    id: `t${criadoMs}${content}`,
    date_created: String(criadoMs),
    status: { status },
    custom_fields: [
      { id: CU_FIELD.utmSource, value: source },
      { id: CU_FIELD.utmContent, value: content },
      { id: CU_FIELD.faturamento, value: faturamento },
    ],
  };
}

const MADURO = 2_000_000;   // qualquer card criado até aqui é maduro
const RECENTE = 3_000_000;  // criado depois: ainda na fila do comercial

test('agrupa por utm_content e conta qualificados só entre os maduros', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
      card({ criadoMs: 1_500_000, content: 'ad15_x_vd', status: 'desqualificado' }),
      card({ criadoMs: RECENTE, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad15_x_vd');
  assert.equal(ad.leads_maduros, 2);
  assert.equal(ad.qualificados, 1);
  assert.equal(ad.leads_recentes, 1);
});

test('lead recente nunca conta como nao-qualificado', () => {
  const r = agruparPorAnuncio({
    cards: [card({ criadoMs: RECENTE, content: 'ad01_novo_vd' })],
    maduroAteMs: MADURO,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad01_novo_vd');
  assert.equal(ad.leads_maduros, 0);
  assert.equal(ad.qualificados, 0);
  assert.equal(ad.leads_recentes, 1);
});

test('card que nao e trafego pago fica de fora e e contado a parte', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd', source: '' }),
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  assert.equal(r.nao_trafego_pago, 1);
  assert.equal(r.anuncios.find((a) => a.utm_content === 'ad15_x_vd').leads_maduros, 1);
});

test('trafego pago sem utm_content e contado a parte, nunca some', () => {
  const r = agruparPorAnuncio({
    cards: [card({ criadoMs: 1_000_000, content: '' })],
    maduroAteMs: MADURO,
  });
  assert.equal(r.sem_utm_content, 1);
  assert.equal(r.anuncios.length, 0);
});

test('sem cards devolve listas vazias, nunca null', () => {
  const r = agruparPorAnuncio({ cards: [], maduroAteMs: MADURO });
  assert.deepEqual(r.anuncios, []);
  assert.equal(r.sem_utm_content, 0);
  assert.equal(r.nao_trafego_pago, 0);
});

test('espaco em volta do utm_content nao cria anuncio duplicado', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: ' ad15_x_vd ' }),
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  assert.equal(r.anuncios.length, 1);
  assert.equal(r.anuncios[0].leads_maduros, 2);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-leads-anuncio.test.js
```

Esperado: FAIL, `Cannot find module '../functions/api/_argo-leads-anuncio.js'`

- [ ] **Step 3: Escrever o módulo**

Criar `functions/api/_argo-leads-anuncio.js`:

```javascript
// Leads e MQLs agrupados por anúncio, para o Argo (spec 2026-09-20-argo-regua-de-dinheiro).
//
// O `utm_content` do card É o nome do anúncio no Meta — medido em 20/09: 85,9%
// dos leads de tráfego pago casam com um anúncio da conta. O Argo faz a junção;
// aqui só se agrupa.
//
// Janela de maturação: um lead de ontem ainda está na fila do comercial.
// Contá-lo como "não qualificou" mataria anúncio bom, então ele entra em
// `leads_recentes` e fica fora de `leads_maduros`/`qualificados`.
//
// Convenções do contrato, as mesmas de _cpl-calculo.js: contagens são números,
// nunca `null`; o que não é tráfego pago e o que não tem `utm_content` são
// contados à parte em vez de sumir.
//
// Módulo PURO. Prefixo "_": o Pages não transforma o arquivo em rota.

import { CU_FIELD } from './_clickup.js';
import { ehTrafegoPago, lerCampo } from './_feedback-marketing-crm.js';
import { ehMql } from './_feedback-marketing-mql.js';

export function agruparPorAnuncio({ cards = [], maduroAteMs } = {}) {
  const porAnuncio = new Map();
  let semUtmContent = 0;
  let naoTrafegoPago = 0;

  for (const card of cards) {
    const source = lerCampo(card, { id: CU_FIELD.utmSource });
    if (!ehTrafegoPago(source)) {
      naoTrafegoPago += 1;
      continue;
    }

    const content = String(lerCampo(card, { id: CU_FIELD.utmContent }) ?? '').trim();
    if (!content) {
      semUtmContent += 1;
      continue;
    }

    if (!porAnuncio.has(content)) {
      porAnuncio.set(content, {
        utm_content: content,
        leads_maduros: 0,
        qualificados: 0,
        leads_recentes: 0,
      });
    }
    const linha = porAnuncio.get(content);

    const criadoMs = Number(card.date_created);
    const maduro = Number.isFinite(criadoMs) && criadoMs <= maduroAteMs;

    if (!maduro) {
      linha.leads_recentes += 1;
      continue;
    }
    linha.leads_maduros += 1;
    if (ehMql(card)) linha.qualificados += 1;
  }

  return {
    anuncios: [...porAnuncio.values()],
    sem_utm_content: semUtmContent,
    nao_trafego_pago: naoTrafegoPago,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-leads-anuncio.test.js
```

Esperado: 6 testes pass.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
cd ~/OneDrive/tracking-avancado && npm test
```

Esperado: 756 anteriores + 6 novos, 0 falhas.

- [ ] **Step 6: Commit**

```bash
git add functions/api/_argo-leads-anuncio.js tests/argo-leads-anuncio.test.js
git commit -m "feat(argo): agrupa leads e MQLs por anuncio, com janela de maturacao"
```

---

### Task 2: Endpoint `/api/argo/leads-por-anuncio`

**Files:**
- Create: `functions/api/argo/leads-por-anuncio.js`
- Test: `tests/argo-leads-anuncio-auth.test.js`

**Interfaces:**
- Consumes: `agruparPorAnuncio` (Task 1); `exigirChave(request, env)` de `../_argo-auth.js`; `lerCardsCriadosNoPeriodo(env, { desde, ate })` de `../_feedback-marketing-crm.js`.
- Produces: `GET /api/argo/leads-por-anuncio?key=…&dias=N&maturacao_dias=M` → `{ anuncios, sem_utm_content, nao_trafego_pago, janela: { desde, ate, maduro_ate, maturacao_dias } }`.

- [ ] **Step 1: Ler a guarda que já existe**

```bash
cd ~/OneDrive/tracking-avancado && cat functions/api/_argo-auth.js
```

Use a mesma função dos outros dois endpoints do Argo. Não escreva guarda nova.

- [ ] **Step 2: Escrever o teste de autenticação que falha**

Criar `tests/argo-leads-anuncio-auth.test.js`, no mesmo formato de `tests/argo-auth.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/argo/leads-por-anuncio.js';

const env = { DASH_KEY: 'chave-certa' };

function req(qs) {
  return new Request(`https://exemplo.com/api/argo/leads-por-anuncio${qs}`);
}

test('sem chave devolve 401', async () => {
  const r = await onRequestGet({ request: req(''), env });
  assert.equal(r.status, 401);
});

test('chave errada devolve 401', async () => {
  const r = await onRequestGet({ request: req('?key=errada'), env });
  assert.equal(r.status, 401);
});

test('sem DASH_KEY no ambiente recusa, nao abre a porta', async () => {
  const r = await onRequestGet({ request: req('?key=qualquer'), env: {} });
  assert.equal(r.status, 401);
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-leads-anuncio-auth.test.js
```

Esperado: FAIL, módulo inexistente.

- [ ] **Step 4: Escrever o endpoint**

Criar `functions/api/argo/leads-por-anuncio.js`:

```javascript
// GET /api/argo/leads-por-anuncio?key=…&dias=N&maturacao_dias=M
//
// A metade do dado que o tracking tem: leads e MQLs por `utm_content`, que é o
// nome do anúncio no Meta. SEM gasto — o tracking só sincroniza o Meta em
// `level=campaign` (functions/api/sync/meta-ads.js), então quem tem gasto por
// anúncio é o Argo, que já consulta a Graph API com o token do profile. Ele faz
// a junção e mede a taxa de acerto dela.
//
// Janela de maturação: leads criados nos últimos `maturacao_dias` entram em
// `leads_recentes` e ficam fora da conta de qualificados.

import { exigirChave } from '../_argo-auth.js';
import { lerCardsCriadosNoPeriodo } from '../_feedback-marketing-crm.js';
import { agruparPorAnuncio } from '../_argo-leads-anuncio.js';

const DIA_MS = 86400000;

function inteiroNaFaixa(bruto, padrao, minimo, maximo) {
  const n = Number.parseInt(bruto ?? '', 10);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, minimo), maximo);
}

export async function onRequestGet({ request, env }) {
  const naoAutorizado = exigirChave(request, env);
  if (naoAutorizado) return naoAutorizado;

  const url = new URL(request.url);
  const dias = inteiroNaFaixa(url.searchParams.get('dias'), 30, 1, 92);
  const maturacaoDias = inteiroNaFaixa(url.searchParams.get('maturacao_dias'), 5, 0, 30);

  const agora = Date.now();
  const desde = agora - dias * DIA_MS;
  const maduroAte = agora - maturacaoDias * DIA_MS;

  try {
    const cards = await lerCardsCriadosNoPeriodo(env, { desde, ate: agora });
    const agrupado = agruparPorAnuncio({ cards, maduroAteMs: maduroAte });
    return Response.json({
      ...agrupado,
      janela: {
        desde: new Date(desde).toISOString(),
        ate: new Date(agora).toISOString(),
        maduro_ate: new Date(maduroAte).toISOString(),
        maturacao_dias: maturacaoDias,
      },
    });
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler os leads por anúncio agora.' },
      { status: 500 },
    );
  }
}
```

**Se `exigirChave` tiver outra assinatura**, adapte a chamada ao que o arquivo realmente exporta — e **não** duplique a lógica da guarda.

- [ ] **Step 5: Rodar e ver passar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-leads-anuncio-auth.test.js && npm test
```

Esperado: 3 novos pass; suíte inteira verde.

- [ ] **Step 6: Verificar contra o CRM real**

```bash
cd ~/OneDrive/tracking-avancado && npx wrangler pages dev . --port 8788
```

**Armadilha conhecida:** o worktree não tem `wrangler.toml` (gitignorado); sem copiá-lo do repositório principal, o servidor carrega o `.env` de lá e mascara as variáveis. Copie temporariamente e apague depois.

Noutro terminal, com a `DASH_KEY` do `.dev.vars`:

```bash
curl -s "localhost:8788/api/argo/leads-por-anuncio?key=SUA_CHAVE&dias=30&maturacao_dias=5" | head -c 900
```

Esperado: lista de anúncios com `utm_content` no formato `adNN_slug_tipo`, contagens coerentes, e `sem_utm_content` baixo — medido em 20/09, **zero** leads de tráfego pago sem `utm_content`.

- [ ] **Step 7: Commit**

```bash
git add functions/api/argo/leads-por-anuncio.js tests/argo-leads-anuncio-auth.test.js
git commit -m "feat(argo): endpoint de leads e MQLs por anuncio, autenticado"
```

---

### Task 3: Módulo Python que junta gasto e leads

**Files:**
- Create: `profiles/gestor-ia/scripts/argo_anuncios.py` (repo `gestor-ae`)
- Test: `profiles/gestor-ia/scripts/test_argo_anuncios.py`

**Interfaces:**
- Consumes: o endpoint da Task 2; `meta_token()` de `ae_trafego_monitor`.
- Produces:
  - `gasto_por_anuncio(desde, ate) -> dict[str, dict]` — por nome de anúncio: `{"gasto": float, "ad_ids": [str], "impressoes": int}`. **Agrega homônimos.**
  - `juntar(gastos, leads) -> dict` — `{"linhas": [...], "taxa_juncao": float|None, "orfaos": [...]}`.
  - `candidatos_a_pausa(juncao, piso_gasto, piso_juncao) -> list[dict]`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `profiles/gestor-ia/scripts/test_argo_anuncios.py`:

```python
import unittest

import argo_anuncios as a


GASTOS = {
    "ad15_x_vd": {"gasto": 450.0, "ad_ids": ["1"], "impressoes": 9000},
    "ad14_y_vd": {"gasto": 300.0, "ad_ids": ["2", "3"], "impressoes": 7000},
    "ad01_z_vd": {"gasto": 20.0, "ad_ids": ["4"], "impressoes": 400},
}

LEADS = {
    "anuncios": [
        {"utm_content": "ad15_x_vd", "leads_maduros": 5, "qualificados": 0, "leads_recentes": 1},
        {"utm_content": "ad14_y_vd", "leads_maduros": 4, "qualificados": 3, "leads_recentes": 0},
        {"utm_content": "ad13_renomeado_img", "leads_maduros": 8, "qualificados": 5, "leads_recentes": 0},
    ],
    "sem_utm_content": 0,
    "nao_trafego_pago": 2,
}


class TestJuntar(unittest.TestCase):
    def test_taxa_de_juncao_ignora_leads_orfaos_no_numerador(self):
        j = a.juntar(GASTOS, LEADS)
        # 9 de 17 leads maduros casaram (5 + 4); 8 ficaram órfãos no rename.
        self.assertAlmostEqual(j["taxa_juncao"], 9 / 17, places=4)

    def test_orfao_e_listado_e_nunca_vira_anuncio(self):
        j = a.juntar(GASTOS, LEADS)
        nomes = {l["nome"] for l in j["linhas"]}
        self.assertNotIn("ad13_renomeado_img", nomes)
        self.assertIn("ad13_renomeado_img", {o["utm_content"] for o in j["orfaos"]})

    def test_anuncio_sem_lead_nenhum_aparece_com_zero_nao_some(self):
        j = a.juntar(GASTOS, LEADS)
        linha = next(l for l in j["linhas"] if l["nome"] == "ad01_z_vd")
        self.assertEqual(linha["leads_maduros"], 0)
        self.assertEqual(linha["qualificados"], 0)

    def test_homonimos_carregam_todos_os_ad_ids(self):
        j = a.juntar(GASTOS, LEADS)
        linha = next(l for l in j["linhas"] if l["nome"] == "ad14_y_vd")
        self.assertEqual(sorted(linha["ad_ids"]), ["2", "3"])

    def test_sem_lead_nenhum_a_taxa_e_none_nao_zero(self):
        j = a.juntar(GASTOS, {"anuncios": [], "sem_utm_content": 0, "nao_trafego_pago": 0})
        self.assertIsNone(j["taxa_juncao"])


class TestCandidatos(unittest.TestCase):
    def test_gastou_acima_do_piso_e_zero_qualificados_e_candidato(self):
        j = a.juntar(GASTOS, LEADS)
        c = a.candidatos_a_pausa(j, piso_gasto=100.0, piso_juncao=0.5)
        self.assertEqual([x["nome"] for x in c], ["ad15_x_vd"])

    def test_abaixo_do_piso_de_gasto_nao_e_candidato(self):
        j = a.juntar(GASTOS, LEADS)
        c = a.candidatos_a_pausa(j, piso_gasto=500.0, piso_juncao=0.5)
        self.assertEqual(c, [])

    def test_com_qualificado_nunca_e_candidato(self):
        j = a.juntar(GASTOS, LEADS)
        c = a.candidatos_a_pausa(j, piso_gasto=1.0, piso_juncao=0.5)
        self.assertNotIn("ad14_y_vd", [x["nome"] for x in c])

    def test_juncao_abaixo_do_piso_suspende_tudo(self):
        j = a.juntar(GASTOS, LEADS)
        c = a.candidatos_a_pausa(j, piso_gasto=100.0, piso_juncao=0.9)
        self.assertEqual(c, [])

    def test_sem_lead_maduro_nenhum_nao_e_candidato_por_falta_de_dado(self):
        # Anúncio que gastou muito mas cujos leads são todos recentes: não dá
        # para dizer que não trouxe nada — só que ainda não se sabe.
        leads = {
            "anuncios": [
                {"utm_content": "ad15_x_vd", "leads_maduros": 0, "qualificados": 0, "leads_recentes": 6},
            ],
            "sem_utm_content": 0,
            "nao_trafego_pago": 0,
        }
        j = a.juntar({"ad15_x_vd": {"gasto": 900.0, "ad_ids": ["1"], "impressoes": 9000}}, leads)
        self.assertEqual(a.candidatos_a_pausa(j, piso_gasto=100.0, piso_juncao=0.0), [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_argo_anuncios -v'
```

Esperado: FAIL, `ModuleNotFoundError: No module named 'argo_anuncios'`

- [ ] **Step 3: Escrever o módulo**

Criar `profiles/gestor-ia/scripts/argo_anuncios.py`:

```python
"""Junta gasto por anúncio (Meta) com leads e MQLs por anúncio (tracking).

O `utm_content` do lead É o nome do anúncio no Meta. Medido em 2026-09-20:
85,9% dos leads de tráfego pago casam. Os 10 órfãos daquela amostra vieram
quase todos de UM rename — `ad13_tweet-se_img` virou `ad13_tweet-se-322_img`.

Por isso duas regras que não são negociáveis aqui:
  - lead órfão nunca conta contra um anúncio (seria punir um rename);
  - a taxa de junção sai desta função e vai para a tela, porque é o único jeito
    de a degradação por rename não ser silenciosa.

Nomes de anúncio NÃO são únicos: 92 anúncios, 48 nomes. A junção agrega por
nome, e cada linha carrega todos os `ad_ids` daquele nome — pausar significa
pausar todos, senão a tela e a realidade discordam.
"""
import json
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ENV_PATH = Path("/root/.hermes/profiles/gestor-ia/.env")
BASE_TRACKING = "https://atacadoexponencial.com"
CONTA_META = "act_4577256079174658"


def _env(chave: str) -> str:
    valor = os.environ.get(chave, "")
    if valor:
        return valor
    if ENV_PATH.exists():
        for linha in ENV_PATH.read_text(errors="ignore").splitlines():
            if linha.startswith(chave + "="):
                return linha.split("=", 1)[1].strip().strip("\"'")
    return ""


def gasto_por_anuncio(desde: str, ate: str) -> dict[str, dict[str, Any]]:
    """Gasto por NOME de anúncio no período (YYYY-MM-DD), agregando homônimos."""
    import requests

    token = _env("META_ACCESS_TOKEN_PERSONAL") or _env("META_ACCESS_TOKEN")
    url = f"https://graph.facebook.com/v21.0/{CONTA_META}/insights"
    params = {
        "level": "ad",
        "fields": "ad_id,ad_name,spend,impressions",
        "time_range": json.dumps({"since": desde, "until": ate}),
        "limit": 500,
        "access_token": token,
    }
    saida: dict[str, dict[str, Any]] = {}
    while url:
        resposta = requests.get(url, params=params, timeout=60)
        resposta.raise_for_status()
        corpo = resposta.json()
        for linha in corpo.get("data", []):
            nome = (linha.get("ad_name") or "").strip()
            if not nome:
                continue
            item = saida.setdefault(nome, {"gasto": 0.0, "ad_ids": [], "impressoes": 0})
            item["gasto"] += float(linha.get("spend") or 0)
            item["impressoes"] += int(float(linha.get("impressions") or 0))
            ad_id = str(linha.get("ad_id") or "")
            if ad_id and ad_id not in item["ad_ids"]:
                item["ad_ids"].append(ad_id)
        url = (corpo.get("paging") or {}).get("next")
        params = None
    return saida


def ler_leads_por_anuncio(dias: int = 30, maturacao_dias: int = 5) -> dict[str, Any]:
    """Chama o endpoint do tracking. Nunca imprime a chave."""
    chave = _env("DASH_KEY")
    if not chave:
        raise RuntimeError("DASH_KEY ausente no .env do profile")
    qs = urllib.parse.urlencode(
        {"key": chave, "dias": dias, "maturacao_dias": maturacao_dias}
    )
    req = urllib.request.Request(
        f"{BASE_TRACKING}/api/argo/leads-por-anuncio?{qs}",
        headers={"User-Agent": "hermes-argo/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except Exception as exc:  # noqa: BLE001
        # A URL carrega a chave; nunca deixe a exceção original subir.
        raise RuntimeError("falha ao ler leads por anúncio no tracking") from None


def juntar(gastos: dict[str, dict[str, Any]], leads: dict[str, Any]) -> dict[str, Any]:
    """Cruza os dois lados por nome. Órfão fica de fora das linhas, sempre."""
    por_nome = {
        str(a.get("utm_content") or "").strip(): a for a in leads.get("anuncios", [])
    }

    linhas = []
    for nome, gasto in gastos.items():
        lead = por_nome.get(nome)
        linhas.append(
            {
                "nome": nome,
                "ad_ids": list(gasto.get("ad_ids") or []),
                "gasto": round(float(gasto.get("gasto") or 0), 2),
                "impressoes": int(gasto.get("impressoes") or 0),
                "leads_maduros": int(lead["leads_maduros"]) if lead else 0,
                "qualificados": int(lead["qualificados"]) if lead else 0,
                "leads_recentes": int(lead["leads_recentes"]) if lead else 0,
            }
        )

    orfaos = [
        {"utm_content": nome, "leads_maduros": int(a.get("leads_maduros") or 0)}
        for nome, a in por_nome.items()
        if nome not in gastos
    ]

    casados = sum(l["leads_maduros"] for l in linhas)
    total = casados + sum(o["leads_maduros"] for o in orfaos)
    taxa = (casados / total) if total else None

    linhas.sort(key=lambda l: l["gasto"], reverse=True)
    return {"linhas": linhas, "taxa_juncao": taxa, "orfaos": orfaos}


def candidatos_a_pausa(
    juncao: dict[str, Any], piso_gasto: float, piso_juncao: float
) -> list[dict[str, Any]]:
    """Anúncio que gastou acima do piso e trouxe ZERO qualificados maduros.

    Não é ranking: com ~12 leads e 7 MQLs por semana espalhados entre os
    anúncios, a diferença entre 1 e 2 qualificados é ruído. Zero sobrevive a
    amostra pequena.
    """
    taxa = juncao.get("taxa_juncao")
    if taxa is None or taxa < piso_juncao:
        return []

    saida = []
    for linha in juncao.get("linhas", []):
        if linha["gasto"] < piso_gasto:
            continue
        if linha["leads_maduros"] <= 0:
            # Gastou, mas nenhum lead teve tempo de qualificar: não se sabe.
            continue
        if linha["qualificados"] > 0:
            continue
        saida.append(
            {
                **linha,
                "motivo": (
                    f"gastou R$ {linha['gasto']:.2f} e trouxe "
                    f"{linha['leads_maduros']} lead(s) maduro(s), nenhum qualificado"
                ),
            }
        )
    return saida
```

- [ ] **Step 4: Copiar para a VPS, rodar e ver passar**

```bash
scp ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/argo_anuncios.py ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/test_argo_anuncios.py root@31.97.241.169:/root/.hermes/profiles/gestor-ia/scripts/
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_argo_anuncios -v'
```

Esperado: 10 testes OK.

- [ ] **Step 5: Medir a junção contra dados reais**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -c "
import argo_anuncios as a, datetime
hoje = datetime.date.today()
desde = (hoje - datetime.timedelta(days=30)).isoformat()
g = a.gasto_por_anuncio(desde, hoje.isoformat())
l = a.ler_leads_por_anuncio(dias=30, maturacao_dias=5)
j = a.juntar(g, l)
print(\"anuncios com gasto:\", len(g))
print(\"taxa de juncao:\", j[\"taxa_juncao\"])
print(\"orfaos:\", j[\"orfaos\"])
for linha in j[\"linhas\"][:6]:
    print(\" \", linha[\"nome\"], \"| R$\", linha[\"gasto\"], \"| maduros\", linha[\"leads_maduros\"], \"| qualif\", linha[\"qualificados\"])
"'
```

Esperado: taxa próxima de 0,86 — a medida de 20/09. **Se vier muito abaixo, pare e relate**: significa que a convenção de nomes mudou, e nenhuma régua deve rodar sobre junção ruim.

- [ ] **Step 6: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/argo_anuncios.py profiles/gestor-ia/scripts/test_argo_anuncios.py
git commit -m "feat(argo): junta gasto por anuncio com leads e MQLs, medindo a juncao"
```

---

### Task 4: A rodada de anúncios grava na Neon

**Files:**
- Create: `profiles/gestor-ia/scripts/ae_anuncios_monitor.py` (repo `gestor-ae`)
- Test: `profiles/gestor-ia/scripts/test_ae_anuncios_monitor.py`

**Interfaces:**
- Consumes: `argo_anuncios` (Task 3); `argo_estado.abrir_rodada / fechar_rodada / ler_grade / pode_executar` (plano 1).
- Produces: uma linha em `argo.rodadas` com `executor = "ae_anuncios_monitor"`, uma linha em `argo.propostas` por candidato, e o relatório em stdout.

- [ ] **Step 1: Escrever o teste que falha**

Criar `profiles/gestor-ia/scripts/test_ae_anuncios_monitor.py`:

```python
import unittest
from unittest import mock

import ae_anuncios_monitor as m


JUNCAO = {
    "linhas": [
        {"nome": "ad15_x_vd", "ad_ids": ["1"], "gasto": 450.0, "impressoes": 9000,
         "leads_maduros": 5, "qualificados": 0, "leads_recentes": 1},
    ],
    "taxa_juncao": 0.86,
    "orfaos": [],
}


class TestPropostaNuncaExecuta(unittest.TestCase):
    def test_candidato_vira_proposta_e_nunca_pausa(self):
        registradas = []
        with mock.patch("argo_estado.abrir_rodada", return_value=7), \
             mock.patch("argo_estado.fechar_rodada"), \
             mock.patch("argo_estado.registrar_proposta",
                        side_effect=lambda **k: registradas.append(k) or 1), \
             mock.patch.object(m, "_juncao_do_periodo", return_value=JUNCAO), \
             mock.patch.object(m, "_pausar_anuncio") as pausar:
            texto = m.build_report()
        pausar.assert_not_called()
        self.assertEqual(len(registradas), 1)
        self.assertEqual(registradas[0]["tipo"], "pausar_anuncio")
        self.assertIn("ad15_x_vd", texto)

    def test_taxa_de_juncao_aparece_sempre_no_relatorio(self):
        with mock.patch("argo_estado.abrir_rodada", return_value=7), \
             mock.patch("argo_estado.fechar_rodada"), \
             mock.patch("argo_estado.registrar_proposta", return_value=1), \
             mock.patch.object(m, "_juncao_do_periodo", return_value=JUNCAO):
            texto = m.build_report()
        self.assertIn("86", texto)  # 86% de junção

    def test_sem_rodada_nao_registra_proposta(self):
        with mock.patch("argo_estado.abrir_rodada", side_effect=RuntimeError("neon fora")), \
             mock.patch("argo_estado.registrar_proposta") as prop, \
             mock.patch.object(m, "_juncao_do_periodo", return_value=JUNCAO):
            texto = m.build_report()
        prop.assert_not_called()
        self.assertIn("não registrada", texto)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_anuncios_monitor -v'
```

Esperado: FAIL, módulo inexistente.

- [ ] **Step 3: Acrescentar `registrar_proposta` ao `argo_estado.py`**

O plano 1 criou a tabela `argo.propostas` e nunca escreveu nela. Acrescente ao `argo_estado.py`, no mesmo estilo de `registrar_acao`:

```python
def registrar_proposta(
    rodada_id: int,
    conta: str,
    tipo: str,
    alvo_tipo: str,
    alvo_id: str,
    alvo_nome: str | None,
    motivo: str,
    detalhe: dict[str, Any],
    vence_em_horas: int = 72,
) -> int:
    """Grava uma proposta pendente. Propor nunca executa nada."""
    import json

    with _conectar() as con, con.cursor() as cur:
        cur.execute(
            """
            INSERT INTO argo.propostas
              (rodada_id, conta, tipo, alvo_tipo, alvo_id, alvo_nome, motivo,
               detalhe, vence_em)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb, now() + make_interval(hours => %s))
            RETURNING id
            """,
            (
                rodada_id, conta, tipo, alvo_tipo, alvo_id, alvo_nome, motivo,
                json.dumps(detalhe, ensure_ascii=False), vence_em_horas,
            ),
        )
        return cur.fetchone()[0]
```

Acrescente também, em `test_argo_estado.py`, um teste no formato dos existentes afirmando que `registrar_proposta` propaga falha de conexão **sem** fragmento de credencial na mensagem.

- [ ] **Step 4: Escrever o monitor**

Criar `profiles/gestor-ia/scripts/ae_anuncios_monitor.py`. O alvo de uma proposta é o **nome** do anúncio, e `detalhe` carrega todos os `ad_ids` — pausar significa pausar todos:

```python
#!/usr/bin/env python3
"""Rodada de anúncios: quem gastou e não trouxe ninguém qualificado.

NÃO PAUSA NADA. Só propõe — `pausar_anuncio` nasce em `propor` e a esteira é
quem executa, depois de a gestora aprovar na aba.

A taxa de junção vai SEMPRE no relatório, mesmo quando está boa: é o único
sinal de que um rename em massa degradou a atribuição, e sem ele a degradação
é silenciosa.
"""
import datetime
import sys

CONTA = "atacado-exponencial"
PISO_GASTO = 100.0
PISO_JUNCAO = 0.60
JANELA_DIAS = 30
MATURACAO_DIAS = 5


def _juncao_do_periodo():
    import argo_anuncios

    hoje = datetime.date.today()
    desde = (hoje - datetime.timedelta(days=JANELA_DIAS)).isoformat()
    gastos = argo_anuncios.gasto_por_anuncio(desde, hoje.isoformat())
    leads = argo_anuncios.ler_leads_por_anuncio(
        dias=JANELA_DIAS, maturacao_dias=MATURACAO_DIAS
    )
    return argo_anuncios.juntar(gastos, leads)


def _pausar_anuncio(ad_id: str):
    """Existe só para o teste provar que NUNCA é chamada nesta rodada."""
    raise AssertionError("esta rodada não pausa; a esteira executa após aprovação")


def build_report() -> str:
    import argo_anuncios
    import argo_estado

    juncao = _juncao_do_periodo()

    try:
        rodada_id = argo_estado.abrir_rodada(
            conta=CONTA,
            executor="ae_anuncios_monitor",
            leitura={
                "taxa_juncao": juncao["taxa_juncao"],
                "orfaos": len(juncao["orfaos"]),
                "janela_dias": JANELA_DIAS,
                "maturacao_dias": MATURACAO_DIAS,
            },
        )
    except Exception as exc:  # noqa: BLE001
        rodada_id = None
        print(f"aviso: rodada não registrada ({type(exc).__name__}: {exc})", file=sys.stderr)

    linhas = [f"*AE anúncios | {datetime.date.today():%d/%m}*", ""]

    taxa = juncao["taxa_juncao"]
    if taxa is None:
        linhas.append("Junção: sem lead maduro no período — nada a avaliar.")
    else:
        linhas.append(f"Junção lead→anúncio: {taxa * 100:.0f}%")
        if juncao["orfaos"]:
            nomes = ", ".join(o["utm_content"] for o in juncao["orfaos"][:3])
            linhas.append(f"  Órfãos (anúncio renomeado ou apagado): {nomes}")

    if rodada_id is None:
        linhas.append("")
        linhas.append(
            "⚠️ Rodada não registrada no banco: o painel não vai mostrar esta "
            "execução e nenhuma proposta foi gravada."
        )

    linhas.append("")
    linhas.append("*Maiores gastos*")
    for linha in juncao["linhas"][:6]:
        linhas.append(
            f"• {linha['nome']} — R$ {linha['gasto']:.2f} | "
            f"{linha['leads_maduros']} maduro(s), {linha['qualificados']} qualificado(s)"
        )

    candidatos = argo_anuncios.candidatos_a_pausa(juncao, PISO_GASTO, PISO_JUNCAO)
    linhas.append("")
    if taxa is not None and taxa < PISO_JUNCAO:
        linhas.append(
            f"Não proponho pausa: junção de {taxa * 100:.0f}% está abaixo do "
            f"piso de {PISO_JUNCAO * 100:.0f}%. Dado ruim não vira ação."
        )
    elif not candidatos:
        linhas.append("Nenhum anúncio gastou acima do piso sem trazer qualificado.")
    else:
        linhas.append("*Propostas de pausa* (aprovação na aba Argo)")
        for c in candidatos:
            linhas.append(f"• {c['nome']} — {c['motivo']}")
            if rodada_id is not None:
                argo_estado.registrar_proposta(
                    rodada_id=rodada_id,
                    conta=CONTA,
                    tipo="pausar_anuncio",
                    alvo_tipo="anuncio",
                    alvo_id=c["nome"],
                    alvo_nome=c["nome"],
                    motivo=c["motivo"],
                    detalhe={
                        "ad_ids": c["ad_ids"],
                        "gasto": c["gasto"],
                        "leads_maduros": c["leads_maduros"],
                        "qualificados": c["qualificados"],
                    },
                )

    if rodada_id is not None:
        try:
            argo_estado.fechar_rodada(rodada_id, ok=True, conclusao=linhas[-1])
        except Exception as exc:  # noqa: BLE001
            linhas.append(f"aviso: falhei ao fechar a rodada ({type(exc).__name__}: {exc})")

    return "\n".join(linhas)


def main() -> int:
    try:
        print(build_report())
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Rodar os testes e ver passar**

```bash
scp ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/ae_anuncios_monitor.py ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/test_ae_anuncios_monitor.py ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/argo_estado.py ~/OneDrive/gestor-ae/profiles/gestor-ia/scripts/test_argo_estado.py root@31.97.241.169:/root/.hermes/profiles/gestor-ia/scripts/
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest discover -v 2>&1 | tail -5'
```

Esperado: os 27 do plano 1 + 10 da Task 3 + 3 desta + 1 de `registrar_proposta`, 0 falhas.

- [ ] **Step 6: Rodar de verdade e conferir na Neon**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python ae_anuncios_monitor.py'
```

Esperado: relatório com a taxa de junção, os maiores gastos, e propostas ou a frase de "nenhum anúncio". Depois, confirmar que a rodada e as propostas foram gravadas:

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -c "
import argo_estado
with argo_estado._conectar() as c, c.cursor() as k:
    k.execute(\"SELECT id, executor, ok FROM argo.rodadas WHERE executor=%s ORDER BY id DESC LIMIT 2\", (\"ae_anuncios_monitor\",))
    print(k.fetchall())
    k.execute(\"SELECT tipo, alvo_nome, decisao FROM argo.propostas ORDER BY id DESC LIMIT 5\")
    print(k.fetchall())
"'
```

**Confirme que nenhuma campanha ou anúncio foi pausado**: esta rodada só propõe.

- [ ] **Step 7: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/ae_anuncios_monitor.py profiles/gestor-ia/scripts/test_ae_anuncios_monitor.py profiles/gestor-ia/scripts/argo_estado.py profiles/gestor-ia/scripts/test_argo_estado.py
git commit -m "feat(argo): rodada de anuncios propoe pausa por zero qualificados"
```

---

### Task 5: A referência de custo por visita se recalcula sozinha

**Files:**
- Modify: `profiles/gestor-ia/scripts/ae_trafego_monitor.py` (a leitura de `reference_cpv`)
- Test: `profiles/gestor-ia/scripts/test_ae_trafego_referencia.py`

**Interfaces:**
- Consumes: `campaign_metrics` e `active_traffic_campaigns`, que já existem no arquivo.
- Produces: `referencia_automatica(metricas_por_janela) -> float | None`, e `load_config` passa a usar a referência calculada quando houver histórico suficiente.

- [ ] **Step 1: Escrever o teste que falha**

Criar `profiles/gestor-ia/scripts/test_ae_trafego_referencia.py`:

```python
import unittest

import ae_trafego_monitor as m


class TestReferenciaAutomatica(unittest.TestCase):
    def test_referencia_e_investimento_dividido_por_visitas(self):
        r = m.referencia_automatica({"spend": 92.27, "visitas": 644})
        self.assertAlmostEqual(r, 0.1433, places=4)

    def test_sem_visita_devolve_none_nao_zero(self):
        self.assertIsNone(m.referencia_automatica({"spend": 50.0, "visitas": 0}))

    def test_sem_gasto_devolve_none(self):
        self.assertIsNone(m.referencia_automatica({"spend": 0.0, "visitas": 100}))

    def test_entrada_malformada_devolve_none_nunca_estoura(self):
        self.assertIsNone(m.referencia_automatica({}))
        self.assertIsNone(m.referencia_automatica(None))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_trafego_referencia -v'
```

Esperado: FAIL, `AttributeError: module 'ae_trafego_monitor' has no attribute 'referencia_automatica'`

- [ ] **Step 3: Escrever a função e ligá-la ao `load_config`**

Acrescentar ao `ae_trafego_monitor.py`:

```python
def referencia_automatica(janela) -> float | None:
    """Custo por visita do próprio histórico da conta, no mesmo método do campo
    manual que ela substitui: investimento ÷ link_clicks.

    Devolve None sem histórico utilizável — e None significa "usa a referência
    salva", nunca "referência zero". A referência ficou congelada em R$ 0,3004
    de julho até 20/09 enquanto a conta rodava a R$ 0,14; esta função existe
    para isso não acontecer de novo.
    """
    if not isinstance(janela, dict):
        return None
    try:
        gasto = float(janela.get("spend") or 0)
        visitas = int(janela.get("visitas") or 0)
    except (TypeError, ValueError):
        return None
    if gasto <= 0 or visitas <= 0:
        return None
    return round(gasto / visitas, 4)
```

Em `load_config`, depois de a configuração do markdown ser lida, sobrescreva `reference_cpv` **apenas quando** a referência automática existir, e registre a origem:

```python
    automatica = referencia_automatica(config.get("_janela_referencia"))
    if automatica is not None:
        config["reference_cpv"] = automatica
        config["reference_origem"] = "automatica"
    else:
        config["reference_origem"] = "salva"
```

A janela de referência é a mesma já calculada em `build_report` para a comparação de 7 dias; passe-a por `config["_janela_referencia"]` antes da chamada, ou calcule-a dentro de `load_config` se for mais simples — **sem alterar a lógica de candidatura a pausa**.

- [ ] **Step 4: Rodar e ver passar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest discover -v 2>&1 | tail -5'
```

Esperado: a suíte inteira verde, incluindo os 4 novos.

- [ ] **Step 5: Verificar na conta real — e é o passo que importa**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python ae_trafego_monitor.py'
```

Compare a linha final sobre pausas com o último arquivo de `/root/.hermes/profiles/gestor-ia/cron/output/191d4eb26d3c/`. **Se aparecer pausa nova, pare e relate** — a referência automática é mais apertada que a salva, e apertar a régua não pode pausar campanha por efeito colateral de um refactor.

- [ ] **Step 6: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/ae_trafego_monitor.py profiles/gestor-ia/scripts/test_ae_trafego_referencia.py
git commit -m "feat(argo): referencia de custo por visita sai do historico, nao congela"
```

---

### Task 6: A aba mostra desempenho por anúncio e as propostas

**Files:**
- Modify: `functions/api/_argo-registro.js` (expor propostas e a leitura da rodada)
- Modify: `functions/api/argo/registro.js` (consultar `argo.propostas`)
- Modify: `public/dash/index.html` (seção `secao-argo`)
- Test: `tests/argo-registro.test.js`

**Interfaces:**
- Consumes: `montarRegistro({ rodadas, acoes })` já existente.
- Produces: `montarRegistro({ rodadas, acoes, propostas })` — cada rodada ganha `propostas: [...]`, e `cabecalho` ganha `taxa_juncao` lida de `leitura.taxa_juncao` da rodada mais recente que a tiver.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/argo-registro.test.js`:

```javascript
test('cada rodada recebe as propostas dela', () => {
  const r = montarRegistro({
    rodadas: [
      { id: 3, executor: 'ae_anuncios_monitor', iniciada_em: '2026-09-21T11:50:00Z', ok: true, conclusao: 'x', leitura: { taxa_juncao: 0.86 } },
    ],
    acoes: [],
    propostas: [
      { id: 1, rodada_id: 3, tipo: 'pausar_anuncio', alvo_nome: 'ad15_x_vd', motivo: 'gastou e nao trouxe', decisao: null, vence_em: '2026-09-24T11:50:00Z' },
    ],
  });
  assert.equal(r.rodadas[0].propostas.length, 1);
  assert.equal(r.rodadas[0].propostas[0].alvo_nome, 'ad15_x_vd');
});

test('cabecalho carrega a taxa de juncao da rodada mais recente que a tiver', () => {
  const r = montarRegistro({
    rodadas: [
      { id: 4, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-21T11:50:00Z', ok: true, conclusao: 'x', leitura: { origem_permissao: 'neon' } },
      { id: 3, executor: 'ae_anuncios_monitor', iniciada_em: '2026-09-21T11:40:00Z', ok: true, conclusao: 'x', leitura: { taxa_juncao: 0.86 } },
    ],
    acoes: [],
    propostas: [],
  });
  assert.equal(r.cabecalho.taxa_juncao, 0.86);
});

test('sem taxa de juncao em rodada nenhuma o cabecalho devolve null, nao zero', () => {
  const r = montarRegistro({
    rodadas: [{ id: 4, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-21T11:50:00Z', ok: true, conclusao: 'x', leitura: {} }],
    acoes: [],
    propostas: [],
  });
  assert.equal(r.cabecalho.taxa_juncao, null);
});

test('propostas continua opcional: chamada sem ela nao quebra', () => {
  const r = montarRegistro({ rodadas: [], acoes: [] });
  assert.deepEqual(r.rodadas, []);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-registro.test.js
```

Esperado: FAIL nos quatro novos.

- [ ] **Step 3: Estender o módulo**

Em `functions/api/_argo-registro.js`, acrescentar `CAMPOS_PROPOSTA` no mesmo espírito de `CAMPOS_ACAO` (lista congelada, fonte única do `SELECT`), agrupar propostas por `rodada_id` como já se faz com ações, e acrescentar ao cabeçalho:

```javascript
  // A taxa de junção só existe nas rodadas de anúncio; procura a mais recente
  // que a tenha, em vez de olhar só a primeira rodada da lista.
  const comTaxa = rodadas.find((r) => typeof r?.leitura?.taxa_juncao === 'number');
  // ...
      taxa_juncao: comTaxa ? comTaxa.leitura.taxa_juncao : null,
```

- [ ] **Step 4: Estender o endpoint**

Em `functions/api/argo/registro.js`, consultar `argo.propostas` para as mesmas rodadas, montando o `SELECT` a partir de `CAMPOS_PROPOSTA` e com `LIMIT` explícito, no mesmo padrão já usado para `argo.acoes`.

- [ ] **Step 5: Desenhar na aba**

Em `public/dash/index.html`, na seção `secao-argo`:

- no cabeçalho, quando `cabecalho.taxa_juncao` não for nulo, mostrar "Junção lead→anúncio: N%" — e destacar quando estiver abaixo de 60%, porque abaixo disso o Argo não propõe;
- em cada rodada, listar as propostas com alvo, motivo e validade;
- usar `esc()` em todo texto vindo do banco, como o resto da aba.

A aba **não** decide nada: agrupamento, taxa e classificação vêm prontos.

- [ ] **Step 6: Rodar tudo e verificar na tela**

```bash
cd ~/OneDrive/tracking-avancado && npm test
npx wrangler pages dev . --port 8788
```

Abrir `localhost:8788/dash/#argo` e confirmar: a taxa de junção aparece no cabeçalho, e a rodada de anúncios aparece com suas propostas. **Armadilha do `wrangler.toml`** como na Task 2.

- [ ] **Step 7: Commit**

```bash
git add functions/api/_argo-registro.js functions/api/argo/registro.js public/dash/index.html tests/argo-registro.test.js
git commit -m "feat(argo): aba mostra taxa de juncao e propostas de pausa de anuncio"
```

---

## Divergência declarada da spec

A spec dizia que o `objetivos.md` da conta ganharia os pisos — de gasto, de
junção, e as janelas. Neste plano eles são **constantes no topo do
`ae_anuncios_monitor.py`**, não campos de arquivo.

O motivo: a lição do plano 1 foi que **medida** guardada em campo manual
congela — a referência de custo por visita ficou dois meses errada. Piso não é
medida, é política: muda raramente e de propósito. Pô-lo num arquivo que
ninguém revisa recria o problema que a Task 5 existe para resolver, sem
benefício. Quando houver motivo para a gestora mexer nos pisos sem deploy, eles
vão para a grade na Neon, junto com o resto da configuração — não para um
markdown.

## O que este plano não faz

Aprovar ou rejeitar proposta pela aba, e executar a pausa aprovada — isso é o
plano 3, junto com realocar verba, aumentar orçamento e o desfazer. Aqui as
propostas são gravadas e exibidas; a decisão continua sendo conversada.

Também fora: o cron desta rodada (criar depois de algumas execuções manuais
darem confiança), o piso de R$ 100 do gatilho de tráfego, e incluir `{{ad.id}}`
no template de UTM — que resolveria o rename na origem, mas é configuração na
conta de anúncios, não código.

**Pendência herdada do plano 1 que vira pré-requisito se esta aba ganhar campo
de configuração:** o campo de dinheiro depende da locale do navegador; em locale
não-pt-BR, `100,00` vira R$ 10.000.

# Argo — Fundação: memória, grade e aba Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar memória consultável e controle pela tela ao que o Argo já faz sozinho na conta do Atacado Exponencial — sem tocar na lógica que decide o que pausar.

**Architecture:** Absorção pela borda. O `ae_trafego_monitor.py`, que roda todo dia útil às 8h50 e pausa campanhas de verdade, mantém a lógica de decisão intacta; muda só a entrada (passa a ler a grade de permissões de um schema `argo` na Neon, com o markdown atual como fallback) e a saída (passa a gravar cada rodada e cada ação nesse mesmo schema, além do output do cron que já existe). Uma aba nova no dash lê esse estado por Functions do Cloudflare Pages e escreve só na grade.

**Tech Stack:** Python 3 (VPS, `/root/.hermes/profiles/gestor-ia/`), `psycopg[binary]` em venv; Postgres na Neon (banco `neondb`, schema novo `argo`); Cloudflare Pages Functions com `@neondatabase/serverless`; testes com `node --test` (JS, padrão do repositório) e `python3 -m unittest` (stdlib).

**Spec:** `docs/superpowers/specs/2026-09-20-argo-controle-ae-design.md`

## Global Constraints

- **A lógica de decisão do `ae_trafego_monitor.py` não é reescrita.** Só `load_config()` (entrada) e o laço de pausas (saída) são tocados. Nenhuma alteração nos critérios de candidatura a pausa.
- **Falha fechada:** se não conseguir gravar a rodada na Neon, o script não executa nenhuma pausa.
- **Fallback obrigatório na leitura da grade:** sem Neon acessível, o script lê o markdown como hoje. Ele nunca fica sem configuração.
- **A aba não decide nada.** Toda regra vive no backend. Convenção escrita em três pontos de `public/dash/index.html`.
- **Nenhuma tabela nova no D1.** O D1 do tracking segue só como fonte de leitura do funil.
- **A conta é uma só:** `atacado-exponencial`, `act_4577256079174658`. Nenhuma outra conta lê ou escreve no schema `argo` neste plano.
- **Estado inicial da grade:** `pausar_campanha_trafego = executar` (é o que já acontece hoje; qualquer outro valor é regressão). As demais ações nascem `desligado`.
- **Segredos:** a string de conexão da Neon nunca aparece em código, log, output de cron ou mensagem. Vive em `ARGO_DATABASE_URL` no `.env` do profile (VPS) e como secret do Cloudflare Pages.
- **VPS:** `ssh root@31.97.241.169`, base `/root/.hermes/profiles/gestor-ia/`.

---

### Task 1: Schema `argo` na Neon

Cria as quatro tabelas e a linha de configuração inicial da conta. Sem isso nada mais tem onde gravar.

**Files:**
- Create: `migrations/argo/0001_schema_argo.sql` (no repositório `gestor-ae`)
- Create: `migrations/argo/aplicar.py` (no repositório `gestor-ae`)

**Interfaces:**
- Consumes: nada.
- Produces: schema `argo` com as tabelas `rodadas`, `acoes`, `propostas`, `config_conta`, e uma linha em `config_conta` com `conta = 'atacado-exponencial'`.

- [ ] **Step 1: Escrever a migration**

Criar `migrations/argo/0001_schema_argo.sql`:

```sql
-- O schema `argo` NÃO é criado aqui: quem o cria é o dono do banco, no
-- provisionamento. `CREATE SCHEMA IF NOT EXISTS` exige privilégio CREATE no
-- BANCO mesmo quando o schema já existe, e o papel `argo_rw` não tem esse
-- privilégio de propósito — é justamente o que o mantém longe das tabelas do
-- gestor-exponencial. Esta migration só cria objetos DENTRO do schema.

CREATE TABLE IF NOT EXISTS argo.rodadas (
  id            BIGSERIAL PRIMARY KEY,
  conta         TEXT        NOT NULL,
  executor      TEXT        NOT NULL,
  iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em  TIMESTAMPTZ,
  ok            BOOLEAN,
  erro          TEXT,
  leitura       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  conclusao     TEXT
);

CREATE INDEX IF NOT EXISTS idx_rodadas_conta_data
  ON argo.rodadas (conta, iniciada_em DESC);

CREATE TABLE IF NOT EXISTS argo.acoes (
  id             BIGSERIAL PRIMARY KEY,
  rodada_id      BIGINT      NOT NULL REFERENCES argo.rodadas(id) ON DELETE CASCADE,
  conta          TEXT        NOT NULL,
  tipo           TEXT        NOT NULL,
  alvo_tipo      TEXT        NOT NULL,
  alvo_id        TEXT        NOT NULL,
  alvo_nome      TEXT,
  motivo         TEXT        NOT NULL,
  estado_anterior JSONB      NOT NULL,
  estado_posterior JSONB,
  aplicada       BOOLEAN     NOT NULL DEFAULT false,
  desfeita_em    TIMESTAMPTZ,
  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acoes_conta_data
  ON argo.acoes (conta, criada_em DESC);

CREATE TABLE IF NOT EXISTS argo.propostas (
  id           BIGSERIAL PRIMARY KEY,
  rodada_id    BIGINT      NOT NULL REFERENCES argo.rodadas(id) ON DELETE CASCADE,
  conta        TEXT        NOT NULL,
  tipo         TEXT        NOT NULL,
  alvo_tipo    TEXT        NOT NULL,
  alvo_id      TEXT        NOT NULL,
  alvo_nome    TEXT,
  motivo       TEXT        NOT NULL,
  detalhe      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  vence_em     TIMESTAMPTZ NOT NULL,
  decisao      TEXT,
  decidida_por TEXT,
  decidida_em  TIMESTAMPTZ,
  criada_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_propostas_conta_pendente
  ON argo.propostas (conta, criada_em DESC)
  WHERE decisao IS NULL;

CREATE TABLE IF NOT EXISTS argo.config_conta (
  conta                     TEXT        PRIMARY KEY,
  permissoes                JSONB       NOT NULL,
  teto_mensal_meta_centavos BIGINT,
  limite_por_acao_centavos  BIGINT,
  max_pausas_por_rodada     INTEGER     NOT NULL DEFAULT 3,
  parada_geral              BOOLEAN     NOT NULL DEFAULT false,
  atualizada_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_por            TEXT
);

INSERT INTO argo.config_conta
  (conta, permissoes, teto_mensal_meta_centavos, limite_por_acao_centavos,
   max_pausas_por_rodada, parada_geral, atualizada_por)
VALUES (
  'atacado-exponencial',
  '{"pausar_campanha_trafego":"executar",
    "pausar_anuncio":"desligado",
    "pausar_conjunto":"desligado",
    "realocar_verba":"desligado",
    "reduzir_orcamento":"desligado",
    "aumentar_orcamento":"desligado"}'::jsonb,
  1000000,
  5000,
  3,
  false,
  'migration 0001'
)
ON CONFLICT (conta) DO NOTHING;
```

> **Feito pelo controlador antes desta tarefa (não refaça):** o schema `argo`
> já existe na Neon, e um papel dedicado `argo_rw` — com acesso **apenas** ao
> schema `argo`, sem enxergar as tabelas do `gestor-exponencial` — já foi criado.
> A string de conexão desse papel já está em `ARGO_DATABASE_URL`, tanto no
> `.env` do profile na VPS quanto como secret do Cloudflare Pages. Você **nunca**
> precisa ver, imprimir ou copiar nenhuma credencial nesta tarefa.

- [ ] **Step 2: Preparar o Python da VPS**

A VPS **não tem `psql`** e o Python do sistema não tem driver de Postgres. Criar o venv do profile (usado também pelas tarefas seguintes):

```bash
ssh root@31.97.241.169 'python3 -m venv /root/.hermes/profiles/gestor-ia/.venv && /root/.hermes/profiles/gestor-ia/.venv/bin/pip install -q "psycopg[binary]" requests && /root/.hermes/profiles/gestor-ia/.venv/bin/python -c "import psycopg, requests; print(\"ok\", psycopg.__version__)"'
```

Esperado: `ok 3.x.x`

- [ ] **Step 3: Escrever o aplicador em Python**

Criar `migrations/argo/aplicar.py`:

```python
#!/usr/bin/env python3
"""Aplica as migrations do schema `argo` na Neon.

Usa psycopg porque a VPS não tem psql. Lê ARGO_DATABASE_URL do ambiente ou do
.env do profile. Nunca imprime a string de conexão.
"""
import os
import sys
from pathlib import Path

ENV_PATH = Path("/root/.hermes/profiles/gestor-ia/.env")


def dsn() -> str:
    valor = os.environ.get("ARGO_DATABASE_URL", "")
    if valor:
        return valor
    if ENV_PATH.exists():
        for linha in ENV_PATH.read_text(errors="ignore").splitlines():
            if linha.startswith("ARGO_DATABASE_URL="):
                return linha.split("=", 1)[1].strip().strip("\"'")
    print("ARGO_DATABASE_URL ausente", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    import psycopg

    aqui = Path(__file__).resolve().parent
    arquivos = sorted(p for p in aqui.glob("*.sql") if p.name[0].isdigit())
    if not arquivos:
        print("nenhuma migration encontrada", file=sys.stderr)
        return 1

    with psycopg.connect(dsn(), connect_timeout=15) as con:
        for caminho in arquivos:
            print(f"aplicando {caminho.name}")
            with con.cursor() as cur:
                cur.execute(caminho.read_text(encoding="utf-8"))
        con.commit()
    print("migrations aplicadas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: Copiar os arquivos para a VPS, aplicar e verificar**

```bash
ssh root@31.97.241.169 'mkdir -p /root/.hermes/profiles/gestor-ia/migrations/argo'
scp ~/OneDrive/gestor-ae/migrations/argo/0001_schema_argo.sql ~/OneDrive/gestor-ae/migrations/argo/aplicar.py root@31.97.241.169:/root/.hermes/profiles/gestor-ia/migrations/argo/
ssh root@31.97.241.169 '/root/.hermes/profiles/gestor-ia/.venv/bin/python /root/.hermes/profiles/gestor-ia/migrations/argo/aplicar.py'
```

Esperado: `aplicando 0001_schema_argo.sql` seguido de `migrations aplicadas`.

Verificar (sem psql, pelo venv):

```bash
ssh root@31.97.241.169 '/root/.hermes/profiles/gestor-ia/.venv/bin/python -c "
import os, psycopg
from pathlib import Path
dsn = [l.split(\"=\",1)[1].strip() for l in Path(\"/root/.hermes/profiles/gestor-ia/.env\").read_text().splitlines() if l.startswith(\"ARGO_DATABASE_URL=\")][0]
with psycopg.connect(dsn) as c, c.cursor() as k:
    k.execute(\"SELECT conta, permissoes->>%s FROM argo.config_conta\", (\"pausar_campanha_trafego\",))
    print(k.fetchall())
"'
```

Esperado: `[('atacado-exponencial', 'executar')]`

- [ ] **Step 5: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add migrations/argo/0001_schema_argo.sql migrations/argo/aplicar.py
git commit -m "feat(argo): schema argo na Neon com grade inicial da conta AE"
```

---

### Task 2: Módulo `argo_estado.py`

O único ponto do Python que fala com a Neon. Isola a conexão para que o script que opera dinheiro não ganhe SQL espalhado.

**Files:**
- Create: `scripts/argo_estado.py` (VPS: `/root/.hermes/profiles/gestor-ia/scripts/`)
- Test: `scripts/test_argo_estado.py`

**Interfaces:**
- Consumes: schema `argo` da Task 1; `ARGO_DATABASE_URL` no `.env` do profile.
- Produces:
  - `ler_grade(conta: str) -> dict | None` — devolve `{"permissoes": dict, "teto_mensal_meta": float|None, "limite_por_acao": float|None, "max_pausas_por_rodada": int, "parada_geral": bool}`, ou `None` se a Neon não responder.
  - `abrir_rodada(conta: str, executor: str, leitura: dict) -> int` — devolve o `rodada_id`.
  - `fechar_rodada(rodada_id: int, ok: bool, conclusao: str | None, erro: str | None) -> None`
  - `registrar_acao(rodada_id, conta, tipo, alvo_tipo, alvo_id, alvo_nome, motivo, estado_anterior: dict, estado_posterior: dict | None, aplicada: bool) -> int`

> O venv com `psycopg` já foi criado na Task 1, Step 2. Use sempre
> `/root/.hermes/profiles/gestor-ia/.venv/bin/python`, nunca `python3` do sistema.

- [ ] **Step 2: Escrever o teste que falha**

Criar `scripts/test_argo_estado.py`. Testa o que não depende de rede: a tradução de linha do banco para o formato que o script consome.

```python
import unittest
import argo_estado


class TestNormalizarGrade(unittest.TestCase):
    def test_converte_centavos_para_reais(self):
        linha = {
            "permissoes": {"pausar_campanha_trafego": "executar"},
            "teto_mensal_meta_centavos": 1000000,
            "limite_por_acao_centavos": 5000,
            "max_pausas_por_rodada": 3,
            "parada_geral": False,
        }
        grade = argo_estado.normalizar_grade(linha)
        self.assertEqual(grade["teto_mensal_meta"], 10000.0)
        self.assertEqual(grade["limite_por_acao"], 50.0)

    def test_teto_ausente_vira_none_nao_zero(self):
        linha = {
            "permissoes": {},
            "teto_mensal_meta_centavos": None,
            "limite_por_acao_centavos": None,
            "max_pausas_por_rodada": 3,
            "parada_geral": False,
        }
        grade = argo_estado.normalizar_grade(linha)
        self.assertIsNone(grade["teto_mensal_meta"])
        self.assertIsNone(grade["limite_por_acao"])

    def test_pode_executar_respeita_parada_geral(self):
        grade = {
            "permissoes": {"pausar_campanha_trafego": "executar"},
            "parada_geral": True,
        }
        self.assertFalse(
            argo_estado.pode_executar(grade, "pausar_campanha_trafego")
        )

    def test_pode_executar_so_com_estado_executar(self):
        grade = {
            "permissoes": {"pausar_campanha_trafego": "propor"},
            "parada_geral": False,
        }
        self.assertFalse(
            argo_estado.pode_executar(grade, "pausar_campanha_trafego")
        )
        grade["permissoes"]["pausar_campanha_trafego"] = "executar"
        self.assertTrue(
            argo_estado.pode_executar(grade, "pausar_campanha_trafego")
        )

    def test_acao_desconhecida_e_negada(self):
        grade = {"permissoes": {}, "parada_geral": False}
        self.assertFalse(argo_estado.pode_executar(grade, "inventada"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Rodar o teste e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_argo_estado -v'
```

Esperado: FAIL com `ModuleNotFoundError: No module named 'argo_estado'`

- [ ] **Step 4: Escrever o módulo**

Criar `scripts/argo_estado.py`:

```python
"""Estado do Argo na Neon — único ponto do Python que fala com o banco.

Falha fechada: quem grava rodada deve abortar se `abrir_rodada` levantar.
Falha aberta na leitura: `ler_grade` devolve None quando o banco não responde,
e o chamador cai no markdown (ver ae_trafego_monitor.load_config).
"""
import os
from pathlib import Path
from typing import Any

ENV_PATH = Path("/root/.hermes/profiles/gestor-ia/.env")
ACOES_CONHECIDAS = {
    "pausar_campanha_trafego",
    "pausar_anuncio",
    "pausar_conjunto",
    "realocar_verba",
    "reduzir_orcamento",
    "aumentar_orcamento",
}


def _dsn() -> str:
    valor = os.environ.get("ARGO_DATABASE_URL", "")
    if valor:
        return valor
    if ENV_PATH.exists():
        for linha in ENV_PATH.read_text(errors="ignore").splitlines():
            if linha.startswith("ARGO_DATABASE_URL="):
                return linha.split("=", 1)[1].strip().strip("\"'")
    raise RuntimeError("ARGO_DATABASE_URL ausente")


def _conectar():
    import psycopg

    return psycopg.connect(_dsn(), connect_timeout=10)


def _centavos_para_reais(valor: int | None) -> float | None:
    return None if valor is None else round(valor / 100.0, 2)


def normalizar_grade(linha: dict[str, Any]) -> dict[str, Any]:
    """Traduz a linha de config_conta para o formato que o script consome."""
    return {
        "permissoes": linha.get("permissoes") or {},
        "teto_mensal_meta": _centavos_para_reais(linha.get("teto_mensal_meta_centavos")),
        "limite_por_acao": _centavos_para_reais(linha.get("limite_por_acao_centavos")),
        "max_pausas_por_rodada": linha.get("max_pausas_por_rodada") or 0,
        "parada_geral": bool(linha.get("parada_geral")),
    }


def pode_executar(grade: dict[str, Any], acao: str) -> bool:
    """True só quando a ação é conhecida, está em `executar` e não há parada."""
    if grade.get("parada_geral"):
        return False
    if acao not in ACOES_CONHECIDAS:
        return False
    return (grade.get("permissoes") or {}).get(acao) == "executar"


def ler_grade(conta: str) -> dict[str, Any] | None:
    """Grade da conta, ou None se o banco não responder (chamador usa fallback)."""
    try:
        with _conectar() as con, con.cursor() as cur:
            cur.execute(
                """
                SELECT permissoes, teto_mensal_meta_centavos,
                       limite_por_acao_centavos, max_pausas_por_rodada, parada_geral
                  FROM argo.config_conta WHERE conta = %s
                """,
                (conta,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return normalizar_grade(
                {
                    "permissoes": row[0],
                    "teto_mensal_meta_centavos": row[1],
                    "limite_por_acao_centavos": row[2],
                    "max_pausas_por_rodada": row[3],
                    "parada_geral": row[4],
                }
            )
    except Exception:
        return None


def abrir_rodada(conta: str, executor: str, leitura: dict[str, Any]) -> int:
    import json

    with _conectar() as con, con.cursor() as cur:
        cur.execute(
            """
            INSERT INTO argo.rodadas (conta, executor, leitura)
            VALUES (%s, %s, %s::jsonb) RETURNING id
            """,
            (conta, executor, json.dumps(leitura, ensure_ascii=False)),
        )
        return cur.fetchone()[0]


def fechar_rodada(
    rodada_id: int, ok: bool, conclusao: str | None = None, erro: str | None = None
) -> None:
    with _conectar() as con, con.cursor() as cur:
        cur.execute(
            """
            UPDATE argo.rodadas
               SET concluida_em = now(), ok = %s, conclusao = %s, erro = %s
             WHERE id = %s
            """,
            (ok, conclusao, erro, rodada_id),
        )


def registrar_acao(
    rodada_id: int,
    conta: str,
    tipo: str,
    alvo_tipo: str,
    alvo_id: str,
    alvo_nome: str | None,
    motivo: str,
    estado_anterior: dict[str, Any],
    estado_posterior: dict[str, Any] | None,
    aplicada: bool,
) -> int:
    import json

    with _conectar() as con, con.cursor() as cur:
        cur.execute(
            """
            INSERT INTO argo.acoes
              (rodada_id, conta, tipo, alvo_tipo, alvo_id, alvo_nome, motivo,
               estado_anterior, estado_posterior, aplicada)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s)
            RETURNING id
            """,
            (
                rodada_id,
                conta,
                tipo,
                alvo_tipo,
                alvo_id,
                alvo_nome,
                motivo,
                json.dumps(estado_anterior, ensure_ascii=False),
                json.dumps(estado_posterior, ensure_ascii=False)
                if estado_posterior is not None
                else None,
                aplicada,
            ),
        )
        return cur.fetchone()[0]
```

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_argo_estado -v'
```

Esperado: 5 testes OK

- [ ] **Step 6: Verificar a leitura real contra a Neon**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -c "
import argo_estado as a
g = a.ler_grade(\"atacado-exponencial\")
print(g)
print(\"pode pausar trafego:\", a.pode_executar(g, \"pausar_campanha_trafego\"))
"'
```

Esperado: a grade com `teto_mensal_meta: 10000.0` e `pode pausar trafego: True`

- [ ] **Step 7: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/argo_estado.py profiles/gestor-ia/scripts/test_argo_estado.py
git commit -m "feat(argo): modulo de estado na Neon, com grade e registro de acoes"
```

---

### Task 3: O script passa a ler a grade da Neon

Troca a fonte da permissão sem tocar em nenhum critério de decisão. O markdown vira fallback.

**Files:**
- Modify: `scripts/ae_trafego_monitor.py` — função `load_config()` (linhas 111–141) e o teste de `config["auto_pause"]` no laço de pausas
- Test: `scripts/test_ae_trafego_config.py`

**Interfaces:**
- Consumes: `argo_estado.ler_grade`, `argo_estado.pode_executar` (Task 2).
- Produces: `load_config()` passa a devolver as mesmas chaves de hoje mais `"auto_pause_origem"` com valor `"neon"` ou `"markdown"`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test_ae_trafego_config.py`:

```python
import unittest
from unittest import mock

import ae_trafego_monitor as m


BASE = {
    "monthly_budget": 10000.0,
    "traffic_cap_pct": 0.1,
    "reference_cpv": 0.1433,
    "reference_window": "2026-09-10 a 2026-09-16",
    "reference_spend": 92.27,
    "reference_visits": 644,
    "auto_pause": False,
}


class TestOrigemDaPermissao(unittest.TestCase):
    def test_neon_manda_quando_responde(self):
        grade = {
            "permissoes": {"pausar_campanha_trafego": "executar"},
            "parada_geral": False,
        }
        with mock.patch.object(m, "_config_do_markdown", return_value=dict(BASE)), \
             mock.patch("argo_estado.ler_grade", return_value=grade):
            cfg = m.load_config()
        self.assertTrue(cfg["auto_pause"])
        self.assertEqual(cfg["auto_pause_origem"], "neon")

    def test_parada_geral_desliga_mesmo_com_executar(self):
        grade = {
            "permissoes": {"pausar_campanha_trafego": "executar"},
            "parada_geral": True,
        }
        with mock.patch.object(m, "_config_do_markdown", return_value=dict(BASE)), \
             mock.patch("argo_estado.ler_grade", return_value=grade):
            cfg = m.load_config()
        self.assertFalse(cfg["auto_pause"])

    def test_neon_fora_do_ar_cai_no_markdown(self):
        md = dict(BASE)
        md["auto_pause"] = True
        with mock.patch.object(m, "_config_do_markdown", return_value=md), \
             mock.patch("argo_estado.ler_grade", return_value=None):
            cfg = m.load_config()
        self.assertTrue(cfg["auto_pause"])
        self.assertEqual(cfg["auto_pause_origem"], "markdown")

    def test_valores_de_referencia_continuam_vindo_do_markdown(self):
        grade = {"permissoes": {}, "parada_geral": False}
        with mock.patch.object(m, "_config_do_markdown", return_value=dict(BASE)), \
             mock.patch("argo_estado.ler_grade", return_value=grade):
            cfg = m.load_config()
        self.assertEqual(cfg["reference_cpv"], 0.1433)
        self.assertEqual(cfg["monthly_budget"], 10000.0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_trafego_config -v'
```

Esperado: FAIL com `AttributeError: module 'ae_trafego_monitor' has no attribute '_config_do_markdown'`

- [ ] **Step 3: Renomear a função atual e escrever a nova**

Em `scripts/ae_trafego_monitor.py`, renomear `def load_config()` (linha 111) para `def _config_do_markdown()` — **sem alterar uma linha do corpo dela**. Logo abaixo, acrescentar:

```python
CONTA = "atacado-exponencial"


def load_config() -> dict[str, Any]:
    """Config da conta. Referências vêm do markdown; a permissão vem da Neon.

    Sem Neon acessível, a permissão volta a sair do markdown — o script nunca
    fica sem configuração.
    """
    config = _config_do_markdown()

    import argo_estado

    grade = argo_estado.ler_grade(CONTA)
    if grade is None:
        config["auto_pause_origem"] = "markdown"
        return config

    config["auto_pause"] = argo_estado.pode_executar(grade, "pausar_campanha_trafego")
    config["auto_pause_origem"] = "neon"
    config["max_pausas_por_rodada"] = grade["max_pausas_por_rodada"]
    return config
```

- [ ] **Step 4: Rodar e ver passar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_trafego_config -v'
```

Esperado: 4 testes OK

- [ ] **Step 5: Rodar o script de verdade, em conta real, e comparar com ontem**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python ae_trafego_monitor.py'
```

Esperado: relatório com o mesmo formato do último arquivo em `cron/output/191d4eb26d3c/`. Confirmar que a linha final sobre pausas é a mesma que apareceu na execução anterior — nenhuma pausa nova deve surgir só por causa desta mudança.

- [ ] **Step 6: Apontar o cron para o Python do venv**

O cron chama `ae_trafego_monitor.py` pelo Python do sistema, que não tem `psycopg`. Verificar como o Hermes invoca o script e garantir que use `/root/.hermes/profiles/gestor-ia/.venv/bin/python`:

```bash
ssh root@31.97.241.169 'python3 -c "
import json
d=json.load(open(\"/root/.hermes/profiles/gestor-ia/cron/jobs.json\"))
js=d if isinstance(d,list) else d.get(\"jobs\",[])
for j in js:
    if j.get(\"script\")==\"ae_trafego_monitor.py\":
        print({k:j.get(k) for k in (\"id\",\"script\",\"no_agent\",\"interpreter\",\"command\")})
"'
```

Se não houver campo de interpretador, adicionar na primeira linha do script o shebang do venv:

```python
#!/root/.hermes/profiles/gestor-ia/.venv/bin/python
```

e garantir o bit de execução:

```bash
ssh root@31.97.241.169 'chmod +x /root/.hermes/profiles/gestor-ia/scripts/ae_trafego_monitor.py'
```

- [ ] **Step 7: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/ae_trafego_monitor.py profiles/gestor-ia/scripts/test_ae_trafego_config.py
git commit -m "feat(argo): permissao de pausa vem da grade na Neon, markdown vira fallback"
```

---

### Task 4: O script grava rodada e ações na Neon

A memória que ele nunca teve. Falha fechada: sem conseguir abrir a rodada, não pausa.

**Files:**
- Modify: `scripts/ae_trafego_monitor.py` — função `build_report()` (início, laço de pausas, fim)
- Test: `scripts/test_ae_trafego_registro.py`

**Interfaces:**
- Consumes: `argo_estado.abrir_rodada`, `argo_estado.registrar_acao`, `argo_estado.fechar_rodada` (Task 2).
- Produces: uma linha em `argo.rodadas` por execução e uma em `argo.acoes` por pausa tentada.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test_ae_trafego_registro.py`:

```python
import unittest
from unittest import mock

import ae_trafego_monitor as m


CONFIG = {
    "monthly_budget": 10000.0,
    "traffic_cap_pct": 0.1,
    "reference_cpv": 0.1433,
    "reference_window": "2026-09-10 a 2026-09-16",
    "reference_spend": 92.27,
    "reference_visits": 644,
    "auto_pause": True,
    "auto_pause_origem": "neon",
}


class TestFalhaFechada(unittest.TestCase):
    def test_sem_conseguir_abrir_rodada_nao_pausa(self):
        # load_config e a Meta API são isoladas: este teste é sobre a falha
        # fechada, não sobre rede. Se abrir_rodada levanta, build_report tem
        # que propagar ANTES de qualquer chamada a pause_campaign.
        with mock.patch.object(m, "load_config", return_value=dict(CONFIG)), \
             mock.patch.object(m, "active_traffic_campaigns", return_value={}), \
             mock.patch.object(m, "campaign_metrics", return_value={}), \
             mock.patch("argo_estado.abrir_rodada", side_effect=RuntimeError("neon fora")), \
             mock.patch.object(m, "pause_campaign") as pausar:
            with self.assertRaises(RuntimeError):
                m.build_report()
        pausar.assert_not_called()


class TestRegistroDeAcao(unittest.TestCase):
    def test_pausa_registra_estado_anterior_e_posterior(self):
        registradas = []

        def fake_registrar(**kwargs):
            registradas.append(kwargs)
            return len(registradas)

        with mock.patch("argo_estado.abrir_rodada", return_value=99), \
             mock.patch("argo_estado.fechar_rodada"), \
             mock.patch("argo_estado.registrar_acao", side_effect=fake_registrar), \
             mock.patch.object(m, "pause_campaign"), \
             mock.patch.object(m, "campaign_state", side_effect=[
                 {"status": "ACTIVE", "effective_status": "ACTIVE"},
                 {"status": "PAUSED", "effective_status": "PAUSED"},
             ]):
            m._registrar_pausa(
                rodada_id=99,
                campaign_id="123",
                campaign_name="Campanha X",
                reason="gasto 7d R$ 120,00 e CPV acima da referência",
            )

        self.assertEqual(len(registradas), 1)
        acao = registradas[0]
        self.assertEqual(acao["tipo"], "pausar_campanha_trafego")
        self.assertEqual(acao["alvo_id"], "123")
        self.assertEqual(acao["estado_anterior"]["status"], "ACTIVE")
        self.assertEqual(acao["estado_posterior"]["status"], "PAUSED")
        self.assertTrue(acao["aplicada"])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_trafego_registro -v'
```

Esperado: FAIL com `AttributeError: module 'ae_trafego_monitor' has no attribute '_registrar_pausa'`

- [ ] **Step 3: Extrair a pausa para uma função registrável**

Em `scripts/ae_trafego_monitor.py`, acrescentar antes de `build_report()`:

```python
def _registrar_pausa(
    rodada_id: int, campaign_id: str, campaign_name: str, reason: str
) -> PauseResult:
    """Pausa uma campanha e grava a ação com o estado antes e depois.

    Mesma lógica que já rodava dentro de build_report — só extraída para que o
    registro na Neon aconteça no mesmo lugar em que a ação acontece.
    """
    import argo_estado

    before = campaign_state(campaign_id)
    if (before.get("status") or "").upper() == "PAUSED":
        after = before
        changed = False
    else:
        pause_campaign(campaign_id)
        after = campaign_state(campaign_id)
        changed = (after.get("status") or "").upper() == "PAUSED"

    argo_estado.registrar_acao(
        rodada_id=rodada_id,
        conta=CONTA,
        tipo="pausar_campanha_trafego",
        alvo_tipo="campanha",
        alvo_id=campaign_id,
        alvo_nome=campaign_name,
        motivo=reason,
        estado_anterior=before,
        estado_posterior=after,
        aplicada=changed,
    )

    return PauseResult(
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        before_status=before.get("status"),
        before_effective_status=before.get("effective_status"),
        after_status=after.get("status"),
        after_effective_status=after.get("effective_status"),
        changed=changed,
        reason=reason,
    )
```

Dentro do laço de pausas em `build_report()`, substituir o bloco que chamava `campaign_state`/`pause_campaign` diretamente por:

```python
            results: list[PauseResult] = []
            for cid, reason in candidates:
                info = campaigns[cid]
                results.append(
                    _registrar_pausa(
                        rodada_id=rodada_id,
                        campaign_id=cid,
                        campaign_name=info.get("name") or cid,
                        reason=reason,
                    )
                )
```

- [ ] **Step 4: Abrir e fechar a rodada em `build_report()`**

No início de `build_report()`, depois de `config = load_config()`, acrescentar:

```python
    import argo_estado

    rodada_id = argo_estado.abrir_rodada(
        conta=CONTA,
        executor="ae_trafego_monitor",
        leitura={"origem_permissao": config.get("auto_pause_origem")},
    )
```

Envolver o restante do corpo em `try/except`, fechando a rodada nos dois caminhos. Antes do `return "\n".join(lines)`:

```python
    argo_estado.fechar_rodada(
        rodada_id, ok=True, conclusao=lines[-1] if lines else None
    )
```

E em `main()`, nos dois `except`, nada muda — a rodada já foi fechada por `build_report` ou ficou aberta com `ok` nulo, o que a aba mostra como falha.

- [ ] **Step 5: Rodar e ver passar**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -m unittest test_ae_trafego_registro -v'
```

Esperado: 2 testes OK

- [ ] **Step 6: Rodar de verdade e conferir a gravação**

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python ae_trafego_monitor.py > /tmp/saida.txt; tail -3 /tmp/saida.txt; set -a; . ../.env; set +a; psql "$ARGO_DATABASE_URL" -t -c "SELECT id, executor, ok, conclusao FROM argo.rodadas ORDER BY id DESC LIMIT 3;"'
```

Esperado: uma linha nova em `argo.rodadas` com `ok = t`.

- [ ] **Step 7: Commit**

```bash
cd ~/OneDrive/gestor-ae
git add profiles/gestor-ia/scripts/ae_trafego_monitor.py profiles/gestor-ia/scripts/test_ae_trafego_registro.py
git commit -m "feat(argo): cada rodada e cada pausa ficam registradas na Neon"
```

---

### Task 5: Módulo puro de formatação do registro

Segue o padrão da casa: a regra vive num `_modulo.js` testável, e o endpoint só monta a resposta.

**Files:**
- Create: `functions/api/_argo-registro.js`
- Test: `tests/argo-registro.test.js`

**Interfaces:**
- Consumes: linhas cruas de `argo.rodadas` e `argo.acoes`.
- Produces:
  - `montarRegistro({ rodadas, acoes }) -> { rodadas: [...], cabecalho: {...} }`
  - `ERRO_SEM_GRADE` — constante de texto usada pelo endpoint.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/argo-registro.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarRegistro, ERRO_SEM_GRADE } from '../functions/api/_argo-registro.js';

function cenario(extra = {}) {
  return {
    rodadas: [
      { id: 2, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-19T11:50:00Z', ok: true, conclusao: 'Nenhum candidato a pausa pelos critérios combinados.', leitura: { origem_permissao: 'neon' } },
      { id: 1, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-18T11:50:00Z', ok: true, conclusao: 'Pausas aplicadas automaticamente', leitura: { origem_permissao: 'neon' } },
    ],
    acoes: [
      { id: 10, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Post do Instagram: Atacado faz ou não faz na...', motivo: 'gasto 7d R$ 107,27 e CPV R$ 0,32 acima da referência R$ 0,30', aplicada: true, desfeita_em: null },
    ],
    ...extra,
  };
}

test('cada rodada recebe as ações dela', () => {
  const r = montarRegistro(cenario());
  assert.equal(r.rodadas.length, 2);
  assert.equal(r.rodadas[0].id, 2);
  assert.equal(r.rodadas[0].acoes.length, 0);
  assert.equal(r.rodadas[1].acoes.length, 1);
  assert.equal(r.rodadas[1].acoes[0].alvo_nome.startsWith('Post do Instagram'), true);
});

test('cabecalho mostra a ultima rodada e a origem da permissao', () => {
  const r = montarRegistro(cenario());
  assert.equal(r.cabecalho.ultima_rodada_em, '2026-09-19T11:50:00Z');
  assert.equal(r.cabecalho.origem_permissao, 'neon');
  assert.equal(r.cabecalho.ultima_falhou, false);
});

test('rodada aberta sem ok conta como falha', () => {
  const dados = cenario();
  dados.rodadas[0].ok = null;
  const r = montarRegistro(dados);
  assert.equal(r.cabecalho.ultima_falhou, true);
});

test('sem rodada nenhuma o cabecalho nao inventa data', () => {
  const r = montarRegistro({ rodadas: [], acoes: [] });
  assert.equal(r.cabecalho.ultima_rodada_em, null);
  assert.equal(r.rodadas.length, 0);
});

test('permissao vinda do markdown e sinalizada', () => {
  const dados = cenario();
  dados.rodadas[0].leitura = { origem_permissao: 'markdown' };
  const r = montarRegistro(dados);
  assert.equal(r.cabecalho.origem_permissao, 'markdown');
});

test('constante de erro existe e e texto', () => {
  assert.equal(typeof ERRO_SEM_GRADE, 'string');
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-registro.test.js
```

Esperado: FAIL, `Cannot find module '../functions/api/_argo-registro.js'`

- [ ] **Step 3: Escrever o módulo**

Criar `functions/api/_argo-registro.js`:

```javascript
// Formatação do registro do Argo para a aba (spec 2026-09-20).
//
// A aba NÃO decide nada: agrupamento, cabeçalho e sinalização de falha saem
// prontos daqui. Convenções do contrato, iguais às de _cpl-calculo.js:
// `null` = sem dado, nunca 0 inventado.

export const ERRO_SEM_GRADE =
  'A grade de permissões desta conta ainda não foi configurada.';

export function montarRegistro({ rodadas = [], acoes = [] } = {}) {
  const porRodada = new Map();
  for (const acao of acoes) {
    if (!porRodada.has(acao.rodada_id)) porRodada.set(acao.rodada_id, []);
    porRodada.get(acao.rodada_id).push(acao);
  }

  const lista = rodadas.map((r) => ({
    id: r.id,
    executor: r.executor,
    iniciada_em: r.iniciada_em,
    ok: r.ok,
    conclusao: r.conclusao ?? null,
    acoes: porRodada.get(r.id) ?? [],
  }));

  const ultima = lista[0] ?? null;

  return {
    rodadas: lista,
    cabecalho: {
      ultima_rodada_em: ultima ? ultima.iniciada_em : null,
      // `ok` nulo é rodada que abriu e não fechou: falha, não sucesso.
      ultima_falhou: ultima ? ultima.ok !== true : false,
      // `lista` não carrega `leitura`, então a origem sai da linha crua.
      origem_permissao: rodadas[0]?.leitura?.origem_permissao ?? null,
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd ~/OneDrive/tracking-avancado && node --test tests/argo-registro.test.js
```

Esperado: 6 testes pass

- [ ] **Step 5: Commit**

```bash
cd ~/OneDrive/tracking-avancado
git add functions/api/_argo-registro.js tests/argo-registro.test.js
git commit -m "feat(argo): modulo puro que monta o registro para a aba"
```

---

### Task 6: Endpoints `/api/argo/registro` e `/api/argo/config`

**Files:**
- Create: `functions/api/argo/registro.js`
- Create: `functions/api/argo/config.js`
- Create: `functions/api/_argo-db.js`
- Modify: `package.json` (dependência `@neondatabase/serverless`)

**Interfaces:**
- Consumes: `montarRegistro`, `ERRO_SEM_GRADE` (Task 5); schema `argo` (Task 1).
- Produces:
  - `GET /api/argo/registro?limite=N` → `{ rodadas, cabecalho }`
  - `GET /api/argo/config` → a grade da conta
  - `POST /api/argo/config` → grava a grade; devolve a grade salva

- [ ] **Step 1: Instalar o driver e configurar o secret**

```bash
cd ~/OneDrive/tracking-avancado && npm install @neondatabase/serverless
```

Secret no Cloudflare, com a mesma string de conexão da Task 1, sem BOM (ver `secrets-cloudflare-bom`):

```bash
printf '%s' 'COLE_A_STRING_AQUI' | npx wrangler pages secret put ARGO_DATABASE_URL --project-name tracking-ae
```

- [ ] **Step 2: Escrever o helper de conexão**

Criar `functions/api/_argo-db.js`:

```javascript
// Conexão com a Neon a partir das Functions do Pages.
// Uma consulta por chamada: sem polling, sem laço — a aba carrega ao abrir.
import { neon } from '@neondatabase/serverless';

export const CONTA = 'atacado-exponencial';

export function conectar(env) {
  if (!env.ARGO_DATABASE_URL) {
    throw new Error('ARGO_DATABASE_URL ausente no ambiente');
  }
  return neon(env.ARGO_DATABASE_URL);
}
```

- [ ] **Step 3: Escrever o endpoint de registro**

Criar `functions/api/argo/registro.js`:

```javascript
// GET /api/argo/registro?limite=N
//
// Registro do que o Argo viu e fez na conta do Atacado Exponencial.
// Janela limitada por construção: `limite` no máximo 50. A aba nunca pede
// "tudo" e nunca consulta em laço.
import { conectar, CONTA } from '../_argo-db.js';
import { montarRegistro } from '../_argo-registro.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const bruto = Number.parseInt(url.searchParams.get('limite') ?? '20', 10);
  const limite = Number.isFinite(bruto) ? Math.min(Math.max(bruto, 1), 50) : 20;

  try {
    const sql = conectar(env);
    const rodadas = await sql`
      SELECT id, executor, iniciada_em, ok, conclusao, leitura
        FROM argo.rodadas
       WHERE conta = ${CONTA}
       ORDER BY iniciada_em DESC
       LIMIT ${limite}
    `;
    const ids = rodadas.map((r) => r.id);
    const acoes = ids.length
      ? await sql`
          SELECT id, rodada_id, tipo, alvo_tipo, alvo_id, alvo_nome, motivo,
                 aplicada, desfeita_em, criada_em
            FROM argo.acoes
           WHERE rodada_id = ANY(${ids})
           ORDER BY criada_em DESC
        `
      : [];

    return Response.json(montarRegistro({ rodadas, acoes }));
  } catch (erro) {
    return Response.json(
      { erro: 'Não foi possível ler o registro do Argo agora.' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Escrever o endpoint de configuração**

Criar `functions/api/argo/config.js`:

```javascript
// GET  /api/argo/config  — a grade atual da conta
// POST /api/argo/config  — grava a grade
//
// A aba NÃO decide nada: a lista de ações válidas e os estados permitidos são
// validados aqui. Valor fora da lista é recusado, não corrigido em silêncio.
import { conectar, CONTA } from '../_argo-db.js';
import { ERRO_SEM_GRADE } from '../_argo-registro.js';

const ACOES = [
  'pausar_campanha_trafego',
  'pausar_anuncio',
  'pausar_conjunto',
  'realocar_verba',
  'reduzir_orcamento',
  'aumentar_orcamento',
];
const ESTADOS = ['desligado', 'propor', 'executar'];

async function lerGrade(sql) {
  const linhas = await sql`
    SELECT conta, permissoes, teto_mensal_meta_centavos,
           limite_por_acao_centavos, max_pausas_por_rodada,
           parada_geral, atualizada_em, atualizada_por
      FROM argo.config_conta WHERE conta = ${CONTA}
  `;
  return linhas[0] ?? null;
}

export async function onRequestGet({ env }) {
  try {
    const grade = await lerGrade(conectar(env));
    if (!grade) return Response.json({ erro: ERRO_SEM_GRADE }, { status: 404 });
    return Response.json(grade);
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler a configuração do Argo agora.' },
      { status: 500 },
    );
  }
}

export async function onRequestPost({ request, env }) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const permissoes = corpo.permissoes ?? {};
  for (const [acao, estado] of Object.entries(permissoes)) {
    if (!ACOES.includes(acao)) {
      return Response.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 });
    }
    if (!ESTADOS.includes(estado)) {
      return Response.json({ erro: `Estado inválido: ${estado}` }, { status: 400 });
    }
  }

  const teto = corpo.teto_mensal_meta_centavos ?? null;
  const limite = corpo.limite_por_acao_centavos ?? null;
  const maxPausas = Number.parseInt(corpo.max_pausas_por_rodada ?? 3, 10);
  const parada = Boolean(corpo.parada_geral);

  if (!Number.isFinite(maxPausas) || maxPausas < 0) {
    return Response.json({ erro: 'Máximo de pausas inválido.' }, { status: 400 });
  }

  try {
    const sql = conectar(env);
    await sql`
      UPDATE argo.config_conta
         SET permissoes = ${JSON.stringify(permissoes)}::jsonb,
             teto_mensal_meta_centavos = ${teto},
             limite_por_acao_centavos = ${limite},
             max_pausas_por_rodada = ${maxPausas},
             parada_geral = ${parada},
             atualizada_em = now(),
             atualizada_por = 'painel'
       WHERE conta = ${CONTA}
    `;
    return Response.json(await lerGrade(sql));
  } catch {
    return Response.json(
      { erro: 'Não foi possível salvar a configuração agora.' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Verificar contra o ambiente local**

```bash
cd ~/OneDrive/tracking-avancado && npx wrangler pages dev . --port 8788 &
sleep 8
curl -s localhost:8788/api/argo/config | head -c 400; echo
curl -s 'localhost:8788/api/argo/registro?limite=5' | head -c 400; echo
```

Esperado: a grade com `pausar_campanha_trafego: executar`, e o registro com as rodadas gravadas na Task 4.

- [ ] **Step 6: Commit**

```bash
cd ~/OneDrive/tracking-avancado
git add functions/api/_argo-db.js functions/api/argo/registro.js functions/api/argo/config.js package.json package-lock.json
git commit -m "feat(argo): endpoints de registro e configuracao lendo a Neon"
```

---

### Task 7: A aba Argo no dash

**Files:**
- Modify: `public/dash/index.html` — botão de aba, seção nova e o bloco de script correspondente

**Interfaces:**
- Consumes: `GET /api/argo/registro`, `GET /api/argo/config`, `POST /api/argo/config` (Task 6).
- Produces: nada consumido por tarefas posteriores.

**Como o dash funciona (leia antes de escrever):** cada aba é um `<a data-secao="slug">` no `#nav`, uma `<section class="secao" id="secao-slug">`, uma entrada em `TITULOS` e uma em `R` — o mapa de funções de carga. `render()` chama `await R[secao]()`. **O erro é tratado no `render()`, de forma centralizada:** se a função da aba lançar, o dash desenha o cartão de erro com botão "Tentar de novo" e esconde os números anteriores. Por isso a função da aba **não desenha o próprio erro** — ela lança.

```bash
cd ~/OneDrive/tracking-avancado && grep -n "^const TITULOS\|^const R = \|^const R=" public/dash/index.html
```

- [ ] **Step 1: Acrescentar o link no `#nav`**

Depois da linha `<a href="#saude-meta" data-secao="saude-meta">Saúde das integrações</a>`:

```html
        <a href="#argo" data-secao="argo">Argo</a>
```

- [ ] **Step 2: Acrescentar a seção**

Depois de `</section>` da seção `secao-saude-meta`:

```html
    <!-- Aba Argo (spec 2026-09-20-argo-controle-ae-design.md): o Argo já opera
         esta conta sozinho desde agosto — pausa campanhas de tráfego todo dia
         útil às 8h50. Esta aba mostra o que ele fez e comanda o que ele pode
         fazer. A aba NÃO decide nada: agrupamento por rodada, cabeçalho, ações
         válidas e estados permitidos vêm prontos de /api/argo/*. -->
    <section class="secao" id="secao-argo">
      <div id="argo-cabecalho"></div>
      <div class="card">
        <h2>O que ele pode fazer <small>vale a partir da próxima rodada</small></h2>
        <div id="argo-grade"></div>
        <div class="saude-acoes" style="justify-content:flex-end;margin-top:0.8rem">
          <span class="mini" id="argo-salvo" role="status" aria-live="polite"></span>
          <button class="btn sec" type="button" id="argo-salvar">Salvar</button>
        </div>
      </div>
      <div class="card">
        <h2>Registro <small>o que ele viu e o que executou, da rodada mais recente para trás</small></h2>
        <div class="tabela-wrap" id="argo-registro"></div>
      </div>
    </section>
```

- [ ] **Step 3: Registrar o título e a função de carga**

Acrescentar `argo: 'Argo',` ao objeto `TITULOS`, junto das outras abas.

No bloco de script, junto das demais funções de aba:

```javascript
// Aba Argo. Não decide nada: cabeçalho, agrupamento por rodada e sinalização de
// falha vêm prontos de /api/argo/registro (_argo-registro.js); as ações válidas
// e os estados permitidos são validados em /api/argo/config.
// Erro: esta função LANÇA. O cartão de erro é do render(), não daqui.
const ARGO_ACOES = [
  ['pausar_campanha_trafego', 'Pausar campanha de tráfego'],
  ['pausar_anuncio', 'Pausar anúncio'],
  ['pausar_conjunto', 'Pausar conjunto'],
  ['realocar_verba', 'Realocar verba'],
  ['reduzir_orcamento', 'Reduzir orçamento'],
  ['aumentar_orcamento', 'Aumentar orçamento'],
];
const ARGO_ESTADOS = ['desligado', 'propor', 'executar'];

function erroDeCarga(mensagem) {
  const e = new Error(mensagem);
  e.mensagemUsuario = mensagem;
  return e;
}

async function carregarArgo() {
  const [respRegistro, respGrade] = await Promise.all([
    fetch('/api/argo/registro?limite=20'),
    fetch('/api/argo/config'),
  ]);
  if (!respRegistro.ok) throw erroDeCarga('Não foi possível ler o registro do Argo.');
  if (!respGrade.ok) throw erroDeCarga('Não foi possível ler a configuração do Argo.');
  const registro = await respRegistro.json();
  desenharCabecalhoArgo(registro.cabecalho);
  desenharRegistroArgo(registro.rodadas);
  desenharGradeArgo(await respGrade.json());
}

function desenharCabecalhoArgo(c) {
  const quando = c.ultima_rodada_em
    ? new Date(c.ultima_rodada_em).toLocaleString('pt-BR')
    : 'nunca rodou';
  const avisos = [];
  if (c.ultima_falhou) {
    avisos.push('<div class="aviso falha">A última rodada não terminou. O que está abaixo pode estar incompleto.</div>');
  }
  if (c.origem_permissao === 'markdown') {
    avisos.push('<div class="aviso">A permissão está vindo do arquivo na VPS, não desta tela — o banco não respondeu na última rodada.</div>');
  }
  $('#argo-cabecalho').innerHTML =
    `<div class="aviso explica">Última rodada: <strong>${esc(quando)}</strong></div>` + avisos.join('');
}

function desenharRegistroArgo(rodadas) {
  if (!rodadas.length) {
    $('#argo-registro').innerHTML = '<p class="mini">Nenhuma rodada registrada ainda.</p>';
    return;
  }
  $('#argo-registro').innerHTML = rodadas.map((r) => {
    const acoes = r.acoes.length
      ? '<ul>' + r.acoes.map((a) => `<li><strong>${esc(a.alvo_nome || a.alvo_id)}</strong> — ${esc(a.aplicada ? 'pausada' : 'já estava pausada')}<br><span class="mini">${esc(a.motivo)}</span></li>`).join('') + '</ul>'
      : '<p class="mini">Nenhuma ação executada nesta rodada.</p>';
    const falhou = r.ok === true ? '' : ' <span class="mini">(não concluiu)</span>';
    return `<div class="card">
      <h2>${esc(new Date(r.iniciada_em).toLocaleString('pt-BR'))}${falhou}
        <small>${esc(r.executor)}</small></h2>
      <p>${esc(r.conclusao || '—')}</p>
      ${acoes}
    </div>`;
  }).join('');
}

function desenharGradeArgo(g) {
  const linhas = ARGO_ACOES.map(([chave, rotulo]) => {
    const atual = (g.permissoes || {})[chave] || 'desligado';
    const opcoes = ARGO_ESTADOS.map((e) =>
      `<option value="${e}"${e === atual ? ' selected' : ''}>${e}</option>`).join('');
    return `<tr><td>${esc(rotulo)}</td><td><select data-argo-acao="${chave}">${opcoes}</select></td></tr>`;
  }).join('');
  const reais = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2));
  $('#argo-grade').innerHTML = `<table><tbody>${linhas}</tbody></table>
    <p><label>Teto mensal de Meta (R$) <input type="number" step="0.01" id="argo-teto" value="${reais(g.teto_mensal_meta_centavos)}"></label></p>
    <p><label>Limite por ação (R$) <input type="number" step="0.01" id="argo-limite" value="${reais(g.limite_por_acao_centavos)}"></label></p>
    <p><label>Máximo de pausas por rodada <input type="number" step="1" min="0" id="argo-maxpausas" value="${Number(g.max_pausas_por_rodada) || 0}"></label></p>
    <p><label><input type="checkbox" id="argo-parada"${g.parada_geral ? ' checked' : ''}> Parada geral — ele não executa nada</label></p>`;
}

function centavosDoCampo(id) {
  const bruto = $(id).value.trim();
  if (bruto === '') return null;
  return Math.round(Number(bruto) * 100);
}

async function salvarGradeArgo() {
  const permissoes = {};
  document.querySelectorAll('[data-argo-acao]').forEach((s) => {
    permissoes[s.dataset.argoAcao] = s.value;
  });
  const resposta = await fetch('/api/argo/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      permissoes,
      teto_mensal_meta_centavos: centavosDoCampo('#argo-teto'),
      limite_por_acao_centavos: centavosDoCampo('#argo-limite'),
      max_pausas_por_rodada: Number($('#argo-maxpausas').value),
      parada_geral: $('#argo-parada').checked,
    }),
  });
  const corpo = await resposta.json();
  if (!resposta.ok) {
    $('#argo-salvo').textContent = corpo.erro || 'Não foi possível salvar.';
    return;
  }
  desenharGradeArgo(corpo);
  $('#argo-salvo').textContent = 'Salvo. Vale a partir da próxima rodada.';
}

document.addEventListener('click', (ev) => {
  if (ev.target && ev.target.id === 'argo-salvar') salvarGradeArgo();
});
```

Acrescentar `argo: carregarArgo,` ao mapa `R`, junto das outras abas.

- [ ] **Step 4: Verificar no navegador**

```bash
cd ~/OneDrive/tracking-avancado && npx wrangler pages dev . --port 8788
```

Abrir `localhost:8788/dash/`, clicar na aba Argo e confirmar: as rodadas gravadas aparecem, as quatro pausas históricas aparecem quando as rodadas antigas forem registradas, e o `<select>` de `pausar_campanha_trafego` mostra `executar`.

- [ ] **Step 5: Trocar uma permissão e confirmar que o script obedece**

Na aba, mudar `pausar_campanha_trafego` para `propor` e salvar. Depois, na VPS:

```bash
ssh root@31.97.241.169 'cd /root/.hermes/profiles/gestor-ia/scripts && ../.venv/bin/python -c "
import argo_estado as a
g = a.ler_grade(\"atacado-exponencial\")
print(\"pode executar:\", a.pode_executar(g, \"pausar_campanha_trafego\"))
"'
```

Esperado: `pode executar: False`. **Voltar para `executar` na aba em seguida** — deixar em `propor` é regressão do que já funciona.

- [ ] **Step 6: Rodar a suíte inteira**

```bash
cd ~/OneDrive/tracking-avancado && npm test
```

Esperado: todos os testes passam, inclusive os anteriores ao plano.

- [ ] **Step 7: Commit**

```bash
cd ~/OneDrive/tracking-avancado
git add public/dash/index.html
git commit -m "feat(argo): aba do dash mostra o registro e comanda a grade"
```

---

## O que este plano não faz

Fica para os planos seguintes, conforme a spec: recálculo automático da referência de custo por visita e a régua de MQL/CPL real (plano 2); realocar verba e aumentar orçamento na esteira (plano 3). O piso de R$ 100 do gatilho de pausa, a redação do feedback de cliente e as contas da agência seguem fora de escopo.

**Ponta solta conhecida:** a Task 3 passa a carregar `max_pausas_por_rodada` da grade e a Task 7 deixa você editá-lo, mas **nada neste plano aplica esse limite** — o laço de pausas continua percorrendo todos os candidatos. Na prática a conta nunca teve mais de dois candidatos numa rodada, então o limite nunca mordeu. Aplicá-lo é a primeira tarefa do plano 3, junto com os demais guardrails da esteira. Até lá, o campo na tela é informativo e a tela deve dizer isso.

**Desfazer ainda não existe.** A Task 1 guarda `estado_anterior` em toda ação, que é a base do rollback, e a Task 7 não desenha botão de desfazer. O botão entra no plano 3, quando o `executor.py` da esteira — que já sabe reverter — passar a ler dessas tabelas. Registrar o estado anterior desde agora é o que torna isso possível depois.

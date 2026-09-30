# 337: Coleta diária do perfil, seguidores e público

**Tipo:** Implementação
**Página:** Coleta automática (sem tela), módulo 1 e bloco 4b da spec `spec-central-marketing-instagram.md`

## Descrição

Criar a área `marketing` na Neon (com acesso restrito só a ela) e a coleta diária
na VPS que grava, para o @felipesantosae: números diários do perfil separados
entre orgânico e anúncio, seguidores ganhos e perdidos por dia, total de
seguidores, contas seguidas e posts, demografia de seguidores e de quem interagiu,
seguidores online por hora, e o registro de cada execução.

**É a primeira entrega por urgência:** a Meta só devolve seguidores por dia dos
últimos 30 dias. Cada dia sem esta coleta rodando é um dia perdido para sempre.

## Pronto quando

- O agendamento na VPS roda uma vez por dia sem ninguém mexer.
- Na primeira execução a Neon recebe os 30 dias disponíveis (seguidores ganhos e
  perdidos por dia, total reconstruído e marcado como tal, números diários do
  perfil pelo tempo que a Meta permitir).
- Uma consulta à Neon mostra o dia de ontem com alcance, visualizações e
  interações separados por tipo de conteúdo (anúncio à parte), seguidores ganhos
  e perdidos, e a foto do público do dia.
- Rodar a coleta duas vezes no mesmo dia não duplica nada.
- Uma falha da Meta (token recusado, erro num item) fica registrada com hora e
  motivo, e o resto da coleta segue.
- Nada foi gravado no D1.

## Observações

- Credencial: `META_ACCESS_TOKEN` já existente em `/root/.hermes/.env` (usuário do
  sistema "gestoria"). Nenhuma credencial nova.
- Medido em 29/09: `follows_and_unfollows` com `breakdown=follow_type` funciona por
  dia (FOLLOWER = ganhos, NON_FOLLOWER = perdidos); `follower_count` só aceita os
  últimos 30 dias; `online_followers` vem no fuso do Pacífico.
- A suíte de testes não pode falar com a Neon nem com a Meta reais (incidente de
  27/09 no gestor-ae).

## Onde o código mora

No perfil `gestor-ia` do Hermes na VPS (`/root/.hermes/profiles/gestor-ia/`), ao
lado do Argo, que é o que já coleta da Meta e grava na Neon com agendamento. O
repositório do tracking só recebe esta issue; a tela (340) é que mexe nele.

**Reaproveitado do Argo (ler antes de escrever):**
- `migrations/argo/aplicar.py` — aplicador de migrations com psycopg (a VPS não
  tem `psql`) e mensagem de erro que nunca vaza a senha. Copiado para
  `migrations/marketing/aplicar.py` trocando só a variável de ambiente.
- `scripts/venv_do_perfil.py` — **importar** e chamar
  `venv_do_perfil.garantir(__file__, "IG_COLETA_REEXEC")` no `__main__`; sem isso
  o Hermes roda com o Python do gateway, sem psycopg, e nada chega à Neon.
- `scripts/argo_estado.py` — padrão `ErroSeguroNeon` + `_conectar` que converte
  toda falha de conexão numa mensagem fixa (o stderr do cron vai para o Slack).
- `scripts/ae_trafego_monitor.py` (linhas ~219 e ~343) — leitura do
  `META_ACCESS_TOKEN` do `.env` e `requests.get` com timeout de 60 s.
- Agendamento: `hermes --profile gestor-ia cron create`, `no_agent: true`,
  `deliver: slack:C0BJK31RGM9`, igual ao job `5f38f2a95279` do executor.
- Testes: `unittest` + `unittest.mock`, como `test_argo_executor.py`; rodar com
  `.venv/bin/python -m unittest discover -p "test_ig_*.py"` (a VPS não tem pytest).

## Cenários

### Happy Path
1. O Hermes dispara `ig_coleta_diaria.py` todo dia às **06:30** (Brasília). O dia
   da Meta fecha à meia-noite do Pacífico, 04:00 de Brasília; 06:30 dá folga.
2. O script abre uma linha em `marketing.execucoes` (`coleta = 'diaria'`).
3. Para cada um dos **3 últimos dias fechados** (a Meta revisa números por uns
   dias), busca por dia:
   - `reach`, `views`, `total_interactions` com `breakdown=media_product_type`
     (grava o total e o JSON por tipo; o orgânico é a soma sem `AD`);
   - `profile_views`, `accounts_engaged`, `website_clicks`, `likes`, `comments`,
     `shares`, `saves`, `replies`, `reposts` (`metric_type=total_value`);
   - `follows_and_unfollows` com `breakdown=follow_type` → ganhos e perdidos.
   Grava com `INSERT ... ON CONFLICT (conta, dia) DO UPDATE`.
4. Lê `followers_count`, `follows_count`, `media_count` do perfil e grava como o
   total do dia de hoje (`total_reconstruido = false`).
5. Público: `follower_demographics` e `engaged_audience_demographics` por idade,
   gênero, cidade e país (`timeframe=this_month`), e `online_followers`. Converte
   as horas do fuso do Pacífico para Brasília **com `zoneinfo`** (respeita horário
   de verão dos EUA) e grava 0h–23h de Brasília.
6. Fecha a execução com `ok = true` e um resumo em `detalhe` (dias gravados,
   itens com erro). **Em sucesso não imprime nada** (não gera mensagem no Slack).

### Carga inicial (primeira execução)
- `ig_coleta_diaria.py --carga-inicial` busca **30 dias** de seguidores (o máximo
  que a Meta dá) e **90 dias** das métricas do perfil (base para comparar
  "30 dias anteriores" e "mês passado"). Os 90 dias são um parâmetro
  (`--dias-perfil`) para estender depois sem mudar código.
- Reconstrói o total de seguidores de cada um dos 30 dias de trás para frente:
  total de hoje menos o saldo de cada dia, gravado com `total_reconstruido = true`.
  Um total observado nunca é sobrescrito por um reconstruído.

### Edge Cases
- **Rodou duas vezes no mesmo dia:** o `ON CONFLICT` atualiza as mesmas linhas;
  nada duplica.
- **Dia de hoje incompleto:** nunca é coletado como dia fechado (em 29/09 o dia
  corrente veio 0/0 de seguidores).
- **Público de quem interagiu vazio** (aconteceu em 29/09): grava a linha com
  `valores = '{}'` e `vazio = true`; a tela mostra o aviso em vez de zerar.
- **Métrica que a Meta devolve sem `breakdowns`:** grava o total e `por_tipo`
  vazio; não inventa zero por tipo.
- **Ficou dias sem rodar** (VPS fora): a próxima execução olha a última data
  gravada e busca todos os dias faltantes até 30 dias atrás; antes disso, perdeu.
- **Horário de verão nos EUA** muda o deslocamento de +4h para +5h: por isso a
  conversão usa `zoneinfo`, nunca um número fixo.

### Cenário de Erro
- **Token recusado / permissão retirada** (erro OAuth da Meta): aborta a coleta,
  fecha a execução com `ok = false` e `erro` = mensagem da Meta, e escreve uma
  linha no stderr → chega ao Slack pelo `deliver` do job.
- **Erro num item** (um dia, uma dimensão do público): registra em
  `detalhe.erros` e segue para o próximo; a execução termina `ok = true` com os
  erros listados. Se **todos** os dias falharem, termina `ok = false`.
- **Neon fora:** `ErroSeguroNeon` com mensagem fixa ("Falha ao conectar à Neon
  (schema marketing); verifique MARKETING_DATABASE_URL") no stderr; nunca a DSN.
- **Limite de chamadas da Meta** (código 4/17/32/613): espera 60 s e tenta de
  novo até 3 vezes; persistindo, trata como erro do item.

## Banco de Dados

Neon, banco do `gestor-exponencial`, **schema `marketing`** (novo).

**Provisionamento (feito uma vez, com o papel dono `neondb_owner`, a partir da
máquina local; a credencial do dono não vai para a VPS nem para o repositório):**
- `CREATE SCHEMA marketing;`
- papel `marketing_rw` (LOGIN): `USAGE, CREATE ON SCHEMA marketing`; sem acesso a
  `public` nem a `argo` (provar com "permission denied").
- papel `marketing_ro` (LOGIN): `USAGE ON SCHEMA marketing` +
  `ALTER DEFAULT PRIVILEGES FOR ROLE marketing_rw IN SCHEMA marketing GRANT SELECT
  ON TABLES TO marketing_ro`. É o que o dash vai usar na 340.
- `MARKETING_DATABASE_URL` (rw) vai para `/root/.hermes/profiles/gestor-ia/.env`.
  A URL do `marketing_ro` fica guardada no mesmo `.env` como
  `MARKETING_RO_DATABASE_URL` até a 340 levá-la ao Pages.

**Tabelas (migration `0001_instagram.sql`):**

- Tabela: `marketing.execucoes`
  - `id` (BIGSERIAL PK)
  - `coleta` (TEXT) — `diaria`, `stories` (338), `posts` (339)
  - `conta` (TEXT) — `felipesantosae`
  - `iniciada_em` / `concluida_em` (TIMESTAMPTZ)
  - `ok` (BOOLEAN) — null enquanto roda
  - `erro` (TEXT) — motivo da falha geral
  - `detalhe` (JSONB) — dias gravados, erros por item
  - índice `(conta, coleta, iniciada_em DESC)` — base do "atualizado há" e do aviso de coleta atrasada

- Tabela: `marketing.ig_perfil_diario` — PK `(conta, dia)`
  - `conta` (TEXT), `dia` (DATE) — dia da Meta (meia-noite a meia-noite do Pacífico)
  - `alcance_total` (INT), `alcance_por_tipo` (JSONB) — ex. `{"REEL":..,"AD":..}`
  - `views_total` (INT), `views_por_tipo` (JSONB)
  - `interacoes_total` (INT), `interacoes_por_tipo` (JSONB)
  - `visitas_perfil`, `contas_engajadas`, `toques_link`, `curtidas`, `comentarios`,
    `compartilhamentos`, `salvamentos`, `respostas`, `reposts` (INT, null = Meta não informou)
  - `seguidores_ganhos`, `seguidores_perdidos` (INT, null = fora da janela de 30 dias)
  - `seguidores_total` (INT), `seguindo_total` (INT), `posts_total` (INT)
  - `total_reconstruido` (BOOLEAN) — total calculado de trás para frente
  - `atualizado_em` (TIMESTAMPTZ)

- Tabela: `marketing.ig_publico` — PK `(conta, dia, publico, dimensao)`
  - `publico` (TEXT) — `seguidores` | `engajados`
  - `dimensao` (TEXT) — `idade` | `genero` | `cidade` | `pais`
  - `valores` (JSONB) — `{"35-44": 8758, ...}`
  - `vazio` (BOOLEAN) — a Meta não devolveu dados

- Tabela: `marketing.ig_online` — PK `(conta, dia)`
  - `dia` (DATE) — dia informado pela Meta
  - `por_hora` (JSONB) — 24 posições, já em horário de Brasília
  - `atualizado_em` (TIMESTAMPTZ)

## Arquivos

(caminhos relativos a `/root/.hermes/profiles/gestor-ia/`)

- **Criar:** `migrations/marketing/0001_instagram.sql` — as quatro tabelas e o índice
- **Criar:** `migrations/marketing/aplicar.py` — cópia do aplicador do Argo lendo `MARKETING_DATABASE_URL`
- **Criar:** `scripts/ig_meta.py` — cliente da Graph API do Instagram: token do `.env`, `get` com retry de limite, e funções puras que interpretam respostas (breakdown por tipo, ganhos/perdidos, público, online convertido para Brasília)
- **Criar:** `scripts/ig_estado.py` — único ponto que fala com o schema `marketing`: conexão segura, abrir/fechar execução, gravar dia do perfil, total de seguidores (sem sobrescrever observado por reconstruído), público e online
- **Criar:** `scripts/ig_coleta_diaria.py` — orquestra a coleta diária e a carga inicial (`--carga-inicial`, `--dias-perfil`); silencioso em sucesso
- **Criar:** `scripts/test_ig_coleta.py` — testes das funções puras (breakdown, fuso com e sem horário de verão, reconstrução do total, dia incompleto ignorado, público vazio) e do orquestrador com Meta e Neon simulados
- **Modificar:** `/root/.hermes/profiles/gestor-ia/.env` — `MARKETING_DATABASE_URL` e `MARKETING_RO_DATABASE_URL` (gravadas com `printf`, sem BOM)
- **Modificar:** `/root/.hermes/profiles/gestor-ia/cron/jobs.json` — via `hermes cron create`, nunca à mão

> Nada neste repositório do tracking muda nesta issue além deste arquivo.

## Dependências Externas

- `psycopg` — já instalado no `.venv` do perfil (usado pelo Argo)
- `requests` — já usado pelos monitores
- `zoneinfo` — biblioteca padrão do Python (conversão Pacífico → Brasília)
- Graph API do Instagram v21.0 — endpoints `/{ig-user-id}` e `/{ig-user-id}/insights`, já testados em 29/09

## Checklist

- [x] Provisionar na Neon (com `neondb_owner`, local): schema `marketing`, papéis `marketing_rw` e `marketing_ro`, grants e default privileges
- [x] Provar isolamento: `marketing_rw` recebe "permission denied" em `public` e `argo`; `marketing_ro` não consegue `INSERT`
- [x] Gravar `MARKETING_DATABASE_URL` e `MARKETING_RO_DATABASE_URL` no `.env` do perfil sem BOM e conferir por sha256
- [x] Escrever `0001_instagram.sql` e `aplicar.py`; aplicar e listar as tabelas
- [x] Escrever `test_ig_coleta.py` primeiro (funções puras + orquestrador simulado) e ver falhar
- [x] Escrever `ig_meta.py`, `ig_estado.py`, `ig_coleta_diaria.py` até os testes passarem
- [x] Rodar a suíte com `MARKETING_DATABASE_URL` vazia e `.env` inexistente (falha fechada) e depois na VPS; conferir que nenhum count mudou em `marketing.*` nem em `argo.*`
- [x] Rodar `--carga-inicial` de verdade e conferir na Neon: 30 dias de ganhos/perdidos batendo com o que a prévia mostrou, total de hoje = 25.6xx, dias reconstruídos marcados, 90 dias de perfil, público e online
- [x] Rodar a coleta diária duas vezes seguidas e conferir que os counts não mudam
- [x] Rodar com o Python do gateway (`/usr/local/lib/hermes-agent/venv/bin/python3`) para provar a troca de venv
- [x] Criar o job no Hermes (06:30 todo dia, `no_agent`, `deliver` Slack) e disparar com `cron run`; conferir `last_status: ok` e nova linha em `marketing.execucoes`
- [x] Commitar no repositório do perfil (mesmo lugar dos commits do Argo)

## Resultado (29/09/2026, no ar)

- **Repositório:** `gestor-ae` (local em `OneDrive/gestor-ae`, commit `4918ac1`, não enviado ao GitHub). Mapa: `migrations/marketing/` → `/root/.hermes/profiles/gestor-ia/migrations/marketing/`; `profiles/gestor-ia/scripts/` → mesmo caminho na VPS.
- **Job Hermes:** `3ab7345ba605`, `30 6 * * *`, `no_agent`, entrega no Slack só quando falha.
- **Carga inicial:** 90 dias de perfil (01/07 a 28/09), 30 dias de seguidores batendo dia a dia com a série oficial `follower_count` (640 ganhos, 329 perdidos), 31 dias de total coerentes, público de seguidores com 4 dimensões, público de engajados marcado como vazio, online de 27/09.
- **Isolamento provado:** `marketing_rw` e `marketing_ro` recebem "permission denied" em `argo` e `public`; `marketing_ro` não grava.
- 30 testes, 0,2 s, sem rede.

### Desvios do plano (medidos, não inventados)

- **Janela do dia:** a Graph soma todo dia cujo `end_time` cai em `[since, until]` com as duas pontas; meia-noite a meia-noite somava dois dias. `intervalo_do_dia` termina no fechamento do dia e começa 12h antes. A primeira carga saiu dobrada e foi regravada por cima.
- **Revisão de 5 dias, não 3:** a Meta levou mais de 17h para preencher os seguidores de um dia fechado.
- **Reconstrução do total:** nos 5 dias mais recentes, saldo ainda não informado conta como zero (as coletas seguintes corrigem); fora disso, para no primeiro buraco.
- **Não importei o `ae_trafego_monitor.py`:** ele troca de Python já no import; o padrão de token no cabeçalho e erro sem segredo foi reproduzido em `ig_meta.get`.

### Para a 340 (tela)

- O último dia fechado costuma vir com seguidores `null` (Meta ainda preenchendo): mostrar como "ainda chegando", não zero.
- `MARKETING_RO_DATABASE_URL` está no `.env` do perfil na VPS, esperando ir para o Pages.
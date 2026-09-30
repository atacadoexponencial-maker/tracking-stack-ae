# 338: Coleta de stories antes de expirarem

**Tipo:** Implementação
**Página:** Coleta automática (sem tela), módulo 1 da spec `spec-central-marketing-instagram.md`

## Descrição

Coletar, várias vezes ao dia, cada story no ar do @felipesantosae com alcance,
visualizações, respostas, compartilhamentos, interações, navegação (avançou,
voltou, saiu, pulou), visitas ao perfil, seguidores gerados e miniatura, guardando
a hora da última captura e mantendo o último número depois que o story expira.

## Pronto quando

- O agendamento roda várias vezes ao dia na VPS, de modo que a última captura de
  cada story fica a no máximo poucas horas do fim das 24h.
- Um story publicado hoje aparece na Neon com números que sobem a cada captura, e
  continua lá, com o último número, depois de expirar.
- Cada story tem registrada a hora da última captura (base do selo "captura
  parcial" na tela).
- Capturar o mesmo story de novo atualiza a linha em vez de duplicar.
- Falha registrada em log de execução, sem derrubar as outras capturas.

## Observações

- Stories anteriores ao primeiro dia desta coleta não podem ser recuperados.
- Reaproveita a área `marketing`, a conexão e o registro de execuções da 337.
- A miniatura precisa ser guardada (o link da Meta expira).

## Onde o código mora

Repositório `gestor-ae`, igual à 337 (`migrations/marketing/`,
`profiles/gestor-ia/scripts/`), sincronizado para o perfil `gestor-ia` na VPS.

**Reaproveitado da 337 (importar, não copiar):** `ig_meta.get` (token no
cabeçalho, retry de limite, `TokenRecusado`/`ErroDoMeta`), `ig_meta.IG_USER_ID`/
`CONTA`, `ig_estado.conectar`/`abrir_execucao`/`fechar_execucao`/`ErroSeguroNeon`,
`venv_do_perfil.garantir`, e o padrão de teste de `test_ig_coleta.py` (credenciais
apagadas em `setUpModule`, Meta e Neon falsas).

## Cenários

### Happy Path
1. O Hermes dispara `ig_coleta_stories.py` **de hora em hora, no minuto 17**. Com
   isso a última captura de um story fica a no máximo 1h do fim das 24h.
2. Abre execução com `coleta = 'stories'`.
3. Lista `/{ig}/stories` (`id, media_type, timestamp, permalink, thumbnail_url, media_url`).
4. Para cada story: `insights` com `reach, views, replies, shares,
   total_interactions, follows, profile_visits` e, numa segunda chamada,
   `navigation` com `breakdown=story_navigation_action_type`.
5. Na **primeira** captura de um story, baixa a miniatura (`thumbnail_url` para
   vídeo, `media_url` para imagem), reduz para 180 px de largura em JPEG
   qualidade 60 e guarda como `data:image/jpeg;base64,...`. Nas capturas
   seguintes não baixa de novo.
6. Grava com `ON CONFLICT (story_id) DO UPDATE`: números, navegação,
   `ultima_captura_em = now()`, `capturas = capturas + 1`.
7. Fecha a execução `ok = true`. Silencioso em sucesso.

### Edge Cases
- **Nenhum story no ar:** execução `ok = true` com `detalhe.stories = 0`; nada mais.
- **Story expirou entre a listagem e os insights:** a Meta devolve erro de item;
  registra e segue. A linha fica com o último número já capturado.
- **Miniatura falhou ao baixar:** grava o story sem miniatura e tenta de novo na
  próxima captura (só baixa quando `miniatura IS NULL`).
- **Navegação sem `breakdowns`:** guarda `navegacao = {}`, nunca zeros inventados.
- **Rodou duas vezes na mesma hora:** atualiza a mesma linha.

### Cenário de Erro
- **Token recusado:** para tudo, `ok = false`, stderr → Slack.
- **Erro num story:** vai para `detalhe.erros`, os outros seguem.
- **Neon fora:** `ErroSeguroNeon` com mensagem fixa, nunca a DSN.

## Banco de Dados

- Tabela: `marketing.ig_stories` — PK `story_id` (migration `0002_stories.sql`)
  - `story_id` (TEXT), `conta` (TEXT)
  - `publicado_em` (TIMESTAMPTZ) — `timestamp` da Meta
  - `tipo` (TEXT) — IMAGE | VIDEO
  - `link` (TEXT) — permalink
  - `miniatura` (TEXT) — data URI JPEG ~5 KB
  - `alcance`, `views`, `respostas`, `compartilhamentos`, `interacoes`,
    `seguidores`, `visitas_perfil` (INT, null = Meta não informou)
  - `navegacao` (JSONB) — `{"tap_forward":..,"tap_back":..,"tap_exit":..,"swipe_forward":..}`
  - `primeira_captura_em`, `ultima_captura_em` (TIMESTAMPTZ), `capturas` (INT)
  - índice `(conta, publicado_em DESC)`
  - o `GRANT SELECT` para `marketing_ro` vem do `ALTER DEFAULT PRIVILEGES` da 0001

## Arquivos

- **Criar:** `migrations/marketing/0002_stories.sql` — tabela `ig_stories` e índice
- **Criar:** `profiles/gestor-ia/scripts/ig_coleta_stories.py` — orquestra a captura (lista, insights, navegação, miniatura, gravação)
- **Criar:** `profiles/gestor-ia/scripts/test_ig_stories.py` — testes com Meta e Neon falsas
- **Modificar:** `profiles/gestor-ia/scripts/ig_meta.py` — funções puras `metricas_do_story(resp)` e `miniatura_data_uri(bytes)` (redução com Pillow)
- **Modificar:** `profiles/gestor-ia/scripts/ig_estado.py` — `story_tem_miniatura` e `gravar_story`

## Dependências Externas

- `Pillow` — **instalar no `.venv` do perfil** (`pip install Pillow`); hoje só o Python do sistema tem. Reduz a miniatura para ~5 KB (≈18 MB por ano no ritmo atual de stories).
- Graph API: `/{ig-user-id}/stories`, `/{story-id}/insights` (testados em 29/09).

## Checklist

- [x] Instalar Pillow no `.venv` do perfil
- [x] Escrever `test_ig_stories.py` (métricas, navegação vazia, miniatura só na primeira vez, erro de item segue, token recusado para tudo, sem stories)
- [x] `0002_stories.sql` + aplicar; conferir que `marketing_ro` lê a tabela nova
- [x] Funções em `ig_meta.py` e `ig_estado.py`; `ig_coleta_stories.py` até os testes passarem
- [x] Suíte completa (`test_ig_*.py`) com `env -i`
- [x] Rodar de verdade com o Python do gateway; conferir os stories no ar gravados com miniatura
- [x] Rodar de novo e conferir `capturas = 2` e nenhuma linha nova
- [x] Job Hermes `17 * * * *`, `no_agent`, Slack; `cron run` e `last_status: ok`
- [x] Commit no `gestor-ae`

## Resultado (29/09/2026, no ar)

- `gestor-ae` commit seguinte ao `4918ac1`; job Hermes `664dfb48f42b` (`17 * * * *`).
- Pillow 12.3.0 instalado no `.venv` do perfil.
- Primeira captura: 3 stories no ar (28/09 21:46, 29/09 13:48 e 16:33), com
  navegação e miniatura de 6 a 13 KB; segunda captura atualizou as mesmas linhas
  (`capturas = 2`).
- 41 testes da suíte `test_ig_*.py`, 0,3 s, sem rede.
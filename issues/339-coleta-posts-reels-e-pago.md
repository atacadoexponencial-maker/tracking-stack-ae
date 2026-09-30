# 339: Coleta de posts e reels, com o pago de cada um

**Tipo:** Implementação
**Página:** Coleta automática (sem tela), módulo 1 da spec `spec-central-marketing-instagram.md`

## Descrição

Coletar diariamente os posts do feed e reels do @felipesantosae (tipo, data,
legenda, link, miniatura e as métricas de cada formato), atualizando os números
dos publicados nos últimos 30 dias, e ligar cada post aos anúncios da conta
CA_AtacadoExponencial que o usam, gravando alcance pago, impressões,
visualizações pagas, investimento e campanhas.

## Pronto quando

- Na primeira execução a Neon recebe o histórico de posts que a Meta permitir,
  com as métricas orgânicas de cada um.
- Um post novo aparece no dia seguinte; um post de 10 dias atrás tem os números
  atualizados a cada dia.
- Reels têm tempo médio e total assistido; carrosséis e fotos têm visitas ao
  perfil e seguidores gerados; o que não se aplica fica vazio, nunca zero.
- Os reels impulsionados conhecidos em 29/09 (por exemplo o de 01/07, 380 de
  alcance orgânico e 63.929 pago, R$ 743,96) aparecem com o pago separado.
- Posts feitos só para anúncio (tipo AD) não entram.
- Erro num post específico fica registrado e a coleta segue.

## Observações

- O vínculo post ↔ anúncio vem de `creative.source_instagram_media_id` e
  `effective_instagram_media_id`; olhar só o segundo perde os impulsionados
  (erro cometido e corrigido em 29/09). Precisa paginar e incluir anúncios
  pausados e arquivados.
- As métricas do post pela Meta são só orgânicas, mesmo quando impulsionado.

## Onde o código mora

Repositório `gestor-ae`, igual à 337/338. **Importar:** `ig_meta.get`,
`ig_meta.miniatura_data_uri`, `ig_estado.conectar/abrir_execucao/fechar_execucao`,
`ig_coleta_stories.baixar` (download da miniatura), `venv_do_perfil.garantir`, e
o padrão de teste com Meta e Neon falsas.

## Cenários

### Happy Path
1. O Hermes dispara `ig_coleta_posts.py` todo dia às **06:45** (depois da coleta diária).
2. Abre execução `coleta = 'posts'`.
3. Lista `/{ig}/media` (`id, caption, media_type, media_product_type, timestamp,
   permalink, thumbnail_url, media_url`), paginando até o primeiro post com mais
   de 30 dias.
4. **Pago, em duas chamadas paginadas** na conta `act_4577256079174658`:
   - `/ads` com `creative{source_instagram_media_id,effective_instagram_media_id}`
     e `campaign{name}`, todos os status (ativos, pausados, arquivados) → mapa
     anúncio → post;
   - `/insights?level=ad&date_preset=maximum` com `ad_id, reach, impressions,
     spend, actions, date_start, date_stop` → números de cada anúncio.
   Soma por post: alcance pago, impressões, visualizações pagas (`video_view`),
   investimento, lista de campanhas e período (primeiro início, último fim).
5. Conjunto a atualizar = posts dos últimos 30 dias ∪ posts usados em anúncio
   (um reel antigo impulsionado hoje também é atualizado; se ainda não estiver
   na Neon, busca os campos dele pelo id).
6. Para cada post: insights por formato
   - Reel (`media_product_type = REELS`): `reach, views, likes, comments, shares,
     saved, total_interactions, ig_reels_avg_watch_time, ig_reels_video_view_total_time`
   - Carrossel / Foto (`FEED`): `reach, views, likes, comments, shares, saved,
     total_interactions, profile_visits, follows`
7. Miniatura só na primeira vez (mesma regra dos stories).
8. Grava com `ON CONFLICT (media_id) DO UPDATE`. Silencioso em sucesso.

### Carga inicial
`--carga-inicial` percorre **todos** os posts do perfil (299 em 29/09), não só 30 dias.

### Edge Cases
- **Post do tipo AD** (feito só para anúncio): nunca entra, nem pelo mapa de anúncios.
- **Métrica que não se aplica ao formato:** não é pedida; a coluna fica null.
- **Anúncio sem números** (nunca veiculou): conta como vínculo, com pago zero
  só se a Meta devolver zero; sem linha em insights, fica null.
- **Post apagado do perfil:** some da listagem; a linha antiga fica na Neon com
  os últimos números.
- **Rodou duas vezes:** atualiza as mesmas linhas.

### Cenário de Erro
- **Token recusado:** para tudo, `ok = false`, stderr → Slack.
- **Erro num post:** vai para `detalhe.erros`, os outros seguem.
- **Falha só na parte do pago** (conta de anúncios): os posts orgânicos são
  gravados mesmo assim; o erro vai para `detalhe.erros` e o pago fica como estava.
- **Neon fora:** `ErroSeguroNeon` com mensagem fixa.

## Banco de Dados

- Tabela: `marketing.ig_posts` — PK `media_id` (migration `0003_posts.sql`)
  - `media_id` (TEXT), `conta` (TEXT)
  - `formato` (TEXT) — `Reel` | `Carrossel` | `Foto`
  - `publicado_em` (TIMESTAMPTZ), `legenda` (TEXT), `link` (TEXT), `miniatura` (TEXT)
  - `alcance`, `views`, `curtidas`, `comentarios`, `compartilhamentos`,
    `salvamentos`, `interacoes` (INT)
  - `tempo_medio_ms`, `tempo_total_ms` (BIGINT) — só reels
  - `visitas_perfil`, `seguidores` (INT) — só carrossel e foto
  - `pago_alcance`, `pago_impressoes`, `pago_views` (INT), `pago_investimento`
    (NUMERIC(12,2)), `pago_campanhas` (JSONB), `pago_inicio`, `pago_fim` (DATE)
    — null quando o post nunca foi usado em anúncio
  - `atualizado_em` (TIMESTAMPTZ) — hora da última atualização dos números
  - índice `(conta, publicado_em DESC)`

## Arquivos

- **Criar:** `migrations/marketing/0003_posts.sql` — tabela `ig_posts`
- **Criar:** `profiles/gestor-ia/scripts/ig_coleta_posts.py` — orquestra listagem, pago, insights, miniatura e gravação (`--carga-inicial`)
- **Criar:** `profiles/gestor-ia/scripts/test_ig_posts.py` — testes com Meta e Neon falsas
- **Modificar:** `profiles/gestor-ia/scripts/ig_meta.py` — `formato_do_post`, `metricas_do_post` (generaliza a leitura `lifetime` de `metricas_do_story`), `pago_por_post` (junta anúncios + insights)
- **Modificar:** `profiles/gestor-ia/scripts/ig_estado.py` — `post_tem_miniatura`, `gravar_post`, `gravar_pago`

## Checklist

- [x] Testes em `test_ig_posts.py` (formato, métricas por formato, soma do pago com 2 anúncios no mesmo post, AD ignorado, post antigo impulsionado entra, falha no pago não derruba orgânico, erro num post segue, token recusado)
- [x] `0003_posts.sql` + aplicar
- [x] Funções e orquestrador até a suíte `test_ig_*.py` passar com `env -i`
- [x] `--carga-inicial` de verdade; conferir o reel de 01/07 (orgânico ~380, pago ~63.929, R$ ~743,96)
- [x] Rodar a diária duas vezes; nenhuma linha nova
- [x] Job Hermes `45 6 * * *`, `cron run`, `last_status: ok`
- [x] Commit no `gestor-ae`

## Resultado (29/09/2026, no ar)

- `gestor-ae` commit seguinte ao `1bcf39a`; job Hermes `8cb5d32b07a3` (`45 6 * * *`).
- Carga inicial: **280 posts** (146 reels, 94 carrosséis, 40 fotos), todos com
  miniatura; 14 com pago. A Meta conta 299 no perfil, mas a listagem da API só
  entrega 280 (os 19 restantes não são alcançáveis).
- Reel de 01/07: 380 orgânico, 63.929 pago, R$ 745,10, rodando desde 20/07.
- Coleta diária: 23 posts (recentes + impulsionados), 84 s, sem erros.
- 54 testes da suíte `test_ig_*.py`, sem rede.

### Desvios do plano (medidos)

- **Período do anúncio:** `date_start`/`date_stop` com `date_preset=maximum`
  são o intervalo da consulta, e `updated_time` não muda ao pausar. O período é
  o primeiro e o último dia com gasto (`time_increment=1`); fim null = ainda em
  veiculação.
- **10 posts antigos sem insights** (9 fotos de 2016–2020, anteriores à conta
  comercial: "Invalid parameter"; 1 vídeo de feed de 2022: só `reach`/`saved`):
  entram com curtidas e comentários públicos e o que a Meta der; ficam listados
  em `detalhe.sem_insights`, não em erros.
- **Anúncio sem números** (nunca veiculou): pago null, não zero.
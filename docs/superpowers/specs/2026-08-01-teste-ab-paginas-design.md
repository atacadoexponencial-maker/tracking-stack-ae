# Sistema de teste A/B de páginas

**Data:** 2026-08-01
**Status:** design aprovado, aguardando plano de implementação

## Problema

Hoje o teste A/B do projeto é manual: cria-se uma página nova (`/lives-semanais-v2` ao lado da `/lives-semanais-v1`), aponta-se tráfego diferente para cada uma e compara-se o resultado na tabela "Conversão por LP" do dashboard.

Isso tem três furos:

1. **O tráfego não é comparável.** Cada página recebe visitantes de origens e momentos diferentes, então a diferença de conversão pode ser da página ou do público.
2. **Cada variante precisa do seu próprio link.** Trocar o que está sendo testado exige trocar o criativo do anúncio.
3. **Não há leitura estatística.** A tabela mostra duas taxas; nada diz se a diferença é real ou ruído.

## Objetivo

Permitir que uma mesma URL sirva duas versões de página a metades comparáveis do tráfego, com o visitante fixado numa versão, e que o dashboard diga com honestidade quando (e se) há um vencedor.

## Volume disponível e o que ele permite

Dados reais de julho/2026 (critério de bot igual ao da `/api/conversion`):

| LP | Visitas | Leads | Taxa |
|---|---|---|---|
| `/` (home) | 4.884 (+316 no `www`) | 54 | 1,1% |
| `/lives-semanais-v1` | 1.232 | 70 | 5,7% |
| `/trafego-atacado` | 691 | 11 | 1,6% |
| `/aplicacao-mentoria` | 73 | 2 | 2,7% |

O número de leads necessários **por variante** depende basicamente do tamanho da diferença a detectar, não da taxa da página:

| Diferença a detectar | Leads por variante | Total no teste |
|---|---|---|
| +100% (dobro) | ~16 | ~32 |
| +50% | ~60 | ~120 |
| +30% | ~170 | ~340 |
| +20% | ~390 | ~780 |
| +10% | ~1.600 | ~3.200 |

**Consequência assumida no design:** com ~54 leads/mês na home, o sistema serve para testar mudanças grandes (nova oferta, página inteira nova, com vídeo vs sem vídeo), que concluem em 2-4 semanas. Variações pontuais de copy raramente sairão de "tendência". O sistema suporta as duas tecnicamente; a limitação é de amostra, não de arquitetura.

Isso está alinhado com a recomendação corrente para sites de baixo tráfego: testar ideias grandes, não detalhes.

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo do teste | Página inteira **e** variação pontual | Mesmo mecanismo serve aos dois |
| Métrica de decisão | `Lead` | Mesma definição já usada pela `/api/conversion` |
| Métrica de acompanhamento | `FormStart` | Sinal antecipado, 3-5x mais amostra; não decide o teste |
| Divisão de tráfego | URL única, variante servida por reescrita interna | Link do anúncio estável, sem flicker, sem URL feia |
| Configuração | Tabela no D1 + aba no dashboard | Pausar um teste ruim sem depender de deploy |
| Leitura | Alvo declarado antes + semáforo no fim | Evita o peeking (ver abaixo) |
| Fora de escopo | LPs de live (`/lives-semanais-*`) | Não têm formulário; decisão da usuária |

### Por que o alvo é declarado antes de começar

Verificar o resultado todos os dias e parar assim que a significância aparece — o chamado *peeking* — infla a taxa de falso positivo de 5% para mais de 30%. Um painel que mostra o veredito ao vivo convida exatamente o erro que deveria evitar.

Por isso o teste declara, na criação, **quantos leads por variante** e **quantos dias** vai rodar. Enquanto roda, o painel mostra números e progresso, mas não veredito. O veredito só aparece quando os dois alvos são atingidos.

O mínimo de dias é **14, em semanas inteiras**: terça e domingo convertem diferente, e um teste que fecha em 9 dias mede dia da semana, não página.

## Arquitetura

### Fluxo de uma requisição

```
GET /aplicacao-mentoria
  │
  ├─ 1. existe teste ativo para este path?   (ab_tests, cache de 60s em memória)
  │      não → fluxo atual inalterado
  │      sim ↓
  ├─ 2. cookie _krob_ab já traz a variante deste teste?
  │      sim → usa
  │      não → sorteia por hash do _krob_sid, grava no cookie (30 dias)
  │
  ├─ 3. variante A → next()
  │      variante B → next(url de /ab/<slug>/b)   ← URL na barra não muda
  │
  └─ 4. waitUntil: UPSERT em sessions (como hoje) + INSERT em ab_assignments
```

Tudo acontece no `functions/_middleware.js`, que já intercepta toda requisição de página HTML e já cria o `_krob_sid` antes de qualquer decisão.

### Três propriedades do sorteio

**Determinístico pelo `session_id`.** A variante é `hash(session_id + slug do teste) % 100` comparado com os pesos. Sorteio aleatório puro poderia dar variantes diferentes para requisições simultâneas do mesmo visitante; o hash torna a variante uma função do visitante, estável mesmo que o cookie da variante se perca.

**First-touch, como as UTMs.** Quem entrou como B continua B enquanto o teste durar. Sem isso, alguém poderia ver A, voltar, ver B e converter — e o lead seria creditado à variante errada.

**Falha para A.** Se o D1 estiver fora ou a consulta falhar, o middleware serve a variante A e segue. Um teste quebrado nunca pode derrubar o site.

### Custo de latência

A `ab_tests` terá 1-3 linhas. O middleware mantém o resultado em cache por 60 segundos na memória do isolate, então a esmagadora maioria das requisições não toca o D1. A gravação em `ab_assignments` vai em `waitUntil`, fora do caminho da resposta.

### Como uma variante é escrita

A variante B é uma página Astro real em `src/pages/ab/<slug>/b.astro`. O mesmo mecanismo atende aos dois tipos de teste:

- **Página inteira diferente:** o arquivo tem outras seções e outro layout.
- **Variação pontual:** o arquivo tem poucas linhas e reusa os mesmos componentes com props diferentes. A `/trafego-atacado` já faz isso hoje — todo o copy vem de arrays no frontmatter passados como props.

Essas páginas recebem `noindex` e ficam fora do sitemap. O middleware responde **404** para requisições diretas a `/ab/...`, exceto no modo preview. Sem isso, o Google indexaria conteúdo duplicado e visitantes poderiam entrar na variante fora do sorteio, sujando a medição.

### Modo preview

`/ab/<slug>/b?ab_preview=1` abre a variante diretamente e marca a sessão com `is_preview = 1` em `ab_assignments`. Sessões de preview são excluídas de toda estatística. Sem isso, conferir a própria variante contamina o resultado.

### Cache

Respostas de páginas sob teste levam `Cache-Control: private, no-store`. Na prática o middleware já anexa `Set-Cookie` em toda resposta de página, o que por si só impede o cache de borda, mas o cabeçalho explícito protege contra proxies intermediários servirem a variante errada.

## Dados

### Migration `0031_ab_testes.sql`

**`ab_tests`** — um registro por teste.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | INTEGER PK | |
| `slug` | TEXT UNIQUE | ex.: `home-oferta-2026-08`; usado no path da variante |
| `nome` | TEXT | rótulo exibido no painel |
| `path` | TEXT | path testado, normalizado (ex.: `/`) |
| `status` | TEXT | `rascunho` \| `ativo` \| `pausado` \| `encerrado` |
| `meta_leads_variante` | INTEGER | alvo declarado antes de iniciar (padrão 60) |
| `meta_dias` | INTEGER | mínimo 14, múltiplo de 7 (padrão 14) |
| `started_at` | INTEGER | segundos; preenchido ao ativar pela primeira vez |
| `ended_at` | INTEGER | segundos |
| `vencedor` | TEXT | `a` \| `b` \| `nenhum`, registrado ao encerrar |
| `created_at`, `updated_at` | INTEGER | segundos, como no restante do schema |

Regra: no máximo um teste com `status` em (`ativo`, `pausado`) por `path`. Dois testes na mesma página se contaminam.

**`ab_variants`**

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | INTEGER PK | |
| `test_id` | INTEGER | FK para `ab_tests` |
| `chave` | TEXT | `a` \| `b` |
| `page_path` | TEXT | vazio para `a` (usa o path original); `/ab/<slug>/b` para `b` |
| `peso` | INTEGER | soma 100 entre as variantes do teste |

`UNIQUE(test_id, chave)`.

**`ab_assignments`** — log de exposição.

| Coluna | Tipo | Observação |
|---|---|---|
| `session_id` | TEXT | |
| `test_id` | INTEGER | |
| `variante` | TEXT | `a` \| `b` |
| `assigned_at` | INTEGER | segundos |
| `is_preview` | INTEGER | 0 \| 1 |

`UNIQUE(session_id, test_id)` — a gravação usa `INSERT ... ON CONFLICT DO NOTHING`, garantindo o first-touch no banco e não só no cookie.

**Exclusões na leitura.** Bots são sorteados normalmente (o middleware não os distingue no momento da requisição), mas ficam fora da estatística: a leitura descarta sessões com `is_preview = 1` e aplica os mesmos filtros de bot já usados pela `/api/conversion` (`user_agent` presente, com 10+ caracteres, fora da lista de assinaturas de robô). Leads seguem exigindo `is_bot = 0` e `is_junk = 0`.

Esta tabela é o denominador do teste. Registrar a exposição no servidor é necessário porque decidir só no edge, confiando no cookie, enviesa a amostra. Como efeito colateral desejável, ela **elimina a dependência da normalização de `landing_url`** — a mesma que hoje faz `/se-v1`, `/se-v1/` e `https://www.atacadoexponencial.com/` aparecerem como linhas separadas na consulta de conversão.

Aplicar com `wrangler d1 execute --remote`, nunca `migrations apply --remote` (0021/0022/0025 quebram ao reaplicar).

### Evento `FormStart`

Disparado no primeiro `input` de um formulário de captação, uma vez por sessão e por formulário. Vai para o `/tracker` existente, reusando enriquecimento de sessão, detecção de bot e marcação `is_junk`.

O `tracker.js` ganha uma lista de **eventos internos**: gravam no `event_log` e **não** disparam Meta CAPI, GA4, ClickUp, GoHighLevel nem webhooks. Nada muda nas integrações atuais.

Os formulários que passam a emitir o evento: `AplicacaoForm.astro`, `LeadChat.astro`, `LeadFormModal.astro` e o form inline de `materiais/[slug].astro`. O disparo fica na validação compartilhada (`src/scripts/lead-validacao.ts`) sempre que possível, para não repetir a lógica em quatro lugares.

## Painel

Aba **Testes A/B** no `public/dash/index.html`, no molde da aba Links, consumindo `functions/api/ab-tests.js` (autenticado por `DASH_KEY`, como os demais endpoints).

```
Home — oferta nova            ATIVO · dia 9 de 14
┌──────────┬─────────┬────────────┬───────┬───────────┐
│ Variante │ Visitas │ Form. inic.│ Leads │ Conversão │
├──────────┼─────────┼────────────┼───────┼───────────┤
│ A atual  │  1.204  │    148     │  14   │   1,16%   │
│ B nova   │  1.191  │    226     │  23   │   1,93%   │
└──────────┴─────────┴────────────┴───────┴───────────┘
  Progresso: 37 de 120 leads · faltam 5 dias
  ⏳ Ainda rodando — não decida agora
  ✓ Divisão equilibrada (50,3% / 49,7%)
```

**Estados do veredito:**

| Estado | Condição |
|---|---|
| `Ainda rodando` | não bateu leads **ou** não bateu dias |
| `Sem diferença detectável` | alvos batidos, p ≥ 0,05 |
| `<X> vence (95%)` | alvos batidos, p < 0,05 |

**Aviso de SRM.** Se a divisão observada fugir significativamente da configurada (qui-quadrado, p < 0,01), o painel destaca em vermelho. O split torto ocorre em 6-10% dos testes A/B — bug, bot ou cache — e invalida o resultado silenciosamente.

**Ações:** criar, ativar, pausar, encerrar declarando vencedor. Pausar devolve todo o tráfego para A imediatamente, sem deploy.

## Componentes e limites

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `functions/_ab-sorteio.js` | **função pura**: (session_id, teste, variantes) → variante | nada |
| `functions/api/_ab-estatistica.js` | **função pura**: contagens → veredito, p, SRM | nada |
| `functions/_middleware.js` | consulta teste ativo, aplica sorteio, reescreve, registra exposição | as duas acima, D1 |
| `functions/api/ab-tests.js` | CRUD dos testes + leitura dos resultados | `_ab-estatistica.js`, D1 |
| `src/pages/ab/<slug>/b.astro` | conteúdo da variante | componentes existentes |
| `public/dash/index.html` | aba nova | `/api/ab-tests` |

As duas funções puras seguem o padrão já estabelecido por `functions/_links-destino.js`: lógica isolada, sem I/O, testável sozinha.

**Melhoria pontual no caminho.** A lista de assinaturas de bot já existe duplicada em dois lugares (`detectBot()` no `tracker.js` e `BOT_UA_SUBSTRINGS` na `api/conversion.js`, com um comentário pedindo sincronia manual). Como a leitura dos resultados A/B precisaria da mesma lista, ela é extraída para um módulo compartilhado e os dois consumidores atuais passam a importá-lo, em vez de nascer uma terceira cópia. É a única alteração em código existente fora do necessário para a feature.

## Tratamento de erro

| Falha | Comportamento |
|---|---|
| D1 fora ao consultar testes | serve variante A, segue normalmente |
| D1 fora ao gravar exposição | `waitUntil` falha em silêncio, log no console; a resposta já foi enviada |
| Variante B com path inexistente | reescrita devolve 404 → middleware detecta e serve A |
| Teste sem variantes ou pesos inválidos | tratado como inativo |
| `FormStart` falha | não bloqueia o envio do formulário |

## Testes

`node --test tests/*.test.js`, como o restante do projeto.

**`tests/ab-sorteio.test.js`**
- o mesmo `session_id` sempre cai na mesma variante
- 10.000 IDs distribuem conforme os pesos (tolerância de 2 pontos)
- teste pausado, encerrado ou inexistente devolve `a`
- pesos que não somam 100 devolvem `a`

**`tests/ab-estatistica.test.js`**
- casos conhecidos de z-test de duas proporções conferem com valores tabelados
- alvo de leads não atingido → `Ainda rodando`, mesmo com p < 0,05
- alvo de dias não atingido → `Ainda rodando`, mesmo com leads suficientes
- divisão 50/50 esperada contra 60/40 observada em amostra grande → SRM detectado
- divisão levemente torta em amostra pequena → sem SRM

## Fora de escopo

- LPs de live (`/lives-semanais-v1` e `v2`) — não têm formulário
- Testes com mais de duas variantes
- Segmentação (variante diferente por origem, dispositivo ou campanha)
- Métricas de decisão além de `Lead` (entrada em grupo, venda)
- Encerramento automático do teste ao bater o alvo — encerrar é sempre decisão da usuária

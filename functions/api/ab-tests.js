// GET  /api/ab-tests?key=...  → testes A/B com resultados e veredito
// POST /api/ab-tests?key=...  → cria, edita, ativa, pausa ou encerra um teste
//
// Consome a aba "Testes A/B" do dashboard. Endpoint ADITIVO: nenhum endpoint
// existente foi alterado.
//
// O veredito NÃO é calculado aqui — vem de _ab-estatistica.js, função pura e
// testada. E a contagem de visitas vem de ab_assignments, não de
// sessions.landing_url: o denominador do teste é quem foi SORTEADO.

import { avaliarTeste } from './_ab-estatistica.js';
import { KNOWN_PAGE_PATHS } from './conversion.js';
import { clausulasBotSql, clausulasBotIpSql } from '../_bots.js';
import { invalidarCacheAb, normalizarPath } from '../_ab-consulta.js';

// Menos que isso não é teste, é chute: com 14 dias e 60 leads por variante já
// é preciso quase um mês na home. Ver a tabela de amostra na spec.
const MIN_DIAS = 14;
const MIN_LEADS = 10;

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const agora = Math.floor(Date.now() / 1000);

  const { results: testes } = await env.DB.prepare(`
    SELECT id, slug, nome, path, status, meta_leads_variante, meta_dias,
           started_at, ended_at, vencedor, criado_em
    FROM ab_tests
    ORDER BY (status = 'ativo') DESC, criado_em DESC
  `).all();

  const { results: variantes } = await env.DB.prepare(
    'SELECT test_id, chave, page_path, peso FROM ab_variants'
  ).all();

  // Contagens por teste e variante. Agregado em SQL, não no navegador: a
  // tabela de exposições cresce com o tráfego.
  //
  // Sessões de preview ficam fora, e os bots também — eles são sorteados como
  // qualquer visitante (o middleware não os distingue no instante da
  // requisição), então a filtragem só pode acontecer aqui, na leitura.
  //
  // `timestamp >= a.assigned_at` nos dois joins não é preciosismo: o cookie
  // _krob_sid dura 400 dias, então "sessão" aqui é VISITANTE, não visita. Sem a
  // amarra, quem converteu meses atrás na mesma página volta por um link de
  // e-mail, é sorteado hoje e entra como convertido no primeiro dia — e o portão
  // `faltamLeads`, que é a razão de existir da feature, seria satisfeito por
  // conversões que não vieram do teste, com uma fração da amostra declarada.
  const { results: contagens } = await env.DB.prepare(`
    SELECT a.test_id,
           a.variante,
           COUNT(DISTINCT a.session_id) AS visitas,
           COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN a.session_id END) AS form_starts,
           COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN a.session_id END) AS leads
    FROM ab_assignments a
    JOIN sessions s ON s.session_id = a.session_id
    LEFT JOIN event_log l
      ON l.session_id = a.session_id
     AND l.event_name = 'Lead' AND l.is_bot = 0 AND l.is_junk = 0
     AND l.timestamp >= a.assigned_at
    LEFT JOIN event_log f
      ON f.session_id = a.session_id
     AND f.event_name = 'FormStart' AND f.is_bot = 0 AND f.is_junk = 0
     AND f.timestamp >= a.assigned_at
    WHERE a.is_preview = 0
      AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
      ${clausulasBotSql('s')}
      ${clausulasBotIpSql('s')}
    GROUP BY a.test_id, a.variante
  `).all();

  const contagemDe = (testId, chave) =>
    (contagens || []).find((c) => c.test_id === testId && c.variante === chave) || {
      visitas: 0, form_starts: 0, leads: 0,
    };

  const rows = (testes || []).map((t) => {
    const minhas = (variantes || []).filter((v) => v.test_id === t.id);
    const lado = (chave) => {
      const v = minhas.find((x) => x.chave === chave) || { peso: 50, page_path: '' };
      const c = contagemDe(t.id, chave);
      return {
        chave,
        peso: v.peso,
        page_path: v.page_path,
        visitas: c.visitas || 0,
        form_starts: c.form_starts || 0,
        leads: c.leads || 0,
        taxa: c.visitas ? c.leads / c.visitas : 0,
      };
    };

    const a = lado('a');
    const b = lado('b');

    return {
      id: t.id,
      slug: t.slug,
      nome: t.nome,
      path: t.path,
      status: t.status,
      meta_leads_variante: t.meta_leads_variante,
      meta_dias: t.meta_dias,
      started_at: t.started_at,
      ended_at: t.ended_at,
      vencedor: t.vencedor,
      url_preview: `${b.page_path}?ab_preview=1`,
      variantes: [a, b],
      // O veredito vem pronto do backend: a tela nunca decide se pode ou não
      // declarar vencedor. Regra na tela é regra que diverge da real.
      veredito: avaliarTeste({ teste: t, a, b, agora }),
    };
  });

  // As páginas que a tela oferece nos dois seletores. Vem do backend porque a
  // whitelist já existe lá (conversion.js) e tela com lista própria é lista que
  // um dia diverge das páginas que existem de verdade.
  return json({ agora, rows, paginas: [...KNOWN_PAGE_PATHS].filter((p) => !EXCLUIR_DOS_SELETORES.has(p)) });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const agora = Math.floor(Date.now() / 1000);
  const id = parseInt(corpo.id, 10);
  const acao = str(corpo.acao);

  // --- mudanças de estado ---
  if (acao === 'ativar' || acao === 'pausar' || acao === 'encerrar') {
    if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

    const teste = await env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    if (!teste) return json({ error: 'Teste não encontrado' }, 404);
    if (teste.status === 'encerrado') return json({ error: 'Teste já encerrado.' }, 400);

    if (acao === 'ativar') {
      const conflito = await env.DB.prepare(`
        SELECT id FROM ab_tests
        WHERE path = ? AND id != ? AND status IN ('ativo', 'pausado')
      `).bind(teste.path, id).first();
      if (conflito) {
        return json({ error: 'Já existe outro teste em andamento nesta página. Encerre-o antes.' }, 400);
      }
      // started_at só na PRIMEIRA ativação: se pausar e retomar reiniciasse a
      // contagem, bastaria pausar um dia para adiar o veredito para sempre.
      await env.DB.prepare(`
        UPDATE ab_tests
        SET status = 'ativo', started_at = COALESCE(started_at, ?), atualizado_em = ?
        WHERE id = ?
      `).bind(agora, agora, id).run();
    } else if (acao === 'pausar') {
      await env.DB.prepare("UPDATE ab_tests SET status = 'pausado', atualizado_em = ? WHERE id = ?")
        .bind(agora, id).run();
    } else {
      const vencedor = str(corpo.vencedor);
      if (!['a', 'b', 'nenhum'].includes(vencedor)) {
        return json({ error: 'Informe o vencedor: a, b ou nenhum.' }, 400);
      }
      await env.DB.prepare(`
        UPDATE ab_tests
        SET status = 'encerrado', ended_at = ?, vencedor = ?, atualizado_em = ?
        WHERE id = ?
      `).bind(agora, vencedor, agora, id).run();
    }

    invalidarCacheAb();
    return json({ ok: true, id });
  }

  // --- criar / editar ---
  const nome = str(corpo.nome);
  if (!nome) return json({ error: 'Dê um nome ao teste (ex.: "Home — oferta nova").' }, 400);

  // O identificador não é mais digitado: sai do nome. Ele só existe para o
  // cookie que segura a pessoa na mesma variante, e pedir isso na tela era mais
  // um campo sem significado para quem usa.
  const slug = slugDoNome(nome);
  if (!slug) {
    return json({ error: 'O nome do teste precisa ter letras ou números.' }, 400);
  }

  // Validar ANTES de normalizar: normalizarPath('') devolve '/', então um campo
  // em branco viraria silenciosamente um teste na home — a página de maior
  // tráfego do site, e a última em que alguém quer um teste que não pediu.
  const pathCru = str(corpo.path);
  if (!pathCru) {
    return json({ error: 'Informe a página testada começando com / (ex.: /aplicacao-mentoria).' }, 400);
  }

  const caminho = normalizarPath(pathCru);
  if (!caminho.startsWith('/') || caminho === '/ab' || caminho.startsWith('/ab/')) {
    return json({ error: 'Informe a página testada começando com / (ex.: /aplicacao-mentoria).' }, 400);
  }

  // Página B: o que muda de verdade nesta revisão. Antes era sempre
  // `/ab/<slug>/b`, um arquivo que só existia se eu criasse no código — e a
  // tela nem perguntava por ela, o que deixou a aba incompreensível para quem
  // ia usá-la (relato da usuária em 2026-09-17). Agora é uma página que já
  // existe no site, escolhida na tela.
  const pathBCru = str(corpo.path_b);
  if (!pathBCru) {
    return json({ error: 'Escolha a página B (a nova), começando com / (ex.: /se-v3).' }, 400);
  }
  const caminhoB = normalizarPath(pathBCru);
  if (!caminhoB.startsWith('/') || caminhoB === '/ab' || caminhoB.startsWith('/ab/')) {
    return json({ error: 'Escolha a página B (a nova), começando com / (ex.: /se-v3).' }, 400);
  }
  if (caminhoB === caminho) {
    return json({ error: 'A página B precisa ser diferente da página A — senão não há o que comparar.' }, 400);
  }
  if (!KNOWN_PAGE_PATHS.has(caminhoB)) {
    return json({ error: `A página ${caminhoB} não existe no site. Escolha uma da lista.` }, 400);
  }
  if (!KNOWN_PAGE_PATHS.has(caminho)) {
    return json({ error: `A página ${caminho} não existe no site. Escolha uma da lista.` }, 400);
  }

  const metaLeads = parseInt(corpo.meta_leads_variante, 10);
  if (!Number.isFinite(metaLeads) || metaLeads < MIN_LEADS) {
    return json({ error: `A meta de leads por variante precisa ser de pelo menos ${MIN_LEADS}.` }, 400);
  }

  const metaDias = parseInt(corpo.meta_dias, 10);
  if (!Number.isFinite(metaDias) || metaDias < MIN_DIAS || metaDias % 7 !== 0) {
    return json({ error: `A duração precisa ser de no mínimo ${MIN_DIAS} dias e em semanas inteiras (14, 21, 28...).` }, 400);
  }

  const pesoB = parseInt(corpo.peso_b, 10);
  if (!Number.isFinite(pesoB) || pesoB < 1 || pesoB > 99) {
    return json({ error: 'A fatia da variante B precisa ficar entre 1% e 99%.' }, 400);
  }
  const pesoA = 100 - pesoB;

  if (Number.isFinite(id)) {
    const teste = await env.DB.prepare('SELECT status FROM ab_tests WHERE id = ?').bind(id).first();
    if (!teste) return json({ error: 'Teste não encontrado' }, 404);
    // Mexer em alvo ou divisão com o teste no ar é reescrever a régua no meio
    // da corrida — exatamente o que o alvo declarado antes existe para impedir.
    if (teste.status !== 'rascunho') {
      return json({ error: 'Só dá para editar um teste em rascunho. Pause e encerre para mudar os alvos.' }, 400);
    }

    await env.DB.prepare(`
      UPDATE ab_tests
      SET nome = ?, slug = ?, path = ?, meta_leads_variante = ?, meta_dias = ?, atualizado_em = ?
      WHERE id = ?
    `).bind(nome, slug, caminho, metaLeads, metaDias, agora, id).run();

    await env.DB.prepare("UPDATE ab_variants SET peso = ? WHERE test_id = ? AND chave = 'a'")
      .bind(pesoA, id).run();
    await env.DB.prepare("UPDATE ab_variants SET peso = ?, page_path = ? WHERE test_id = ? AND chave = 'b'")
      .bind(pesoB, caminhoB, id).run();

    invalidarCacheAb();
    return json({ ok: true, id });
  }

  const jaExiste = await env.DB.prepare('SELECT id FROM ab_tests WHERE slug = ?').bind(slug).first();
  // A mensagem fala do NOME porque o identificador não aparece mais na tela:
  // dizer "identificador repetido" para quem só digitou um nome é mandar a
  // pessoa procurar um campo que não existe.
  if (jaExiste) return json({ error: 'Já existe um teste com esse nome. Escolha outro nome.' }, 400);

  const r = await env.DB.prepare(`
    INSERT INTO ab_tests (slug, nome, path, status, meta_leads_variante, meta_dias, criado_em, atualizado_em)
    VALUES (?, ?, ?, 'rascunho', ?, ?, ?, ?)
  `).bind(slug, nome, caminho, metaLeads, metaDias, agora, agora).run();

  const novoId = r.meta ? r.meta.last_row_id : null;

  await env.DB.batch([
    env.DB.prepare("INSERT INTO ab_variants (test_id, chave, page_path, peso) VALUES (?, 'a', '', ?)")
      .bind(novoId, pesoA),
    env.DB.prepare("INSERT INTO ab_variants (test_id, chave, page_path, peso) VALUES (?, 'b', ?, ?)")
      .bind(novoId, caminhoB, pesoB),
  ]);

  invalidarCacheAb();
  return json({ ok: true, id: novoId });
}

const str = (v) => (v == null ? '' : String(v)).trim();

// Páginas que nunca fazem sentido como A ou B num teste: agradecimentos,
// redirects legados e o endpoint do grupo. Deixá-las na lista só daria chance
// de escolher errado.
const EXCLUIR_DOS_SELETORES = new Set([
  '/obrigada', '/obrigado', '/obrigado-workshop', '/ae-video-workshop',
  '/grupo-da-live', '/obrigado-black-exponencial',
  '/calculadora-atacado/perguntas', '/calculadora-atacado/resultado',
]);

// "Home × SE v3" → "home-se-v3". Sufixo numérico é responsabilidade de quem
// chama (o nome repetido devolve erro de identificador já existente).
function slugDoNome(nome) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

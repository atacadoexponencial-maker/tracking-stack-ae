// Números de cada lado dos testes do Argo e a passagem para "pronto para ler"
// (issue 404; spec-relatorio-semanal-argo.md, módulo 2).
//
// - Teste de página: visitas e leads do A/B ligado, pela MESMA contagem da aba
//   "Testes A/B" (`_ab-contagens.js`). Amostra = visitas do lado com menos.
// - Teste de conta (criativo, público, oferta): gasto e impressões da Graph
//   API (`_argo-meta.js`) e leads e MQLs dos cards do CRM pelo `utm_content`
//   (o nome do anúncio), desde o início do teste. Amostra = leads dos dois lados.
//
// Fonte fora do ar vira `{ ok:false, aviso }` e a leitura fica sem amostra:
// "não consegui ler" nunca vira "zero leads", que travaria ou liberaria um
// teste por defeito de dado.
import { CONTA } from './_argo-db.js';
import { montarTestes } from './_argo-testes.js';
import { contarExposicoesAb } from './_ab-contagens.js';
import { insightsPorAnuncio } from './_argo-meta.js';
import { lerCardsCriadosNoPeriodo, lerTaskIdsDeTesteOuBot } from './_feedback-marketing-crm.js';
import { agruparPorAnuncio } from './_argo-leads-anuncio.js';

const ATIVOS = ['rodando', 'pronto'];
const DIA_MS = 86400000;

// Meia-noite de Brasília do dia, em ms (sem horário de verão desde 2019).
const inicioDoDiaMs = (ymd) => Date.parse(`${ymd}T00:00:00-03:00`);
const ontem = (hoje) => new Date(Date.parse(hoje) - DIA_MS).toISOString().slice(0, 10);

/** Números de um lado de teste de conta. Puro. */
export function somarLado(lado, linhasInsights, leadsPorNome) {
  const ids = new Set(lado.map((a) => a.id));
  const porConjunto = lado.some((a) => a.nivel === 'conjunto');
  const linhas = linhasInsights.filter((l) => (porConjunto ? ids.has(l.conjunto_id) : ids.has(l.anuncio_id)));
  // Nomes dos anúncios do lado: o card do CRM guarda o nome, não o id.
  const nomes = new Set(linhas.map((l) => l.anuncio_nome));
  if (!porConjunto) for (const a of lado) if (a.nome) nomes.add(a.nome);
  let leads = 0;
  let mqls = 0;
  for (const n of nomes) {
    const x = leadsPorNome.get(n);
    if (x) { leads += x.leads; mqls += x.mqls; }
  }
  const gasto = linhas.reduce((s, l) => s + l.gasto_centavos, 0);
  const impressoes = linhas.reduce((s, l) => s + l.impressoes, 0);
  return {
    gasto_centavos: gasto, impressoes, leads, mqls,
    cpl_centavos: leads ? Math.round(gasto / leads) : null,
    custo_mql_centavos: mqls ? Math.round(gasto / mqls) : null,
  };
}

/** Leads e MQLs por nome de anúncio a partir dos cards. Puro. */
export function leadsPorAnuncio(cards, ateMs) {
  const agrupado = agruparPorAnuncio({ cards, maduroAteMs: ateMs, funis: [] });
  const mapa = new Map();
  for (const a of agrupado.anuncios) mapa.set(a.utm_content, { leads: a.leads_maduros + a.leads_recentes, mqls: a.qualificados });
  return mapa;
}

/** Números de um teste de página a partir das contagens do A/B. Puro. */
export function numerosDePagina(contagens, abTestId) {
  const lado = (v) => {
    const c = contagens.find((x) => Number(x.test_id) === Number(abTestId) && x.variante === v) || { visitas: 0, leads: 0 };
    const visitas = Number(c.visitas || 0);
    const leads = Number(c.leads || 0);
    return { visitas, leads, taxa: visitas ? leads / visitas : null };
  };
  const controle = lado('a');
  const variante = lado('b');
  return { ok: true, amostra: Math.min(controle.visitas, variante.visitas), lados: { controle, variante } };
}

async function numerosDeConta(env, teste, hoje, cache) {
  const desde = String(teste.inicio instanceof Date ? teste.inicio.toISOString() : teste.inicio).slice(0, 10);
  const ate = ontem(hoje) < desde ? desde : ontem(hoje);
  const ins = await insightsPorAnuncio(env, { desde, ate });
  if (!ins.ok) return { ok: false, aviso: ins.aviso };
  if (!cache.cards) {
    cache.cards = await lerCardsCriadosNoPeriodo(env, { desde: Math.floor(cache.desdeMs / 1000), ate: Math.ceil(Date.now() / 1000) });
    if (cache.cards.ok) {
      const excluidos = new Set(await lerTaskIdsDeTesteOuBot(env.DB, cache.cards.cards.map((c) => c.id)));
      cache.cards.cards = cache.cards.cards.filter((c) => !excluidos.has(String(c.id)));
    }
  }
  if (!cache.cards.ok) return { ok: false, aviso: cache.cards.aviso };
  const inicioMs = inicioDoDiaMs(desde);
  const cards = cache.cards.cards.filter((c) => Number(c.date_created) >= inicioMs);
  const mapa = leadsPorAnuncio(cards, Date.now());
  const controle = somarLado(teste.controle || [], ins.linhas, mapa);
  const variante = somarLado(teste.variante || [], ins.linhas, mapa);
  return { ok: true, amostra: controle.leads + variante.leads, lados: { controle, variante }, periodo: { desde, ate } };
}

/** Números de todos os testes ativos. Cada teste falha sozinho. */
export async function numerosDosTestes(env, linhas, hoje) {
  const ativos = linhas.filter((l) => ATIVOS.includes(l.situacao) && l.inicio);
  const saida = new Map();
  if (!ativos.length) return saida;
  const deConta = ativos.filter((l) => l.tipo !== 'pagina');
  const cache = {
    desdeMs: deConta.length ? Math.min(...deConta.map((l) => inicioDoDiaMs(String(l.inicio instanceof Date ? l.inicio.toISOString() : l.inicio).slice(0, 10)))) : 0,
  };
  let contagensAb = null;
  for (const l of ativos) {
    try {
      if (l.tipo === 'pagina') {
        if (!l.ab_test_id) { saida.set(Number(l.id), { ok: false, aviso: 'Nenhum teste A/B ligado.' }); continue; }
        if (!contagensAb) contagensAb = await contarExposicoesAb(env.DB);
        saida.set(Number(l.id), numerosDePagina(contagensAb, l.ab_test_id));
      } else {
        saida.set(Number(l.id), await numerosDeConta(env, l, hoje, cache));
      }
    } catch {
      saida.set(Number(l.id), { ok: false, aviso: 'Não foi possível ler os números deste teste agora.' });
    }
  }
  return saida;
}

/**
 * Lê o registro inteiro, calcula os números dos ativos e passa para "pronto
 * para ler" quem atingiu os dois mínimos (com linha no histórico). Devolve a
 * lista montada, como a aba e o relatório consomem.
 */
export async function lerTestesComNumeros(sql, env, hoje) {
  const lerTudo = async () => {
    const linhas = await sql`
      SELECT * FROM argo.testes WHERE conta = ${CONTA}
       ORDER BY (situacao IN ('pronto', 'rodando')) DESC, (situacao = 'planejado') DESC, id DESC
    `;
    const ids = linhas.map((l) => Number(l.id));
    const hist = ids.length
      ? await sql`SELECT teste_id, texto, destaque, criado_em FROM argo.testes_historico WHERE teste_id = ANY(${ids}) ORDER BY criado_em, id`
      : [];
    const porTeste = new Map();
    for (const h of hist) {
      const k = Number(h.teste_id);
      if (!porTeste.has(k)) porTeste.set(k, []);
      porTeste.get(k).push(h);
    }
    return { linhas, porTeste };
  };

  let { linhas, porTeste } = await lerTudo();
  const numeros = await numerosDosTestes(env, linhas, hoje);
  let montado = montarTestes(linhas, porTeste, hoje, numeros);
  const prontos = montado.testes.filter((t) => t.situacao === 'rodando' && t.leitura && t.leitura.pronto);
  if (prontos.length) {
    for (const t of prontos) {
      await sql`UPDATE argo.testes SET situacao = 'pronto', pronto_em = now(), atualizado_em = now() WHERE conta = ${CONTA} AND id = ${t.id} AND situacao = 'rodando'`;
      await sql`INSERT INTO argo.testes_historico (teste_id, texto) VALUES (${t.id}, 'Atingiu os mínimos: pronto para ler.')`;
    }
    ({ linhas, porTeste } = await lerTudo());
    montado = montarTestes(linhas, porTeste, hoje, numeros);
  }
  return montado;
}

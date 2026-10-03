// Acontecimentos dos fluxos (spec-email-proprio.md, módulo 9; issue 386).
//
// Lê as tabelas que o dash JÁ grava, cada uma com o próprio cursor, e grava
// cada acontecimento numa tabela única, ligado ao e-mail da pessoa. Nada muda
// em quem grava (tracker, webhook da Greenn, agenda, grupos, ClickUp): aqui é
// só leitura. Na primeira rodada entra o histórico inteiro (para os desvios e
// a contagem dos últimos 30 dias); quem entra nos fluxos é decidido pelo motor,
// que só considera o que aconteceu depois da publicação.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { canalDeLead } from './_canal.js';
import { normalizarEmail } from './_email-contatos.js';
import { sqlDasRegras } from './_email-segmentos.js';
import { variantesTelefone } from '../_telefone.js';

const agora = () => Math.floor(Date.now() / 1000);
const LIMITE = 300;
const RODADA_SEGMENTOS = 15 * 60;
const EVENTOS_SITE = ['CTAClick', 'FormStart', 'FormStep', 'StoryOpen'];

// ---------------------------------------------------------------------------
// Cursores
// ---------------------------------------------------------------------------

async function lerCursor(env, fonte) {
  const r = await env.DB.prepare('SELECT posicao FROM email_fluxo_cursores WHERE fonte = ?').bind(fonte).first();
  return r ? Number(r.posicao) : 0;
}
async function gravarCursor(env, fonte, posicao) {
  await env.DB.prepare('INSERT INTO email_fluxo_cursores (fonte, posicao) VALUES (?, ?) ON CONFLICT(fonte) DO UPDATE SET posicao = excluded.posicao')
    .bind(fonte, posicao).run();
}

async function gravar(env, lista) {
  for (const a of lista) {
    await env.DB.prepare('INSERT OR IGNORE INTO email_acontecimentos (chave, tipo, email, dados_json, quando) VALUES (?, ?, ?, ?, ?)')
      .bind(a.chave, a.tipo, a.email ? normalizarEmail(a.email) : null, JSON.stringify(a.dados || {}), a.quando).run();
  }
}

const caminho = (url) => {
  try { return new URL(url).pathname.replace(/\/+$/, '') || '/'; } catch { return ''; }
};

// ---------------------------------------------------------------------------
// Fontes: cada uma devolve { lista, ultimo } a partir do cursor.
// ---------------------------------------------------------------------------

const FONTES = {
  // Leads (formulário, aplicação, material) e eventos do site.
  async event_log(env, desde) {
    const teto = (await env.DB.prepare('SELECT MAX(id) AS m FROM event_log').first())?.m || 0;
    const nomes = ['Lead', ...EVENTOS_SITE];
    const r = (await env.DB.prepare(
      `SELECT e.id, e.event_name, e.timestamp, e.raw_email, e.material, e.event_id,
              COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funil, s.utm_source, s.utm_campaign, s.utm_content, s.landing_url,
              (SELECT l.raw_email FROM event_log l WHERE l.session_id = e.session_id AND l.event_name = 'Lead' AND COALESCE(l.raw_email, '') <> '' LIMIT 1) AS email_sessao
         FROM event_log e LEFT JOIN sessions s ON s.session_id = e.session_id
        WHERE e.id > ? AND e.id <= ? AND e.event_name IN (${nomes.map(() => '?').join(',')}) AND e.is_bot = 0
          AND e.event_id NOT IN (SELECT event_id FROM leads_bloqueados)
        ORDER BY e.id LIMIT ?`,
    ).bind(desde, teto, ...nomes, LIMITE).all()).results || [];
    const lista = [];
    for (const e of r) {
      const pagina = caminho(e.landing_url);
      if (e.event_name === 'Lead') {
        if (!e.raw_email) continue;
        const funil = e.funil || '';
        lista.push({
          chave: `ev:${e.id}:formulario`, tipo: 'formulario', email: e.raw_email, quando: e.timestamp,
          dados: { funil, pagina, canal: canalDeLead(e), utm_source: e.utm_source || '', utm_campaign: e.utm_campaign || '', utm_content: e.utm_content || '' },
        });
        if (e.material) lista.push({ chave: `ev:${e.id}:material`, tipo: 'material', email: e.raw_email, quando: e.timestamp, dados: { material: e.material } });
        if (/aplicacao/.test(funil)) lista.push({ chave: `ev:${e.id}:aplicacao`, tipo: 'aplicacao', email: e.raw_email, quando: e.timestamp, dados: { formulario: funil } });
      } else {
        lista.push({ chave: `ev:${e.id}:site`, tipo: 'site', email: e.email_sessao || null, quando: e.timestamp, dados: { pagina, evento: e.event_name.toLowerCase() } });
      }
    }
    return { lista, ultimo: r.length < LIMITE ? Math.max(desde, teto) : r[r.length - 1].id };
  },

  // Vendas da Greenn: aprovada, reembolsada, cancelada.
  async greenn(env, desde) {
    const SIT = { paid: 'aprovada', refunded: 'reembolsada', canceled: 'cancelada', chargedback: 'cancelada' };
    const r = (await env.DB.prepare(
      `SELECT id, current_status, product_id, received_at, json_extract(raw_json, '$.client.email') AS email
         FROM greenn_webhook_event WHERE id > ? AND event = 'saleUpdated' ORDER BY id LIMIT ?`,
    ).bind(desde, LIMITE).all()).results || [];
    const lista = r.filter((x) => SIT[x.current_status]).map((x) => ({
      chave: `greenn:${x.id}`, tipo: 'compra', email: x.email, quando: x.received_at,
      dados: { produto: String(x.product_id ?? ''), compra: SIT[x.current_status] },
    }));
    return { lista, ultimo: r.length ? r[r.length - 1].id : desde };
  },

  // Agenda: agendou, cancelou, compareceu, faltou.
  async agenda(env, desde) {
    const r = (await env.DB.prepare(
      `SELECT h.id, h.acao, h.detalhe, h.criado_em, r.email, r.tipo_id
         FROM agenda_historico h JOIN agenda_reunioes r ON r.id = h.reuniao_id
        WHERE h.id > ? ORDER BY h.id LIMIT ?`,
    ).bind(desde, LIMITE).all()).results || [];
    const lista = [];
    for (const x of r) {
      const tipo = x.acao === 'agendou' ? 'agendou' : x.acao === 'cancelou' ? 'cancelou'
        : x.acao === 'presenca' && /realizada/.test(x.detalhe || '') ? 'compareceu'
        : x.acao === 'presenca' && /faltou/.test(x.detalhe || '') ? 'faltou' : null;
      if (tipo) lista.push({ chave: `agenda:${x.id}`, tipo, email: x.email, quando: x.criado_em, dados: { tipo: String(x.tipo_id) } });
    }
    return { lista, ultimo: r.length ? r[r.length - 1].id : desde };
  },

  // Grupos de WhatsApp: o telefone vira e-mail pelo telefone do lead.
  async grupos(env, desde) {
    const r = (await env.DB.prepare(
      `SELECT id, group_jid, participant_jid, action, received_at, json_extract(raw_json, '$.phoneNumber') AS fone
         FROM whatsapp_group_events WHERE id > ? ORDER BY id LIMIT ?`,
    ).bind(desde, LIMITE).all()).results || [];
    const lista = [];
    for (const x of r) {
      const bruto = /@s\.whatsapp\.net$/.test(x.participant_jid || '') ? x.participant_jid.split('@')[0] : String(x.fone || '').split('@')[0];
      const variantes = variantesTelefone(bruto);
      let email = null;
      if (variantes.length) {
        const l = await env.DB.prepare(
          `SELECT email FROM lead_dispatch WHERE REPLACE(phone, '+', '') IN (${variantes.map(() => '?').join(',')}) AND COALESCE(email, '') <> '' ORDER BY id DESC LIMIT 1`,
        ).bind(...variantes).first();
        email = l ? l.email : null;
      }
      lista.push({ chave: `grupo:${x.id}`, tipo: x.action === 'entrou' ? 'grupo_entrou' : 'grupo_saiu', email, quando: x.received_at, dados: { grupo: x.group_jid } });
    }
    return { lista, ultimo: r.length ? r[r.length - 1].id : desde };
  },

  // Estágio do CRM: o card vira e-mail pela ponte do ClickUp.
  async crm(env, desde) {
    const r = (await env.DB.prepare(
      `SELECT c.id, c.status, COALESCE(c.hist_date, c.recebido_em) AS quando,
              (SELECT d.email FROM lead_dispatch d WHERE d.task_id = c.task_id AND COALESCE(d.email, '') <> '' ORDER BY d.id DESC LIMIT 1) AS email
         FROM crm_status_log c WHERE c.id > ? ORDER BY c.id LIMIT ?`,
    ).bind(desde, LIMITE).all()).results || [];
    const lista = r.map((x) => ({ chave: `crm:${x.id}`, tipo: 'crm', email: x.email, quando: x.quando, dados: { estagio: x.status } }));
    return { lista, ultimo: r.length ? r[r.length - 1].id : desde };
  },

  // Campanhas: abriu e clicou (com o link).
  async campanha(env, desde) {
    const r = (await env.DB.prepare(
      `SELECT ev.id, ev.tipo, ev.ocorrido_em, ev.recebido_em, json_extract(ev.detalhe_json, '$.link') AS link, e.ref_id, e.destinatario
         FROM email_eventos ev JOIN email_envios e ON e.id = ev.envio_id
        WHERE ev.id > ? AND ev.tipo IN ('aberto', 'clicado') AND e.origem = 'campanha' ORDER BY ev.id LIMIT ?`,
    ).bind(desde, LIMITE).all()).results || [];
    const ultimo = (await env.DB.prepare('SELECT MAX(id) AS m FROM email_eventos').first())?.m || desde;
    const lista = r.map((x) => ({
      chave: `campanha:${x.id}`, tipo: 'campanha', email: x.destinatario, quando: x.ocorrido_em || x.recebido_em,
      dados: { acao: x.tipo === 'aberto' ? 'abriu' : 'clicou', campanha: String(x.ref_id), link: x.link || '' },
    }));
    return { lista, ultimo: r.length < LIMITE ? Math.max(desde, ultimo) : r[r.length - 1].id };
  },
};

/** Lê todas as fontes. Fonte que falhar fica para a próxima rodada, sem travar as outras. */
export async function coletar(env) {
  const resumo = {};
  for (const [fonte, fn] of Object.entries(FONTES)) {
    try {
      const desde = await lerCursor(env, fonte);
      const { lista, ultimo } = await fn(env, desde);
      await gravar(env, lista);
      if (ultimo !== desde) await gravarCursor(env, fonte, ultimo);
      resumo[fonte] = lista.length;
    } catch (e) {
      resumo[fonte] = `erro: ${e.message}`;
    }
  }
  return resumo;
}

/**
 * Segmentos usados como gatilho em fluxo ativo: quem entrou desde a última
 * leitura vira acontecimento. A primeira leitura de um segmento só marca
 * quem já estava (sem disparar). Roda a cada 15 minutos.
 */
export async function coletarSegmentos(env, segmentoIds, t = agora()) {
  const ultima = await lerCursor(env, 'segmentos');
  if (t - ultima < RODADA_SEGMENTOS) return 0;
  await gravarCursor(env, 'segmentos', t);
  let novos = 0;
  for (const id of segmentoIds) {
    const s = await env.DB.prepare('SELECT regras_json FROM email_segmentos WHERE id = ?').bind(Number(id)).first();
    if (!s) continue;
    const q = sqlDasRegras(JSON.parse(s.regras_json || '[]'), t);
    const agoraDentro = (await env.DB.prepare(`${q.antes} SELECT c.id, c.email FROM ${q.de} WHERE ${q.onde} AND c.situacao = 'ativo'`).bind(...q.binds).all()).results || [];
    const antes = new Set(((await env.DB.prepare('SELECT contato_id FROM email_segmento_membros WHERE segmento_id = ?').bind(Number(id)).all()).results || []).map((x) => x.contato_id));
    const base = await lerCursor(env, `segmento:${id}`);
    const dentro = new Set(agoraDentro.map((c) => c.id));
    for (const c of agoraDentro) {
      if (antes.has(c.id)) continue;
      await env.DB.prepare('INSERT OR IGNORE INTO email_segmento_membros (segmento_id, contato_id, desde) VALUES (?, ?, ?)').bind(Number(id), c.id, t).run();
      if (base) {
        await gravar(env, [{ chave: `segmento:${id}:${c.id}:${t}`, tipo: 'segmento', email: c.email, quando: t, dados: { segmento: String(id) } }]);
        novos++;
      }
    }
    // Quem saiu do segmento pode entrar de novo depois.
    for (const cid of antes) if (!dentro.has(cid)) await env.DB.prepare('DELETE FROM email_segmento_membros WHERE segmento_id = ? AND contato_id = ?').bind(Number(id), cid).run();
    if (!base) await gravarCursor(env, `segmento:${id}`, 1);
  }
  return novos;
}

// ---------------------------------------------------------------------------
// Filtros e contagem
// ---------------------------------------------------------------------------

/** O acontecimento cumpre os filtros? Valor vazio = qualquer. */
export function casaFiltros(dados, filtros = []) {
  return filtros.every((f) => !f.valor || String(dados?.[f.campo] ?? '') === String(f.valor));
}

/** Contatos ativos que teriam entrado nos últimos 30 dias com este gatilho. */
export async function contarUltimos30(env, gatilho, t = agora()) {
  const r = (await env.DB.prepare(
    `SELECT a.email, a.dados_json FROM email_acontecimentos a JOIN email_contatos c ON c.email = a.email AND c.situacao = 'ativo'
      WHERE a.tipo = ? AND a.quando >= ?`,
  ).bind(String(gatilho?.evento || ''), t - 30 * 86400).all()).results || [];
  const pessoas = new Set();
  for (const x of r) if (casaFiltros(JSON.parse(x.dados_json || '{}'), gatilho.filtros || [])) pessoas.add(x.email);
  return pessoas.size;
}

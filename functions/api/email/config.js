// GET  /api/email/config?key=...  → configuração, situação da conta, domínios,
//                                   resultados conectados e últimos 20 testes
// POST /api/email/config?key=...  → { acao: 'salvar', campos: { chave: valor } }
//                                   { acao: 'enviar_teste', para, canal }
//                                   { acao: 'conectar_resultados' }
//
// Spec spec-email-proprio.md, módulos 1 e 8 (issue 377). Validação em
// ../_email-config.js; Postmark em ../_postmark.js.
import { lerConfig, validarConfig, salvarConfig, emailValido, DOMINIOS } from '../_email-config.js';
import {
  STREAMS, consultarServidor, listarDominios, listarWebhooks, criarWebhook, editarWebhook,
} from '../_postmark.js';
import { montarEmail } from '../_email-render.js';
import { enviarERegistrar } from '../_email-envio.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const agora = () => Math.floor(Date.now() / 1000);

const SEM_ACESSO = 'Serviço de envio sem acesso. Confira a chave em Saúde das integrações.';
const CAMINHO_WEBHOOK = '/api/webhooks/postmark';

export const GATILHOS = {
  Open: { Enabled: true, PostFirstOpenOnly: false },
  Click: { Enabled: true },
  Delivery: { Enabled: true },
  Bounce: { Enabled: true, IncludeContent: false },
  SpamComplaint: { Enabled: true, IncludeContent: false },
  SubscriptionChange: { Enabled: true },
};

const urlWebhook = (request) => new URL(request.url).origin + CAMINHO_WEBHOOK;
const gatilhosOk = (t = {}) => Object.keys(GATILHOS).every((k) => t[k]?.Enabled === true)
  && t.Open?.PostFirstOpenOnly === false;

async function ultimosTestes(env) {
  const envios = (await env.DB.prepare(
    `SELECT id, canal, destinatario, assunto, situacao, erro, enviado_em, entregue_em, aberto_em, clicado_em,
            voltou_em, spam_em, descadastrou_em
       FROM email_envios WHERE origem = 'teste' ORDER BY id DESC LIMIT 20`,
  ).all()).results || [];
  if (!envios.length) return [];
  const ids = envios.map((e) => e.id);
  const eventos = (await env.DB.prepare(
    `SELECT envio_id, tipo, ocorrido_em, detalhe_json FROM email_eventos
      WHERE envio_id IN (${ids.map(() => '?').join(',')}) ORDER BY ocorrido_em, id`,
  ).bind(...ids).all()).results || [];
  const porEnvio = new Map();
  for (const ev of eventos) {
    if (!porEnvio.has(ev.envio_id)) porEnvio.set(ev.envio_id, []);
    porEnvio.get(ev.envio_id).push({ tipo: ev.tipo, ocorrido_em: ev.ocorrido_em, detalhe: ev.detalhe_json ? JSON.parse(ev.detalhe_json) : null });
  }
  return envios.map((e) => ({ ...e, eventos: porEnvio.get(e.id) || [] }));
}

/** Resultados conectados por canal: true | false | null (não deu para consultar). */
async function situacaoResultados(env, request, conta) {
  const r = { transacional: null, marketing: null };
  if (conta !== 'aceita') return r;
  const url = urlWebhook(request);
  await Promise.all(Object.entries(STREAMS).map(async ([canal, stream]) => {
    try {
      const l = await listarWebhooks(env, stream);
      if (l.ok) r[canal] = l.webhooks.some((w) => w.Url === url && gatilhosOk(w.Triggers));
    } catch { /* fica null */ }
  }));
  return r;
}

async function estado(env, request) {
  const [config, conta, doms, testes] = await Promise.all([
    lerConfig(env), consultarServidor(env), listarDominios(env), ultimosTestes(env),
  ]);
  let dominios;
  if (doms === null) dominios = { consultado: false, motivo: 'sem_chave_conta', itens: [] };
  else if (!doms.ok) dominios = { consultado: false, motivo: doms.motivo, itens: [] };
  else {
    dominios = {
      consultado: true,
      motivo: null,
      itens: Object.entries(DOMINIOS).map(([canal, nome]) => {
        const d = doms.dominios.find((x) => x.nome === nome);
        return { canal, nome, encontrado: !!d, dkim: !!d?.dkim, retorno: !!d?.retorno };
      }),
    };
  }
  return { config, conta, dominios, resultados: await situacaoResultados(env, request, conta), testes };
}

export async function onRequestGet({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  return json(await estado(env, request));
}

// Corpo do teste da Configuração: mesmo layout dos modelos (_email-render.js).
const CORPO_TESTE = (canal) => `Este é um e-mail de teste do canal **${canal}**, mandado pelo dash.

Se ele chegou, a entrega está funcionando. Clique no botão abaixo para conferir a marcação de clique:

[[Abrir o site do Atacado Exponencial | https://atacadoexponencial.com/]]`;

/**
 * Manda um e-mail de teste e registra em email_envios (origem 'teste').
 * Usado aqui e pelo teste de modelo (email/modelos.js). Devolve a Response.
 */
export async function enviarTeste(env, { canal, para, assunto, html, texto, tag, refId = null }) {
  const destino = String(para || '').trim().toLowerCase();
  if (!emailValido(destino)) return json({ error: 'Digite um e-mail válido para receber o teste.' }, 400);
  if (!env.POSTMARK_SERVER_TOKEN) return json({ error: SEM_ACESSO }, 503);
  const cfg = await lerConfig(env);
  if (canal === 'marketing' && cfg.marketing_liberado !== '1') {
    return json({ error: 'O marketing está marcado como não liberado. Ligue a opção antes de testar este canal.' }, 409);
  }
  const r = await enviarERegistrar(env, { canal, origem: 'teste', refId, para: destino, assunto, html, texto, tag, cfg });
  // Sem resposta: nada fica registrado como enviado.
  if (r.semResposta) return json({ error: r.erro }, 504);
  if (!r.ok) {
    const status = r.codigo === 10 ? 503 : 422;
    return json({ error: r.codigo === 10 ? SEM_ACESSO : r.erro, testes: await ultimosTestes(env) }, status);
  }
  return json({ ok: true, envio_id: r.envioId, testes: await ultimosTestes(env) });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));

  if (corpo.acao === 'salvar') {
    const v = validarConfig(corpo.campos);
    if (v.erro) return json({ error: v.erro }, 400);
    await salvarConfig(env, v.valores, agora());
    return json({ ok: true, config: await lerConfig(env) });
  }

  if (corpo.acao === 'enviar_teste') {
    const canal = corpo.canal === 'marketing' ? 'marketing' : corpo.canal === 'transacional' ? 'transacional' : null;
    if (!canal) return json({ error: 'Escolha o canal do teste.' }, 400);
    const cfg = await lerConfig(env);
    const assunto = `Teste do dash: canal ${canal}`;
    const { html, texto } = montarEmail({ canal, assunto, previa: '', corpo: CORPO_TESTE(canal) }, cfg, { valores: {}, site: new URL(request.url).origin });
    return enviarTeste(env, { canal, para: corpo.para, assunto, html, texto, tag: 'teste' });
  }

  if (corpo.acao === 'conectar_resultados') {
    if (!env.POSTMARK_SERVER_TOKEN) return json({ error: SEM_ACESSO }, 503);
    if (!env.POSTMARK_WEBHOOK_USER || !env.POSTMARK_WEBHOOK_PASS) {
      return json({ error: 'Faltam o usuário e a senha dos resultados (POSTMARK_WEBHOOK_USER e POSTMARK_WEBHOOK_PASS).' }, 503);
    }
    const url = urlWebhook(request);
    const dados = {
      Url: url,
      HttpAuth: { Username: env.POSTMARK_WEBHOOK_USER, Password: env.POSTMARK_WEBHOOK_PASS },
      HttpHeaders: [],
      Triggers: GATILHOS,
    };
    const resultados = {};
    try {
      for (const [canal, stream] of Object.entries(STREAMS)) {
        const l = await listarWebhooks(env, stream);
        if (!l.ok) return json({ error: l.codigo === 10 || l.status === 401 ? SEM_ACESSO : l.erro }, l.status === 401 ? 503 : 502);
        const existente = l.webhooks.find((w) => w.Url === url);
        // Sempre grava o mesmo conteúdo: se existir, atualiza (pega troca de
        // senha e de gatilhos); se não, cria. Nunca duplica.
        const r = existente
          ? await editarWebhook(env, existente.ID, dados)
          : await criarWebhook(env, { ...dados, MessageStream: stream });
        if (!r.ok) return json({ error: r.erro }, 502);
        resultados[canal] = existente ? 'atualizado' : 'criado';
      }
    } catch (e) {
      return json({ error: e.message || 'Não foi possível falar com o serviço de envio agora. Tente de novo.' }, 504);
    }
    return json({ ok: true, resultados });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}

// GET  /api/email/fluxos?key=...[&arquivados=1]  → fluxos (nome, gatilhos e situação vêm no quadro)
// GET  /api/email/fluxos?key=...&id=<id>         → um fluxo com problemas e as opções dos filtros
// POST /api/email/fluxos?key=...  → { acao: 'criar', nome? }
//                                   { acao: 'salvar', id, nome, grafo, versao }   (rascunho; conflito entre abas → 409)
//                                   { acao: 'duplicar' | 'arquivar' | 'desarquivar', id }
//                                   { acao: 'publicar' | 'pausar' | 'retomar', id }   (386)
//                                   { acao: 'estimar', gatilho }   → quantos contatos teriam entrado nos últimos 30 dias (386)
//
// Spec spec-email-proprio.md, módulo 9 (issues 385 e 386). Regras em ../_email-fluxos.js;
// a rodada que faz os fluxos andarem é /api/sync/email-fluxos.
import {
  ErroFluxo, listarFluxos, lerFluxo, criarFluxo, salvarFluxo, duplicarFluxo, arquivarFluxo, opcoes,
  publicarFluxo, pausarFluxo, retomarFluxo,
} from '../_email-fluxos.js';
import { contarUltimos30 } from '../_email-acontecimentos.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

const responder = async (fn) => {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof ErroFluxo) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const id = url.searchParams.get('id');
  if (id) return responder(async () => { const [fluxo, op] = await Promise.all([lerFluxo(env, id), opcoes(env)]); return { fluxo, opcoes: op }; });
  return responder(() => listarFluxos(env, { arquivados: url.searchParams.get('arquivados') === '1' }));
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  switch (corpo.acao) {
    case 'criar': return responder(async () => ({ ok: true, fluxo: await criarFluxo(env, corpo) }));
    case 'salvar': return responder(async () => ({ ok: true, ...(await salvarFluxo(env, corpo.id, corpo)) }));
    case 'duplicar': return responder(async () => ({ ok: true, fluxo: await duplicarFluxo(env, corpo.id) }));
    case 'arquivar': return responder(async () => ({ ok: true, fluxo: await arquivarFluxo(env, corpo.id, true) }));
    case 'desarquivar': return responder(async () => ({ ok: true, fluxo: await arquivarFluxo(env, corpo.id, false) }));
    case 'publicar': return responder(async () => ({ ok: true, fluxo: await publicarFluxo(env, corpo.id) }));
    case 'pausar': return responder(async () => ({ ok: true, fluxo: await pausarFluxo(env, corpo.id) }));
    case 'retomar': return responder(async () => ({ ok: true, fluxo: await retomarFluxo(env, corpo.id) }));
    case 'estimar': return responder(async () => ({ pessoas: await contarUltimos30(env, corpo.gatilho || {}) }));
    default: return json({ error: 'Ação desconhecida.' }, 400);
  }
}

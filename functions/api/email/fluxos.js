// GET  /api/email/fluxos?key=...[&arquivados=1]  → fluxos (nome, gatilhos e situação vêm no quadro)
// GET  /api/email/fluxos?key=...&id=<id>         → um fluxo com problemas e as opções dos filtros
// POST /api/email/fluxos?key=...  → { acao: 'criar', nome? }
//                                   { acao: 'salvar', id, nome, grafo, versao }   (rascunho; conflito entre abas → 409)
//                                   { acao: 'duplicar' | 'arquivar' | 'desarquivar', id }
//
// Spec spec-email-proprio.md, módulo 9 (issue 385). Regras em ../_email-fluxos.js.
// Publicar, pausar e rodar são da 386.
import {
  ErroFluxo, listarFluxos, lerFluxo, criarFluxo, salvarFluxo, duplicarFluxo, arquivarFluxo, opcoes,
} from '../_email-fluxos.js';

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
    default: return json({ error: 'Ação desconhecida.' }, 400);
  }
}

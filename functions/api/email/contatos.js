// GET  /api/email/contatos?key=...[&busca=&situacao=&origem=&funil=&pagina=]  → lista, totais e opções dos filtros
// GET  /api/email/contatos?key=...&id=<id>                                    → detalhe com entradas e e-mails
// POST /api/email/contatos?key=...  → { acao: 'descadastrar' | 'reativar', id }
//
// Spec spec-email-proprio.md, módulo 4 (issue 380). Regras em ../_email-contatos.js.
import { ErroContato, listar, detalhe, descadastrar, reativar } from '../_email-contatos.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

const responder = async (fn) => {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof ErroContato) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const p = url.searchParams;
  if (p.get('id')) return responder(() => detalhe(env, p.get('id')));
  return responder(() => listar(env, {
    busca: p.get('busca') || '', situacao: p.get('situacao') || '', origem: p.get('origem') || '',
    funil: p.get('funil') || '', pagina: p.get('pagina') || 1,
  }));
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  if (corpo.acao === 'descadastrar') return responder(async () => ({ ok: true, ...(await descadastrar(env, corpo.id)) }));
  if (corpo.acao === 'reativar') return responder(async () => ({ ok: true, contato: await reativar(env, corpo.id) }));
  return json({ error: 'Ação desconhecida.' }, 400);
}

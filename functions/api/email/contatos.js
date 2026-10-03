// GET  /api/email/contatos?key=...[&busca=&situacao=&origem=&funil=&pagina=]  → lista, totais e opções dos filtros
// GET  /api/email/contatos?key=...&id=<id>                                    → detalhe com entradas, e-mails e segmentos (381)
// POST /api/email/contatos?key=...  → { acao: 'descadastrar' | 'reativar', id }
//                                    { acao: 'tirar_do_fluxo', id, fluxo_id }   (386)
//
// Spec spec-email-proprio.md, módulo 4 (issue 380). Regras em ../_email-contatos.js.
import { ErroContato, listar, detalhe, descadastrar, reativar } from '../_email-contatos.js';
import { segmentosDoContato } from '../_email-segmentos.js';
import { tirarManual } from '../_email-motor.js';

const json = (dados, status = 200) => Response.json(dados, { status });

/** Fluxos em que o contato está ou esteve (386). */
async function fluxosDoContato(env, contatoId) {
  try {
    return (await env.DB.prepare(
      `SELECT p.fluxo_id, f.nome, p.situacao, p.motivo_saida, p.entrou_em FROM email_fluxo_pessoas p JOIN email_fluxos f ON f.id = p.fluxo_id
        WHERE p.contato_id = ? ORDER BY p.entrou_em DESC`,
    ).bind(Number(contatoId)).all()).results || [];
  } catch {
    return []; // migration 0058 ainda não aplicada
  }
}
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
  if (p.get('id')) {
    return responder(async () => {
      const d = await detalhe(env, p.get('id'));
      return { ...d, segmentos: await segmentosDoContato(env, d.contato.id), fluxos: await fluxosDoContato(env, d.contato.id) };
    });
  }
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
  if (corpo.acao === 'tirar_do_fluxo') {
    return responder(async () => {
      if (!(await tirarManual(env, corpo.fluxo_id, corpo.id))) throw new ErroContato('Este contato não está andando nesse fluxo.', 409);
      return { ok: true };
    });
  }
  return json({ error: 'Ação desconhecida.' }, 400);
}

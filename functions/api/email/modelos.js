// GET  /api/email/modelos?key=...  → modelos e campos por canal
// POST /api/email/modelos?key=...  → { acao: 'salvar', id?, modelo }   (sem id: cria com nome e canal)
//                                    { acao: 'previa', modelo }         (rascunho, sem gravar)
//                                    { acao: 'enviar_teste', id, para }
//                                    { acao: 'duplicar' | 'arquivar' | 'desarquivar', id }
//
// Spec spec-email-proprio.md, módulo 2 (issue 378). Regras em ../_email-modelos.js;
// montagem do e-mail em ../_email-render.js; envio do teste igual ao da 377.
import { CAMPOS, CANAIS, desconhecidos, exemplos } from '../_email-campos.js';
import { montarEmail } from '../_email-render.js';
import { lerConfig } from '../_email-config.js';
import {
  ErroModelo, listarModelos, obterModelo, criarModelo, salvarModelo, duplicarModelo,
  arquivarModelo, desarquivarModelo, validarModelo,
} from '../_email-modelos.js';
import { enviarTeste } from './config.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

export async function onRequestGet({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  return json({ modelos: await listarModelos(env), campos: CAMPOS });
}

/** Prévia com os dados de exemplo; campo desconhecido fica marcado. */
async function previa(env, request, m) {
  const canal = CANAIS.includes(m?.canal) ? m.canal : null;
  if (!canal) throw new ErroModelo('Escolha o canal do modelo: transacional ou marketing.');
  const rasc = { canal, assunto: String(m.assunto ?? ''), previa: String(m.previa ?? ''), corpo: String(m.corpo ?? '') };
  const cfg = await lerConfig(env);
  const e = montarEmail(rasc, cfg, { valores: exemplos(canal), marcar: true, site: new URL(request.url).origin, descadastro: '#' });
  return {
    assunto: e.assunto, previa: e.previa, html: e.html, avisos: e.avisos,
    desconhecidos: desconhecidos(`${rasc.assunto}\n${rasc.previa}\n${rasc.corpo}`, canal),
  };
}

async function testar(env, request, id, para) {
  const m = await obterModelo(env, id);
  if (m.arquivado) throw new ErroModelo('Este modelo está arquivado. Tire do arquivo antes de testar.', 409);
  validarModelo(m); // modelo recém-criado ainda sem assunto ou corpo
  const cfg = await lerConfig(env);
  const e = montarEmail(m, cfg, { valores: exemplos(m.canal), site: new URL(request.url).origin });
  return enviarTeste(env, {
    canal: m.canal, para, assunto: e.assunto, html: e.html, texto: e.texto, tag: 'teste-modelo', refId: `modelo:${m.id}`,
  });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  try {
    switch (corpo.acao) {
      case 'salvar': {
        const modelo = corpo.id ? await salvarModelo(env, corpo.id, corpo.modelo || {}) : await criarModelo(env, corpo.modelo || {});
        return json({ ok: true, modelo });
      }
      case 'previa': return json(await previa(env, request, corpo.modelo));
      case 'enviar_teste': return await testar(env, request, corpo.id, corpo.para);
      case 'duplicar': return json({ ok: true, modelo: await duplicarModelo(env, corpo.id) });
      case 'arquivar': return json({ ok: true, modelo: await arquivarModelo(env, corpo.id) });
      case 'desarquivar': return json({ ok: true, modelo: await desarquivarModelo(env, corpo.id) });
      default: return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof ErroModelo) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
}

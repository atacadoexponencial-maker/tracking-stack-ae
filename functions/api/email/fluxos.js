// GET  /api/email/fluxos?key=...[&arquivados=1]  → fluxos (nome, gatilhos e situação vêm no quadro)
// GET  /api/email/fluxos?key=...&id=<id>         → um fluxo com problemas e as opções dos filtros
// POST /api/email/fluxos?key=...  → { acao: 'criar', nome? }
//                                   { acao: 'salvar', id, nome, grafo, versao }   (rascunho; conflito entre abas → 409)
//                                   { acao: 'duplicar' | 'arquivar' | 'desarquivar', id }
//                                   { acao: 'publicar' | 'pausar' | 'retomar', id, versao? }   (386; publicar mudanças: 387)
//                                   { acao: 'descartar', id, versao }   (387)
//                                   { acao: 'testar', id, para, no?, saida? }   → um cartão do rascunho por vez (387)
//                                   { acao: 'tirar', id, contato_id }   (388)
// GET  ...&id=<id>&numeros=7|30|tudo   → números por cartão (388)
// GET  ...&id=<id>&pessoas=1[&no=&pagina=]  → quem está dentro (388); a lista traz `totais` de cada fluxo
//                                   { acao: 'estimar', gatilho }   → quantos contatos teriam entrado nos últimos 30 dias (386)
//
// Spec spec-email-proprio.md, módulo 9 (issues 385 e 386). Regras em ../_email-fluxos.js;
// a rodada que faz os fluxos andarem é /api/sync/email-fluxos.
import {
  ErroFluxo, listarFluxos, lerFluxo, criarFluxo, salvarFluxo, duplicarFluxo, arquivarFluxo, opcoes,
  publicarFluxo, pausarFluxo, retomarFluxo, descartarMudancas, passoDeTeste,
} from '../_email-fluxos.js';
import { contarUltimos30 } from '../_email-acontecimentos.js';
import { numerosDoFluxo, pessoasDentro, totaisDosFluxos } from '../_email-fluxos-numeros.js';
import { tirarManual } from '../_email-motor.js';
import { enviarTeste } from './config.js';
import { lerConfig, emailValido } from '../_email-config.js';
import { montarEmail } from '../_email-render.js';
import { exemplos } from '../_email-campos.js';

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
  const p = url.searchParams;
  const id = p.get('id');
  if (id && p.get('numeros')) return responder(() => numerosDoFluxo(env, id, p.get('numeros')));
  if (id && p.get('pessoas')) return responder(() => pessoasDentro(env, id, { no: p.get('no') || '', pagina: p.get('pagina') || 1 }));
  if (id) return responder(async () => { const [fluxo, op] = await Promise.all([lerFluxo(env, id), opcoes(env)]); return { fluxo, opcoes: op }; });
  return responder(async () => {
    const l = await listarFluxos(env, { arquivados: p.get('arquivados') === '1' });
    const tot = await totaisDosFluxos(env, l.fluxos.map((f) => f.id));
    return { ...l, fluxos: l.fluxos.map((f) => ({ ...f, totais: tot[f.id] || { dentro: 0, concluiram: 0, clique: null } })) };
  });
}

// Teste passo a passo (387): o e-mail sai pelo mesmo teste do modelo (origem 'teste').
async function testar(env, request, corpo) {
  const para = String(corpo.para || '').trim().toLowerCase();
  if (!emailValido(para)) throw new ErroFluxo('Digite um e-mail válido para receber o teste.');
  const site = new URL(request.url).origin;
  return passoDeTeste(env, corpo.id, corpo, {
    enviarEmail: async (modelo) => {
      const cfg = await lerConfig(env);
      const e = montarEmail(modelo, cfg, { valores: exemplos('marketing'), site });
      const r = await enviarTeste(env, { canal: 'marketing', para, assunto: e.assunto, html: e.html, texto: e.texto, tag: 'teste-fluxo', refId: `fluxo:${corpo.id}` });
      const d = await r.json();
      return r.ok ? { ok: true, assunto: e.assunto } : { ok: false, erro: d.error };
    },
  });
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
    case 'publicar': return responder(async () => ({ ok: true, fluxo: await publicarFluxo(env, corpo.id, corpo) }));
    case 'descartar': return responder(async () => ({ ok: true, fluxo: await descartarMudancas(env, corpo.id, corpo) }));
    case 'testar': return responder(() => testar(env, request, corpo));
    case 'tirar': return responder(async () => {
      if (!(await tirarManual(env, corpo.id, corpo.contato_id))) throw new ErroFluxo('Este contato não está andando nesse fluxo.', 409);
      return { ok: true };
    });
    case 'pausar': return responder(async () => ({ ok: true, fluxo: await pausarFluxo(env, corpo.id) }));
    case 'retomar': return responder(async () => ({ ok: true, fluxo: await retomarFluxo(env, corpo.id) }));
    case 'estimar': return responder(async () => ({ pessoas: await contarUltimos30(env, corpo.gatilho || {}) }));
    default: return json({ error: 'Ação desconhecida.' }, 400);
  }
}

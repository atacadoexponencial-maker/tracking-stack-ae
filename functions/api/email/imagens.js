// GET  /api/email/imagens?key=...[&busca=]  → imagens da biblioteca, com onde cada uma é usada
// POST /api/email/imagens?key=...  multipart, campo `arquivo` → sobe UMA imagem (a tela manda uma por vez)
//                                  JSON { acao: 'renomear', id, nome } | { acao: 'apagar', id }
//
// Spec spec-editor-email.md, módulo 4 (issue 392). Regras em ../_email-imagens.js.
import {
  ErroImagem, guardarImagem, listarImagens, renomearImagem, apagarImagem, urlImagem, PESO_MAX, LARGURA_RECOMENDADA,
} from '../_email-imagens.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const comUrl = (origem, f) => ({ ...f, url: urlImagem(origem, f) });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const imagens = await listarImagens(env, { busca: url.searchParams.get('busca') || '' });
  return json({ imagens: imagens.map((f) => comUrl(url.origin, f)), limites: { peso: PESO_MAX, largura: LARGURA_RECOMENDADA } });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      let arquivo;
      try { arquivo = (await request.formData()).get('arquivo'); } catch { throw new ErroImagem('Envio inválido: esperado multipart/form-data.'); }
      if (!arquivo || typeof arquivo.arrayBuffer !== 'function') throw new ErroImagem('Nenhum arquivo enviado.');
      const f = await guardarImagem(env, { bytes: new Uint8Array(await arquivo.arrayBuffer()), nome: arquivo.name });
      return json({ ok: true, imagem: comUrl(url.origin, { ...f, usos: [] }) });
    }
    const corpo = await request.json().catch(() => ({}));
    if (corpo.acao === 'renomear') return json({ ok: true, imagem: comUrl(url.origin, await renomearImagem(env, corpo.id, corpo.nome)) });
    if (corpo.acao === 'apagar') return json(await apagarImagem(env, corpo.id));
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (e) {
    if (e instanceof ErroImagem) return json({ error: e.message, usos: e.usos }, e.status);
    throw e;
  }
}

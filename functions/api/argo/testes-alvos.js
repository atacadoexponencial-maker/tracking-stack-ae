// GET /api/argo/testes-alvos?key=...  — o que dá para escolher como lado de um teste
//
// Issue 403. Anúncios e conjuntos da conta (Graph API, ativos e pausados) e os
// testes A/B de página do dash (D1). Cada fonte falha sozinha: Meta fora não
// esconde os A/Bs, e vice-versa. Só leitura.
import { recusarSemChave } from '../_argo-auth.js';
import { listarAnuncios, conjuntosDosAnuncios } from '../_argo-meta.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

  const avisos = [];
  const meta = await listarAnuncios(env);
  if (!meta.ok) avisos.push(meta.aviso);
  const anuncios = meta.ok
    ? meta.anuncios.slice().sort((a, b) => Number(b.ativo) - Number(a.ativo) || (b.criado_em || '').localeCompare(a.criado_em || ''))
    : [];

  let abs = [];
  try {
    const r = await env.DB.prepare(`SELECT id, slug, nome, path, status FROM ab_tests ORDER BY criado_em DESC LIMIT 50`).all();
    abs = (r.results || []).map((t) => ({ id: Number(t.id), slug: t.slug, nome: t.nome, path: t.path, status: t.status }));
  } catch {
    avisos.push('Não foi possível ler os testes A/B agora.');
  }

  return Response.json({ anuncios, conjuntos: conjuntosDosAnuncios(anuncios), abs, avisos });
}

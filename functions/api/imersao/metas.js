// POST /api/imersao/metas?key=...  → grava as metas internas da Imersão 2027
//
// Spec spec-imersao-2027.md, S8-02. Corpo: { campo: valor } com os campos de
// CAMPOS_META (vazio apaga a meta). Valor inválido recusa o envio inteiro com
// o motivo de cada campo. Sucesso devolve a Visão geral já recalculada.
import { validarMetas } from '../_imersao.js';
import { autorizado, montarResposta } from './index.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);

  let corpo;
  try { corpo = await request.json(); } catch { return json({ erro: 'Corpo inválido.' }, 400); }

  const v = validarMetas(corpo);
  if (!v.ok) return json({ erro: 'Confira os campos marcados.', erros: v.erros }, 400);

  try {
    const agora = Math.floor(Date.now() / 1000);
    for (const [campo, valor] of Object.entries(v.metas)) {
      if (valor === null) {
        await env.DB.prepare('DELETE FROM imersao_metas WHERE campo = ?').bind(campo).run();
      } else {
        await env.DB.prepare(`INSERT INTO imersao_metas (campo, valor, alterada_em) VALUES (?, ?, ?)
                              ON CONFLICT(campo) DO UPDATE SET valor = excluded.valor, alterada_em = excluded.alterada_em`)
          .bind(campo, String(valor), agora).run();
      }
    }
    return json(await montarResposta(env));
  } catch {
    return json({ erro: 'Não foi possível salvar as metas agora.' }, 500);
  }
}

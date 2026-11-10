// GET /api/cerebro?key=...  — painel do segundo cérebro (série S9 do gestor-ae, S9-04).
//
// A guarda vem na primeira linha (mesma DASH_KEY das outras rotas): sem ela, nenhum
// número sai. O painel é montado na VPS; a aba só desenha.
import { conectar, CONTA } from './_argo-db.js';
import { recusarSemChave } from './_argo-auth.js';
import { montarResposta } from './_cerebro.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    const sql = conectar(env);
    const linhas = await sql`SELECT painel, gerado_em FROM argo.cerebro_painel WHERE conta = ${CONTA}`;
    return Response.json(montarResposta(linhas[0] || null));
  } catch {
    return Response.json({ erro: 'Não consegui ler o painel do cérebro.' }, { status: 500 });
  }
}

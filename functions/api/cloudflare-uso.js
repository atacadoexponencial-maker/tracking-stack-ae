// /api/cloudflare-uso — aba "Cloudflare" do dash (spec-uso-cloudflare.md, S1-02).
//
// GET ?key=   requisições de Functions de hoje da conta × teto de 100 mil/dia,
//             por projeto, com faixa de cor, palavra e horário da leitura.
//
// Toda regra está em _cloudflare-uso.js; aqui só a guarda e a resposta.

import { recusarSemChave } from './_argo-auth.js';
import { lerUso } from './_cloudflare-uso.js';

export async function onRequestGet(context, deps = {}) {
  const { request, env } = context;
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  const dados = await lerUso({ env, ...deps });
  return Response.json(dados, { headers: { 'Cache-Control': 'no-store' } });
}

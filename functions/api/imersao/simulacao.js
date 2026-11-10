// GET /api/imersao/simulacao?key=...&ajuste=60  → projeção até o fim (S8-03)
//
// Spec spec-imersao-2027.md. Mesmos dados da Visão geral (exemplo ou reais);
// o ajuste de ritmo só vale para esta resposta, nada é gravado.
import { simular } from '../_imersao.js';
import { autorizado, carregarDados } from './index.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const ajuste = Number(url.searchParams.get('ajuste'));
  try {
    const c = await carregarDados(env);
    return json(simular(c.dados, c.agora, Number.isFinite(ajuste) ? ajuste : 0, { exemplo: c.exemplo }));
  } catch {
    return json({ erro: 'Não foi possível calcular a simulação agora.' }, 500);
  }
}

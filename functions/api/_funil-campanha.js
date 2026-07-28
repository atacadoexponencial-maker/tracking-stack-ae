// Campanha do Meta → funil (spec 2026-07-28).
//
// O automático resolve o previsível; o que não casa fica para o override
// manual gravado em campaign_funnel_map. Nada é descartado em silêncio: sem
// automático e sem override, a campanha cai no balde FUNIL_SEM_CLASSIFICACAO,
// que aparece no relatório com o gasto à mostra.

import { CANAL_AQUISICAO } from './_canal.js';

export const FUNIL_SEM_CLASSIFICACAO = 'sem-funil';

export function resolverFunilAuto(campaignName, funisConhecidos) {
  const nome = (campaignName == null ? '' : String(campaignName)).trim();
  if (!nome) return null;

  // Impulsionamento ("Post do Instagram: ...") não segue a nomenclatura
  // ae_<objetivo>_<publico>_<otimizacao>_<funil> — não tem underscore nenhum.
  if (!nome.includes('_')) return CANAL_AQUISICAO;

  const ultimo = nome.split('_').pop().trim().toLowerCase();
  if (!ultimo) return null;

  const candidatos = (funisConhecidos || [])
    .map((f) => (f == null ? '' : String(f)).trim())
    .filter(Boolean)
    // Prefixo só vale em fronteira de hífen: 'lives-semanais' casa
    // 'lives-semanais-v1' (e um futuro -v2), mas 'workshop' não casa
    // 'workshopping'.
    .filter((f) => {
      const alvo = f.toLowerCase();
      return alvo === ultimo || alvo.startsWith(ultimo + '-');
    });

  if (!candidatos.length) return null;

  const exato = candidatos.find((f) => f.toLowerCase() === ultimo);
  if (exato) return exato;

  // Mais curto = mais genérico, menos chance de chutar uma variante errada.
  return candidatos.sort((a, b) => a.length - b.length)[0];
}

// Funis efetivamente capturados, na mesma definição usada por /api/leads e
// /api/conversion (evento manda, sessão é fallback). Independente de período,
// para o dropdown do dashboard não perder opção ao trocar a data.
export async function listarFunisConhecidos(DB) {
  const { results } = await DB.prepare(`
    SELECT DISTINCT COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel
    FROM event_log e
    LEFT JOIN sessions s ON e.session_id = s.session_id
    WHERE COALESCE(NULLIF(e.funnel, ''), s.funnel) IS NOT NULL
      AND COALESCE(NULLIF(e.funnel, ''), s.funnel) <> ''
    ORDER BY funnel
  `).all();
  return (results || []).map((r) => r.funnel);
}

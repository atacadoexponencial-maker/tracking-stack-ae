// A que funil pertence cada página de entrada (01/10/2026).
//
// É o DENOMINADOR da conversão por funil (/api/conversion com &funnel= ou
// &by=funnel): visitante que chegou por uma destas páginas conta como visita
// daquele funil. Antes o denominador era `sessions.funnel`, que só é gravado
// quando o link traz `&funnel=` — vazio em 99% das sessões (9.980 de ~10.100
// em 30 dias), e a conversão filtrada por funil saía com meia dúzia de visitas.
//
// Só entra página com formulário do funil ou que leva direto a ele. Obrigado,
// VSL, live v2 (sem formulário) e a LP paga da Black ficam fora: não têm
// conversão em lead para medir.
//
// ⚠️ PÁGINA NOVA DE CAPTAÇÃO = UMA LINHA AQUI, senão as visitas dela não
// entram na conversão do funil (e nem aparecem na aba Leads filtrada).
// O nome do funil é o mesmo que o formulário da página declara em lead_data.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const FUNIL_POR_PAGINA = new Map([
  ['/', 'sessao-estrategica'],
  ['/se-v1', 'sessao-estrategica'],
  ['/se-v2', 'sessao-estrategica'],
  ['/se-v3', 'sessao-estrategica'],
  ['/consultoria-gratuita-atacado', 'sessao-estrategica'],
  ['/workshop-gratuito', 'workshop'],
  ['/workshop-gratuito-v2', 'workshop'],
  ['/lives-semanais-v1', 'lives-semanais-v1'],
  ['/aplicacao-mentoria', 'aplicacao-mentoria'],
  // A LP do tráfego leva ao formulário em /aplicacao-trafego-atacado.
  ['/trafego-atacado', 'trafego-atacado'],
  ['/aplicacao-trafego-atacado', 'trafego-atacado'],
  ['/calculadora-atacado', 'calculadora'],
]);

/** Funil da página (path já normalizado, sem barra final), ou null. */
export function funilDaPagina(lp) {
  return FUNIL_POR_PAGINA.get(lp) || null;
}

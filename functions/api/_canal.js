// Regra única de canal do lead (spec 2026-07-28).
//
// Canal = por ONDE a pessoa chegou (bio, anúncio, ManyChat...). Não confundir
// com funil, que é PARA ONDE ela foi (a oferta). O tracking historicamente
// misturou os dois no campo `funnel`; este módulo separa a metade "canal".
//
// Derivado do que a sessão já grava — nenhuma coluna nova, e vale para o
// histórico inteiro. Cascata: a PRIMEIRA condição que casar vence.

export const CANAL_AQUISICAO = 'aquisicao';

// Ordem de exibição no dashboard.
export const CANAIS = ['meta-ads', 'bio', 'manychat', 'email', 'outro', 'direto'];

// `aquisicao` NÃO entra nesta função de propósito: post impulsionado não manda
// ninguém para o site, então não existe sessão com esse canal. Ele é rótulo do
// lado do INVESTIMENTO (ver _cpl-calculo.js), não do lado do lead.
export function canalDeLead(lead) {
  const texto = (v) => (v == null ? '' : String(v)).trim().toLowerCase();

  // ManyChat primeiro: as páginas /materiais/* podem chegar com ou sem UTM.
  if (texto(lead.material)) return 'manychat';

  if (texto(lead.utm_campaign).startsWith('bioperfil')) return 'bio';

  const fonte = texto(lead.utm_source);
  if (fonte === 'facebookads') return 'meta-ads';
  if (fonte.includes('email') || fonte.includes('ghl')) return 'email';
  if (fonte) return 'outro';
  return 'direto';
}

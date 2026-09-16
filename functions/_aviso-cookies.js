// Situação do aviso de cookies recebida em cada evento (spec-aviso-cookies.md).
//
// O aviso é só informativo: esta situação é registro interno de ciência e não
// decide nenhum envio a Meta, GA4 ou CRM. Valor legível para quem lê o
// event_log; qualquer coisa fora da lista vira 'unknown', como antes da feature,
// e o evento nunca é recusado por causa deste campo.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const SITUACOES_AVISO = ['aviso exibido', 'aviso fechado'];

export function normalizarSituacaoAviso(valor) {
  const v = String(valor == null ? '' : valor).trim().toLowerCase();
  return SITUACOES_AVISO.includes(v) ? v : 'unknown';
}

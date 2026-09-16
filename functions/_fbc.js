// Validade do identificador de clique do Meta (_fbc / fbc).
//
// O Meta pede o cookie _fbc com expiração de 90 dias (documentação "fbp and
// fbc Parameters"). O middleware regrava o cookie a cada visita, então um
// Max-Age fixo recomeçaria a contagem sempre e o clique viveria para sempre.
// A conta aqui parte do horário em que o clique foi registrado — o terceiro
// campo do fbc, em milissegundos: `fb.<subdominio>.<criacaoMs>.<fbclid>`.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const FBC_VALIDADE_MS = 90 * 24 * 3600 * 1000;

/** Milissegundos de vida que restam ao fbc (0 quando venceu ou não dá para ler). */
export function vidaRestanteFbc(fbc, agoraMs = Date.now()) {
  const partes = String(fbc || '').split('.');
  if (partes.length < 4 || partes[0] !== 'fb') return 0;
  const criacao = Number(partes[2]);
  if (!Number.isFinite(criacao) || criacao <= 0) return 0;
  return Math.max(0, criacao + FBC_VALIDADE_MS - agoraMs);
}

/** O fbc ainda está dentro dos 90 dias? */
export function fbcValido(fbc, agoraMs = Date.now()) {
  return vidaRestanteFbc(fbc, agoraMs) > 0;
}

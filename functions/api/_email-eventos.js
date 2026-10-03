// Avisos do Postmark → evento normalizado e efeito no envio (issue 377).
// Funções puras: sem banco, sem rede.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

/** Peso de cada situação: a final é sempre a mais grave que já aconteceu. */
export const GRAVIDADE = {
  falhou: 0,
  enviado: 1,
  voltou_temporario: 2,
  entregue: 3,
  aberto: 4,
  clicado: 5,
  descadastrou: 6,
  voltou: 7,
  spam: 7,
};

/** Coluna de data preenchida (só na primeira vez) por tipo de evento. */
export const COLUNA_DATA = {
  entregue: 'entregue_em',
  aberto: 'aberto_em',
  clicado: 'clicado_em',
  voltou: 'voltou_em',
  spam: 'spam_em',
  descadastrou: 'descadastrou_em',
  voltou_temporario: null,
};

// Devolução definitiva: o Postmark desativa o endereço (Inactive) ou o tipo é
// claramente permanente. O resto (caixa cheia, atraso, DNS) é temporário.
const DEFINITIVAS = new Set(['HardBounce', 'BadEmailAddress', 'ManuallyDeactivated']);

/** ISO 8601 → epoch em segundos; null quando não dá para ler. */
export function epoch(iso) {
  if (!iso || typeof iso !== 'string') return null;
  // O Postmark manda até 7 casas de fração ("…54.9070259Z"); corta em 3.
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Payload do Postmark → { tipo, messageId, stream, ocorridoEm, chave, detalhe }.
 * null quando o corpo não é um aviso que interessa (lixo, tipo desconhecido,
 * reativação de endereço ou supressão que já chegou como Bounce/Spam).
 */
export function normalizarEvento(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const messageId = typeof p.MessageID === 'string' && p.MessageID ? p.MessageID : null;
  if (!messageId) return null;
  let tipo = null;
  let data = null;
  let detalhe = null;
  switch (p.RecordType) {
    case 'Delivery':
      tipo = 'entregue'; data = p.DeliveredAt; break;
    case 'Bounce': {
      const definitiva = p.Inactive === true || DEFINITIVAS.has(p.Type);
      tipo = definitiva ? 'voltou' : 'voltou_temporario';
      data = p.BouncedAt;
      detalhe = { tipo_devolucao: typeof p.Type === 'string' ? p.Type : null };
      break;
    }
    case 'SpamComplaint':
      tipo = 'spam'; data = p.BouncedAt; break;
    case 'Open':
      tipo = 'aberto'; data = p.ReceivedAt; break;
    case 'Click':
      tipo = 'clicado'; data = p.ReceivedAt;
      detalhe = { link: typeof p.OriginalLink === 'string' ? p.OriginalLink.slice(0, 500) : null };
      break;
    case 'SubscriptionChange':
      // Só o descadastro de verdade. Supressão por HardBounce/SpamComplaint já
      // chega no aviso próprio; SuppressSending false é reativação.
      if (p.SuppressSending !== true) return null;
      if (p.SuppressionReason && p.SuppressionReason !== 'ManualSuppression') return null;
      tipo = 'descadastrou'; data = p.ChangedAt;
      detalhe = { motivo: p.SuppressionReason || null };
      break;
    default:
      return null;
  }
  const ocorridoEm = epoch(data);
  const link = detalhe?.link || '';
  return {
    tipo,
    messageId,
    stream: typeof p.MessageStream === 'string' ? p.MessageStream : null,
    ocorridoEm,
    chave: `${tipo}|${messageId}|${ocorridoEm ?? ''}|${link}`,
    detalhe,
  };
}

/** Situação final depois de um evento (pura, para teste e conferência). */
export function situacaoDepois(atual, tipo) {
  return (GRAVIDADE[tipo] ?? -1) > (GRAVIDADE[atual] ?? -1) ? tipo : atual;
}

/**
 * UPDATE atômico do envio: a data do tipo só entra se estiver vazia e a
 * situação só sobe de gravidade. Um comando só, para dois avisos simultâneos
 * (Open e Click) não se atropelarem.
 */
export function sqlAtualizarEnvio(evento, envioId) {
  const peso = `CASE situacao ${Object.entries(GRAVIDADE).map(([s, g]) => `WHEN '${s}' THEN ${g}`).join(' ')} ELSE -1 END`;
  const coluna = COLUNA_DATA[evento.tipo];
  const sets = [];
  const binds = [];
  if (coluna) { sets.push(`${coluna} = COALESCE(${coluna}, ?)`); binds.push(evento.ocorridoEm ?? Math.floor(Date.now() / 1000)); }
  sets.push(`situacao = CASE WHEN ${peso} < ? THEN ? ELSE situacao END`);
  binds.push(GRAVIDADE[evento.tipo], evento.tipo);
  return { sql: `UPDATE email_envios SET ${sets.join(', ')} WHERE id = ?`, binds: [...binds, envioId] };
}

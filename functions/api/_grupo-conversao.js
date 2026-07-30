// Regras de elegibilidade da conversão "EntrouGrupo" (spec 2026-07-29).
//
// Decide QUAIS movimentações de grupo de WhatsApp viram conversão no Meta. É
// lógica pura de propósito — sem D1, sem fetch — para poder ser testada sozinha
// (tests/grupo-conversao.test.js) e para o despachante ficar só com o I/O.
//
// A dedup por pessoa NÃO mora aqui: ela é a restrição UNIQUE(group_jid, phone)
// da tabela whatsapp_group_conversions. Regra de banco não perde corrida entre
// duas execuções do cron; checagem em memória perderia.

const SUFIXO_TELEFONE = '@s.whatsapp.net';

// Telefone dentro do JID do participante. A Evolution entrega
// `5511987654321@s.whatsapp.net` no caso bom, mas às vezes manda um ID opaco
// (`...@lid`) que NÃO é telefone — mandar aquilo ao Meta como número seria
// inventar dado. Nesses casos devolve '' e a entrada é descartada.
export function telefoneDoJid(jid) {
  const texto = (jid == null ? '' : String(jid)).trim();
  if (!texto.endsWith(SUFIXO_TELEFONE)) return '';
  const digitos = texto.slice(0, -SUFIXO_TELEFONE.length).replace(/\D/g, '');
  // Faixa plausível de telefone internacional com DDI. Abaixo disso é ruído.
  if (digitos.length < 10 || digitos.length > 15) return '';
  return digitos;
}

// Identificador do evento enviado ao Meta. Estável por (grupo, pessoa): se uma
// pendência for reenviada, o Meta reconhece o mesmo acontecimento e não conta
// duas conversões. É o par da dedup local — uma protege o nosso banco, esta
// protege o número do Meta.
export function eventIdDaEntrada(groupJid, phone) {
  return `grupo:${groupJid}:${phone}`;
}

// Sufixo usado para procurar o mesmo telefone entre os leads conhecidos. Os
// números chegam em formatos diferentes (`5511987654321` no WhatsApp,
// `+55 11 98765-4321` no lead), então o casamento é pelos últimos 11 dígitos —
// DDD (2) + celular (9).
//
// São 11 e não 10 porque 10 corta o DDD ao meio: `5511987654321` e
// `5521987654321` terminam nos MESMOS 10 dígitos e colidiriam (pego por teste).
// Deliberadamente conservador: um falso negativo custa só o enriquecimento; um
// falso positivo mandaria ao Meta os dados de navegação de OUTRA pessoa.
//
// Limite conhecido: número antigo sem o 9 (12 dígitos com DDI) não casa. Fica
// sem enriquecimento, o que é degradação aceitável — a conversão vai assim mesmo.
export function sufixoParaCasar(phone) {
  const digitos = (phone == null ? '' : String(phone)).replace(/\D/g, '');
  return digitos.length >= 11 ? digitos.slice(-11) : '';
}

// `grupo` é a linha de whatsapp_groups_tracked (ou undefined se o grupo não é
// monitorado). Cascata: a primeira condição que falhar decide o motivo.
export function entradaElegivel(evento, grupo) {
  const nao = (motivo) => ({ elegivel: false, motivo, phone: '' });

  if (!evento || evento.action !== 'entrou') return nao('nao_e_entrada');

  // Grupo primeiro: nada da pessoa é derivado antes de saber que o grupo
  // participa. `conversion_since` ausente significa "ainda não ativado" — sem
  // marco de corte não há como distinguir entrada nova de histórico, e mandar o
  // histórico inteiro ao Meta de uma vez seria pior que não mandar nada.
  if (!grupo || !grupo.send_conversion || !grupo.conversion_since) {
    return nao('grupo_nao_elegivel');
  }

  if (!(evento.occurredAtUnix >= grupo.conversion_since)) return nao('antes_do_corte');

  const phone = telefoneDoJid(evento.participantJid);
  if (!phone) return nao('sem_telefone');

  return { elegivel: true, motivo: 'ok', phone };
}

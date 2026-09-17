// Regras de elegibilidade da conversão "EntrouGrupo" (spec 2026-07-29).
//
// Decide QUAIS movimentações de grupo de WhatsApp viram conversão no Meta. É
// lógica pura de propósito — sem D1, sem fetch — para poder ser testada sozinha
// (tests/grupo-conversao.test.js) e para o despachante ficar só com o I/O.
//
// A dedup por pessoa NÃO mora aqui: ela é a restrição UNIQUE(group_jid, phone)
// da tabela whatsapp_group_conversions. Regra de banco não perde corrida entre
// duas execuções do cron; checagem em memória perderia.

import { padronizarTelefone } from '../_telefone.js';

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

// Celular brasileiro no formato antigo, sem o nono dígito, recebe o 9.
//
// O WhatsApp entrega a MAIORIA dos números da live sem o 9 (63 de 89 em
// 2026-09-16: `558496078857`), enquanto o lead digita no formulário com ele
// (`+5584996078857`, 484 de 494 leads). Sem completar, o casamento com o lead
// nunca acontecia e o Meta recebia um telefone que não é o do perfil da pessoa.
//
// Só mexe no que é inequivocamente celular antigo: DDI 55 + DDD + 8 dígitos
// começando em 6–9. Fixo (2–5), número estrangeiro e número já com o 9 passam
// intactos.
export function comNonoDigito(phone) {
  // Regra única de telefone (spec-protecoes-integracoes.md). O event_id e a
  // chave UNIQUE da fila continuam usando o telefone CRU (telefoneDoJid).
  return padronizarTelefone(phone).digitos;
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
// Número sem o 9 é completado antes (ver `comNonoDigito`), então o sufixo sai
// sempre no formato com 9 — o mesmo em que o lead está gravado.
export function sufixoParaCasar(phone) {
  const digitos = comNonoDigito(phone);
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

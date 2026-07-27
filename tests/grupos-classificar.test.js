import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classificarEvento, diaLocal, diaLocalDeUnix } from '../functions/api/webhooks/_classificar.js';

const RECEBIDO_MS = Date.parse('2026-07-27T18:00:00.000Z');

function evento(extra = {}) {
  return {
    event: 'group-participants.update',
    instance: 'MarcelleProfissional',
    date_time: '2026-07-27T17:30:00.000Z',
    data: {
      id: '120363380235066572@g.us',
      author: '5521999999999@s.whatsapp.net',
      participants: ['5511888888888@s.whatsapp.net'],
      action: 'add',
      ...extra,
    },
  };
}

test('add vira "entrou"', () => {
  const r = classificarEvento(evento(), RECEBIDO_MS);
  assert.equal(r.groupJid, '120363380235066572@g.us');
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].action, 'entrou');
  assert.equal(r.linhas[0].participantJid, '5511888888888@s.whatsapp.net');
});

test('remove por outra pessoa vira "removido"', () => {
  const r = classificarEvento(evento({ action: 'remove' }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'removido');
  assert.equal(r.linhas[0].actorJid, '5521999999999@s.whatsapp.net');
});

test('remove de si mesmo vira "saiu"', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5511888888888@s.whatsapp.net',
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
});

test('sufixo de dispositivo no JID não confunde saiu com removido', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5511888888888:12@s.whatsapp.net',
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
});

test('sem autor informado, remove assume "saiu"', () => {
  const r = classificarEvento(evento({ action: 'remove', author: undefined }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
  assert.equal(r.linhas[0].actorJid, null);
});

test('vários participantes viram várias linhas', () => {
  const r = classificarEvento(evento({
    participants: ['551188@s.whatsapp.net', '551199@s.whatsapp.net', '551177@s.whatsapp.net'],
  }), RECEBIDO_MS);
  assert.equal(r.linhas.length, 3);
  assert.ok(r.linhas.every((l) => l.action === 'entrou'));
});

test('promote e demote são ignorados', () => {
  assert.equal(classificarEvento(evento({ action: 'promote' }), RECEBIDO_MS), null);
  assert.equal(classificarEvento(evento({ action: 'demote' }), RECEBIDO_MS), null);
});

test('evento de outro tipo é ignorado', () => {
  const r = classificarEvento({ event: 'messages.upsert', data: {} }, RECEBIDO_MS);
  assert.equal(r, null);
});

test('conversa individual é ignorada', () => {
  const r = classificarEvento(evento({ id: '5511888888888@s.whatsapp.net' }), RECEBIDO_MS);
  assert.equal(r, null);
});

test('payload malformado não explode', () => {
  assert.equal(classificarEvento(null, RECEBIDO_MS), null);
  assert.equal(classificarEvento({}, RECEBIDO_MS), null);
  assert.equal(classificarEvento(evento({ participants: [] }), RECEBIDO_MS), null);
});

test('sem date_time usa a hora de recebimento', () => {
  const cru = evento();
  delete cru.date_time;
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(RECEBIDO_MS).toISOString());
});

test('date_time em unix segundos é aceito', () => {
  const cru = evento();
  cru.date_time = 1785000000;
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(1785000000 * 1000).toISOString());
});

test('dia local usa -03:00, não UTC', () => {
  // 02:00 UTC do dia 28 ainda é dia 27 em Brasília.
  assert.equal(diaLocal('2026-07-28T02:00:00.000Z'), '2026-07-27');
  assert.equal(diaLocal('2026-07-28T03:00:00.000Z'), '2026-07-28');
});

test('dia local a partir de unix', () => {
  assert.equal(diaLocalDeUnix(Date.parse('2026-07-28T02:00:00.000Z') / 1000), '2026-07-27');
});

test('o dia do evento acompanha occurredAt', () => {
  const cru = evento();
  cru.date_time = '2026-07-28T02:30:00.000Z';
  assert.equal(classificarEvento(cru, RECEBIDO_MS).dayLocal, '2026-07-27');
});

test('date_time sem fuso ("YYYY-MM-DD HH:MM:SS") cai no horário de recebimento', () => {
  const cru = evento();
  cru.date_time = '2026-07-27 22:00:00';
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(RECEBIDO_MS).toISOString());
});

test('date_time ISO sem "Z" (sem fuso explícito) cai no horário de recebimento', () => {
  const cru = evento();
  cru.date_time = '2026-07-27T22:00:00';
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, new Date(RECEBIDO_MS).toISOString());
});

test('date_time ISO com offset explícito (-03:00) é aceito e convertido para UTC', () => {
  const cru = evento();
  cru.date_time = '2026-07-27T22:00:00-03:00';
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, '2026-07-28T01:00:00.000Z');
});

test('date_time ISO com "z" minúsculo é aceito e convertido, não cai no horário de recebimento', () => {
  const cru = evento();
  cru.date_time = '2026-07-27T22:00:00z';
  const r = classificarEvento(cru, RECEBIDO_MS);
  assert.equal(r.occurredAt, '2026-07-27T22:00:00.000Z');
  assert.notEqual(r.occurredAt, new Date(RECEBIDO_MS).toISOString());
});

// A partir daqui: payload REAL da Evolution, capturado em produção em
// 2026-07-27 (o primeiro evento real recebido, a própria dona da conta saindo
// do grupo). Participantes vêm como objeto `{ id, phoneNumber, admin }`, não
// como string — o formato sintético usado acima nos testes originais.

test('saída voluntária real: author bate com o "id" (@lid) do participante → "saiu", participantJid é o telefone', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '217995729215510@lid',
    participants: [
      { id: '217995729215510@lid', phoneNumber: '5521993911946@s.whatsapp.net', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].action, 'saiu');
  assert.equal(r.linhas[0].participantJid, '5521993911946@s.whatsapp.net');
});

test('remoção por admin real: author diferente de "id" e de "phoneNumber" → "removido"', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5521970692725@s.whatsapp.net',
    participants: [
      { id: '217995729215510@lid', phoneNumber: '5521993911946@s.whatsapp.net', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'removido');
  assert.equal(r.linhas[0].actorJid, '5521970692725@s.whatsapp.net');
});

test('entrada com participante em objeto → "entrou", participantJid é o telefone', () => {
  const r = classificarEvento(evento({
    action: 'add',
    participants: [
      { id: '217995729215510@lid', phoneNumber: '5521993911946@s.whatsapp.net', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'entrou');
  assert.equal(r.linhas[0].participantJid, '5521993911946@s.whatsapp.net');
});

test('participante objeto sem phoneNumber cai para o "id" (@lid)', () => {
  const r = classificarEvento(evento({
    action: 'add',
    participants: [
      { id: '217995729215510@lid', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].participantJid, '217995729215510@lid');
});

test('dois participantes em objetos com telefones distintos viram duas linhas com JIDs distintos (protege dedup)', () => {
  const r = classificarEvento(evento({
    action: 'add',
    participants: [
      { id: '217995729215510@lid', phoneNumber: '5521993911946@s.whatsapp.net', admin: null },
      { id: '111111111111111@lid', phoneNumber: '5511977777777@s.whatsapp.net', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas.length, 2);
  const jids = r.linhas.map((l) => l.participantJid);
  assert.deepEqual(jids, ['5521993911946@s.whatsapp.net', '5511977777777@s.whatsapp.net']);
  assert.notEqual(jids[0], jids[1]);
});

test('author em formato telefone bate com o phoneNumber do participante (id é @lid) → "saiu"', () => {
  const r = classificarEvento(evento({
    action: 'remove',
    author: '5521993911946@s.whatsapp.net',
    participants: [
      { id: '217995729215510@lid', phoneNumber: '5521993911946@s.whatsapp.net', admin: null },
    ],
  }), RECEBIDO_MS);
  assert.equal(r.linhas[0].action, 'saiu');
});

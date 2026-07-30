import test from 'node:test';
import assert from 'node:assert/strict';
import { telefoneDoJid, eventIdDaEntrada, entradaElegivel, sufixoParaCasar } from '../functions/api/_grupo-conversao.js';

const GRUPO_LIVE = '120363427499061913@g.us';
// Grupo elegível a partir de 2026-07-29 12:00:00 -03 (marco de corte).
const grupoLive = { send_conversion: 1, conversion_since: 1785340800 };

function entrada(extra = {}) {
  return {
    action: 'entrou',
    groupJid: GRUPO_LIVE,
    participantJid: '5511987654321@s.whatsapp.net',
    occurredAtUnix: 1785350000, // depois do corte
    ...extra,
  };
}

// --- telefoneDoJid ---

test('extrai o telefone do JID de participante', () => {
  assert.equal(telefoneDoJid('5511987654321@s.whatsapp.net'), '5511987654321');
});

test('JID @lid não tem telefone utilizável', () => {
  // A Evolution às vezes entrega um ID opaco em vez do número.
  assert.equal(telefoneDoJid('182736451923847@lid'), '');
});

test('JID vazio, nulo ou sem arroba não quebra', () => {
  assert.equal(telefoneDoJid(''), '');
  assert.equal(telefoneDoJid(null), '');
  assert.equal(telefoneDoJid('5511987654321'), '');
});

test('número curto demais para ser telefone é descartado', () => {
  assert.equal(telefoneDoJid('123@s.whatsapp.net'), '');
});

// --- eventIdDaEntrada ---

test('o event_id é estável para o mesmo par grupo+telefone', () => {
  // Estabilidade é o que impede um reenvio de virar segunda conversão no Meta.
  const a = eventIdDaEntrada(GRUPO_LIVE, '5511987654321');
  const b = eventIdDaEntrada(GRUPO_LIVE, '5511987654321');
  assert.equal(a, b);
});

test('o event_id muda com o grupo e com o telefone', () => {
  const base = eventIdDaEntrada(GRUPO_LIVE, '5511987654321');
  assert.notEqual(base, eventIdDaEntrada('120363380235066572@g.us', '5511987654321'));
  assert.notEqual(base, eventIdDaEntrada(GRUPO_LIVE, '5511999999999'));
});

// --- sufixoParaCasar ---

test('o mesmo número em formatos diferentes gera o mesmo sufixo', () => {
  // É assim que o telefone do WhatsApp encontra o do lead no banco.
  assert.equal(sufixoParaCasar('5511987654321'), sufixoParaCasar('+55 11 98765-4321'));
});

test('números de DDDs diferentes NÃO colidem', () => {
  // Falso positivo mandaria dados de navegação de outra pessoa ao Meta.
  assert.notEqual(sufixoParaCasar('5511987654321'), sufixoParaCasar('5521987654321'));
});

test('número curto demais não gera sufixo de casamento', () => {
  assert.equal(sufixoParaCasar('987654321'), '');
  assert.equal(sufixoParaCasar(''), '');
  assert.equal(sufixoParaCasar(null), '');
});

// --- entradaElegivel ---

test('entrada em grupo elegível, depois do corte e com telefone é aceita', () => {
  const r = entradaElegivel(entrada(), grupoLive);
  assert.equal(r.elegivel, true);
  assert.equal(r.motivo, 'ok');
  assert.equal(r.phone, '5511987654321');
});

test('saída e remoção nunca viram conversão', () => {
  assert.equal(entradaElegivel(entrada({ action: 'saiu' }), grupoLive).motivo, 'nao_e_entrada');
  assert.equal(entradaElegivel(entrada({ action: 'removido' }), grupoLive).motivo, 'nao_e_entrada');
});

test('grupo não marcado como elegível é ignorado', () => {
  const workshops = { send_conversion: 0, conversion_since: 1785340800 };
  assert.equal(entradaElegivel(entrada(), workshops).motivo, 'grupo_nao_elegivel');
});

test('grupo desconhecido é ignorado', () => {
  assert.equal(entradaElegivel(entrada(), undefined).motivo, 'grupo_nao_elegivel');
});

test('grupo elegível sem marco de corte definido não envia nada', () => {
  const semCorte = { send_conversion: 1, conversion_since: null };
  assert.equal(entradaElegivel(entrada(), semCorte).motivo, 'grupo_nao_elegivel');
});

test('entrada anterior ao marco de corte é ignorada', () => {
  const antiga = entrada({ occurredAtUnix: 1785300000 });
  assert.equal(entradaElegivel(antiga, grupoLive).motivo, 'antes_do_corte');
});

test('entrada exatamente no instante do corte vale', () => {
  const noCorte = entrada({ occurredAtUnix: grupoLive.conversion_since });
  assert.equal(entradaElegivel(noCorte, grupoLive).elegivel, true);
});

test('entrada sem telefone utilizável é ignorada sem quebrar', () => {
  const semTel = entrada({ participantJid: '182736451923847@lid' });
  const r = entradaElegivel(semTel, grupoLive);
  assert.equal(r.elegivel, false);
  assert.equal(r.motivo, 'sem_telefone');
  assert.equal(r.phone, '');
});

test('a ordem das checagens não vaza telefone de grupo não elegível', () => {
  // Grupo inelegível é barrado antes de qualquer coisa ser derivada da pessoa.
  const r = entradaElegivel(entrada(), { send_conversion: 0, conversion_since: 1 });
  assert.equal(r.phone, '');
});

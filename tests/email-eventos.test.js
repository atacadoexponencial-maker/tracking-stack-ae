// Regras puras dos avisos do Postmark (issue 377).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEvento, situacaoDepois, epoch, sqlAtualizarEnvio } from '../functions/api/_email-eventos.js';

const MID = 'b7bc2f4a-e38e-4336-af7d-e6c392c2f817';

test('Delivery vira entregue com data em epoch e chave estável', () => {
  const e = normalizarEvento({ RecordType: 'Delivery', MessageID: MID, MessageStream: 'outbound', DeliveredAt: '2026-10-03T14:02:10Z', Recipient: 'x@y.com' });
  assert.equal(e.tipo, 'entregue');
  assert.equal(e.ocorridoEm, Math.floor(Date.parse('2026-10-03T14:02:10Z') / 1000));
  assert.equal(e.stream, 'outbound');
  assert.equal(e.chave, `entregue|${MID}|${e.ocorridoEm}|`);
  assert.equal(e.detalhe, null);
});

test('Click guarda só o link; aberturas e cliques diferentes têm chaves diferentes', () => {
  const a = normalizarEvento({ RecordType: 'Click', MessageID: MID, ReceivedAt: '2026-10-03T14:05:00Z', OriginalLink: 'https://a.com/', Recipient: 'x@y.com' });
  const b = normalizarEvento({ RecordType: 'Click', MessageID: MID, ReceivedAt: '2026-10-03T14:05:00Z', OriginalLink: 'https://b.com/' });
  assert.equal(a.tipo, 'clicado');
  assert.deepEqual(a.detalhe, { link: 'https://a.com/' });
  assert.notEqual(a.chave, b.chave);
  const o1 = normalizarEvento({ RecordType: 'Open', MessageID: MID, ReceivedAt: '2026-10-03T14:05:00Z' });
  const o2 = normalizarEvento({ RecordType: 'Open', MessageID: MID, ReceivedAt: '2026-10-03T14:09:00Z' });
  assert.equal(o1.tipo, 'aberto');
  assert.notEqual(o1.chave, o2.chave);
});

test('Bounce: definitiva vira voltou, caixa cheia vira voltou_temporario', () => {
  assert.equal(normalizarEvento({ RecordType: 'Bounce', MessageID: MID, Type: 'HardBounce', Inactive: true, BouncedAt: '2026-10-03T14:00:00Z' }).tipo, 'voltou');
  const soft = normalizarEvento({ RecordType: 'Bounce', MessageID: MID, Type: 'SoftBounce', Inactive: false, BouncedAt: '2026-10-03T14:00:00Z' });
  assert.equal(soft.tipo, 'voltou_temporario');
  assert.deepEqual(soft.detalhe, { tipo_devolucao: 'SoftBounce' });
  assert.equal(normalizarEvento({ RecordType: 'Bounce', MessageID: MID, Type: 'Transient', Inactive: true, BouncedAt: '2026-10-03T14:00:00Z' }).tipo, 'voltou');
});

test('SpamComplaint e SubscriptionChange', () => {
  assert.equal(normalizarEvento({ RecordType: 'SpamComplaint', MessageID: MID, BouncedAt: '2026-10-03T14:00:00Z' }).tipo, 'spam');
  const d = normalizarEvento({ RecordType: 'SubscriptionChange', MessageID: MID, ChangedAt: '2026-10-03T14:00:00Z', SuppressSending: true, SuppressionReason: 'ManualSuppression' });
  assert.equal(d.tipo, 'descadastrou');
  assert.deepEqual(d.detalhe, { motivo: 'ManualSuppression' });
  // Reativação e supressão que já veio como Bounce/Spam não viram descadastro.
  assert.equal(normalizarEvento({ RecordType: 'SubscriptionChange', MessageID: MID, SuppressSending: false }), null);
  assert.equal(normalizarEvento({ RecordType: 'SubscriptionChange', MessageID: MID, SuppressSending: true, SuppressionReason: 'HardBounce' }), null);
});

test('corpo inválido ou tipo desconhecido devolve null', () => {
  assert.equal(normalizarEvento(null), null);
  assert.equal(normalizarEvento([]), null);
  assert.equal(normalizarEvento({ RecordType: 'Delivery' }), null);
  assert.equal(normalizarEvento({ RecordType: 'Inbound', MessageID: MID }), null);
});

test('epoch tolera vazio e lixo', () => {
  assert.equal(epoch(''), null);
  assert.equal(epoch('ontem'), null);
  assert.equal(epoch('2026-10-03T14:02:10.1234567-03:00'), Math.floor(Date.parse('2026-10-03T17:02:10.123Z') / 1000));
});

test('situação segue a gravidade, nunca desce', () => {
  assert.equal(situacaoDepois('enviado', 'entregue'), 'entregue');
  assert.equal(situacaoDepois('aberto', 'entregue'), 'aberto'); // fora de ordem
  assert.equal(situacaoDepois('clicado', 'aberto'), 'clicado');
  assert.equal(situacaoDepois('clicado', 'descadastrou'), 'descadastrou');
  assert.equal(situacaoDepois('descadastrou', 'voltou'), 'voltou');
  assert.equal(situacaoDepois('descadastrou', 'spam'), 'spam');
  assert.equal(situacaoDepois('spam', 'clicado'), 'spam');
  assert.equal(situacaoDepois('voltou_temporario', 'entregue'), 'entregue');
  assert.equal(situacaoDepois('entregue', 'voltou_temporario'), 'entregue');
});

test('SQL do envio preenche a data só se vazia e não mexe em data no soft bounce', () => {
  const ab = sqlAtualizarEnvio({ tipo: 'aberto', ocorridoEm: 100 }, 7);
  assert.match(ab.sql, /aberto_em = COALESCE\(aberto_em, \?\)/);
  assert.deepEqual(ab.binds, [100, 4, 'aberto', 7]);
  const soft = sqlAtualizarEnvio({ tipo: 'voltou_temporario', ocorridoEm: 100 }, 7);
  assert.doesNotMatch(soft.sql, /_em = COALESCE/);
});

import { test } from 'node:test';
import assert from 'node:assert';
import { motivoBloqueio } from '../functions/_lead-bloqueio.js';

// O caso que originou a regra: 29 envios do mesmo e-mail no mesmo minuto
// (02/09/2026 14:52), sem sessão, direto no /tracker. O número é um timestamp
// em milissegundos — assinatura de script, não de gente digitando.
test('bloqueia o e-mail do incidente de 02/09', () => {
  const m = motivoBloqueio('leadflow17883715252372738@gmail.com');
  assert.equal(m, 'E-mail contém "leadflow"');
});

test('bloqueia leadflow em qualquer posição do e-mail', () => {
  for (const email of [
    'leadflow@gmail.com',
    'leadflow123@gmail.com',
    'joao.leadflow@gmail.com',
    'contato@leadflow.com',
    'x@mail.leadflow.io',
  ]) {
    assert.ok(motivoBloqueio(email), `deveria bloquear: ${email}`);
  }
});

test('ignora maiúsculas e espaços em volta', () => {
  assert.ok(motivoBloqueio('  LeadFlow17883715252372738@Gmail.com  '));
  assert.ok(motivoBloqueio('LEADFLOW@GMAIL.COM'));
});

// A regra é substring, então precisa não pegar os leads reais que estavam na
// MESMA lista do incidente. Se um destes começar a casar, a regra ficou larga.
test('não bloqueia os leads reais da lista do incidente', () => {
  for (const email of [
    'joseildaamaraji1010@gmail.com',
    'Neylakarol.24@gmail.com',
    'julianaschmith07@icloud.com',
    'giertsrclei@hotmail.com',
    'joao837@gmail.com',
    'ana444@gmail.com',
    'pedro212@gmail.com',
  ]) {
    assert.equal(motivoBloqueio(email), '', `não deveria bloquear: ${email}`);
  }
});

// Evento sem e-mail (PageView, InitiateCheckout) não pode virar bloqueio: o
// /tracker chama isto para TODO evento, não só para Lead.
test('e-mail ausente nunca bloqueia', () => {
  assert.equal(motivoBloqueio(''), '');
  assert.equal(motivoBloqueio(null), '');
  assert.equal(motivoBloqueio(undefined), '');
});

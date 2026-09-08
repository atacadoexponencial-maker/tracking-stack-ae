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
//
// joao837@/ana444@/pedro212@ SAÍRAM desta lista em 08/09: entraram aqui como
// "reais" em 03/09 e não eram — são do bot de IP tratado mais abaixo. Quem os
// barra é o bloco /64, não o e-mail; por e-mail eles continuam passando, que é
// o que o caso de IPv4 abaixo verifica.
test('não bloqueia os leads reais da lista do incidente', () => {
  for (const email of [
    'joseildaamaraji1010@gmail.com',
    'Neylakarol.24@gmail.com',
    'julianaschmith07@icloud.com',
    'giertsrclei@hotmail.com',
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

// --- Bloqueio por IP -------------------------------------------------------
// O segundo bot: 61 leads falsos entre 15/08 e 08/09/2026, todos na
// lives-semanais-v1, todos saindo do bloco 2605:a143:2218:7058::/64. O e-mail
// (ana/joao/carla/maria/pedro + 3 dígitos @gmail.com) é indistinguível de um
// e-mail de gente de verdade — treze leads legítimos do histórico têm essa
// mesma forma —, então quem julga aqui é a origem, não o texto.
const MOTIVO_IP = 'IP no bloco 2605:a143:2218:7058::/64 (bot de lead falso)';

test('bloqueia o IP exato de onde saíram os 61 leads falsos', () => {
  assert.equal(motivoBloqueio('ana444@gmail.com', '2605:a143:2218:7058::200'), MOTIVO_IP);
});

// O /64 inteiro, não o endereço: trocar o sufixo é de graça para quem tem o
// bloco. Se algum destes deixar de casar, a regra virou lista de endereços.
test('bloqueia qualquer endereço dentro do mesmo /64', () => {
  for (const ip of [
    '2605:a143:2218:7058::1',
    '2605:a143:2218:7058::ffff',
    '2605:a143:2218:7058:1234:5678:9abc:def0',
    '2605:A143:2218:7058::200',
    '2605:a143:2218:7058:0:0:0:200',
  ]) {
    assert.equal(motivoBloqueio('x@gmail.com', ip), MOTIVO_IP, `deveria bloquear: ${ip}`);
  }
});

// O vizinho de bloco é outra pessoa: um dígito de diferença no prefixo já é
// outro assinante, e bloquear por engano custa um lead real.
test('não bloqueia blocos vizinhos', () => {
  for (const ip of [
    '2605:a143:2218:7059::200',
    '2605:a143:2218:705::200',
    '2605:a143:2219:7058::200',
    '2604:a143:2218:7058::200',
  ]) {
    assert.equal(motivoBloqueio('x@gmail.com', ip), '', `não deveria bloquear: ${ip}`);
  }
});

// Os IPs de onde vieram os leads REAIS da mesma LP na semana do incidente.
// Este é o teste que segura a mão: se um destes cair, o bloqueio passou a
// comer inscrito de verdade.
test('não bloqueia os IPs dos leads reais da mesma LP', () => {
  for (const ip of [
    '2804:1dc:8207:ec00:8449:a5c0:5519:53c6',
    '2804:18:789d:384e:797f:3667:c362:b63e',
    '2804:1530:681:f434:bc68:7677:d5e7:c9bd',
    '2804:214:996a:20cd:18d2:19b2:3b24:5d0a',
    '2804:8ed4:100:3100:94be:cbe1:3cdd:b1fe',
    '189.113.240.107',
    '45.229.120.253',
    '179.179.10.34',
  ]) {
    assert.equal(motivoBloqueio('gente@gmail.com', ip), '', `não deveria bloquear: ${ip}`);
  }
});

// IP ausente ou incomparável não pode virar bloqueio. O '::1' e o '::' têm o
// prefixo comprimido: não dá para saber quantos hextets o '::' engoliu, e
// bloqueio que chuta erra contra o lead real.
test('IP ausente ou indecidível nunca bloqueia', () => {
  for (const ip of ['', null, undefined, '::1', '::', 'não-é-ip', '2605:a143']) {
    assert.equal(motivoBloqueio('gente@gmail.com', ip), '', `não deveria bloquear: ${ip}`);
  }
});

// A assinatura antiga (só e-mail) continua valendo: o /tracker é o único
// chamador hoje, mas a regra de e-mail não pode depender de receber o IP.
test('chamada só com e-mail continua funcionando', () => {
  assert.ok(motivoBloqueio('leadflow123@gmail.com'));
  assert.equal(motivoBloqueio('ana444@gmail.com'), '');
});

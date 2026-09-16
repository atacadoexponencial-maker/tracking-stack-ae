import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classificarRespostaMeta, proximaTentativaEm, dentroDaJanela, avaliarCondicoes, estadoGeral,
  motivoEsgotou, MOTIVOS, ESPERA_BASE_SEGUNDOS, JANELA_SEGUNDOS,
} from '../functions/api/_meta-envio.js';

const erro = (e) => JSON.stringify({ error: e });

// --- classificarRespostaMeta ---

test('200 é aceita', () => {
  const r = classificarRespostaMeta({ ok: true, status: 200, corpo: '{"events_received":1}' });
  assert.equal(r.situacao, 'aceita');
});

test('token inválido (code 190) é credencial e não consome tentativa', () => {
  const r = classificarRespostaMeta({ status: 400, corpo: erro({ code: 190, type: 'OAuthException', message: 'Cannot parse access token' }) });
  assert.deepEqual([r.situacao, r.categoria, r.consomeTentativa], ['pendente', 'credencial', false]);
  assert.equal(r.motivo, MOTIVOS.credencial);
});

test('permissão (code 200) e HTTP 403 são credencial', () => {
  assert.equal(classificarRespostaMeta({ status: 400, corpo: erro({ code: 200 }) }).categoria, 'credencial');
  assert.equal(classificarRespostaMeta({ status: 403, corpo: '' }).categoria, 'credencial');
});

test('parâmetro inválido com type OAuthException (code 100) é evento, não credencial', () => {
  // O Meta manda OAuthException também aqui; confundir prenderia o evento na fila para sempre.
  const r = classificarRespostaMeta({ status: 400, corpo: erro({ code: 100, type: 'OAuthException', message: 'Invalid parameter', error_user_msg: 'O fbc está malformado' }) });
  assert.deepEqual([r.situacao, r.categoria], ['falhou', 'evento']);
  assert.match(r.motivo, /O Meta recusou o conteúdo do evento: O fbc está malformado/);
});

test('credencial ausente fica pendente sem consumir tentativa', () => {
  const r = classificarRespostaMeta({ semCredencial: true });
  assert.deepEqual([r.situacao, r.categoria, r.consomeTentativa, r.motivo], ['pendente', 'credencial', false, MOTIVOS.semCredencial]);
});

test('rede, 5xx, 429, is_transient e limite de chamadas são passageiros', () => {
  for (const c of [
    { erroRede: true },
    { status: 0 },
    { status: 503, corpo: 'x' },
    { status: 429, corpo: '' },
    { status: 400, corpo: erro({ code: 100, is_transient: true }) },
    { status: 400, corpo: erro({ code: 17 }) },
    { status: 400, corpo: erro({ code: 2 }) },
  ]) {
    const r = classificarRespostaMeta(c);
    assert.deepEqual([r.situacao, r.categoria, r.consomeTentativa], ['pendente', 'passageira', true], JSON.stringify(c));
  }
});

test('corpo que não é JSON numa recusa 400 vira evento com o texto', () => {
  const r = classificarRespostaMeta({ status: 400, corpo: 'Bad Request' });
  assert.equal(r.categoria, 'evento');
  assert.match(r.motivo, /Bad Request/);
});

test('motivo de esgotou resume a última resposta', () => {
  assert.match(motivoEsgotou('x'.repeat(500)), /^Esgotou as tentativas\. Última resposta: x+…\.$/);
});

// --- espera e janela ---

test('espera cresce: 15 min, 30 min, 1 h, 2 h', () => {
  const agora = 1_000_000;
  assert.deepEqual([1, 2, 3, 4].map((t) => proximaTentativaEm(agora, t) - agora),
    [1, 2, 4, 8].map((k) => k * ESPERA_BASE_SEGUNDOS));
});

test('janela de 6 dias', () => {
  const agora = 10_000_000;
  assert.equal(dentroDaJanela(agora - JANELA_SEGUNDOS, agora), true);
  assert.equal(dentroDaJanela(agora - JANELA_SEGUNDOS - 1, agora), false);
});

// --- condições de alerta ---

const base = { ultimaCredencialEm: null, ultimaAceitaEm: 100, ultimaLeadAceitaEm: 100, total6h: 0, aceitas6h: 0, expiram24h: 0, total24h: 0, aceitas24h: 0, falhas24h: 0 };

test('tudo normal: nenhuma condição', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, total6h: 20, aceitas6h: 20 }, 1000), []);
});

test('credencial recusada depois da última aceita dispara; aceita depois limpa', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, ultimaCredencialEm: 200, ultimaAceitaEm: 100 }, 1000), ['credencial']);
  assert.deepEqual(avaliarCondicoes({ ...base, ultimaCredencialEm: 200, ultimaAceitaEm: 300 }, 1000), []);
});

test('com credencial recusada, aceitação baixa e "sem aceitas" não duplicam o aviso', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, ultimaCredencialEm: 200, ultimaAceitaEm: 100, total6h: 12, aceitas6h: 0 }, 1000), ['credencial']);
});

test('aceitação baixa só com volume mínimo', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, total6h: 9, aceitas6h: 1 }, 1000), []);
  assert.ok(avaliarCondicoes({ ...base, total6h: 10, aceitas6h: 7 }, 1000).includes('aceitacao_baixa'));
});

test('madrugada sem conversão nenhuma não é "sem aceitas"', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, total6h: 0, aceitas6h: 0 }, 1000), []);
  assert.ok(avaliarCondicoes({ ...base, total6h: 3, aceitas6h: 0 }, 1000).includes('sem_aceitas'));
});

test('nenhum Lead aceito há mais de 24 h', () => {
  const agora = 100 + 24 * 3600 + 1;
  assert.ok(avaliarCondicoes({ ...base, ultimaLeadAceitaEm: 100 }, agora).includes('sem_lead_aceita'));
});

test('pendentes prestes a expirar', () => {
  assert.deepEqual(avaliarCondicoes({ ...base, expiram24h: 2 }, 1000), ['pendentes_expirando']);
});

// --- estado geral ---

test('estado: incidente por credencial, atenção por falha, saudável', () => {
  const fmt = () => '14/09 10:32';
  assert.equal(estadoGeral({ ...base, ultimaCredencialEm: 200 }, ['credencial'], 1000, fmt).frase, 'Credencial do Meta recusada desde 14/09 10:32');
  const at = estadoGeral({ ...base, falhas24h: 1 }, [], 1000);
  assert.equal(at.estado, 'atencao');
  assert.match(at.frase, /1 falha definitiva/);
  assert.equal(estadoGeral({ ...base, total24h: 20, aceitas24h: 20 }, [], 1000).estado, 'saudavel');
});

test('estado: atenção por aceitação baixa em 24 h', () => {
  const r = estadoGeral({ ...base, total24h: 10, aceitas24h: 5 }, [], 1000);
  assert.equal(r.estado, 'atencao');
  assert.match(r.frase, /aceitação de 50%/);
});

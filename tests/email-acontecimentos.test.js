// Acontecimentos dos fluxos (issue 386): cada fonte lida por cursor vira um
// acontecimento ligado ao e-mail certo.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { bancoDosFluxos, d1 } from './_fluxos-banco.js';
import { coletar, coletarSegmentos, contarUltimos30, casaFiltros } from '../functions/api/_email-acontecimentos.js';
import { registrarLead } from '../functions/api/_email-contatos.js';

let db, env;
const AGORA = Math.floor(Date.now() / 1000);

beforeEach(() => {
  db = bancoDosFluxos();
  env = { DB: d1(db) };
});

const acont = (tipo) => db.prepare('SELECT tipo, email, dados_json, quando FROM email_acontecimentos WHERE tipo = ? ORDER BY id').all(tipo)
  .map((a) => ({ ...a, dados: JSON.parse(a.dados_json) }));

function lead({ email, funil = 'workshop', ts = AGORA - 100, material = null, sessao = 's1', evento = 'Lead', bot = 0 }) {
  db.prepare('INSERT OR IGNORE INTO sessions (session_id, utm_source, utm_campaign, utm_content, landing_url) VALUES (?, ?, ?, ?, ?)')
    .run(sessao, 'facebookads', 'wo-perene', 'video', 'https://atacadoexponencial.com/workshop-gratuito/?utm_source=x');
  return db.prepare('INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel, material, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sessao, evento, `ev${Math.random()}`, ts, email, funil, material, bot).lastInsertRowid;
}

test('lead vira formulário (e material e aplicação), com página, canal e UTMs; robô e bloqueado ficam fora', async () => {
  lead({ email: 'Ana@X.com' });
  lead({ email: 'mat@x.com', funil: 'iscas-manychat', material: 'icp', sessao: 's2' });
  lead({ email: 'apl@x.com', funil: 'aplicacao-mentoria', sessao: 's3' });
  lead({ email: 'bot@x.com', bot: 1, sessao: 's4' });
  const bloq = db.prepare("INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email) VALUES ('s5', 'Lead', 'bloq1', 1, 'b@x.com')").run();
  db.prepare("INSERT INTO leads_bloqueados (event_id) VALUES ('bloq1')").run();
  assert.ok(bloq);
  await coletar(env);
  const f = acont('formulario');
  assert.deepEqual(f.map((a) => a.email), ['ana@x.com', 'mat@x.com', 'apl@x.com']);
  assert.deepEqual(f[0].dados, { funil: 'workshop', pagina: '/workshop-gratuito', canal: 'meta-ads', utm_source: 'facebookads', utm_campaign: 'wo-perene', utm_content: 'video' });
  assert.deepEqual(acont('material').map((a) => [a.email, a.dados.material]), [['mat@x.com', 'icp']]);
  assert.deepEqual(acont('aplicacao').map((a) => [a.email, a.dados.formulario]), [['apl@x.com', 'aplicacao-mentoria']]);
});

test('evento do site pega o e-mail pelo lead da mesma sessão', async () => {
  lead({ email: 'ana@x.com', sessao: 's1' });
  lead({ email: '', sessao: 's1', evento: 'CTAClick' });
  lead({ email: '', sessao: 'sem-lead', evento: 'FormStep' });
  await coletar(env);
  assert.deepEqual(acont('site').map((a) => [a.email, a.dados.evento, a.dados.pagina]), [['ana@x.com', 'ctaclick', '/workshop-gratuito'], [null, 'formstep', '/workshop-gratuito']]);
});

test('Greenn, agenda, grupos (telefone → lead) e CRM (card → lead)', async () => {
  db.prepare(`INSERT INTO greenn_webhook_event (event, current_status, product_id, received_at, raw_json) VALUES
    ('saleUpdated', 'paid', 186687, 10, '{"client":{"email":"Comprou@x.com"}}'),
    ('saleUpdated', 'refunded', 186687, 11, '{"client":{"email":"comprou@x.com"}}'),
    ('saleUpdated', 'waiting_payment', 186687, 12, '{"client":{"email":"comprou@x.com"}}')`).run();
  db.prepare("INSERT INTO agenda_grades (id, nome, faixas_json, criado_em, atualizado_em) VALUES (1, 'G', '{}', 0, 0)").run();
  db.prepare("INSERT INTO agenda_tipos (id, slug, nome, duracao_min, destino_cal, grade_id, criado_em, atualizado_em) VALUES (7, 's', 'Sessão', 45, 'c', 1, 0, 0)").run();
  db.prepare("INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, token_gestao, criado_em, atualizado_em) VALUES ('r1', 7, 1, 2, 'Ana', 'ana@x.com', 't', 0, 0)").run();
  db.prepare(`INSERT INTO agenda_historico (reuniao_id, acao, detalhe, por, criado_em) VALUES
    ('r1', 'agendou', 'x', 'lead', 20), ('r1', 'presenca', 'pelo Meet: realizada', 'sistema', 21), ('r1', 'presenca', 'marcada à mão: faltou', 'equipe', 22), ('r1', 'remarcou', 'x', 'lead', 23)`).run();
  db.prepare("INSERT INTO lead_dispatch (email, phone, task_id) VALUES ('fone@x.com', '+5562981968444', 'task-1')").run();
  db.prepare(`INSERT INTO whatsapp_group_events (group_jid, participant_jid, action, occurred_at, day_local, received_at) VALUES
    ('g1@g.us', '556281968444@s.whatsapp.net', 'entrou', 'x', 'x', 30), ('g1@g.us', '5511999990000@s.whatsapp.net', 'saiu', 'x', 'x', 31)`).run();
  db.prepare("INSERT INTO crm_status_log (task_id, status, recebido_em, hist_date) VALUES ('task-1', 'reunião', 40, 39), ('sem-ponte', 'qualificação', 41, NULL)").run();
  const r = await coletar(env);
  assert.equal(typeof r.greenn, 'number');
  assert.deepEqual(acont('compra').map((a) => [a.email, a.dados.produto, a.dados.compra]), [['comprou@x.com', '186687', 'aprovada'], ['comprou@x.com', '186687', 'reembolsada']]);
  assert.deepEqual(['agendou', 'compareceu', 'faltou'].map((t) => acont(t).map((a) => [a.email, a.dados.tipo])[0]), [['ana@x.com', '7'], ['ana@x.com', '7'], ['ana@x.com', '7']]);
  assert.deepEqual(acont('grupo_entrou').map((a) => [a.email, a.dados.grupo]), [['fone@x.com', 'g1@g.us']]);
  assert.deepEqual(acont('grupo_saiu').map((a) => a.email), [null]);
  assert.deepEqual(acont('crm').map((a) => [a.email, a.dados.estagio, a.quando]), [['fone@x.com', 'reunião', 39], [null, 'qualificação', 41]]);
});

test('campanha: abriu e clicou com o link', async () => {
  const e = db.prepare("INSERT INTO email_envios (canal, origem, ref_id, destinatario, situacao) VALUES ('marketing', 'campanha', '5', 'ana@x.com', 'clicado')").run().lastInsertRowid;
  db.prepare(`INSERT INTO email_eventos (chave, envio_id, tipo, ocorrido_em, recebido_em, detalhe_json) VALUES
    ('a', ?, 'aberto', 50, 50, NULL), ('b', ?, 'clicado', 51, 51, '{"link":"https://x.com/a"}'), ('c', ?, 'entregue', 49, 49, NULL)`).run(e, e, e);
  await coletar(env);
  assert.deepEqual(acont('campanha').map((a) => [a.dados.acao, a.dados.campanha, a.dados.link]), [['abriu', '5', ''], ['clicou', '5', 'https://x.com/a']]);
});

test('cursor: a segunda rodada não repete; fonte com erro não trava as outras', async () => {
  lead({ email: 'ana@x.com' });
  await coletar(env);
  await coletar(env);
  assert.equal(acont('formulario').length, 1);
  db.exec('DROP TABLE crm_status_log');
  lead({ email: 'bia@x.com', sessao: 's9' });
  const r = await coletar(env);
  assert.match(String(r.crm), /^erro/);
  assert.equal(acont('formulario').length, 2);
});

test('segmento: a primeira leitura só marca; quem entra depois vira acontecimento', async () => {
  await registrarLead(env, { email: 'ana@x.com', funil: 'workshop', eventId: 'a', quando: 1 });
  const s = db.prepare("INSERT INTO email_segmentos (nome, regras_json, criado_em, atualizado_em) VALUES ('W', '[{\"campo\":\"funil\",\"op\":\"e\",\"valor\":\"workshop\"}]', 0, 0)").run().lastInsertRowid;
  assert.equal(await coletarSegmentos(env, [s], AGORA), 0);
  await registrarLead(env, { email: 'bia@x.com', funil: 'workshop', eventId: 'b', quando: 2 });
  assert.equal(await coletarSegmentos(env, [s], AGORA + 60), 0, 'antes dos 15 minutos não lê de novo');
  assert.equal(await coletarSegmentos(env, [s], AGORA + 16 * 60), 1);
  assert.deepEqual(acont('segmento').map((a) => [a.email, a.dados.segmento]), [['bia@x.com', String(s)]]);
});

test('filtros e contagem dos últimos 30 dias (só contatos ativos)', async () => {
  assert.ok(casaFiltros({ funil: 'workshop', canal: 'bio' }, [{ campo: 'funil', valor: 'workshop' }, { campo: 'canal', valor: '' }]));
  assert.ok(!casaFiltros({ funil: 'sessao' }, [{ campo: 'funil', valor: 'workshop' }]));
  for (const [email, ts] of [['ana@x.com', AGORA - 100], ['bia@x.com', AGORA - 40 * 86400], ['caio@x.com', AGORA - 100]]) {
    lead({ email, ts, sessao: email });
    await registrarLead(env, { email, eventId: email, quando: 1 });
  }
  lead({ email: 'ana@x.com', ts: AGORA - 50, sessao: 'ana2' });
  db.prepare("UPDATE email_contatos SET situacao = 'descadastrado' WHERE email = 'caio@x.com'").run();
  await coletar(env);
  assert.equal(await contarUltimos30(env, { evento: 'formulario', filtros: [{ campo: 'funil', valor: 'workshop' }] }, AGORA), 1);
  assert.equal(await contarUltimos30(env, { evento: 'formulario', filtros: [{ campo: 'funil', valor: 'sessao' }] }, AGORA), 0);
});

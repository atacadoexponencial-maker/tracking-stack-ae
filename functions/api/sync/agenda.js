// POST /api/sync/agenda — rodada periódica da agenda própria (spec-agenda-propria.md).
//
// Chamado por cron na VPS a cada 15 minutos (o Pages não tem Cron Triggers;
// mesmo padrão dos outros syncs). Auth: header `x-sync-secret: <SYNC_SECRET>`.
//
// Três trabalhos, cada um com teto por rodada para caber no tempo da função:
//   1. Saúde: relê as agendas de cada conta conectada (módulo 1).
//   2. Google → dash: evento apagado ou movido à mão na agenda aparece com a
//      situação atualizada (módulo 8).
//   3. Presença: depois que a reunião termina, lê a sala do Meet e marca
//      realizada / faltou / sem informação (módulo 8). O Google às vezes
//      demora para fechar o registro da sala, então "sem registro" só vira
//      sem_info depois de 24 h; antes disso, tenta de novo na próxima rodada.
import { listarAgendas, lerEvento, participantesDoMeet, codigoDoMeet } from '../_google-agenda.js';
import { situacaoPelaPresenca } from '../_agenda-regras.js';
import {
  contasDasAgendas, lerTipo, historico, registrarNoCrm, textoCrm, agora, enviarRealizada,
} from '../_agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const TETO_GOOGLE = 40;
const TETO_PRESENCA = 15;
// Presença: espera 30 min depois do fim; desiste do registro depois de 24 h;
// a retenção do Meet é de ~30 dias.
const ESPERA_PRESENCA = 30 * 60;
const DESISTE_PRESENCA = 24 * 3600;

export async function onRequestPost({ request, env, waitUntil }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  const t = agora();
  const resumo = { saude: {}, google: { conferidas: 0, canceladas: 0, movidas: 0 }, presenca: {}, erros: [] };

  // 1. Saúde das agendas
  const contas = (await env.DB.prepare('SELECT email FROM agenda_contas').all()).results || [];
  for (const { email } of contas) {
    try {
      const lista = await listarAgendas(env, email);
      const vistas = new Set(lista.map((a) => a.id));
      const minhas = (await env.DB.prepare('SELECT id FROM agenda_calendarios WHERE conta_email = ?').bind(email).all()).results || [];
      for (const a of lista) {
        await env.DB.prepare('UPDATE agenda_calendarios SET nome = ?, ultima_leitura_ok = ?, ultimo_erro = NULL WHERE id = ?').bind(a.nome, t, a.id).run();
      }
      for (const m of minhas) {
        if (!vistas.has(m.id)) {
          await env.DB.prepare('UPDATE agenda_calendarios SET ultimo_erro = ?, ultimo_erro_em = ? WHERE id = ?')
            .bind('A conta não enxerga mais esta agenda.', t, m.id).run();
        }
      }
      resumo.saude[email] = 'ok';
    } catch (e) {
      await env.DB.prepare('UPDATE agenda_calendarios SET ultimo_erro = ?, ultimo_erro_em = ? WHERE conta_email = ?')
        .bind(String(e.message).slice(0, 300), t, email).run();
      resumo.saude[email] = 'erro';
      resumo.erros.push(`${email}: ${e.message}`);
    }
  }

  const donos = await contasDasAgendas(env);
  const tipos = new Map();
  const tipoDe = async (id) => {
    if (!tipos.has(id)) tipos.set(id, await lerTipo(env, { id }));
    return tipos.get(id);
  };

  // 2. Google → dash (reuniões futuras ou que acabaram de acontecer),
  //    as conferidas há mais tempo primeiro.
  const ativas = (await env.DB.prepare(
    `SELECT * FROM agenda_reunioes WHERE situacao IN ('marcada','remarcada') AND fim > ?
      ORDER BY atualizado_em LIMIT ?`,
  ).bind(t - 3600, TETO_GOOGLE).all()).results || [];
  for (const r of ativas) {
    const conta = donos.get(r.google_cal_id);
    if (!conta || !r.google_event_id) continue;
    try {
      const ev = await lerEvento(env, conta, r.google_cal_id, r.google_event_id);
      resumo.google.conferidas++;
      if (ev.situacao !== 'ativo') {
        await env.DB.prepare("UPDATE agenda_reunioes SET situacao = 'cancelada', motivo_cancel = ?, atualizado_em = ? WHERE id = ?")
          .bind('Apagada direto na agenda do Google.', t, r.id).run();
        await historico(env, r.id, 'cancelou', 'evento apagado direto na agenda do Google', 'google');
        const tipo = await tipoDe(r.tipo_id);
        if (tipo) await registrarNoCrm(env, r, textoCrm('cancelou', tipo, r, 'Apagada direto na agenda do Google.'));
        resumo.google.canceladas++;
      } else if (ev.ini !== r.inicio || ev.fim !== r.fim) {
        await env.DB.prepare("UPDATE agenda_reunioes SET inicio = ?, fim = ?, situacao = 'remarcada', atualizado_em = ? WHERE id = ?")
          .bind(ev.ini, ev.fim, t, r.id).run();
        await historico(env, r.id, 'remarcou', 'movida direto na agenda do Google', 'google');
        resumo.google.movidas++;
      } else {
        await env.DB.prepare('UPDATE agenda_reunioes SET atualizado_em = ? WHERE id = ?').bind(t, r.id).run();
      }
    } catch (e) {
      resumo.erros.push(`evento ${r.id}: ${e.message}`);
    }
  }

  // 3. Presença pelo Meet
  const terminadas = (await env.DB.prepare(
    `SELECT * FROM agenda_reunioes WHERE situacao IN ('marcada','remarcada') AND fim < ? AND fim > ?
      ORDER BY fim LIMIT ?`,
  ).bind(t - ESPERA_PRESENCA, t - 25 * 86400, TETO_PRESENCA).all()).results || [];
  for (const r of terminadas) {
    const conta = donos.get(r.google_cal_id);
    const codigo = codigoDoMeet(r.meet_link);
    if (!conta || !codigo) continue;
    try {
      const pessoas = await participantesDoMeet(env, conta, codigo);
      let situacao = situacaoPelaPresenca(pessoas);
      if (situacao === 'sem_info' && t - r.fim < DESISTE_PRESENCA) continue;
      await env.DB.prepare("UPDATE agenda_reunioes SET situacao = ?, presenca_origem = 'meet', atualizado_em = ? WHERE id = ?")
        .bind(situacao, t, r.id).run();
      await historico(env, r.id, 'presenca', `pelo Meet: ${situacao}`, 'sistema');
      const tipo = await tipoDe(r.tipo_id);
      if (tipo && situacao !== 'sem_info') await registrarNoCrm(env, r, textoCrm(situacao, tipo, r));
      if (situacao === 'realizada') await enviarRealizada(env, r, waitUntil || (() => {}));
      resumo.presenca[situacao] = (resumo.presenca[situacao] || 0) + 1;
    } catch (e) {
      resumo.erros.push(`presença ${r.id}: ${e.message}`);
    }
  }

  // Convites vencidos há mais de 30 dias não servem para nada.
  await env.DB.prepare('DELETE FROM agenda_convites WHERE expira_em < ? AND token NOT IN (SELECT convite_token FROM agenda_reunioes WHERE convite_token IS NOT NULL)')
    .bind(t - 30 * 86400).run();

  return json({ ok: true, ...resumo });
}

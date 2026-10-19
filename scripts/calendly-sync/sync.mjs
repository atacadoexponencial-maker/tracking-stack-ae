// Coleta diária das consultorias do Calendly → POST /api/sync/calendly
// (spec-reunioes-calendly.md, issue S2-01). Roda por cron na VPS; ver README.md.
//
// Janela: reuniões de 45 dias atrás até 120 dias à frente (SUP-S2-06), o que
// pega os agendamentos novos e os cancelamentos recentes. `DESDE=AAAA-MM-DD`
// troca o começo da janela (carga inicial: DESDE=2026-09-01).
//
// Erro do Calendly: não posta nada (a cópia guardada fica como estava),
// escreve a falha no log e sai com 1. Sempre escreve uma linha no log, para a
// fonte parada não passar em silêncio.
import { coletarConsultorias } from './coletar.mjs';

const DIA_MS = 86400000;
const carimbo = () => new Date().toISOString();

export async function rodarSync({ env, fetch = globalThis.fetch, agora = Date.now(), log = console.log }) {
  const desde = env.DESDE ? new Date(`${env.DESDE}T00:00:00-03:00`) : new Date(agora - 45 * DIA_MS);
  const ate = new Date(agora + 120 * DIA_MS);
  let eventos;
  try {
    eventos = await coletarConsultorias({ token: env.CALENDLY_TOKEN, desde: desde.toISOString(), ate: ate.toISOString(), fetch });
  } catch (e) {
    log(`${carimbo()} ERRO coleta: ${e.message} (nada enviado)`);
    return 1;
  }
  try {
    const r = await fetch(env.SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'x-sync-secret': env.SYNC_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventos }),
    });
    const texto = (await r.text()).slice(0, 300);
    log(`${carimbo()} ${r.ok ? 'ok' : 'ERRO envio'} ${r.status} ${eventos.length} consultorias lidas: ${texto}`);
    return r.ok ? 0 : 1;
  } catch (e) {
    log(`${carimbo()} ERRO envio: ${e.message}`);
    return 1;
  }
}

// Execução direta (cron): `node sync.mjs`, com o .env já carregado no ambiente.
if (import.meta.url === `file://${process.argv[1]}`) {
  const faltando = ['CALENDLY_TOKEN', 'SYNC_SECRET', 'SYNC_ENDPOINT'].filter((k) => !process.env[k]);
  if (faltando.length) {
    console.log(`${carimbo()} ERRO: faltam ${faltando.join(', ')} no .env`);
    process.exit(1);
  }
  process.exit(await rodarSync({ env: process.env }));
}

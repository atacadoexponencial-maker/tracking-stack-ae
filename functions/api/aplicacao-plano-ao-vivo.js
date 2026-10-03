// Aplicação para o plano de ação ao vivo (spec-aplicacao-plano-ao-vivo.md,
// issues 371 e 372).
//
// GET  → { aberta }: a página pergunta aqui se ainda aceita aplicações.
// POST → confere as respostas pelas mesmas listas da página e acrescenta uma
//        linha na planilha. Só responde ok depois que a linha foi gravada.
//
// Não vira lead: nada vai para /tracker, CRM, GHL, Meta, GA4 ou dash. O único
// destino além da planilha é o ManyChat (pedido dela em 03/10): tag
// aplicou-wo07-10 + fluxo "Aplicação Plano de Ação ao Vivo", em segundo plano,
// depois de a linha estar gravada. Falha no ManyChat não derruba a aplicação.
// Robô (pelas mesmas listas do /tracker) recebe ok e não vira linha.

import { detectBot, detectBotPorIp } from '../_bots.js';
import { padronizarTelefone } from '../_telefone.js';
import { acrescentarLinha } from './_google-planilha.js';
import { enviarLeadAoManyChat } from './_lead-manychat.js';
import { aplicacoesAbertas, validarAplicacao, PERGUNTAS, CABECALHO } from '../../src/data/aplicacao-plano-ao-vivo.js';

const PLANILHA = '1tWAeZMaAp_hSE-6vymyN8Cx3kAqVo-zKEZfGySHuOHU';
const ABA = 'Página1';
// Dona da planilha no Workspace (testado em 03/10: a conta de serviço entra
// como ela e tem edição).
const CONTA = 'marcelle@seteads.com';
const MAX_CORPO = 20000;

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function dataHoraBrasilia(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export async function processarAplicacao({ request, env, waitUntil, agoraMs = Date.now(), gravar = acrescentarLinha, manychat = enviarLeadAoManyChat }) {
  if (!aplicacoesAbertas(agoraMs)) return json({ ok: false, encerrada: true }, 410);

  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (detectBot(ua).isBot || detectBotPorIp(ip).isBot) return json({ ok: true });

  const texto = await request.text();
  if (texto.length > MAX_CORPO) return json({ ok: false, erro: 'grande_demais' }, 413);
  let corpo;
  try { corpo = JSON.parse(texto); } catch { return json({ ok: false, erro: 'json' }, 400); }

  const v = validarAplicacao(corpo?.respostas);
  if (!v.ok) return json({ ok: false, campo: v.campo }, 400);

  const tel = padronizarTelefone(v.valores.telefone);
  if (tel.situacao === 'impossivel' || tel.situacao === 'ausente') return json({ ok: false, campo: 'telefone' }, 400);

  const origem = String(corpo?.origem || '').slice(0, 500);
  const linha = [
    dataHoraBrasilia(agoraMs),
    ...PERGUNTAS.map((p) => (p.name === 'telefone' ? tel.digitos : v.valores[p.name])),
    origem,
  ];

  try {
    await gravar(env, { subject: CONTA, planilha: PLANILHA, aba: ABA, cabecalho: CABECALHO, linha });
  } catch (e) {
    console.error('[aplicacao-plano-ao-vivo] falha ao gravar na planilha:', e?.codigo || '', e?.status || '', e?.message || e);
    return json({ ok: false, erro: 'planilha' }, 502);
  }

  const envio = manychat({ leadData: { funnel: 'aplicacao-plano-ao-vivo', nome: v.valores.nome, telefone: tel.digitos }, env })
    .then((desfecho) => console.log('[aplicacao-plano-ao-vivo] manychat:', desfecho))
    .catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(envio); else await envio;

  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ aberta: aplicacoesAbertas() });
}

export async function onRequestPost(context) {
  return processarAplicacao(context);
}

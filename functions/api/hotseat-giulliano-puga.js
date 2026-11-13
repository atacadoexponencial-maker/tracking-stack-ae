// Hotseat especial com Giulliano Puga (16/11/2026): confirmação de presença.
//
// POST → confere as respostas pelas mesmas listas da página e acrescenta uma
//        linha na planilha. Só responde ok depois que a linha foi gravada.
//
// Marketing interno: não vira lead. Nada vai para /tracker, CRM, ClickUp, Meta,
// GA4, ManyChat ou dash. Robô (pelas mesmas listas do /tracker) recebe ok e não
// vira linha. Mesmo molde de functions/api/aplicacao-plano-ao-vivo.js.

import { detectBot, detectBotPorIp } from '../_bots.js';
import { padronizarTelefone } from '../_telefone.js';
import { acrescentarLinha } from './_google-planilha.js';
import { validarResposta, PERGUNTAS, CABECALHO } from '../../src/data/hotseat-giulliano-puga.js';

// Criada em 11/11/2026 (dona: felipe@seteads.com; marcelle@seteads.com edita).
const PLANILHA ='16GJ63r2QjOzMWFMQlfd-du-vbNbjqDZbcdDbz7osoig';
const ABA = 'Página1';
const CONTA = 'marcelle@seteads.com';
const MAX_CORPO = 5000;

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

const MENTORADOS = {
  nome: 'hotseat-giulliano-puga', validar: validarResposta, perguntas: PERGUNTAS, cabecalho: CABECALHO,
  // atualizarCabecalho: as colunas mudaram em 12/11 (saíram nome, WhatsApp e e-mail).
  planilha: PLANILHA, aba: ABA, opcoes: { atualizarCabecalho: true },
};

export const processarResposta = (contexto) => processarCom(MENTORADOS, contexto);

/**
 * Processamento comum às duas páginas da mentoria (mentorados e grupo gratuito,
 * em mentoria-giulliano-puga.js). `cfg` diz as perguntas e onde gravar.
 */
export async function processarCom(cfg, { request, env, agoraMs = Date.now(), gravar = acrescentarLinha }) {
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (detectBot(ua).isBot || detectBotPorIp(ip).isBot) return json({ ok: true });

  const texto = await request.text();
  if (texto.length > MAX_CORPO) return json({ ok: false, erro: 'grande_demais' }, 413);
  let corpo;
  try { corpo = JSON.parse(texto); } catch { return json({ ok: false, erro: 'json' }, 400); }

  const v = cfg.validar(corpo?.respostas);
  if (!v.ok) return json({ ok: false, campo: v.campo }, 400);

  // Telefone: mesma regra única do servidor usada no /tracker.
  for (const p of cfg.perguntas) {
    if (p.tipo !== 'telefone') continue;
    const tel = padronizarTelefone(v.valores[p.name]);
    if (tel.situacao === 'impossivel' || tel.situacao === 'ausente') return json({ ok: false, campo: p.name }, 400);
    v.valores[p.name] = tel.digitos;
  }

  const origem = String(corpo?.origem || '').slice(0, 500);
  const linha = [
    dataHoraBrasilia(agoraMs),
    ...cfg.perguntas.map((p) => v.valores[p.name]),
    origem,
  ];

  try {
    await gravar(env, { subject: CONTA, planilha: cfg.planilha, aba: cfg.aba, cabecalho: cfg.cabecalho, linha, ...cfg.opcoes });
  } catch (e) {
    console.error(`[${cfg.nome}] falha ao gravar na planilha:`, e?.codigo || '', e?.status || '', e?.message || e);
    return json({ ok: false, erro: 'planilha' }, 502);
  }

  return json({ ok: true });
}

export async function onRequestPost(context) {
  return processarResposta(context);
}

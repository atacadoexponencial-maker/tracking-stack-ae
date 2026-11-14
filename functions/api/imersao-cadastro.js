// POST /api/imersao-cadastro → cadastro feito na janela antes do checkout da
// Imersão Planejamento Atacado 2027 (spec-popup-checkout-imersao.md, série S10,
// issue S10-04).
//
// Confere nome, e-mail e WhatsApp e acrescenta uma linha na planilha, com as
// UTMs da visita e o lote e o preço daquele momento (quem decide o lote é o
// servidor, pela hora dele). A página não espera esta resposta para levar a
// pessoa ao checkout: falha aqui nunca segura a venda.
//
// Robô (mesmas listas do /tracker) recebe ok e não vira linha.

import { detectBot, detectBotPorIp } from '../_bots.js';
import { padronizarTelefone } from '../_telefone.js';
import { acrescentarLinha } from './_google-planilha.js';
import { dataHoraBrasilia } from './hotseat-giulliano-puga.js';
import { LOTES_IMERSAO } from '../../src/data/lotes-imersao.js';
import { loteVigente } from '../../src/data/lotes-workshop.js';

// Criada em 14/11/2026 pela VPS, na conta marcelle@seteads.com.
// A aba Compras do mesmo arquivo é gravada por _imersao-compra.js.
export const PLANILHA = '1extoy7Pqg4woEV_xUqm6KRR6aj9HLTy2-rVQQX_qGD8';
const ABA = 'Cadastros';
export const CONTA = 'marcelle@seteads.com';
const MAX_CORPO = 5000;

const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const CABECALHO = ['Data/hora', 'Nome', 'E-mail', 'WhatsApp', ...UTMS, 'Lote', 'Preço'];

const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

export async function processarCadastro({ request, env, agoraMs = Date.now(), gravar = acrescentarLinha }) {
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (detectBot(ua).isBot || detectBotPorIp(ip).isBot) return json({ ok: true });

  const bruto = await request.text();
  if (bruto.length > MAX_CORPO) return json({ ok: false, erro: 'grande_demais' }, 413);
  let corpo;
  try { corpo = JSON.parse(bruto); } catch { return json({ ok: false, erro: 'json' }, 400); }

  const nome = texto(corpo?.nome, 120);
  const email = texto(corpo?.email, 200).toLowerCase();
  if (nome.length < 2) return json({ ok: false, campo: 'nome' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, campo: 'email' }, 400);
  // Telefone: mesma regra única do servidor usada no /tracker.
  const tel = padronizarTelefone(corpo?.telefone);
  if (tel.situacao === 'impossivel' || tel.situacao === 'ausente') return json({ ok: false, campo: 'telefone' }, 400);

  const lote = loteVigente(agoraMs, LOTES_IMERSAO);
  const aberto = lote.estado === 'aberto';
  const linha = [
    dataHoraBrasilia(agoraMs),
    nome,
    email,
    tel.digitos,
    ...UTMS.map((k) => texto(corpo?.utms?.[k], 200)),
    aberto ? lote.rotulo : '',
    aberto ? lote.valor : '',
  ];

  try {
    await gravar(env, { subject: CONTA, planilha: PLANILHA, aba: ABA, cabecalho: CABECALHO, linha, criarAba: true });
  } catch (e) {
    console.error('[imersao-cadastro] falha ao gravar na planilha:', e?.codigo || '', e?.status || '', e?.message || e);
    return json({ ok: false, erro: 'planilha' }, 502);
  }
  return json({ ok: true });
}

export async function onRequestPost(context) {
  return processarCadastro(context);
}

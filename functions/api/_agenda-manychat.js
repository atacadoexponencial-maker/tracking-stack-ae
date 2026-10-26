// Confirmação da consultoria pelo WhatsApp, via ManyChat (pedido de 26/10).
//
// Todo agendamento e toda remarcação da Consultoria Individual (venha de onde
// vier: home, aplicação mentoria, calculadora, link direto) mandam ao lead uma
// mensagem com dia, horário, link do Meet e link de remarcar/cancelar.
// Cancelamento não manda nada (o e-mail de cancelamento já sai).
//
// Ordem: acha ou cria o contato → tag → campos personalizados → fluxo. Os
// campos vêm ANTES do fluxo porque o modelo da mensagem (criado pela usuária no
// ManyChat e aprovado pelo Meta) lê dia e hora deles. Por isso não usa o
// `flowNs` do inscreverComTag, que dispararia o fluxo na criação.
//
// Sem `fluxo` configurado, não faz nada: o código vai para o ar desligado até
// o fluxo existir. Nunca lança; o resultado fica no histórico da reunião.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { inscreverComTag, aplicarTag, preencherCampos, dispararFluxo } from './_manychat.js';
import { acharPorTelefone } from './_grupos-manychat.js';
import { normalizePhone } from './_hash.js';
import { lerReuniao, lerTipo, historico, linkGestao } from './_agenda.js';

// Ids da conta real do ManyChat, criados pela API em 26/10/2026.
export const CONSULTORIA_MANYCHAT = {
  slug: 'consultoria-individual',
  tag: 100033007, // agendou-consultoria
  campos: {
    data: 15103238, // consultoria_data: "terça, 28/10"
    horario: 15103239, // consultoria_horario: "14h00" (Brasília)
    meet: 15103236, // consultoria_meet
    gestao: 15103237, // consultoria_gestao: link de remarcar/cancelar
  },
  fluxo: 'content20261026235153_105229', // "Reunião Agendada" (modelo aprovado em 26/10); vazio = desligado
  consentimento: 'agendamento da consultoria individual',
};

const FUSO = 'America/Sao_Paulo';

/** Dia e horário como o lead lê na mensagem: "terça, 28/10" e "14h00". */
export function dataEHora(unix) {
  const d = new Date(unix * 1000);
  const semana = d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long' }).replace(/-feira$/, '');
  const dia = d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return { data: `${semana}, ${dia}`, horario: hora };
}

/** Quem recebe e como: devolve o motivo de pular ou '' para seguir. */
export function motivoParaPular(reuniao, tipo, acao, cfg = CONSULTORIA_MANYCHAT) {
  if (!['agendou', 'remarcou'].includes(acao)) return 'acao_sem_mensagem';
  if (!tipo || tipo.slug !== cfg.slug) return 'outro_tipo';
  if (!['marcada', 'remarcada'].includes(reuniao.situacao)) return 'reuniao_nao_ativa';
  if (!cfg.fluxo) return 'sem_fluxo';
  return '';
}

async function acharOuCriar(reuniao, telefone, cfg, env) {
  const existente = await acharPorTelefone(telefone, env);
  if (existente) {
    const falha = await aplicarTag(existente, cfg.tag, env);
    return falha ? { erro: falha } : { id: existente };
  }
  const r = await inscreverComTag({
    nome: reuniao.nome, telefone, email: String(reuniao.email || '').toLowerCase(),
    tagId: cfg.tag, consentimento: cfg.consentimento, env,
  });
  if (r.ok) return { id: r.subscriberId };
  if (r.motivo === 'ja_existia') return { erro: 'contato só de WhatsApp, que a API do ManyChat não encontra' };
  return { erro: r.detalhe || r.motivo };
}

/**
 * Manda a confirmação de uma reunião (pelo id, lida de novo do banco para
 * pegar horário e Meet já atualizados). `acao`: 'agendou' | 'remarcou' | outra.
 * Devolve o desfecho em texto e nunca lança.
 */
export async function whatsappDaReuniao(env, reuniaoId, acao, cfg = CONSULTORIA_MANYCHAT) {
  try {
    const reuniao = await lerReuniao(env, { id: reuniaoId });
    if (!reuniao) return 'reuniao_nao_encontrada';
    const tipo = await lerTipo(env, { id: reuniao.tipo_id });
    const pular = motivoParaPular(reuniao, tipo, acao, cfg);
    if (pular) return pular;

    const registrar = async (desfecho, detalhe) => {
      await historico(env, reuniao.id, 'whatsapp', detalhe, 'sistema');
      return desfecho;
    };
    if (!env.MANYCHAT_API) return registrar('sem_config', 'WhatsApp não enviado: ManyChat não configurado neste ambiente.');
    const telefone = normalizePhone(reuniao.telefone || '', env.DEFAULT_COUNTRY_CODE || '55');
    if (!telefone) return registrar('sem_telefone', 'WhatsApp não enviado: reunião sem telefone.');

    const contato = await acharOuCriar(reuniao, telefone, cfg, env);
    if (contato.erro) return registrar('erro', `WhatsApp falhou: ${contato.erro}`);

    const { data, horario } = dataEHora(reuniao.inicio);
    const falhaCampos = await preencherCampos(contato.id, {
      [cfg.campos.data]: data,
      [cfg.campos.horario]: horario,
      [cfg.campos.meet]: reuniao.meet_link || '',
      [cfg.campos.gestao]: linkGestao(reuniao.token_gestao),
    }, env);
    if (falhaCampos) return registrar('erro', `WhatsApp falhou: ${falhaCampos}`);

    const falhaFluxo = await dispararFluxo(contato.id, cfg.fluxo, env);
    if (falhaFluxo) return registrar('erro', `WhatsApp falhou: ${falhaFluxo}`);
    return registrar('enviado', `WhatsApp enviado (${acao === 'remarcou' ? 'remarcação' : 'agendamento'}): ${data} às ${horario}.`);
  } catch (e) {
    console.error('agenda-manychat — exceção', e && e.message);
    return 'erro';
  }
}

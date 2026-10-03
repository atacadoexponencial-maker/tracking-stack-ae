// Ponte: formulário de LP → ManyChat.
//
// Quem preenche o formulário de um funil configurado aqui vira contato no
// ManyChat e ganha a tag do formulário. Existe desde 29/09/2026 porque a LP do
// workshop gratuito passou a ter formulário: antes, o único jeito de alguém
// chegar ao ManyChat era entrar no grupo (tag grupo-workshop, em
// ./_grupos-manychat.js). Com as duas tags, a usuária separa quem se inscreveu
// e não entrou no grupo.
//
// Chamada pelo /tracker (functions/tracker.js) em `waitUntil`, só para Lead não
// bloqueado. Nada aqui lança: falha no ManyChat não pode custar o lead nos
// outros destinos.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { inscreverComTag, aplicarTag, dispararFluxo } from './_manychat.js';
import { acharPorTelefone } from './_grupos-manychat.js';
import { normalizePhone } from './_hash.js';

// Um funil por entrada. Os ids vêm da conta real do ManyChat
// (GET /fb/page/getTags e /fb/page/getFlows).
export const FUNIS_MANYCHAT = {
  workshop: {
    tagForm: 97746964, // form-workshop-gratuito (criada em 2026-09-29)
    // "Entre no grupo" (criado pela usuária em 29/09). Disparado na hora do
    // formulário; a espera de 30 min e a checagem "não tem a tag
    // grupo-workshop" ficam DENTRO do fluxo, no ManyChat (Atraso Inteligente +
    // Condição). A mensagem é um modelo da API oficial, porque a pessoa ainda
    // não falou com a conta e está fora da janela de 24h. Lembrete: tag
    // aplicada pela API NÃO dispara automação, por isso o fluxo vem daqui.
    fluxo: 'content20260929233329_927636',
    consentimento: 'formulário da LP /workshop-gratuito',
  },
  // Aplicação para o plano de ação ao vivo do workshop de 07/10/2026
  // (spec-aplicacao-plano-ao-vivo.md). Não vem do /tracker: quem chama é
  // functions/api/aplicacao-plano-ao-vivo.js, depois de gravar a linha na
  // planilha. `tagEnviado` só entra quando o ManyChat aceitou o fluxo: quem tem
  // a tagForm e não tem esta ficou sem a mensagem.
  'aplicacao-plano-ao-vivo': {
    tagForm: 98044274, // aplicou-wo07-10 (criada em 2026-10-03)
    tagEnviado: 98044275, // aplicou-wo07-10-enviado
    fluxo: 'content20261003121955_441447', // "Aplicação Plano de Ação ao Vivo"
    consentimento: 'aplicação /aplicacao-plano-ao-vivo',
  },
};

// Telefone no log só com os 4 últimos dígitos.
function mascarar(telefone) {
  const t = String(telefone || '');
  return t ? `•••••${t.slice(-4)}` : '(sem telefone)';
}

/**
 * Inscreve no ManyChat quem preencheu o formulário de um funil configurado.
 * Devolve o desfecho em texto (para teste e log) e nunca lança.
 */
export async function enviarLeadAoManyChat({ leadData, env }) {
  try {
    const funil = String(leadData?.funnel || '').toLowerCase().trim();
    const cfg = FUNIS_MANYCHAT[funil];
    if (!cfg) return 'funil_sem_config';

    const telefone = normalizePhone(leadData.telefone || '', env.DEFAULT_COUNTRY_CODE || '55');
    const email = String(leadData.email || '').trim().toLowerCase();

    // Quem já existe no ManyChat (com ou sem o nono dígito) não vira contato
    // novo: a conta não deixa apagar pela API, então duplicata é para sempre.
    if (telefone && env.MANYCHAT_API) {
      const existente = await acharPorTelefone(telefone, env);
      if (existente) {
        let falha = await aplicarTag(existente, cfg.tagForm, env);
        if (!falha && cfg.fluxo) falha = await dispararFluxo(existente, cfg.fluxo, env);
        if (!falha && cfg.fluxo && cfg.tagEnviado) falha = await aplicarTag(existente, cfg.tagEnviado, env);
        if (falha) console.error('lead-manychat —', funil, 'erro no existente', mascarar(telefone), falha);
        return falha ? 'erro' : 'ja_existia_tagueado';
      }
    }

    const r = await inscreverComTag({
      nome: leadData.nome || '',
      telefone,
      email,
      tagId: cfg.tagForm,
      flowNs: cfg.fluxo || undefined,
      tagEnviadoId: cfg.tagEnviado || undefined,
      consentimento: cfg.consentimento,
      env,
    });
    if (!r.ok) console.error('lead-manychat —', funil, r.motivo, mascarar(telefone), r.detalhe || '');
    return r.motivo;
  } catch (e) {
    console.error('lead-manychat — exceção', e && e.message);
    return 'erro';
  }
}

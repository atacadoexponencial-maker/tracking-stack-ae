// Checagem das credenciais (spec-protecoes-integracoes.md, módulo 1).
//
// De 30/07 a 15/09/2026 o Meta recusou 100% das conversões porque dois secrets
// foram gravados com um BOM invisível na frente. Esta checagem teria apontado
// o defeito no primeiro dia.
//
// REGRA DE OURO: nenhum valor sai desta função — nem trecho, nem tamanho, nem
// hash. Só o NOME da credencial e o TIPO do problema.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// obrigatoria: faltar é problema. Opcional ausente = "não se aplica".
// formato: validação de forma quando ela é conhecida.
// teste: 'meta' | 'clickup' — consulta de aceitação sem efeito colateral.
export const CATALOGO = [
  { nome: 'META_PIXEL_ID_2', integracao: 'Meta (conversões)', obrigatoria: true, formato: 'numerico', teste: 'meta' },
  { nome: 'META_ACCESS_TOKEN_2', integracao: 'Meta (conversões)', obrigatoria: true, teste: 'meta' },
  { nome: 'META_TEST_EVENT_CODE', integracao: 'Meta (conversões)', obrigatoria: false },
  { nome: 'META_ADS_ACCESS_TOKEN', integracao: 'Meta (investimento)', obrigatoria: true },
  { nome: 'META_ACCESS_TOKEN', integracao: 'Meta (investimento, legado)', obrigatoria: false },
  { nome: 'META_ADS_ACCOUNT_ID', integracao: 'Meta (investimento)', obrigatoria: false },
  { nome: 'WINDSOR_API_KEY', integracao: 'Windsor (investimento)', obrigatoria: true },
  { nome: 'WINDSOR_META_ACCOUNT', integracao: 'Windsor (investimento)', obrigatoria: true },
  { nome: 'GA4_MEASUREMENT_ID', integracao: 'GA4', obrigatoria: true, formato: 'ga4' },
  { nome: 'GA4_API_SECRET', integracao: 'GA4', obrigatoria: true },
  { nome: 'CLICKUP_API_TOKEN', integracao: 'ClickUp', obrigatoria: true, teste: 'clickup' },
  { nome: 'CLICKUP_LIST_ID', integracao: 'ClickUp', obrigatoria: true, formato: 'numerico' },
  { nome: 'LEAD_WEBHOOK_URL_CRM', integracao: 'CRM novo', obrigatoria: true, formato: 'https' },
  { nome: 'LEAD_WEBHOOK_TOKEN_CRM', integracao: 'CRM novo', obrigatoria: true },
  { nome: 'LEAD_WEBHOOK_URL_WHATSAPP', integracao: 'Encaminhamento de lead (WhatsApp)', obrigatoria: false, formato: 'https' },
  { nome: 'LEAD_WEBHOOK_TOKEN_WHATSAPP', integracao: 'Encaminhamento de lead (WhatsApp)', obrigatoria: false },
  { nome: 'TOKEN_GHL', integracao: 'GoHighLevel', obrigatoria: true },
  { nome: 'LOCAL_ID', integracao: 'GoHighLevel', obrigatoria: true },
  { nome: 'MANYCHAT_API', integracao: 'ManyChat', obrigatoria: true },
  { nome: 'ENCHARGE_API_KEY', integracao: 'Encharge', obrigatoria: false },
  { nome: 'GOOGLE_ADS_DEVELOPER_TOKEN', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GOOGLE_ADS_CLIENT_ID', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GOOGLE_ADS_CLIENT_SECRET', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GOOGLE_ADS_REFRESH_TOKEN', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GOOGLE_ADS_CUSTOMER_ID', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID', integracao: 'Google Ads', obrigatoria: false },
  { nome: 'GREENN_WEBHOOK_TOKEN', integracao: 'Recebimento de vendas', obrigatoria: true },
  { nome: 'KIWIFY_WEBHOOK_SLUG', integracao: 'Recebimento de vendas', obrigatoria: false },
  { nome: 'HOTMART_WEBHOOK_SLUG', integracao: 'Recebimento de vendas', obrigatoria: false },
  { nome: 'EDUZZ_WEBHOOK_SLUG', integracao: 'Recebimento de vendas', obrigatoria: false },
  { nome: 'GRUPOS_WEBHOOK_SECRET', integracao: 'Grupos de WhatsApp', obrigatoria: true },
  { nome: 'EVOLUTION_API_URL', integracao: 'Evolution (em aposentadoria)', obrigatoria: false, formato: 'https' },
  { nome: 'EVOLUTION_BASE_URL', integracao: 'Evolution (em aposentadoria)', obrigatoria: false, formato: 'https' },
  { nome: 'EVOLUTION_INSTANCE', integracao: 'Evolution (em aposentadoria)', obrigatoria: false },
  { nome: 'EVOLUTION_APIKEY_NOTIF', integracao: 'Evolution (em aposentadoria)', obrigatoria: false },
  { nome: 'EVOLUTION_NUMERO_NOTIF', integracao: 'Evolution (em aposentadoria)', obrigatoria: false },
  { nome: 'EVOLUTION_APIKEY_ALERTA', integracao: 'Evolution (em aposentadoria)', obrigatoria: false },
  { nome: 'EVOLUTION_NUMERO_ALERTA', integracao: 'Evolution (em aposentadoria)', obrigatoria: false },
  { nome: 'SYNC_SECRET', integracao: 'Acesso interno', obrigatoria: true },
  { nome: 'DASH_KEY', integracao: 'Acesso interno', obrigatoria: true },
  { nome: 'FEEDBACK_MARKETING_KEY', integracao: 'Acesso interno', obrigatoria: true },
  // Opcional até a usuária cadastrar o webhook: a aba já avisa "canal não configurado".
  { nome: 'SLACK_WEBHOOK_META', integracao: 'Alerta', obrigatoria: false, formato: 'https' },
  { nome: 'DASH_URL_SAUDE_META', integracao: 'Alerta', obrigatoria: false, formato: 'https' },
  { nome: 'LEAD_REDIRECT_LIVE', integracao: 'Redirecionamentos', obrigatoria: false },
  { nome: 'LEAD_REDIRECT_WHATSAPP', integracao: 'Redirecionamentos', obrigatoria: true, formato: 'https' },
  { nome: 'LEAD_REDIRECT_WHATSAPP_TRAFEGO', integracao: 'Redirecionamentos', obrigatoria: false, formato: 'https' },
  { nome: 'LEAD_REDIRECT_CALENDLY', integracao: 'Redirecionamentos', obrigatoria: true, formato: 'https' },
  { nome: 'LEAD_REDIRECT_CALENDLY_TRAFEGO', integracao: 'Redirecionamentos', obrigatoria: false, formato: 'https' },
  { nome: 'LEAD_REDIRECT_WORKSHOP', integracao: 'Redirecionamentos', obrigatoria: false },
  { nome: 'GRUPO_WORKSHOP_URL', integracao: 'Redirecionamentos', obrigatoria: true, formato: 'https' },
  { nome: 'DEFAULT_COUNTRY_CODE', integracao: 'Configuração', obrigatoria: false, formato: 'numerico' },
  { nome: 'TIMEZONE_OFFSET', integracao: 'Configuração', obrigatoria: false },
];

export const MOTIVOS = {
  ausente: 'Não configurada.',
  vazia: 'Configurada, mas vazia.',
  invisivel: 'Contém caractere invisível (ex.: BOM ou espaço de largura zero) — regrave a credencial.',
  pontas: 'Tem espaço ou quebra de linha no começo ou no fim.',
  aspas: 'Está entre aspas — as aspas foram gravadas junto com o valor.',
  formato: 'Formato inesperado para este tipo de credencial.',
  recusada: 'O serviço recusou a credencial (inválida, expirada ou sem permissão).',
  semResposta: 'Não foi possível confirmar agora — o serviço não respondeu.',
};

// BOM, espaço/junção/não-junção de largura zero, espaço não separável, joiner de palavra.
const INVISIVEIS = /[﻿​‌‍ ⁠]/;

/**
 * Examina a FORMA de um valor. Devolve os tipos de problema na ordem da spec.
 * Não guarda nem devolve nada do valor.
 */
export function examinarForma(valor, item = {}) {
  if (valor === undefined || valor === null) return ['ausente'];
  const v = String(valor);
  if (v.trim().replace(INVISIVEIS, '') === '' && !INVISIVEIS.test(v)) return ['vazia'];
  const problemas = [];
  if (INVISIVEIS.test(v)) problemas.push('invisivel');
  // Lista explícita: o `\s` do JavaScript também casa com BOM e espaço não
  // separável, e contaria o mesmo defeito duas vezes.
  if (/^[ \t\r\n\v\f]|[ \t\r\n\v\f]$/.test(v)) problemas.push('pontas');
  const limpo = v.replace(INVISIVEIS, '').trim();
  if (limpo.length >= 2 && /^(["']).*\1$/s.test(limpo)) problemas.push('aspas');
  if (item.formato && !formatoValido(item.formato, limpo.replace(/^["']|["']$/g, ''))) problemas.push('formato');
  return problemas;
}

function formatoValido(formato, v) {
  if (formato === 'numerico') return /^\d+$/.test(v);
  if (formato === 'https') return /^https:\/\/\S+$/.test(v);
  if (formato === 'ga4') return /^G-[A-Z0-9]+$/.test(v);
  return true;
}

/**
 * Situação de um item a partir da forma e (quando houver) do teste de aceitação.
 * `aceitacao`: undefined (sem teste) | 'aceita' | 'recusada' | 'sem_resposta'.
 * `naoConfirmadoAntes`: quantas rodadas automáticas seguidas já deram "não confirmado".
 */
export function situacaoDoItem(item, problemasForma, aceitacao, { automatica = true, naoConfirmadoAntes = 0 } = {}) {
  if (problemasForma.includes('ausente')) {
    return item.obrigatoria
      ? { situacao: 'problema', motivos: [MOTIVOS.ausente] }
      : { situacao: 'nao_se_aplica', motivos: [], nota: 'Não configurada (opcional).' };
  }
  if (problemasForma.length) return { situacao: 'problema', motivos: problemasForma.map((p) => MOTIVOS[p]) };
  if (aceitacao === 'recusada') return { situacao: 'problema', motivos: [MOTIVOS.recusada] };
  if (aceitacao === 'sem_resposta') {
    // Vira problema só se repetir em 2 rodadas automáticas seguidas.
    const seguidas = automatica ? naoConfirmadoAntes + 1 : naoConfirmadoAntes;
    return seguidas >= 2
      ? { situacao: 'problema', motivos: [MOTIVOS.semResposta], naoConfirmadoSeguidas: seguidas }
      : { situacao: 'nao_confirmado', motivos: [MOTIVOS.semResposta], naoConfirmadoSeguidas: seguidas };
  }
  return {
    situacao: 'ok',
    motivos: [],
    nota: aceitacao === 'aceita' ? 'Aceita pelo serviço.' : 'Conferida só a forma.',
    naoConfirmadoSeguidas: 0,
  };
}

/** Frase curta para alerta e faixa de estado (sem valor). */
export function resumoProblema(nome, motivos) {
  return `${nome}: ${motivos.join(' ')}`;
}

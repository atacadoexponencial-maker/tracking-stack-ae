// Opções atuais do campo "🔻 Funil" da lista do CRM (ClickUp), para o cadastro
// de funis do relatório (spec-feedback-marketing.md).
//
// Lidas do PRÓPRIO CRM a cada consulta, e não de uma cópia no código: a equipe
// cria e renomeia opções lá, e uma lista fixa aqui divergiria em silêncio.
// Só leitura — nada é escrito no ClickUp.
//
// Busca o campo pelo ID (CU_FIELD.funil), nunca pelo nome: a lista tem também
// um campo de texto chamado "🔻 FUNIL", que não é este.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { CU_FIELD, CU_DEFAULT_LIST, clickupFetch } from './_clickup.js';

export const ERRO_LEITURA_CRM = 'Não foi possível ler as opções do CRM agora';

// Resposta de GET /list/{id}/field → [{ id, nome }] na ordem do CRM.
// Devolve null quando o campo não veio ou veio malformado: "não sei" nunca pode
// virar "o CRM não tem opção nenhuma".
export function extrairOpcoesFunil(resposta) {
  const campos = resposta && Array.isArray(resposta.fields) ? resposta.fields : null;
  if (!campos) return null;
  const campo = campos.find((f) => f && f.id === CU_FIELD.funil);
  const opcoes = campo && campo.type_config && campo.type_config.options;
  if (!Array.isArray(opcoes)) return null;

  return opcoes
    .filter((o) => o && o.id && String(o.name == null ? '' : o.name).trim())
    .sort((a, b) => (Number(a.orderindex) || 0) - (Number(b.orderindex) || 0))
    .map((o) => ({ id: String(o.id), nome: String(o.name).trim() }));
}

// { ok: true, opcoes } ou { ok: false, erro }. Nunca lança: falha do CRM não
// pode derrubar a aba — os funis já cadastrados continuam visíveis.
export async function lerOpcoesFunilCrm(env) {
  if (!env || !env.CLICKUP_API_TOKEN) return { ok: false, erro: ERRO_LEITURA_CRM };
  try {
    const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
    const res = await clickupFetch(`/list/${listId}/field`, { method: 'GET' }, env);
    if (!res.ok) throw new Error(`ClickUp field ${res.status}`);
    const opcoes = extrairOpcoesFunil(await res.json());
    if (!opcoes) throw new Error('campo 🔻 Funil ausente ou malformado');
    return { ok: true, opcoes };
  } catch (e) {
    console.error('CRM — leitura das opções do funil falhou:', e.message);
    return { ok: false, erro: ERRO_LEITURA_CRM };
  }
}

// Configuração do e-mail próprio (spec-email-proprio.md, módulo 1; issue 377).
// Tabela email_config: uma linha por campo. Validação aqui; o dash só mostra
// a mensagem que volta.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { normalizarBloco, linksDoDocumento } from './_email-blocos.js';

/** Domínio verificado de cada canal. */
export const DOMINIOS = {
  transacional: 'envio.atacadoexponencial.com',
  marketing: 'news.atacadoexponencial.com',
};

export const PADROES = {
  remetente_transacional_nome: 'Atacado Exponencial',
  remetente_transacional_email: 'notify@envio.atacadoexponencial.com',
  remetente_marketing_nome: 'Felipe Santos | Atacado Exponencial',
  remetente_marketing_email: 'felipe@news.atacadoexponencial.com',
  resposta_transacional: '',
  resposta_marketing: '',
  rodape: '',
  marketing_liberado: '1',
  // Cabeçalho padrão montado com blocos (spec-editor-email.md, módulo 3; issue 397).
  // Vazio = a logo de hoje (CAB_PADRAO_INICIAL em _email-blocos.js).
  cabecalho_padrao: '',
};

const MAX_NOME = 100;
const MAX_RODAPE = 1000;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export const emailValido = (v) => typeof v === 'string' && v.length <= 254 && EMAIL.test(v);

/** Lê a configuração, completando o que faltar com os padrões. */
export async function lerConfig(env) {
  const { results } = await env.DB.prepare('SELECT chave, valor FROM email_config').all();
  const cfg = { ...PADROES };
  for (const r of results || []) if (r.chave in PADROES && r.valor !== null) cfg[r.chave] = r.valor;
  return cfg;
}

/**
 * Valida os campos enviados (atualização parcial: só os que vieram).
 * Devolve { valores } ou { erro }.
 */
export function validarConfig(campos) {
  if (!campos || typeof campos !== 'object') return { erro: 'Nada para salvar.' };
  const valores = {};
  for (const [chave, bruto] of Object.entries(campos)) {
    if (!(chave in PADROES)) return { erro: `Campo desconhecido: ${chave}.` };
    if (chave === 'cabecalho_padrao') {
      const r = validarCabecalho(bruto);
      if (r.erro) return r;
      valores[chave] = r.valor;
      continue;
    }
    const v = bruto === null || bruto === undefined ? '' : String(bruto);
    const canal = /transacional/.test(chave) ? 'transacional' : 'marketing';
    if (chave.endsWith('_nome')) {
      const nome = v.trim();
      if (!nome) return { erro: 'O nome do remetente não pode ficar vazio.' };
      if (nome.length > MAX_NOME) return { erro: `O nome do remetente passa de ${MAX_NOME} caracteres.` };
      if (/["<>\r\n]/.test(nome)) return { erro: 'O nome do remetente não pode ter aspas, < > ou quebra de linha.' };
      valores[chave] = nome;
    } else if (chave.startsWith('remetente_') && chave.endsWith('_email')) {
      const end = v.trim().toLowerCase();
      if (!emailValido(end) || !end.endsWith('@' + DOMINIOS[canal])) {
        return { erro: `Use um endereço @${DOMINIOS[canal]}. É o único domínio verificado para o canal ${canal}.` };
      }
      valores[chave] = end;
    } else if (chave.startsWith('resposta_')) {
      const end = v.trim().toLowerCase();
      if (end && !emailValido(end)) return { erro: 'O endereço de resposta parece incompleto.' };
      valores[chave] = end;
    } else if (chave === 'rodape') {
      const rod = v.replace(/\r\n/g, '\n').trim();
      if (rod.length > MAX_RODAPE) return { erro: `O rodapé passa de ${MAX_RODAPE} caracteres.` };
      valores[chave] = rod;
    } else if (chave === 'marketing_liberado') {
      valores[chave] = v === '1' || v === 'true' ? '1' : '0';
    }
  }
  if (!Object.keys(valores).length) return { erro: 'Nada para salvar.' };
  return { valores };
}

export async function salvarConfig(env, valores, agora = Math.floor(Date.now() / 1000)) {
  for (const [chave, valor] of Object.entries(valores)) {
    await env.DB.prepare(
      `INSERT INTO email_config (chave, valor, atualizado_em) VALUES (?, ?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    ).bind(chave, valor, agora).run();
  }
}

/** Cabeçalho padrão: { fundo, blocos } limpo; vazio não vale (use "Sem cabeçalho" no modelo). */
function validarCabecalho(bruto) {
  let d = bruto;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return { erro: 'Cabeçalho padrão inválido.' }; } }
  const blocos = (Array.isArray(d?.blocos) ? d.blocos : []).slice(0, 20).map(normalizarBloco).filter(Boolean).map((b) => ({ ...b, zona: 'cab' }));
  if (!blocos.length) return { erro: 'O cabeçalho padrão está vazio. Adicione pelo menos um bloco, ou use "Sem cabeçalho" em cada modelo.' };
  const fundo = /^#[0-9a-f]{6}$/i.test(String(d?.fundo || '')) ? String(d.fundo).toLowerCase() : '';
  const doc = { blocos };
  for (const { trecho, url } of linksDoDocumento(doc)) {
    const soCampo = /^\{\{\s*[a-z_]+\s*\}\}$/i.test(url);
    if (!url) return { erro: `${trecho}: o botão precisa de um link.` };
    if (!soCampo && !/^https:\/\/[^\s]+\.[^\s]+/i.test(url) && !/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return { erro: `${trecho}: link sem https:// ("${url}").` };
  }
  return { valor: JSON.stringify({ fundo, blocos }) };
}

/** Remetente no formato do cabeçalho From: "Nome" <endereço>. */
export function remetente(cfg, canal) {
  return `"${cfg[`remetente_${canal}_nome`]}" <${cfg[`remetente_${canal}_email`]}>`;
}

// Régua do Argo: os números que decidem o que ele julga
// (spec-argo-regua-editavel.md, issue 313).
//
// Fonte única de quais regras existem, seus padrões, limites e se já têm
// efeito. A aba desenha a partir do que o GET devolve daqui; o POST valida
// com as mesmas definições. Módulo puro, testado por `node --test`.
//
// `ativa: false` = a regra já aparece e pode ser ajustada, mas a lógica que a
// usa chega numa issue seguinte (305–309). A tela esmaece essas linhas, para
// ninguém sair achando que um número vale quando ainda não vale.

export const REGRAS = Object.freeze({
  // Anúncios de lead (issue 314 — no ar)
  lead_multiplicador_cpl: { tipo: 'numero', padrao: 3, min: 1, max: 10, passo: 0.5, ativa: true },
  lead_impressoes_min: { tipo: 'inteiro', padrao: 3000, min: 0, max: 100000, ativa: true },
  lead_janela_cpl_dias: { tipo: 'inteiro', padrao: 30, min: 7, max: 90, ativa: true },
  // Campanhas de tráfego (janelas: issue 315 — no ar)
  trafego_janela_recente_dias: { tipo: 'inteiro', padrao: 7, min: 3, max: 30, ativa: true },
  trafego_janela_passado_dias: { tipo: 'inteiro', padrao: 21, min: 7, max: 90, ativa: true },
  trafego_tolerancia_pct: { tipo: 'inteiro', padrao: 30, min: 5, max: 300, ativa: true },
  trafego_gasto_min_reais: { tipo: 'numero', padrao: 30, min: 0, max: 5000, passo: 0.01, ativa: true },
  // Travas (316), reduzir (317) e reativar (318) — no ar
  trava_aprendizado: { tipo: 'booleano', padrao: true, ativa: true },
  trava_aprendizado_dias: { tipo: 'inteiro', padrao: 7, min: 1, max: 60, ativa: true },
  intervalo_min_dias: { tipo: 'inteiro', padrao: 3, min: 1, max: 30, ativa: true },
  reduzir_antes: { tipo: 'booleano', padrao: true, ativa: true },
  reduzir_pct: { tipo: 'inteiro', padrao: 30, min: 5, max: 90, ativa: true },
  reativar: { tipo: 'booleano', padrao: false, ativa: true },
  reativar_tolerancia_pct: { tipo: 'inteiro', padrao: 20, min: 0, max: 200, ativa: true },
});

const CHAVES = Object.keys(REGRAS);

function valorValido(def, v) {
  if (def.tipo === 'booleano') return typeof v === 'boolean';
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  if (def.tipo === 'inteiro' && !Number.isInteger(v)) return false;
  return v >= def.min && v <= def.max;
}

// O que a aba recebe: valores salvos por cima dos padrões. Valor salvo que
// não passa na validação de hoje (limite mudou, dado estranho) cai no padrão
// — e a tela mostra o padrão, não o valor inválido.
export function montarRegua(salva, alteradaEm = null, alteradaPor = null) {
  const guardada = salva && typeof salva === 'object' && !Array.isArray(salva) ? salva : {};
  const valores = {};
  const padroes = {};
  const limites = {};
  const ativas = [];
  for (const chave of CHAVES) {
    const def = REGRAS[chave];
    padroes[chave] = def.padrao;
    valores[chave] = valorValido(def, guardada[chave]) ? guardada[chave] : def.padrao;
    if (def.tipo !== 'booleano') limites[chave] = { min: def.min, max: def.max, passo: def.passo ?? 1 };
    if (def.ativa) ativas.push(chave);
  }
  return { valores, padroes, limites, ativas, alterada_em: alteradaEm, alterada_por: alteradaPor };
}

// Régua enviada pela tela: objeto completo, sem chave desconhecida, cada valor
// no tipo e no limite. Nunca corrige em silêncio.
export function validarRegua(regua) {
  const erros = [];
  if (!regua || typeof regua !== 'object' || Array.isArray(regua)) {
    return { ok: false, erros: ['A régua precisa ser um objeto com todas as regras.'] };
  }
  for (const chave of Object.keys(regua)) {
    if (!REGRAS[chave]) erros.push(`Regra desconhecida: ${chave}`);
  }
  for (const chave of CHAVES) {
    const def = REGRAS[chave];
    if (!(chave in regua)) {
      erros.push(`Regra ausente: ${chave}`);
      continue;
    }
    if (!valorValido(def, regua[chave])) {
      erros.push(def.tipo === 'booleano'
        ? `${chave} deve ser ligado ou desligado.`
        : `${chave} deve ser ${def.tipo === 'inteiro' ? 'um número inteiro' : 'um número'} entre ${def.min} e ${def.max}.`);
    }
  }
  return erros.length ? { ok: false, erros } : { ok: true, valores: { ...regua } };
}

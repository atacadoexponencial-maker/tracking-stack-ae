// Placar dos vereditos do Argo (issue 330): taxa de acerto por tipo de ação,
// geral e das mudanças manuais, no período escolhido pela aba.
//
// Módulo puro, testado por `node --test`. O endpoint (`argo/registro.js`)
// traz as linhas do banco e chama `montarPlacar`; a aba só desenha.
//
// Fórmula, a MESMA do relatório do Slack (`argo_veredito.linha_placar` e
// `argo_estado.placar_vereditos`, gestor-ae): conta pela data da AÇÃO, e
// taxa = acertos ÷ (acertos + erros). Inconclusivas entram no total de
// avaliadas, não na taxa. Sem conclusivas, a taxa é nula — nunca 0%.

// Ordem dos cartões por tipo, igual à do monitor (`TIPOS_AVALIAVEIS`).
export const TIPOS_PLACAR = Object.freeze([
  'pausar_campanha_trafego',
  'pausar_anuncio',
  'pausar_conjunto',
  'reduzir_orcamento',
  'aumentar_orcamento',
  'realocar_verba',
  'reativar_anuncio',
]);
export const SITUACOES_CONCLUSIVAS = Object.freeze(['acertou', 'errou', 'inconclusivo']);
export const PRESETS_DIAS = Object.freeze([30, 60, 90]);
export const MAX_DIAS_PERSONALIZADO = 366;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function somarDias(ymd, n) {
  const [ano, mes, dia] = ymd.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

function diasEntre(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
}

// Período do placar a partir da query da aba. Pedido inválido cai no padrão
// de 30 dias: o placar é um detalhe do registro, e um parâmetro torto não
// pode derrubar a lista de rodadas.
export function resolverPeriodo({ placar_dias, placar_de, placar_ate } = {}, hojeYmd) {
  const padrao = () => ({ de: somarDias(hojeYmd, -29), ate: hojeYmd, preset: 30 });
  if (typeof placar_de === 'string' || typeof placar_ate === 'string') {
    if (!YMD.test(placar_de ?? '') || !YMD.test(placar_ate ?? '')) return padrao();
    if (Number.isNaN(Date.parse(`${placar_de}T00:00:00Z`)) || Number.isNaN(Date.parse(`${placar_ate}T00:00:00Z`))) return padrao();
    const dias = diasEntre(placar_de, placar_ate);
    if (dias < 0 || dias + 1 > MAX_DIAS_PERSONALIZADO) return padrao();
    return { de: placar_de, ate: placar_ate, preset: 'custom' };
  }
  if (placar_dias === undefined || placar_dias === null || placar_dias === '') return padrao();
  const n = Number(placar_dias);
  if (!PRESETS_DIAS.includes(n)) return padrao();
  return { de: somarDias(hojeYmd, -(n - 1)), ate: hojeYmd, preset: n };
}

function cartaoVazio(chave, origem, tipo) {
  return { chave, origem, tipo, avaliadas: 0, acertos: 0, erros: 0, inconclusivas: 0, taxa_pct: null, gasto_erradas_centavos: 0 };
}

function somar(cartao, linha) {
  cartao.avaliadas += 1;
  if (linha.situacao === 'acertou') cartao.acertos += 1;
  else if (linha.situacao === 'errou') {
    cartao.erros += 1;
    const gasto = Number(linha.gasto_reais);
    if (Number.isFinite(gasto) && gasto > 0) cartao.gasto_erradas_centavos += Math.round(gasto * 100);
  } else cartao.inconclusivas += 1;
}

function fecharTaxa(cartao) {
  const conclusivas = cartao.acertos + cartao.erros;
  cartao.taxa_pct = conclusivas ? Math.round((100 * cartao.acertos) / conclusivas) : null;
  return cartao;
}

// `linhas` = [{ situacao, origem, tipo, gasto_reais }], já filtradas pelo
// período no banco. Os 7 cartões de tipo saem SEMPRE, com zeros, para a
// grade da aba não pular de lugar entre um período e outro.
export function montarPlacar({ linhas = [], periodo, reguaAlteradaEm = null, manuaisLigadas = true } = {}) {
  const geral = cartaoVazio('argo', 'argo', null);
  const manual = cartaoVazio('manual', 'manual', null);
  const porTipo = new Map(TIPOS_PLACAR.map((t) => [t, cartaoVazio(t, 'argo', t)]));
  for (const linha of linhas) {
    if (!SITUACOES_CONCLUSIVAS.includes(linha.situacao)) continue;
    if (linha.origem === 'manual') {
      somar(manual, linha);
      continue;
    }
    somar(geral, linha);
    const cartao = porTipo.get(linha.tipo);
    if (cartao) somar(cartao, linha);
  }
  let alterada = null;
  if (reguaAlteradaEm && periodo) {
    const ms = new Date(reguaAlteradaEm).getTime();
    const ymd = Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
    if (ymd && ymd >= periodo.de && ymd <= periodo.ate) alterada = new Date(ms).toISOString();
  }
  return {
    periodo,
    regua_alterada_em: alterada,
    manuais_ligadas: manuaisLigadas === true,
    cartoes: [fecharTaxa(geral), ...[...porTipo.values()].map(fecharTaxa), fecharTaxa(manual)],
  };
}

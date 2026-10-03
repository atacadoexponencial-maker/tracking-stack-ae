// Motor dos fluxos (spec-email-proprio.md, módulo 9; issue 386).
//
// Cada rodada (a cada minuto):
//   1. coleta os acontecimentos novos (_email-acontecimentos.js);
//   2. para cada acontecimento novo: entra quem disparou um gatilho de fluxo
//      ativo DEPOIS da publicação; pula para o objetivo quem já estava dentro;
//      solta quem esperava aquele acontecimento;
//   3. solta as esperas vencidas e as de "abriu/clicou" que já aconteceram;
//   4. tira quem deixou de ser contato ativo (descadastrou, voltou, spam);
//   5. faz andar quem está andando, cartão por cartão, até uma espera.
//
// Só contatos de marketing ATIVOS entram (consentimento). Quem já esteve num
// fluxo nunca entra de novo nele. Cada pessoa é reservada antes de andar:
// duas rodadas juntas não mandam nada duas vezes.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { coletar, coletarSegmentos, casaFiltros } from './_email-acontecimentos.js';
import { lerConfig } from './_email-config.js';
import { montarEmail } from './_email-render.js';
import { enviarERegistrar } from './_email-envio.js';
import { usoDoMes } from './_email-campanhas.js';
import { sqlDasRegras } from './_email-segmentos.js';
import { inicioDoDiaBrt, ymdBrt } from './_data-brt.js';

const agora = () => Math.floor(Date.now() / 1000);
const MAX_PASSOS = 50;
const RESERVA_SEG = 600;
const MAX_TENTATIVAS = 3;
const ACONTECIMENTOS_POR_RODADA = 500;

// ---------------------------------------------------------------------------
// Fluxos ativos (versão publicada)
// ---------------------------------------------------------------------------

async function fluxosAtivos(env) {
  const r = (await env.DB.prepare("SELECT id, nome, situacao, publicado_json, publicado_em FROM email_fluxos WHERE situacao = 'ativo' AND arquivado = 0 AND publicado_json IS NOT NULL").all()).results || [];
  return r.map((f) => ({ ...f, grafo: JSON.parse(f.publicado_json) }));
}

async function lerFluxoPublicado(env, id) {
  const f = await env.DB.prepare('SELECT id, nome, situacao, arquivado, publicado_json, publicado_em FROM email_fluxos WHERE id = ?').bind(Number(id)).first();
  return f && f.publicado_json ? { ...f, grafo: JSON.parse(f.publicado_json) } : null;
}

const noDe = (grafo, id) => grafo.nos.find((n) => n.id === id);
const proximo = (grafo, de, saida) => (grafo.arestas.find((a) => a.de === de && a.saida === saida) || {}).para || null;

async function passo(env, pessoa, tipo, { no = null, saida = null, envioId = null, detalhe = null, t }) {
  await env.DB.prepare('INSERT INTO email_fluxo_passos (pessoa_id, fluxo_id, no_id, tipo, saida, envio_id, detalhe, em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(pessoa.id, pessoa.fluxo_id, no, tipo, saida, envioId, detalhe, t).run();
}

async function atualizar(env, pessoa, campos, t) {
  const chaves = Object.keys(campos);
  await env.DB.prepare(`UPDATE email_fluxo_pessoas SET ${chaves.map((k) => `${k} = ?`).join(', ')}, atualizado_em = ? WHERE id = ?`)
    .bind(...chaves.map((k) => campos[k]), t, pessoa.id).run();
  Object.assign(pessoa, campos);
}

// ---------------------------------------------------------------------------
// Entrada e saída
// ---------------------------------------------------------------------------

/** Coloca o contato no início do fluxo, se ele nunca esteve nele. Devolve true se entrou. */
export async function entrar(env, fluxo, contatoId, motivo, t = agora()) {
  const ini = fluxo.grafo.nos.find((n) => n.tipo === 'inicio');
  const r = await env.DB.prepare(
    "INSERT OR IGNORE INTO email_fluxo_pessoas (fluxo_id, contato_id, no_atual, situacao, entrou_em, atualizado_em) VALUES (?, ?, ?, 'andando', ?, ?)",
  ).bind(fluxo.id, contatoId, ini.id, t, t).run();
  if (r.meta.changes !== 1) return false;
  await passo(env, { id: r.meta.last_row_id, fluxo_id: fluxo.id }, 'entrou', { no: ini.id, detalhe: motivo, t });
  return true;
}

async function sair(env, pessoa, motivo, t) {
  await atualizar(env, pessoa, { situacao: 'saiu', motivo_saida: motivo, espera_ate: null, espera_json: null, reservado_em: null }, t);
  await passo(env, pessoa, 'saiu', { no: pessoa.no_atual, detalhe: motivo, t });
}

/** Saída manual pela equipe. */
export async function tirarManual(env, fluxoId, contatoId, t = agora()) {
  const p = await env.DB.prepare("SELECT * FROM email_fluxo_pessoas WHERE fluxo_id = ? AND contato_id = ? AND situacao IN ('andando', 'esperando')")
    .bind(Number(fluxoId), Number(contatoId)).first();
  if (!p) return false;
  await sair(env, p, 'Tirado do fluxo pela equipe.', t);
  return true;
}

const MOTIVO_INATIVO = { descadastrado: 'Descadastrou-se do marketing.', voltou: 'O e-mail voltou (endereço não existe).', denunciou: 'Marcou um e-mail como spam.', invalido: 'Endereço inválido.' };

async function sairInativos(env, t) {
  const r = (await env.DB.prepare(
    `SELECT p.*, c.situacao AS contato_situacao FROM email_fluxo_pessoas p JOIN email_contatos c ON c.id = p.contato_id
      WHERE p.situacao IN ('andando', 'esperando') AND c.situacao <> 'ativo'`,
  ).all()).results || [];
  for (const p of r) await sair(env, p, MOTIVO_INATIVO[p.contato_situacao] || 'Deixou de ser contato ativo.', t);
  return r.length;
}

// ---------------------------------------------------------------------------
// Datas: espera até dia e hora, janela de envio (horário de Brasília)
// ---------------------------------------------------------------------------

const hm = (txt) => { const [h, m] = String(txt || '00:00').split(':').map(Number); return (h || 0) * 3600 + (m || 0) * 60; };
const diaSemanaBrt = (t) => new Date((t - 3 * 3600) * 1000).getUTCDay();

/** Próxima vez do dia da semana (0 = domingo) e hora, depois de t. */
export function proximoDiaHora(t, dia, hora) {
  const hoje0 = inicioDoDiaBrt(ymdBrt(t));
  for (let i = 0; i <= 7; i++) {
    const zero = hoje0 + i * 86400;
    const quando = zero + hm(hora);
    if (diaSemanaBrt(zero + 3600) === Number(dia) && quando > t) return quando;
  }
  return hoje0 + 7 * 86400 + hm(hora);
}

/** Leva o horário para dentro da janela (ex.: 08:00–20:00); fora dela, vai para o próximo começo. */
export function dentroDaJanela(t, janela) {
  if (!janela || !janela.ligada) return t;
  const zero = inicioDoDiaBrt(ymdBrt(t));
  const de = zero + hm(janela.de), ate = zero + hm(janela.ate);
  if (t >= de && t <= ate) return t;
  return t < de ? de : de + 86400;
}

const duracao = (qtd, unidade) => Number(qtd || 1) * (unidade === 'horas' ? 3600 : 86400);

// ---------------------------------------------------------------------------
// Condições
// ---------------------------------------------------------------------------

/** Envio do e-mail (cartão `ref`) para esta pessoa, ou null. */
async function envioDoCartao(env, pessoa, ref) {
  return env.DB.prepare(
    `SELECT e.* FROM email_fluxo_passos p JOIN email_envios e ON e.id = p.envio_id
      WHERE p.pessoa_id = ? AND p.no_id = ? AND p.tipo = 'email' ORDER BY p.id DESC LIMIT 1`,
  ).bind(pessoa.id, ref).first();
}

async function abriuOuClicou(env, pessoa, tipo, ref, link = '') {
  const e = await envioDoCartao(env, pessoa, ref);
  if (!e) return false;
  if (tipo === 'abriu') return !!e.aberto_em;
  if (!e.clicado_em) return false;
  if (!link) return true;
  const c = await env.DB.prepare("SELECT 1 FROM email_eventos WHERE envio_id = ? AND tipo = 'clicado' AND json_extract(detalhe_json, '$.link') LIKE ?")
    .bind(e.id, `%${link}%`).first();
  return !!c;
}

/** O contato teve este acontecimento (com o filtro), em qualquer momento? */
async function teveAcontecimento(env, email, evento, filtros) {
  const r = (await env.DB.prepare('SELECT dados_json FROM email_acontecimentos WHERE email = ? AND tipo = ?').bind(email, evento).all()).results || [];
  return r.some((x) => casaFiltros(JSON.parse(x.dados_json || '{}'), filtros));
}

const EVENTOS_FILTRO = {
  formulario: 'funil', aplicacao: 'formulario', material: 'material', compra: 'produto', agendou: 'tipo', cancelou: 'tipo', faltou: 'tipo',
  compareceu: 'tipo', grupo_entrou: 'grupo', grupo_saiu: 'grupo', crm: 'estagio', site: 'pagina', segmento: 'segmento', campanha: 'campanha',
};
const filtroUnico = (evento, valor) => (valor ? [{ campo: EVENTOS_FILTRO[evento], valor }] : []);

async function condicao(env, pessoa, contato, c) {
  if (c.tipo === 'abriu' || c.tipo === 'clicou') return abriuOuClicou(env, pessoa, c.tipo, c.ref, c.link);
  if (c.tipo === 'evento') return teveAcontecimento(env, contato.email, c.evento, filtroUnico(c.evento, c.valor));
  if (c.tipo === 'segmento') {
    const s = await env.DB.prepare('SELECT regras_json FROM email_segmentos WHERE id = ?').bind(Number(c.valor)).first();
    if (!s) return false;
    const q = sqlDasRegras(JSON.parse(s.regras_json || '[]'));
    return !!(await env.DB.prepare(`${q.antes} SELECT 1 AS ok FROM ${q.de} WHERE ${q.onde} AND c.id = ?`).bind(...q.binds, contato.id).first());
  }
  return false;
}

// ---------------------------------------------------------------------------
// Andar
// ---------------------------------------------------------------------------

function valoresDoContato(c) {
  const nome = String(c.nome || '').trim();
  return { nome, primeiro_nome: nome.split(/\s+/)[0] || '', email: c.email, funil: c.funil || '' };
}

/**
 * Executa o cartão atual. Devolve:
 *   { seguir: saida }   segue pela saída
 *   { parar: true }     a pessoa fica (espera, segurando envio, concluiu, saiu)
 */
async function executar(env, ctx, pessoa, fluxo, contato, n, t) {
  const d = n.dados;
  switch (n.tipo) {
    case 'inicio': return { seguir: 'proximo' };
    case 'email': {
      if (ctx.cfg.marketing_liberado !== '1') return { parar: true }; // segura até liberar
      if (ctx.uso.restam <= 0) return { parar: true };                // segura até o limite renovar
      const modelo = await env.DB.prepare('SELECT * FROM email_modelos WHERE id = ?').bind(Number(d.modelo)).first();
      if (!modelo || !modelo.assunto || !modelo.corpo) {
        await passo(env, pessoa, 'email', { no: n.id, detalhe: 'Modelo indisponível: e-mail não enviado.', t });
        return { seguir: 'proximo' };
      }
      const e = montarEmail(modelo, ctx.cfg, { valores: valoresDoContato(contato) });
      const r = await enviarERegistrar(env, {
        canal: 'marketing', origem: 'fluxo', refId: `${fluxo.id}:${n.id}`, para: contato.email,
        assunto: e.assunto, html: e.html, texto: e.texto, tag: `fluxo-${fluxo.id}`, cfg: ctx.cfg,
      });
      if (r.semResposta) {
        const tentativas = (pessoa.tentativas || 0) + 1;
        if (tentativas < MAX_TENTATIVAS) { await atualizar(env, pessoa, { tentativas }, t); return { parar: true }; }
        await passo(env, pessoa, 'email', { no: n.id, detalhe: 'O serviço de envio não respondeu em três tentativas.', t });
        await atualizar(env, pessoa, { tentativas: 0 }, t);
        return { seguir: 'proximo' };
      }
      ctx.uso.restam--;
      await passo(env, pessoa, 'email', { no: n.id, envioId: r.envioId, detalhe: r.ok ? null : r.erro, t });
      if (pessoa.tentativas) await atualizar(env, pessoa, { tentativas: 0 }, t);
      return { seguir: 'proximo' };
    }
    case 'espera': {
      let ate;
      let espera = { modo: d.modo, janela: d.janela };
      if (d.modo === 'tempo') ate = dentroDaJanela(t + duracao(d.qtd, d.unidade), d.janela);
      else if (d.modo === 'dia') ate = dentroDaJanela(proximoDiaHora(t, d.dia, d.hora), d.janela);
      else {
        ate = t + duracao(d.prazo, d.unidade);
        espera = { ...espera, evento: d.evento, ref: d.ref, valor: d.valor || '', desde: t };
      }
      await atualizar(env, pessoa, { situacao: 'esperando', espera_ate: ate, espera_json: JSON.stringify(espera) }, t);
      await passo(env, pessoa, 'espera', { no: n.id, detalhe: `até ${ate}`, t });
      return { parar: true };
    }
    case 'desvio': {
      const resultados = [];
      for (const c of d.condicoes || []) resultados.push(await condicao(env, pessoa, contato, c));
      const sim = d.juncao === 'ou' ? resultados.some(Boolean) : resultados.every(Boolean);
      await passo(env, pessoa, 'desvio', { no: n.id, saida: sim ? 'sim' : 'nao', t });
      return { seguir: sim ? 'sim' : 'nao' };
    }
    case 'objetivo':
      await passo(env, pessoa, 'objetivo', { no: n.id, t });
      return { seguir: 'proximo' };
    case 'ir_fluxo': {
      const destino = await lerFluxoPublicado(env, d.fluxo);
      if (!destino || destino.situacao !== 'ativo' || destino.arquivado) {
        await sair(env, pessoa, 'O fluxo de destino não está ativo.', t);
        return { parar: true };
      }
      const entrou = await entrar(env, destino, contato.id, `Veio do fluxo "${fluxo.nome}".`, t);
      await passo(env, pessoa, 'ir_fluxo', { no: n.id, detalhe: entrou ? `Foi para "${destino.nome}".` : `Já tinha passado por "${destino.nome}".`, t });
      await atualizar(env, pessoa, { situacao: 'saiu', motivo_saida: `Foi para o fluxo "${destino.nome}".`, reservado_em: null }, t);
      return { parar: true };
    }
    case 'fim':
      await passo(env, pessoa, 'fim', { no: n.id, t });
      await atualizar(env, pessoa, { situacao: 'concluiu', espera_ate: null, espera_json: null, reservado_em: null }, t);
      return { parar: true };
    default:
      return { parar: true };
  }
}

async function reservar(env, pessoa, t) {
  const r = await env.DB.prepare('UPDATE email_fluxo_pessoas SET reservado_em = ? WHERE id = ? AND (reservado_em IS NULL OR reservado_em < ?)')
    .bind(t, pessoa.id, t - RESERVA_SEG).run();
  return r.meta.changes === 1;
}

/** Anda até uma espera, um envio segurado, o fim ou o limite de passos. */
async function andar(env, ctx, pessoa, t) {
  if (!(await reservar(env, pessoa, t))) return;
  try {
    const fluxo = ctx.fluxos.get(pessoa.fluxo_id);
    if (!fluxo) return;
    const contato = await env.DB.prepare('SELECT * FROM email_contatos WHERE id = ?').bind(pessoa.contato_id).first();
    if (!contato || contato.situacao !== 'ativo') { await sair(env, pessoa, MOTIVO_INATIVO[contato?.situacao] || 'Deixou de ser contato ativo.', t); return; }
    for (let i = 0; i < MAX_PASSOS && pessoa.situacao === 'andando'; i++) {
      const n = noDe(fluxo.grafo, pessoa.no_atual);
      if (!n) { await sair(env, pessoa, 'O cartão em que estava não existe mais.', t); return; }
      const r = await executar(env, ctx, pessoa, fluxo, contato, n, t);
      if (r.parar) return;
      const seguinte = proximo(fluxo.grafo, n.id, r.seguir);
      if (!seguinte) { await atualizar(env, pessoa, { situacao: 'concluiu' }, t); await passo(env, pessoa, 'fim', { no: n.id, detalhe: 'Saída sem destino.', t }); return; }
      await atualizar(env, pessoa, { no_atual: seguinte }, t);
    }
  } finally {
    await env.DB.prepare('UPDATE email_fluxo_pessoas SET reservado_em = NULL WHERE id = ?').bind(pessoa.id).run();
  }
}

/** Solta a espera: segue pela saída (dentro da janela, se houver). */
async function soltar(env, pessoa, fluxo, saida, t) {
  const espera = JSON.parse(pessoa.espera_json || '{}');
  const quando = dentroDaJanela(t, espera.janela);
  if (quando > t) {
    // Aconteceu fora da janela: sai no começo da próxima, pela saída certa.
    await atualizar(env, pessoa, { espera_ate: quando, espera_json: JSON.stringify({ ...espera, saida }) }, t);
    return;
  }
  const seguinte = proximo(fluxo.grafo, pessoa.no_atual, saida);
  await passo(env, pessoa, 'espera', { no: pessoa.no_atual, saida, detalhe: 'soltou', t });
  if (!seguinte) { await atualizar(env, pessoa, { situacao: 'concluiu', espera_ate: null, espera_json: null }, t); return; }
  await atualizar(env, pessoa, { situacao: 'andando', no_atual: seguinte, espera_ate: null, espera_json: null }, t);
}

async function soltarEsperas(env, ctx, t) {
  const ativos = [...ctx.fluxos.keys()];
  if (!ativos.length) return;
  const r = (await env.DB.prepare(
    `SELECT * FROM email_fluxo_pessoas WHERE situacao = 'esperando' AND fluxo_id IN (${ativos.map(() => '?').join(',')})`,
  ).bind(...ativos).all()).results || [];
  for (const p of r) {
    const fluxo = ctx.fluxos.get(p.fluxo_id);
    const espera = JSON.parse(p.espera_json || '{}');
    if (espera.saida) { if (p.espera_ate <= t) await soltar(env, p, fluxo, espera.saida, t); continue; }
    if (espera.modo === 'evento' && ['abriu', 'clicou'].includes(espera.evento) && await abriuOuClicou(env, p, espera.evento, espera.ref)) {
      await soltar(env, p, fluxo, 'aconteceu', t);
      continue;
    }
    if (p.espera_ate <= t) await soltar(env, p, fluxo, espera.modo === 'evento' ? 'nao_aconteceu' : 'proximo', t);
  }
}

// ---------------------------------------------------------------------------
// Acontecimentos novos: entrada, objetivo, espera "até acontecer"
// ---------------------------------------------------------------------------

async function tratarAcontecimentos(env, ctx, t) {
  const desde = Number((await env.DB.prepare("SELECT posicao FROM email_fluxo_cursores WHERE fonte = 'motor'").first())?.posicao || 0);
  const gravarPosicao = (id) => env.DB.prepare("INSERT INTO email_fluxo_cursores (fonte, posicao) VALUES ('motor', ?) ON CONFLICT(fonte) DO UPDATE SET posicao = excluded.posicao").bind(id).run();
  // Sem fluxo ativo não há o que fazer com os acontecimentos: só anda o cursor
  // (quem disparou antes da publicação nunca entra mesmo).
  if (!ctx.fluxos.size) {
    const m = (await env.DB.prepare('SELECT MAX(id) AS m FROM email_acontecimentos').first())?.m || 0;
    if (m > desde) await gravarPosicao(m);
    return 0;
  }
  const novos = (await env.DB.prepare('SELECT * FROM email_acontecimentos WHERE id > ? ORDER BY id LIMIT ?').bind(desde, ACONTECIMENTOS_POR_RODADA).all()).results || [];
  // Contatos ativos dos acontecimentos, numa leitura só.
  const emails = [...new Set(novos.map((a) => a.email).filter(Boolean))];
  const ativos = new Map();
  for (let i = 0; i < emails.length; i += 90) {
    const parte = emails.slice(i, i + 90);
    for (const c of (await env.DB.prepare(`SELECT id, email, situacao FROM email_contatos WHERE situacao = 'ativo' AND email IN (${parte.map(() => '?').join(',')})`).bind(...parte).all()).results || []) ativos.set(c.email, c);
  }
  let entradas = 0;
  for (const a of novos) {
    const contato = a.email ? ativos.get(a.email) : null;
    if (!contato) continue;
    const dados = JSON.parse(a.dados_json || '{}');
    for (const fluxo of ctx.fluxos.values()) {
      // Entrada: gatilho do início, só o que aconteceu depois de publicar.
      const ini = fluxo.grafo.nos.find((n) => n.tipo === 'inicio');
      if (a.quando >= fluxo.publicado_em && ini.dados.gatilhos.some((g) => g.evento === a.tipo && casaFiltros(dados, g.filtros))) {
        if (await entrar(env, fluxo, contato.id, `Gatilho: ${a.tipo}.`, t)) entradas++;
      }
      const p = await env.DB.prepare("SELECT * FROM email_fluxo_pessoas WHERE fluxo_id = ? AND contato_id = ? AND situacao IN ('andando', 'esperando')").bind(fluxo.id, contato.id).first();
      if (!p) continue;
      // Objetivo: pula para ele, de onde estiver (se ainda não passou por ele).
      const objetivo = fluxo.grafo.nos.find((n) => n.tipo === 'objetivo' && n.dados.evento === a.tipo && casaFiltros(dados, filtroUnico(a.tipo, n.dados.filtro)));
      if (objetivo && p.no_atual !== objetivo.id) {
        const ja = await env.DB.prepare("SELECT 1 FROM email_fluxo_passos WHERE pessoa_id = ? AND no_id = ? AND tipo = 'objetivo'").bind(p.id, objetivo.id).first();
        if (!ja) {
          await passo(env, p, 'objetivo', { no: objetivo.id, detalhe: 'Pulou para o objetivo.', t });
          await atualizar(env, p, { situacao: 'andando', no_atual: proximo(fluxo.grafo, objetivo.id, 'proximo') || objetivo.id, espera_ate: null, espera_json: null }, t);
          if (!proximo(fluxo.grafo, objetivo.id, 'proximo')) await atualizar(env, p, { situacao: 'concluiu' }, t);
          continue;
        }
      }
      // Espera "até algo acontecer" com este acontecimento.
      if (p.situacao === 'esperando') {
        const espera = JSON.parse(p.espera_json || '{}');
        if (espera.modo === 'evento' && espera.evento === a.tipo && a.quando >= (espera.desde || 0) && casaFiltros(dados, filtroUnico(a.tipo, espera.valor))) {
          await soltar(env, p, fluxo, 'aconteceu', t);
        }
      }
    }
  }
  if (novos.length) await gravarPosicao(novos[novos.length - 1].id);
  return entradas;
}

// ---------------------------------------------------------------------------
// Rodada
// ---------------------------------------------------------------------------

export async function rodar(env, t = agora()) {
  const coleta = await coletar(env);
  const fluxos = await fluxosAtivos(env);
  const segmentos = new Set();
  for (const f of fluxos) for (const g of f.grafo.nos.find((n) => n.tipo === 'inicio').dados.gatilhos) {
    if (g.evento === 'segmento') g.filtros.forEach((x) => x.campo === 'segmento' && x.valor && segmentos.add(x.valor));
  }
  const novosSegmento = segmentos.size ? await coletarSegmentos(env, [...segmentos], t) : 0;
  const ctx = { fluxos: new Map(fluxos.map((f) => [f.id, f])), cfg: await lerConfig(env), uso: await usoDoMes(env, t) };
  const entradas = await tratarAcontecimentos(env, ctx, t);
  await soltarEsperas(env, ctx, t);
  const sairam = await sairInativos(env, t);
  let andaram = 0;
  if (ctx.fluxos.size) {
    // Quem chega por "ir para outro fluxo" também anda nesta rodada (até 3 voltas).
    const ids = [...ctx.fluxos.keys()];
    const feitos = new Set();
    for (let volta = 0; volta < 3 && andaram < 200; volta++) {
      const andando = ((await env.DB.prepare(
        `SELECT * FROM email_fluxo_pessoas WHERE situacao = 'andando' AND fluxo_id IN (${ids.map(() => '?').join(',')}) ORDER BY atualizado_em LIMIT 200`,
      ).bind(...ids).all()).results || []).filter((p) => !feitos.has(p.id));
      if (!andando.length) break;
      for (const p of andando) { feitos.add(p.id); await andar(env, ctx, p, t); andaram++; }
    }
  }
  return { coleta, novos_segmento: novosSegmento, entradas, sairam, andaram };
}

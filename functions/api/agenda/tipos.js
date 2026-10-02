// GET  /api/agenda/tipos?key=...  → tipos + opções do formulário (agendas, grades, funis)
// POST /api/agenda/tipos?key=...  → { acao: 'salvar', id?, ...campos }
//                                   { acao: 'duplicar' | 'pausar' | 'reativar' | 'excluir', id }
//
// Spec spec-agenda-propria.md, módulo 3 (issue 359). Validação em
// ../_agenda-regras.js. Editar um tipo vale para agendamentos novos; as
// reuniões já marcadas guardam o próprio horário e não mudam.
import { validarTipo, tipoDaLinha, resumoGrade } from '../_agenda-regras.js';
import { FUNIL_POR_PAGINA } from '../_funil-paginas.js';
import { criarConvite } from '../_agenda-convite.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const agora = () => Math.floor(Date.now() / 1000);

export const FUNIS = [...new Set(FUNIL_POR_PAGINA.values())];

const CAMPOS = [
  'slug', 'nome', 'duracao_min', 'destino_cal', 'conflito_cals_json', 'grade_id', 'folga_antes_min',
  'folga_depois_min', 'antecedencia_min', 'janela_dias', 'limite_dia', 'intervalo_min', 'perguntas_json',
  'titulo_modelo', 'comercial', 'funil', 'pagina_pos', 'contato_alternativo',
];

async function listar(env) {
  const t = agora();
  const tipos = (await env.DB.prepare('SELECT * FROM agenda_tipos ORDER BY nome').all()).results || [];
  const futuros = (await env.DB.prepare(
    "SELECT tipo_id, COUNT(*) AS n FROM agenda_reunioes WHERE inicio > ? AND situacao IN ('marcada','remarcada') GROUP BY tipo_id",
  ).bind(t).all()).results || [];
  const porTipo = new Map(futuros.map((f) => [f.tipo_id, f.n]));
  const cals = (await env.DB.prepare('SELECT id, nome, conta_email, conflito FROM agenda_calendarios ORDER BY nome').all()).results || [];
  const grades = (await env.DB.prepare('SELECT id, nome, faixas_json FROM agenda_grades ORDER BY nome').all()).results || [];
  return {
    tipos: tipos.map((l) => ({ ...tipoDaLinha(l), futuros: porTipo.get(l.id) || 0 })),
    opcoes: {
      agendas: cals.map((c) => ({ id: c.id, nome: c.nome, conta: c.conta_email, conflito: !!c.conflito })),
      grades: grades.map((g) => ({ id: g.id, nome: g.nome, resumo: resumoGrade(JSON.parse(g.faixas_json || '{}')) })),
      funis: FUNIS,
    },
  };
}

async function contexto(env) {
  const cals = (await env.DB.prepare('SELECT id FROM agenda_calendarios').all()).results || [];
  const grades = (await env.DB.prepare('SELECT id FROM agenda_grades').all()).results || [];
  return {
    calendarios: new Set(cals.map((c) => c.id)),
    grades: new Set(grades.map((g) => g.id)),
    funis: new Set(FUNIS),
  };
}

export async function onRequestGet({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  return json(await listar(env));
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  const id = corpo.id ? Number(corpo.id) : null;
  const t = agora();

  if (corpo.acao === 'salvar') {
    const v = validarTipo(corpo, await contexto(env));
    if (v.erro) return json({ error: v.erro }, 400);
    const dup = await env.DB.prepare('SELECT id FROM agenda_tipos WHERE slug = ? AND id != ?').bind(v.tipo.slug, id || 0).first();
    if (dup) return json({ error: `Já existe um tipo com o endereço /agendar/${v.tipo.slug}.` }, 409);
    const valores = CAMPOS.map((c) => v.tipo[c] ?? null);
    if (id) {
      const r = await env.DB.prepare(
        `UPDATE agenda_tipos SET ${CAMPOS.map((c) => `${c} = ?`).join(', ')}, atualizado_em = ? WHERE id = ?`,
      ).bind(...valores, t, id).run();
      if (!r.meta.changes) return json({ error: 'Tipo não encontrado.' }, 404);
    } else {
      await env.DB.prepare(
        `INSERT INTO agenda_tipos (${CAMPOS.join(', ')}, ativo, criado_em, atualizado_em)
         VALUES (${CAMPOS.map(() => '?').join(', ')}, 1, ?, ?)`,
      ).bind(...valores, t, t).run();
    }
    return json(await listar(env));
  }

  const linha = id ? await env.DB.prepare('SELECT * FROM agenda_tipos WHERE id = ?').bind(id).first() : null;
  if (!linha) return json({ error: 'Tipo não encontrado.' }, 404);

  // Pré-visualizar como o lead vê: tipo comercial só abre com convite, então a
  // equipe recebe um convite de teste (e-mail @seteads.com = marcado como
  // teste, fora das Reuniões agendadas). Vale também com o tipo pausado? Não:
  // pausado mostra "agenda indisponível", que é justamente o que o lead veria.
  if (corpo.acao === 'previa') {
    const tipo = tipoDaLinha(linha);
    if (!tipo.comercial) return json({ url: `/agendar/${tipo.slug}` });
    const token = await criarConvite(env, tipo, {
      nome: 'Teste da equipe', email: 'teste@seteads.com', telefone: '11999999999', funil: tipo.funil,
    });
    return json({ url: `/agendar/${tipo.slug}?c=${encodeURIComponent(token)}` });
  }

  if (corpo.acao === 'duplicar') {
    let slug = `${linha.slug}-copia`;
    for (let i = 2; await env.DB.prepare('SELECT 1 FROM agenda_tipos WHERE slug = ?').bind(slug).first(); i++) slug = `${linha.slug}-copia-${i}`;
    // A cópia nasce PAUSADA: duas páginas ativas para o mesmo funil fariam o
    // formulário escolher uma delas sem a equipe perceber.
    const valores = CAMPOS.map((c) => (c === 'slug' ? slug : c === 'nome' ? `${linha.nome} (cópia)` : linha[c]));
    await env.DB.prepare(
      `INSERT INTO agenda_tipos (${CAMPOS.join(', ')}, ativo, criado_em, atualizado_em)
       VALUES (${CAMPOS.map(() => '?').join(', ')}, 0, ?, ?)`,
    ).bind(...valores, t, t).run();
    return json(await listar(env));
  }

  if (corpo.acao === 'pausar' || corpo.acao === 'reativar') {
    await env.DB.prepare('UPDATE agenda_tipos SET ativo = ?, atualizado_em = ? WHERE id = ?')
      .bind(corpo.acao === 'reativar' ? 1 : 0, t, id).run();
    return json(await listar(env));
  }

  if (corpo.acao === 'excluir') {
    const futura = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM agenda_reunioes WHERE tipo_id = ? AND inicio > ? AND situacao IN ('marcada','remarcada')",
    ).bind(id, t).first();
    if (futura && futura.n > 0) return json({ error: `Este tipo tem ${futura.n} reunião(ões) futura(s). Pause em vez de excluir, ou cancele as reuniões antes.` }, 409);
    const usado = await env.DB.prepare('SELECT 1 FROM agenda_reunioes WHERE tipo_id = ? LIMIT 1').bind(id).first();
    if (usado) {
      // Tipo com histórico não some do banco (as reuniões antigas apontam para
      // ele); sai da lista ficando pausado e com o endereço liberado.
      await env.DB.prepare("UPDATE agenda_tipos SET ativo = 0, slug = slug || '-excluido-' || id, nome = nome || ' (excluído)', atualizado_em = ? WHERE id = ?").bind(t, id).run();
    } else {
      await env.DB.prepare('DELETE FROM agenda_convites WHERE tipo_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM agenda_tipos WHERE id = ?').bind(id).run();
    }
    return json(await listar(env));
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}

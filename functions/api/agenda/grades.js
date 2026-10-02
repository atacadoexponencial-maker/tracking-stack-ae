// GET  /api/agenda/grades?key=...  → grades com resumo e quantos tipos usam cada uma
// POST /api/agenda/grades?key=...  → { acao: 'salvar', id?, nome, faixas, datas }
//                                    { acao: 'duplicar', id }
//                                    { acao: 'excluir', id }
//
// Spec spec-agenda-propria.md, módulo 2 (issue 359). A validação mora em
// ../_agenda-regras.js; a tela só coleta e exibe.
import { validarGrade, resumoGrade } from '../_agenda-regras.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const agora = () => Math.floor(Date.now() / 1000);

async function listar(env) {
  const grades = (await env.DB.prepare('SELECT * FROM agenda_grades ORDER BY nome').all()).results || [];
  const usos = (await env.DB.prepare('SELECT grade_id, COUNT(*) AS n FROM agenda_tipos GROUP BY grade_id').all()).results || [];
  const porGrade = new Map(usos.map((u) => [u.grade_id, u.n]));
  return {
    grades: grades.map((g) => {
      const faixas = JSON.parse(g.faixas_json || '{}');
      return {
        id: g.id, nome: g.nome, faixas, datas: JSON.parse(g.datas_json || '{}'),
        resumo: resumoGrade(faixas), tipos: porGrade.get(g.id) || 0,
      };
    }),
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
    const v = validarGrade(corpo);
    if (v.erro) return json({ error: v.erro }, 400);
    const { nome, faixas, datas } = v.grade;
    if (id) {
      const r = await env.DB.prepare('UPDATE agenda_grades SET nome = ?, faixas_json = ?, datas_json = ?, atualizado_em = ? WHERE id = ?')
        .bind(nome, JSON.stringify(faixas), JSON.stringify(datas), t, id).run();
      if (!r.meta.changes) return json({ error: 'Grade não encontrada.' }, 404);
    } else {
      await env.DB.prepare('INSERT INTO agenda_grades (nome, faixas_json, datas_json, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
        .bind(nome, JSON.stringify(faixas), JSON.stringify(datas), t, t).run();
    }
    return json(await listar(env));
  }

  if (corpo.acao === 'duplicar') {
    const g = await env.DB.prepare('SELECT * FROM agenda_grades WHERE id = ?').bind(id).first();
    if (!g) return json({ error: 'Grade não encontrada.' }, 404);
    await env.DB.prepare('INSERT INTO agenda_grades (nome, faixas_json, datas_json, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
      .bind(`${g.nome} (cópia)`, g.faixas_json, g.datas_json, t, t).run();
    return json(await listar(env));
  }

  if (corpo.acao === 'excluir') {
    const uso = await env.DB.prepare('SELECT nome FROM agenda_tipos WHERE grade_id = ? LIMIT 1').bind(id).first();
    if (uso) return json({ error: `O tipo "${uso.nome}" usa esta grade. Troque a grade do tipo antes de excluir.` }, 409);
    await env.DB.prepare('DELETE FROM agenda_grades WHERE id = ?').bind(id).run();
    return json(await listar(env));
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}

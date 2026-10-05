// POST /api/argo/relatorio-agendado
// Autenticação: `Authorization: Bearer <ARGO_KEY>` (ver `_argo-auth.js`).
//
// Issue 406. Chamado pelo job do Argo na VPS toda segunda às 07h
// (`gestor-ae/profiles/gestor-ia/scripts/argo_relatorio_semanal.py`): gera o
// relatório da semana que terminou ontem e devolve a mensagem curta que o
// Hermes entrega no canal dos monitores. O tracking não tem webhook do Slack;
// o caminho é o mesmo dos outros monitores do Argo.
import { conectar } from '../_argo-db.js';
import { recusarSemChaveArgo } from '../_argo-auth.js';
import { hojeBrt } from '../_argo-contexto.js';
import { gerarRelatorio, textoSlack } from '../_argo-relatorio-gerar.js';

export async function onRequestPost({ request, env }) {
  const recusa = recusarSemChaveArgo(request, env);
  if (recusa) return recusa;
  const link = `${new URL(request.url).origin}/dash/#argo?v=relatorio`;
  try {
    const rel = await gerarRelatorio(env, conectar(env), { origem: 'agendado', hoje: hojeBrt() });
    return Response.json({ id: rel.id, situacao: rel.situacao, texto: textoSlack(rel, link) });
  } catch {
    return Response.json({ situacao: 'falhou', texto: `*Relatório semanal do Argo*: não foi gerado (erro ao falar com o banco).\n${link}` }, { status: 500 });
  }
}

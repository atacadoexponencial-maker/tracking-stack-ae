// Contagem de visitas, inícios de formulário e leads por teste A/B e variante.
//
// Saiu de dentro de `ab-tests.js` (issue 404) para o registro de testes do
// Argo ler o MESMO número que a aba "Testes A/B" mostra: duas cópias desta
// consulta divergiriam na primeira correção.
//
// Agregado em SQL, não no navegador: a tabela de exposições cresce com o
// tráfego.
//
// Sessões de preview ficam fora, e os bots também — eles são sorteados como
// qualquer visitante (o middleware não os distingue no instante da
// requisição), então a filtragem só pode acontecer aqui, na leitura.
//
// `timestamp >= a.assigned_at` nos dois joins não é preciosismo: o cookie
// _krob_sid dura 400 dias, então "sessão" aqui é VISITANTE, não visita. Sem a
// amarra, quem converteu meses atrás na mesma página volta por um link de
// e-mail, é sorteado hoje e entra como convertido no primeiro dia — e o portão
// `faltamLeads`, que é a razão de existir da feature, seria satisfeito por
// conversões que não vieram do teste, com uma fração da amostra declarada.
import { clausulasBotSql, clausulasBotIpSql } from '../_bots.js';

/** Linhas `{ test_id, variante, visitas, form_starts, leads }`. `testId` opcional restringe a um teste. */
export async function contarExposicoesAb(db, testId = null) {
  const filtro = testId == null ? '' : 'AND a.test_id = ?';
  const stmt = db.prepare(`
    SELECT a.test_id,
           a.variante,
           COUNT(DISTINCT a.session_id) AS visitas,
           COUNT(DISTINCT CASE WHEN f.id IS NOT NULL THEN a.session_id END) AS form_starts,
           COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN a.session_id END) AS leads
    FROM ab_assignments a
    JOIN sessions s ON s.session_id = a.session_id
    LEFT JOIN event_log l
      ON l.session_id = a.session_id
     AND l.event_name = 'Lead' AND l.is_bot = 0 AND l.is_junk = 0
     AND l.timestamp >= a.assigned_at
    LEFT JOIN event_log f
      ON f.session_id = a.session_id
     AND f.event_name = 'FormStart' AND f.is_bot = 0 AND f.is_junk = 0
     AND f.timestamp >= a.assigned_at
    WHERE a.is_preview = 0
      AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
      ${clausulasBotSql('s')}
      ${clausulasBotIpSql('s')}
      ${filtro}
    GROUP BY a.test_id, a.variante
  `);
  const { results } = await (testId == null ? stmt : stmt.bind(testId)).all();
  return results || [];
}

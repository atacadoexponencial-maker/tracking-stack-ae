-- Cadastro inicial dos funis do relatório (spec-feedback-marketing.md, módulo 3).
--
-- Os quatro blocos do relatório atual, na ordem atual, para que nada mude no
-- dia da troca. Roda UMA vez só: se já houver qualquer funil na tabela
-- (inclusive arquivado), o WHERE NOT EXISTS não insere nada e não sobrescreve
-- nada.
--
-- Por que SE e AQUISIÇÃO dividem a opção SESSÃO ESTRATÉGICA: reproduz o
-- relatório atual, que conta SE só com utm_source de anúncio e manda o resto
-- desses cards para AQUISIÇÃO. Quem separa os dois é a origem do lead.
--
-- LIVE usa `lives-semanais-v1` (decisão 8): é para ele que a regra automática
-- resolve a campanha `..._lives-semanais`. WO PAGO não tem funil do tracking
-- (decisão 9): as campanhas do produto terminam no público, não no funil, e são
-- reconhecidas pelo trecho `workshop-pago`.
--
-- Ids das opções do campo "🔻 Funil" conferidos no ClickUp em 15/09/2026 — os
-- mesmos de functions/api/_clickup.js (CU_FUNIL_SESSAO, CU_FUNIL_LIVES,
-- CU_FUNIL_WO_PAGO).

INSERT INTO funis_relatorio
    (nome, tipo, funil_tracking, opcoes_crm, origem_lead, trecho_campanha,
     situacao, posicao, versao, criado_em, alterado_em)
SELECT column1, column2, column3, column4, column5, column6,
       'ativo', column7, 1, CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER)
FROM (VALUES
    ('SE', 'lead_mql', 'sessao-estrategica',
     '[{"id":"a158d342-c1ac-4705-a6da-ce39019f0a2a","nome":"SESSÃO ESTRATÉGICA"}]',
     'trafego_pago', NULL, 1),
    ('LIVE', 'manual', 'lives-semanais-v1',
     '[{"id":"e6893b0b-5a69-4f48-9c99-a3c0a415a118","nome":"LIVES SEMANAIS"}]',
     NULL, NULL, 2),
    ('WO PAGO', 'venda_greenn', NULL,
     '[{"id":"420877c7-44de-4d46-a934-718889443f49","nome":"WO PAGO"}]',
     NULL, 'workshop-pago', 3),
    ('AQUISIÇÃO', 'lead_mql', 'aquisicao',
     '[{"id":"a158d342-c1ac-4705-a6da-ce39019f0a2a","nome":"SESSÃO ESTRATÉGICA"}]',
     'exceto_trafego_pago', NULL, 4)
)
WHERE NOT EXISTS (SELECT 1 FROM funis_relatorio);

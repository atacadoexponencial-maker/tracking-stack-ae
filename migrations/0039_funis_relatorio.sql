-- Cadastro de funis do relatório de marketing (spec-feedback-marketing.md).
--
-- Cada linha ATIVA vira um bloco do relatório, na ordem de `posicao`. O que não
-- casa com nenhum funil ativo vai para o bloco "sem funil" — por isso nenhuma
-- regra de "funil padrão" mora aqui.
--
-- As regras de unicidade entre funis ativos (nome sem acento/caixa, funil do
-- tracking, opção do CRM combinada com a origem, trecho contido em outro, uma
-- só venda na Greenn) são validadas no servidor, em JS: dependem de
-- normalização e de sobreposição, que um UNIQUE não expressa. A venda única na
-- Greenn é a exceção: também tem índice único parcial (abaixo), para duas
-- gravações simultâneas não passarem juntas pela validação.

CREATE TABLE IF NOT EXISTS funis_relatorio (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Como o bloco aparece na mensagem (até 40 caracteres, sem espaços nas pontas).
    nome            TEXT NOT NULL,
    -- lead_mql = Lead do formulário + MQL; manual = contagem da equipe;
    -- venda_greenn = vendas pagas da Greenn.
    tipo            TEXT NOT NULL CHECK (tipo IN ('lead_mql', 'manual', 'venda_greenn')),
    -- Slug do funil do tracking (mesma lista da classificação manual da aba
    -- Meta Ads, mais 'aquisicao'). Obrigatório em lead_mql e manual; NULL em
    -- venda_greenn, que não tem funil no tracking — as campanhas do produto são
    -- reconhecidas pelo trecho do nome e pela classificação manual (decisão 9
    -- da spec). O CHECK fica no fim da tabela porque cruza duas colunas.
    funil_tracking  TEXT,
    -- Opções do campo "🔻 Funil" do CRM, em JSON: [{"id": "...", "nome": "..."}].
    -- O id é o que o card do ClickUp guarda; o nome fica para a tela conseguir
    -- dizer QUAL opção "não existe mais no CRM" depois que ela sumir de lá.
    opcoes_crm      TEXT NOT NULL,
    -- Só no tipo lead_mql; NULL nos demais (o valor é descartado ao salvar).
    origem_lead     TEXT CHECK (origem_lead IS NULL OR origem_lead IN ('trafego_pago', 'exceto_trafego_pago', 'qualquer')),
    -- Pedaço do nome da campanha que faz o investimento dela contar aqui. Opcional.
    trecho_campanha TEXT,
    situacao        TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'arquivado')),
    -- Ordem no relatório (1, 2, 3...). NULL quando arquivado: arquivar tira da ordem.
    posicao         INTEGER,
    -- Controle de concorrência: quem salva manda a versão que leu; se mudou,
    -- a gravação é recusada em vez de sobrescrever a alteração de outra pessoa.
    versao          INTEGER NOT NULL DEFAULT 1,
    criado_em       INTEGER NOT NULL,   -- unix seconds
    alterado_em     INTEGER NOT NULL,   -- unix seconds
    CHECK (
        (tipo = 'venda_greenn' AND funil_tracking IS NULL)
        OR (tipo IN ('lead_mql', 'manual') AND funil_tracking IS NOT NULL AND funil_tracking <> '')
    ),
    -- Origem preenchida se e somente se o tipo é lead_mql.
    CHECK ((tipo = 'lead_mql') = (origem_lead IS NOT NULL))
);

-- A aba lista ativos na ordem do relatório; o endpoint lê só os ativos.
CREATE INDEX IF NOT EXISTS idx_funis_relatorio_situacao_posicao ON funis_relatorio(situacao, posicao);

-- No máximo UM funil ativo de venda na Greenn (decisão 7 da spec). A validação
-- em JS dá a mensagem; o índice segura a corrida entre duas gravações.
CREATE UNIQUE INDEX IF NOT EXISTS idx_funis_relatorio_venda_greenn_ativo
ON funis_relatorio(tipo) WHERE tipo = 'venda_greenn' AND situacao = 'ativo';

-- Funil nunca é apagado — só arquivado —, para o histórico do cadastro
-- continuar legível. A garantia fica no banco, não só na ausência de botão.
CREATE TRIGGER IF NOT EXISTS trg_funis_relatorio_sem_delete
BEFORE DELETE ON funis_relatorio
BEGIN
    SELECT RAISE(ABORT, 'funis_relatorio: funil nunca é apagado, só arquivado');
END;

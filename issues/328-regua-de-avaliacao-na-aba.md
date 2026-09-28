# 328: Régua de avaliação editável na aba Argo

**Tipo:** Implementação
**Página:** Dash → aba Argo → configuração + `/api/argo/config` — spec `spec-argo-veredito-acoes.md`, módulo 6

## Descrição

Os números que decidem o veredito (janela, pisos por bloco, tolerância, limite de releitura, chave de mudanças manuais) passam a ser editados na aba Argo, junto dos outros campos da régua, e lidos pelos monitores na próxima rodada.

## Pronto quando

Na configuração da aba Argo aparecem os cinco campos novos com os valores atuais da Neon. Alterar a janela para 10 e salvar grava em `argo.config_conta.regua`, registra data e autora, e a próxima rodada usa 10 dias para as ações ainda não avaliadas. Vereditos já dados não mudam. Campo em branco ou inválido não salva e mostra o motivo.

## Cenários

### Happy Path
1. `/api/argo/config` devolve e valida `avaliacao_janela_dias` (inteiro 1–30), `avaliacao_piso_visita_centavos`, `avaliacao_piso_lead_multiplicador` (decimal > 0), `avaliacao_tolerancia_pct` (0–100), `avaliacao_limite_releitura_dias` (inteiro 0–30) e `avaliacao_manuais` (bool).
2. A aba mostra os campos na seção da régua, com os padrões quando a chave não existe.
3. Salvar grava só as chaves alteradas e `regua_atualizada_em/por`.
4. `_regua()` dos monitores e `argo_veredito` leem essas chaves via `regua_valor`/`regua_bool`, com os mesmos padrões da issue 326.

### Edge Cases
- Chave ausente na Neon: a aba mostra o padrão e o monitor usa o padrão (fonte única: a lista de padrões vive num só lugar por repo, espelhada em `_argo-regua.js` e `argo_estado`).
- Alterar a régua no meio da fila: ações já avaliadas mantêm o veredito; a linha do veredito guarda a `regua_versao` usada.

### Cenário de Erro
- Valor fora da faixa ou texto no campo numérico: resposta de validação e a aba mostra o motivo ao lado do campo, como já faz nos demais.
- Locale do navegador: campo de dinheiro segue a defesa por forma (`^\d+(\.\d{1,2})?$`) já usada.

## Pesquisa (27/09)

- `functions/api/_argo-regua.js` é a fonte única: `REGRAS` (tipo, padrão, min, max, passo, ativa), `montarRegua` (valores/padroes/limites/ativas) e `validarRegua` (exige TODAS as chaves, recusa desconhecida). `argo/config.js` só importa as duas funções; nada mais lista chaves.
- A aba (issue 325) já desenha o grupo "Avaliação do resultado" para toda chave presente em `regua.valores`, envia todas em `argoReguaDaTela()` (números e interruptores) e mostra "Ainda sem efeito" para chave fora de `ativas`. **Nenhuma alteração no `index.html`.**
- Os monitores (`gestor-ae/argo_veredito.regua_avaliacao`) já leem `avaliacao_janela_dias`, `avaliacao_piso_visita_reais`, `avaliacao_piso_lead_multiplicador`, `avaliacao_tolerancia_pct`, `avaliacao_releitura_dias` com padrões 7 / 30 / 3 / 30 / 3 e `aceita_zero` nos quatro últimos. Os limites aqui têm de bater com isso (mínimo 0 onde `aceita_zero`; janela mínimo 1).
- `avaliacao_manuais` só é consumida na 331: entra com `ativa: false` (a aba já mostra o aviso).
- `tests/argo-regua.test.js` tem o caso "só as regras com lógica de hoje estão ativas", que lista as ativas; precisa das chaves novas.

## Arquivos

- **Modificar:** `functions/api/_argo-regua.js` — seis entradas novas em `REGRAS`, bloco "Avaliação do resultado (issues 326–331)":
  - `avaliacao_janela_dias: { tipo: 'inteiro', padrao: 7, min: 1, max: 30, ativa: true }`
  - `avaliacao_piso_visita_reais: { tipo: 'numero', padrao: 30, min: 0, max: 5000, passo: 0.01, ativa: true }`
  - `avaliacao_piso_lead_multiplicador: { tipo: 'numero', padrao: 3, min: 0, max: 10, passo: 0.5, ativa: true }`
  - `avaliacao_tolerancia_pct: { tipo: 'inteiro', padrao: 30, min: 0, max: 100, ativa: true }`
  - `avaliacao_releitura_dias: { tipo: 'inteiro', padrao: 3, min: 0, max: 30, ativa: true }`
  - `avaliacao_manuais: { tipo: 'booleano', padrao: true, ativa: false }`
- **Modificar:** `tests/argo-regua.test.js` — ativas com as cinco numéricas e sem `avaliacao_manuais`; padrões novos presentes; `validarRegua` recusa janela 0 e aceita piso 0.
- Sem mudança em `_argo-config.js`, `argo/config.js`, `index.html` ou no `gestor-ae` (a leitura já existe; `regra_versao` já é gravada em cada veredito, então vereditos dados não mudam).

## Dependências Externas

Nenhuma.

## Verificação

1. `npm test`.
2. Preview local: `npx wrangler pages dev . --port 8788` → `/dash/#argo`: o grupo aparece sem o aviso "ainda sem efeito" nas cinco numéricas, com ele em "Avaliar mudanças manuais"; alterar a janela e salvar → recarregar mostra o valor.
3. Produção: merge da branch `argo-veredito` na `main` (o Pages builda da main); depois `GET /api/argo/config` devolve as chaves; conferir na VPS que `regua_avaliacao` lê o valor salvo (`argo_veredito.regua_avaliacao(argo_estado.ler_grade(...))`, só leitura).

## Checklist

- [x] Chaves + validação no backend com testes (`_argo-regua.js`, `tests/argo-regua.test.js`; 837 verdes).
- [x] Campos na aba: conferido no proxy local com o catálogo real (5 numéricas ativas, manuais esmaecida; print `.playwright-mcp/print-1440-regua-avaliacao.png`). Salvar de verdade só em produção, após o merge (sem `.dev.vars` local para a Neon).
- [x] Monitores lendo a régua nova (`test_argo_veredito.TestFila.test_regua_da_grade_e_lida`, 326).
- [x] `regra_versao` gravada em cada veredito (coluna da 0006, preenchida em `abrir_veredito`).

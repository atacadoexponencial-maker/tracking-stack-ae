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

## Arquivos

- **Modificar:** `functions/api/_argo-regua.js` — chaves, faixas e padrões novos.
- **Modificar:** `functions/api/_argo-config.js` e `functions/api/argo/config.js` — leitura e gravação das chaves.
- **Modificar:** `public/dash/index.html` — campos na seção da régua (marcação vinda do protótipo 325).
- **Modificar:** `gestor-ae/profiles/gestor-ia/scripts/argo_veredito.py` — passa a ler a régua em vez das constantes da 326.
- **Modificar:** `tests/argo-regua.test.js` e `gestor-ae/.../test_argo_veredito.py`.

## Checklist

- [ ] Chaves + validação no backend com testes.
- [ ] Campos na aba, salvar e ver o valor voltar.
- [ ] Monitores lendo a régua nova (teste com grade simulada).
- [ ] `regua_versao` gravada em cada veredito.

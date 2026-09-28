# 334: Realizado × meta no servidor e cartão detalhado na aba Leads

**Tipo:** Implementação
**Página:** Dash → Leads + backend — spec `spec-metas-funil.md`, módulos 2 e 4 (D4, D7, D8)

## Descrição

O servidor calcula, para o mês corrente até ontem, investido, leads novos, MQLs, CPL, custo por MQL, projeção, "precisa de N por dia" e a situação de cada meta, com as mesmas regras do relatório de marketing; a aba Leads desenha o cartão detalhado do protótipo 332 com isso.

## Pronto quando

Em produção, o topo da aba Leads mostra as metas da Sessão Estratégica em setembro com números que batem com `/api/feedback-marketing` para o mesmo período, a projeção e as cores certas, e todos os estados de borda (sem meta, "—", meta atingida, CRM fora, investimento não sincronizado, meta alterada no meio do mês).

## Plano e execução (28/09)

- **Mesma conta do relatório:** `feedback-marketing.js` passou a exportar `montarFeedback`; o endpoint novo `functions/api/metas/acompanhamento.js` o chama para 1º do mês → ontem e pega o bloco do funil (por nome + posição). Leads novos, MQLs e investido não têm como divergir.
- **Regras puras** em `functions/api/_metas-acompanhamento.js`: `indicadorCusto` (dentro ≤ meta, perto até +10%, fora), `indicadorVolume` (situação pela projeção = realizado ÷ dias fechados × dias do mês; "precisa de N por dia" = falta ÷ dias restantes com hoje; meta atingida), `montarFunilAcompanhamento`, `filtrarAvisos` (só investimento atrasado e CRM).
- Só funis com meta vigente no mês entram; sem nenhum, `funis: []` e o relatório nem é lido.
- Dia 1º: sem dia fechado, o relatório não é lido; volumes 0, projeção "—".
- A aba Leads já desenhava o contrato desde a 332; nenhuma mudança na tela.

## Checklist

- [x] Cálculo puro com testes (`tests/metas-acompanhamento.test.js`, 6 casos).
- [x] Endpoint reusando `montarFeedback` do relatório de marketing.
- [x] Cartão detalhado na aba Leads (desde a 332).
- [ ] Conferência em produção: só acontece depois que a gestora cadastrar a primeira meta (sem meta, o endpoint não lê o relatório). Os números de entrada do teste são os reais de 01–27/09 (SE: R$ 5.433,83, 60 leads, 31 MQLs → CPL R$ 90,56, custo por MQL R$ 175,28).

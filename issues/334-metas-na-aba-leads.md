# 334: Realizado × meta no servidor e cartão detalhado na aba Leads

**Tipo:** Implementação
**Página:** Dash → Leads + backend — spec `spec-metas-funil.md`, módulos 2 e 4 (D4, D7, D8)

## Descrição

O servidor calcula, para o mês corrente até ontem, investido, leads novos, MQLs, CPL, custo por MQL, projeção, "precisa de N por dia" e a situação de cada meta, com as mesmas regras do relatório de marketing; a aba Leads desenha o cartão detalhado do protótipo 332 com isso.

## Pronto quando

Em produção, o topo da aba Leads mostra as metas da Sessão Estratégica em setembro com números que batem com `/api/feedback-marketing` para o mesmo período, a projeção e as cores certas, e todos os estados de borda (sem meta, "—", meta atingida, CRM fora, investimento não sincronizado, meta alterada no meio do mês).

## Checklist

- [ ] Cálculo puro com testes (projeção, cores, divisões sem denominador, meta vigente no mês).
- [ ] Endpoint reusando as leituras do relatório de marketing.
- [ ] Cartão detalhado na aba Leads.
- [ ] Conferência contra o relatório de marketing em produção.

# 335: Cartão compacto de metas na Visão geral

**Tipo:** Implementação
**Página:** Dash → Visão geral — spec `spec-metas-funil.md`, módulo 1 (D7)

## Descrição

A Visão geral ganha o cartão compacto do protótipo 332, alimentado pelo mesmo endpoint da 334, sempre no mês corrente, com a nota quando o filtro é outro e o atalho para a aba Leads.

## Pronto quando

Em produção, a Visão geral mostra "Metas de setembro" com os quatro indicadores da Sessão Estratégica iguais aos da aba Leads; trocar o filtro de datas não muda o cartão e mostra a nota; sem meta cadastrada aparece a frase com o atalho para Funis do relatório; clicar leva para a aba Leads.

## Execução (28/09)

O protótipo 332 já ligou o cartão compacto a `/api/metas/acompanhamento`, com a nota do filtro, o estado sem meta e os atalhos. Nesta issue só a verificação: conferidos no proxy de fixtures os modos cheio, sem meta, CRM fora, dia 1º e falha; e, em produção, a rota e a marcação (sem a chave do dash, a tela logada fica para a gestora).

## Checklist

- [x] Cartão compacto ligado ao endpoint da 334.
- [x] Nota do filtro e estado sem meta.
- [x] Atalhos para Leads e para Funis do relatório.
- [ ] Conferido em produção.

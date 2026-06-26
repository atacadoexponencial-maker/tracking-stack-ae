# 03: Dashboard — abas Leads | Vendas

**Tipo:** Implementação
**Página:** `public/dash/index.html`

## Descrição

Reorganizar o dash em duas abas no topo (padrão **Leads**), movendo as seções de venda (receita, vendas, produtos, atribuição/ROAS, UTM, compras) para a aba **Vendas** e mantendo na aba Leads: KPI Leads, filtro de funil, Leads recentes e Saúde do tracking. Troca de aba é só mostrar/esconder blocos no cliente — sem remover seções, sem mudar fetch.

## Critérios de aceite

- Controle de abas no topo, abaixo do header de período. Abre em **Leads**.
- Aba **Leads**: KPI Leads, filtro de funil, Leads recentes, Saúde do tracking.
- Aba **Vendas**: KPIs de receita/vendas/ticket + Receita ao longo do tempo, Produtos, Atribuição, UTM, Compras recentes.
- Período (datas) continua valendo nas duas abas; seletor de funil aparece na aba Leads.
- Nenhuma seção removida; se o JS de abas falhar, degrada para conteúdo visível (não tela branca).

# 268: Protótipo da aba "Saúde do Meta"

**Tipo:** Protótipo
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Protótipo navegável da aba nova no menu lateral do dashboard, com dados fictícios e no padrão visual das demais abas, para validar layout e textos antes de ligar ao servidor. Inclui os elementos do alerta (módulo 4) que aparecem na aba.

## Comportamentos cobertos

- Faixa de estado geral nos três estados ("Saudável", "Atenção", "Incidente") com a frase do motivo
- Última conversão aceita (geral, com tempo decorrido, e por tipo)
- Tabela de aceitação por tipo de evento com linha de total e taxa "—" quando o total é zero
- Evolução diária da aceitação (taxa e volume)
- Pendentes de reenvio (total, por categoria, mais antiga, expiram nas próximas 24 h)
- Lista de falhas definitivas paginada, com filtros por tipo e por motivo, e botão "Tentar de novo" (habilitado e desabilitado com a dica "O Meta não aceita mais este evento (mais de 6 dias).")
- Detalhe da falha (abrir e fechar sem recarregar)
- Captura de identificadores de clique (Meta e Google, com números absolutos e "—")
- Últimas rodadas de reenvio
- Aviso de conversões sem situação, estado vazio ("Nenhuma conversão destinada ao Meta neste período.") e aviso de dados anteriores à ativação
- Falha ao carregar ("Não foi possível carregar a saúde do Meta agora.") e botão "Atualizar"
- Histórico de alertas (entregue / não entregue), aviso "Nenhum canal de alerta configurado — problemas não serão avisados." e botão "Enviar alerta de teste"

## Critérios de aceite relacionados

- 11, 12, 13, 15, 17, 19, 20 (apenas o visual; os números vêm das issues de implementação)

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Modificar:** `public/dash/index.html` — marcação da seção `#secao-saude-meta`, item "Saúde do Meta" no grupo Diagnóstico, entrada em FILTROS/TITULOS

## Checklist

- [x] Seção com os blocos da spec (estado, última aceita, tabela, gráfico, pendentes, falhas, captura, rodadas, alertas)
- [x] Link na navegação e filtro de período sem comparação

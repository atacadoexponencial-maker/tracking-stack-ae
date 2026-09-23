# 304: Régua guardada no banco e editável na aba

**Tipo:** Implementação
**Página:** Aba Argo → Controle + monitores — spec `spec-argo-regua-editavel.md`, módulos 1 e 5

## Descrição

Guardar todas as regras da régua no banco, por conta, com os padrões da spec; ligar o protótipo 299 (editar, validar, recusar gravação por cima, voltar ao padrão, salvar junto com a grade); fazer os monitores lerem os números do banco em vez das constantes do código e mostrarem no Slack a régua usada na rodada.

## Pronto quando

Mudar um número na aba (ex.: gasto mínimo de tráfego de R$ 30 para R$ 40) e salvar faz a rodada seguinte usar e mostrar R$ 40 no Slack; valor inválido é recusado com o campo nomeado.

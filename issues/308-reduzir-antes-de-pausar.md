# 308: Reduzir orçamento antes de pausar

**Tipo:** Implementação
**Página:** Monitores e executor na VPS + grade — spec `spec-argo-regua-editavel.md`, módulo 4

## Descrição

Onde o alvo tem orçamento próprio (conjunto ou campanha), a primeira ação é reduzir pela porcentagem da régua; só depois do intervalo mínimo, se continuar ruim, vem a pausa. Segue o estado de "Reduzir orçamento" na grade (Propor vira proposta; Executar executa com o mesmo registro e conferência).

## Pronto quando

Uma candidata com orçamento próprio vira "reduzir 30%" em vez de pausa; aprovada, o orçamento cai 30% no Gerenciador e o histórico mostra antes/depois; passado o intervalo, se continuar ruim, vira proposta de pausa.

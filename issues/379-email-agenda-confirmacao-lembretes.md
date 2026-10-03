# 379: E-mails da agenda: confirmação e lembretes

**Tipo:** Implementação
**Página:** Agenda (dash e site) + E-mail (spec `spec-email-proprio.md`, módulo 3)

## Descrição

A agenda passa a enviar confirmação e lembretes pelo canal transacional, configuráveis por tipo de reunião (ligar/desligar, modelo, horários de lembrete), sem lembrete de reunião cancelada, remarcada ou já passada. Remarcação e cancelamento ficam configuráveis e saem quando a agenda tiver esses fluxos. Histórico no detalhe do agendamento e falha no aviso diário. Depende da agenda própria (branch `agenda-propria`) estar na base.

## Pronto quando

A usuária agenda uma reunião de teste na prévia, recebe a confirmação, recebe o lembrete no horário configurado, e vê os dois no detalhe do agendamento com a situação de cada um. Um tipo com o e-mail desligado não envia.

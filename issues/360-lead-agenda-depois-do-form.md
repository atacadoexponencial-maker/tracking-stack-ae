# 360: Lead agenda depois do formulário

**Tipo:** Implementação
**Página:** Site: página pública, confirmação (módulos 4 e 5, sem e-mail e sem tracking)

## Descrição

Página pública funcionando: horários livres calculados no backend pela grade e
pelas agendas de conflito, chegada do formulário com dados do lead preenchidos
só para confirmar (e corrigir), tipo comercial sem formulário anterior levando
para a LP do funil, formulário próprio nos tipos não comerciais, nova checagem
de horário ao confirmar, bloqueio de robô, criação do evento com Meet e lead
como convidado, e página de confirmação.

## Pronto quando

Num formulário de teste (fora das LPs no ar), a usuária preenche, cai na
agenda com os dados preenchidos, confirma, recebe o convite do Google e a
reunião com Meet aparece na SETE | COMERCIAL. Uma entrevista de RH também
agenda pelo link direto.

## Observações

- **As LPs no ar continuam mandando para o Calendly.** Nenhum link das páginas
  em produção muda nesta issue (a troca é a 364, travada).


## Implementação (02/10/2026)

Branch `agenda-propria`, commit único com 356–363. `/api/agenda/publico/{tipo,horarios,confirmar}`; o `/tracker` troca o destino Calendly pelo convite só com `AGENDA_ATIVA=1` (variável só na PRÉVIA). Para testar: no link da prévia, preencher o form de uma LP de sessão estratégica com e-mail @seteads.com.

Testes: `tests/agenda-regras.test.js` e `tests/agenda-fluxo.test.js` (SQLite real + Google simulado). Falta: conferência da usuária na prévia; nada vai para a `main` sem o ok dela.

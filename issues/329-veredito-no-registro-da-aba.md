# 329: Selo e detalhe do veredito no Registro da aba Argo

**Tipo:** Implementação
**Página:** Dash → aba Argo → vista Registro + `/api/argo/registro` — spec `spec-argo-veredito-acoes.md`, módulo 3

## Descrição

O Registro passa a mostrar o veredito de cada ação: selo na lista, tabela antes × depois no detalhe e filtro por veredito. Segue o visual aprovado no protótipo 325.

## Pronto quando

Em produção, a vista Registro mostra em cada ação um dos selos *Acertou*, *Errou*, *Inconclusivo*, *Aguardando — avalia em DD/MM* ou *Sem avaliação — motivo*; abrir a ação mostra o motivo em uma frase e a tabela antes × depois com métrica-guia, gasto, leads ou visitas, MQL e referência; o filtro por veredito funciona. Se a leitura do veredito falhar, a ação aparece normal com "veredito indisponível".

## Cenários

### Happy Path
1. `/api/argo/registro` junta a tabela de vereditos às ações (um por ação) e devolve os campos numa lista fixa `CAMPOS_VEREDITO` espelhada no SELECT, como `CAMPOS_ACAO`.
2. "Aguardando" é calculado no backend: `criada_em + janela` da régua vigente, devolvido como data.
3. "Sem avaliação" sai do motivo gravado quando a ação está fora da fila (desfeita, não aplicada, desfecho desconhecido).
4. A aba renderiza selo, detalhe e filtro sem interpretar nada: rótulos e datas vêm prontos.

### Edge Cases
- Ação com veredito `avaliando` (write-ahead em andamento) → selo "Aguardando" com "avaliando agora".
- Ação anterior à migration 0006 sem veredito e já fora da janela → "Sem avaliação — anterior ao módulo".
- Números faltando no antes ou no depois → célula "—", nunca zero.

### Cenário de Erro
- Tabela de vereditos inacessível: o endpoint devolve as ações com `veredito: null` e um aviso; a aba mostra "veredito indisponível".

## Arquivos

- **Modificar:** `functions/api/_argo-registro.js` — `CAMPOS_VEREDITO`, rótulos constantes (`VEREDITO_ACERTOU`, `VEREDITO_ERROU`, `VEREDITO_INCONCLUSIVO`, `VEREDITO_AGUARDANDO`, `VEREDITO_SEM_AVALIACAO`, `VEREDITO_INDISPONIVEL`) e montagem.
- **Modificar:** `functions/api/argo/registro.js` — SELECT com LEFT JOIN na tabela de vereditos.
- **Modificar:** `public/dash/index.html` — selo, detalhe e filtro (marcação do protótipo 325).
- **Modificar:** `tests/argo-registro.test.js`.

## Checklist

- [ ] Backend devolve veredito e "aguardando" com testes.
- [ ] Selos, detalhe e filtro na aba.
- [ ] Falha de leitura vira "veredito indisponível".
- [ ] Conferido em produção com uma ação real avaliada.

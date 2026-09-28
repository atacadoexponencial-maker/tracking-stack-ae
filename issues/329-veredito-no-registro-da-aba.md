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

## Pesquisa (27/09)

- `functions/api/argo/registro.js` faz dois SELECTs (rodadas, depois ações por `rodada_id = ANY`) com `sql.unsafe(CAMPOS_ACAO.join(', '))`; `montarRegistro` (`_argo-registro.js`) agrupa por rodada e classifica o `desfecho` de cada ação.
- **Defeito herdado que esta issue precisa contornar:** `desfechoDaAcao` lê `acao.desfeita_em`, mas essa coluna NUNCA é escrita (o desfazer é uma ação nova com `desfaz_acao_id`, issue 312). Logo "desfeita" nunca aparece na aba. A 327 já resolveu isso no Python calculando `desfeita_em` por subconsulta; aqui a mesma subconsulta entra no SELECT, sem mudar `CAMPOS_ACAO` (a lista continua sendo o contrato de campos; só a origem do campo `desfeita_em` muda).
- A tela (325) lê `acao.veredito` e `acao.origem`/`acao.feita_por`, filtra por `a.tipo` e mostra `situacao_rotulo` pronto. Nada a mudar nela.
- Janela: `montarRegua(regua).valores.avaliacao_janela_dias` (`_argo-regua.js`, 328). "Hoje" em Brasília: `_data-brt.js` já tem helpers de data BRT (reusar o que servir; não duplicar o fuso).

## Contrato devolvido (o que a 325 já espera)

Por ação, além do que já vinha:

```json
"origem": "argo",
"feita_por": null,
"veredito": {
  "situacao": "acertou | errou | inconclusivo | aguardando | avaliando | sem_avaliacao",
  "situacao_rotulo": "Acertou | Errou | Inconclusivo | Aguardando | Sem avaliação",
  "motivo": "frase do banco ou calculada aqui",
  "avalia_em": "YYYY-MM-DD (só em aguardando)",
  "avaliada_em": "ISO (quando há veredito)",
  "janela_dias": 7,
  "numeros": [{"rotulo": "...", "antes": "...", "depois": "...", "referencia": "..."}]
}
```

Regra de classificação, no backend (`classificarVeredito(acao, linhaVeredito, janelaDias, hojeBrt)`):
1. Há linha em `argo.vereditos`: `avaliando` → "Aguardando" (a tela mostra "avaliando agora"); as demais saem como estão (motivo, numeros, avaliada_em, janela_dias do banco).
2. Sem linha: `desfazer_*` que não é reativação → `sem_avaliacao` "é um desfazer"; `desfeita_em` → "desfeita antes da janela"; `aplicada !== true` → "não aplicada"; `estado_posterior` nulo → "desfecho desconhecido"; janela ainda aberta (`dataBRT(criada_em) + janela ≥ hoje`) → `aguardando` com `avalia_em = data + janela + 1`; janela fechada → `sem_avaliacao` "ainda não avaliada" (o monitor decide na próxima rodada se vira veredito ou "prazo passou").
3. Reativação = `desfazer_pausa` com `motivo LIKE '%proposta reativação%'` ou proposta `reativar_anuncio` ligada (`propostas.acao_id`): o SELECT devolve `reativacao` booleano; `montarRegistro` calcula o `desfecho` com o tipo original e devolve `tipo: 'reativar_anuncio'` (e `tipo_original`) para o filtro e o placar da aba baterem com o Python.

## Arquivos

- **Modificar:** `functions/api/argo/registro.js`
  - Terceiro SELECT (uma consulta, antes das ações): `regua` de `argo.config_conta` → `janelaDias`.
  - SELECT das ações: colunas `a.<campo>` para cada `CAMPOS_ACAO`, exceto `desfeita_em`, que vira `(SELECT MIN(d.criada_em) FROM argo.acoes d WHERE d.desfaz_acao_id = a.id AND d.aplicada) AS desfeita_em`; mais `EXISTS(...) OR a.motivo LIKE ... AS reativacao` e o `LEFT JOIN argo.vereditos v` com `v.situacao AS v_situacao, v.motivo AS v_motivo, v.numeros AS v_numeros, v.janela_dias AS v_janela_dias, v.avaliada_em AS v_avaliada_em, v.origem AS v_origem, v.ultimo_erro AS v_ultimo_erro`. `sql.unsafe` continua só com literais do código.
  - `montarRegistro({ rodadas, acoes, janelaDias, hoje })`.
  - Falha só na leitura de vereditos não existe separada (é um JOIN); se a consulta inteira falhar, o 500 atual continua. O "veredito indisponível" da tela cobre resposta sem o campo (versão antiga do backend).
- **Modificar:** `functions/api/_argo-registro.js`
  - Constantes: `VEREDITO_ROTULO`, `MOTIVO_SEM_AVALIACAO_*` (é um desfazer / desfeita antes da janela / não aplicada / desfecho desconhecido / ainda não avaliada), `TIPO_REATIVACAO = 'reativar_anuncio'`.
  - `classificarVeredito(acao, janelaDias, hoje)` pura, exportada, testável.
  - `montarRegistro` aceita `janelaDias` (padrão 7) e `hoje` (padrão data BRT de agora) e devolve por ação `origem`, `feita_por: null`, `veredito`, `tipo` efetivo e `tipo_original`.
  - `CAMPOS_ACAO` inalterada (o teste que fixa a lista continua valendo).
- **Modificar:** `tests/argo-registro.test.js` — `classificarVeredito` em cada ramo (linha do banco em cada situação; sem linha: desfazer, desfeita, não aplicada, desconhecida, aguardando com `avalia_em`, janela fechada); reativação troca o tipo mas mantém o desfecho de reativação; `desfeita_em` calculado vence o desfecho (o teste existente já cobre a regra, só ganha o caso do JOIN); `montarRegistro` sem `janelaDias`/`hoje` usa padrões.

Nenhuma alteração em `public/dash/index.html` nem no `gestor-ae`.

## Dependências Externas

Nenhuma.

## Verificação

`npm test`; proxy de fixtures da 325 substituído por chamada real só depois do merge (`GET /api/argo/registro?key=...` em produção deve trazer `veredito` na única ação existente como `aguardando`, `avalia_em` 2026-10-04, e `desfeita_em` nulo).

## Checklist

- [x] Backend devolve veredito e "aguardando" com testes (`classificarVeredito`; 843 verdes).
- [x] Selos, detalhe e filtro na aba — já entregues no protótipo 325; a aba não mudou nesta issue.
- [x] Falha de leitura vira "veredito indisponível": resposta sem o campo `veredito` (backend antigo) já é tratada pela aba; o JOIN não tem falha separada.
- [ ] Conferido em produção com uma ação real avaliada — depende do merge na `main` e da 1ª ação com janela fechada (04/10).

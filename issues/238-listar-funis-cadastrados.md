# 238: Listar funis cadastrados na aba

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Carregar a lista do cadastro pelo servidor, com o mesmo acesso do dashboard, na ordem do relatório, com o filtro de situação e o estado vazio.

## Comportamentos cobertos

- Abrir a aba: carrega os funis ativos na ordem do relatório
- Abrir a aba sem acesso ao dashboard: recusado, como nas demais abas
- Alternar para "todos": inclui os arquivados, marcados como tal, abaixo dos ativos
- Opção do CRM cadastrada que deixou de existir no CRM: marcada na linha como "não existe mais no CRM"
- Nenhum funil ativo: mostra o estado vazio

## Cenários

### Happy Path
1. A usuária abre "Funis do relatório".
2. A aba chama `GET /api/funis-relatorio?key=...&situacao=ativos`.
3. O servidor lê `funis_relatorio` (só `situacao = 'ativo'`) e, em paralelo, as opções atuais do CRM.
4. `montarListaFunis` ordena por `posicao`, põe os rótulos de tipo e origem e marca cada opção do CRM com `existe`.
5. A aba desenha a lista na ordem recebida.

### Edge Cases
- **"Todos":** o botão chama `situacao=todos`; os arquivados vêm abaixo dos ativos (mais recente primeiro), com `posicao = null` e situação "arquivado", e só com o botão "Reativar".
- **Opção sumida do CRM:** `existe: false` → a linha mostra "não existe mais no CRM" ao lado da opção.
- **CRM sem resposta:** `existe: null` em todas as opções (não afirma que sumiu); a lista aparece normalmente, com `crm_lido: false`.
- **Nenhum funil ativo:** `aviso_vazio` vem pronto do backend e a aba mostra "Nenhum funil cadastrado — todo o investimento do relatório vai aparecer em 'sem funil'." (também em "todos", se só houver arquivados).
- **`opcoes_crm` ilegível numa linha:** aquela linha mostra lista vazia; as demais seguem.
- "descer" desabilitado na última posição usa `total_ativos` do backend.
- `situacao` com valor desconhecido → tratado como `ativos`.

### Cenário de Erro
- Sem `key` ou chave errada → `401 Unauthorized`; o `render()` mostra "Não foi possível carregar os dados agora." como nas demais abas.
- Tabela ainda não migrada ou D1 fora → a rota falha e cai no mesmo aviso de erro de `render()`.

## Banco de Dados

Só leitura em `funis_relatorio` (migration 0039, issue 236): `id, nome, tipo, funil_tracking, opcoes_crm, origem_lead, trecho_campanha, situacao, posicao, versao, alterado_em`.

## Arquivos

- **Criar:** `functions/api/_funis-relatorio.js` — módulo puro: `TIPOS`, `ORIGENS`, `AVISO_VAZIO`, `lerOpcoesCrmGravadas`, `montarListaFunis` (ordem, filtro, rótulos, `existe`, estado vazio).
- **Criar:** `functions/api/funis-relatorio.js` — `GET` com `DASH_KEY` e `situacao=ativos|todos`; lê o D1 e o CRM e devolve a lista pronta.
- **Criar:** `tests/funis-relatorio.test.js` — testes do módulo puro.
- **Modificar:** `public/dash/index.html` — `R['funis-relatorio']` busca a lista no servidor (sai o `rows` fixo do protótipo); botões "Ativos"/"Todos" trocam o filtro; estado vazio com o texto do backend.

## Dependências Externas

- ClickUp API — leitura das opções do campo "🔻 Funil" via `lerOpcoesFunilCrm` (issue 237), só para a marca "não existe mais no CRM".

## Reuso (pesquisado na base)

- `lerOpcoesFunilCrm` (`_crm-opcoes-funil.js`, issue 237).
- Autenticação `DASH_KEY` e helper `json()` de `bloqueios.js` / `links.js`.
- `desenharListaFunisRel` do protótipo (issue 233), `tabela()`, `fetchJson`, `quandoBRT`, `esc`.

## Checklist

- [x] `montarListaFunis`: ativos por `posicao`, arquivados abaixo só em "todos"
- [x] Rótulos de tipo e origem prontos no backend
- [x] Marca `existe` por opção do CRM; `null` quando o CRM não respondeu
- [x] `aviso_vazio` quando não há funil ativo
- [x] `GET /api/funis-relatorio` com `DASH_KEY` (401 sem chave)
- [x] Testes do módulo puro
- [x] Aba lê a lista do servidor; `rows` fixo do protótipo removido
- [x] Filtro "Ativos"/"Todos" funcionando
- [x] "não existe mais no CRM" na linha e estado vazio na tela
- [x] `npm test` passando

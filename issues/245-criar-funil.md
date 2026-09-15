# 245: Criar funil

**Tipo:** Implementação
**Página:** Módulo 1 — Cadastro de funis (aba do dash)
**Spec:** spec-feedback-marketing.md

## Descrição

Ligar o formulário "Novo funil" a um endpoint de criação que aplica as validações e grava o funil ativo na última posição.

## Comportamentos cobertos

- Criar funil válido: gravado ativo na última posição; a lista recarrega mostrando-o
- Gravação recusada: mensagem do servidor na área de erro do formulário
- Toda validação e permissão no servidor

## Cenários

### Happy Path
1. A usuária preenche o formulário "Novo funil" e clica em "Salvar".
2. A tela manda `POST /api/funis-relatorio?key=...` com `{ nome, tipo, funil_tracking, opcoes_crm: [ids marcados], origem_lead, trecho_campanha }` — sem decidir nada.
3. O servidor confere a chave, lê em paralelo todas as linhas de `funis_relatorio`, `listarFunisConhecidos(env.DB)` e as opções atuais do CRM.
4. `validarFunil` aplica, na ordem do formulário: nome (239) → tipo e origem (240) → funil do tracking (241) → opções do CRM × origem (242) → trecho (243) → venda na Greenn única (244).
5. Passou: `INSERT ... SELECT ... COALESCE(MAX(posicao), 0) + 1` grava o funil `ativo`, `versao = 1`, na **última posição** (a posição é calculada no mesmo comando, sem ler-e-depois-gravar).
6. Responde `{ ok: true, id }`; a tela limpa o formulário e recarrega a aba, que mostra o funil novo no fim da lista.

### Edge Cases
- Campos que não se aplicam ao tipo chegam preenchidos (ex.: origem num `manual`) → descartados pela validação, gravados como NULL.
- Nome/trecho com espaços nas pontas → gravados aparados.
- Opção do CRM gravada com o nome que o CRM dá, não com o que a tela mandou.
- Primeiro funil depois de arquivar todos → posição 1.
- Botão "Salvar" desabilitado enquanto a gravação está em curso (evita duplo clique criando duas linhas).

### Cenário de Erro
- Sem chave / chave errada → `401 Unauthorized`.
- Corpo que não é JSON → `400 { error: 'JSON inválido' }`.
- Qualquer regra recusada → `400 { error: '<mensagem da spec>' }`; a tela mostra o texto em `#funisrel-erro` e nada é gravado.
- CRM fora do ar no momento de gravar → `503 { error: 'Não foi possível ler as opções do CRM agora' }` (não dá para validar a opção sem o CRM; a tela já desabilita "Salvar" nesse caso, e o servidor garante).
- Falha de rede ao salvar → a tela mostra "Não foi possível salvar. Tente de novo." (mesmo padrão de Links).

## Banco de Dados

Escrita em `funis_relatorio` (migration 0039, sem migration nova):

```sql
INSERT INTO funis_relatorio
  (nome, tipo, funil_tracking, opcoes_crm, origem_lead, trecho_campanha,
   situacao, posicao, versao, criado_em, alterado_em)
SELECT ?, ?, ?, ?, ?, ?, 'ativo', COALESCE(MAX(posicao), 0) + 1, 1, ?, ?
FROM funis_relatorio WHERE situacao = 'ativo';
```

## Arquivos

- **Modificar:** `functions/api/_funis-relatorio-validacao.js` — `validarFunil(corpo, { outros, funisConhecidos, opcoesCrm })`, que compõe as validações 239–244 e devolve a linha limpa.
- **Modificar:** `tests/funis-relatorio-validacao.test.js` — testes de `validarFunil` (ordem das checagens, descarte por tipo, cadastro inicial aceito).
- **Modificar:** `functions/api/funis-relatorio.js` — `onRequestPost` com a criação (autenticação `DASH_KEY`, leitura em paralelo, validação, INSERT na última posição).
- **Modificar:** `public/dash/index.html` — `enviarFunisRel(corpo)` (POST + erro do servidor no formulário) e o `submit` do `#funisrel-form` coletando os campos; limpa e recarrega ao gravar.

## Reuso (pesquisado na base)

- Padrão `onRequestPost` + `json()` + `{ error }` 400 de `functions/api/links.js`.
- `listarFunisConhecidos` (`_funil-campanha.js`), `lerOpcoesFunilCrm` / `ERRO_LEITURA_CRM` (`_crm-opcoes-funil.js`).
- `salvarLink` / `limparForm` da aba Links como molde do envio e da área de erro.

## Checklist

- [x] `validarFunil` compõe as seis validações na ordem do formulário
- [x] Testes de `validarFunil`
- [x] `POST /api/funis-relatorio` com `DASH_KEY` (401), JSON inválido (400)
- [x] CRM indisponível ao gravar → 503 com a mensagem do CRM
- [x] Recusa → 400 com a mensagem da validação; nada gravado
- [x] INSERT ativo, `versao = 1`, na última posição calculada no próprio comando
- [x] Tela envia o formulário, mostra o erro do servidor e recarrega a lista ao gravar
- [x] Conferido em SQLite em memória: posição `MAX + 1` e posição 1 sem ativos
- [x] `npm test` passando

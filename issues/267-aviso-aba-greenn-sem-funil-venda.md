# 267: Aviso na aba Greenn sem funil de venda ou sem trecho

**Tipo:** Implementação
**Página:** Módulo 3 — Migração do reconhecimento do workshop pago
**Spec:** spec-feedback-marketing.md

## Descrição

Exibir a faixa de aviso na aba Greenn e listar só as campanhas que venderam quando não há funil de venda ativo ou ele não tem trecho.

## Comportamentos cobertos

- Funil de venda arquivado/inexistente: lista vendas e campanhas que venderam, esconde as que só gastaram, e mostra "Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório."
- Funil de venda sem trecho: mesmo comportamento, com "O funil <nome> não tem trecho do nome da campanha."

## Cenários

### Happy Path
1. A usuária abre a aba Greenn com o funil ativo de venda na Greenn e trecho preenchido (cadastro inicial): `/api/greenn` NÃO traz `aviso_funil_venda`; a faixa fica escondida e a resposta é idêntica à de antes.
2. Sem funil ativo do tipo "Venda na Greenn" (arquivado ou nunca cadastrado): a resposta traz `aviso_funil_venda` = "Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório."; a lista mostra vendas e campanhas que venderam e esconde as que só gastaram (issue 266).
3. Funil ativo de venda sem trecho: `aviso_funil_venda` = "O funil <nome> não tem trecho do nome da campanha.", com o mesmo comportamento da lista.
4. O dashboard só exibe o texto na faixa `#greenn-aviso-funil` (já pronta na issue 235).

### Edge Cases
- Trecho só com espaços conta como sem trecho (mesma regra do reconhecimento).
- Nome do funil com caracteres especiais: vai no texto como está; a tela usa `textContent`.
- Tabela `funis_relatorio` inexistente (antes da migration 0039): mesmo aviso de "nenhum funil de venda".
- Texto montado só no servidor; nenhuma regra nova no front.

### Cenário de Erro
- Falha de banco que não seja tabela inexistente: `/api/greenn` devolve 500 como hoje e a tela mostra o aviso de falha de sempre, sem a faixa.

## Arquivos

- **Modificar:** `functions/api/_greenn-metricas.js` — função pura `avisoFunilVenda(funil)` com os dois textos da spec.
- **Modificar:** `functions/api/greenn.js` — inclui `aviso_funil_venda` na resposta só quando houver aviso.
- **Modificar:** `tests/greenn-metricas.test.js` — testes dos dois textos e da ausência do aviso.

## Checklist

- [x] Texto "Nenhum funil de venda cadastrado — …" sem funil ativo de venda
- [x] Texto "O funil <nome> não tem trecho do nome da campanha." com funil sem trecho
- [x] Sem aviso (campo ausente) quando há funil com trecho — resposta idêntica à de antes
- [x] Tabela inexistente gera o aviso de "nenhum funil" sem quebrar a aba
- [x] Front só exibe (sem alteração no `public/dash/index.html`)
- [x] `npm test` verde

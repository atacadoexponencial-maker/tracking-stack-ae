# 333: Cadastro de metas por funil, editável em Funis do relatório

**Tipo:** Implementação
**Página:** Dash → Funis do relatório + backend — spec `spec-metas-funil.md`, módulo 3 (D1, D2, D3, D5)

## Descrição

Guardar as quatro metas por funil com vigência por mês e histórico de alterações, e ligar o bloco "Metas" do protótipo 332 ao backend, com só a Sessão Estratégica editável.

## Pronto quando

Na aba Funis do relatório, a gestora digita as metas da Sessão Estratégica, salva, recarrega e vê os valores de volta, com data e autor da alteração e a linha nova no histórico. A meta passa a valer no mês corrente e nos seguintes; mudar de novo não reescreve o valor que valeu em meses anteriores. Valor inválido e salvamento concorrente são recusados com o motivo. Os outros funis aparecem com os campos desabilitados.

## Checklist

- [ ] Migration D1 (tabela de metas por funil e mês + histórico), aplicada no remoto ANTES do código ir ao ar.
- [ ] Endpoint de leitura e gravação, autenticado como os demais do dash, com validação no servidor.
- [ ] Bloco do protótipo ligado ao endpoint.
- [ ] Testes.

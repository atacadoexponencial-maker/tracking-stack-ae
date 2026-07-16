# 92: Registro e status do sync

**Tipo:** Implementação
**Página:** Admin — Status

## Descrição

Registrar cada execução do sync em sync_log (fonte, cliente, resultado, linhas) e derivar
o status por conexão (ok / sem dados há 24h / erro) exibido no admin. Falha em uma fonte
não interrompe as demais.

# 182: API de gravação dos links

**Tipo:** Implementação
**Página:** /api/links

## Descrição

Criar o `POST /api/links?key=<DASH_KEY>` para criar, editar e apagar destinos, validando no backend que a URL é `http`/`https`, que o fim não é anterior ao início, que as duas datas vêm juntas ou nenhuma, e que só existe um destino padrão por vez.

# Spec: Landing Page de Captura — Live do Atacado

## Visão Geral

Nova landing page standalone de captura de inscrições para a "Live do Atacado" — uma live gratuita, online e semanal (quinta-feira, 12h) voltada a marcas de atacado que vendem para revendedores/lojistas e querem atrair clientes novos de forma previsível.

A página é uma copy enxuta (versão inicial para teste de conversão) com headline de resultado direto, reforço de data/horário, lista de aprendizados, prova social (marcas que aplicaram o método) e um formulário de inscrição com apenas dois campos: **nome** e **WhatsApp**. O objetivo único da página é converter visitantes em leads inscritos na live.

**Problema que resolve:** dar à operação uma página de captura dedicada e otimizada para a live semanal, já integrada ao mesmo pipeline de tracking e CRM do projeto, para que cada inscrição vire um lead atribuído (origem de tráfego), seja contabilizada como conversão nas plataformas de anúncio e chegue automaticamente ao(s) CRM(s).

### Fluxo de captura existente reaproveitado (restrição de arquitetura)

A página NÃO cria um novo fluxo de captura. Ela reaproveita o fluxo já existente no projeto, idêntico ao usado nas landing pages atuais (ex.: `src/pages/workshop-gratuito-atacado.astro` + `src/components/LeadFormModal.astro`):

- **Endpoint único de captura:** o frontend fala apenas com o endpoint `/tracker` (Cloudflare Pages Function em `functions/tracker.js`). Nenhuma chave de API, token ou regra de negócio fica no frontend.
- **Enriquecimento de sessão e atribuição:** o middleware de página (`functions/_middleware.js`) já intercepta o carregamento da página, extrai UTMs / fbclid / gclid, gera/lê os cookies de sessão (`_krob_sid`, `_krob_eid`, `_fbp`, `_fbc`) e persiste a atribuição em D1. Por isso a página é uma página normal do projeto Astro, sem nenhuma configuração extra de tracking — basta existir.
- **Payload do lead:** ao enviar o formulário, o front faz `POST /tracker` com `event_name: 'Lead'`, um `event_id` único, `event_time`, `event_source_url`, `user_data` (telefone e nome para Advanced Matching) e `lead_data` (os campos crus do formulário + um identificador de funil).
- **Fan-out no backend (feito pelo `/tracker`, não pelo front):**
  - **Meta CAPI** — dispara o evento `Lead` com dados hasheados (SHA-256), fbp/fbc e external_id resolvidos pela cadeia de fallback.
  - **GA4 Measurement Protocol** — dispara `generate_lead`.
  - **CRM (fan-out desacoplado)** — encaminha o lead, junto com a atribuição da sessão, para os webhooks configurados por env: o destino principal por funil (n8n → ClickUp) e, em paralelo, o CRM novo (Supabase). Cada destino dispara de forma independente.
  - **Log em D1** — registra o evento `Lead` no `event_log` para o dashboard de saúde de tracking.
- **Roteamento pós-captura (regra de negócio no backend):** o `/tracker` decide e devolve, na resposta JSON, o campo `redirect` (destino pós-inscrição). O front apenas executa o redirect retornado; se nenhum for retornado, usa um destino padrão local. A seleção do destino depende do funil enviado em `lead_data.funnel` e é configurável por variável de ambiente — ou seja, o destino pós-inscrição desta live é uma decisão de backend/configuração, não do front.

**Implicação para esta feature:** a página deve enviar o lead exatamente neste formato (`POST /tracker`, `event_name: 'Lead'`, com `lead_data` contendo nome, WhatsApp e um identificador de funil próprio da live), e tratar a resposta de redirect. Como o formulário desta live captura apenas nome + WhatsApp (sem email), o `user_data` enviado para Advanced Matching conterá telefone e nome, sem email.

## Páginas / Módulos

### Página: Landing de Captura "Live do Atacado"

**Descrição:** Página única de captura (long-form enxuta) que apresenta a oferta da live, os aprendizados, a prova social e um formulário de inscrição com nome + WhatsApp. Pelo menos um campo/CTA de inscrição precisa estar visível ou acessível por toda a página. A submissão do formulário gera um lead no pipeline existente e leva o usuário ao destino pós-inscrição definido pelo backend.

**Componentes:**

- **Cabeçalho/badge de abertura:** exibe a tarja de status da live ("LIVE GRATUITA E ONLINE • QUINTA, 12H") e a logo da marca.
- **Bloco de headline (hero):** exibe a headline de resultado direto, o subtítulo de promessa e um CTA primário ("QUERO MINHA VAGA NA LIVE →") que leva o usuário ao formulário.
- **Bloco "Nesta hora, você vai entender":** exibe a lista dos 4 aprendizados/bullets de valor da live.
- **Bloco "Para quem é a live":** exibe o parágrafo de qualificação do público-alvo (marca de atacado, vende para revendedor/lojista, produto validado, faturamento travado).
- **Bloco de prova social:** exibe a menção às marcas (Anifil e Essência de Menina) e o resultado obtido.
- **Bloco do formulário de inscrição:** exibe o título "Garanta sua vaga gratuita", o reforço de data/horário ("Quinta-feira, 12h · ao vivo e online"), os campos de entrada **Nome** e **WhatsApp**, o botão de envio ("QUERO PARTICIPAR DA LIVE →") e a microcopy de reforço/garantia ("Vaga gratuita. Você recebe o link e os lembretes direto no seu WhatsApp.").
- **Mensagem de erro do formulário:** elemento que exibe mensagem de erro de validação ou de falha de envio, oculto por padrão.

**Comportamentos:**

- **Carregar a página:** ao acessar a página, a sessão de tracking/atribuição é estabelecida automaticamente (cookies de sessão e persistência de UTMs/click IDs no backend), sem ação do usuário. Nenhuma chave/segredo é exposta no front.
- **Acionar CTA de topo:** ao clicar no CTA primário do hero ("QUERO MINHA VAGA NA LIVE →"), o usuário é levado ao bloco do formulário de inscrição (rolagem até o formulário ou foco no primeiro campo).
- **Digitar Nome:** o usuário preenche o campo de nome.
- **Digitar WhatsApp:** o usuário preenche o campo de WhatsApp/telefone.
- **Validar campos no envio:** ao tentar enviar, o sistema valida que o nome está preenchido (mínimo de caracteres) e que o WhatsApp está preenchido; se inválido, o envio é bloqueado e o usuário recebe indicação do que corrigir.
- **Enviar inscrição:** ao enviar o formulário com os campos válidos, o sistema envia o lead ao endpoint de captura existente (`POST /tracker`), com evento `Lead`, `event_id` único, `event_time`, `event_source_url`, `user_data` (telefone + nome) e `lead_data` (nome, WhatsApp e identificador de funil próprio da live).
- **Estado de carregamento (loading):** durante o envio, o botão de envio fica desabilitado e indica progresso (ex.: texto "Enviando…"), evitando envios duplicados.
- **Disparo de tracking/conversão:** o envio do lead aciona, via backend, o fan-out de conversão existente — Meta CAPI (`Lead`), GA4 (`generate_lead`), encaminhamento ao(s) CRM(s) (ClickUp via n8n + CRM Supabase) e log em D1 — reaproveitando integralmente o fluxo já implementado no `/tracker`. O front não dispara nenhuma dessas integrações diretamente.
- **Sucesso / redirecionamento:** ao concluir o envio com sucesso, o usuário é levado ao destino pós-inscrição retornado pelo backend (campo `redirect` da resposta); na ausência de redirect, é levado a um destino padrão local de confirmação.
- **Estado de erro:** se o envio falhar (erro de rede ou erro do backend), o sistema reabilita o botão de envio, restaura seu texto original e exibe a mensagem de erro; o usuário pode tentar novamente. (Alternativa de fallback, consistente com o componente existente `LeadFormModal`: "nunca bloquear a conversão" — redirecionar para o destino padrão mesmo em falha. A issue de implementação escolhe entre exibir erro ou seguir o fallback, mantendo consistência com o padrão do projeto.)

## Conteúdo / Copy

> Fonte de verdade do conteúdo. NÃO alterar o texto na implementação.

```
🔴 LIVE GRATUITA E ONLINE • QUINTA, 12H

Como ter novos revendedores chegando toda semana no seu atacado

Sem depender dos mesmos clientes de sempre, sem representante e sem aplicar estratégia de varejo num mercado que é completamente diferente.

QUERO MINHA VAGA NA LIVE →

Nesta hora, você vai entender:

✅ Por que postar mais, investir em tráfego e contratar agência não destravou o seu faturamento — e o que realmente está no caminho.

✅ As 2 variáveis que decidem se o seu atacado vai escalar ou continuar travado no mesmo número.

✅ O sistema que marcas de atacado usam para ter revendedor novo entrando toda semana, de forma previsível.

✅ Por que chega consumidor final no seu DM em vez de lojista — e como virar essa chave.

Essa live é pra você que tem uma marca de atacado — vende pra revendedor, lojista ou empreendedor — já tem produto validado, mas sente que o faturamento travou e que as estratégias que você usa não foram feitas pro seu mercado.

Marcas como a Anifil e a Essência de Menina já aplicaram esse método para atrair clientes novos com tráfego — e hoje boa parte do faturamento delas vem de quem chegou depois.

Garanta sua vaga gratuita

Quinta-feira, 12h · ao vivo e online

[ Nome ]
[ WhatsApp ]

QUERO PARTICIPAR DA LIVE →

Vaga gratuita. Você recebe o link e os lembretes direto no seu WhatsApp.
```

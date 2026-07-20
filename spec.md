# Spec: LP /lives-semanais-v2 — variante da LP da live sem formulário (CTA direto pro grupo)

## Visão Geral

Nova landing page em `/lives-semanais-v2` no site atacadoexponencial.com: **cópia fiel da LP existente `/lives-semanais-v1`** (`src/pages/lives-semanais-v1.astro`) — mesma copy, mesmo visual, mesmas seções — com **uma única diferença**: não há formulário de captura. Em vez de preencher nome/WhatsApp/email, o visitante clica no CTA e vai **direto para o grupo de WhatsApp da live** — o mesmo destino para onde o formulário da v1 redireciona após o envio.

O destino do grupo já é resolvido no servidor: o endereço `/grupo-da-live` do próprio site redireciona para o link real do grupo (destino configurável centralmente; trocar o grupo no futuro não exige mudar esta página). A v2 aponta seus CTAs para esse endereço — o link do grupo nunca aparece no conteúdo da página.

A página serve para testar uma variante de funil de menor atrito (sem captura de dados) contra a v1. Público e oferta são os mesmos: donos de marca de atacado convidados para a live gratuita semanal (quinta, 12h).

**Tracking:** idêntico ao das demais páginas do site — o registro de visita (com atribuição de campanha e deduplicação navegador/servidor) já acontece automaticamente por a página usar o mesmo layout base das outras. Nenhum evento de conversão (Lead) é disparado nesta página, pois não há captura.

**Fora do escopo (não fazer):** formulário de captura, registro de Lead, novo valor de funil no painel, alterações na v1, alterações no redirecionador do grupo, qualquer copy ou seção nova.

## Páginas / Módulos

### Página /lives-semanais-v2 (LP da live — CTA direto pro grupo)

**Descrição:** Landing page de convite para a live semanal, réplica visual e de copy da `/lives-semanais-v1`, sem o cabeçalho padrão do site (a navegação é só o logotipo centralizado no topo do hero). A seção final de inscrição troca o formulário por um botão único que leva ao grupo de WhatsApp.

**Componentes:**
- **Hero (fundo claro):** logotipo centralizado no topo; badge "🔴 LIVE GRATUITA E ONLINE • QUINTA, 12H"; título "Como ter novos revendedores chegando toda semana no seu atacado"; subtítulo ("Sem depender dos mesmos clientes de sempre, sem representante e sem aplicar estratégia de varejo num mercado que é completamente diferente."); botão CTA "QUERO MINHA VAGA NA LIVE →".
- **Seção "Nesta hora, você vai entender":** título + lista dos mesmos 4 itens da v1, cada um em card com marcador ✅.
- **Seção "Para quem é a live":** eyebrow + parágrafo de qualificação (mesmo texto da v1).
- **Seção Depoimentos (prints):** eyebrow "Depoimentos", título "O que dizem quem já aplicou o método" e a mesma grade de prints de depoimentos usada na v1 (2 colunas no mobile, 3 no desktop, carregamento preguiçoso).
- **Seção final de chamada (substitui a de inscrição da v1):** título "Garanta sua vaga gratuita"; reforço "Quinta-feira, 12h · ao vivo e online"; **botão único de CTA** (no lugar do formulário) levando ao grupo; frase de garantia ajustada ao novo fluxo (a da v1 promete "link e lembretes no WhatsApp" após envio do form — aqui a frase reflete que a entrada é direta no grupo, ex.: "Vaga gratuita. É só entrar no grupo que o link e os lembretes da live chegam por lá."). Esta é a única frase que muda em relação à v1, por coerência com o fluxo sem formulário.

**Comportamentos:**
- **Visitar a página:** a visita é registrada com os mesmos dados de atribuição de campanha das demais páginas do site (comportamento herdado do layout base; nada específico a construir nesta página).
- **Clicar no CTA do hero ("QUERO MINHA VAGA NA LIVE →"):** leva o visitante ao endereço interno do redirecionador do grupo (`/grupo-da-live`), que o encaminha ao grupo de WhatsApp da live.
- **Clicar no CTA da seção final:** mesmo destino do CTA do hero (`/grupo-da-live`).
- **Rolar a página:** as seções aparecem na mesma ordem e com o mesmo visual da v1; os prints de depoimento carregam conforme entram na tela.

**Comportamentos removidos em relação à v1 (não existem nesta página):**
- Preencher nome, WhatsApp ou email.
- Validação/máscara de telefone e sugestão de correção de email.
- Envio de dados de lead e disparo de evento de conversão (Lead).
- Estado "Enviando…" e mensagens de erro de formulário.

# Plano de Cutover — atacadoexponencial.com

> Objetivo: fazer a **landing nova** (Astro + tracking) assumir o `atacadoexponencial.com`,
> **preservando 100%** dos serviços de produção que vivem no mesmo domínio.
> Nada do DNS será tocado até este plano estar aprovado por você.

## Princípio de segurança

Trazer o DNS do domínio para a **Cloudflare** (que copia automaticamente todos os
registros atuais ao adicionar o domínio), **conferir registro por registro** contra o
inventário abaixo, e mudar **apenas o endereço da landing**. Todo o resto fica idêntico.

## O que será PRESERVADO (não muda)

| Serviço | Registro | Mantém apontando para |
|---|---|---|
| Área de membros | `membros.` | Lovable (185.158.133.1) |
| E-mails da área de membros | `aviso.` (DKIM/DMARC Lovable+Resend) | Lovable / Resend |
| Disparos / e-mail marketing | `ae.` (MX Mailgun, SPF LeadConnector+Mailgun, DMARC, DKIM) | GoHighLevel + Mailgun |
| E-mail principal | MX + DKIM (google, default, resend, lovable) | (a confirmar — ver abaixo) |

Registro legado a descartar: `webmail.` (você confirmou que não usa).

## O que MUDA (apenas isto)

| Registro | De | Para |
|---|---|---|
| `atacadoexponencial.com` (apex) | Lovable | Landing nova (Cloudflare Pages) |
| `www.` | Lovable | Landing nova (Cloudflare Pages) |

## Passos

### Fase 0 — Preparação (eu faço; NÃO afeta nada que está no ar)
1. Publicar a landing em produção (juntar a branch na principal). Isso só atualiza o
   ambiente de teste `tracking-ae.pages.dev`; **não toca no seu domínio**.
2. Adicionar `atacadoexponencial.com` na sua conta Cloudflare → ela importa os registros
   atuais. **Isso não ativa nada** enquanto os nameservers não forem trocados.
3. Conferir, registro por registro, contra o inventário acima. Adicionar manualmente
   qualquer um que a importação automática tenha perdido (DKIM costuma ser o caso).
4. Ligar o apex e o `www.` à landing nova (custom domain no Pages).

### Fase 1 — Virada (você faz, eu te guio passo a passo)
5. No painel do seu provedor (onde gerencia o domínio / `han8070`), **trocar os 2
   nameservers** pelos que a Cloudflare fornecer. (Copia e cola.)
6. Propagação: de alguns minutos até ~24h. Durante esse tempo, **nada fica fora do ar** —
   quem ainda não propagou continua vendo a versão antiga.

### Fase 2 — Verificação (eu faço)
7. Conferir tudo no ar: landing nova no domínio, área de membros, login e recuperação de
   senha, disparos de e-mail saindo, e recebimento de e-mail.

## Rollback (se algo der errado)
Voltar os nameservers para o `han8070`. Isso reverte tudo ao estado atual. A volta também
leva tempo de propagação, mas restaura o cenário anterior por completo.

## E-mail: definido (somente envio) ✅

O domínio é usado **apenas para envio** (disparos), não para recebimento — não há caixa
`@atacadoexponencial.com` que recebe. Isso simplifica e torna o cutover mais seguro:

- **Não há risco de recebimento de e-mail**: como ninguém recebe nesse domínio, trocar o
  endereço da landing (apex) não derruba caixa de entrada nenhuma.
- **O que preservamos são as assinaturas de envio** (registros separados, não afetados
  pela troca do apex): SPF e DKIM de `ae.` (LeadConnector/Mailgun) e `aviso.`
  (Lovable/Resend); os DKIM do apex (`resend`, `lovable`, `google`, `default`); e os DMARC.
- O `MX` "self" do apex pode ficar como está (inofensivo, ninguém recebe) — não mexemos
  nele para não introduzir mudança desnecessária.

**Plano fechado.** Próximo passo é a Fase 0 (preparação), que é toda segura e não altera
nada que está no ar.

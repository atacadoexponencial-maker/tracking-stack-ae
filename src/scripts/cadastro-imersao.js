// Cadastro antes do checkout da Imersão (spec-popup-checkout-imersao.md, série
// S10, issue S10-04).
//
// Aqui fica só a decisão do que acontece em cada toque, sem DOM: a página
// (imersao-planejamento-atacado.astro) abre a janela, lê os campos e mostra o
// erro. Quem valida de verdade e grava é o servidor (/api/imersao-cadastro).
//
// REGRA QUE MANDA EM TUDO: a venda vem antes do cadastro. Gravação que falha ou
// demora nunca impede a ida ao checkout.

export const CHAVE_FEITO = 'ipa_cadastro_feito';
export const CHAVE_UTMS = 'ipa_utms';
export const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export const MENSAGENS = {
  nome: 'Digite o seu nome.',
  email: 'Digite um e-mail válido, como nome@exemplo.com.',
  telefone: 'Digite o WhatsApp com DDD. Número de fora do Brasil começa com +.',
};

/** UTMs que vieram no endereço da visita (só as que têm valor). */
export function utmsDoEndereco(busca) {
  const params = new URLSearchParams(busca || '');
  const utms = {};
  for (const k of UTMS) {
    const v = (params.get(k) || '').trim();
    if (v) utms[k] = v.slice(0, 200);
  }
  return utms;
}

/** Endereço do checkout com as UTMs da visita. Nunca leva dado da pessoa. */
export function destinoCheckout(checkoutUrl, utms) {
  const url = new URL(checkoutUrl);
  for (const k of UTMS) if (utms?.[k]) url.searchParams.set(k, utms[k]);
  return url.toString();
}

/** Confere os três campos, na ordem da janela. Devolve o primeiro com problema. */
export function validarCadastro(valores, telefoneValido) {
  const nome = String(valores?.nome || '').trim();
  const email = String(valores?.email || '').trim();
  const telefone = String(valores?.telefone || '').trim();
  if (nome.length < 2) return { ok: false, campo: 'nome', mensagem: MENSAGENS.nome };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return { ok: false, campo: 'email', mensagem: MENSAGENS.email };
  if (!telefoneValido(telefone)) return { ok: false, campo: 'telefone', mensagem: MENSAGENS.telefone };
  return { ok: true, valores: { nome, email, telefone } };
}

/**
 * @param {object} o
 * @param {string} o.checkoutUrl   endereço do checkout da Zouti
 * @param {string} o.busca         `location.search` da visita
 * @param {{getItem: Function, setItem: Function}} o.armazenamento  guarda da aba (sessionStorage)
 * @param {(telefone: string) => boolean} o.telefoneValido
 * @param {(dados: object) => Promise<unknown>} o.enviar   grava o cadastro no servidor
 * @param {(url: string) => void} o.navegar
 * @param {number} [o.esperaMs]    quanto espera a gravação antes de seguir (abaixo de 3 s)
 * @param {(fn: Function, ms: number) => unknown} [o.agendar]
 */
export function criarCadastro({ checkoutUrl, busca, armazenamento, telefoneValido, enviar, navegar, esperaMs = 2500, agendar = setTimeout }) {
  const ler = (chave) => {
    try { return armazenamento.getItem(chave); } catch { return null; }
  };
  const gravar = (chave, valor) => {
    try { armazenamento.setItem(chave, valor); } catch { /* aba sem armazenamento: segue só nesta página */ }
  };

  // As UTMs ficam guardadas na aba: se a pessoa recarregar ou voltar do
  // checkout sem elas no endereço, as da chegada continuam valendo.
  let utms = utmsDoEndereco(busca);
  if (Object.keys(utms).length) gravar(CHAVE_UTMS, JSON.stringify(utms));
  else {
    try { utms = JSON.parse(ler(CHAVE_UTMS) || '{}') || {}; } catch { utms = {}; }
  }

  let feito = ler(CHAVE_FEITO) === '1';
  let emCurso = null;
  const irAoCheckout = () => navegar(destinoCheckout(checkoutUrl, utms));

  return {
    /** Toque em botão de compra: quem já se cadastrou na visita vai direto. */
    aoComprar() {
      if (feito) {
        irAoCheckout();
        return 'checkout';
      }
      return 'janela';
    },

    /** Toque em confirmar. Dois toques seguidos viram um envio só. */
    confirmar(valores) {
      const v = validarCadastro(valores, telefoneValido);
      if (!v.ok) return Promise.resolve(v);
      if (emCurso) return emCurso;
      emCurso = (async () => {
        if (!feito) {
          const envio = Promise.resolve()
            .then(() => enviar({ ...v.valores, utms }))
            .catch(() => { /* a venda vem antes do cadastro */ });
          await Promise.race([envio, new Promise((r) => agendar(r, esperaMs))]);
          feito = true;
          gravar(CHAVE_FEITO, '1');
        }
        irAoCheckout();
        emCurso = null;
        return { ok: true };
      })();
      return emCurso;
    },
  };
}

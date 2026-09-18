// GET /m/<chave> — serve o arquivo agendado para a Evolution baixar.
//
// É PÚBLICA de propósito, e isso é uma decisão, não um descuido: quem baixa
// este arquivo é o servidor da Evolution, que não tem como se autenticar no
// dash. A proteção é a chave de 32 hex aleatórios, que não se adivinha — e o
// arquivo está a caminho de um grupo de centenas de pessoas de qualquer forma.
//
// A ficha no D1 manda mais que o KV: mídia com `apagada_em` preenchida responde
// 404 mesmo que o byte tenha sobrado no KV por algum motivo. O expurgo é a
// palavra final sobre o que ainda existe.
//
// A Evolution acrescenta `?timestamp=<ms>` sozinha na URL de áudio (cache
// busting dela). Por isso a query é simplesmente ignorada aqui — se ela
// participasse da identificação do arquivo, o áudio quebraria.

import { fichaPorChave, lerBytes } from '../api/_midia.js';

export async function onRequestGet(context) {
  const { env, params } = context;

  const chave = String(params?.chave || '');
  if (!/^[0-9a-f]{32}$/.test(chave)) return naoEncontrado();

  const f = await fichaPorChave(env, chave);
  if (!f || f.apagada_em) return naoEncontrado();

  const bytes = await lerBytes(env, chave);
  if (!bytes) return naoEncontrado();

  return new Response(bytes, {
    headers: {
      'Content-Type': f.mimetype,
      // `inline` porque o destino é um leitor de mídia, não um download; o nome
      // vai junto porque é o que aparece quando alguém salva o arquivo.
      'Content-Disposition': `inline; filename="${f.nome.replace(/"/g, '')}"`,
      // O conteúdo de uma chave nunca muda: chave nova a cada arquivo.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}

function naoEncontrado() {
  return new Response('Não encontrado', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

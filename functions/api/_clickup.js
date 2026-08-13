// Acesso à API do ClickUp — constantes e helpers COMPARTILHADOS.
//
// Extraído de functions/tracker.js em 2026-08-13, quando a ponte da Greenn
// (functions/api/webhooks/greenn.js) passou a precisar dos mesmos IDs. Duas
// cópias dos IDs de custom field é como eles divergem em silêncio: alguém
// renomeia um campo no ClickUp, atualiza um arquivo, e o outro segue escrevendo
// no campo errado sem erro nenhum.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota. Mora em functions/api/
// e não em functions/api/webhooks/ porque é usado pelos dois — mesmo precedente
// de functions/api/_hash.js.
//
// O que NÃO está aqui: `mapFunnelToOption` e `mapProdutoToOption` seguem no
// tracker.js. Elas traduzem o funil do SITE para a opção do dropdown, que é
// assunto do fluxo de leads, não da API.

export const CLICKUP_API = 'https://api.clickup.com/api/v2';

// IDs dos custom fields da lista (🤑 CRM). Ver spec 2026-07-02.
export const CU_FIELD = {
  nome: '7f70363f-9fc4-4d34-aab1-0a81d4a6f45d',
  email: '24f5a3d3-e21e-4e08-b396-8a4ce2133a98',
  instagram: '3f24aa2d-050f-4be2-ab63-09b91307919b',
  faturamento: '97d8308d-d6b2-4dd6-9bd7-76f6662d5de2',
  whatsapp: '754a41c9-2835-48d5-a70e-8b61841e0037',
  justificativa: 'bc6b9579-de7c-4256-b649-b99d95132fa4',
  objetivo: '64e17f77-689c-487a-b8f3-8878df137a27',
  cargo: '150014bc-01ca-466f-90b6-9711ec19408e',
  investimento: '1e87bc05-95ba-444c-a728-eddf5fb603de', // 💵 Investimento em Tráfego (short_text)
  funil: 'a663b002-661c-4dc1-86c3-612e94f3a447',
  produto: '6fd27248-beb5-49e1-9626-f1ab7ed81e5a',
  // 💵 Valor (currency). Acrescentado em 2026-08-13 para a ponte da Greenn.
  // DELIBERADAMENTE não é o 💰 Arrecadado (85ef1a33-...): aquele é lido por
  // functions/webhook/clickup.js quando um card entra em "contrato assinado", e
  // registra a venda no purchase_log/ROAS do negócio antigo.
  valor: '67bc0514-2f0b-4317-a081-6fa69904681e',
  utmSource: '64ffa839-dac1-4995-9cbb-7bd50f9dc5d5',
  utmMedium: 'e367ce2e-a06c-43b6-ac9b-0feb4923f007',
  utmContent: '5710cb4d-a375-464b-8ac6-5267745eaddc',
  utmCampaign: '78b59aa4-6e98-4555-bbbf-5a0259309eb0', // "utm_campaing" (nome com typo na lista)
};

export const CU_DEFAULT_LIST = '205126080'; // 🤑 CRM — fallback se CLICKUP_LIST_ID não estiver setado
export const CU_PRODUTO_AE = '6cf677ce-5592-4ff7-9f63-d18d52d42be5';
export const CU_PRODUTO_ACELERACAO = '5a98b2d7-bfe0-4c29-9de4-2c15721bd9a7'; // ACELERAÇÃO
export const CU_FUNIL_SESSAO = 'a158d342-c1ac-4705-a6da-ce39019f0a2a'; // SESSÃO ESTRATÉGICA
export const CU_FUNIL_LIVES = 'e6893b0b-5a69-4f48-9c99-a3c0a415a118';  // LIVES SEMANAIS
export const CU_FUNIL_APLICACAO = '51f77888-2ba1-4f83-9b33-d8ef516b80be'; // APLICAÇÃO
export const CU_FUNIL_WORKSHOP = 'b5e04cdb-f62d-4159-b89b-751726a61831'; // WORKSHOP
export const CU_FUNIL_TRAFEGO = 'f88ef3e2-2928-439b-83ad-c7ff55083f60'; // TRAFEGO PAGO
export const CU_FUNIL_ISCAS = 'b1d0bc63-3d66-41f0-ad31-4a74d7b541ed'; // ISCAS (materiais do ManyChat)
// WO PAGO — usado pela ponte da Greenn (workshop pago). Opção que já existia na
// lista; não foi criada por nós.
export const CU_FUNIL_WO_PAGO = '420877c7-44de-4d46-a934-718889443f49';

// Mesma normalização do n8n: dígitos, sem zeros à esquerda, prefixa 55, com '+'.
export function toClickUpPhone(ph) {
  const digits = (ph || '').toString().replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return '+' + (digits.startsWith('55') ? digits : '55' + digits);
}

export function clickupFetch(path, options, env) {
  return fetch(`${CLICKUP_API}${path}`, {
    ...options,
    headers: {
      Authorization: env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      ...(options && options.headers),
    },
  });
}

// Busca uma task na lista pelo custom field (telefone ou email). Read-only:
// o chamador trata falha como "não achou" — nunca pode travar o lead.
export async function searchClickUpTask(fieldId, value, env) {
  if (!value) return null;
  const cf = encodeURIComponent(JSON.stringify([{ field_id: fieldId, operator: '=', value }]));
  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
  const res = await clickupFetch(`/list/${listId}/task?custom_fields=${cf}`, { method: 'GET' }, env);
  if (!res.ok) throw new Error(`ClickUp search ${res.status}`);
  const data = await res.json();
  return (data.tasks && data.tasks[0]) || null;
}

// Executa uma chamada de escrita com 1 retry em erro transitório
// (429 / 5xx / erro de rede). Erros não-transitórios (ex.: 401) não repetem.
export async function clickupWrite(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res, netErr;
    try { res = await fn(); } catch (e) { netErr = e; }
    if (!netErr && res.ok) return res;
    const status = res ? res.status : 0;
    const retriable = !!netErr || status === 429 || status >= 500;
    if (retriable && attempt === 1) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }
    // Anexa o status HTTP no erro pra quem chama poder reagir (ex.: fallback no 400).
    throw netErr || Object.assign(new Error(`ClickUp write ${status}`), { status });
  }
}

// Aplica uma tag a uma task JÁ existente (POST /task/{id}/tag/{name}). O ClickUp
// cria a tag no Space se ela ainda não existir. Best-effort: falha aqui nunca
// trava o lead — o card/comentário e o lead_dispatch já garantem que nada se perde.
export async function addClickUpTag(taskId, tag, env) {
  if (!taskId || !tag) return;
  try {
    await clickupWrite(() => clickupFetch(
      `/task/${taskId}/tag/${encodeURIComponent(tag)}`, { method: 'POST' }, env));
  } catch (e) {
    console.error('ClickUp add tag error:', e.message);
  }
}

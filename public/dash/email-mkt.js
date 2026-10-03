// E-mail próprio no dash (spec-email-proprio.md). PROTÓTIPOS das issues 373–376.
//
// Só front, com dados de exemplo gerados aqui mesmo: nada chama a API, nada é
// salvo nem enviado. Serve para a usuária navegar pelas telas na prévia e
// aprovar o desenho antes das issues de construção (377–388).
//
// - App Marketing, seção `mkt-email`, sub-vistas por `?v=`: campanhas,
//   relatorio, fluxos, contatos, segmentos, modelos, configuracao.
// - App Agenda, seção `agenda-emails`: e-mails da agenda por tipo de reunião
//   (ligada ao backend na 379).
// - O quadro dos fluxos mora em public/dash/email-fluxos.js.
//
// Padrões de UX copiados do agenda.js: gaveta lateral para o que abre de uma
// linha, aviso curto (toast) para cada ação, engrenagem para ações da linha e
// confirmação na própria linha (pedirConfirmacao do dash). Reusa o CSS `ag-*`.
(() => {
  'use strict';

  const VISTAS = ['campanhas', 'relatorio', 'fluxos', 'contatos', 'segmentos', 'modelos', 'configuracao'];
  // Vistas já ligadas ao backend (377, 378); as outras seguem protótipo.
  const VISTAS_REAIS = ['modelos', 'configuracao'];
  const TITULO_VISTA = {
    campanhas: 'Campanhas de e-mail', relatorio: 'Resultados do e-mail', fluxos: 'Fluxos automáticos',
    contatos: 'Contatos de e-mail', segmentos: 'Segmentos', modelos: 'Modelos de e-mail', configuracao: 'Configuração de e-mail',
  };
  const NOTA_VISTA = {
    campanhas: 'disparos do canal de marketing', relatorio: 'resultado de cada disparo e do canal',
    fluxos: 'sequências que começam sozinhas', contatos: 'quem pode receber marketing',
    segmentos: 'grupos de contatos montados por regra', modelos: 'textos reutilizáveis dos dois canais',
    configuracao: 'remetentes, rodapé e situação do serviço de envio',
  };

  const svg = (corpo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;
  const ICONE = {
    engrenagem: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    fechar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    voltar: svg('<path d="M15 6l-6 6 6 6"/>'),
    computador: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
    celular: svg('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'),
  };

  let ctx = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (n) => Number(n || 0).toLocaleString('pt-BR');
  const pct = (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%';
  const taxa = (a, b, c = 1) => (b ? pct((a / b) * 100, c) : '');

  // ---------------------------------------------------------------------------
  // Cenário do protótipo: deixa ver os estados de erro e de vazio sem backend.
  // ---------------------------------------------------------------------------
  const CENARIOS = [
    ['ok', 'Tudo certo'],
    ['dominio', 'Domínio com problema'],
    ['marketing', 'Marketing não liberado'],
    ['vazio', 'Tudo vazio (primeiro dia)'],
  ];
  let cenario = 'ok';
  const vazio = () => cenario === 'vazio';
  const marketingLiberado = () => cenario !== 'marketing';

  function seloProto(semCenario) {
    return `<div class="em-proto" role="note">
      <span class="em-proto__selo">Protótipo</span>
      <span>Dados de exemplo. Nada aqui é salvo nem enviado.</span>
      ${semCenario ? '' : `<label class="em-proto__cen">Ver estado
        <select data-cenario aria-label="Estado de exemplo">${CENARIOS.map(([v, r]) => `<option value="${v}"${v === cenario ? ' selected' : ''}>${r}</option>`).join('')}</select></label>`}
    </div>`;
  }
  function ligarCenario(raiz, redesenhar) {
    const s = raiz.querySelector('[data-cenario]');
    if (s) s.onchange = () => { cenario = s.value; avisar(`Mostrando: ${CENARIOS.find((c) => c[0] === cenario)[1].toLowerCase()}.`); redesenhar(); };
  }

  // ---------------------------------------------------------------------------
  // Dados de exemplo (determinísticos: a mesma prévia mostra sempre o mesmo)
  // ---------------------------------------------------------------------------
  function aleatorio(semente) {
    let a = semente;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Fábio', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiane', 'Vinícius', 'Juliana', 'Marcos', 'Patrícia', 'Rodrigo', 'Simone', 'Thiago', 'Camila', 'André', 'Letícia', 'Gustavo'];
  const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Holanda', 'Lima', 'Machado', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Rocha', 'Santana', 'Teixeira', 'Vieira', 'Xavier', 'Moraes'];
  const ORIGENS = ['Meta Ads', 'Google Ads', 'Instagram orgânico', 'ManyChat', 'Direto'];
  const FUNIS = [['workshop-gratuito', 'Workshop gratuito'], ['sessao-estrategica', 'Sessão estratégica'], ['aplicacao-mentoria', 'Aplicação mentoria'], ['trafego-atacado', 'Tráfego atacado'], ['materiais', 'Materiais (iscas)']];
  const ESTAGIOS = ['Lead', 'MQL', 'Reunião agendada', 'Reunião realizada', 'Contrato'];
  const SITUACOES = {
    ativo: ['Ativo', 'alta'], descadastrado: ['Descadastrado', 'neutro'], voltou: ['Voltou', 'queda'],
    denunciou: ['Denunciou spam', 'queda'], invalido: ['Inválido', 'alerta'],
  };
  const nomeFunil = (f) => (FUNIS.find((x) => x[0] === f) || [f, f])[1];
  // 20/07/2026 (quando o tracking passou a mandar leads) até hoje, 03/10/2026.
  const INICIO = Date.UTC(2026, 6, 20), HOJE = Date.UTC(2026, 9, 3);
  const dataBR = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const CAMPANHAS_BASE = [
    { id: 'c1', nome: 'Convite workshop 08/10', situacao: 'enviada', modelo: 'm6', segmentos: ['s1'], envio: '01/10 às 09:00', dest: 1912, entregues: 1871, voltaram: 17, spam: 2, abertos: 812, clicados: 214, descad: 9 },
    { id: 'c2', nome: 'Novidade: plano ao vivo', situacao: 'enviada', modelo: 'm12', segmentos: ['s2', 's5'], envio: '24/09 às 10:30', dest: 1240, entregues: 1219, voltaram: 11, spam: 1, abertos: 498, clicados: 96, descad: 6 },
    { id: 'c3', nome: 'Convite workshop 22/10', situacao: 'agendada', modelo: 'm6', segmentos: ['s1', 's3'], envio: '20/10 às 09:00', dest: 2050 },
    { id: 'c4', nome: 'Lembrete aplicação plano ao vivo', situacao: 'enviando', modelo: 'm12', segmentos: ['s2'], envio: 'hoje às 14:00', dest: 860, progresso: 63, falhas: 2 },
    { id: 'c5', nome: 'Black do atacado', situacao: 'rascunho', modelo: 'm10', segmentos: ['s3'], envio: '' },
    { id: 'c6', nome: 'Convite workshop 24/09', situacao: 'cancelada', modelo: 'm6', segmentos: ['s1'], envio: 'era 23/09 às 09:00' },
    { id: 'c7', nome: 'Reengajamento de julho', situacao: 'falhou', modelo: 'm12', segmentos: ['s3'], envio: '18/09 às 11:00', motivo: 'O serviço de envio recusou o disparo: o marketing ainda não estava liberado na conta. Nada foi enviado.' },
  ];
  const SITUACAO_CAMP = {
    rascunho: ['Rascunho', 'neutro'], agendada: ['Agendada', 'alerta'], enviando: ['Enviando', 'alerta'],
    enviada: ['Enviada', 'alta'], cancelada: ['Cancelada', 'neutro'], falhou: ['Falhou', 'queda'],
  };

  const SEGMENTOS_BASE = [
    { id: 's1', nome: 'Leads do workshop gratuito', regras: [{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }] },
    { id: 's2', nome: 'MQLs sem reunião', regras: [{ campo: 'estagio', op: 'e', valor: 'MQL' }] },
    { id: 's3', nome: 'Entraram nos últimos 30 dias', regras: [{ campo: 'entrada', op: 'ultimos', valor: '30' }] },
    { id: 's4', nome: 'Abriram o convite de 01/10', regras: [{ campo: 'abriu', op: 'sim', valor: 'c1' }] },
    { id: 's5', nome: 'Sessão estratégica vindos do Meta', regras: [{ campo: 'origem', op: 'e', valor: 'Meta Ads' }, { campo: 'funil', op: 'e', valor: 'sessao-estrategica' }] },
  ];

  const MODELOS_BASE = [
    { id: 'm1', nome: 'Confirmação de reunião', canal: 'transacional', assunto: 'Sua reunião está confirmada, {{primeiro_nome}}', previa: '{{data_reuniao}} às {{hora_reuniao}}, pelo Google Meet.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nSua **{{tipo_reuniao}}** está confirmada para {{data_reuniao}} às {{hora_reuniao}} (horário de Brasília).\n\n[[Entrar na reunião | {{link_reuniao}}]]\n\nSe precisar mudar o horário, é só [remarcar por aqui]({{link_remarcar}}).\n\nAté lá,\nEquipe Atacado Exponencial' },
    { id: 'm2', nome: 'Lembrete 24h antes', canal: 'transacional', assunto: 'Amanhã: sua {{tipo_reuniao}}', previa: 'Amanhã às {{hora_reuniao}}. Guarde o link.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nPassando para lembrar: sua reunião é **amanhã, às {{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]\n\nEquipe Atacado Exponencial' },
    { id: 'm3', nome: 'Lembrete 1h antes', canal: 'transacional', assunto: 'Começa em 1 hora', previa: 'Às {{hora_reuniao}}, no link de sempre.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}! Sua reunião começa às **{{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]' },
    { id: 'm4', nome: 'Reunião remarcada', canal: 'transacional', assunto: 'Novo horário: {{data_reuniao}} às {{hora_reuniao}}', previa: 'Sua reunião mudou de horário.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nSua reunião mudou para **{{data_reuniao}} às {{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]' },
    { id: 'm5', nome: 'Reunião cancelada', canal: 'transacional', assunto: 'Sua reunião foi cancelada', previa: 'Quer marcar outro horário?', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}.\n\nSua reunião de {{data_reuniao}} foi cancelada. Se quiser, escolha outro horário:\n\n[[Escolher novo horário | {{link_remarcar}}]]' },
    { id: 'm6', nome: 'Convite workshop gratuito', canal: 'marketing', assunto: '{{primeiro_nome}}, o próximo workshop é dia 22', previa: 'Duas horas sobre como vender mais no atacado. Gratuito.', editado: '30/09', corpo: 'Oi, {{primeiro_nome}}!\n\nNo dia **22/10, às 19h**, tem workshop gratuito ao vivo: como montar uma operação de atacado que vende todo mês.\n\n[[Quero participar | https://atacadoexponencial.com/workshop-gratuito]]\n\nUm abraço,\nFelipe Santos' },
    { id: 'm7', nome: 'Boas-vindas workshop 1', canal: 'marketing', assunto: 'Sua vaga no workshop está garantida', previa: 'Veja o que preparar antes do dia.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}!\n\nSua vaga está garantida. Antes do workshop, separe 10 minutos para pensar no seu catálogo atual.\n\n[[Entrar no grupo do workshop | https://atacadoexponencial.com/grupo-workshop]]\n\nFelipe' },
    { id: 'm8', nome: 'Boas-vindas workshop 2', canal: 'marketing', assunto: 'O erro que trava 8 em cada 10 atacadistas', previa: 'Antes do workshop, um aquecimento.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}!\n\nQue bom que você abriu o primeiro e-mail. Hoje, um aquecimento rápido para o workshop.\n\n[[Ler o artigo | https://atacadoexponencial.com/blog]]' },
    { id: 'm9', nome: 'Boas-vindas workshop 1 (outro assunto)', canal: 'marketing', assunto: 'Você ainda não confirmou sua vaga', previa: 'Falta um clique.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}! Vimos que você ainda não abriu nosso e-mail. Sua vaga no workshop está guardada.\n\n[[Entrar no grupo do workshop | https://atacadoexponencial.com/grupo-workshop]]' },
    { id: 'm10', nome: 'Black do atacado', canal: 'marketing', assunto: 'Black do atacado: só até sexta', previa: 'Condição especial para quem já é da base.', editado: '03/10', corpo: 'Oi, {{nmoe}}!\n\nEsta semana tem condição especial para quem já está na nossa base.\n\n[[Ver a condição | https://atacadoexponencial.com]]' },
    { id: 'm11', nome: 'Convite live semanal', canal: 'marketing', assunto: 'Hoje tem live às 20h', previa: 'Ao vivo no Instagram.', editado: '12/08', arquivado: true, corpo: 'Oi, {{primeiro_nome}}! Hoje tem live às 20h.' },
    { id: 'm12', nome: 'Novidade: plano ao vivo', canal: 'marketing', assunto: 'Abrimos as aplicações do plano ao vivo', previa: 'Vagas limitadas, aplicações até 06/10.', editado: '23/09', corpo: 'Oi, {{primeiro_nome}}!\n\nAbrimos as aplicações para o **plano ao vivo de 07/10**.\n\n[[Quero aplicar | https://atacadoexponencial.com/aplicacao]]' },
  ];

  // Estado mutável do protótipo (vive enquanto a página estiver aberta).
  const D = {
    campanhas: CAMPANHAS_BASE.map((c) => ({ ...c })),
    segmentos: SEGMENTOS_BASE.map((s) => ({ ...s, regras: s.regras.map((r) => ({ ...r })) })),
    modelos: MODELOS_BASE.map((m) => ({ ...m })),
    contatos: gerarContatos(),
    config: {
      transacional: { nome: 'Atacado Exponencial', endereco: 'notify@envio.atacadoexponencial.com', resposta: '' },
      marketing: { nome: 'Felipe Santos | Atacado Exponencial', endereco: 'felipe@news.atacadoexponencial.com', resposta: '' },
      rodape: 'Atacado Exponencial · Seteads Agência Ltda.\nAv. Exemplo, 1000, sala 12, São Paulo, SP, 01000-000',
    },
    usoMes: 7840, limiteMes: 10000,
  };

  function gerarContatos() {
    const r = aleatorio(20260703);
    const lista = [];
    const vistos = new Set();
    for (let i = 0; lista.length < 2400; i++) {
      const n = NOMES[Math.floor(r() * NOMES.length)], s = SOBRENOMES[Math.floor(r() * SOBRENOMES.length)];
      let email = `${semAcento(n)}.${semAcento(s)}${i % 7 ? Math.floor(r() * 90 + 10) : ''}@${['gmail.com', 'hotmail.com', 'outlook.com', 'uol.com.br', 'empresa.com.br'][Math.floor(r() * 5)]}`;
      if (vistos.has(email)) continue;
      const x = r();
      const situacao = x < 0.885 ? 'ativo' : x < 0.94 ? 'descadastrado' : x < 0.965 ? 'voltou' : x < 0.972 ? 'denunciou' : x < 0.99 ? 'invalido' : 'ativo';
      if (situacao === 'invalido') email = email.replace('@', r() < 0.5 ? '@@' : ' @').replace('.com', r() < 0.5 ? '.con' : '.com');
      vistos.add(email);
      const entrada = INICIO + Math.floor(r() * (HOJE - INICIO));
      const fi = r();
      const funil = FUNIS[fi < 0.45 ? 0 : fi < 0.7 ? 1 : fi < 0.8 ? 2 : fi < 0.9 ? 3 : 4][0];
      const e = r();
      const estagio = ESTAGIOS[e < 0.6 ? 0 : e < 0.82 ? 1 : e < 0.92 ? 2 : e < 0.98 ? 3 : 4];
      const abriu = [], clicou = [];
      if (entrada < Date.UTC(2026, 8, 30) && funil === 'workshop-gratuito' && r() < 0.43) { abriu.push('c1'); if (r() < 0.26) clicou.push('c1'); }
      if (r() < 0.2) { abriu.push('c2'); if (r() < 0.2) clicou.push('c2'); }
      lista.push({ id: 'p' + i, nome: `${n} ${s}`, email, origem: ORIGENS[Math.floor(r() ** 1.6 * ORIGENS.length)], funil, entrada, estagio, situacao, abriu, clicou });
    }
    return lista;
  }

  const modelo = (id) => D.modelos.find((m) => m.id === id);
  const segmento = (id) => D.segmentos.find((s) => s.id === id);
  const campanha = (id) => D.campanhas.find((c) => c.id === id);

  // Regras de segmento (módulo 5): condições combinadas com "e".
  const CAMPOS_REGRA = {
    funil: { rotulo: 'Funil', ops: [['e', 'é'], ['nao', 'não é']], valores: () => FUNIS },
    origem: { rotulo: 'Origem', ops: [['e', 'é'], ['nao', 'não é']], valores: () => ORIGENS.map((o) => [o, o]) },
    entrada: { rotulo: 'Data de entrada', ops: [['ultimos', 'nos últimos'], ['antes', 'há mais de']], valores: () => [['7', '7 dias'], ['15', '15 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']] },
    estagio: { rotulo: 'Estágio no CRM', ops: [['e', 'é'], ['nao', 'não é']], valores: () => ESTAGIOS.map((e) => [e, e]) },
    abriu: { rotulo: 'Abriu campanha', ops: [['sim', 'abriu'], ['nao', 'não abriu']], valores: () => D.campanhas.filter((c) => c.situacao === 'enviada').map((c) => [c.id, c.nome]) },
    clicou: { rotulo: 'Clicou em campanha', ops: [['sim', 'clicou'], ['nao', 'não clicou']], valores: () => D.campanhas.filter((c) => c.situacao === 'enviada').map((c) => [c.id, c.nome]) },
  };
  function casa(p, r) {
    const v = r.valor;
    switch (r.campo) {
      case 'funil': return (p.funil === v) === (r.op === 'e');
      case 'origem': return (p.origem === v) === (r.op === 'e');
      case 'estagio': return (p.estagio === v) === (r.op === 'e');
      case 'entrada': { const lim = HOJE - Number(v) * 86400000; return r.op === 'ultimos' ? p.entrada >= lim : p.entrada < lim; }
      case 'abriu': return p.abriu.includes(v) === (r.op === 'sim');
      case 'clicou': return p.clicou.includes(v) === (r.op === 'sim');
      default: return true;
    }
  }
  const noSegmento = (regras) => D.contatos.filter((p) => regras.every((r) => casa(p, r)));
  const resumoRegra = (regras) => regras.length ? regras.map((r) => {
    const c = CAMPOS_REGRA[r.campo];
    const op = (c.ops.find((o) => o[0] === r.op) || ['', ''])[1];
    const val = (c.valores().find((o) => o[0] === r.valor) || ['', r.valor])[1];
    return `${c.rotulo.toLowerCase()} ${op} ${val}`;
  }).join(' e ') : 'todos os contatos';

  // ---------------------------------------------------------------------------
  // Toast, engrenagem e gaveta (mesmo desenho do agenda.js, CSS ag-*)
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto, tipo = 'ok') {
    let t = document.getElementById('em-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'em-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('em-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    t.dataset.tipo = tipo;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), tipo === 'erro' ? 5200 : 3000);
  }

  function menuHtml(rotulo, itens) {
    return `<div class="ag-menu">
      <button class="ag-engrenagem" type="button" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Opções de ${esc(rotulo)}">${ICONE.engrenagem}</button>
      <div class="ag-menu__lista" role="menu" hidden>
        ${itens.filter(Boolean).map((i) => `<button type="button" role="menuitem"${i.perigo ? ' class="perigo"' : ''} data-acao="${i.acao}" data-id="${esc(i.id)}">${esc(i.rotulo)}</button>`).join('')}
      </div></div>`;
  }
  function fecharMenus() {
    document.querySelectorAll('.ag-menu__lista').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function alternarMenu(botao) {
    const lista = botao.nextElementSibling;
    const abrir = lista.hidden;
    fecharMenus();
    if (!abrir) return;
    lista.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    const r = botao.getBoundingClientRect();
    const acima = window.innerHeight - r.bottom < lista.offsetHeight + 16;
    lista.style.top = (acima ? r.top - lista.offsetHeight - 4 : r.bottom + 4) + 'px';
    lista.style.left = Math.max(8, r.right - lista.offsetWidth) + 'px';
    lista.querySelector('button').focus();
  }
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.ag-menu')) fecharMenus(); });

  /** Cliques de um contêiner: engrenagem abre o menu; [data-acao] chama acoes[acao](id, botão). */
  function ligarAcoes(container, acoes) {
    container.addEventListener('click', (ev) => {
      const b = ev.target.closest('button, a[data-acao]');
      if (!b || !container.contains(b)) return;
      if (b.hasAttribute('data-menu')) return alternarMenu(b);
      const acao = b.dataset.acao;
      if (!acao || !acoes[acao]) return;
      ev.preventDefault();
      if (!b.classList.contains('perigo') || !b.closest('.ag-menu__lista')) fecharMenus();
      acoes[acao](b.dataset.id, b);
    });
  }

  function abrirGaveta(largura) {
    let g = document.getElementById('em-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'em-gaveta';
      g.className = 'ag-gaveta em-gaveta';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    g.classList.toggle('em-gaveta--larga', largura === 'larga');
    if (!g.open) g.showModal();
    return g;
  }
  function gaveta({ titulo, sub = '', corpo, rodape = '', largura }) {
    const g = abrirGaveta(largura);
    g.innerHTML = `<div class="ag-gaveta__form ag-gaveta__form--simples">
      <header class="ag-gaveta__topo">
        <div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">${ICONE.fechar}</button>
      </header>
      <div class="ag-gaveta__corpo">${corpo}</div>
      ${rodape ? `<footer class="ag-gaveta__rodape">${rodape}</footer>` : ''}
    </div>`;
    g.querySelector('[data-fechar]').onclick = () => g.close();
    return g;
  }
  const fecharGaveta = () => { const g = document.getElementById('em-gaveta'); if (g && g.open) g.close(); };

  const carimbo = (mapa, k) => { const [r, c] = mapa[k] || [k, 'neutro']; return `<span class="carimbo ${c}">${esc(r)}</span>`; };
  const chave = (ligado, attrs, rotulo) => `<label class="em-chave"><input type="checkbox" ${attrs}${ligado ? ' checked' : ''}><span class="em-chave__trilho" aria-hidden="true"></span><span class="em-chave__rot">${rotulo || (ligado ? 'Ligado' : 'Desligado')}</span></label>`;

  // ---------------------------------------------------------------------------
  // Render e navegação
  // ---------------------------------------------------------------------------
  const api = {
    vista: 'campanhas',
    lerVista(v) { api.vista = VISTAS.includes(v) ? v : 'campanhas'; },
    render,
    renderAgenda,
    // Para o quadro dos fluxos (email-fluxos.js).
    util: { esc, int, pct, avisar, gaveta, fecharGaveta, menuHtml, ligarAcoes, carimbo, chave, seloProto, ICONE, abrirContato: (id) => detalheContato(id) },
    dados: D,
    nomeFunil, FUNIS, ORIGENS, ESTAGIOS,
  };
  window.EmailMkt = api;

  function irPara(v) { api.vista = v; ctx.escreverUrl(); ctx.rerender(); }
  const raiz = () => ctx.$('#mkt-email-conteudo');

  function render(c) {
    ctx = c;
    fecharGaveta();
    ctx.$('#titulo').textContent = TITULO_VISTA[api.vista];
    ctx.$('#subtitulo').textContent = NOTA_VISTA[api.vista] + (VISTAS_REAIS.includes(api.vista) ? '' : ' · protótipo');
    const el = raiz();
    el.className = 'em em--' + api.vista;
    ({ campanhas, relatorio, fluxos, contatos, segmentos, modelos, configuracao })[api.vista](el);
  }

  // ===========================================================================
  // 375 · Campanhas
  // ===========================================================================
  let filtroCamp = '';
  function avisoLimite() {
    const resta = D.limiteMes - D.usoMes;
    const p = (D.usoMes / D.limiteMes) * 100;
    return `<div class="em-limite">
      <div class="em-limite__txt"><b>${int(D.usoMes)}</b> de ${int(D.limiteMes)} e-mails usados em outubro <span class="mini">· restam ${int(resta)} · renova em 01/11</span></div>
      <div class="regua" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></div>
    </div>`;
  }
  function avisoMarketing() {
    return marketingLiberado() ? '' : `<div class="aviso alerta"><b>Disparos de marketing bloqueados.</b> O serviço de envio ainda não liberou o marketing nesta conta. Dá para montar e agendar, mas o botão de disparo só funciona depois da liberação. <a href="#mkt-email?v=configuracao">Ver configuração</a></div>`;
  }

  function campanhas(el) {
    const lista = vazio() ? [] : D.campanhas;
    const cont = Object.fromEntries(Object.keys(SITUACAO_CAMP).map((k) => [k, lista.filter((c) => c.situacao === k).length]));
    const linhas = lista.filter((c) => !filtroCamp || c.situacao === filtroCamp);
    el.innerHTML = `${seloProto()}
      <div class="em-barra">
        <div class="ig-vistas" role="group" aria-label="Campanhas ou visão geral">
          <button type="button" class="tipo-pill" aria-pressed="true">Campanhas</button>
          <button type="button" class="tipo-pill" aria-pressed="false" data-ir="relatorio">Visão geral do canal</button>
        </div>
        <button class="btn" type="button" data-nova>Nova campanha</button>
      </div>
      ${avisoMarketing()}
      ${D.usoMes / D.limiteMes > 0.75 && !vazio() ? `<div class="aviso alerta">Já foram ${pct((D.usoMes / D.limiteMes) * 100, 0)} do limite do mês. A campanha agendada de 20/10 (${int(2050)} pessoas) não cabe no que resta: ela vai ser barrada antes de sair, a não ser que o limite renove ou o segmento diminua.</div>` : ''}
      ${avisoLimite()}
      <div class="ag-subvistas" role="group" aria-label="Filtrar por situação">
        <button type="button" class="ag-subvista" data-filtro="" aria-pressed="${!filtroCamp}">Todas <span class="ag-cont">${lista.length}</span></button>
        ${Object.entries(SITUACAO_CAMP).map(([k, [r]]) => `<button type="button" class="ag-subvista" data-filtro="${k}" aria-pressed="${filtroCamp === k}">${r} <span class="ag-cont${k === 'falhou' && cont[k] ? ' alerta' : ''}">${cont[k]}</span></button>`).join('')}
      </div>
      <div class="tabela-wrap" id="em-camp-lista"></div>`;
    ligarCenario(el, () => campanhas(el));
    el.querySelector('[data-ir="relatorio"]').onclick = () => { campanhaRelatorio = null; irPara('relatorio'); };
    el.querySelector('[data-nova]').onclick = () => formCampanha(null);
    el.querySelectorAll('[data-filtro]').forEach((b) => { b.onclick = () => { filtroCamp = b.dataset.filtro; campanhas(el); }; });
    const alvo = el.querySelector('#em-camp-lista');
    ctx.tabela(alvo, [
      { titulo: 'Campanha', campo: 'nome', render: (c) => `<button type="button" class="ag-link-linha" data-acao="abrir" data-id="${c.id}">${esc(c.nome)}</button>` },
      { titulo: 'Situação', campo: 'situacao', render: (c) => c.situacao === 'enviando'
        ? `<span data-prog="${c.id}"><span class="em-progresso" title="${c.progresso}% enviado"><span style="width:${c.progresso}%"></span></span> <b>${c.progresso}%</b></span>`
        : carimbo(SITUACAO_CAMP, c.situacao) },
      { titulo: 'Segmentos', render: (c) => `<span class="mini">${c.segmentos.map((s) => esc((segmento(s) || {}).nome || 's')).join(' + ')}</span>` },
      { titulo: 'Envio', render: (c) => esc(c.envio || 'sem data') },
      { titulo: 'Destinatários', num: true, campo: 'dest', render: (c) => c.dest ? int(c.dest) : '' },
      { titulo: 'Abertura', num: true, render: (c) => c.abertos ? taxa(c.abertos, c.entregues) : '' },
      { titulo: 'Clique', num: true, render: (c) => c.clicados ? taxa(c.clicados, c.entregues) : '' },
      { titulo: '', render: (c) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(c.nome, [
        { acao: 'abrir', id: c.id, rotulo: c.situacao === 'rascunho' ? 'Editar' : 'Abrir' },
        c.situacao === 'enviada' && { acao: 'relatorio', id: c.id, rotulo: 'Ver relatório' },
        c.situacao === 'agendada' && { acao: 'editar', id: c.id, rotulo: 'Editar' },
        { acao: 'teste', id: c.id, rotulo: 'Mandar teste' },
        { acao: 'duplicar', id: c.id, rotulo: 'Duplicar' },
        c.situacao === 'agendada' && { acao: 'cancelar', id: c.id, rotulo: 'Cancelar envio', perigo: true },
        c.situacao === 'rascunho' && { acao: 'excluir', id: c.id, rotulo: 'Excluir rascunho', perigo: true },
      ])}</div>` },
    ], linhas, undefined, vazio() ? 'Nenhuma campanha ainda. Comece por "Nova campanha": escolha um modelo, um ou mais segmentos e mande um teste antes de disparar.' : 'Nenhuma campanha nesta situação.');
    ligarAcoes(alvo, {
      abrir: (id) => abrirCampanha(id),
      editar: (id) => formCampanha(campanha(id)),
      relatorio: (id) => { campanhaRelatorio = id; irPara('relatorio'); },
      teste: (id) => avisar(`Teste de "${campanha(id).nome}" mandado para felipe@seteads.com.`),
      duplicar: (id) => {
        const c = campanha(id);
        D.campanhas.unshift({ id: 'c' + Date.now(), nome: c.nome + ' (cópia)', situacao: 'rascunho', modelo: c.modelo, segmentos: [...c.segmentos], envio: '' });
        filtroCamp = '';
        avisar('Campanha duplicada como rascunho.');
        campanhas(el);
      },
      cancelar: (id, b) => ctx.pedirConfirmacao(b, 'Cancelar o envio agendado?', () => {
        const c = campanha(id); c.situacao = 'cancelada'; c.envio = 'era ' + c.envio;
        fecharMenus(); avisar('Envio cancelado. Ninguém recebeu.'); campanhas(el);
      }),
      excluir: (id, b) => ctx.pedirConfirmacao(b, 'Excluir este rascunho?', () => {
        D.campanhas = D.campanhas.filter((c) => c.id !== id);
        fecharMenus(); avisar('Rascunho excluído.'); campanhas(el);
      }),
    });
  }

  function abrirCampanha(id) {
    const c = campanha(id);
    if (c.situacao === 'rascunho') return formCampanha(c);
    if (c.situacao === 'enviada') { campanhaRelatorio = id; return irPara('relatorio'); }
    const m = modelo(c.modelo);
    const base = `<dl class="ag-dl">
        <dt>Situação</dt><dd>${carimbo(SITUACAO_CAMP, c.situacao)}</dd>
        <dt>Modelo</dt><dd>${esc(m.nome)}<br><span class="mini">${esc(m.assunto)}</span></dd>
        <dt>Segmentos</dt><dd>${c.segmentos.map((s) => esc(segmento(s).nome)).join('<br>')}</dd>
        <dt>Envio</dt><dd>${esc(c.envio)}</dd>
        ${c.dest ? `<dt>Destinatários</dt><dd>${int(c.dest)}</dd>` : ''}
      </dl>`;
    let extra = '', rodape = '';
    if (c.situacao === 'enviando') {
      extra = `<div class="em-andamento"><div class="em-andamento__num"><b>${c.progresso}%</b> enviado</div>
        <span class="em-progresso em-progresso--grande"><span style="width:${c.progresso}%"></span></span>
        <p class="mini">${int(Math.round((c.dest * c.progresso) / 100))} de ${int(c.dest)} já saíram · ${c.falhas} falhas até agora (endereço recusado na hora). O número sobe sozinho conforme o serviço confirma.</p></div>`;
    } else if (c.situacao === 'falhou') {
      extra = `<div class="aviso falha"><b>Motivo:</b> ${esc(c.motivo)}</div><p class="mini">Uma campanha que falha nunca sai pela metade sem aviso: ou sai inteira, ou fica parada aqui com o motivo.</p>`;
      rodape = '<div class="ag-acoes"><button class="btn sec" type="button" data-dup>Duplicar para tentar de novo</button></div>';
    } else if (c.situacao === 'agendada') {
      extra = '<p class="mini">Sai sozinha no horário. O segmento é recalculado na hora do envio: quem entrar até lá também recebe, e quem se descadastrar nesse meio tempo não recebe.</p>';
      rodape = '<div class="ag-acoes"><button class="btn" type="button" data-editar>Editar</button><button class="btn perigo" type="button" data-cancelar>Cancelar envio</button></div>';
    } else if (c.situacao === 'cancelada') {
      extra = '<p class="mini">Cancelada antes do horário. Ninguém recebeu.</p>';
      rodape = '<div class="ag-acoes"><button class="btn sec" type="button" data-dup>Duplicar</button></div>';
    }
    const g = gaveta({ titulo: esc(c.nome), sub: 'campanha de marketing', corpo: base + extra, rodape });
    const dup = g.querySelector('[data-dup]');
    if (dup) dup.onclick = () => { D.campanhas.unshift({ id: 'c' + Date.now(), nome: c.nome + ' (cópia)', situacao: 'rascunho', modelo: c.modelo, segmentos: [...c.segmentos], envio: '' }); g.close(); avisar('Campanha duplicada como rascunho.'); ctx.rerender(); };
    const ed = g.querySelector('[data-editar]');
    if (ed) ed.onclick = () => formCampanha(c);
    const ca = g.querySelector('[data-cancelar]');
    if (ca) ca.onclick = () => ctx.pedirConfirmacao(ca, 'Cancelar o envio?', () => { c.situacao = 'cancelada'; c.envio = 'era ' + c.envio; g.close(); avisar('Envio cancelado. Ninguém recebeu.'); ctx.rerender(); });
  }

  /** Quem recebe e quem fica de fora (módulo 6): segmentos somados, sem repetir pessoa. */
  function publicoCampanha(segIds) {
    const porPessoa = new Map();
    segIds.forEach((s) => noSegmento(segmento(s).regras).forEach((p) => porPessoa.set(p.id, (porPessoa.get(p.id) || 0) + 1)));
    const pessoas = [...porPessoa.keys()].map((id) => D.contatos.find((p) => p.id === id));
    const fora = { descadastrado: 0, voltou: 0, denunciou: 0, invalido: 0 };
    pessoas.forEach((p) => { if (p.situacao !== 'ativo') fora[p.situacao]++; });
    return { recebem: pessoas.filter((p) => p.situacao === 'ativo').length, emDois: [...porPessoa.values()].filter((n) => n > 1).length, fora };
  }

  function formCampanha(c) {
    const nova = !c;
    c = c || { id: 'c' + Date.now(), nome: '', situacao: 'rascunho', modelo: '', segmentos: [], envio: '' };
    const marketing = D.modelos.filter((m) => m.canal === 'marketing' && !m.arquivado);
    const cfg = D.config.marketing;
    const corpo = `<form class="ag-form em-form" id="em-camp-form" novalidate>
        <label>Nome interno<input type="text" name="nome" value="${esc(c.nome)}" placeholder="Ex.: Convite workshop 05/11" required></label>
        <label>Modelo<select name="modelo"><option value="">Escolha um modelo</option>${marketing.map((m) => `<option value="${m.id}"${m.id === c.modelo ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>
        <div class="em-previa-assunto" id="em-camp-assunto"></div>
        <fieldset><legend>Segmentos (um ou mais)</legend>
          ${D.segmentos.map((s) => `<label class="marca"><input type="checkbox" name="seg" value="${s.id}"${c.segmentos.includes(s.id) ? ' checked' : ''}> ${esc(s.nome)} <span class="mini">${int(noSegmento(s.regras).filter((p) => p.situacao === 'ativo').length)} ativos</span></label>`).join('')}
        </fieldset>
        <label>Remetente<input type="text" value="${esc(cfg.nome)} <${esc(cfg.endereco)}>" readonly><span class="mini">Vem da configuração de e-mail.</span></label>
        <fieldset><legend>Quando enviar</legend>
          <label class="marca"><input type="radio" name="quando" value="agora" checked> Agora, depois do resumo</label>
          <label class="marca"><input type="radio" name="quando" value="agendar"> Agendar para data e hora</label>
          <input type="datetime-local" name="data" value="2026-10-20T09:00" hidden>
        </fieldset>
      </form>
      <div id="em-camp-resumo"></div>`;
    const g = gaveta({
      titulo: nova ? 'Nova campanha' : esc(c.nome || 'Rascunho'), sub: c.situacao === 'agendada' ? 'campanha agendada: dá para editar até o horário' : 'rascunho salvo sozinho a cada mudança',
      corpo,
      rodape: `<div class="ag-acoes"><button class="btn" type="button" data-revisar>Revisar e disparar</button><button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn sec" type="button" data-salvar>Salvar rascunho</button></div>`,
    });
    const f = g.querySelector('#em-camp-form');
    const dados = () => ({ nome: f.nome.value.trim(), modelo: f.modelo.value, segmentos: [...f.querySelectorAll('[name="seg"]:checked')].map((i) => i.value), quando: f.quando.value, data: f.data.value });
    const atualizar = () => {
      const d = dados();
      const m = modelo(d.modelo);
      g.querySelector('#em-camp-assunto').innerHTML = m ? `<span class="mini">Assunto</span> <b>${esc(m.assunto)}</b><br><span class="mini">${esc(m.previa)}</span>` : '';
      f.data.hidden = d.quando !== 'agendar';
      g.querySelector('[data-revisar]').textContent = d.quando === 'agendar' ? 'Revisar e agendar' : 'Revisar e disparar';
      g.querySelector('#em-camp-resumo').innerHTML = '';
    };
    f.addEventListener('input', atualizar);
    f.addEventListener('change', atualizar);
    atualizar();
    const salvar = () => {
      const d = dados();
      Object.assign(c, { nome: d.nome || 'Rascunho sem nome', modelo: d.modelo || 'm6', segmentos: d.segmentos });
      if (nova && !D.campanhas.includes(c)) D.campanhas.unshift(c);
    };
    g.querySelector('[data-salvar]').onclick = () => { salvar(); g.close(); avisar('Rascunho salvo.'); ctx.rerender(); };
    g.querySelector('[data-teste]').onclick = () => {
      if (!f.modelo.value) return avisar('Escolha o modelo antes de mandar o teste.', 'erro');
      avisar('Teste mandado para felipe@seteads.com. Os campos usam os dados de exemplo.');
    };
    g.querySelector('[data-revisar]').onclick = () => {
      const d = dados();
      const falta = [!d.nome && 'o nome', !d.modelo && 'o modelo', !d.segmentos.length && 'ao menos um segmento'].filter(Boolean);
      if (falta.length) return avisar(`Falta escolher ${falta.join(', ')}.`, 'erro');
      const pub = publicoCampanha(d.segmentos);
      const resta = D.limiteMes - D.usoMes;
      const passa = pub.recebem > resta;
      const totFora = Object.values(pub.fora).reduce((a, b) => a + b, 0);
      const bloqueio = !marketingLiberado() ? 'O marketing ainda não foi liberado pelo serviço de envio. O disparo fica bloqueado até lá.'
        : passa ? `Este envio tem ${int(pub.recebem)} pessoas e restam ${int(resta)} e-mails no mês. Diminua o segmento ou espere o limite renovar em 01/11.` : '';
      const agendar = d.quando === 'agendar';
      const quandoTxt = agendar ? new Date(d.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'agora';
      g.querySelector('#em-camp-resumo').innerHTML = `<div class="em-resumo">
        <h3 class="ag-h3">Resumo antes de ${agendar ? 'agendar' : 'disparar'}</h3>
        <div class="em-resumo__grande"><b>${int(pub.recebem)}</b> pessoas vão receber</div>
        ${pub.emDois ? `<p class="mini">${int(pub.emDois)} estão em mais de um segmento escolhido e recebem uma vez só.</p>` : ''}
        <p><b>${int(totFora)}</b> ficam de fora:</p>
        <ul class="em-fora">
          <li><span>Descadastrados</span><b>${int(pub.fora.descadastrado)}</b></li>
          <li><span>Voltaram (endereço não existe)</span><b>${int(pub.fora.voltou)}</b></li>
          <li><span>Denunciaram spam</span><b>${int(pub.fora.denunciou)}</b></li>
          <li><span>Endereço inválido</span><b>${int(pub.fora.invalido)}</b></li>
        </ul>
        <p class="mini">Limite do mês: ${int(D.usoMes)} usados, restam ${int(resta)}.${agendar ? ' Na hora do envio o segmento é recalculado.' : ''}</p>
        ${bloqueio ? `<div class="aviso alerta">${esc(bloqueio)}</div>` : ''}
        <div class="ag-acoes"><button class="btn" type="button" data-disparar${bloqueio ? ' disabled' : ''}>${agendar ? `Agendar para ${quandoTxt}` : `Disparar para ${int(pub.recebem)} pessoas`}</button></div>
      </div>`;
      const corpoG = g.querySelector('.ag-gaveta__corpo');
      corpoG.scrollTop = corpoG.scrollHeight;
      const b = g.querySelector('[data-disparar]');
      b.onclick = () => ctx.pedirConfirmacao(b, agendar ? `Agendar para ${quandoTxt}?` : `Disparar agora para ${int(pub.recebem)} pessoas? Não dá para desfazer.`, () => {
        salvar();
        if (agendar) { c.situacao = 'agendada'; c.envio = quandoTxt.replace(', ', ' às '); c.dest = pub.recebem; }
        else { c.situacao = 'enviando'; c.envio = 'agora'; c.dest = pub.recebem; c.progresso = 4; c.falhas = 0; simularEnvio(c); }
        g.close();
        filtroCamp = '';
        avisar(agendar ? `Agendada para ${quandoTxt}.` : `Disparo iniciado para ${int(pub.recebem)} pessoas.`);
        ctx.rerender();
      }, [{ valor: true, rotulo: agendar ? 'Agendar' : 'Disparar' }]);
    };
  }

  // Andamento do envio: o percentual sobe sozinho na lista (simulado).
  function simularEnvio(c) {
    const t = setInterval(() => {
      c.progresso = Math.min(100, c.progresso + 9 + Math.round(Math.random() * 8));
      if (Math.random() < 0.3) c.falhas++;
      if (c.progresso >= 100) {
        clearInterval(t);
        Object.assign(c, { situacao: 'enviada', envio: 'hoje', entregues: c.dest - c.falhas - 3, voltaram: c.falhas + 3, spam: 0, abertos: 0, clicados: 0, descad: 0 });
        avisar(`"${c.nome}" terminou de sair.`);
      }
      // Só o percentual muda na tela; a lista inteira é redesenhada no fim,
      // e só se ninguém estiver com menu ou gaveta aberta.
      const cel = document.querySelector(`[data-prog="${c.id}"]`);
      if (cel && c.situacao === 'enviando') cel.innerHTML = `<span class="em-progresso"><span style="width:${c.progresso}%"></span></span> <b>${c.progresso}%</b>`;
      const ocupado = document.querySelector('.ag-menu__lista:not([hidden]), dialog[open], .confirma');
      if (c.situacao !== 'enviando' && cel && !ocupado) campanhas(raiz());
    }, 1400);
  }

  // ===========================================================================
  // 375 · Relatório da campanha e visão geral do canal
  // ===========================================================================
  let campanhaRelatorio = null;
  let filtroRel = 'abriram';
  let periodoCanal = 'mes';

  function relatorio(el) {
    if (campanhaRelatorio && campanha(campanhaRelatorio)) return relatorioCampanha(el, campanha(campanhaRelatorio));
    const PER = { mes: ['Outubro até hoje', 1], 'mes-passado': ['Setembro', 3.1], '90': ['Últimos 90 dias', 6.4] };
    const [perRot, f] = PER[periodoCanal];
    const enviadas = vazio() ? [] : D.campanhas.filter((c) => c.situacao === 'enviada');
    const ruim = cenario === 'dominio';
    const enviados = vazio() ? 0 : Math.round(D.usoMes * f), entreg = Math.round(enviados * 0.978);
    const spam = ruim ? 0.14 : 0.04, volta = ruim ? 4.6 : 1.1, desc = 0.48;
    el.innerHTML = `${seloProto()}
      <div class="em-barra">
        <div class="ig-vistas" role="group" aria-label="Campanhas ou visão geral">
          <button type="button" class="tipo-pill" aria-pressed="false" data-ir="campanhas">Campanhas</button>
          <button type="button" class="tipo-pill" aria-pressed="true">Visão geral do canal</button>
        </div>
        <select data-periodo aria-label="Período">${Object.entries(PER).map(([k, [r]]) => `<option value="${k}"${k === periodoCanal ? ' selected' : ''}>${r}</option>`).join('')}</select>
      </div>
      ${ruim ? `<div class="aviso alerta"><b>Alerta de reputação.</b> A taxa de spam (${pct(spam, 2)}) passou do limite aceito pelo serviço de envio (0,10%) e a devolução (${pct(volta, 1)}) está acima de 4%. Revise os segmentos antes do próximo disparo. Este alerta também vai para o aviso diário de integrações.</div>` : ''}
      <div class="metas em-metas">
        <div class="metas-cabeca"><h2>Limite do plano</h2><span class="mini">${int(D.usoMes)} de ${int(D.limiteMes)} e-mails em outubro · renova em 01/11</span></div>
        <div class="meta"><h3>E-mails enviados no mês <span>${pct((D.usoMes / D.limiteMes) * 100, 0)}</span></h3>
          <div class="regua"><i style="width:${(D.usoMes / D.limiteMes) * 100}%"></i><b style="left:92%" title="projeção para o fim do mês"></b></div>
          <div class="mini"><span>marketing ${int(D.usoMes - 410)} · agenda ${int(410)}</span><span>projeção para 31/10: ${int(9200)}</span></div></div>
      </div>
      <div class="grid-etiquetas">
        ${[
          { rotulo: 'E-mails enviados', valor: int(enviados), nota: perRot.toLowerCase() },
          { rotulo: 'Taxa de entrega', valor: vazio() ? null : pct(97.8), nota: vazio() ? 'nenhum envio ainda' : `${int(entreg)} entregues` },
          { rotulo: 'Taxa de spam', valor: vazio() ? null : pct(spam, 2), nota: `limite do serviço: 0,10%${ruim ? ' · ACIMA' : ''}` },
          { rotulo: 'Devolução', valor: vazio() ? null : pct(volta), nota: 'endereço que não existe' },
          { rotulo: 'Descadastro', valor: vazio() ? null : pct(desc, 2), nota: 'por e-mail entregue' },
        ].map((k) => ctx.tile(k)).join('')}
      </div>
      <div class="bloco"><h2>Campanhas enviadas <small>clique para abrir o relatório</small></h2><div class="tabela-wrap" id="em-rel-lista"></div></div>`;
    ligarCenario(el, () => relatorio(el));
    el.querySelector('[data-ir="campanhas"]').onclick = () => irPara('campanhas');
    el.querySelector('[data-periodo]').onchange = (e) => { periodoCanal = e.target.value; relatorio(el); };
    ctx.tabela(el.querySelector('#em-rel-lista'), [
      { titulo: 'Campanha', campo: 'nome', render: (c) => `<b>${esc(c.nome)}</b>` },
      { titulo: 'Envio', render: (c) => esc(c.envio) },
      { titulo: 'Entregues', num: true, campo: 'entregues', render: (c) => int(c.entregues) },
      { titulo: 'Abertura', num: true, render: (c) => taxa(c.abertos, c.entregues) },
      { titulo: 'Clique', num: true, render: (c) => taxa(c.clicados, c.entregues) },
      { titulo: 'Descadastro', num: true, render: (c) => taxa(c.descad, c.entregues, 2) },
    ], enviadas, (c) => { campanhaRelatorio = c.id; relatorio(el); window.scrollTo(0, 0); }, 'Nenhuma campanha enviada no período. Os resultados aparecem aqui conforme o serviço de envio avisa.');
  }

  function relatorioCampanha(el, c) {
    const LINKS = c.id === 'c1'
      ? [['atacadoexponencial.com/workshop-gratuito', 188], ['atacadoexponencial.com/grupo-workshop', 41], ['instagram.com/atacadoexponencial', 12]]
      : [['atacadoexponencial.com/aplicacao', 84], ['atacadoexponencial.com/plano-ao-vivo', 19]];
    const maior = Math.max(...LINKS.map((l) => l[1]), 1);
    const r = aleatorio(c.id.length * 97 + c.dest);
    const amostra = D.contatos.slice(0, 400).filter(() => r() < 0.5);
    const pessoas = {
      abriram: amostra.slice(0, 24).map((p, i) => ({ ...p, quando: `${dataBR(Date.UTC(2026, 9, 1))} ${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}` })),
      clicaram: amostra.slice(0, 9).map((p, i) => ({ ...p, quando: LINKS[i % LINKS.length][0] })),
      voltaram: amostra.slice(40, 46).map((p, i) => ({ ...p, quando: i % 3 ? 'endereço não existe' : 'caixa cheia' })),
      descadastraram: amostra.slice(60, 64).map((p) => ({ ...p, quando: 'pelo link do rodapé' })),
    };
    const ROT = { abriram: 'Abriram', clicaram: 'Clicaram', voltaram: 'Voltaram', descadastraram: 'Descadastraram' };
    el.innerHTML = `${seloProto(true)}
      <div class="em-barra"><button class="btn sec em-voltar" type="button" data-voltar>${ICONE.voltar} Visão geral</button>
        <span class="mini">atualiza sozinho conforme os resultados chegam · última atualização há 4 min</span></div>
      <div class="em-rel-cabeca"><h2>${esc(c.nome)}</h2><p class="mini">Enviada em ${esc(c.envio)} · ${c.segmentos.map((s) => esc(segmento(s).nome)).join(' + ')} · modelo "${esc(modelo(c.modelo).nome)}"</p></div>
      <div class="grid-etiquetas">${[
        { rotulo: 'Destinatários', valor: int(c.dest) },
        { rotulo: 'Entregues', valor: int(c.entregues), nota: `entrega ${taxa(c.entregues, c.dest)}` },
        { rotulo: 'Aberturas', valor: int(c.abertos), nota: `${taxa(c.abertos, c.entregues)} · pessoas únicas` },
        { rotulo: 'Cliques', valor: int(c.clicados), nota: `${taxa(c.clicados, c.entregues)} · pessoas únicas` },
      ].map((k) => ctx.tile(k, true)).join('')}</div>
      <div class="em-numeros">
        <div><span>Voltaram</span><b>${int(c.voltaram)}</b><small>${taxa(c.voltaram, c.dest)}</small></div>
        <div><span>Spam</span><b>${int(c.spam)}</b><small>${taxa(c.spam, c.entregues, 2)}</small></div>
        <div><span>Descadastros</span><b>${int(c.descad)}</b><small>${taxa(c.descad, c.entregues, 2)}</small></div>
        <div><span>Clique sobre abertura</span><b>${taxa(c.clicados, c.abertos)}</b><small>de quem abriu</small></div>
      </div>
      <div class="duas">
        <div class="bloco"><h2>Quem fez o quê <small>clique no nome para abrir o contato</small></h2>
          <div class="ag-subvistas" role="group" aria-label="Filtrar pessoas">
            ${Object.entries(ROT).map(([k, rot]) => `<button type="button" class="ag-subvista" data-rel="${k}" aria-pressed="${k === filtroRel}">${rot} <span class="ag-cont">${k === 'abriram' ? int(c.abertos) : k === 'clicaram' ? int(c.clicados) : k === 'voltaram' ? int(c.voltaram) : int(c.descad)}</span></button>`).join('')}
          </div>
          <div class="tabela-wrap" id="em-rel-pessoas"></div>
          <p class="mini">Mostrando as primeiras pessoas da lista.</p>
        </div>
        <div class="bloco"><h2>Links clicados <small>pessoas únicas</small></h2>
          <table><tbody>${LINKS.map(([u, n]) => `<tr><td class="em-link-url">${esc(u)}</td><td class="num"><span class="proporcao" style="width:${Math.round((n / maior) * 80)}px"></span>${int(n)}</td></tr>`).join('')}</tbody></table>
        </div>
      </div>`;
    el.querySelector('[data-voltar]').onclick = () => { campanhaRelatorio = null; relatorio(el); };
    const desenhar = () => ctx.tabela(el.querySelector('#em-rel-pessoas'), [
      { titulo: 'Pessoa', render: (p) => `<button type="button" class="ag-link-linha" data-contato="${p.id}">${esc(p.nome)}</button><br><span class="mini">${esc(p.email)}</span>` },
      { titulo: filtroRel === 'clicaram' ? 'Link' : filtroRel === 'abriram' ? 'Quando' : 'Motivo', render: (p) => `<span class="mini">${esc(p.quando)}</span>` },
    ], pessoas[filtroRel], undefined, 'Ninguém aqui.');
    desenhar();
    el.querySelectorAll('[data-rel]').forEach((b) => { b.onclick = () => { filtroRel = b.dataset.rel; el.querySelectorAll('[data-rel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenhar(); }; });
    el.querySelector('#em-rel-pessoas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-contato]'); if (b) detalheContato(b.dataset.contato); });
  }

  // ===========================================================================
  // 376 · Fluxos (quadro em email-fluxos.js)
  // ===========================================================================
  function fluxos(el) {
    if (!window.EmailFluxos) { el.innerHTML = '<div class="aviso falha">O quadro dos fluxos não carregou.</div>'; return; }
    window.EmailFluxos.render(el, ctx, { vazio: vazio() });
  }

  // ===========================================================================
  // 374 · Contatos
  // ===========================================================================
  const filtroCont = { busca: '', situacao: '', origem: '', funil: '' };
  let limiteLista = 50;

  function contatos(el) {
    const todos = vazio() ? [] : D.contatos;
    const conta = (s) => todos.filter((p) => p.situacao === s).length;
    el.innerHTML = `${seloProto()}
      <div class="grid-etiquetas">${[
        { rotulo: 'Contatos ativos', valor: int(conta('ativo')), nota: 'podem receber marketing' },
        { rotulo: 'Total de contatos', valor: int(todos.length), nota: 'leads do tracking desde 20/07' },
        { rotulo: 'Fora do marketing', valor: int(todos.length - conta('ativo')), nota: `${int(conta('descadastrado'))} descad. · ${int(conta('voltou'))} voltaram · ${int(conta('denunciou'))} spam · ${int(conta('invalido'))} inválidos` },
      ].map((k) => ctx.tile(k)).join('')}</div>
      ${vazio() ? '<div class="aviso explica">Os contatos chegam sozinhos: na primeira carga entram os leads que já existem no tracking, e depois cada lead novo de formulário vira contato na hora. Mesmo e-mail é sempre um contato só.</div>' : ''}
      <div class="em-filtros">
        <input type="search" data-f="busca" placeholder="Buscar por nome ou e-mail" aria-label="Buscar contato" value="${esc(filtroCont.busca)}">
        <select data-f="situacao" aria-label="Situação"><option value="">Todas as situações</option>${Object.entries(SITUACOES).map(([k, [r]]) => `<option value="${k}">${r}</option>`).join('')}</select>
        <select data-f="origem" aria-label="Origem"><option value="">Todas as origens</option>${ORIGENS.map((o) => `<option>${o}</option>`).join('')}</select>
        <select data-f="funil" aria-label="Funil"><option value="">Todos os funis</option>${FUNIS.map(([v, r]) => `<option value="${v}">${r}</option>`).join('')}</select>
      </div>
      <div class="em-contagem mini" id="em-cont-total"></div>
      <div class="tabela-wrap" id="em-cont-lista"></div>
      <div class="paginacao" id="em-cont-mais"></div>`;
    ligarCenario(el, () => contatos(el));
    el.querySelectorAll('[data-f]').forEach((i) => {
      if (i.tagName === 'SELECT') i.value = filtroCont[i.dataset.f];
      i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { filtroCont[i.dataset.f] = i.value; limiteLista = 50; desenharLista(); });
    });
    const desenharLista = () => {
      const b = semAcento(filtroCont.busca.trim());
      const linhas = todos.filter((p) => (!b || semAcento(p.nome + ' ' + p.email).includes(b))
        && (!filtroCont.situacao || p.situacao === filtroCont.situacao)
        && (!filtroCont.origem || p.origem === filtroCont.origem)
        && (!filtroCont.funil || p.funil === filtroCont.funil));
      const filtrado = Object.values(filtroCont).some(Boolean);
      el.querySelector('#em-cont-total').textContent = filtrado ? `${int(linhas.length)} contatos com esses filtros` : `${int(linhas.length)} contatos, mais recentes primeiro`;
      linhas.sort((a, z) => z.entrada - a.entrada);
      ctx.tabela(el.querySelector('#em-cont-lista'), [
        { titulo: 'Nome', campo: 'nome', render: (p) => `<button type="button" class="ag-link-linha" data-contato="${p.id}">${esc(p.nome)}</button>` },
        { titulo: 'E-mail', campo: 'email', render: (p) => `<span class="mini">${esc(p.email)}</span>` },
        { titulo: 'Origem', campo: 'origem', render: (p) => esc(p.origem) },
        { titulo: 'Funil', campo: 'funil', render: (p) => esc(nomeFunil(p.funil)) },
        { titulo: 'Entrada', campo: 'entrada', render: (p) => dataBR(p.entrada) },
        { titulo: 'Situação', campo: 'situacao', render: (p) => carimbo(SITUACOES, p.situacao) },
      ], linhas.slice(0, limiteLista), undefined, todos.length ? 'Nenhum contato com esses filtros.' : 'Nenhum contato ainda.');
      const mais = el.querySelector('#em-cont-mais');
      mais.innerHTML = linhas.length > limiteLista ? `<span class="mini">mostrando ${int(limiteLista)} de ${int(linhas.length)}</span><button class="btn sec" type="button">Mostrar mais 50</button>` : '';
      const bm = mais.querySelector('button');
      if (bm) bm.onclick = () => { limiteLista += 50; desenharLista(); };
    };
    desenharLista();
    el.querySelector('#em-cont-lista').addEventListener('click', (ev) => { const b = ev.target.closest('[data-contato]'); if (b) detalheContato(b.dataset.contato, () => desenharLista()); });
  }

  const EXPLICA_SITUACAO = {
    ativo: 'Recebe marketing normalmente.',
    descadastrado: 'Pediu para sair. Nunca mais recebe marketing. Só volta se a própria pessoa se cadastrar de novo.',
    voltou: 'O endereço não existe ou recusou de vez (devolução definitiva). Fora de todos os disparos.',
    denunciou: 'Marcou um e-mail nosso como spam. Fora de todos os disparos, para proteger a entrega de todo mundo.',
    invalido: 'Endereço malformado. Entrou como contato, mas fica fora dos disparos para não derrubar um envio inteiro.',
  };

  function detalheContato(id, aoMudar) {
    const p = D.contatos.find((x) => x.id === id);
    if (!p) return;
    const segs = D.segmentos.filter((s) => s.regras.every((r) => casa(p, r)));
    const hist = [];
    if (p.abriu.includes('c1') || p.funil === 'workshop-gratuito') hist.push({ nome: 'Convite workshop 08/10', data: '01/10', abriu: p.abriu.includes('c1'), clicou: p.clicou.includes('c1') });
    if (p.abriu.includes('c2') || p.estagio === 'MQL') hist.push({ nome: 'Novidade: plano ao vivo', data: '24/09', abriu: p.abriu.includes('c2'), clicou: p.clicou.includes('c2') });
    const fluxo = p.funil === 'workshop-gratuito' ? [
      ['Entrou', `${dataBR(p.entrada)} · preencheu o formulário do workshop`],
      ['E-mail 1', 'recebeu, ' + (p.abriu.length ? 'abriu' : 'não abriu')],
      ['Desvio', p.abriu.length ? 'seguiu por "sim"' : 'seguiu por "não"'],
      p.situacao === 'ativo' ? ['Agora', 'esperando 1 dia antes do próximo e-mail'] : ['Saiu', p.situacao === 'descadastrado' ? 'descadastrou-se' : p.situacao === 'voltou' ? 'o e-mail voltou' : p.situacao === 'denunciou' ? 'denunciou spam' : 'endereço inválido'],
    ] : [];
    const acao = p.situacao === 'ativo' ? '<button class="btn perigo" type="button" data-descad>Descadastrar</button>'
      : p.situacao === 'voltou' ? '<button class="btn sec" type="button" data-reativar>Reativar</button>' : '';
    const g = gaveta({
      titulo: esc(p.nome), sub: esc(p.email),
      corpo: `<p>${carimbo(SITUACOES, p.situacao)}</p>
        <p class="mini em-explica-sit">${EXPLICA_SITUACAO[p.situacao]}</p>
        <dl class="ag-dl">
          <dt>Origem</dt><dd>${esc(p.origem)}</dd>
          <dt>Funil</dt><dd>${esc(nomeFunil(p.funil))}</dd>
          <dt>Entrada</dt><dd>${dataBR(p.entrada)}/2026</dd>
          <dt>Estágio no CRM</dt><dd>${esc(p.estagio)}</dd>
        </dl>
        <h3 class="ag-h3">Segmentos</h3>
        ${segs.length ? `<div class="ag-etiquetas">${segs.map((s) => `<span class="ag-etiqueta">${esc(s.nome)}</span>`).join('')}</div>` : '<p class="mini">Não está em nenhum segmento agora.</p>'}
        <h3 class="ag-h3">E-mails recebidos</h3>
        ${hist.length ? `<ol class="ag-hist em-hist">${hist.map((h) => `<li><b>${esc(h.nome)}</b> <span class="mini">${h.data}</span><br>${h.abriu ? '<span class="ok">abriu</span>' : '<span class="mini">não abriu</span>'}${h.clicou ? ' · <span class="ok">clicou</span>' : ''}</li>`).join('')}</ol>` : '<p class="mini">Nenhum e-mail de marketing ainda.</p>'}
        <h3 class="ag-h3">Fluxos</h3>
        ${fluxo.length ? `<p><b>Boas-vindas do workshop gratuito</b></p><ol class="ag-hist em-hist">${fluxo.map(([a, b]) => `<li><b>${a}</b> <span class="mini">${b}</span></li>`).join('')}</ol>` : '<p class="mini">Não passou por nenhum fluxo.</p>'}
        <div id="em-contato-confirma"></div>`,
      rodape: acao ? `<div class="ag-acoes">${acao}</div>` : `<p class="mini">${p.situacao === 'ativo' ? '' : 'Quem se descadastrou, denunciou spam ou tem endereço inválido não pode ser reativado pela equipe.'}</p>`,
    });
    const des = g.querySelector('[data-descad]');
    if (des) des.onclick = () => ctx.pedirConfirmacao(des, 'Descadastrar a pedido da pessoa?', () => {
      p.situacao = 'descadastrado'; avisar(`${p.nome} foi descadastrado. Sai também dos fluxos.`); detalheContato(id, aoMudar); if (aoMudar) aoMudar();
    });
    const re = g.querySelector('[data-reativar]');
    if (re) re.onclick = () => {
      g.querySelector('#em-contato-confirma').innerHTML = '<div class="aviso alerta">Só reative se o problema foi resolvido (ex.: a caixa estava cheia e a pessoa liberou). Se o endereço voltar de novo, a reputação do envio cai para todo mundo.</div>';
      ctx.pedirConfirmacao(re, 'Reativar mesmo assim?', () => {
        p.situacao = 'ativo'; avisar(`${p.nome} voltou a receber marketing.`); detalheContato(id, aoMudar); if (aoMudar) aoMudar();
      }, [{ valor: true, rotulo: 'Reativar' }]);
    };
  }

  // ===========================================================================
  // 374 · Segmentos
  // ===========================================================================
  function segmentos(el) {
    const lista = vazio() ? [] : D.segmentos;
    el.innerHTML = `${seloProto()}
      <div class="em-barra"><p class="mini">Cada segmento é uma regra. A contagem é de contatos ativos agora e é refeita na hora de cada disparo.</p>
        <button class="btn" type="button" data-novo>Novo segmento</button></div>
      <div class="tabela-wrap" id="em-seg-lista"></div>`;
    ligarCenario(el, () => segmentos(el));
    el.querySelector('[data-novo]').onclick = () => montador(null, () => segmentos(el));
    const ligado = (s) => D.campanhas.some((c) => c.situacao === 'agendada' && c.segmentos.includes(s.id));
    const alvo = el.querySelector('#em-seg-lista');
    ctx.tabela(alvo, [
      { titulo: 'Segmento', campo: 'nome', render: (s) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${s.id}">${esc(s.nome)}</button>${ligado(s) ? ' <span class="selo">em campanha agendada</span>' : ''}` },
      { titulo: 'Regra', render: (s) => `<span class="mini em-regra-curta">${esc(resumoRegra(s.regras))}</span>` },
      { titulo: 'Ativos agora', num: true, render: (s) => `<b>${int(noSegmento(s.regras).filter((p) => p.situacao === 'ativo').length)}</b>` },
      { titulo: '', render: (s) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(s.nome, [
        { acao: 'editar', id: s.id, rotulo: 'Editar regra' },
        { acao: 'duplicar', id: s.id, rotulo: 'Duplicar' },
        { acao: 'excluir', id: s.id, rotulo: 'Excluir', perigo: true },
      ])}</div>` },
    ], lista, undefined, 'Nenhum segmento ainda. Um segmento junta contatos por funil, origem, data de entrada, estágio no CRM ou campanha que abriram.');
    ligarAcoes(alvo, {
      editar: (id) => montador(segmento(id), () => segmentos(el)),
      duplicar: (id) => { const s = segmento(id); D.segmentos.push({ id: 's' + Date.now(), nome: s.nome + ' (cópia)', regras: s.regras.map((r) => ({ ...r })) }); avisar('Segmento duplicado.'); segmentos(el); },
      excluir: (id, b) => {
        const s = segmento(id);
        if (ligado(s)) { fecharMenus(); return avisar(`"${s.nome}" está numa campanha agendada. Tire o segmento da campanha antes de excluir.`, 'erro'); }
        ctx.pedirConfirmacao(b, 'Excluir o segmento?', () => { D.segmentos = D.segmentos.filter((x) => x.id !== id); fecharMenus(); avisar('Segmento excluído.'); segmentos(el); });
      },
    });
  }

  function montador(s, aoSalvar) {
    const novo = !s;
    const rascunho = { nome: s ? s.nome : '', regras: s ? s.regras.map((r) => ({ ...r })) : [{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }] };
    const g = gaveta({
      titulo: novo ? 'Novo segmento' : 'Editar segmento', sub: 'condições combinadas com "e": a pessoa precisa cumprir todas', largura: 'larga',
      corpo: `<label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" id="em-seg-nome" value="${esc(rascunho.nome)}" placeholder="Ex.: Leads do workshop que abriram o convite"></label>
        <div class="em-regras" id="em-regras"></div>
        <button class="btn sec em-mais" type="button" data-add>+ Adicionar condição</button>
        <div class="em-contagem-viva" id="em-seg-conta" aria-live="polite"></div>
        <h3 class="ag-h3">Amostra <small class="mini">primeiros contatos que a regra pega</small></h3>
        <div class="tabela-wrap" id="em-seg-amostra"></div>`,
      rodape: '<div class="ag-acoes"><button class="btn" type="button" data-salvar>Salvar segmento</button><button class="btn sec" type="button" data-fechar2>Cancelar</button></div>',
    });
    const caixa = g.querySelector('#em-regras');
    const desenhar = () => {
      caixa.innerHTML = rascunho.regras.map((r, i) => {
        const c = CAMPOS_REGRA[r.campo];
        return `<div class="em-regra" data-i="${i}">
          ${i ? '<span class="em-regra__e">e</span>' : '<span class="em-regra__e">quem</span>'}
          <select data-k="campo" aria-label="Campo">${Object.entries(CAMPOS_REGRA).map(([k, v]) => `<option value="${k}"${k === r.campo ? ' selected' : ''}>${v.rotulo}</option>`).join('')}</select>
          <select data-k="op" aria-label="Comparação">${c.ops.map(([k, v]) => `<option value="${k}"${k === r.op ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select data-k="valor" aria-label="Valor">${c.valores().map(([k, v]) => `<option value="${esc(k)}"${k === r.valor ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <button class="ag-icone" type="button" data-tirar aria-label="Tirar condição">${ICONE.fechar}</button>
        </div>`;
      }).join('') || '<p class="mini">Sem condição: o segmento pega todos os contatos ativos.</p>';
      contar();
    };
    const contar = () => {
      const pegos = noSegmento(rascunho.regras);
      const ativos = pegos.filter((p) => p.situacao === 'ativo');
      g.querySelector('#em-seg-conta').innerHTML = `<b>${int(ativos.length)}</b> contatos ativos com essa regra <span class="mini">· mais ${int(pegos.length - ativos.length)} fora do marketing (descadastrados, voltaram, spam, inválidos)</span>`;
      ctx.tabela(g.querySelector('#em-seg-amostra'), [
        { titulo: 'Nome', render: (p) => `<b>${esc(p.nome)}</b><br><span class="mini">${esc(p.email)}</span>` },
        { titulo: 'Funil', render: (p) => `<span class="mini">${esc(nomeFunil(p.funil))}</span>` },
        { titulo: 'Entrada', render: (p) => dataBR(p.entrada) },
      ], ativos.slice(0, 8), undefined, 'Ninguém cumpre essa regra agora.');
    };
    caixa.addEventListener('change', (ev) => {
      const linha = ev.target.closest('[data-i]');
      const r = rascunho.regras[Number(linha.dataset.i)];
      r[ev.target.dataset.k] = ev.target.value;
      if (ev.target.dataset.k === 'campo') { const c = CAMPOS_REGRA[r.campo]; r.op = c.ops[0][0]; r.valor = (c.valores()[0] || [''])[0]; }
      desenhar();
    });
    caixa.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tirar]');
      if (b) { rascunho.regras.splice(Number(b.closest('[data-i]').dataset.i), 1); desenhar(); }
    });
    g.querySelector('[data-add]').onclick = () => { rascunho.regras.push({ campo: 'origem', op: 'e', valor: 'Meta Ads' }); desenhar(); };
    g.querySelector('[data-fechar2]').onclick = () => g.close();
    g.querySelector('[data-salvar]').onclick = () => {
      const nome = g.querySelector('#em-seg-nome').value.trim();
      if (!nome) return avisar('Dê um nome ao segmento.', 'erro');
      if (novo) D.segmentos.push({ id: 's' + Date.now(), nome, regras: rascunho.regras });
      else Object.assign(s, { nome, regras: rascunho.regras });
      g.close();
      avisar(novo ? 'Segmento criado.' : 'Segmento salvo.');
      aoSalvar();
    };
    desenhar();
  }

  // ===========================================================================
  // 378 · Modelos (ligada ao backend: GET/POST /api/email/modelos)
  // ===========================================================================
  // Lista, editor, prévia, teste, duplicar e arquivar vêm do servidor: a
  // validação de campos e links, o layout do e-mail e a trava de "em uso"
  // ficam lá. Aqui só a tela.
  let filtroModelo = 'todos';
  let modeloAberto = null;
  let modelosEstado = null; // { modelos, campos }
  let paraTeste = '';

  const NOME_CANAL = { transacional: 'Transacional', marketing: 'Marketing' };
  const dataCurta = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '');

  // Trava o botão enquanto a chamada corre (evita duplo clique).
  async function ocupado(botao, fn) {
    if (botao.disabled) return;
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    try { await fn(); } finally { botao.disabled = false; botao.removeAttribute('aria-busy'); }
  }

  const postModelos = (corpo) => ctx.postJson('/api/email/modelos', corpo);
  const modeloReal = (id) => modelosEstado.modelos.find((m) => String(m.id) === String(id));
  function trocarModelo(m) {
    const i = modelosEstado.modelos.findIndex((x) => x.id === m.id);
    if (i >= 0) modelosEstado.modelos[i] = m; else modelosEstado.modelos.unshift(m);
  }

  async function modelos(el) {
    if (!modelosEstado) {
      el.innerHTML = '<p class="aviso">Carregando os modelos…</p>';
      try {
        modelosEstado = await ctx.fetchJson('/api/email/modelos?_=' + Date.now());
      } catch (e) {
        el.innerHTML = `<div class="aviso falha">Não foi possível carregar os modelos (${esc(e.message)}). Tente de novo em instantes.</div>`;
        return;
      }
    }
    if (modeloAberto) return editorModelo(el, modeloAberto);
    listaModelos(el);
  }

  function listaModelos(el) {
    const todos = modelosEstado.modelos;
    const casaFiltro = (m, k) => (k === 'arquivados' ? m.arquivado : !m.arquivado && (k === 'todos' || m.canal === k));
    const linhas = todos.filter((m) => casaFiltro(m, filtroModelo));
    const FILTROS_M = [['todos', 'Todos'], ['transacional', 'Transacional'], ['marketing', 'Marketing'], ['arquivados', 'Arquivados']];
    el.innerHTML = `<div class="em-barra">
        <div class="ag-subvistas" role="group" aria-label="Filtrar modelos">${FILTROS_M.map(([k, r]) => `<button type="button" class="ag-subvista" data-fm="${k}" aria-pressed="${k === filtroModelo}">${r} <span class="ag-cont">${todos.filter((m) => casaFiltro(m, k)).length}</span></button>`).join('')}</div>
        <div class="ag-acoes"><button class="btn" type="button" data-novo="marketing">Novo modelo de marketing</button><button class="btn sec" type="button" data-novo="transacional">Novo transacional</button></div>
      </div>
      <div class="tabela-wrap" id="em-mod-lista"></div>`;
    el.querySelectorAll('[data-fm]').forEach((b) => { b.onclick = () => { filtroModelo = b.dataset.fm; listaModelos(el); }; });
    el.querySelectorAll('[data-novo]').forEach((b) => { b.onclick = () => novoModelo(el, b.dataset.novo); });
    const alvo = el.querySelector('#em-mod-lista');
    ctx.tabela(alvo, [
      { titulo: 'Modelo', campo: 'nome', render: (m) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${m.id}">${esc(m.nome)}</button>` },
      { titulo: 'Canal', campo: 'canal', render: (m) => NOME_CANAL[m.canal] },
      { titulo: 'Assunto', render: (m) => `<span class="em-assunto-curto">${esc(m.assunto || 'sem assunto')}</span>` },
      { titulo: 'Editado', render: (m) => esc(dataCurta(m.atualizado_em)) },
      { titulo: '', render: (m) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(m.nome, m.arquivado ? [
        { acao: 'desarquivar', id: m.id, rotulo: 'Tirar do arquivo' }, { acao: 'duplicar', id: m.id, rotulo: 'Duplicar' },
      ] : [
        { acao: 'editar', id: m.id, rotulo: 'Editar' },
        { acao: 'teste', id: m.id, rotulo: 'Mandar teste' },
        { acao: 'duplicar', id: m.id, rotulo: 'Duplicar' },
        { acao: 'arquivar', id: m.id, rotulo: 'Arquivar', perigo: true },
      ])}</div>` },
    ], linhas, undefined, filtroModelo === 'arquivados' ? 'Nenhum modelo arquivado.' : 'Nenhum modelo ainda. Crie o primeiro escolhendo o canal: transacional (agenda) ou marketing (campanhas e fluxos).');
    ligarAcoes(alvo, {
      editar: (id) => { modeloAberto = Number(id); modelos(el); window.scrollTo(0, 0); },
      teste: (id) => pedirTeste(modeloReal(id)),
      duplicar: async (id) => {
        try {
          const r = await postModelos({ acao: 'duplicar', id: Number(id) });
          trocarModelo(r.modelo); filtroModelo = 'todos';
          avisar(`Modelo duplicado: "${r.modelo.nome}".`); listaModelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      },
      desarquivar: async (id) => {
        try {
          const r = await postModelos({ acao: 'desarquivar', id: Number(id) });
          trocarModelo(r.modelo); avisar('Modelo de volta na lista.'); listaModelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      },
      arquivar: (id, b) => {
        ctx.pedirConfirmacao(b, 'Arquivar?', async () => {
          fecharMenus();
          try {
            const r = await postModelos({ acao: 'arquivar', id: Number(id) });
            trocarModelo(r.modelo); avisar('Modelo arquivado. Ele fica no filtro "Arquivados".'); listaModelos(el);
          } catch (e) { avisar(msgErro(e), 'erro'); }
        });
      },
    });
  }

  function novoModelo(el, canal) {
    const g = gaveta({
      titulo: canal === 'marketing' ? 'Novo modelo de marketing' : 'Novo modelo transacional',
      sub: canal === 'marketing' ? 'sai por news. em campanhas e fluxos' : 'sai por envio. nos e-mails da agenda',
      corpo: `<form class="ag-form" data-novo-form novalidate>
          <label>Nome do modelo<input type="text" name="nome" maxlength="100" placeholder="Ex.: Convite workshop de outubro" autocomplete="off"></label>
          <p class="mini">O nome é só para a equipe achar o modelo. Quem recebe vê o assunto.</p>
          <div class="em-erro" aria-live="polite"></div>
        </form>`,
      rodape: '<button class="btn" type="button" data-criar>Criar e abrir</button>',
    });
    const f = g.querySelector('[data-novo-form]');
    const criar = g.querySelector('[data-criar]');
    f.nome.focus();
    const enviar = () => ocupado(criar, async () => {
      try {
        const r = await postModelos({ acao: 'salvar', modelo: { nome: f.nome.value, canal } });
        trocarModelo(r.modelo);
        fecharGaveta();
        modeloAberto = r.modelo.id;
        avisar('Modelo criado. Escreva o assunto e o corpo e salve.');
        modelos(el);
      } catch (e) { f.querySelector('.em-erro').textContent = msgErro(e); }
    });
    criar.onclick = enviar;
    f.onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  }

  function pedirTeste(m) {
    const g = gaveta({
      titulo: 'Mandar teste',
      sub: `"${esc(m.nome)}" com os dados de exemplo`,
      corpo: `<form class="ag-form" data-teste-form novalidate>
          <label>Para<input type="email" name="para" value="${esc(paraTeste)}" placeholder="seu e-mail" autocomplete="email"></label>
          <p class="mini">Sai pelo remetente do canal ${m.canal}, com os campos preenchidos por dados de exemplo. A entrega aparece em Configuração › Últimos testes.</p>
          <div class="em-erro" aria-live="polite"></div>
        </form>`,
      rodape: '<button class="btn" type="button" data-mandar>Mandar teste</button>',
    });
    const f = g.querySelector('[data-teste-form]');
    const b = g.querySelector('[data-mandar]');
    f.para.focus();
    const enviar = () => ocupado(b, async () => {
      try {
        await postModelos({ acao: 'enviar_teste', id: m.id, para: f.para.value });
        paraTeste = f.para.value.trim();
        fecharGaveta();
        avisar(`Teste mandado para ${paraTeste}.`);
      } catch (e) { f.querySelector('.em-erro').textContent = msgErro(e); }
    });
    b.onclick = enviar;
    f.onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  }

  function editorModelo(el, id) {
    const m = modeloReal(id);
    if (!m) { modeloAberto = null; return listaModelos(el); }
    const CHAVES = ['nome', 'canal', 'assunto', 'previa', 'corpo'];
    const rasc = Object.fromEntries(CHAVES.map((k) => [k, m[k] ?? '']));
    const sujo = () => CHAVES.some((k) => rasc[k] !== (m[k] ?? ''));
    let tamanho = 'computador';
    el.innerHTML = `<div class="em-barra"><button class="btn sec em-voltar" type="button" data-voltar>${ICONE.voltar} Modelos</button>
        <div class="ag-acoes"><button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn sec" type="button" data-dup>Duplicar</button><button class="btn" type="button" data-salvar>Salvar</button></div></div>
      ${m.arquivado ? '<div class="aviso alerta">Este modelo está arquivado. Ele não aparece na lista principal nem pode ser escolhido em campanhas, fluxos ou na agenda.</div>' : ''}
      <div class="em-editor">
        <form class="ag-form em-editor__form" onsubmit="return false">
          <div class="linha"><label>Nome<input type="text" data-m="nome" maxlength="100" value="${esc(rasc.nome)}"></label>
            <label>Canal<select data-m="canal">${Object.entries(NOME_CANAL).map(([k, r]) => `<option value="${k}"${k === rasc.canal ? ' selected' : ''}>${r} (${k === 'marketing' ? 'news.' : 'envio.'})</option>`).join('')}</select></label></div>
          <label>Assunto<input type="text" data-m="assunto" maxlength="200" value="${esc(rasc.assunto)}" placeholder="O que aparece em negrito na caixa de entrada"></label>
          <label>Texto de pré-visualização<input type="text" data-m="previa" maxlength="200" value="${esc(rasc.previa)}" placeholder="A linha que aparece depois do assunto"></label>
          <div class="ag-campo"><span class="ag-campo__rotulo">Corpo</span>
            <div class="em-ferramentas" role="toolbar" aria-label="Formatação">
              <button type="button" class="btn sec" data-fmt="negrito"><b>N</b> Negrito</button>
              <button type="button" class="btn sec" data-fmt="link">Link</button>
              <button type="button" class="btn sec" data-fmt="botao">Botão</button>
            </div>
            <textarea data-m="corpo" rows="12">${esc(rasc.corpo)}</textarea>
            <span class="mini">**texto** vira negrito · [texto](link) vira link · [[Texto | link]] vira botão. Cabeçalho e rodapé entram sozinhos.</span></div>
          <div class="ag-campo"><span class="ag-campo__rotulo">Campos do canal <span data-nome-canal>${rasc.canal}</span> <span class="mini">(clique para inserir onde está o cursor)</span></span>
            <div class="ag-etiquetas" data-chips></div></div>
          <div id="em-campos-ruins" aria-live="polite"></div>
          <div class="em-erro" aria-live="polite"></div>
        </form>
        <div class="em-editor__previa">
          <div class="em-barra em-barra--previa"><span class="ag-campo__rotulo">Pré-visualização com dados de exemplo</span>
            <div class="em-tamanho" role="group" aria-label="Tamanho da pré-visualização">
              <button type="button" class="ag-icone" data-tam="computador" aria-pressed="true" aria-label="Computador" title="Computador">${ICONE.computador}</button>
              <button type="button" class="ag-icone" data-tam="celular" aria-pressed="false" aria-label="Celular" title="Celular">${ICONE.celular}</button></div></div>
          <div id="em-previa"></div>
        </div>
      </div>`;
    const ta = el.querySelector('[data-m="corpo"]');
    const erro = el.querySelector('.em-editor__form .em-erro');
    let ultimoCampo = ta;
    let ultimaPrevia = null;

    const inserir = (antes, depois = '', padrao = '') => {
      const i = ultimoCampo, a = i.selectionStart ?? i.value.length, z = i.selectionEnd ?? a;
      const sel = i.value.slice(a, z) || padrao;
      i.value = i.value.slice(0, a) + antes + sel + depois + i.value.slice(z);
      i.focus();
      i.selectionStart = i.selectionEnd = a + antes.length + sel.length + depois.length;
      rasc[i.dataset.m] = i.value;
      atualizar();
    };
    const desenharChips = () => {
      el.querySelector('[data-nome-canal]').textContent = rasc.canal;
      el.querySelector('[data-chips]').innerHTML = (modelosEstado.campos[rasc.canal] || [])
        .map((c) => `<button type="button" class="em-campo" data-campo="${esc(c.campo)}" title="${esc(c.rotulo)}">{{${esc(c.campo)}}}</button>`).join('');
      el.querySelectorAll('[data-campo]').forEach((b) => { b.onclick = () => inserir(`{{${b.dataset.campo}}}`); });
    };
    // A prévia é o HTML final montado pelo servidor, isolado num iframe sem scripts.
    const desenharPrevia = () => {
      const p = ultimaPrevia;
      if (!p) return;
      const cfg = D.config[rasc.canal];
      const alvo = el.querySelector('#em-previa');
      alvo.innerHTML = `<div class="em-email em-email--${tamanho}">
          <div class="em-email__caixa"><b>${esc(cfg.nome)}</b> <span class="mini">&lt;${esc(cfg.endereco)}&gt;</span><br>
            <span class="em-email__assunto">${esc(p.assunto || '(sem assunto)')}</span> <span class="mini">${esc(p.previa)}</span></div>
          <iframe title="Pré-visualização do e-mail" sandbox="allow-same-origin" style="display:block;width:100%;border:0;min-height:320px"></iframe>
        </div>`;
      const fr = alvo.querySelector('iframe');
      fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + 'px'; } catch { /* fica a altura mínima */ } };
      fr.srcdoc = p.html;
      el.querySelector('#em-campos-ruins').innerHTML = [
        p.desconhecidos.length ? `<div class="aviso falha"><b>Campo desconhecido:</b> ${p.desconhecidos.map((r) => `{{${esc(r)}}}`).join(', ')}. Os campos deste canal estão logo acima. Não dá para salvar assim.</div>` : '',
        ...p.avisos.map((a) => `<div class="aviso alerta">${esc(a)}</div>`),
      ].join('');
    };
    let espera = null, pedido = 0;
    function atualizar(imediato) {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const n = ++pedido;
        try {
          const p = await postModelos({ acao: 'previa', modelo: { canal: rasc.canal, assunto: rasc.assunto, previa: rasc.previa, corpo: rasc.corpo } });
          if (n !== pedido) return; // já há um pedido mais novo
          ultimaPrevia = p;
          desenharPrevia();
        } catch (e) {
          if (n === pedido) el.querySelector('#em-previa').innerHTML = `<div class="aviso falha">Não foi possível montar a pré-visualização (${esc(msgErro(e))}).</div>`;
        }
      }, imediato ? 0 : 400);
    }

    el.querySelectorAll('[data-m]').forEach((i) => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => {
      rasc[i.dataset.m] = i.value;
      erro.textContent = '';
      if (i.dataset.m === 'canal') desenharChips();
      if (i.dataset.m !== 'nome') atualizar(i.dataset.m === 'canal');
    }));
    el.querySelectorAll('[data-m="assunto"], [data-m="previa"], [data-m="corpo"]').forEach((i) => i.addEventListener('focus', () => { ultimoCampo = i; }));
    el.querySelectorAll('[data-fmt]').forEach((b) => { b.onclick = () => { ultimoCampo = ta; ({
      negrito: () => inserir('**', '**', 'texto em negrito'),
      link: () => inserir('[', '](https://)', 'texto do link'),
      botao: () => inserir('\n\n[[', ' | https://]]\n\n', 'Texto do botão'),
    })[b.dataset.fmt](); }; });
    el.querySelectorAll('[data-tam]').forEach((b) => { b.onclick = () => { tamanho = b.dataset.tam; el.querySelectorAll('[data-tam]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharPrevia(); }; });

    const voltar = el.querySelector('[data-voltar]');
    voltar.onclick = () => {
      if (!sujo()) { modeloAberto = null; return listaModelos(el); }
      ctx.pedirConfirmacao(voltar, 'Sair sem salvar?', () => { modeloAberto = null; listaModelos(el); });
    };
    el.querySelector('[data-teste]').onclick = () => (sujo() ? avisar('Salve as mudanças antes de mandar o teste.', 'erro') : pedirTeste(m));
    const dup = el.querySelector('[data-dup]');
    dup.onclick = () => {
      if (sujo()) return avisar('Salve as mudanças antes de duplicar.', 'erro');
      ocupado(dup, async () => {
        try {
          const r = await postModelos({ acao: 'duplicar', id: m.id });
          trocarModelo(r.modelo); modeloAberto = r.modelo.id;
          avisar('Modelo duplicado. Você está editando a cópia.'); modelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      });
    };
    const salvar = el.querySelector('[data-salvar]');
    salvar.onclick = () => ocupado(salvar, async () => {
      try {
        const r = await postModelos({ acao: 'salvar', id: m.id, modelo: rasc });
        trocarModelo(r.modelo);
        Object.assign(m, r.modelo);
        Object.assign(rasc, Object.fromEntries(CHAVES.map((k) => [k, r.modelo[k] ?? ''])));
        erro.textContent = '';
        avisar('Modelo salvo.');
      } catch (e) {
        erro.textContent = msgErro(e);
        avisar(msgErro(e), 'erro');
        erro.scrollIntoView({ block: 'center' });
      }
    });
    desenharChips();
    atualizar(true);
  }

  // ===========================================================================
  // 373 · Configuração (ligada ao backend na 377: GET/POST /api/email/config)
  // ===========================================================================
  // Única vista real: lê e grava pelo backend. Validação de remetente, envio de
  // teste e conexão dos resultados ficam todas no servidor; aqui só a tela.
  const DOMINIO_CANAL = { transacional: 'envio.atacadoexponencial.com', marketing: 'news.atacadoexponencial.com' };
  const SITUACAO_ENVIO = {
    enviado: ['Enviado', 'neutro'], falhou: ['Falhou', 'queda'], entregue: ['Entregue', 'alta'],
    aberto: ['Aberto', 'alta'], clicado: ['Clicado', 'alta'], voltou: ['Voltou', 'queda'],
    voltou_temporario: ['Voltou temporariamente', 'alerta'], spam: ['Marcado como spam', 'queda'], descadastrou: ['Descadastrou', 'alerta'],
  };
  const ROTULO_EVENTO = {
    entregue: 'Entregue', aberto: 'Aberto', clicado: 'Clicado', voltou: 'Voltou',
    voltou_temporario: 'Voltou temporariamente', spam: 'Spam', descadastrou: 'Descadastrou',
  };
  const quando = (ts) => (ts ? new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '');
  const msgErro = (e) => (e && (e.mensagemUsuario || e.message)) || 'Não foi possível concluir. Tente de novo.';
  const selo = (rotulo, cor) => `<span class="carimbo ${cor}">${esc(rotulo)}</span>`;
  let cfgEstado = null;

  async function configuracao(el) {
    el.innerHTML = '<p class="aviso">Carregando a configuração…</p>';
    try {
      cfgEstado = await ctx.fetchJson('/api/email/config?_=' + Date.now());
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar a configuração (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    desenharConfig(el);
  }

  // Os outros protótipos passam a mostrar os remetentes de verdade.
  function espelharNoPrototipo(C) {
    Object.assign(D.config.transacional, { nome: C.remetente_transacional_nome, endereco: C.remetente_transacional_email, resposta: C.resposta_transacional });
    Object.assign(D.config.marketing, { nome: C.remetente_marketing_nome, endereco: C.remetente_marketing_email, resposta: C.resposta_marketing });
    D.config.rodape = C.rodape;
  }

  function desenharConfig(el) {
    const S = cfgEstado;
    const C = S.config;
    espelharNoPrototipo(C);
    const contaOk = S.conta === 'aceita';
    const mktLiberado = C.marketing_liberado === '1';
    const domRuins = S.dominios.consultado ? S.dominios.itens.filter((d) => !d.dkim) : [];
    const semResultados = contaOk && (S.resultados.transacional === false || S.resultados.marketing === false);
    const geral = !contaOk || domRuins.length ? 'incidente' : !mktLiberado || semResultados ? 'atencao' : 'saudavel';
    const frase = S.conta === 'ausente' || S.conta === 'recusada' ? 'Serviço de envio sem acesso. Confira a chave em Saúde das integrações. Teste e conexão dos resultados ficam indisponíveis.'
      : S.conta === 'sem_resposta' ? 'Não foi possível falar com o serviço de envio agora. Atualize em instantes.'
      : domRuins.length ? `O domínio ${domRuins.map((d) => d.nome).join(' e ')} está sem verificação. Confira o DNS na Cloudflare.`
      : !mktLiberado ? 'Conta aprovada, mas o marketing está marcado como não liberado. A agenda pode mandar e-mails; campanhas e fluxos esperam.'
      : semResultados ? 'Envio funcionando, mas os resultados (entregue, aberto, clicado) ainda não estão conectados.'
      : 'Conta aprovada e os dois canais liberados. Os e-mails da agenda e de marketing podem sair.';
    const CHAVE = { aceita: ['Funcionando', 'alta'], recusada: ['Recusada', 'queda'], ausente: ['Não configurada', 'queda'], sem_resposta: ['Sem resposta', 'alerta'] };
    const seloResultado = (v) => (v === true ? selo('Conectado', 'alta') : v === false ? selo('Não conectado', 'alerta') : selo('Não consultado', 'neutro'));
    const linhaDominio = (canal) => {
      let s;
      if (!S.dominios.consultado) s = selo('Não consultado', 'neutro');
      else {
        const d = S.dominios.itens.find((i) => i.canal === canal);
        s = !d || !d.encontrado ? selo('Não cadastrado', 'queda')
          : !d.dkim ? selo('Com problema', 'queda')
          : !d.retorno ? selo('Retorno pendente', 'alerta')
          : selo('Verificado', 'alta');
      }
      return `<tr><td><b>${DOMINIO_CANAL[canal]}</b><br><span class="mini">${canal}</span></td><td class="num">${s}</td></tr>`;
    };
    const MOTIVO_DOM = {
      sem_chave_conta: 'Não consultada (falta a chave da conta).',
      recusada: 'Não consultada: o serviço recusou a chave da conta.',
      sem_resposta: 'Não consultada: o serviço não respondeu agora.',
    };
    const canal = (k, titulo) => `<div class="em-canal">
        <h3>${titulo} <span class="mini">${DOMINIO_CANAL[k]}</span></h3>
        <form class="ag-form" data-canal="${k}" novalidate>
          <label>Nome do remetente<input type="text" name="nome" maxlength="100" value="${esc(C[`remetente_${k}_nome`])}"></label>
          <label>Endereço do remetente<input type="email" name="endereco" value="${esc(C[`remetente_${k}_email`])}"><span class="mini">Só endereços @${DOMINIO_CANAL[k]} são aceitos.</span></label>
          <label>Endereço de resposta<input type="email" name="resposta" value="${esc(C[`resposta_${k}`])}" placeholder="ex.: contato@seteads.com"><span class="mini">Vazio: as respostas dos leads se perdem, porque o domínio não recebe e-mail. Sugestão: um endereço @seteads.com.</span></label>
          <div class="em-erro" aria-live="polite"></div>
          <div class="ag-acoes"><button class="btn sec" type="submit">Salvar remetente</button></div>
        </form></div>`;
    const linhaTeste = (t) => {
      const passos = [`Enviado ${quando(t.enviado_em)}`].concat(t.eventos.map((ev) => `${ROTULO_EVENTO[ev.tipo] || ev.tipo} ${quando(ev.ocorrido_em)}`));
      return `<tr>
        <td>${quando(t.enviado_em)}</td>
        <td>${esc(t.destinatario)}<br><span class="mini">${t.canal}</span></td>
        <td>${carimbo(SITUACAO_ENVIO, t.situacao)}${t.erro && t.situacao === 'falhou' ? `<br><span class="mini">${esc(t.erro)}</span>` : ''}</td>
        <td class="mini">${t.situacao === 'falhou' ? '' : passos.map(esc).join(' · ')}</td>
      </tr>`;
    };
    el.innerHTML = `
      <div class="faixa-estado ${geral}">
        <span class="selo-estado">${geral === 'incidente' ? 'Com problema' : geral === 'atencao' ? 'Pendente' : 'Tudo certo'}</span>
        <p>${frase}</p>
      </div>
      <div class="duas-colunas">
        <div class="bloco"><h2>Conta no serviço de envio</h2>
          <table><tbody>
            <tr><td>Chave de acesso</td><td class="num">${carimbo(CHAVE, S.conta)}</td></tr>
            <tr><td>Transacional (agenda)</td><td class="num">${contaOk ? selo('Liberado', 'alta') : selo('Indisponível', 'queda')}</td></tr>
            <tr><td>Marketing (campanhas e fluxos)<br><span class="mini">a equipe marca quando o serviço libera</span></td><td class="num">${chave(mktLiberado, 'data-mkt-liberado', mktLiberado ? 'Liberado' : 'Pendente')}</td></tr>
          </tbody></table>
          <p class="mini em-nota">Se a chave parar de funcionar, o problema entra no aviso diário de credenciais, como as outras integrações.</p>
        </div>
        <div class="bloco"><h2>Domínios <small>assinatura e endereço de retorno</small></h2>
          <table><tbody>${linhaDominio('transacional')}${linhaDominio('marketing')}</tbody></table>
          ${S.dominios.consultado ? '' : `<p class="mini em-nota">${MOTIVO_DOM[S.dominios.motivo] || MOTIVO_DOM.sem_resposta}</p>`}
        </div>
      </div>
      <div class="duas-colunas">
        <div class="bloco"><h2>Resultados <small>entregue, voltou, spam, aberto, clicado e descadastro</small></h2>
          <table><tbody>
            <tr><td>Transacional</td><td class="num">${seloResultado(S.resultados.transacional)}</td></tr>
            <tr><td>Marketing</td><td class="num">${seloResultado(S.resultados.marketing)}</td></tr>
          </tbody></table>
          <div class="ag-acoes"><button class="btn sec" type="button" data-conectar${contaOk ? '' : ' disabled'}>Conectar resultados</button></div>
        </div>
        <div class="bloco"><h2>Mandar teste <small>chega com um link para conferir abertura e clique</small></h2>
          <form class="ag-form" data-teste novalidate>
            <label>Para<input type="email" name="para" placeholder="seu e-mail" autocomplete="email"></label>
            <label>Canal<select name="canal"><option value="transacional">Transacional (envio.)</option><option value="marketing">Marketing (news.)</option></select></label>
            <div class="em-erro" aria-live="polite"></div>
            <div class="ag-acoes"><button class="btn" type="submit"${contaOk ? '' : ' disabled'}>Mandar teste</button></div>
          </form>
        </div>
      </div>
      <div class="bloco"><h2>Últimos testes <small>linha do tempo de cada envio</small></h2>
        ${S.testes.length ? `<table><thead><tr><th>Quando</th><th>Para</th><th>Situação</th><th>Linha do tempo</th></tr></thead><tbody>${S.testes.map(linhaTeste).join('')}</tbody></table>`
          : '<p class="aviso">Nenhum teste ainda. Mande um para o seu e-mail e acompanhe aqui.</p>'}
        <div class="ag-acoes"><button class="btn sec" type="button" data-atualizar>Atualizar</button></div>
      </div>
      <div class="bloco"><h2>Remetentes <small>quem aparece como autor do e-mail</small></h2>
        <div class="duas-colunas">${canal('transacional', 'Transacional')}${canal('marketing', 'Marketing')}</div>
      </div>
      <div class="bloco"><h2>Rodapé comum <small>entra no fim de todo e-mail, dos dois canais</small></h2>
        <form class="ag-form" data-rodape novalidate>
          <label>Dados da empresa e endereço físico<textarea name="rodape" rows="3" maxlength="1000">${esc(C.rodape)}</textarea></label>
          <p class="mini">No marketing, o link de descadastro de um clique entra sozinho embaixo do rodapé.</p>
          <div class="em-erro" aria-live="polite"></div>
          <div class="ag-acoes"><button class="btn sec" type="submit">Salvar rodapé</button></div>
        </form>
      </div>`;

    const salvar = (form, campos) => {
      const erro = form.querySelector('.em-erro');
      return ocupado(form.querySelector('[type=submit]'), async () => {
        try {
          const r = await ctx.postJson('/api/email/config', { acao: 'salvar', campos });
          erro.textContent = '';
          S.config = r.config;
          espelharNoPrototipo(S.config);
          avisar('Configuração salva');
        } catch (e) { erro.textContent = msgErro(e); avisar(msgErro(e), 'erro'); }
      });
    };
    el.querySelectorAll('form[data-canal]').forEach((f) => {
      const k = f.dataset.canal;
      f.onsubmit = (ev) => {
        ev.preventDefault();
        salvar(f, { [`remetente_${k}_nome`]: f.nome.value, [`remetente_${k}_email`]: f.endereco.value, [`resposta_${k}`]: f.resposta.value });
      };
    });
    const fr = el.querySelector('form[data-rodape]');
    fr.onsubmit = (ev) => { ev.preventDefault(); salvar(fr, { rodape: fr.rodape.value }); };

    const mkt = el.querySelector('[data-mkt-liberado]');
    mkt.onchange = async () => {
      mkt.disabled = true;
      try {
        const r = await ctx.postJson('/api/email/config', { acao: 'salvar', campos: { marketing_liberado: mkt.checked ? '1' : '0' } });
        S.config = r.config;
        avisar(mkt.checked ? 'Marketing marcado como liberado.' : 'Marketing marcado como pendente.');
        desenharConfig(el);
      } catch (e) { mkt.checked = !mkt.checked; mkt.disabled = false; avisar(msgErro(e), 'erro'); }
    };

    const con = el.querySelector('[data-conectar]');
    con.onclick = () => ocupado(con, async () => {
      try {
        await ctx.postJson('/api/email/config', { acao: 'conectar_resultados' });
        avisar('Resultados conectados nos dois canais.');
        await configuracao(el);
      } catch (e) { avisar(msgErro(e), 'erro'); }
    });

    const ft = el.querySelector('form[data-teste]');
    ft.onsubmit = (ev) => {
      ev.preventDefault();
      const erro = ft.querySelector('.em-erro');
      ocupado(ft.querySelector('[type=submit]'), async () => {
        try {
          const r = await ctx.postJson('/api/email/config', { acao: 'enviar_teste', para: ft.para.value, canal: ft.canal.value });
          S.testes = r.testes;
          avisar('Teste enviado. A entrega aparece em Últimos testes em alguns segundos.');
          desenharConfig(el);
        } catch (e) {
          erro.textContent = msgErro(e);
          avisar(msgErro(e), 'erro');
          if (e.dados && e.dados.testes) S.testes = e.dados.testes;
        }
      });
    };

    const at = el.querySelector('[data-atualizar]');
    at.onclick = () => ocupado(at, () => configuracao(el));
  }

  // ===========================================================================
  // 379 · E-mails da agenda (app Agenda; ligada ao backend: GET/POST /api/agenda/emails)
  // ===========================================================================
  // Configuração por tipo de reunião. As regras (padrão, validação do modelo,
  // lembretes aceitos) ficam no servidor; aqui só a tela. O "Mandar teste" usa
  // o teste de modelo da 378.
  let tipoAgenda = null;
  let agendaEstado = null;
  const rotAntes = (min) => (min >= 60 ? `${min / 60} h antes` : `${min} min antes`);

  async function renderAgenda(c) {
    ctx = c;
    fecharGaveta();
    ctx.$('#subtitulo').textContent = 'saem pelo canal transacional (envio.)';
    const el = ctx.$('#agenda-emails-conteudo');
    el.className = 'em';
    el.innerHTML = '<p class="aviso">Carregando os e-mails da agenda…</p>';
    try {
      agendaEstado = await ctx.fetchJson(`/api/agenda/emails?${tipoAgenda ? `tipo=${tipoAgenda}&` : ''}_=${Date.now()}`);
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar os e-mails da agenda (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    desenharAgenda(el);
  }

  function desenharAgenda(el) {
    const S = agendaEstado;
    tipoAgenda = S.tipo_id;
    if (!S.tipos.length) {
      el.innerHTML = '<p class="aviso">Nenhum tipo de reunião ainda. Crie um em Agenda › Tipos de reunião e volte aqui.</p>';
      return;
    }
    const tipo = S.tipos.find((t) => t.id === S.tipo_id);
    const selModelo = (e) => `<select data-modelo aria-label="Modelo de ${esc(e.nome)}">${S.modelos.some((m) => m.id === e.modelo_id) ? '' : '<option value="">(modelo arquivado)</option>'}${S.modelos.map((m) => `<option value="${m.id}"${m.id === e.modelo_id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`;
    const livres = S.antecedencias.filter((min) => !S.emails.some((e) => e.evento === 'lembrete' && e.antes_min === min));
    el.innerHTML = `<div class="em-barra">
        <div class="ag-subvistas" role="group" aria-label="Tipo de reunião">${S.tipos.map((t) => `<button type="button" class="ag-subvista" data-tipo="${t.id}" aria-pressed="${t.id === S.tipo_id}">${esc(t.nome)}${t.ativo ? '' : ' <span class="mini">(pausado)</span>'}</button>`).join('')}</div>
      </div>
      ${tipo.comercial ? '' : '<div class="aviso explica">Tipo não comercial: a pessoa recebe confirmação e lembretes normalmente, mas não vira contato de marketing.</div>'}
      <div class="bloco"><h2>E-mails de ${esc(tipo.nome)} <small>remetente: ${esc(S.remetente.nome)} &lt;${esc(S.remetente.email)}&gt;</small></h2>
        <div class="tabela-wrap"><table class="em-agenda-tab"><thead><tr><th>E-mail</th><th>Quando sai</th><th>Modelo</th><th>Situação</th><th></th></tr></thead><tbody>
        ${S.emails.map((e) => `<tr data-id="${e.id}">
          <td><b>${esc(e.nome)}</b></td>
          <td><span class="mini">${esc(e.quando)}</span></td>
          <td>${selModelo(e)}</td>
          <td>${chave(!!e.ligado, 'data-ligar')}</td>
          <td><div class="ag-acoes ag-acoes--linha"><button class="btn sec" type="button" data-teste>Mandar teste</button>${e.evento === 'lembrete' ? `<button class="ag-icone" type="button" data-tirar aria-label="Tirar lembrete">${ICONE.fechar}</button>` : ''}</div></td>
        </tr>`).join('')}
        </tbody></table></div>
        ${livres.length ? `<div class="em-lembrete-novo"><span class="mini">Lembretes deste tipo:</span>
          <select data-novo-lembrete aria-label="Novo horário de lembrete"><option value="">Adicionar lembrete…</option>${livres.map((min) => `<option value="${min}">${rotAntes(min)}</option>`).join('')}</select></div>` : ''}
        <ul class="em-regras-agenda mini">
          <li>Reunião cancelada não recebe lembrete.</li>
          <li>Reunião remarcada recebe os lembretes do horário novo, nunca do antigo.</li>
          <li>Lembrete cujo horário já passou não sai (marcou para daqui a 30 minutos: não recebe o de 1 h).</li>
          <li>Mudanças aqui valem para as reuniões marcadas daqui em diante; desligar também segura o que já estava na fila.</li>
          <li>E-mail que não saiu ou voltou aparece no detalhe do agendamento e entra no aviso de integrações.</li>
        </ul>
      </div>`;

    const postAgenda = async (corpo, aviso) => {
      try {
        agendaEstado = await ctx.postJson('/api/agenda/emails', corpo);
        avisar(aviso);
      } catch (e) { avisar(msgErro(e), 'erro'); }
      desenharAgenda(el);
    };
    el.querySelectorAll('[data-tipo]').forEach((b) => { b.onclick = () => { tipoAgenda = Number(b.dataset.tipo); renderAgenda(ctx); }; });
    el.querySelectorAll('tr[data-id]').forEach((tr) => {
      const e = S.emails.find((x) => String(x.id) === tr.dataset.id);
      tr.querySelector('[data-modelo]').onchange = (ev) => {
        const m = S.modelos.find((x) => String(x.id) === ev.target.value);
        if (m) postAgenda({ acao: 'salvar', id: e.id, modelo_id: m.id }, `${e.nome}: modelo trocado para "${m.nome}".`);
      };
      tr.querySelector('[data-ligar]').onchange = (ev) => {
        ev.target.disabled = true;
        postAgenda({ acao: 'salvar', id: e.id, ligado: ev.target.checked }, `${e.nome} ${ev.target.checked ? 'ligado' : 'desligado'} para ${tipo.nome}.`);
      };
      tr.querySelector('[data-teste]').onclick = () => {
        const m = S.modelos.find((x) => x.id === e.modelo_id);
        if (!m) return avisar('Escolha um modelo antes de mandar o teste.', 'erro');
        pedirTeste({ ...m, canal: 'transacional' });
      };
      const t = tr.querySelector('[data-tirar]');
      if (t) t.onclick = () => ctx.pedirConfirmacao(t, 'Tirar este lembrete?', () => postAgenda({ acao: 'tirar_lembrete', id: e.id }, 'Lembrete tirado.'));
    });
    const novo = el.querySelector('[data-novo-lembrete]');
    if (novo) novo.onchange = (ev) => {
      const min = Number(ev.target.value);
      if (!min) return;
      ev.target.disabled = true;
      postAgenda({ acao: 'adicionar_lembrete', tipo_id: S.tipo_id, antes_min: min }, `Lembrete de ${rotAntes(min)} adicionado.`);
    };
  }
})();

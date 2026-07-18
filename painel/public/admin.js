/* Admin do painel — thin client dos endpoints /api/admin/*. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtBRL = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  async function api(caminho, metodo = 'GET', corpo) {
    const r = await fetch(`/api/admin/${caminho}`, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 401) { mostrarLogin(); throw new Error('unauthorized'); }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(dados.error || `HTTP ${r.status}`);
    return dados;
  }

  let clientesCache = [];

  // ---------- login ----------
  function mostrarLogin() { $('#login').hidden = false; $('#app').hidden = true; }

  $('#form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('#login-msg').textContent = '';
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: $('#senha').value }),
    });
    if (r.ok) { $('#login').hidden = true; iniciarApp(); }
    else { $('#login-msg').textContent = 'Senha incorreta.'; $('#login-msg').className = 'msg erro'; }
  });

  // ---------- clientes ----------
  async function carregarClientes() {
    const { clientes } = await api('clientes');
    clientesCache = clientes;
    $('#clientes-tabela').innerHTML = clientes.length ? `<table><thead><tr>
      <th>Cliente</th><th>Link secreto</th><th>Meta Ads</th><th>Google Ads</th><th>GA4</th><th></th>
    </tr></thead><tbody>${clientes.map((c) => `<tr>
      <td>${esc(c.nome)}${c.ativo ? '' : ' <span class="mini">(revogado)</span>'}</td>
      <td>${c.ativo ? `<code class="slug">${location.origin}/c/${esc(c.slug)}</code>` : '—'}</td>
      <td>${esc(c.meta_account_id || '—')}</td><td>${esc(c.gads_customer_id || '—')}</td><td>${esc(c.ga4_property_id || '—')}</td>
      <td>
        <button class="btn sec mini" data-acao="editar" data-id="${c.id}">Editar</button>
        <button class="btn sec mini" data-acao="regenerar_slug" data-id="${c.id}">Novo link</button>
        <button class="btn sec mini" data-acao="${c.ativo ? 'revogar' : 'reativar'}" data-id="${c.id}">${c.ativo ? 'Revogar' : 'Reativar'}</button>
      </td></tr>`).join('')}</tbody></table>` : '<div class="aviso">Nenhum cliente cadastrado.</div>';
    // popular select de metas
    $('#m-cliente').innerHTML = clientes.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  }

  $('#clientes-tabela').addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-acao]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const acao = btn.dataset.acao;
    if (acao === 'editar') {
      const c = clientesCache.find((x) => x.id === id);
      $('#c-id').value = c.id; $('#c-nome').value = c.nome;
      $('#c-meta').value = c.meta_account_id || ''; $('#c-gads').value = c.gads_customer_id || ''; $('#c-ga4').value = c.ga4_property_id || '';
      $('#form-clientes-titulo').textContent = `Editando: ${c.nome}`;
      $('#c-cancelar').hidden = false;
      return;
    }
    if (acao === 'revogar' && !confirm('Revogar o link deste cliente? Ele perde o acesso na hora.')) return;
    await api('clientes', 'PUT', { id, acao });
    $('#clientes-msg').textContent = acao === 'regenerar_slug' ? 'Novo link gerado.' : 'Feito.';
    carregarClientes();
  });

  $('#c-cancelar').addEventListener('click', () => {
    $('#form-cliente').reset(); $('#c-id').value = '';
    $('#form-clientes-titulo').textContent = 'Novo cliente';
    $('#c-cancelar').hidden = true;
  });

  $('#form-cliente').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const corpo = {
      nome: $('#c-nome').value,
      meta_account_id: $('#c-meta').value,
      gads_customer_id: $('#c-gads').value,
      ga4_property_id: $('#c-ga4').value,
    };
    const id = $('#c-id').value;
    try {
      if (id) { await api('clientes', 'PUT', { ...corpo, id: Number(id) }); $('#clientes-msg').textContent = 'Cliente atualizado.'; }
      else {
        const r = await api('clientes', 'POST', corpo);
        $('#clientes-msg').textContent = `Cliente criado — link: ${location.origin}/c/${r.slug}`;
      }
      $('#c-cancelar').click();
      carregarClientes();
    } catch (e) { $('#clientes-msg').textContent = e.message; $('#clientes-msg').className = 'msg erro'; }
  });

  // ---------- metas ----------
  async function carregarMetas() {
    const clienteId = $('#m-cliente').value;
    if (!clienteId) { $('#metas-tabela').innerHTML = '<div class="aviso">Cadastre um cliente primeiro.</div>'; return; }
    const { metas } = await api(`metas?cliente_id=${clienteId}`);
    $('#metas-tabela').innerHTML = metas.length ? `<table><thead><tr>
      <th>Mês</th><th class="num">Meta faturamento</th><th class="num">Meta investimento</th><th class="num">Taxa projetada</th>
    </tr></thead><tbody>${metas.map((m) => `<tr>
      <td>${esc(m.mes)}</td><td class="num">${fmtBRL(m.meta_faturamento_cents)}</td>
      <td class="num">${fmtBRL(m.meta_investimento_cents)}</td>
      <td class="num">${m.taxa_projetada === null ? '—' : m.taxa_projetada.toLocaleString('pt-BR') + '%'}</td></tr>`).join('')}</tbody></table>`
      : '<div class="aviso">Nenhuma meta cadastrada para este cliente.</div>';
  }

  $('#m-cliente').addEventListener('change', carregarMetas);
  $('#form-meta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      await api('metas', 'POST', {
        cliente_id: Number($('#m-cliente').value),
        mes: $('#m-mes').value,
        meta_faturamento: $('#m-fat').value || 0,
        meta_investimento: $('#m-inv').value || 0,
        taxa_projetada: $('#m-taxa').value || null,
      });
      $('#metas-msg').textContent = 'Meta salva.'; $('#metas-msg').className = 'msg';
      carregarMetas();
    } catch (e) { $('#metas-msg').textContent = e.message; $('#metas-msg').className = 'msg erro'; }
  });

  // ---------- status ----------
  const NOME_FONTE = { meta: 'Meta Ads', google: 'Google Ads', ga4: 'GA4' };
  function htmlBackup(raw) {
    if (!raw) return '<p class="msg"><span class="dot vermelho"></span>Último backup: sem registro</p>';
    const [st, stamp, tam, drive] = raw.split('|');
    const dt = new Date(`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(9,11)}:${stamp.slice(11,13)}:00-03:00`);
    const horas = (Date.now() - dt.getTime()) / 36e5;
    const ok = st === 'ok' && drive !== 'erro' && horas < 12;
    return `<p class="msg"><span class="dot ${ok ? 'verde' : 'vermelho'}"></span>` +
      `Último backup: ${dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` +
      ` · ${tam} · Drive ${drive}${horas >= 12 ? ' · <b>atrasado!</b>' : ''}</p>`;
  }
  async function carregarStatus() {
    const { status, backup } = await api('status');
    $('#backup-status').innerHTML = htmlBackup(backup);
    $('#status-tabela').innerHTML = status.length ? `<table><thead><tr>
      <th>Cliente</th><th>Fonte</th><th>Situação</th><th>Dados até</th><th>Último sync</th><th>Erro</th>
    </tr></thead><tbody>${status.map((s) => `<tr>
      <td>${esc(s.cliente)}</td><td>${NOME_FONTE[s.fonte]}</td>
      <td><span class="dot ${s.status}"></span>${s.status === 'verde' ? 'ok' : s.status === 'amarelo' ? 'sem dados novos' : 'erro'}</td>
      <td>${s.ultima_data ? esc(s.ultima_data) : '—'}</td>
      <td>${s.ultimo_sync ? new Date(s.ultimo_sync * 1000).toLocaleString('pt-BR') : 'nunca'}</td>
      <td class="mini">${esc(s.erro || '')}</td></tr>`).join('')}</tbody></table>`
      : '<div class="aviso">Nenhuma conexão para monitorar ainda.</div>';
  }

  $('#btn-sync').addEventListener('click', async () => {
    $('#btn-sync').disabled = true;
    $('#sync-msg').textContent = 'Sincronizando…';
    try {
      const r = await api('sync', 'POST', {});
      const total = r.clientes.flatMap((c) => c.resultados).reduce((s, x) => s + (x.linhas || 0), 0);
      $('#sync-msg').textContent = `Sincronizado (${r.de} a ${r.ate}) — ${total} linhas.`;
      carregarStatus();
    } catch (e) { $('#sync-msg').textContent = 'Falhou: ' + e.message; }
    $('#btn-sync').disabled = false;
  });

  // ---------- navegação ----------
  const VIEWS = { clientes: carregarClientes, metas: async () => { await carregarClientes(); await carregarMetas(); }, status: carregarStatus };
  function trocarView() {
    const v = VIEWS[location.hash.replace('#', '')] ? location.hash.replace('#', '') : 'clientes';
    document.querySelectorAll('.secao').forEach((s) => s.classList.toggle('ativa', s.id === `view-${v}`));
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.view === v));
    VIEWS[v]().catch(() => {});
  }

  async function iniciarApp() {
    $('#app').hidden = false;
    window.addEventListener('hashchange', trocarView);
    trocarView();
  }

  // sessão existente? testa uma chamada
  (async () => {
    try { await api('clientes'); $('#login').hidden = true; iniciarApp(); }
    catch { /* mostrarLogin já foi chamado no 401 */ }
  })();
})();

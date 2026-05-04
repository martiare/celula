import { APP } from './state.js';
import { icon, escapeHtml, showToast, avatarColor } from './helpers.js';
import { apiGet, apiPost, authHeaders, getIgrejaAtiva, parseUser } from './api.js';
import { openModal, closeModal, modalHtml } from './modal.js';

export function igrejaPage() {
  const ig = APP.state.data.igrejaDados;

  if (!ig) {
    return `
    <div class="page-fade">
      <div class="card simple-page" style="text-align:center;padding:48px 24px">
        <div style="font-size:2rem;margin-bottom:12px">⛪</div>
        <p style="color:var(--muted);margin-bottom:16px">Não foi possível carregar os dados da igreja.<br>Verifique a conexão e tente novamente.</p>
        <button class="btn btn-primary" id="igRecarregarBtn">${icon('refresh')} Tentar novamente</button>
      </div>
    </div>`;
  }

  const fotoSrc = ig.foto_url || '';
  const iniciais = (ig.nome || 'I').slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(ig.nome || 'Igreja');

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Igreja</div>
        <h2 class="section-title">${escapeHtml(ig.nome || '')}</h2>
        <p class="text-muted">${ig.cidade ? escapeHtml(ig.cidade) + (ig.uf ? ' — ' + escapeHtml(ig.uf) : '') : 'Dados da sua igreja'}</p>
      </div>
      <button class="btn btn-outline" data-open-ig-edit type="button">${icon('edit')} Editar</button>
    </div>

    <div class="card" style="display:grid;grid-template-columns:180px 1fr;gap:28px;align-items:start">
      <div style="text-align:center">
        <div class="igreja-foto-wrap" id="igrejaFotoWrap">
          ${fotoSrc
            ? `<img id="igrejaFotoImg" src="${escapeHtml(fotoSrc)}" class="igreja-foto" alt="logo" />`
            : `<div id="igrejaFotoImg" class="igreja-foto-initials" style="background:${avatarBg}">${iniciais}</div>`}
          <label class="perfil-foto-overlay" title="Alterar foto/logo">
            ${icon('photo_camera')}
            <input id="igrejaFotoInput" type="file" accept="image/*" style="display:none" />
          </label>
        </div>
        <p class="perfil-foto-hint">Clique para alterar</p>
      </div>

      <div class="form-grid" style="margin:0">
        <label class="field-label">Nome *
          <input id="ig_nome" class="form-ctrl" type="text" value="${escapeHtml(ig.nome || '')}" />
        </label>
        <label class="field-label">Razão Social
          <input id="ig_razao" class="form-ctrl" type="text" value="${escapeHtml(ig.razao_social || '')}" />
        </label>
        <label class="field-label">CNPJ
          <input id="ig_cnpj" class="form-ctrl" type="text" placeholder="00.000.000/0001-00" value="${escapeHtml(ig.cnpj || '')}" />
        </label>
        <label class="field-label">Data de fundação
          <input id="ig_fundacao" class="form-ctrl" type="date" value="${ig.data_fundacao ? ig.data_fundacao.slice(0,10) : ''}" />
        </label>
        <label class="field-label">Telefone
          <input id="ig_tel" class="form-ctrl" type="text" placeholder="(21) 3333-4444" value="${escapeHtml(ig.telefone || '')}" />
        </label>
        <label class="field-label">E-mail
          <input id="ig_email" class="form-ctrl" type="email" placeholder="contato@igreja.com" value="${escapeHtml(ig.email || '')}" />
        </label>
        <label class="field-label">CEP
          <input id="ig_cep" class="form-ctrl" type="text" placeholder="00000-000" value="${escapeHtml(ig.cep || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 1">Logradouro
          <input id="ig_end" class="form-ctrl" type="text" value="${escapeHtml(ig.endereco || '')}" />
        </label>
        <label class="field-label">Número
          <input id="ig_num" class="form-ctrl" type="text" value="${escapeHtml(ig.numero || '')}" />
        </label>
        <label class="field-label">Bairro
          <input id="ig_bairro" class="form-ctrl" type="text" value="${escapeHtml(ig.bairro || '')}" />
        </label>
        <label class="field-label">Cidade
          <input id="ig_cidade" class="form-ctrl" type="text" value="${escapeHtml(ig.cidade || '')}" />
        </label>
        <label class="field-label">UF
          <input id="ig_uf" class="form-ctrl" type="text" maxlength="2" value="${escapeHtml(ig.uf || '')}" style="text-transform:uppercase" />
        </label>

        <div style="grid-column:1/-1;display:flex;gap:10px;margin-top:4px">
          <button class="btn btn-primary" id="igSalvarBtn">${icon('save')} Salvar alterações</button>
        </div>
      </div>
    </div>

    ${(() => {
      const user = APP.state.user || parseUser();
      const todas = user?.igrejas || user?.empresas || [];
      const outras = todas.filter(i => String(i.id) !== String(ig.id));
      if (!outras.length) return '';
      return `
    <div class="card" style="margin-top:0">
      <div class="table-toolbar" style="margin-bottom:12px">
        <h3 class="table-title">${icon('church')} Outras igrejas vinculadas</h3>
        <span class="table-count">${outras.length} igreja${outras.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">
        ${outras.map(i => `
          <div class="ig-chip">
            <div class="ig-chip-dot" style="background:${avatarColor(i.nome)}"></div>
            <span>${escapeHtml(i.nome)}</span>
          </div>`).join('')}
      </div>
    </div>`;
    })()}
  </div>`;
}

export function bindIgrejaPage({ renderPage }) {
  const iid = getIgrejaAtiva();

  // Se dados não carregaram, tenta recarregar automaticamente
  if (!APP.state.data.igrejaDados) {
    loadIgrejaDados().then(() => { if (APP.state.data.igrejaDados) renderPage(); });
  }

  document.getElementById('igRecarregarBtn')?.addEventListener('click', async () => {
    await loadIgrejaDados();
    renderPage();
  });

  // CEP auto-fill
  document.getElementById('ig_cep')?.addEventListener('blur', async e => {
    const c = e.target.value.replace(/\D/g, '');
    if (c.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const d = await res.json();
      if (d.erro) return;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('ig_end',    d.logradouro);
      set('ig_bairro', d.bairro);
      set('ig_cidade', d.localidade);
      set('ig_uf',     d.uf);
    } catch { /* sem internet */ }
  });

  // Upload foto da igreja
  document.getElementById('igrejaFotoInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('foto', file);
    try {
      const r = await fetch(`/api/minha-igreja/foto?igreja_id=${iid}`, { method: 'POST', body: fd, headers: authHeaders({}) });
      const d = await r.json();
      if (!r.ok) { showToast(d.message || 'Erro ao enviar foto.', 'error'); return; }
      const wrap = document.getElementById('igrejaFotoImg');
      if (wrap) {
        const img = document.createElement('img');
        img.src = d.foto_url + '?t=' + Date.now();
        img.className = 'igreja-foto';
        img.id = 'igrejaFotoImg';
        wrap.replaceWith(img);
      }
      if (APP.state.data.igrejaDados) APP.state.data.igrejaDados.foto_url = d.foto_url;
      showToast('Foto da igreja atualizada!');
    } catch { showToast('Erro ao enviar foto.', 'error'); }
  });

  // Salvar dados
  document.getElementById('igSalvarBtn')?.addEventListener('click', async () => {
    const payload = {
      id:           iid,
      nome:         document.getElementById('ig_nome').value.trim(),
      razao_social: document.getElementById('ig_razao').value.trim(),
      cnpj:         document.getElementById('ig_cnpj').value.trim(),
      data_fundacao: document.getElementById('ig_fundacao').value || null,
      telefone:     document.getElementById('ig_tel').value.trim(),
      email:        document.getElementById('ig_email').value.trim(),
      cep:          document.getElementById('ig_cep').value.trim(),
      endereco:     document.getElementById('ig_end').value.trim(),
      numero:       document.getElementById('ig_num').value.trim(),
      bairro:       document.getElementById('ig_bairro').value.trim(),
      cidade:       document.getElementById('ig_cidade').value.trim(),
      uf:           document.getElementById('ig_uf').value.trim().toUpperCase(),
    };
    if (!payload.nome) return showToast('Nome da igreja obrigatório.', 'error');
    try {
      await apiPost('/api/admin/igrejas', payload);
      await loadIgrejaDados();
      renderPage();
      showToast('Igreja salva com sucesso.');
    } catch (err) { showToast(err.message || 'Erro ao salvar.', 'error'); }
  });
}

export async function loadIgrejaDados() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/minha-igreja?igreja_id=${iid}`);
    APP.state.data.igrejaDados = data;
  } catch { APP.state.data.igrejaDados = null; }
}

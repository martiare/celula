import { APP } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';
import { apiPost, apiPatch } from './api.js';
import { loadAdminData } from './loaders.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

const NIVEIS = ['administrador', 'pastor_presidente', 'lider_macro', 'lider_celula', 'secretario', 'observer'];

export function adminPage() {
  const tab = APP.state.adminTab;

  const userRows = APP.state.data.adminUsers.length
    ? APP.state.data.adminUsers.map(u => `
      <tr>
        <td>${escapeHtml(u.nome || '')}</td>
        <td>${escapeHtml(u.email || '—')}</td>
        <td><span class="badge-pill">${escapeHtml(u.nivel || 'observer')}</span></td>
        <td>${u.igrejas ? escapeHtml(u.igrejas) : '<span style="color:var(--danger);font-size:.8rem">Sem vínculo</span>'}</td>
        <td><span class="status-dot ${u.ativo ? 'dot-on' : 'dot-off'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-user='${JSON.stringify({ id: u.id, nome: u.nome, email: u.email, nivel: u.nivel })}'>${icon('edit')}</button>
          ${u.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-user="${u.id}" data-label="${escapeHtml(u.nome)}">${icon('block')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="empty-cell">Nenhum usuário cadastrado.</td></tr>`;

  const igrejaRows = APP.state.data.igrejas.length
    ? APP.state.data.igrejas.map(c => `
      <tr>
        <td>${escapeHtml(c.nome || '')}</td>
        <td>${escapeHtml(c.cidade || '')}${c.uf ? ` / ${escapeHtml(c.uf)}` : ''}</td>
        <td>${escapeHtml(c.telefone || '—')}</td>
        <td><span class="status-dot ${c.ativo ? 'dot-on' : 'dot-off'}">${c.ativo ? 'Ativa' : 'Inativa'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-igreja='${JSON.stringify({ id: c.id, nome: c.nome, cnpj: c.cnpj, cidade: c.cidade, uf: c.uf, telefone: c.telefone, email: c.email, ativo: c.ativo })}'>${icon('edit')}</button>
          ${c.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-igreja="${c.id}" data-label="${escapeHtml(c.nome)}">${icon('block')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty-cell">Nenhuma igreja cadastrada.</td></tr>`;

  const linkRows = APP.state.data.links.length
    ? APP.state.data.links.map(l => `
      <tr>
        <td>${escapeHtml(l.usuario_nome || '')}</td>
        <td>${escapeHtml(l.igreja_nome || '')}</td>
        <td><span class="badge-pill">${escapeHtml(l.nivel || '—')}</span></td>
        <td><span class="status-dot ${l.ativo ? 'dot-on' : 'dot-off'}">${l.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          ${l.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-link="${l.id}" data-label="${escapeHtml((l.usuario_nome || '') + ' × ' + (l.igreja_nome || ''))}">${icon('link_off')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="5" class="empty-cell">Nenhum vínculo cadastrado.</td></tr>`;

  const tables = {
    igrejas: {
      title: 'Igrejas', count: APP.state.data.igrejas.length,
      thead: '<tr><th>Nome</th><th>Cidade / UF</th><th>Telefone</th><th>Status</th><th>Ações</th></tr>',
      tbody: igrejaRows
    },
    usuarios: {
      title: 'Usuários', count: APP.state.data.adminUsers.length,
      thead: '<tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Igreja(s)</th><th>Status</th><th>Ações</th></tr>',
      tbody: userRows
    },
    vinculos: {
      title: 'Vínculos usuário × igreja', count: APP.state.data.links.length,
      thead: '<tr><th>Usuário</th><th>Igreja</th><th>Nível</th><th>Status</th><th>Ações</th></tr>',
      tbody: linkRows
    }
  };
  const t = tables[tab] || tables.igrejas;

  return `
  <div class="page-fade admin-layout">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Administração</div>
        <h2 class="section-title">Gestão de acessos</h2>
        <p class="text-muted">Igrejas, usuários e vínculos de acesso ao sistema.</p>
      </div>
      <div class="admin-header-actions">
        <button class="btn btn-primary" data-open-igreja-modal type="button">${icon('church')} Nova igreja</button>
        <button class="btn btn-outline" data-open-user-modal type="button">${icon('person_add')} Novo usuário</button>
        <button class="btn btn-outline" data-open-link-modal type="button">${icon('link')} Novo vínculo</button>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab${tab === 'igrejas' ? ' active' : ''}" data-admin-tab="igrejas">
        ${icon('church')} Igrejas <span class="tab-count">${APP.state.data.igrejas.length}</span>
      </button>
      <button class="tab${tab === 'usuarios' ? ' active' : ''}" data-admin-tab="usuarios">
        ${icon('manage_accounts')} Usuários <span class="tab-count">${APP.state.data.adminUsers.length}</span>
      </button>
      <button class="tab${tab === 'vinculos' ? ' active' : ''}" data-admin-tab="vinculos">
        ${icon('link')} Vínculos <span class="tab-count">${APP.state.data.links.length}</span>
      </button>
    </div>

    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">${escapeHtml(t.title)}</h3>
        <span class="table-count">${t.count} registro${t.count !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>${t.thead}</thead>
          <tbody>${t.tbody}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function openIgrejaModal(renderPage, igreja = null) {
  const isEdit = !!igreja;
  openModal(modalHtml({
    title: isEdit ? 'Editar igreja' : 'Nova igreja',
    subtitle: 'Preencha os dados da igreja.',
    body: `
      <div class="form-grid">
        <label class="field-label">Nome *<input id="ig_nome" class="form-ctrl" type="text" placeholder="Igreja Assembleia..." value="${escapeHtml(igreja?.nome || '')}" /></label>
        <label class="field-label">CNPJ<input id="ig_cnpj" class="form-ctrl" type="text" placeholder="00.000.000/0001-00" value="${escapeHtml(igreja?.cnpj || '')}" /></label>
        <label class="field-label">Cidade<input id="ig_cidade" class="form-ctrl" type="text" placeholder="São Paulo" value="${escapeHtml(igreja?.cidade || '')}" /></label>
        <label class="field-label">UF<input id="ig_uf" class="form-ctrl" type="text" maxlength="2" placeholder="SP" value="${escapeHtml(igreja?.uf || '')}" /></label>
        <label class="field-label">Telefone<input id="ig_tel" class="form-ctrl" type="text" placeholder="(11) 99999-9999" value="${escapeHtml(igreja?.telefone || '')}" /></label>
        <label class="field-label">E-mail<input id="ig_email" class="form-ctrl" type="email" placeholder="contato@igreja.com" value="${escapeHtml(igreja?.email || '')}" /></label>
        ${isEdit ? `<label class="field-label">Status<select id="ig_ativo" class="form-ctrl"><option value="true"${igreja?.ativo ? ' selected' : ''}>Ativa</option><option value="false"${!igreja?.ativo ? ' selected' : ''}>Inativa</option></select></label>` : ''}
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveIgrejaBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveIgrejaBtn').addEventListener('click', async () => {
    const payload = {
      ...(isEdit ? { id: igreja.id } : {}),
      nome:     document.getElementById('ig_nome').value.trim(),
      cnpj:     document.getElementById('ig_cnpj').value.trim(),
      cidade:   document.getElementById('ig_cidade').value.trim(),
      uf:       document.getElementById('ig_uf').value.trim().toUpperCase(),
      telefone: document.getElementById('ig_tel').value.trim(),
      email:    document.getElementById('ig_email').value.trim(),
      ...(isEdit ? { ativo: document.getElementById('ig_ativo').value === 'true' } : {})
    };
    if (!payload.nome) return showToast('Informe o nome da igreja.', 'error');
    try {
      await apiPost('/api/admin/igrejas', payload);
      closeModal(); await loadAdminData(); renderPage();
      showToast(`Igreja ${isEdit ? 'atualizada' : 'criada'} com sucesso.`);
    } catch (err) { showToast(err.message || 'Erro ao salvar igreja.', 'error'); }
  });
}

function openUserModal(renderPage, user = null) {
  const isEdit = !!user;
  openModal(modalHtml({
    title: isEdit ? 'Editar usuário' : 'Novo usuário',
    subtitle: 'Preencha os dados do usuário.',
    body: `
      <div class="form-grid">
        <label class="field-label">Nome *<input id="u_nome" class="form-ctrl" type="text" placeholder="Nome completo" value="${escapeHtml(user?.nome || '')}" /></label>
        <label class="field-label">E-mail *<input id="u_email" class="form-ctrl" type="email" placeholder="usuario@email.com" value="${escapeHtml(user?.email || '')}" /></label>
        <label class="field-label">Senha ${isEdit ? '(em branco = manter)' : '*'}<input id="u_senha" class="form-ctrl" type="password" placeholder="••••••••" /></label>
        <label class="field-label">Nível *
          <select id="u_nivel" class="form-ctrl">
            ${NIVEIS.map(n => `<option value="${n}"${(user?.nivel || 'observer') === n ? ' selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveUserBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveUserBtn').addEventListener('click', async () => {
    const payload = {
      ...(isEdit ? { id: user.id } : {}),
      nome:  document.getElementById('u_nome').value.trim(),
      email: document.getElementById('u_email').value.trim(),
      senha: document.getElementById('u_senha').value,
      nivel: document.getElementById('u_nivel').value
    };
    if (!payload.nome)  return showToast('Informe o nome.', 'error');
    if (!payload.email) return showToast('Informe o e-mail.', 'error');
    if (!isEdit && !payload.senha) return showToast('Informe a senha.', 'error');
    try {
      await apiPost('/api/admin/usuarios', payload);
      closeModal(); await loadAdminData(); renderPage();
      showToast(`Usuário ${isEdit ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) { showToast(err.message || 'Erro ao salvar usuário.', 'error'); }
  });
}

function openLinkModal(renderPage) {
  const users   = APP.state.data.adminUsers;
  const igrejas = APP.state.data.igrejas.filter(i => i.ativo);
  if (!users.length || !igrejas.length) {
    showToast('Cadastre usuários e igrejas antes de criar vínculos.', 'error'); return;
  }
  openModal(modalHtml({
    title: 'Novo vínculo',
    subtitle: 'Relacione um usuário a uma igreja.',
    body: `
      <div class="form-grid">
        <label class="field-label">Usuário *
          <select id="l_usuario" class="form-ctrl">
            ${users.map(u => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Igreja *
          <select id="l_igreja" class="form-ctrl">
            ${igrejas.map(i => `<option value="${i.id}">${escapeHtml(i.nome)}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Nível no vínculo
          <select id="l_nivel" class="form-ctrl">
            <option value="">— herdar do usuário —</option>
            ${NIVEIS.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </label>
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveLinkBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveLinkBtn').addEventListener('click', async () => {
    const payload = {
      usuario_id: Number(document.getElementById('l_usuario').value),
      igreja_id:  Number(document.getElementById('l_igreja').value),
      nivel:      document.getElementById('l_nivel').value || null
    };
    try {
      await apiPost('/api/admin/vinculos', payload);
      closeModal(); await loadAdminData(); renderPage();
      showToast('Vínculo criado com sucesso.');
    } catch (err) { showToast(err.message || 'Erro ao salvar vínculo.', 'error'); }
  });
}

export function bindAdminPage({ renderPage }) {
  document.querySelector('[data-open-igreja-modal]')?.addEventListener('click', () => openIgrejaModal(renderPage));
  document.querySelector('[data-open-user-modal]')?.addEventListener('click', () => openUserModal(renderPage));
  document.querySelector('[data-open-link-modal]')?.addEventListener('click', () => openLinkModal(renderPage));

  document.querySelectorAll('[data-edit-igreja]').forEach(b =>
    b.addEventListener('click', () => openIgrejaModal(renderPage, JSON.parse(b.dataset.editIgreja))));
  document.querySelectorAll('[data-edit-user]').forEach(b =>
    b.addEventListener('click', () => openUserModal(renderPage, JSON.parse(b.dataset.editUser))));

  document.querySelectorAll('[data-desativar-igreja]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('igreja', b.dataset.label, async () => {
      await apiPatch(`/api/admin/igrejas/${b.dataset.desativarIgreja}/desativar`);
      await loadAdminData(); renderPage(); showToast('Igreja desativada.');
    })));
  document.querySelectorAll('[data-desativar-user]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('usuário', b.dataset.label, async () => {
      await apiPatch(`/api/admin/usuarios/${b.dataset.desativarUser}/desativar`);
      await loadAdminData(); renderPage(); showToast('Usuário desativado.');
    })));
  document.querySelectorAll('[data-desativar-link]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('vínculo', b.dataset.label, async () => {
      await apiPatch(`/api/admin/vinculos/${b.dataset.desativarLink}/desativar`);
      await loadAdminData(); renderPage(); showToast('Vínculo desativado.');
    })));
}

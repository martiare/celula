import { APP } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';
import { apiGet, apiPost, apiDelete } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';
import { getIgrejaAtiva } from './api.js';

export function gruposPastorPage() {
  const items = APP.state.data.gruposPastor || [];

  const rows = items.length
    ? items.map(g => `
      <tr>
        <td>${escapeHtml(g.nome || '')}</td>
        <td><span class="status-dot ${g.ativo ? 'dot-on' : 'dot-off'}">${g.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-grupo='${JSON.stringify({ id: g.id, nome: g.nome, ativo: g.ativo })}'>${icon('edit')}</button>
          <button class="btn btn-xs btn-danger-outline" data-excluir-grupo="${g.id}" data-label="${escapeHtml(g.nome)}">${icon('delete')}</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="empty-cell">Nenhum grupo cadastrado.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Pastores</div>
        <h2 class="section-title">Grupos de pastor</h2>
        <p class="text-muted">Organize os pastores em grupos de supervisão.</p>
      </div>
      <button class="btn btn-primary" data-open-grupo-modal type="button">${icon('add')} Novo grupo</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Grupos</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function openGrupoModal(renderPage, grupo = null) {
  const isEdit = !!grupo;
  openModal(modalHtml({
    title: isEdit ? 'Editar grupo' : 'Novo grupo de pastor',
    subtitle: 'Preencha os dados do grupo.',
    body: `
      <div class="form-grid">
        <label class="field-label" style="grid-column:1/-1">Nome *
          <input id="gp_nome" class="form-ctrl" type="text" placeholder="Ex: Pastores da Zona Norte" value="${escapeHtml(grupo?.nome || '')}" />
        </label>
        ${isEdit ? `<label class="field-label">Status
          <select id="gp_ativo" class="form-ctrl">
            <option value="true"${grupo?.ativo ? ' selected' : ''}>Ativo</option>
            <option value="false"${!grupo?.ativo ? ' selected' : ''}>Inativo</option>
          </select>
        </label>` : ''}
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveGrupoBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveGrupoBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveGrupoBtn');
    if (btn?.disabled) return;
    const iid = getIgrejaAtiva();
    const payload = {
      ...(isEdit ? { id: grupo.id } : {}),
      nome: document.getElementById('gp_nome').value.trim(),
      ...(isEdit ? { ativo: document.getElementById('gp_ativo').value === 'true' } : {})
    };
    if (!payload.nome) return showToast('Informe o nome do grupo.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/grupos-pastor?igreja_id=${iid}`, payload);
      closeModal();
      await loadGruposPastor();
      renderPage();
      showToast(`Grupo ${isEdit ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar grupo.', 'error');
    }
  });
}

export function bindGruposPastorPage({ renderPage }) {
  document.querySelector('[data-open-grupo-modal]')?.addEventListener('click', () => openGrupoModal(renderPage));

  document.querySelectorAll('[data-edit-grupo]').forEach(b =>
    b.addEventListener('click', () => openGrupoModal(renderPage, JSON.parse(b.dataset.editGrupo))));

  document.querySelectorAll('[data-excluir-grupo]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('grupo de pastor', b.dataset.label, async () => {
      const iid = getIgrejaAtiva();
      await apiDelete(`/api/grupos-pastor/${b.dataset.excluirGrupo}?igreja_id=${iid}`);
      await loadGruposPastor();
      renderPage();
      showToast('Grupo excluído.');
    })));
}

export async function loadGruposPastor() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/grupos-pastor?igreja_id=${iid}`);
    APP.state.data.gruposPastor = data.items || [];
  } catch { /* mantém state existente em caso de erro */ }
}

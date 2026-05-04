import { APP } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';
import { apiGet, apiPost, apiDelete, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

export function ministeriosPage() {
  const items = APP.state.data.ministerios || [];

  const rows = items.length
    ? items.map(m => `
      <tr>
        <td>${escapeHtml(m.nome || '')}</td>
        <td><span class="status-dot ${m.ativo ? 'dot-on' : 'dot-off'}">${m.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-min='${JSON.stringify({ id: m.id, nome: m.nome, ativo: m.ativo })}'>${icon('edit')}</button>
          <button class="btn btn-xs btn-danger-outline" data-excluir-min="${m.id}" data-label="${escapeHtml(m.nome)}">${icon('delete')}</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="3" class="empty-cell">Nenhum ministério cadastrado.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Ministérios</div>
        <h2 class="section-title">Ministérios</h2>
        <p class="text-muted">Grupos ministeriais aos quais os discípulos podem pertencer.</p>
      </div>
      <button class="btn btn-primary" data-open-min-modal type="button">${icon('add')} Novo ministério</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Ministérios</h3>
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

function openMinisterioModal(renderPage, min = null) {
  const isEdit = !!min;
  openModal(modalHtml({
    title: isEdit ? 'Editar ministério' : 'Novo ministério',
    subtitle: 'Preencha o nome do ministério.',
    body: `
      <div class="form-grid">
        <label class="field-label" style="grid-column:1/-1">Nome *
          <input id="mn_nome" class="form-ctrl" type="text" placeholder="Ex: Louvor, Dança, Infantil..." value="${escapeHtml(min?.nome || '')}" />
        </label>
        ${isEdit ? `<label class="field-label">Status
          <select id="mn_ativo" class="form-ctrl">
            <option value="true"${min?.ativo ? ' selected' : ''}>Ativo</option>
            <option value="false"${!min?.ativo ? ' selected' : ''}>Inativo</option>
          </select>
        </label>` : ''}
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveMinBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveMinBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveMinBtn');
    if (btn?.disabled) return;
    const iid = getIgrejaAtiva();
    const payload = {
      ...(isEdit ? { id: min.id } : {}),
      nome: document.getElementById('mn_nome').value.trim(),
      ...(isEdit ? { ativo: document.getElementById('mn_ativo').value === 'true' } : {})
    };
    if (!payload.nome) return showToast('Informe o nome do ministério.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/ministerios?igreja_id=${iid}`, payload);
      closeModal();
      await loadMinisterios();
      renderPage();
      showToast(`Ministério ${isEdit ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar ministério.', 'error');
    }
  });
}

export function bindMinisteriosPage({ renderPage }) {
  document.querySelector('[data-open-min-modal]')?.addEventListener('click', () => openMinisterioModal(renderPage));

  document.querySelectorAll('[data-edit-min]').forEach(b =>
    b.addEventListener('click', () => openMinisterioModal(renderPage, JSON.parse(b.dataset.editMin))));

  document.querySelectorAll('[data-excluir-min]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('ministério', b.dataset.label, async () => {
      const iid = getIgrejaAtiva();
      await apiDelete(`/api/ministerios/${b.dataset.excluirMin}?igreja_id=${iid}`);
      await loadMinisterios();
      renderPage();
      showToast('Ministério excluído.');
    })));
}

export async function loadMinisterios() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/ministerios?igreja_id=${iid}`);
    APP.state.data.ministerios = data.items || [];
  } catch { /* mantém state existente em caso de erro */ }
}

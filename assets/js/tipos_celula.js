import { APP } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';
import { apiGet, apiPost, apiDelete, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

export function tiposCelulaPage() {
  const items = APP.state.data.tiposCelula || [];
  const rows = items.length
    ? items.map(t => `
      <tr>
        <td>${escapeHtml(t.nome || '')}</td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-tipo='${JSON.stringify({ id: t.id, nome: t.nome })}'>${icon('edit')}</button>
          <button class="btn btn-xs btn-danger-outline" data-excluir-tipo="${t.id}" data-label="${escapeHtml(t.nome)}">${icon('delete')}</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="2" class="empty-cell">Nenhum tipo de célula cadastrado.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Célula</div>
        <h2 class="section-title">Tipos de célula</h2>
        <p class="text-muted">Categorias utilizadas no cadastro de células.</p>
      </div>
      <button class="btn btn-primary" data-open-tipo-modal type="button">${icon('add')} Novo tipo</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Tipos</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function openTipoModal(renderPage, tipo = null) {
  const isEdit = !!tipo;
  openModal(modalHtml({
    title: isEdit ? 'Editar tipo' : 'Novo tipo de célula',
    body: `
      <div class="form-grid">
        <label class="field-label" style="grid-column:1/-1">Nome *
          <input id="tc_nome" class="form-ctrl" type="text" placeholder="Ex: Multiplicação, Consolidação..." value="${escapeHtml(tipo?.nome || '')}" />
        </label>
      </div>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveTipoBtn" type="button">${icon('save')} Salvar</button>`
  }));
  document.getElementById('saveTipoBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveTipoBtn');
    if (btn?.disabled) return;
    const iid = getIgrejaAtiva();
    const payload = { ...(isEdit ? { id: tipo.id } : {}), nome: document.getElementById('tc_nome').value.trim() };
    if (!payload.nome) return showToast('Informe o nome.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/tipos-celula?igreja_id=${iid}`, payload);
      closeModal(); await loadTiposCelula(); renderPage();
      showToast(`Tipo ${isEdit ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar.', 'error');
    }
  });
}

export function bindTiposCelulaPage({ renderPage }) {
  document.querySelector('[data-open-tipo-modal]')?.addEventListener('click', () => openTipoModal(renderPage));
  document.querySelectorAll('[data-edit-tipo]').forEach(b =>
    b.addEventListener('click', () => openTipoModal(renderPage, JSON.parse(b.dataset.editTipo))));
  document.querySelectorAll('[data-excluir-tipo]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('tipo de célula', b.dataset.label, async () => {
      await apiDelete(`/api/tipos-celula/${b.dataset.excluirTipo}?igreja_id=${getIgrejaAtiva()}`);
      await loadTiposCelula(); renderPage();
      showToast('Tipo excluído.');
    })));
}

export async function loadTiposCelula() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/tipos-celula?igreja_id=${iid}`);
    APP.state.data.tiposCelula = data.items || [];
  } catch { /* mantém */ }
}

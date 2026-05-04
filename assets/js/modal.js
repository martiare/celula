import { MODAL_ROOT } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';

export function modalHtml({ title, subtitle = '', body, actions, wide = false, wider = false, xl = false }) {
  const cls = xl ? ' modal-xl' : (wider ? ' modal-wider' : (wide ? ' modal-wide' : ''));
  return `
    <div class="modal-backdrop${cls}" id="modalBackdrop">
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <h3 class="modal-title">${escapeHtml(title)}</h3>
            ${subtitle ? `<p class="modal-sub">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <button class="icon-btn" data-modal-close aria-label="Fechar">${icon('close')}</button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">${actions}</div>
      </div>
    </div>`;
}

export function openModal(html) {
  MODAL_ROOT.innerHTML = html;
  _bindModalClose();
}

export function closeModal() {
  MODAL_ROOT.innerHTML = '';
}

function _bindModalClose() {
  document.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', closeModal));
  // Não fecha ao clicar fora — usuário precisa usar o botão Cancelar ou X
}

export function confirmDelete(tipo, label, onConfirm) {
  openModal(modalHtml({
    title: `Excluir ${tipo}`,
    subtitle: 'Esta ação não pode ser desfeita.',
    body: `<p>Confirma a exclusão de <strong>${escapeHtml(label)}</strong>?</p>`,
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-danger" id="confirmDeleteBtn" type="button">${icon('delete')} Excluir</button>`
  }));
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    try { await onConfirm(); closeModal(); } catch (err) { showToast(err.message || 'Erro ao excluir.', 'error'); }
  });
}

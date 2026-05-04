import { APP } from './state.js';
import { icon, escapeHtml, showToast, buildLocalPickerHtml, bindLocalPickerField } from './helpers.js';
import { apiGet, apiPost, apiDelete, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

const TIPOS_MACRO = ['Masculino', 'Feminino', 'Misto', 'Jovens', 'Casais', 'Infantil'];

export function macrocelulasPage() {
  const items = APP.state.data.macrocelulas || [];
  const rows = items.length
    ? items.map(m => `
      <tr>
        <td>${escapeHtml(m.codigo || '—')}</td>
        <td>${escapeHtml(m.nome || '')}</td>
        <td>${escapeHtml(m.tipo || '—')}</td>
        <td>${escapeHtml(m.lider_nome || '—')}</td>
        <td>${escapeHtml(m.descricao || '—')}</td>
        <td><span class="status-dot ${m.ativo ? 'dot-on' : 'dot-off'}">${m.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-macro="${m.id}">${icon('edit')}</button>
          <button class="btn btn-xs btn-danger-outline" data-excluir-macro="${m.id}" data-label="${escapeHtml(m.nome)}">${icon('delete')}</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="empty-cell">Nenhuma macrocélula cadastrada.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Célula</div>
        <h2 class="section-title">Macrocélulas</h2>
        <p class="text-muted">Grupos de supervisão que agrupam células.</p>
      </div>
      <button class="btn btn-primary" data-open-macro-modal type="button">${icon('add')} Nova macrocélula</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Macrocélulas</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Líder</th>
              <th>Descrição</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function buildMacroForm(macro) {
  const membros = (APP.state.data.discipulos || []).filter(d => d.ativo);
  const liderSelecionado = membros.find(d => String(d.id) === String(macro?.lider_membro_id));
  const liderPickerHtml = buildLocalPickerHtml({
    id:           'mc_lider',
    label:        'Discípulo líder <span class="field-optional">(opcional)</span>',
    selectedId:   macro?.lider_membro_id || null,
    selectedText: macro?.lider_nome || (liderSelecionado?.nome || ''),
  });

  return `
    <div class="form-grid">
      <label class="field-label">Código <span class="field-optional">(opcional)</span>
        <input id="mc_codigo" class="form-ctrl" type="text" maxlength="20"
          placeholder="ex: MAC-01" value="${escapeHtml(macro?.codigo || '')}" />
      </label>
      <label class="field-label" style="grid-column:span 3">Nome *
        <input id="mc_nome" class="form-ctrl" type="text" placeholder="Nome da macrocélula"
          value="${escapeHtml(macro?.nome || '')}" />
      </label>
      <label class="field-label" style="grid-column:span 2">Tipo
        <select id="mc_tipo" class="form-ctrl">
          <option value="">—</option>
          ${TIPOS_MACRO.map(t =>
            `<option value="${t}"${macro?.tipo === t ? ' selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </label>
      <div style="grid-column:span 2">${liderPickerHtml}</div>
      <label class="field-label" style="grid-column:1/-1">Descrição <span class="field-optional">(opcional)</span>
        <textarea id="mc_descricao" class="form-ctrl" rows="3"
          placeholder="Descrição ou observações sobre esta macrocélula">${escapeHtml(macro?.descricao || '')}</textarea>
      </label>
      ${macro ? `<label class="field-label" style="grid-column:1/-1">Status
        <select id="mc_ativo" class="form-ctrl">
          <option value="true"${macro?.ativo ? ' selected' : ''}>Ativo</option>
          <option value="false"${!macro?.ativo ? ' selected' : ''}>Inativo</option>
        </select>
      </label>` : ''}
    </div>`;
}

async function openMacroModal(renderPage, macroId = null) {
  const iid = getIgrejaAtiva();
  let macro = null;

  if (macroId) {
    try { macro = await apiGet(`/api/macrocelulas/${macroId}?igreja_id=${iid}`); } catch { /* ok */ }
  }

  openModal(modalHtml({
    title:    macro ? 'Editar macrocélula' : 'Nova macrocélula',
    subtitle: 'Preencha os dados da macrocélula.',
    wide:     true,
    body:     buildMacroForm(macro),
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveMacroBtn" type="button">${icon('save')} Salvar</button>`
  }));

  const membros = (APP.state.data.discipulos || []).filter(d => d.ativo);
  bindLocalPickerField({
    id:         'mc_lider',
    items:      membros,
    modalTitle: 'Buscar discípulo líder',
    extraCols:  [{ key: 'celula_nome', label: 'Célula' }],
  });

  document.getElementById('saveMacroBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveMacroBtn');
    if (btn?.disabled) return;
    const payload = {
      ...(macro ? { id: macro.id } : {}),
      nome:            document.getElementById('mc_nome').value.trim(),
      codigo:          document.getElementById('mc_codigo').value.trim(),
      descricao:       document.getElementById('mc_descricao').value.trim(),
      tipo:            document.getElementById('mc_tipo').value,
      lider_membro_id: document.getElementById('mc_lider_val')?.value || null,
      ...(macro ? { ativo: document.getElementById('mc_ativo').value === 'true' } : {}),
    };
    if (!payload.nome) return showToast('Informe o nome da macrocélula.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/macrocelulas?igreja_id=${iid}`, payload);
      closeModal();
      await loadMacrocelulas();
      renderPage();
      showToast(`Macrocélula ${macro ? 'atualizada' : 'criada'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar.', 'error');
    }
  });
}

export function bindMacrocelulasPage({ renderPage }) {
  document.querySelector('[data-open-macro-modal]')?.addEventListener('click', () =>
    openMacroModal(renderPage));

  document.querySelectorAll('[data-edit-macro]').forEach(b =>
    b.addEventListener('click', () => openMacroModal(renderPage, Number(b.dataset.editMacro))));

  document.querySelectorAll('[data-excluir-macro]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('macrocélula', b.dataset.label, async () => {
      await apiDelete(`/api/macrocelulas/${b.dataset.excluirMacro}?igreja_id=${getIgrejaAtiva()}`);
      await loadMacrocelulas();
      renderPage();
      showToast('Macrocélula excluída.');
    })));
}

export async function loadMacrocelulas() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/macrocelulas?igreja_id=${iid}`);
    APP.state.data.macrocelulas = data.items || [];
  } catch { /* mantém */ }
}

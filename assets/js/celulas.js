import { APP } from './state.js';
import { icon, escapeHtml, showToast, avatarColor } from './helpers.js';
import { apiGet, apiPost, apiPatch, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const STATUS_CELULA = ['Ativa','Inativa','Plantada','Multiplicada'];

async function buscaCep(cep, campos) {
  const c = cep.replace(/\D/g,'');
  if (c.length !== 8) return;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    const d = await res.json();
    if (d.erro) return;
    if (campos.endereco) campos.endereco.value = d.logradouro || '';
    if (campos.bairro)   campos.bairro.value   = d.bairro     || '';
    if (campos.cidade)   campos.cidade.value   = d.localidade || '';
    if (campos.uf)       campos.uf.value       = d.uf         || '';
  } catch { /* sem internet */ }
}

export function celulasPage() {
  const items = APP.state.data.celulas || [];
  const rows = items.length
    ? items.map(c => `
      <tr>
        <td>${escapeHtml(c.nome || '')}</td>
        <td>${escapeHtml(c.macrocelula_nome || '—')}</td>
        <td>${escapeHtml(c.tipo_celula_nome || '—')}</td>
        <td>${escapeHtml(c.dia_semana || '—')}</td>
        <td>${escapeHtml(c.hora || '—')}</td>
        <td><span class="badge-situacao sit-${(c.status||'Ativa').toLowerCase()}">${escapeHtml(c.status || 'Ativa')}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-celula="${c.id}">${icon('edit')}</button>
          ${c.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-celula="${c.id}" data-label="${escapeHtml(c.nome)}">${icon('block')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="empty-cell">Nenhuma célula cadastrada.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Célula</div>
        <h2 class="section-title">Células</h2>
        <p class="text-muted">Gerencie as células vinculadas à igreja.</p>
      </div>
      <button class="btn btn-primary" data-open-celula-modal type="button">${icon('add')} Nova célula</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Células</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Macrocélula</th><th>Tipo</th><th>Dia</th><th>Hora</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function buildCelulaForm(cel) {
  const macros = APP.state.data.macrocelulas || [];
  const tipos  = APP.state.data.tiposCelula  || [];

  const macroOpts = macros.map(m =>
    `<option value="${m.id}"${String(cel?.macrocelula_id) === String(m.id) ? ' selected' : ''}>${escapeHtml(m.nome)}</option>`
  ).join('');
  const tipoOpts = tipos.map(t =>
    `<option value="${t.id}"${String(cel?.tipo_celula_id) === String(t.id) ? ' selected' : ''}>${escapeHtml(t.nome)}</option>`
  ).join('');

  return `
    <div class="pf-layout">
      <div class="pf-top" style="margin-bottom:4px">
        <div style="flex:1">
          <label class="field-label">Nome da célula *
            <input id="cl_nome" class="form-ctrl" type="text" placeholder="Nome da célula" value="${escapeHtml(cel?.nome || '')}" />
          </label>
        </div>
      </div>

      <div class="pf-section-label">Organização</div>
      <div class="pf-grid">
        <label class="field-label" style="grid-column:span 2">Macrocélula <span class="field-optional">(opcional)</span>
          <select id="cl_macro" class="form-ctrl">
            <option value="">— nenhuma —</option>
            ${macroOpts}
          </select>
        </label>
        <label class="field-label" style="grid-column:span 2">Tipo de célula
          <select id="cl_tipo" class="form-ctrl">
            <option value="">— nenhum —</option>
            ${tipoOpts}
          </select>
        </label>
        <label class="field-label" style="grid-column:span 2">Dia da semana
          <select id="cl_dia" class="form-ctrl">
            <option value="">—</option>
            ${DIAS.map(d => `<option value="${d}"${cel?.dia_semana === d ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Horário
          <input id="cl_hora" class="form-ctrl" type="time" value="${escapeHtml(cel?.hora || '')}" />
        </label>
        <label class="field-label">Status
          <select id="cl_status" class="form-ctrl">
            ${STATUS_CELULA.map(s => `<option value="${s}"${(cel?.status || 'Ativa') === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        ${cel ? `<label class="field-label" style="grid-column:span 4">Ativo
          <select id="cl_ativo" class="form-ctrl">
            <option value="true"${cel?.ativo ? ' selected':''}>Sim</option>
            <option value="false"${!cel?.ativo ? ' selected':''}>Não</option>
          </select>
        </label>` : ''}
      </div>

      <div class="pf-section-label">Endereço</div>
      <div class="pf-grid">
        <label class="field-label">CEP
          <input id="cl_cep" class="form-ctrl" type="text" placeholder="00000-000" value="${escapeHtml(cel?.cep || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 3">Logradouro
          <input id="cl_end" class="form-ctrl" type="text" value="${escapeHtml(cel?.endereco || '')}" />
        </label>
        <label class="field-label">Número
          <input id="cl_num" class="form-ctrl" type="text" value="${escapeHtml(cel?.numero || '')}" />
        </label>
        <label class="field-label">Bairro
          <input id="cl_bairro" class="form-ctrl" type="text" value="${escapeHtml(cel?.bairro || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 2">Cidade
          <input id="cl_cidade" class="form-ctrl" type="text" value="${escapeHtml(cel?.cidade || '')}" />
        </label>
        <label class="field-label">UF
          <input id="cl_uf" class="form-ctrl" type="text" maxlength="2" style="text-transform:uppercase" value="${escapeHtml(cel?.uf || '')}" />
        </label>
        <label class="field-label">Telefone
          <input id="cl_tel" class="form-ctrl" type="tel" value="${escapeHtml(cel?.telefone || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 4">Observações
          <textarea id="cl_obs" class="form-ctrl" rows="2">${escapeHtml(cel?.obs || '')}</textarea>
        </label>
      </div>
    </div>`;
}

async function openCelulaModal(renderPage, celulaId = null) {
  const iid = getIgrejaAtiva();
  let cel = null;
  if (celulaId) {
    try { cel = await apiGet(`/api/celulas/${celulaId}?igreja_id=${iid}`); } catch { /* ok */ }
  }

  openModal(modalHtml({
    title: cel ? 'Editar célula' : 'Nova célula',
    subtitle: 'Preencha os dados da célula.',
    wider: true,
    body: buildCelulaForm(cel),
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveCelulaBtn" type="button">${icon('save')} Salvar</button>`
  }));

  document.getElementById('cl_cep')?.addEventListener('blur', e =>
    buscaCep(e.target.value, {
      endereco: document.getElementById('cl_end'),
      bairro:   document.getElementById('cl_bairro'),
      cidade:   document.getElementById('cl_cidade'),
      uf:       document.getElementById('cl_uf'),
    }));

  document.getElementById('saveCelulaBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveCelulaBtn');
    if (btn?.disabled) return;
    const payload = {
      ...(cel ? { id: cel.id } : {}),
      nome:           document.getElementById('cl_nome').value.trim(),
      macrocelula_id: document.getElementById('cl_macro').value || null,
      tipo_celula_id: document.getElementById('cl_tipo').value || null,
      dia_semana:     document.getElementById('cl_dia').value,
      hora:           document.getElementById('cl_hora').value,
      status:         document.getElementById('cl_status').value,
      cep:            document.getElementById('cl_cep').value.trim(),
      endereco:       document.getElementById('cl_end').value.trim(),
      numero:         document.getElementById('cl_num').value.trim(),
      bairro:         document.getElementById('cl_bairro').value.trim(),
      cidade:         document.getElementById('cl_cidade').value.trim(),
      uf:             document.getElementById('cl_uf').value.trim().toUpperCase(),
      telefone:       document.getElementById('cl_tel').value.trim(),
      obs:            document.getElementById('cl_obs').value.trim(),
      ...(cel ? { ativo: document.getElementById('cl_ativo').value === 'true' } : {}),
    };
    if (!payload.nome) return showToast('Informe o nome da célula.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/celulas?igreja_id=${iid}`, payload);
      closeModal(); await loadCelulas(); renderPage();
      showToast(`Célula ${cel ? 'atualizada' : 'criada'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar.', 'error');
    }
  });
}

export function bindCelulasPage({ renderPage }) {
  document.querySelector('[data-open-celula-modal]')?.addEventListener('click', () => openCelulaModal(renderPage));
  document.querySelectorAll('[data-edit-celula]').forEach(b =>
    b.addEventListener('click', () => openCelulaModal(renderPage, Number(b.dataset.editCelula))));
  document.querySelectorAll('[data-desativar-celula]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('célula', b.dataset.label, async () => {
      await apiPatch(`/api/celulas/${b.dataset.desativarCelula}/desativar?igreja_id=${getIgrejaAtiva()}`);
      await loadCelulas(); renderPage();
      showToast('Célula desativada.');
    })));
}

export async function loadCelulas() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/celulas?igreja_id=${iid}`);
    APP.state.data.celulas = data.items || [];
  } catch { /* mantém */ }
}

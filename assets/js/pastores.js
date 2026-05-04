import { APP } from './state.js';
import { icon, escapeHtml, showToast, avatarColor, buildLocalPickerHtml, bindLocalPickerField } from './helpers.js';
import { apiGet, apiPost, apiPatch, authHeaders, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';

const SEXOS = ['Masculino', 'Feminino'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)'];

async function buscaCep(cep, campos) {
  const c = cep.replace(/\D/g, '');
  if (c.length !== 8) return;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    const d = await res.json();
    if (d.erro) return;
    if (campos.endereco) campos.endereco.value = d.logradouro || '';
    if (campos.bairro)   campos.bairro.value   = d.bairro     || '';
    if (campos.cidade)   campos.cidade.value   = d.localidade || '';
    if (campos.uf)       campos.uf.value       = d.uf         || '';
  } catch { /* sem internet ou CEP inválido */ }
}

export function pastoresPage() {
  const items = APP.state.data.pastores || [];
  const grupos = APP.state.data.gruposPastor || [];

  const rows = items.length
    ? items.map(p => `
      <tr>
        <td>
          ${p.foto_url
            ? `<img src="${escapeHtml(p.foto_url)}" class="table-avatar" alt="" />`
            : `<div class="table-avatar table-avatar-initials" style="background:${avatarColor(p.nome || 'P')}">${(p.nome||'P').slice(0,2).toUpperCase()}</div>`}
        </td>
        <td>${escapeHtml(p.nome || '')}</td>
        <td>${escapeHtml(p.grupo_pastor_nome || '—')}</td>
        <td>${escapeHtml(p.celular || '—')}</td>
        <td>${escapeHtml(p.email || '—')}</td>
        <td>${p.titular ? `<span class="badge-pill" style="background:#1b5e20;color:#fff">Titular</span>` : ''}</td>
        <td><span class="status-dot ${p.ativo ? 'dot-on' : 'dot-off'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-pastor="${p.id}">${icon('edit')}</button>
          ${p.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-pastor="${p.id}" data-label="${escapeHtml(p.nome)}">${icon('block')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="empty-cell">Nenhum pastor cadastrado.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Pastores</div>
        <h2 class="section-title">Pastores</h2>
        <p class="text-muted">Gerencie os pastores vinculados à igreja.</p>
      </div>
      <button class="btn btn-primary" data-open-pastor-modal type="button">${icon('person_add')} Novo pastor</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Pastores</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th></th><th>Nome</th><th>Grupo</th><th>Celular</th><th>E-mail</th><th></th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function buildPastorForm(pastor, grupos) {
  const grupoSelecionado = grupos.find(g => String(g.id) === String(pastor?.grupo_pastor_id));
  const grupoPickerHtml  = buildLocalPickerHtml({
    id:           'pt_grupo',
    label:        'Grupo de pastor <span class="field-optional">(opcional)</span>',
    selectedId:   pastor?.grupo_pastor_id || null,
    selectedText: grupoSelecionado?.nome || '',
  });

  const fotoSrc  = pastor?.foto_url || '';
  const iniciais = (pastor?.nome || 'P').slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(pastor?.nome || 'Pastor');

  return `
    <div class="pf-layout">

      <!-- Topo: foto + nome -->
      <div class="pf-top">
        <div class="pf-foto-wrap">
          <div class="perfil-avatar-wrap" id="pastorFotoWrap">
            ${fotoSrc
              ? `<img id="pastorFotoImg" src="${escapeHtml(fotoSrc)}" class="perfil-avatar-img" alt="foto" />`
              : `<div id="pastorFotoImg" class="perfil-avatar-initials" style="background:${avatarBg}">${iniciais}</div>`}
            <label class="perfil-foto-overlay" title="Alterar foto">
              ${icon('photo_camera')}
              <input id="pastorFotoInput" type="file" accept="image/*" style="display:none" ${!pastor ? 'disabled' : ''} />
            </label>
          </div>
          ${!pastor
            ? `<p class="pf-foto-hint">Salve primeiro<br>para adicionar foto</p>`
            : `<p class="perfil-foto-hint">Clique para alterar</p>`}
        </div>
        <div style="flex:1;min-width:0">
          <label class="field-label">Nome completo *
            <input id="pt_nome" class="form-ctrl" type="text" placeholder="Nome completo" value="${escapeHtml(pastor?.nome || '')}" />
          </label>
        </div>
      </div>

      <!-- Grid 2-col: dados principais -->
      <div class="pf-section-label">Dados</div>
      <div class="pf-grid">
        ${grupoPickerHtml}
        <label class="field-label">Sexo
          <select id="pt_sexo" class="form-ctrl">
            <option value="">—</option>
            ${SEXOS.map(s => `<option value="${s}"${pastor?.sexo === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Estado civil
          <select id="pt_ecivil" class="form-ctrl">
            <option value="">—</option>
            ${ESTADOS_CIVIS.map(e => `<option value="${e}"${pastor?.estado_civil === e ? ' selected' : ''}>${e}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Pastor titular?
          <select id="pt_titular" class="form-ctrl">
            <option value="false"${!pastor?.titular ? ' selected' : ''}>Não</option>
            <option value="true"${pastor?.titular ? ' selected' : ''}>Sim</option>
          </select>
        </label>
        <label class="field-label">Celular
          <input id="pt_celular" class="form-ctrl" type="tel" placeholder="(11) 99999-9999" value="${escapeHtml(pastor?.celular || '')}" />
        </label>
        <label class="field-label">Telefone
          <input id="pt_tel" class="form-ctrl" type="tel" placeholder="(11) 3333-3333" value="${escapeHtml(pastor?.telefone || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 2">E-mail
          <input id="pt_email" class="form-ctrl" type="email" placeholder="pastor@igreja.com" value="${escapeHtml(pastor?.email || '')}" />
        </label>
        <label class="field-label">CPF
          <input id="pt_cpf" class="form-ctrl" type="text" placeholder="000.000.000-00" value="${escapeHtml(pastor?.cpf || '')}" />
        </label>
        <label class="field-label">Data de nascimento
          <input id="pt_nasc" class="form-ctrl" type="date" value="${pastor?.data_nascimento ? pastor.data_nascimento.slice(0,10) : ''}" />
        </label>
        ${pastor ? `<label class="field-label" style="grid-column:span 2">Status
          <select id="pt_ativo" class="form-ctrl">
            <option value="true"${pastor?.ativo ? ' selected' : ''}>Ativo</option>
            <option value="false"${!pastor?.ativo ? ' selected' : ''}>Inativo</option>
          </select>
        </label>` : ''}
      </div>

      <!-- Endereço -->
      <div class="pf-section-label">Endereço</div>
      <div class="pf-grid">
        <label class="field-label">CEP
          <input id="pt_cep" class="form-ctrl" type="text" placeholder="00000-000" value="${escapeHtml(pastor?.cep || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 3">Logradouro
          <input id="pt_end" class="form-ctrl" type="text" placeholder="Rua, Avenida..." value="${escapeHtml(pastor?.endereco || '')}" />
        </label>
        <label class="field-label">Número
          <input id="pt_num" class="form-ctrl" type="text" placeholder="123" value="${escapeHtml(pastor?.numero || '')}" />
        </label>
        <label class="field-label">Bairro
          <input id="pt_bairro" class="form-ctrl" type="text" placeholder="Bairro" value="${escapeHtml(pastor?.bairro || '')}" />
        </label>
        <label class="field-label">Cidade
          <input id="pt_cidade" class="form-ctrl" type="text" placeholder="Cidade" value="${escapeHtml(pastor?.cidade || '')}" />
        </label>
        <label class="field-label">UF
          <input id="pt_uf" class="form-ctrl" type="text" maxlength="2" placeholder="SP" value="${escapeHtml(pastor?.uf || '')}" style="text-transform:uppercase" />
        </label>
      </div>

    </div>`;
}

async function openPastorModal(renderPage, pastorId = null) {
  const iid = getIgrejaAtiva();
  const grupos = (APP.state.data.gruposPastor || []).filter(g => g.ativo);
  let pastor = null;

  if (pastorId) {
    try { pastor = await apiGet(`/api/pastores/${pastorId}?igreja_id=${iid}`); } catch { /* ok */ }
  }

  openModal(modalHtml({
    title: pastor ? 'Editar pastor' : 'Novo pastor',
    subtitle: 'Preencha os dados do pastor.',
    xl: true,
    body: buildPastorForm(pastor, grupos),
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="savePastorBtn" type="button">${icon('save')} Salvar</button>`
  }));

  bindLocalPickerField({
    id: 'pt_grupo',
    items: grupos,
    modalTitle: 'Buscar grupo de pastor',
  });

  // Upload de foto (só ao editar)
  if (pastor) {
    document.getElementById('pastorFotoInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('foto', file);
      try {
        const r = await fetch(`/api/pastores/${pastor.id}/foto?igreja_id=${iid}`, {
          method: 'POST', body: fd, headers: authHeaders({})
        });
        const d = await r.json();
        if (!r.ok) { showToast(d.message || 'Erro ao enviar foto.', 'error'); return; }
        const wrap = document.getElementById('pastorFotoImg');
        if (wrap) {
          const img = document.createElement('img');
          img.src = d.foto_url + '?t=' + Date.now();
          img.className = 'perfil-avatar-img';
          img.id = 'pastorFotoImg';
          wrap.replaceWith(img);
        }
        showToast('Foto atualizada!');
      } catch { showToast('Erro ao enviar foto.', 'error'); }
    });
  }

  // CEP auto-fill
  document.getElementById('pt_cep')?.addEventListener('blur', e =>
    buscaCep(e.target.value, {
      endereco: document.getElementById('pt_end'),
      bairro:   document.getElementById('pt_bairro'),
      cidade:   document.getElementById('pt_cidade'),
      uf:       document.getElementById('pt_uf'),
    }));

  document.getElementById('savePastorBtn').addEventListener('click', async () => {
    const btn = document.getElementById('savePastorBtn');
    if (btn?.disabled) return;
    const payload = {
      ...(pastor ? { id: pastor.id } : {}),
      nome:            document.getElementById('pt_nome').value.trim(),
      grupo_pastor_id: document.getElementById('pt_grupo_val')?.value || null,
      sexo:            document.getElementById('pt_sexo').value,
      estado_civil:    document.getElementById('pt_ecivil').value,
      celular:         document.getElementById('pt_celular').value.trim(),
      telefone:        document.getElementById('pt_tel').value.trim(),
      email:           document.getElementById('pt_email').value.trim(),
      cpf:             document.getElementById('pt_cpf').value.trim(),
      data_nascimento: document.getElementById('pt_nasc').value || null,
      titular:         document.getElementById('pt_titular').value === 'true',
      cep:             document.getElementById('pt_cep').value.trim(),
      endereco:        document.getElementById('pt_end').value.trim(),
      numero:          document.getElementById('pt_num').value.trim(),
      bairro:          document.getElementById('pt_bairro').value.trim(),
      cidade:          document.getElementById('pt_cidade').value.trim(),
      uf:              document.getElementById('pt_uf').value.trim().toUpperCase(),
      ...(pastor ? { ativo: document.getElementById('pt_ativo').value === 'true' } : {})
    };
    if (!payload.nome) return showToast('Informe o nome do pastor.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/pastores?igreja_id=${iid}`, payload);
      closeModal();
      await loadPastores();
      renderPage();
      showToast(`Pastor ${pastor ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar pastor.', 'error');
    }
  });
}

export function bindPastoresPage({ renderPage }) {
  document.querySelector('[data-open-pastor-modal]')?.addEventListener('click', () => openPastorModal(renderPage));

  document.querySelectorAll('[data-edit-pastor]').forEach(b =>
    b.addEventListener('click', () => openPastorModal(renderPage, Number(b.dataset.editPastor))));

  document.querySelectorAll('[data-desativar-pastor]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('pastor', b.dataset.label, async () => {
      const iid = getIgrejaAtiva();
      await apiPatch(`/api/pastores/${b.dataset.desativarPastor}/desativar?igreja_id=${iid}`);
      await loadPastores();
      renderPage();
      showToast('Pastor desativado.');
    })));
}

export async function loadPastores() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/pastores?igreja_id=${iid}`);
    APP.state.data.pastores = data.items || [];
  } catch { /* mantém state existente em caso de erro */ }
}

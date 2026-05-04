import { APP } from './state.js';
import { icon, escapeHtml, showToast, avatarColor, buildLocalPickerHtml, bindLocalPickerField } from './helpers.js';
import { apiGet, apiPost, apiPatch, authHeaders, getIgrejaAtiva } from './api.js';
import { openModal, closeModal, modalHtml, confirmDelete } from './modal.js';
import { buildCelulaPickerHtml, bindCelulaPickerField } from './celula_picker.js';

const SEXOS = ['Masculino', 'Feminino'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'Separado(a)'];
const INSTRUCOES = ['Analfabeto', 'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'];
const SITUACOES = ['Ativo', 'Inativo', 'Visitante', 'Afastado', 'Transferido'];

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

export function discipulosPage() {
  const items = APP.state.data.discipulos || [];

  const rows = items.length
    ? items.map(d => `
      <tr>
        <td>
          ${d.foto_url
            ? `<img src="${escapeHtml(d.foto_url)}" class="table-avatar" alt="" />`
            : `<div class="table-avatar table-avatar-initials" style="background:${avatarColor(d.nome || 'D')}">${(d.nome||'D').slice(0,2).toUpperCase()}</div>`}
        </td>
        <td>${escapeHtml(d.nome || '')}</td>
        <td>${escapeHtml(d.celular || '—')}</td>
        <td>${escapeHtml(d.ministerio_nome || '—')}</td>
        <td>${escapeHtml(d.celula_nome || '—')}</td>
        <td><span class="badge-situacao sit-${(d.situacao_celular || 'Ativo').toLowerCase()}">${escapeHtml(d.situacao_celular || 'Ativo')}</span></td>
        <td><span class="status-dot ${d.ativo ? 'dot-on' : 'dot-off'}">${d.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="table-actions">
          <button class="btn btn-xs btn-outline" data-edit-disc="${d.id}">${icon('edit')}</button>
          ${d.ativo ? `<button class="btn btn-xs btn-danger-outline" data-desativar-disc="${d.id}" data-label="${escapeHtml(d.nome)}">${icon('block')}</button>` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="empty-cell">Nenhum discípulo cadastrado.</td></tr>`;

  return `
  <div class="page-fade">
    <div class="card admin-header">
      <div>
        <div class="section-badge">Discípulos</div>
        <h2 class="section-title">Discípulos</h2>
        <p class="text-muted">Gerencie os discípulos vinculados à igreja.</p>
      </div>
      <button class="btn btn-primary" data-open-disc-modal type="button">${icon('person_add')} Novo discípulo</button>
    </div>
    <div class="card table-card">
      <div class="table-toolbar">
        <h3 class="table-title">Discípulos</h3>
        <span class="table-count">${items.length} registro${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th></th><th>Nome</th><th>Celular</th><th>Ministério</th><th>Célula</th><th>Situação</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  </div>`;
}


// ── Formulário completo do discípulo ─────────────────────────────────────────

function buildDiscipuloForm(disc, ministerios) {
  const minSelecionado = ministerios.find(m => String(m.id) === String(disc?.ministerio_id));
  const minPickerHtml  = buildLocalPickerHtml({
    id:           'dc_min',
    label:        'Ministério <span class="field-optional">(opcional)</span>',
    selectedId:   disc?.ministerio_id || null,
    selectedText: minSelecionado?.nome || '',
  });

  const checked = v => v ? 'checked' : '';
  const fotoSrc = disc?.foto_url || '';
  const iniciais = (disc?.nome || 'D').slice(0, 2).toUpperCase();
  const avatarBg = avatarColor(disc?.nome || 'Discipulo');

  return `
    <div class="pf-layout">

      <!-- Topo: foto + nome + linha principal -->
      <div class="pf-top">
        <div class="pf-foto-wrap">
          <div class="perfil-avatar-wrap" id="discFotoWrap">
            ${fotoSrc
              ? `<img id="discFotoImg" src="${escapeHtml(fotoSrc)}" class="perfil-avatar-img" alt="foto" />`
              : `<div id="discFotoImg" class="perfil-avatar-initials" style="background:${avatarBg}">${iniciais}</div>`}
            <label class="perfil-foto-overlay" title="Alterar foto">
              ${icon('photo_camera')}
              <input id="discFotoInput" type="file" accept="image/*" style="display:none" ${!disc ? 'disabled' : ''} />
            </label>
          </div>
          ${!disc ? `<p class="pf-foto-hint">Salve primeiro<br>para adicionar foto</p>` : `<p class="perfil-foto-hint">Clique para alterar</p>`}
        </div>
        <div style="flex:1;min-width:0">
          <label class="field-label">Nome completo *
            <input id="dc_nome" class="form-ctrl" type="text" placeholder="Nome completo" value="${escapeHtml(disc?.nome || '')}" />
          </label>
        </div>
      </div>

      <!-- Grid principal 4 colunas -->
      <div class="pf-section-label">Identificação</div>
      <div class="pf-grid">
        <label class="field-label">Situação
          <select id="dc_sit" class="form-ctrl">
            ${SITUACOES.map(s => `<option value="${s}"${(disc?.situacao_celular || 'Ativo') === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        ${minPickerHtml}
        <label class="field-label">Sexo
          <select id="dc_sexo" class="form-ctrl">
            <option value="">—</option>
            ${SEXOS.map(s => `<option value="${s}"${disc?.sexo === s ? ' selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">Estado civil
          <select id="dc_ecivil" class="form-ctrl">
            <option value="">—</option>
            ${ESTADOS_CIVIS.map(e => `<option value="${e}"${disc?.estado_civil === e ? ' selected' : ''}>${e}</option>`).join('')}
          </select>
        </label>

        <label class="field-label">Celular
          <input id="dc_celular" class="form-ctrl" type="tel" placeholder="(11) 99999-9999" value="${escapeHtml(disc?.celular || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 2">E-mail
          <input id="dc_email" class="form-ctrl" type="email" placeholder="email@email.com" value="${escapeHtml(disc?.email || '')}" />
        </label>
        <label class="field-label">Nascimento
          <input id="dc_nasc" class="form-ctrl" type="date" value="${disc?.data_nascimento ? disc.data_nascimento.slice(0,10) : ''}" />
        </label>

        <label class="field-label" style="grid-column:span 2">Instrução
          <select id="dc_instrucao" class="form-ctrl">
            <option value="">—</option>
            ${INSTRUCOES.map(i => `<option value="${i}"${disc?.instrucao === i ? ' selected' : ''}>${i}</option>`).join('')}
          </select>
        </label>
        <label class="field-label">CPF
          <input id="dc_cpf" class="form-ctrl" type="text" placeholder="000.000.000-00" value="${escapeHtml(disc?.cpf || '')}" />
        </label>
        <label class="field-label">Identidade (RG)
          <input id="dc_ident" class="form-ctrl" type="text" placeholder="00.000.000-0" value="${escapeHtml(disc?.identidade || '')}" />
        </label>

        <div style="grid-column:1/-1">
          <span class="disc-checks-label">Informações</span>
          <div class="disc-checks">
            <label class="check-label"><input id="dc_batizado"   type="checkbox" ${checked(disc?.batizado)}> Batizado</label>
            <label class="check-label"><input id="dc_dizimista"  type="checkbox" ${checked(disc?.dizimista)}> Dizimista</label>
            <label class="check-label"><input id="dc_carteira"   type="checkbox" ${checked(disc?.carteira_emitida)}> Carteira emitida</label>
            <label class="check-label"><input id="dc_libertacao" type="checkbox" ${checked(disc?.libertacao)}> Libertação</label>
            <label class="check-label"><input id="dc_encontro"   type="checkbox" ${checked(disc?.encontro)}> Encontro</label>
          </div>
        </div>

        ${disc ? `<label class="field-label" style="grid-column:span 2">Status
          <select id="dc_ativo" class="form-ctrl">
            <option value="true"${disc?.ativo ? ' selected' : ''}>Ativo</option>
            <option value="false"${!disc?.ativo ? ' selected' : ''}>Inativo</option>
          </select>
        </label>` : ''}
      </div>

      <!-- Célula -->
      <div class="pf-section-label">Célula <span class="field-optional">(opcional — pode ser atribuída depois)</span></div>
      <div class="pf-grid">
        ${buildCelulaPickerHtml({
          prefix:    'dc',
          celulaId:  disc?.celula_id   || null,
          celulaNome: disc?._celula_nome || '',
          liderNome:  disc?._lider_nome  || '',
          macroNome:  disc?._macro_nome  || '',
          spanFull:  true,
        })}
      </div>

      <!-- Endereço -->
      <div class="pf-section-label">Endereço</div>
      <div class="pf-grid">
        <label class="field-label">CEP
          <input id="dc_cep" class="form-ctrl" type="text" placeholder="00000-000" value="${escapeHtml(disc?.cep || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 3">Logradouro
          <input id="dc_end" class="form-ctrl" type="text" value="${escapeHtml(disc?.endereco || '')}" />
        </label>
        <label class="field-label">Número
          <input id="dc_num" class="form-ctrl" type="text" value="${escapeHtml(disc?.numero || '')}" />
        </label>
        <label class="field-label">Bairro
          <input id="dc_bairro" class="form-ctrl" type="text" value="${escapeHtml(disc?.bairro || '')}" />
        </label>
        <label class="field-label">Cidade
          <input id="dc_cidade" class="form-ctrl" type="text" value="${escapeHtml(disc?.cidade || '')}" />
        </label>
        <label class="field-label">UF
          <input id="dc_uf" class="form-ctrl" type="text" maxlength="2" style="text-transform:uppercase" value="${escapeHtml(disc?.uf || '')}" />
        </label>
        <label class="field-label" style="grid-column:span 4">Observações
          <textarea id="dc_obs" class="form-ctrl" rows="2">${escapeHtml(disc?.obs || '')}</textarea>
        </label>
      </div>

    </div>`;
}

// ── Open modal ────────────────────────────────────────────────────────────────

async function openDiscipuloModal(renderPage, discId = null) {
  const iid = getIgrejaAtiva();
  const ministerios = (APP.state.data.ministerios || []).filter(m => m.ativo);
  let disc = null;

  if (discId) {
    try {
      disc = await apiGet(`/api/discipulos/${discId}?igreja_id=${iid}`);
      // Busca nomes relacionados para pré-preencher
      if (disc?.celula_id) {
        try {
          const cel = await apiGet(`/api/celulas/busca?igreja_id=${iid}&q=${disc.celula_id}`);
          const found = (cel.items || []).find(c => String(c.id) === String(disc.celula_id));
          if (found) {
            disc._celula_nome = found.nome;
            disc._lider_nome  = found.lider_nome;
            disc._macro_nome  = found.macrocelula_nome;
          }
        } catch { /* ok */ }
      }
    } catch { /* ok */ }
  }

  openModal(modalHtml({
    title: disc ? 'Editar discípulo' : 'Novo discípulo',
    subtitle: 'Preencha os dados do discípulo.',
    xl: true,
    body: buildDiscipuloForm(disc, ministerios),
    actions: `
      <button class="btn btn-outline" data-modal-close type="button">Cancelar</button>
      <button class="btn btn-primary" id="saveDiscBtn" type="button">${icon('save')} Salvar</button>`
  }));

  bindCelulaPickerField('dc');

  bindLocalPickerField({
    id: 'dc_min',
    items: ministerios,
    modalTitle: 'Buscar ministério',
  });

  // CEP auto-fill
  document.getElementById('dc_cep')?.addEventListener('blur', e =>
    buscaCep(e.target.value, {
      endereco: document.getElementById('dc_end'),
      bairro:   document.getElementById('dc_bairro'),
      cidade:   document.getElementById('dc_cidade'),
      uf:       document.getElementById('dc_uf'),
    }));

  // Upload de foto (só disponível ao editar)
  if (disc) {
    document.getElementById('discFotoInput')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('foto', file);
      try {
        const r = await fetch(`/api/discipulos/${disc.id}/foto?igreja_id=${iid}`, {
          method: 'POST', body: fd, headers: authHeaders({})
        });
        const d = await r.json();
        if (!r.ok) { showToast(d.message || 'Erro ao enviar foto.', 'error'); return; }
        const wrap = document.getElementById('discFotoImg');
        if (wrap) {
          const img = document.createElement('img');
          img.src = d.foto_url + '?t=' + Date.now();
          img.className = 'perfil-avatar-img';
          img.id = 'discFotoImg';
          wrap.replaceWith(img);
        }
        showToast('Foto atualizada!');
      } catch { showToast('Erro ao enviar foto.', 'error'); }
    });
  }

  // Salvar
  document.getElementById('saveDiscBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveDiscBtn');
    if (btn?.disabled) return;
    const payload = {
      ...(disc ? { id: disc.id } : {}),
      nome:             document.getElementById('dc_nome').value.trim(),
      situacao_celular: document.getElementById('dc_sit').value,
      ministerio_id:    document.getElementById('dc_min_val')?.value || null,
      sexo:             document.getElementById('dc_sexo').value,
      celular:          document.getElementById('dc_celular').value.trim(),
      email:            document.getElementById('dc_email').value.trim(),
      data_nascimento:  document.getElementById('dc_nasc').value || null,
      estado_civil:     document.getElementById('dc_ecivil').value,
      instrucao:        document.getElementById('dc_instrucao').value,
      cpf:              document.getElementById('dc_cpf').value.trim(),
      identidade:       document.getElementById('dc_ident').value.trim(),
      batizado:         document.getElementById('dc_batizado').checked,
      dizimista:        document.getElementById('dc_dizimista').checked,
      carteira_emitida: document.getElementById('dc_carteira').checked,
      libertacao:       document.getElementById('dc_libertacao').checked,
      encontro:         document.getElementById('dc_encontro').checked,
      celula_id:        document.getElementById('dc_celula_id')?.value || null,
      cep:              document.getElementById('dc_cep').value.trim(),
      endereco:         document.getElementById('dc_end').value.trim(),
      numero:           document.getElementById('dc_num').value.trim(),
      bairro:           document.getElementById('dc_bairro').value.trim(),
      cidade:           document.getElementById('dc_cidade').value.trim(),
      uf:               document.getElementById('dc_uf').value.trim().toUpperCase(),
      obs:              document.getElementById('dc_obs').value.trim(),
      ...(disc ? { ativo: document.getElementById('dc_ativo').value === 'true' } : {})
    };
    if (!payload.nome) return showToast('Informe o nome do discípulo.', 'error');
    if (btn) btn.disabled = true;
    try {
      await apiPost(`/api/discipulos?igreja_id=${iid}`, payload);
      closeModal();
      await loadDiscipulos();
      renderPage();
      showToast(`Discípulo ${disc ? 'atualizado' : 'criado'} com sucesso.`);
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao salvar discípulo.', 'error');
    }
  });
}

// ── Bind ──────────────────────────────────────────────────────────────────────

export function bindDiscipulosPage({ renderPage }) {
  document.querySelector('[data-open-disc-modal]')?.addEventListener('click', () => openDiscipuloModal(renderPage));

  document.querySelectorAll('[data-edit-disc]').forEach(b =>
    b.addEventListener('click', () => openDiscipuloModal(renderPage, Number(b.dataset.editDisc))));

  document.querySelectorAll('[data-desativar-disc]').forEach(b =>
    b.addEventListener('click', () => confirmDelete('discípulo', b.dataset.label, async () => {
      const iid = getIgrejaAtiva();
      await apiPatch(`/api/discipulos/${b.dataset.desativarDisc}/desativar?igreja_id=${iid}`);
      await loadDiscipulos();
      renderPage();
      showToast('Discípulo desativado.');
    })));
}

export async function loadDiscipulos() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/discipulos?igreja_id=${iid}`);
    APP.state.data.discipulos = data.items || [];
  } catch { /* mantém state existente em caso de erro */ }
}

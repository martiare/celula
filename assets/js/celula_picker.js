/**
 * Módulo reutilizável de seleção de célula:
 *  - campo de exibição com botão lupa (busca) e botão + (nova célula)
 *  - modal de busca com filtro em tempo real
 *  - modal de criação rápida de célula (camada sobreposta)
 */

import { APP } from './state.js';
import { icon, escapeHtml, showToast } from './helpers.js';
import { apiGet, apiPost, getIgrejaAtiva } from './api.js';

// ── HTML do campo picker ─────────────────────────────────────────────────────

/**
 * Gera o HTML do campo seletor de célula.
 * @param {object} opts
 *   prefix   - prefixo de IDs (ex: 'dc' para discípulo, 'ps' para pastor)
 *   celulaId - ID da célula já selecionada (ou null)
 *   celulaNome - nome exibido (ou '')
 *   liderNome  - nome do líder (ou '')
 *   macroNome  - nome da macro (ou '')
 *   spanFull   - se deve ocupar grid-column:span 4 (default true)
 */
export function buildCelulaPickerHtml({ prefix, celulaId, celulaNome, liderNome, macroNome, spanFull = true }) {
  const display = celulaNome || '';
  const hasCell = !!celulaId;

  return `
    <input id="${prefix}_celula_id"    type="hidden" value="${escapeHtml(String(celulaId || ''))}"/>
    <input id="${prefix}_celula_nome_h" type="hidden" value="${escapeHtml(display)}"/>
    <input id="${prefix}_lider_h"      type="hidden" value="${escapeHtml(liderNome || '')}"/>
    <input id="${prefix}_macro_h"      type="hidden" value="${escapeHtml(macroNome || '')}"/>

    <div class="field-label" style="${spanFull ? 'grid-column:span 4' : ''}">Célula
      <div class="celula-picker-row">
        <div class="celula-picker-display" id="${prefix}_celula_display">
          <span class="material-symbols-outlined" style="color:var(--muted);font-size:16px">church</span>
          <span class="celula-picker-label" id="${prefix}_celula_label">${escapeHtml(display) || '<span class="celula-picker-empty">Nenhuma célula selecionada</span>'}</span>
          <button class="celula-picker-clear" id="${prefix}_celula_clear" type="button"
                  title="Remover" style="${hasCell ? '' : 'display:none'}">
            ${icon('close')}
          </button>
        </div>
        <button class="btn btn-outline celula-picker-btn" id="${prefix}_celula_search_btn"
                type="button" title="Buscar célula">
          ${icon('search')}
        </button>
        <button class="btn btn-primary celula-picker-btn" id="${prefix}_celula_add_btn"
                type="button" title="Nova célula">
          ${icon('add')}
        </button>
      </div>
    </div>

    <label class="field-label" style="grid-column:span 2">Líder da célula
      <input id="${prefix}_lider_ro" class="form-ctrl celula-picker-ro" type="text" readonly
             placeholder="Auto-preenchido" value="${escapeHtml(liderNome || '')}" />
    </label>
    <label class="field-label" style="grid-column:span 2">Macrocélula
      <input id="${prefix}_macro_ro" class="form-ctrl celula-picker-ro" type="text" readonly
             placeholder="Auto-preenchido" value="${escapeHtml(macroNome || '')}" />
    </label>`;
}

// ── Atualiza campos após seleção ─────────────────────────────────────────────

function applyCelulaSelection(prefix, cel) {
  document.getElementById(`${prefix}_celula_id`).value    = cel ? String(cel.id) : '';
  document.getElementById(`${prefix}_celula_nome_h`).value = cel ? cel.nome : '';
  document.getElementById(`${prefix}_lider_h`).value      = cel ? (cel.lider_nome || '') : '';
  document.getElementById(`${prefix}_macro_h`).value      = cel ? (cel.macrocelula_nome || '') : '';

  const labelEl = document.getElementById(`${prefix}_celula_label`);
  if (labelEl) labelEl.innerHTML = cel
    ? escapeHtml(cel.nome)
    : '<span class="celula-picker-empty">Nenhuma célula selecionada</span>';

  const clearBtn = document.getElementById(`${prefix}_celula_clear`);
  if (clearBtn) clearBtn.style.display = cel ? '' : 'none';

  const liderEl = document.getElementById(`${prefix}_lider_ro`);
  if (liderEl) liderEl.value = cel ? (cel.lider_nome || '') : '';
  const macroEl = document.getElementById(`${prefix}_macro_ro`);
  if (macroEl) macroEl.value = cel ? (cel.macrocelula_nome || '') : '';
}

// ── Modal de busca de célula ─────────────────────────────────────────────────

function openCelulaSearchModal(prefix, iid) {
  const overlayId = 'celPickerOverlay';
  document.getElementById(overlayId)?.remove();

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.className = 'cel-picker-overlay';
  overlay.innerHTML = `
    <div class="cel-picker-dialog">
      <div class="cel-picker-header">
        <span class="cel-picker-title">${icon('search')} Buscar célula</span>
        <button class="cel-picker-close" id="celPickerClose" type="button">${icon('close')}</button>
      </div>
      <div class="cel-picker-body">
        <input id="celPickerInput" class="form-ctrl" type="text"
               placeholder="Digite o nome ou código da célula..." autocomplete="off" />
        <div id="celPickerResults" class="cel-picker-results">
          <div class="cel-picker-hint">Digite para buscar células...</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = document.getElementById('celPickerInput');
  const results = document.getElementById('celPickerResults');

  document.getElementById('celPickerClose').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  let debounce = null;

  async function doSearch(q) {
    try {
      const data = await apiGet(`/api/celulas/busca?igreja_id=${iid}&q=${encodeURIComponent(q)}`);
      const items = data.items || [];
      if (!items.length) {
        results.innerHTML = '<div class="cel-picker-hint">Nenhuma célula encontrada.</div>';
        return;
      }
      results.innerHTML = `
        <table class="cel-picker-table">
          <thead><tr><th>#</th><th>Nome</th><th>Macrocélula</th><th>Dia/Hora</th></tr></thead>
          <tbody>
            ${items.map(c => `
              <tr class="cel-picker-row" data-id="${c.id}"
                  data-nome="${escapeHtml(c.nome)}"
                  data-lider="${escapeHtml(c.lider_nome || '')}"
                  data-macro="${escapeHtml(c.macrocelula_nome || '')}">
                <td class="cel-picker-code">${c.id}</td>
                <td>${escapeHtml(c.nome)}</td>
                <td>${escapeHtml(c.macrocelula_nome || '—')}</td>
                <td>${escapeHtml(c.dia_semana || '')}${c.hora ? ' ' + c.hora : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      results.querySelectorAll('.cel-picker-row').forEach(row => {
        row.addEventListener('click', () => {
          applyCelulaSelection(prefix, {
            id: row.dataset.id,
            nome: row.dataset.nome,
            lider_nome: row.dataset.lider,
            macrocelula_nome: row.dataset.macro,
          });
          overlay.remove();
        });
      });
    } catch {
      results.innerHTML = '<div class="cel-picker-hint">Erro ao buscar células.</div>';
    }
  }

  // Carrega todas as células ao abrir
  doSearch('');

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doSearch(input.value.trim()), 250);
  });

  setTimeout(() => input.focus(), 80);
}

// ── Modal de criação rápida de célula ────────────────────────────────────────

async function openCelulaCreateModal(prefix, iid) {
  const macros = APP.state.data.macrocelulas || [];
  const tipos  = APP.state.data.tiposCelula  || [];
  const DIAS   = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

  const overlayId = 'celCreateOverlay';
  document.getElementById(overlayId)?.remove();

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.className = 'cel-picker-overlay';
  overlay.innerHTML = `
    <div class="cel-picker-dialog" style="max-width:560px">
      <div class="cel-picker-header">
        <span class="cel-picker-title">${icon('add')} Nova célula</span>
        <button class="cel-picker-close" id="celCreateClose" type="button">${icon('close')}</button>
      </div>
      <div class="cel-picker-body">
        <div class="pf-grid" style="padding:4px 0">
          <label class="field-label" style="grid-column:span 4">Nome da célula *
            <input id="cc_nome" class="form-ctrl" type="text" placeholder="Nome da célula" />
          </label>
          <label class="field-label" style="grid-column:span 2">Macrocélula
            <select id="cc_macro" class="form-ctrl">
              <option value="">— nenhuma —</option>
              ${macros.map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('')}
            </select>
          </label>
          <label class="field-label" style="grid-column:span 2">Tipo de célula
            <select id="cc_tipo" class="form-ctrl">
              <option value="">— nenhum —</option>
              ${tipos.map(t => `<option value="${t.id}">${escapeHtml(t.nome)}</option>`).join('')}
            </select>
          </label>
          <label class="field-label" style="grid-column:span 2">Dia da semana
            <select id="cc_dia" class="form-ctrl">
              <option value="">—</option>
              ${DIAS.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
          </label>
          <label class="field-label" style="grid-column:span 2">Horário
            <input id="cc_hora" class="form-ctrl" type="time" />
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-outline" id="celCreateCancel" type="button">Cancelar</button>
          <button class="btn btn-primary" id="celCreateSave" type="button">${icon('save')} Salvar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('celCreateClose').onclick  = () => overlay.remove();
  document.getElementById('celCreateCancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('celCreateSave').addEventListener('click', async () => {
    const btn  = document.getElementById('celCreateSave');
    const nome = document.getElementById('cc_nome').value.trim();
    if (!nome) return showToast('Informe o nome da célula.', 'error');
    if (btn) btn.disabled = true;
    try {
      const payload = {
        nome,
        macrocelula_id: document.getElementById('cc_macro').value || null,
        tipo_celula_id: document.getElementById('cc_tipo').value || null,
        dia_semana:     document.getElementById('cc_dia').value,
        hora:           document.getElementById('cc_hora').value,
        status:         'Ativa',
      };
      const created = await apiPost(`/api/celulas?igreja_id=${iid}`, payload);
      // Recarrega lista de células no state
      try {
        const d = await apiGet(`/api/celulas?igreja_id=${iid}`);
        APP.state.data.celulas = d.items || [];
      } catch { /* ok */ }
      applyCelulaSelection(prefix, {
        id: created.id,
        nome: created.nome || nome,
        lider_nome: '',
        macrocelula_nome: macros.find(m => String(m.id) === String(payload.macrocelula_id))?.nome || '',
      });
      overlay.remove();
      showToast('Célula criada e selecionada.');
    } catch (err) {
      if (btn) btn.disabled = false;
      showToast(err.message || 'Erro ao criar célula.', 'error');
    }
  });

  setTimeout(() => document.getElementById('cc_nome')?.focus(), 80);
}

// ── Bind dos botões do picker ────────────────────────────────────────────────

export function bindCelulaPickerField(prefix) {
  const iid = getIgrejaAtiva();

  document.getElementById(`${prefix}_celula_search_btn`)?.addEventListener('click', () => {
    openCelulaSearchModal(prefix, iid);
  });

  document.getElementById(`${prefix}_celula_add_btn`)?.addEventListener('click', () => {
    openCelulaCreateModal(prefix, iid);
  });

  document.getElementById(`${prefix}_celula_clear`)?.addEventListener('click', () => {
    applyCelulaSelection(prefix, null);
  });
}

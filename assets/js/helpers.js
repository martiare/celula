export function icon(name) {
  return `<span class="material-symbols-outlined app-icon">${name}</span>`;
}

export function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatWaitTime(ts) {
  if (!ts) return null;
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${Math.floor(sec / 86400)}d`;
}

export function waitClass(ts) {
  if (!ts) return 'wait-ok';
  const min = (Date.now() - new Date(ts).getTime()) / 60000;
  if (min > 30) return 'wait-danger';
  if (min > 5) return 'wait-warn';
  return 'wait-ok';
}

export function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
}

export function statusBadgeClass(status) {
  const map = {
    'aberta': 'status-aberto', 'aberto': 'status-aberto',
    'em_atendimento': 'status-em-andamento', 'em andamento': 'status-em-andamento',
    'pendente': 'status-pendente', 'encerrada': 'status-encerrada'
  };
  return map[(status || '').toLowerCase()] || '';
}

export function statusLabel(status) {
  const map = {
    'aberta': 'Aberta', 'em_atendimento': 'Em atendimento',
    'pendente': 'Pendente', 'encerrada': 'Encerrada'
  };
  return map[(status || '').toLowerCase()] || status || '';
}

export const AVATAR_COLORS = [
  '#1a73e8','#e52592','#0f9d58','#f29900','#9334e6',
  '#ee675c','#00796b','#c2185b','#0097a7','#689f38'
];

export function avatarColor(nome) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarSvg(nome) {
  const initials = nome.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const color = avatarColor(nome);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="26" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function mediaSrc(m) {
  if (m.media_url && m.media_url.startsWith('__meta_media__')) {
    return `/api/crm/media/${m.id}`;
  }
  return m.media_url || '';
}

export function showToast(msg, type = 'success') {
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'appToast';
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-show'), 10);
  setTimeout(() => { el.classList.remove('toast-show'); setTimeout(() => el.remove(), 300); }, 3200);
}

// ── Generic local picker (lupa) ───────────────────────────────────────────────

export function buildLocalPickerHtml({ id, label, selectedId, selectedText, spanStyle = '' }) {
  const hasVal = !!selectedId;
  const displayText = selectedText || '';
  return `
    <input type="hidden" id="${id}_val" value="${escapeHtml(String(selectedId || ''))}"/>
    <div class="field-label"${spanStyle ? ` style="${spanStyle}"` : ''}>
      ${label}
      <div class="celula-picker-row">
        <div class="celula-picker-display" id="${id}_display">
          ${icon('label')}
          <span class="celula-picker-label" id="${id}_label">${displayText ? escapeHtml(displayText) : '<span class="celula-picker-empty">Nenhum selecionado</span>'}</span>
          <button class="celula-picker-clear" id="${id}_clear" type="button" title="Remover" style="${hasVal ? '' : 'display:none'}">${icon('close')}</button>
        </div>
        <button class="btn btn-outline celula-picker-btn" id="${id}_btn" type="button" title="Buscar">${icon('search')}</button>
      </div>
    </div>`;
}

export function bindLocalPickerField({ id, items, idKey = 'id', labelKey = 'nome', modalTitle, extraCols = [] }) {
  document.getElementById(`${id}_btn`)?.addEventListener('click', () =>
    _openLocalSearchModal({ id, items, idKey, labelKey, modalTitle, extraCols }));
  document.getElementById(`${id}_clear`)?.addEventListener('click', () => {
    const valEl   = document.getElementById(`${id}_val`);
    const labelEl = document.getElementById(`${id}_label`);
    const clearEl = document.getElementById(`${id}_clear`);
    if (valEl)   valEl.value = '';
    if (labelEl) labelEl.innerHTML = '<span class="celula-picker-empty">Nenhum selecionado</span>';
    if (clearEl) clearEl.style.display = 'none';
  });
}

function _openLocalSearchModal({ id, items, idKey, labelKey, modalTitle, extraCols }) {
  const overlayId = `localPicker_${id}`;
  document.getElementById(overlayId)?.remove();

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.className = 'cel-picker-overlay';

  const extraHeaders = extraCols.map(c => `<th>${escapeHtml(c.header)}</th>`).join('');
  overlay.innerHTML = `
    <div class="cel-picker-dialog">
      <div class="cel-picker-header">
        <span class="cel-picker-title">${icon('search')} ${escapeHtml(modalTitle || 'Buscar')}</span>
        <button class="cel-picker-close" id="${overlayId}_close" type="button">${icon('close')}</button>
      </div>
      <div class="cel-picker-body">
        <input id="${overlayId}_input" class="form-ctrl" type="text" placeholder="Digite para filtrar..." autocomplete="off"/>
        <div id="${overlayId}_results" class="cel-picker-results"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = document.getElementById(`${overlayId}_input`);
  const results = document.getElementById(`${overlayId}_results`);

  document.getElementById(`${overlayId}_close`).onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  function render(q) {
    const filtered = q
      ? items.filter(i => String(i[labelKey] || '').toLowerCase().includes(q.toLowerCase()))
      : items;
    if (!filtered.length) {
      results.innerHTML = '<div class="cel-picker-hint">Nenhum resultado encontrado.</div>';
      return;
    }
    results.innerHTML = `
      <table class="cel-picker-table">
        <thead><tr><th>#</th><th>Nome</th>${extraHeaders}</tr></thead>
        <tbody>
          ${filtered.map(item => `
            <tr class="cel-picker-row"
                data-id="${escapeHtml(String(item[idKey]))}"
                data-label="${escapeHtml(String(item[labelKey] || ''))}">
              <td class="cel-picker-code">${item[idKey]}</td>
              <td>${escapeHtml(String(item[labelKey] || ''))}</td>
              ${extraCols.map(c => `<td>${escapeHtml(String(item[c.key] || '—'))}</td>`).join('')}
            </tr>`).join('')}
        </tbody>
      </table>`;
    results.querySelectorAll('.cel-picker-row').forEach(row => {
      row.addEventListener('click', () => {
        const valEl   = document.getElementById(`${id}_val`);
        const labelEl = document.getElementById(`${id}_label`);
        const clearEl = document.getElementById(`${id}_clear`);
        if (valEl)   valEl.value = row.dataset.id;
        if (labelEl) labelEl.innerHTML = escapeHtml(row.dataset.label);
        if (clearEl) clearEl.style.display = '';
        overlay.remove();
      });
    });
  }

  render('');
  input.addEventListener('input', () => render(input.value.trim()));
  setTimeout(() => input.focus(), 80);
}

export function placeholderPage(title, ico) {
  return `
  <div class="page-fade">
    <div class="card simple-page">
      <div class="card-title">${icon(ico)} ${escapeHtml(title)}</div>
      <div class="empty-state">
        Módulo <strong>${escapeHtml(title)}</strong> em desenvolvimento.<br>
        Esta tela será integrada ao banco de dados em breve.
      </div>
    </div>
  </div>`;
}

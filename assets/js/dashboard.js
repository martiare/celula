import { icon, escapeHtml } from './helpers.js';
import { apiGet, getIgrejaAtiva } from './api.js';
import { APP } from './state.js';

export function dashboardPage() {
  const stats = APP.state.data.dashboardStats || null;

  const cards = [
    { label: 'Células ativas',    value: stats?.celulas       ?? '—', icon: 'grid_view',         color: '#2196F3' },
    { label: 'Discípulos ativos', value: stats?.discipulos    ?? '—', icon: 'supervisor_account', color: '#4CAF50' },
    { label: 'Pastores',          value: stats?.pastores      ?? '—', icon: 'people',             color: '#9C27B0' },
    { label: 'Visitantes no mês', value: stats?.visitantes_mes ?? '—', icon: 'person_add',         color: '#FF9800' },
  ];

  return `
  <div class="page-fade dash-layout">
    <div class="dash-cards">
      ${cards.map(c => `
        <div class="dash-card" style="--card-accent:${c.color}">
          <div class="dash-card-icon">${icon(c.icon)}</div>
          <div class="dash-card-body">
            <div class="dash-card-value">${escapeHtml(String(c.value))}</div>
            <div class="dash-card-label">${escapeHtml(c.label)}</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="dash-bottom">
      <div class="card dash-section">
        <div class="dash-section-title">${icon('church')} Igreja</div>
        <div class="dash-welcome">
          Bem-vindo ao <strong>Visão Célula</strong>.<br>
          Use o menu lateral para gerenciar pastores, discípulos, células e lançamentos.
        </div>
      </div>
      <div class="card dash-section">
        <div class="dash-section-title">${icon('calendar_month')} Próximos eventos</div>
        <div class="dash-events" id="dashEventsList">
          <div class="empty-state">Nenhum evento cadastrado.</div>
        </div>
      </div>
    </div>
  </div>`;
}

export async function loadDashboardStats() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  try {
    const data = await apiGet(`/api/dashboard/stats?igreja_id=${iid}`);
    APP.state.data.dashboardStats = data;
  } catch {
    APP.state.data.dashboardStats = null;
  }
}

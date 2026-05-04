import { APP, MENU } from './state.js';
import { icon, escapeHtml, avatarColor } from './helpers.js';
import { getSistema, getVisibleGroups, getIgrejaNome } from './api.js';

export function shell() {
  const user = APP.state.user;
  const route = APP.state.route;
  const visible = getVisibleGroups();

  let currentTitle = route === 'perfil' ? 'Meu Perfil' : 'Visão Célula';
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.route === route) { currentTitle = item.label; break; }
    }
  }

  if (APP.state.openGroups.size === 0) {
    const activeGroup = MENU.find(g => g.items.some(i => i.route === route));
    if (activeGroup) APP.state.openGroups.add(activeGroup.id);
  }

  // Igreja selector
  const igrejas = user?.igrejas || user?.empresas || [];
  const igrejaAtiva = APP.state.igrejaAtiva || user?.igreja_id || user?.empresa_id || '';
  const igrejaSelect = igrejas.length > 1
    ? `<select class="igreja-select" id="igrejaSelect">
        <option value="">Igrejas...</option>
        ${igrejas.map(i => `<option value="${i.id}"${String(i.id) === String(igrejaAtiva) ? ' selected' : ''}>${escapeHtml(i.nome)}</option>`).join('')}
       </select>`
    : igrejas.length === 1
      ? `<div class="igreja-label">${escapeHtml(igrejas[0].nome)}</div>`
      : '';

  const navGroups = MENU
    .filter(g => visible.has(g.id))
    .map(g => {
      const isOpen = APP.state.openGroups.has(g.id);
      const hasSub = g.items.length > 1 || g.id === 'pastores' || g.id === 'discipulos' || g.id === 'celula' || g.id === 'graficos' || g.id === 'admin';
      const items = g.items.map(i =>
        `<button class="nav-item${route === i.route ? ' active' : ''}" data-route="${i.route}" type="button">${escapeHtml(i.label)}</button>`
      ).join('');

      if (!hasSub || g.items.length === 1) {
        return `
          <button class="nav-item nav-item-top${route === g.items[0].route ? ' active' : ''}" data-route="${g.items[0].route}" type="button">
            ${icon(g.icon)}<span>${escapeHtml(g.label)}</span>
          </button>`;
      }

      return `
        <div class="nav-group${isOpen ? ' open' : ''}" data-group-id="${g.id}">
          <div class="nav-group-head" data-toggle-group="${g.id}">
            ${icon(g.icon)}<span>${escapeHtml(g.label)}</span>
            <span class="material-symbols-outlined nav-group-chevron">chevron_right</span>
          </div>
          <div class="nav-group-body">${items}</div>
        </div>`;
    }).join('');

  return `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <img src="/favicon.ico" alt="Visão" class="brand-logo" />
        <div class="brand-text">
          <div class="brand-name">Visão - WEB</div>
          <div class="brand-tagline">Sistema de células</div>
        </div>
      </div>

      <div class="user-card" data-route="perfil" style="cursor:pointer" title="Meu Perfil">
        ${user?.foto_url
          ? `<img src="${escapeHtml(user.foto_url)}" class="user-avatar user-avatar-photo" alt="foto" />`
          : `<div class="user-avatar" style="background:${avatarColor(user?.nome || user?.usuario || 'U')}">${escapeHtml((user?.nome || user?.usuario || 'U').slice(0, 2).toUpperCase())}</div>`
        }
        <div class="user-info">
          <div class="user-name">${escapeHtml(user?.nome || user?.usuario || 'Convidado')}</div>
          <div class="user-role">${escapeHtml(getSistema())}</div>
        </div>
      </div>

      ${igrejaSelect ? `<div class="igreja-selector-wrap">${igrejaSelect}</div>` : ''}

      <div class="nav-label">Menu Principal</div>
      <nav class="nav">${navGroups}</nav>

      <button class="logout-btn" data-logout type="button">${icon('close')} Encerrar</button>
      <div class="app-version">v1.1.2.3 · 04/05/2026</div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <main class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button class="mobile-menu-btn" id="mobileMenuBtn" type="button">${icon('menu')}</button>
          <h1 class="page-title">${escapeHtml(currentTitle)}</h1>
        </div>
        <div class="topbar-right">
          <button class="pill pill-danger" data-logout type="button">${icon('logout')} Sair</button>
        </div>
      </header>
      <div class="content-area" id="pageContent"></div>
    </main>
  </div>`;
}

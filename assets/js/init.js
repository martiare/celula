import { APP, ROOT, MENU } from './state.js';
import { parseUser, getSistema, getDefaultRoute, getIgrejaAtiva, apiPost } from './api.js';
import { closeModal } from './modal.js';
import { shell } from './shell.js';
import { escapeHtml, placeholderPage } from './helpers.js';
import { adminPage, bindAdminPage } from './admin.js';
import { perfilPage, bindPerfilPage } from './perfil.js';
import { dashboardPage, loadDashboardStats } from './dashboard.js';
import { igrejaPage, bindIgrejaPage, loadIgrejaDados } from './igreja.js';
import { gruposPastorPage, bindGruposPastorPage } from './grupos_pastor.js';
import { ministeriosPage, bindMinisteriosPage } from './ministerios.js';
import { pastoresPage, bindPastoresPage } from './pastores.js';
import { discipulosPage, bindDiscipulosPage } from './discipulos.js';
import { loadAdminData, loadCadastrosData } from './loaders.js';
import { macrocelulasPage, bindMacrocelulasPage } from './macro_celulas.js';
import { tiposCelulaPage, bindTiposCelulaPage } from './tipos_celula.js';
import { celulasPage, bindCelulasPage } from './celulas.js';

// ── Routing ───────────────────────────────────────────────────────────────────

export function setRoute(route) {
  APP.state.route = route;
  if (route === 'admin-igrejas')       APP.state.adminTab = 'igrejas';
  else if (route === 'admin-vinculos') APP.state.adminTab = 'vinculos';
  else if (route === 'admin-usuarios') APP.state.adminTab = 'usuarios';
  const grupo = MENU.find(g => g.items.some(i => i.route === route));
  if (grupo) APP.state.openGroups.add(grupo.id);
  document.querySelector('.sidebar')?.classList.remove('sidebar-mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  renderPage();
}

export function setAdminTab(tab) { APP.state.adminTab = tab; renderPage(); }

// ── Render ────────────────────────────────────────────────────────────────────

export function renderPage() {
  if (!ROOT) return;
  const route = APP.state.route;

  let content = '';
  if (route === 'inicio')                      content = dashboardPage();
  else if (route === 'igreja')                 content = igrejaPage();
  else if (route.startsWith('admin'))          content = adminPage();
  else if (route === 'perfil')                 content = perfilPage();
  else if (route === 'pastores-grupos')        content = gruposPastorPage();
  else if (route === 'pastores-lista')         content = pastoresPage();
  else if (route === 'discipulos-ministerio')  content = ministeriosPage();
  else if (route === 'discipulos-lista')       content = discipulosPage();
  else if (route === 'celula-macro')           content = macrocelulasPage();
  else if (route === 'celula-tipo')            content = tiposCelulaPage();
  else if (route === 'celula-lista')           content = celulasPage();
  else                                         content = placeholderPage(_routeLabel(route), 'construction');

  ROOT.innerHTML = shell();
  document.getElementById('pageContent').innerHTML = content;
  bindShell();
  bindPage();
}

function _routeLabel(route) {
  for (const g of MENU) {
    const item = g.items.find(i => i.route === route);
    if (item) return item.label;
  }
  return route;
}

// ── Shell bindings ────────────────────────────────────────────────────────────

function bindShell() {
  ROOT.querySelectorAll('[data-route]').forEach(b =>
    b.addEventListener('click', () => setRoute(b.dataset.route)));
  ROOT.querySelectorAll('[data-admin-tab]').forEach(b =>
    b.addEventListener('click', () => setAdminTab(b.dataset.adminTab)));
  ROOT.querySelectorAll('[data-logout]').forEach(b =>
    b.addEventListener('click', () => { localStorage.removeItem('acessoCentralUser'); window.location.href = '/'; }));
  document.getElementById('igrejaSelect')?.addEventListener('change', async e => {
    APP.state.igrejaAtiva = e.target.value;
    await Promise.allSettled([loadCadastrosData(), loadDashboardStats(), loadIgrejaDados()]);
    renderPage();
  });
}

// ── Page bindings ─────────────────────────────────────────────────────────────

function bindPage() {
  document.querySelectorAll('[data-toggle-group]').forEach(head => {
    head.addEventListener('click', () => {
      const groupId = head.dataset.toggleGroup;
      const groupEl = head.closest('.nav-group');
      if (APP.state.openGroups.has(groupId)) {
        APP.state.openGroups.delete(groupId);
        groupEl?.classList.remove('open');
      } else {
        APP.state.openGroups.add(groupId);
        groupEl?.classList.add('open');
      }
    });
  });

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('sidebar-mobile-open');
    document.getElementById('sidebarOverlay')?.classList.toggle('active');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.remove('sidebar-mobile-open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); }, { once: true });

  const route = APP.state.route;
  if (route.startsWith('admin'))           bindAdminPage({ renderPage });
  if (route === 'perfil')                  bindPerfilPage({ renderPage });
  if (route === 'igreja')                  bindIgrejaPage({ renderPage });
  if (route === 'pastores-grupos')         bindGruposPastorPage({ renderPage });
  if (route === 'pastores-lista')          bindPastoresPage({ renderPage });
  if (route === 'discipulos-ministerio')   bindMinisteriosPage({ renderPage });
  if (route === 'discipulos-lista')        bindDiscipulosPage({ renderPage });
  if (route === 'celula-macro')            bindMacrocelulasPage({ renderPage });
  if (route === 'celula-tipo')             bindTiposCelulaPage({ renderPage });
  if (route === 'celula-lista')            bindCelulasPage({ renderPage });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  APP.state.user  = parseUser();
  APP.state.route = getDefaultRoute();

  const u = APP.state.user;
  if (!u) { window.location.href = '/'; return; }

  // Refresh token + igrejas
  if (u?.id) {
    try {
      const fresh = await apiPost('/api/auth/refresh', { id: u.id });
      if (fresh) {
        const updated = { ...u, ...fresh };
        localStorage.setItem('acessoCentralUser', JSON.stringify(updated));
        APP.state.user = updated;
      }
    } catch { /* continua com dados locais */ }
  }

  const nivel = getSistema().toLowerCase();
  const loads = [loadCadastrosData(), loadDashboardStats(), loadIgrejaDados()];
  if (nivel === 'administrador') loads.push(loadAdminData());
  await Promise.allSettled(loads);

  renderPage();
}

init().catch(err => {
  console.error(err);
  if (ROOT) ROOT.innerHTML = `<div style="padding:32px;font-family:sans-serif"><h1>Erro ao carregar o portal</h1><pre style="color:#ef4444">${escapeHtml(err.message)}</pre></div>`;
});

import { APP } from './state.js';

export function parseUser() {
  try { return JSON.parse(localStorage.getItem('acessoCentralUser') || 'null'); } catch { return null; }
}

export function getSistema() {
  const user = APP.state.user || parseUser();
  return (user?.sistema || user?.nivel || 'observer').trim();
}

export function getIgrejaId() {
  const user = APP.state.user || parseUser();
  return user?.igreja_id || user?.empresa_id || null;
}

export function getIgrejaNome() {
  const user = APP.state.user || parseUser();
  return user?.igreja_nome || user?.empresa_nome || '';
}

// Retorna a igreja ativa (selecionada no seletor ou a principal do usuário)
export function getIgrejaAtiva() {
  if (APP.state.igrejaAtiva) return Number(APP.state.igrejaAtiva);
  const user = APP.state.user || parseUser();
  const iid = user?.igreja_id || user?.empresa_id || null;
  return iid ? Number(iid) : null;
}

export function getVisibleGroups() {
  const nivel = getSistema().toLowerCase();
  const todos = new Set(['inicio', 'igreja', 'pastores', 'discipulos', 'celula', 'graficos', 'agenda']);
  if (nivel === 'administrador') { todos.add('admin'); }
  return todos;
}

export function getDefaultRoute() {
  return 'inicio';
}

export function authHeaders(extra) {
  const token = parseUser()?.token || '';
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

export function handleUnauthorized() {
  localStorage.removeItem('acessoCentralUser');
  window.location.href = '/';
}

export async function apiGet(path) {
  const res = await fetch(path, { headers: authHeaders({ Accept: 'application/json' }) });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Sessão expirada.'); }
  if (!res.ok) throw Object.assign(new Error(`GET ${path} → ${res.status}`), { status: res.status });
  return res.json();
}

export async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Sessão expirada.'); }
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw Object.assign(new Error(json?.message || `POST ${path} → ${res.status}`), { status: res.status, body: json });
  return json;
}

export async function apiDelete(path) {
  const res = await fetch(path, {
    method: 'DELETE',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Sessão expirada.'); }
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw Object.assign(new Error(json?.message || `DELETE ${path} → ${res.status}`), { status: res.status });
  return json;
}

export async function apiPatch(path, payload = {}) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify(payload)
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Sessão expirada.'); }
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw Object.assign(new Error(json?.message || `PATCH ${path} → ${res.status}`), { status: res.status });
  return json;
}

import { APP } from './state.js';
import { apiGet, getIgrejaAtiva } from './api.js';

export async function loadAdminData() {
  try {
    const [users, igrejas, links] = await Promise.all([
      apiGet('/api/admin/usuarios'),
      apiGet('/api/admin/igrejas'),
      apiGet('/api/admin/vinculos')
    ]);
    APP.state.data.adminUsers = users.items || [];
    APP.state.data.igrejas    = igrejas.items || [];
    APP.state.data.links      = links.items || [];
  } catch (err) {
    console.warn('Falha ao carregar dados admin:', err);
  }
}

export async function loadCadastrosData() {
  const iid = getIgrejaAtiva();
  if (!iid) return;
  const [grupos, ministerios, pastores, discipulos, macros, tipos, celulas] = await Promise.allSettled([
    apiGet(`/api/grupos-pastor?igreja_id=${iid}`),
    apiGet(`/api/ministerios?igreja_id=${iid}`),
    apiGet(`/api/pastores?igreja_id=${iid}`),
    apiGet(`/api/discipulos?igreja_id=${iid}`),
    apiGet(`/api/macrocelulas?igreja_id=${iid}`),
    apiGet(`/api/tipos-celula?igreja_id=${iid}`),
    apiGet(`/api/celulas?igreja_id=${iid}`),
  ]);
  if (grupos.status      === 'fulfilled') APP.state.data.gruposPastor = grupos.value.items      || [];
  if (ministerios.status === 'fulfilled') APP.state.data.ministerios  = ministerios.value.items  || [];
  if (pastores.status    === 'fulfilled') APP.state.data.pastores     = pastores.value.items     || [];
  if (discipulos.status  === 'fulfilled') APP.state.data.discipulos   = discipulos.value.items   || [];
  if (macros.status      === 'fulfilled') APP.state.data.macrocelulas = macros.value.items       || [];
  if (tipos.status       === 'fulfilled') APP.state.data.tiposCelula  = tipos.value.items        || [];
  if (celulas.status     === 'fulfilled') APP.state.data.celulas      = celulas.value.items      || [];
}

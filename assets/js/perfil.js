import { APP } from './state.js';
import { icon, escapeHtml, showToast, avatarColor } from './helpers.js';
import { apiGet, apiPost, authHeaders, parseUser } from './api.js';

export function perfilPage() {
  const user = APP.state.user || parseUser();
  const fotoSrc  = user?.foto_url || '';
  const initials = escapeHtml((user?.usuario || 'U').slice(0, 2).toUpperCase());
  const avatarBg = avatarColor(user?.usuario || 'U');

  return `
  <div class="page-fade">
    <div class="perfil-card">
      <div class="perfil-foto-area">
        <div class="perfil-avatar-wrap" id="perfilAvatarWrap">
          ${fotoSrc
            ? `<img id="perfilAvatarImg" src="${escapeHtml(fotoSrc)}" class="perfil-avatar-img" alt="foto" />`
            : `<div id="perfilAvatarImg" class="perfil-avatar-initials" style="background:${avatarBg}">${initials}</div>`
          }
          <label class="perfil-foto-overlay" title="Alterar foto">
            ${icon('photo_camera')}
            <input id="perfilFotoInput" type="file" accept="image/*" style="display:none" />
          </label>
        </div>
        <p class="perfil-foto-hint">Clique na foto para alterar</p>
      </div>

      <div class="form-grid" style="margin-top:20px">
        <label class="field-label">Usuário *
          <input id="pf_usuario" class="form-ctrl" type="text" value="${escapeHtml(user?.usuario || '')}" />
        </label>
        <label class="field-label">E-mail *
          <input id="pf_email" class="form-ctrl" type="email" value="${escapeHtml(user?.email || '')}" />
        </label>
        <label class="field-label">Nova senha <span style="color:var(--muted);font-weight:400">(deixe em branco para manter)</span>
          <input id="pf_senha" class="form-ctrl" type="password" placeholder="••••••••" />
        </label>
        <label class="field-label">Confirmar nova senha
          <input id="pf_senha2" class="form-ctrl" type="password" placeholder="••••••••" />
        </label>
      </div>

      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" id="perfilSalvarBtn">${icon('save')} Salvar alterações</button>
        <button class="btn btn-outline" data-route="inicio" type="button">${icon('arrow_back')} Sair</button>
      </div>
    </div>
  </div>`;
}

export function bindPerfilPage({ renderPage }) {
  const user = APP.state.user || parseUser();

  document.getElementById('perfilFotoInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('user_id', user.id);
    fd.append('foto', file);
    try {
      const r = await fetch('/api/perfil/foto', { method: 'POST', body: fd, headers: authHeaders({}) });
      const d = await r.json();
      if (!r.ok) { showToast(d.message || 'Erro ao enviar foto.', 'error'); return; }
      const updated = { ...user, foto_url: d.foto_url };
      localStorage.setItem('acessoCentralUser', JSON.stringify(updated));
      APP.state.user = updated;
      const wrap = document.getElementById('perfilAvatarImg');
      if (wrap) {
        const img = document.createElement('img');
        img.src = d.foto_url + '?t=' + Date.now();
        img.className = 'perfil-avatar-img';
        img.alt = 'foto';
        img.id = 'perfilAvatarImg';
        wrap.replaceWith(img);
      }
      showToast('Foto atualizada!');
    } catch { showToast('Erro de conexão ao enviar foto.', 'error'); }
  });

  document.getElementById('perfilSalvarBtn')?.addEventListener('click', async () => {
    const usuario = document.getElementById('pf_usuario').value.trim();
    const email   = document.getElementById('pf_email').value.trim();
    const senha   = document.getElementById('pf_senha').value;
    const senha2  = document.getElementById('pf_senha2').value;
    if (!usuario) return showToast('Informe o usuário.', 'error');
    if (!email)   return showToast('Informe o e-mail.', 'error');
    if (senha && senha !== senha2) return showToast('As senhas não coincidem.', 'error');
    try {
      const res = await apiPost('/api/perfil', { id: user.id, usuario, email, senha: senha || undefined });
      const updated = { ...user, usuario: res.usuario || usuario, email: res.email || email };
      localStorage.setItem('acessoCentralUser', JSON.stringify(updated));
      APP.state.user = updated;
      showToast('Perfil salvo com sucesso!');
      renderPage();
    } catch (err) { showToast(err.message || 'Erro ao salvar perfil.', 'error'); }
  });

  // busca email atualizado do servidor
  apiGet(`/api/perfil?user_id=${user.id}`).then(data => {
    const emailInput = document.getElementById('pf_email');
    if (emailInput && data?.email) emailInput.value = data.email;
    if (data?.email) {
      const updated = { ...user, email: data.email };
      localStorage.setItem('acessoCentralUser', JSON.stringify(updated));
      APP.state.user = updated;
    }
  }).catch(() => {});
}

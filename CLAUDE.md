# Visão Célula

## Visão geral

- Sistema web de gestão de células para igrejas — "Visão Célula".
- Projeto modular em Python/FastAPI. Entry point: `main.py`.
- `server.py` é legado do CRM original — não usar.
- Frontend de login em `index.html`.
- Dashboard SPA em `dashboard.html`, CSS em `assets/app.css`, JS modular em `assets/js/` (entry point: `init.js`).
- Banco PostgreSQL com schema próprio (ver `migrations/001_schema_celula.sql`).
- Cores: verde Visão `#4CAF50`.
- Domínio produção: `https://www.celulas.igrejanasnuvens.com.br`

## Arquivos principais

- `main.py`: ponto de entrada — monta FastAPI com admin_router e perfil_router.
- `migrations/001_schema_celula.sql`: schema PostgreSQL completo do sistema.
- `app/config/settings.py`: variáveis de ambiente e paths (sem PGTABLE, sem CRM).
- `app/auth/tokens.py`: create_token(user_id, nivel) / verify_token → {"user_id", "nivel"} / hash_senha.
- `app/auth/middleware.py`: protege /api/admin/ (admin only) e /api/celula/, /api/perfil (qualquer token).
- `app/database/connection.py`: pool psycopg2, get_db_connection(), fetch_rows().
- `app/admin/service.py`: authenticate_user, CRUD de usuarios/igrejas/vinculos (desativar, nunca excluir).
- `app/admin/routes.py`: /api/login, /api/auth/refresh, /api/admin/usuarios|igrejas|vinculos.
- `app/perfil/routes.py`: /api/perfil, /api/perfil/foto.
- `assets/js/shell.js`: sidebar, menu, versão do sistema.
- `assets/js/state.js`: estado global (APP.state).
- `assets/js/api.js`: apiGet/apiPost.
- `favicon.ico`: logo Visão (círculo verde).
- `Dockerfile`: imagem `visao-celula:latest`.
- `docker-stack.yml`: deploy Swarm com Traefik no domínio acima.
- `build.sh`: script de build e deploy.

## Stack

- Python 3.12 + FastAPI + psycopg2-binary + uvicorn + python-multipart
- PostgreSQL (banco: `visao_celula`)
- Frontend: HTML + JS (ES modules) + CSS + Tailwind CDN

## Como rodar localmente

1. `python -m pip install -r requirements.txt`
2. Copie `.env.example` para `.env` e preencha.
3. Execute o schema no PostgreSQL: `psql -d visao_celula -f migrations/001_schema_celula.sql`
4. `python main.py`
5. Acesse `http://127.0.0.1:8000/`
6. Login inicial: `admin@visao.local` / `123` (trocar em produção)

## Variáveis de ambiente

- `PGHOST`, `PGDATABASE` (visao_celula), `PGUSER`, `PGPASSWORD` ou `PGPASSWORD_FILE`
- `PGPORT`, `PGSSLMODE`, `PGCONNECT_TIMEOUT`
- `APP_HOST`, `APP_PORT`, `ALLOWED_ORIGIN`, `APP_SECRET_KEY`

## Banco — tabelas principais

- `usuarios` — login do portal (email + senha_hash SHA-256, nivel_acesso)
- `igrejas` — tenant principal (campo ativo em todos)
- `vinculos_usuario_igreja` — qual usuário acessa qual igreja e com qual nível
- `macrocelulas`, `celulas`, `membros` — hierarquia de células
- `lancamentos_celula` — registros de reunião de célula
- `pastores`, `grupos_pastor` — pastores da igreja
- `eventos`, `tipos_evento` — agenda

## Hierarquia de acesso (nivel_acesso)

```
administrador        → tudo, todos os tenants
pastor_presidente    → todas as igrejas vinculadas a ele
  lider_macro        → somente a macro dele
    lider_celula     → somente a célula dele
      secretario     → acesso ao CRM (futuro)
        observer     → somente leitura
```

## Menu do sistema (state.js — MENU)

```
Início                    → route: inicio
Igreja                    → route: igreja
Pastores (expandível)
  └─ Grupo de pastor      → route: pastores-grupos
  └─ Pastor               → route: pastores-lista
Discípulos (expandível)
  └─ Ministério           → route: discipulos-ministerio
  └─ Discípulo            → route: discipulos-lista
  └─ Aniversário          → route: discipulos-aniversario
Célula (expandível)
  └─ Macrocélula          → route: celula-macro
  └─ Tipo de célula       → route: celula-tipo
  └─ Célula               → route: celula-lista
  └─ Lançamento           → route: celula-lancamento
  └─ Em atraso            → route: celula-atraso
Gráficos (expandível)
  └─ Macro                → route: graficos-macro
  └─ Celula               → route: graficos-celula
  └─ Ranking              → route: graficos-ranking
Agenda de eventos         → route: agenda
Administração (só administrador, expandível)
  └─ Igrejas              → route: admin-igrejas
  └─ Usuários             → route: admin-usuarios
  └─ Vínculos             → route: admin-vinculos
```

- Todos os grupos exceto `admin` são visíveis para qualquer nível autenticado.
- `admin` só aparece para `nivel = administrador`.
- Itens com apenas 1 rota renderizam como `nav-item-top` (sem expansão).
- Itens com subitens renderizam como `nav-group` expansível com `nav-group-chevron`.

## Regras críticas de manutenção

- **NUNCA excluir fisicamente** registros vinculados — apenas desativar (`ativo = FALSE`).
- Antes de desativar uma igreja, verificar se há vínculos ativos (service já faz isso).
- Todo acesso a dados filtra por `igreja_id` conforme o nível do usuário — nunca vazar dados entre igrejas.
- `nivel` no vínculo sobrescreve o `nivel` padrão do usuário para aquela igreja.

## Mapa de rotas

### Autenticação
- `POST /api/login`
- `POST /api/auth/refresh`
- `GET /api/perfil` | `POST /api/perfil` | `POST /api/perfil/foto`

### Administração (requer nivel=administrador)
- `GET  /api/admin/usuarios`
- `POST /api/admin/usuarios`
- `PATCH /api/admin/usuarios/{id}/desativar`
- `GET  /api/admin/igrejas`
- `POST /api/admin/igrejas`
- `PATCH /api/admin/igrejas/{id}/desativar`
- `GET  /api/admin/vinculos`
- `POST /api/admin/vinculos`
- `PATCH /api/admin/vinculos/{id}/desativar`

## Deploy produção

- Imagem: `visao-celula:latest`
- Serviço Swarm: `visao-celula_app`
- Secret Docker: `visao_celula_pgpassword`
- Rede: `IdeiaBotNet` (mesma do ideiabot-crm)
- Domínio: `www.celulas.igrejanasnuvens.com.br` + `celulas.igrejanasnuvens.com.br`
- Build + deploy: `bash build.sh`

## Comandos úteis

- `python -m pip install -r requirements.txt`
- `python main.py`
- `python -m py_compile main.py app/admin/service.py app/admin/routes.py`
- `curl http://127.0.0.1:8000/healthz`
- `docker build --no-cache -t visao-celula:latest .`
- `docker service update --force --image visao-celula:latest visao-celula_app`

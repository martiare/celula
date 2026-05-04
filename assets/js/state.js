export const APP = {
  state: {
    user: null,
    route: 'inicio',
    adminTab: 'igrejas',
    igrejaAtiva: null,
    openGroups: new Set(),
    data: {
      adminUsers: [], igrejas: [], links: [],
      dashboardStats: null,
      igrejaDados: null,
      gruposPastor: [], pastores: [],
      ministerios: [], discipulos: [],
      macrocelulas: [], tiposCelula: [], celulas: [],
    }
  }
};

export const ROOT = document.getElementById('appRoot');
export const MODAL_ROOT = document.getElementById('modalRoot');

export const MENU = [
  {
    id: 'inicio',
    label: 'Início',
    icon: 'home',
    items: [
      { route: 'inicio', label: 'Início' }
    ]
  },
  {
    id: 'igreja',
    label: 'Igreja',
    icon: 'account_balance',
    items: [
      { route: 'igreja', label: 'Igreja' }
    ]
  },
  {
    id: 'pastores',
    label: 'Pastores',
    icon: 'people',
    items: [
      { route: 'pastores-grupos', label: 'Grupo de pastor' },
      { route: 'pastores-lista',  label: 'Pastor' },
    ]
  },
  {
    id: 'discipulos',
    label: 'Discípulos',
    icon: 'supervisor_account',
    items: [
      { route: 'discipulos-ministerio',  label: 'Ministério' },
      { route: 'discipulos-lista',       label: 'Discípulo' },
      { route: 'discipulos-aniversario', label: 'Aniversário' },
    ]
  },
  {
    id: 'celula',
    label: 'Célula',
    icon: 'grid_view',
    items: [
      { route: 'celula-macro',       label: 'Macrocélula' },
      { route: 'celula-tipo',        label: 'Tipo de célula' },
      { route: 'celula-lista',       label: 'Célula' },
      { route: 'celula-lancamento',  label: 'Lançamento' },
      { route: 'celula-atraso',      label: 'Em atraso' },
    ]
  },
  {
    id: 'graficos',
    label: 'Gráficos',
    icon: 'bar_chart',
    items: [
      { route: 'graficos-macro',   label: 'Macro' },
      { route: 'graficos-celula',  label: 'Celula' },
      { route: 'graficos-ranking', label: 'Ranking' },
    ]
  },
  {
    id: 'agenda',
    label: 'Agenda de eventos',
    icon: 'calendar_month',
    items: [
      { route: 'agenda', label: 'Agenda de eventos' }
    ]
  },
  {
    id: 'admin',
    label: 'Administração',
    icon: 'admin_panel_settings',
    nivelMin: 'administrador',
    items: [
      { route: 'admin-igrejas',   label: 'Igrejas' },
      { route: 'admin-usuarios',  label: 'Usuários' },
      { route: 'admin-vinculos',  label: 'Vínculos' },
    ]
  }
];

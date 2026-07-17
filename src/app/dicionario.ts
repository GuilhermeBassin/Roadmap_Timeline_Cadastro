// ============================================================================
// DICIONÁRIO OFICIAL DE PARÂMETROS DO DASH
// Fonte de verdade: Controle de Demandas — CC, Cadastro & APP
// Este módulo é compartilhado por todas as telas (Controle de Vertical,
// Roadmap, Timeline e Controle de Demandas). Não criar valores fora daqui.
// ============================================================================

export type Area = 'APP' | 'Cadastro' | 'Conta Corrente';

export type FupStatus =
  | 'Backlog' | 'Discovery' | 'Handover' | 'Refin. Técnico' | 'Desenv. UX'
  | 'Desenv. Técnico' | 'Teste' | 'Pausado' | 'Bloqueado' | 'Concluído' | 'Cancelado';

export type Prioridade = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
export type Complexidade = 'Baixo' | 'Médio' | 'Alto';
export type Impacto = 'Baixo' | 'Médio' | 'Alto';

// Campos oficiais de projeto (FupItem) + auxiliares de exibição da Timeline
export interface FupItem {
  id: string;
  atividade: string;
  area: Area;
  origem: string;
  temaMacro: string;
  status: FupStatus;
  descricao: string;
  resumoStatus: string;
  focal: string;
  prioridade: Prioridade;
  dataLimite: string;
  dependencias: string;
  linkUX: string;
  linkRoadMap: string;
  // Auxiliares (fora do dicionário; usados só para desenho da Timeline/Gantt)
  dataInicio?: string;
  progresso?: number;
}

export const AREAS: Area[] = ['Cadastro', 'Conta Corrente', 'APP'];

export const FUP_STATUSES: FupStatus[] = [
  'Backlog', 'Discovery', 'Handover', 'Refin. Técnico', 'Desenv. UX',
  'Desenv. Técnico', 'Teste', 'Pausado', 'Bloqueado', 'Concluído', 'Cancelado',
];

// "Em andamento" = status fora de {Backlog, Bloqueado, Pausado, Concluído, Cancelado}
export const STATUS_FORA_ANDAMENTO: FupStatus[] = ['Backlog', 'Bloqueado', 'Pausado', 'Concluído', 'Cancelado'];
export const emAndamento = (status: FupStatus) => !STATUS_FORA_ANDAMENTO.includes(status);

export const PRIORIDADES: Prioridade[] = ['Baixo', 'Médio', 'Alto', 'Crítico'];
export const COMPLEXIDADES: Complexidade[] = ['Baixo', 'Médio', 'Alto'];
export const IMPACTOS: Impacto[] = ['Baixo', 'Médio', 'Alto'];

// Listas dinâmicas (valores iniciais oficiais — editáveis pelo usuário via tabela `listas`)
export const TEMAS_MACRO_INICIAIS = [
  'GDD', 'Abertura de Conta', 'Atualização Cadastral', 'TCD', 'SIMBA',
  'Onboarding', 'Encerramento', 'Outro',
];
export const ORIGENS_INICIAIS = [
  'Riscos e Regulatórios', 'Projetos', 'Metas/KPIs', 'Fast-Track', 'PA',
  'Performance', 'Negócios',
];

export const OWNERS = [
  'Maiune', 'Luke', 'Juliana', 'Cristiane', 'Felipe', 'Dionathan',
  'Guilherme', 'Leticia', 'Bruno', 'Pedro', 'Welligton',
];

// ── Apresentação ────────────────────────────────────────────────────────────

export const STATUS_CFG: Record<FupStatus, { color: string; bg: string; border: string }> = {
  'Backlog':         { color: '#64748B', bg: 'rgba(100,116,139,0.14)', border: 'rgba(100,116,139,0.35)' },
  'Discovery':       { color: '#9333EA', bg: 'rgba(147,51,234,0.14)',  border: 'rgba(147,51,234,0.35)' },
  'Handover':        { color: '#0284C7', bg: 'rgba(2,132,199,0.14)',   border: 'rgba(2,132,199,0.35)' },
  'Refin. Técnico':  { color: '#0D9488', bg: 'rgba(13,148,136,0.14)',  border: 'rgba(13,148,136,0.35)' },
  'Desenv. UX':      { color: '#DB2777', bg: 'rgba(219,39,119,0.14)',  border: 'rgba(219,39,119,0.35)' },
  'Desenv. Técnico': { color: '#EA580C', bg: 'rgba(234,88,12,0.14)',   border: 'rgba(234,88,12,0.35)' },
  'Teste':           { color: '#D97706', bg: 'rgba(217,119,6,0.14)',   border: 'rgba(217,119,6,0.35)' },
  'Pausado':         { color: '#A16207', bg: 'rgba(161,98,7,0.14)',    border: 'rgba(161,98,7,0.35)' },
  'Bloqueado':       { color: '#EF4444', bg: 'rgba(239,68,68,0.14)',   border: 'rgba(239,68,68,0.35)' },
  'Concluído':       { color: '#10B981', bg: 'rgba(16,185,129,0.14)',  border: 'rgba(16,185,129,0.35)' },
  'Cancelado':       { color: '#94A3B8', bg: 'rgba(148,163,184,0.14)', border: 'rgba(148,163,184,0.35)' },
};

export const PRIORIDADE_CFG: Record<Prioridade, { color: string; bg: string }> = {
  'Baixo':   { color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
  'Médio':   { color: '#0284C7', bg: 'rgba(2,132,199,0.12)' },
  'Alto':    { color: '#EA580C', bg: 'rgba(234,88,12,0.12)' },
  'Crítico': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

export const AREA_CFG: Record<Area, { color: string; short: string }> = {
  'Cadastro':       { color: '#6366F1', short: 'Cadastro' },
  'Conta Corrente': { color: '#0D9488', short: 'CC' },
  'APP':            { color: '#DB2777', short: 'APP' },
};

export const OWNER_PALETTE = ['#6366F1', '#EC4899', '#0D9488', '#D97706', '#8B5CF6', '#0284C7', '#DB2777', '#10B981', '#EA580C', '#64748B', '#9333EA'];

export function ownerColor(nome: string): string {
  const idx = OWNERS.indexOf(nome);
  if (idx >= 0) return OWNER_PALETTE[idx % OWNER_PALETTE.length];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return OWNER_PALETTE[h % OWNER_PALETTE.length];
}

export function initialsOf(nome: string): string {
  if (!nome.trim()) return '—';
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Progressão sugerida do fluxo (botão "avançar" do kanban)
export const NEXT_STATUS: Partial<Record<FupStatus, FupStatus>> = {
  'Backlog': 'Discovery',
  'Discovery': 'Handover',
  'Handover': 'Refin. Técnico',
  'Refin. Técnico': 'Desenv. UX',
  'Desenv. UX': 'Desenv. Técnico',
  'Desenv. Técnico': 'Teste',
  'Teste': 'Concluído',
};

// ── Mapeamento linha do banco (snake_case) ⇄ FupItem (camelCase) ────────────

export function rowToFup(row: any): FupItem {
  return {
    id: row.id,
    atividade: row.atividade ?? '',
    area: (row.area as Area) ?? 'Cadastro',
    origem: row.origem ?? '',
    temaMacro: row.tema_macro ?? '',
    status: (row.status as FupStatus) ?? 'Backlog',
    descricao: row.descricao ?? '',
    resumoStatus: row.resumo_status ?? '',
    focal: row.focal ?? '',
    prioridade: (row.prioridade as Prioridade) ?? 'Médio',
    dataLimite: row.data_limite ?? '',
    dependencias: row.dependencias ?? '',
    linkUX: row.link_ux ?? '',
    linkRoadMap: row.link_roadmap ?? '',
    dataInicio: row.data_inicio ?? '',
    progresso: row.progresso ?? 0,
  };
}

export function fupToRow(p: Partial<FupItem>) {
  const row: Record<string, any> = {};
  if (p.atividade !== undefined) row.atividade = p.atividade;
  if (p.area !== undefined) row.area = p.area;
  if (p.origem !== undefined) row.origem = p.origem;
  if (p.temaMacro !== undefined) row.tema_macro = p.temaMacro;
  if (p.status !== undefined) row.status = p.status;
  if (p.descricao !== undefined) row.descricao = p.descricao;
  if (p.resumoStatus !== undefined) row.resumo_status = p.resumoStatus;
  if (p.focal !== undefined) row.focal = p.focal;
  if (p.prioridade !== undefined) row.prioridade = p.prioridade;
  if (p.dataLimite !== undefined) row.data_limite = p.dataLimite || null;
  if (p.dependencias !== undefined) row.dependencias = p.dependencias;
  if (p.linkUX !== undefined) row.link_ux = p.linkUX;
  if (p.linkRoadMap !== undefined) row.link_roadmap = p.linkRoadMap;
  if (p.dataInicio !== undefined) row.data_inicio = p.dataInicio || null;
  if (p.progresso !== undefined) row.progresso = p.progresso;
  return row;
}

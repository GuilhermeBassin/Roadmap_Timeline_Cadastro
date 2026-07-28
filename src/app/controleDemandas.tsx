// ============================================================================
// Controle de Demandas — CC, Cadastro & APP (versão integrada ao Dash)
// Origem: app do Figma Make (anexo do usuário), portado para o app unificado.
// Persistência: fup_items no banco (FONTE DE VERDADE, via /api/db) +
// demais dados (performance, ux, kpis, listas locais, impedimentos) no
// kv_store, chave 'dashboard-data'. Sem localStorage.
// ============================================================================
import { Users, ClipboardList, CreditCard, Smartphone, CheckCircle2, Clock, AlertCircle, TrendingUp, Plus, X, ChevronDown, Trash2, Pencil } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from './api';
import { rowToFup, fupToRow } from './dicionario';

const KV_KEY = 'dashboard-data';


type TaskStatus = 'complete' | 'progress' | 'pending' | 'alert';

interface Task {
  id: string;
  status: TaskStatus;
  title: string;
  responsible: string;
  priority?: string;
}

type Area = 'APP' | 'Cadastro' | 'Conta Corrente';
type FupStatus = 'Backlog' | 'Discovery' | 'Handover' | 'Refin. Técnico' | 'Desenv. UX' | 'Desenv. Técnico' | 'Teste' | 'Concluído' | 'Pausado' | 'Cancelado' | 'Bloqueado' | 'UX';
type Prioridade = 'Baixo' | 'Médio' | 'Alto' | 'Crítico';
type Complexidade = 'Baixo' | 'Médio' | 'Alto';
type Impacto = 'Baixo' | 'Médio' | 'Alto';

interface FupItem {
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
}

interface PerformanceItem {
  id: string;
  temaMacro: string;
  origem: string;
  demanda: string;
  areaSolicitante: string;
  tipo: string;
  owner: string;
  dataSolicitacao: string;
  prazoInicio: string;
  prazoEntrega: string;
  status: string;
  complexidade: Complexidade;
  impacto: Impacto;
  descricao: string;
  resumoStatus: string;
  outputs: string;
  dependencias: string;
}

interface UxItem {
  id: string;
  tema: string;
  atividade: string;
  status: FupStatus;
  prioridade: Prioridade;
  dataInicio: string;
  dataEntrega: string;
}

function MultiSelectFilter({
  selected,
  onChange,
  options,
  placeholder = 'Selecione...',
  colorMap
}: {
  selected: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  colorMap?: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (option: string) => {
    onChange(selected.includes(option) ? selected.filter(v => v !== option) : [...selected, option]);
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`text-xs border rounded px-2 py-1 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap ${
          selected.length > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-blue-300'
        }`}
      >
        <span>{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-300 rounded shadow-lg min-w-[160px] max-h-60 overflow-y-auto">
          {options.map(option => {
            const isChecked = selected.includes(option);
            const color = colorMap?.[option];
            return (
              <div
                key={option}
                onClick={() => toggle(option)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-xs ${isChecked ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                  {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                </div>
                {color ? (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{option}</span>
                ) : (
                  <span className="text-gray-800">{option}</span>
                )}
              </div>
            );
          })}
          {selected.length > 0 && (
            <div
              onClick={() => onChange([])}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-red-50 text-xs text-red-500 border-t border-gray-200"
            >
              <X className="w-3 h-3" /> Limpar seleção
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CustomSelectWithDelete({
  value,
  onChange,
  options,
  onDelete,
  onAddNew,
  placeholder = 'Selecione...',
  className = ''
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onDelete: (option: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    onDelete(option);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option}
              className="flex items-center justify-between px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-xs group"
            >
              <span
                onClick={() => handleSelect(option)}
                className="flex-1 truncate"
              >
                {option}
              </span>
              <button
                onClick={(e) => handleDelete(e, option)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-0.5 hover:bg-red-100 rounded"
                title={`Remover ${option}`}
              >
                <X className="w-3 h-3 text-red-600" />
              </button>
            </div>
          ))}
          {onAddNew && (
            <div
              onClick={() => {
                onAddNew();
                setIsOpen(false);
              }}
              className="px-2 py-1.5 hover:bg-green-50 cursor-pointer text-xs font-semibold text-green-700 border-t border-gray-200"
            >
              + Adicionar novo...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ControleDemandas({ onDataChanged }: { onDataChanged?: () => void }) {
  const mapFupStatusToTaskStatus = (fupStatus: FupStatus): TaskStatus => {
    if (fupStatus === 'Concluído') return 'complete';
    if (fupStatus === 'Backlog') return 'pending';
    return 'progress';
  };

  const [cadastroTasks, setCadastroTasks] = useState<Task[]>([]);
  const [contaCorrenteTasks, setContaCorrenteTasks] = useState<Task[]>([]);
  const [appEstruturalTasks, setAppEstruturalTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [cadastroExpanded, setCadastroExpanded] = useState(true);
  const [contaCorrenteExpanded, setContaCorrenteExpanded] = useState(true);
  const [appExpanded, setAppExpanded] = useState(true);
  const [impedimentosExpanded, setImpedimentosExpanded] = useState(true);

  const [activeTab, setActiveTab] = useState<'projetos' | 'historico' | 'performance' | 'ux' | 'status-report'>('projetos');
  const [statusGeralTab, setStatusGeralTab] = useState<'projetos' | 'performance'>('projetos');

  // KPIs da Semana
  const [kpis, setKpis] = useState([
    { id: '1', label: 'Velocity', value: '42 pontos', trend: 'up' as const },
    { id: '2', label: 'Deploy Success', value: '95%', trend: 'up' as const },
    { id: '3', label: 'Code Coverage', value: '78%', trend: 'down' as const }
  ]);
  const [editandoKpis, setEditandoKpis] = useState(false);
  const [kpisTemp, setKpisTemp] = useState([...kpis]);

  const iniciarEdicaoKpis = () => {
    setKpisTemp([...kpis]);
    setEditandoKpis(true);
  };

  const cancelarEdicaoKpis = () => {
    setKpisTemp([...kpis]);
    setEditandoKpis(false);
  };

  const salvarKpis = () => {
    setKpis([...kpisTemp]);
    setEditandoKpis(false);
  };

  const atualizarKpiTemp = (id: string, field: 'label' | 'value' | 'trend', value: string) => {
    setKpisTemp(prev => prev.map(kpi =>
      kpi.id === id ? { ...kpi, [field]: value } : kpi
    ));
  };

  // Lista de Temas Macro (dinâmica)
  const [temasMacro, setTemasMacro] = useState<string[]>([
    'GDD',
    'Abertura de Conta',
    'Atualização Cadastral',
    'TCD',
    'SIMBA',
    'Onboarding',
    'Encerramento',
    'Outro'
  ]);

  // Lista de Origens (dinâmica)
  const [origens, setOrigens] = useState<string[]>([
    'Riscos e Regulatórios',
    'Projetos',
    'Metas/KPIs',
    'Fast-Track',
    'PA',
    'Performance',
    'Negócios'
  ]);

  // Listas para Performance (dinâmicas e independentes)
  const [temasMacroPerformance, setTemasMacroPerformance] = useState<string[]>([
    'Abertura de Conta',
    'Encerramento',
    'Análise',
    'Métricas',
    'Outro'
  ]);

  const [origensPerformance, setOrigensPerformance] = useState<string[]>([
    'Performance',
    'Interna',
    'Atendimento',
    'Negócios'
  ]);

  const [areasSolicitantes, setAreasSolicitantes] = useState<string[]>([
    'Performance',
    'Interna',
    'Atendimento'
  ]);

  const [tipos, setTipos] = useState<string[]>([
    'Roadmap',
    'Weekly'
  ]);

  // Filtros para a tabela FUP
  const [filtroAtividade, setFiltroAtividade] = useState('');
  const [filtroArea, setFiltroArea] = useState<Area[]>([]);
  const [filtroOrigem, setFiltroOrigem] = useState<string[]>([]);
  const [filtroTemaMacro, setFiltroTemaMacro] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<FupStatus[]>([]);
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade[]>([]);
  const [filtroFocal, setFiltroFocal] = useState<string[]>([]);

  // Filtros para a tabela Performance
  const [filtroTemaMacroPerformance, setFiltroTemaMacroPerformance] = useState<string[]>([]);
  const [filtroOrigemPerformance, setFiltroOrigemPerformance] = useState<string[]>([]);
  const [filtroDemanda, setFiltroDemanda] = useState('');
  const [filtroAreaSolicitante, setFiltroAreaSolicitante] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroOwner, setFiltroOwner] = useState<string[]>([]);
  const [filtroStatusPerformance, setFiltroStatusPerformance] = useState<string[]>([]);
  const [filtroComplexidade, setFiltroComplexidade] = useState<Complexidade[]>([]);
  const [filtroImpacto, setFiltroImpacto] = useState<Impacto[]>([]);

  const [performanceItems, setPerformanceItems] = useState<PerformanceItem[]>([
    { id: '1', temaMacro: 'Abertura de Conta', origem: 'Performance', demanda: 'Funil Abertura de Contas (Dias uteis)', areaSolicitante: 'Performance', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-08', prazoInicio: '2026-06-01', prazoEntrega: '2026-06-02', status: 'Andamento', complexidade: 'Médio', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '2', temaMacro: 'Abertura de Conta', origem: 'Performance', demanda: 'Painel Abertura de Contas (Dias Uteis)', areaSolicitante: 'Performance', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-08', prazoInicio: '2026-06-03', prazoEntrega: '2026-06-05', status: 'Andamento', complexidade: 'Médio', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '3', temaMacro: 'Outro', origem: 'Performance', demanda: 'Material Weekly', areaSolicitante: 'Performance', tipo: 'Weekly', owner: 'Welligton', dataSolicitacao: '2026-05-28', prazoInicio: '2026-05-29', prazoEntrega: '2026-06-03', status: 'Andamento', complexidade: 'Baixo', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '4', temaMacro: 'Outro', origem: 'Performance', demanda: 'Clientes Opt-In que não transacionaram', areaSolicitante: 'Performance', tipo: 'Weekly', owner: 'Cristiane', dataSolicitacao: '2026-05-28', prazoInicio: '2026-05-29', prazoEntrega: '2026-06-03', status: 'Andamento', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '5', temaMacro: 'Outro', origem: 'Performance', demanda: 'Funil Completo Clientes Opt-In', areaSolicitante: 'Performance', tipo: 'Weekly', owner: 'Bruno', dataSolicitacao: '2026-05-28', prazoInicio: '2026-05-29', prazoEntrega: '2026-06-03', status: 'Andamento', complexidade: 'Alto', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '6', temaMacro: 'Outro', origem: 'Performance', demanda: 'Fechamento KPIs Vertical', areaSolicitante: 'Performance', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-28', prazoInicio: '2026-06-01', prazoEntrega: '2026-06-03', status: 'Andamento', complexidade: 'Médio', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '7', temaMacro: 'Outro', origem: 'Interna', demanda: 'Estudo sobre a base de clientes (KPI Digital)', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Cristiane', dataSolicitacao: '2026-05-28', prazoInicio: '2026-06-08', prazoEntrega: '2026-06-11', status: 'Andamento', complexidade: 'Alto', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '8', temaMacro: 'Abertura de Conta', origem: 'Interna', demanda: 'Oportunidades com o Push para pendenciamento de contas', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Luke', dataSolicitacao: '2026-05-28', prazoInicio: '2026-05-29', prazoEntrega: '2026-06-02', status: 'Andamento', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '9', temaMacro: 'Abertura de Conta', origem: 'Interna', demanda: 'Abertura de Conta na loja (Conceito de contas puras )', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Bruno', dataSolicitacao: '2026-05-11', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Alto', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '10', temaMacro: 'Outro', origem: 'Interna', demanda: 'Tarifa de Comunicação (Volume de Opt-out)', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Bruno', dataSolicitacao: '2026-05-11', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '11', temaMacro: 'Encerramento', origem: 'Interna', demanda: 'Encerramento de Conta - Como encerra INSS em canais', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-11', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Baixo', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '12', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves CC - Tempo Médio e Opt-in', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '13', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves CC - Tipologia de Contas e founding', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '14', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves Cadastro - Taxa de erro cadastral', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Bruno', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Alto', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '15', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves - duplicidade', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Bruno', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '16', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves - Erro cadastral', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Bruno', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Alto', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '17', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves - Abandono em etapas', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Alto', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '18', temaMacro: 'Outro', origem: 'Interna', demanda: 'Métricas Chaves - Nulidade', areaSolicitante: 'Interna', tipo: 'Roadmap', owner: 'Welligton', dataSolicitacao: '2026-05-12', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Médio', impacto: 'Médio', descricao: '', resumoStatus: '', outputs: '', dependencias: '' },
    { id: '19', temaMacro: 'Outro', origem: 'Atendimento', demanda: 'Device com múltiplos CPFs', areaSolicitante: 'Atendimento', tipo: 'Weekly', owner: 'Luke', dataSolicitacao: '2026-05-28', prazoInicio: '', prazoEntrega: '', status: 'Backlog', complexidade: 'Baixo', impacto: 'Baixo', descricao: '', resumoStatus: '', outputs: '', dependencias: '' }
  ]);

  const [impedimentosTasks, setImpedimentosTasks] = useState<Task[]>([
    { id: '10', status: 'alert', title: 'Dependência externa com instabilidade', responsible: 'Squad Gamma', priority: 'Alta' },
    { id: '11', status: 'alert', title: 'Recurso em férias - Squad Beta', responsible: 'RH', priority: 'Média' },
  ]);

  const [uxItems, setUxItems] = useState<UxItem[]>([]);
  const [filtroTemaUx, setFiltroTemaUx] = useState<string[]>([]);
  const [filtroStatusUx, setFiltroStatusUx] = useState<FupStatus[]>([]);
  const [filtroPrioridadeUx, setFiltroPrioridadeUx] = useState<Prioridade[]>([]);

  const [fupItems, setFupItems] = useState<FupItem[]>([
    { id: '1', atividade: 'Dados Nulls (Campos Obrigatórios Ausentes)', area: 'APP', origem: 'Performance', temaMacro: 'Outro', status: 'Concluído', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '2026-11-30', dependencias: '', linkUX: '', linkRoadMap: 'Roadmap: 2058' },
    { id: '2', atividade: 'Celulares e E-mails Duplicados', area: 'Cadastro', origem: 'PA', temaMacro: 'Atualização Cadastral', status: 'Discovery', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '2026-08-03', dependencias: '', linkUX: '', linkRoadMap: 'Roadmap: 2059' },
    { id: '3', atividade: 'A Falha na Sincronização de Dados Pessoais', area: 'Cadastro', origem: 'PA', temaMacro: 'Atualização Cadastral', status: 'Teste', descricao: '', resumoStatus: 'Subida 11/05', focal: '', prioridade: 'Alto', dataLimite: '2026-05-07', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '4', atividade: 'Atualização Cadastral com Fluxo de Consequência', area: 'Cadastro', origem: 'PA', temaMacro: 'Atualização Cadastral', status: 'Teste', descricao: '', resumoStatus: '', focal: '', prioridade: 'Alto', dataLimite: '2026-04-30', dependencias: '', linkUX: '', linkRoadMap: 'Roadmap: 2045' },
    { id: '5', atividade: 'Fluxo de Consequência Atualização Cadastra', area: 'Cadastro', origem: 'Riscos e Regulatórios', temaMacro: 'Atualização Cadastral', status: 'Teste', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '6', atividade: 'Dados Nulls (Campos Obrigatórios Ausentes', area: 'Cadastro', origem: 'Riscos e Regulatórios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '7', atividade: 'Ausência de Integração de Representantes Legais ao Motor de Fraudes', area: 'Cadastro', origem: 'Riscos e Regulatórios', temaMacro: 'Onboarding', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '8', atividade: 'Celulares e E-mails Duplicados​', area: 'Cadastro', origem: 'Riscos e Regulatórios', temaMacro: 'Atualização Cadastral', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '9', atividade: 'Ausência de Integração de Representantes Legais ao Motor de Fraudes', area: 'Cadastro', origem: 'PA', temaMacro: 'Onboarding', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '2026-06-30', dependencias: '', linkUX: '', linkRoadMap: 'Roadmap: 2061' },
    { id: '10', atividade: 'Falha sincronização de Dados Pessoais', area: 'Cadastro', origem: 'Riscos e Regulatórios', temaMacro: 'Atualização Cadastral', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '11', atividade: 'Migração do CADU para o MDM', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '12', atividade: 'UNIFICAÇÃO de bases | Telefone, Endereço e E-mail', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '13', atividade: 'Subir campo de Data Criação e Atualização no MDM – Ocupação', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '14', atividade: '[GDD] Fase 1 – Gerenciador de Documentos', area: 'Cadastro', origem: 'Negócios', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '15', atividade: '[GDD] Fase 2 – Gerenciador de Dados', area: 'Cadastro', origem: 'Negócios', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '16', atividade: 'Opt-in/Opt-out – Gerenciamento de Dados', area: 'Cadastro', origem: 'Negócios', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '17', atividade: 'Implementação de nova API de CEPs', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '18', atividade: 'Refatoração do fluxo de analfabetos', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Onboarding', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '19', atividade: 'Atualização cadastral - Refatoração fluxo', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '20', atividade: 'UNIFICAÇÃO de bases VF - Cadastro único', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '21', atividade: 'Fluxo de Consequência Atualização Cadastral 2.0 – Automatização do fluxo', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '22', atividade: 'Revisão/Adequação de termos | FASE 1', area: 'Cadastro', origem: 'Negócios', temaMacro: 'TCD', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '23', atividade: 'Atualização - Base Endereços (Sincronia e Legado)', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '24', atividade: 'Marcação de Clientes (PEP - Pessoas Ligadas)', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '25', atividade: 'Revisão – Dados clientes c de carteiras', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Atualização Cadastral', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '26', atividade: 'Username – Contemplar novo campo Wpp', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '27', atividade: 'Captura - Dado Ocupação (Fluxo de onboarding)', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Onboarding', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '28', atividade: 'Refatoração do fluxo RL', area: 'Cadastro', origem: 'Negócios', temaMacro: 'Onboarding', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '29', atividade: '[GDD] Fase 1 - Reutilização de Docs Aprovados pela Mesa de Formalização', area: 'Cadastro', origem: 'Negócios', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '30', atividade: 'SIMBA | Remodelagem do processo', area: 'Conta Corrente', origem: 'Riscos e Regulatórios', temaMacro: 'SIMBA', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '31', atividade: 'Criação de Conta Topaz | Conjunta – RL, Menor, PJ e Salário', area: 'Conta Corrente', origem: 'Riscos e Regulatórios', temaMacro: 'Abertura de Conta', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '32', atividade: 'Declaração anual de débitos', area: 'Conta Corrente', origem: 'Riscos e Regulatórios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '33', atividade: 'Revisão literal Extratos (todos os canais)', area: 'Conta Corrente', origem: 'Riscos e Regulatórios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '34', atividade: 'SIMBA | Normativa BCB n° 636', area: 'Conta Corrente', origem: 'Riscos e Regulatórios', temaMacro: 'SIMBA', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '35', atividade: 'Refatoração encerramento de CC', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Encerramento', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '36', atividade: 'Investimento: Cancelamento, Bacenjud , CCS e Encerramento', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Encerramento', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '37', atividade: 'Oferta avulsa tarifa de comunicação APP e Whatsapp.', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '38', atividade: 'BC Protege – Fase 2', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '39', atividade: 'Criação de Pacote de Tarifas', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '40', atividade: 'Orquestrador de Tarifas | DEMAIS', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '41', atividade: 'Tracking originação de contas (com alertas)', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Abertura de Conta', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '42', atividade: 'Desligamento da Conta Remunerada', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Encerramento', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '43', atividade: 'CNPJ Alfanumérico', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '44', atividade: 'MED 2.0 | Conta Gerencial e OPEse', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '45', atividade: 'Preventivo com liquidação parcial', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '46', atividade: 'Pix Folha (Portabilidade de salário)', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '47', atividade: 'Automatização e Período de Observância CP Correntista', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '48', atividade: 'Consignado | Melhoria no processo de liberação de crédito', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '49', atividade: 'Ajuste descasamento contábil – Recargas e Gifts Card Epay', area: 'Conta Corrente', origem: 'Negócios', temaMacro: 'Outro', status: 'Backlog', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '50', atividade: 'Tagueamento Geolocalização', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Teste', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '51', atividade: 'Tagueamento Home Principal do APP', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Teste', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '52', atividade: 'Ajustes digitação nome', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '53', atividade: 'Mensagem Token SMS', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '54', atividade: 'Máscara para data de Nascimento', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '55', atividade: 'Personalization (InApp)​', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '56', atividade: 'SDK da Único', area: 'APP', origem: 'Projetos', temaMacro: 'Outro', status: 'Desenv. Técnico', descricao: '', resumoStatus: '', focal: '', prioridade: 'Médio', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '57', atividade: 'GDD Fase 2 - Observabilidade e indicadores Cadastrais', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Cancelado', descricao: '', resumoStatus: 'ROADMAP-2052', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '58', atividade: 'GDD Fase 2 - Qualificação e Guarda de Dados ECM e MDM | Discovery + Delivery Parcial', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Cancelado', descricao: '', resumoStatus: 'ROADMAP-2053', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '59', atividade: 'GDD Fase 2 - Trilha Cadastral', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'ROADMAP-2054', focal: 'Juliana', prioridade: 'Alto', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '60', atividade: 'GDD Fase 2 - Política de Expurgo de Dados', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'ROADMAP-2056', focal: 'Juliana', prioridade: 'Alto', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '61', atividade: 'GDD Fase 1 – Criação dos Kits de Formalização', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Refin. Técnico', descricao: '', resumoStatus: 'TPLAT-168', focal: 'Juliana', prioridade: 'Crítico', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '62', atividade: 'GDD Fase 1  – Visualizador de Kits de Formalização', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'ROADMAP-2403', focal: 'Juliana', prioridade: 'Crítico', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '63', atividade: 'GDD Fase 1 - Observabilidade e indicadores Documentais', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Cancelado', descricao: '', resumoStatus: 'ROADMAP-2404', focal: 'Juliana', prioridade: 'Crítico', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '64', atividade: 'GDD Fase 1 - Reutilização de Documentos Aprovados pela Mesa de Formalização', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Refin. Técnico', descricao: '', resumoStatus: 'TPLAT-177', focal: 'Juliana', prioridade: 'Crítico', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '65', atividade: 'GDD Fase 2 - Refatoração PEP', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Refin. Técnico', descricao: '', resumoStatus: 'TPLAT-180', focal: 'Guilherme', prioridade: 'Alto', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '66', atividade: 'GDD Fase 2 -  Inclusão de Situação do CPF no MDM', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Discovery', descricao: '', resumoStatus: 'TPLAT-182', focal: 'Juliana', prioridade: 'Alto', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '67', atividade: 'GDD Fase 2 - Padronização dos Dados Obrigatórios', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'BUTRANSAC-158', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '68', atividade: 'GDD Fase 2 - Equalização de Dados por Perfil', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'BUTRANSAC-156', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '69', atividade: 'GDD Fase 2 - Tratamento de dados nulos e vazios', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'BUTRANSAC-157', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '70', atividade: 'GDD Fase 2 - Armazenamento de validadores e verificadores no MDM', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'BUTRANSAC-159', focal: 'Juliana', prioridade: 'Baixo', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' },
    { id: '71', atividade: 'GDD Fase 2 - Expansão da extração de dados pessoais via OCR', area: 'Cadastro', origem: 'Projetos', temaMacro: 'GDD', status: 'Backlog', descricao: '', resumoStatus: 'TPLAT-178', focal: 'Juliana', prioridade: 'Crítico', dataLimite: '', dependencias: '', linkUX: '', linkRoadMap: '' }
  ]);

  const addTask = (setter: React.Dispatch<React.SetStateAction<Task[]>>, defaultStatus: TaskStatus = 'pending') => {
    const newTask: Task = {
      id: Date.now().toString(),
      status: defaultStatus,
      title: '',
      responsible: '',
    };
    setter(prev => [...prev, newTask]);
  };

  const updateTask = (setter: React.Dispatch<React.SetStateAction<Task[]>>, id: string, field: keyof Task, value: string) => {
    setter(prev => prev.map(task => task.id === id ? { ...task, [field]: value } : task));
  };

  const removeTask = (setter: React.Dispatch<React.SetStateAction<Task[]>>, id: string) => {
    setter(prev => prev.filter(task => task.id !== id));
  };

  const addFupItem = () => {
    const newItem: FupItem = {
      id: Date.now().toString(),
      atividade: '',
      area: 'APP',
      origem: 'Projetos',
      temaMacro: 'Outro',
      status: 'Backlog',
      descricao: '',
      resumoStatus: '',
      focal: '',
      prioridade: 'Médio',
      dataLimite: '',
      dependencias: '',
      linkUX: '',
      linkRoadMap: ''
    };
    setFupItems(prev => [...prev, newItem]);
  };

  const updateFupItem = (id: string, field: keyof FupItem, value: string) => {
    setFupItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      // Ao mudar status para 'UX', cria entrada na aba UX se ainda não existir
      if (field === 'status' && value === 'UX') {
        setUxItems(uxPrev => {
          const jaExiste = uxPrev.some(u => u.id === `fup-${id}`);
          if (jaExiste) return uxPrev;
          return [...uxPrev, {
            id: `fup-${id}`,
            tema: item.temaMacro,
            atividade: item.atividade,
            status: 'Backlog',
            prioridade: item.prioridade,
            dataInicio: '',
            dataEntrega: '',
          }];
        });
      }
      return updated;
    }));
  };

  const removeFupItem = (id: string) => {
    setFupItems(prev => prev.filter(item => item.id !== id));
  };

  const addPerformanceItem = () => {
    const newItem: PerformanceItem = {
      id: Date.now().toString(),
      temaMacro: 'Outro',
      origem: 'Performance',
      demanda: '',
      areaSolicitante: 'Performance',
      tipo: 'Roadmap',
      owner: '',
      dataSolicitacao: '',
      prazoInicio: '',
      prazoEntrega: '',
      status: 'Backlog',
      complexidade: 'Médio',
      impacto: 'Médio',
      descricao: '',
      resumoStatus: '',
      outputs: '',
      dependencias: ''
    };
    setPerformanceItems(prev => [...prev, newItem]);
  };

  const updatePerformanceItem = (id: string, field: keyof PerformanceItem, value: string) => {
    setPerformanceItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removePerformanceItem = (id: string) => {
    setPerformanceItems(prev => prev.filter(item => item.id !== id));
  };

  // Função para filtrar itens da FUP (memoizado para evitar recálculos)
  const fupItemsFiltrados = useMemo(() => {
    return fupItems.filter(item => {
      const matchAtividade = !filtroAtividade || item.atividade.toLowerCase().includes(filtroAtividade.toLowerCase());
      const matchArea = filtroArea.length === 0 || filtroArea.includes(item.area);
      const matchOrigem = filtroOrigem.length === 0 || filtroOrigem.includes(item.origem);
      const matchTemaMacro = filtroTemaMacro.length === 0 || filtroTemaMacro.includes(item.temaMacro);
      const matchStatus = filtroStatus.length === 0 || filtroStatus.includes(item.status as FupStatus);
      const matchPrioridade = filtroPrioridade.length === 0 || filtroPrioridade.includes(item.prioridade as Prioridade);
      const matchFocal = filtroFocal.length === 0 || filtroFocal.includes(item.focal);

      return matchAtividade && matchArea && matchOrigem && matchTemaMacro && matchStatus && matchPrioridade && matchFocal;
    });
  }, [fupItems, filtroAtividade, filtroArea, filtroOrigem, filtroTemaMacro, filtroStatus, filtroPrioridade, filtroFocal]);

  // Função para filtrar itens de Performance (memoizado para evitar recálculos)
  const performanceItemsFiltrados = useMemo(() => {
    return performanceItems.filter(item => {
      const matchTemaMacro = filtroTemaMacroPerformance.length === 0 || filtroTemaMacroPerformance.includes(item.temaMacro);
      const matchOrigem = filtroOrigemPerformance.length === 0 || filtroOrigemPerformance.includes(item.origem);
      const matchDemanda = !filtroDemanda || item.demanda.toLowerCase().includes(filtroDemanda.toLowerCase());
      const matchAreaSolicitante = filtroAreaSolicitante.length === 0 || filtroAreaSolicitante.includes(item.areaSolicitante);
      const matchTipo = filtroTipo.length === 0 || filtroTipo.includes(item.tipo);
      const matchOwner = filtroOwner.length === 0 || filtroOwner.includes(item.owner);
      const matchStatus = filtroStatusPerformance.length === 0 || filtroStatusPerformance.includes(item.status);
      const matchComplexidade = filtroComplexidade.length === 0 || filtroComplexidade.includes(item.complexidade as Complexidade);
      const matchImpacto = filtroImpacto.length === 0 || filtroImpacto.includes(item.impacto as Impacto);

      const isActive = !['Concluído', 'Cancelado'].includes(item.status);
      return isActive && matchTemaMacro && matchOrigem && matchDemanda && matchAreaSolicitante && matchTipo && matchOwner && matchStatus && matchComplexidade && matchImpacto;
    });
  }, [performanceItems, filtroTemaMacroPerformance, filtroOrigemPerformance, filtroDemanda, filtroAreaSolicitante, filtroTipo, filtroOwner, filtroStatusPerformance, filtroComplexidade, filtroImpacto]);

  const performanceItemsHistorico = useMemo(() => {
    return performanceItems.filter(item => ['Concluído', 'Cancelado'].includes(item.status));
  }, [performanceItems]);

  const limparFiltros = () => {
    setFiltroAtividade('');
    setFiltroArea([]);
    setFiltroOrigem([]);
    setFiltroTemaMacro([]);
    setFiltroStatus([]);
    setFiltroPrioridade([]);
    setFiltroFocal([]);
  };

  const restaurarDadosPadrao = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso vai RESTAURAR todos os dados para o estado original. Tem certeza?')) {
      return;
    }

    setIsLoading(true);

    // Recarregar TODOS os dados padrão
    window.location.reload();
  };

  const limparFiltrosPerformance = () => {
    setFiltroTemaMacroPerformance([]);
    setFiltroOrigemPerformance([]);
    setFiltroDemanda('');
    setFiltroAreaSolicitante([]);
    setFiltroTipo([]);
    setFiltroOwner([]);
    setFiltroStatusPerformance([]);
    setFiltroComplexidade([]);
    setFiltroImpacto([]);
  };

  const adicionarTemaMacro = (itemId?: string) => {
    const novoTema = prompt('Digite o nome do novo Tema Macro:');
    if (novoTema && novoTema.trim()) {
      const temaTrimmed = novoTema.trim();
      if (!temasMacro.includes(temaTrimmed)) {
        setTemasMacro(prev => [...prev, temaTrimmed]);
        // Se foi chamado de um item específico, atualiza esse item com o novo tema
        if (itemId) {
          updateFupItem(itemId, 'temaMacro', temaTrimmed);
        }
      } else {
        // Se o tema já existe e foi chamado de um item específico, atualiza o item
        if (itemId) {
          updateFupItem(itemId, 'temaMacro', temaTrimmed);
        }
      }
    }
  };

  const removerTemaMacro = (tema: string) => {
    if (confirm(`Deseja realmente remover o tema "${tema}"? Todos os itens com este tema serão atualizados para "Outro".`)) {
      // Remove o tema da lista
      setTemasMacro(prev => prev.filter(t => t !== tema));
      // Atualiza todos os itens FUP que usam este tema para "Outro"
      setFupItems(prev => prev.map(item =>
        item.temaMacro === tema ? { ...item, temaMacro: 'Outro' } : item
      ));
      // Limpa o filtro se estava usando este tema
      if (filtroTemaMacro === tema) {
        setFiltroTemaMacro('');
      }
    }
  };

  // Funções para Performance - Tema Macro
  const adicionarTemaMacroPerformance = (itemId?: string) => {
    const novoTema = prompt('Digite o nome do novo Tema Macro:');
    if (novoTema && novoTema.trim()) {
      const temaTrimmed = novoTema.trim();
      if (!temasMacroPerformance.includes(temaTrimmed)) {
        setTemasMacroPerformance(prev => [...prev, temaTrimmed]);
        // Se foi chamado de um item específico, atualiza esse item com o novo tema
        if (itemId) {
          updatePerformanceItem(itemId, 'temaMacro', temaTrimmed);
        }
      } else {
        // Se o tema já existe e foi chamado de um item específico, atualiza o item
        if (itemId) {
          updatePerformanceItem(itemId, 'temaMacro', temaTrimmed);
        }
      }
    }
  };

  const removerTemaMacroPerformance = (tema: string) => {
    if (confirm(`Deseja realmente remover o tema "${tema}"? Todos os itens com este tema serão atualizados para "Outro".`)) {
      // Remove o tema da lista
      setTemasMacroPerformance(prev => prev.filter(t => t !== tema));
      // Atualiza todos os itens Performance que usam este tema para "Outro"
      setPerformanceItems(prev => prev.map(item =>
        item.temaMacro === tema ? { ...item, temaMacro: 'Outro' } : item
      ));
      // Limpa o filtro se estava usando este tema
      if (filtroTemaMacroPerformance === tema) {
        setFiltroTemaMacroPerformance('');
      }
    }
  };

  // Funções para Performance - Origem
  const adicionarOrigemPerformance = (itemId?: string) => {
    const novaOrigem = prompt('Digite o nome da nova Origem:');
    if (novaOrigem && novaOrigem.trim()) {
      const origemTrimmed = novaOrigem.trim();
      if (!origensPerformance.includes(origemTrimmed)) {
        setOrigensPerformance(prev => [...prev, origemTrimmed]);
        // Se foi chamado de um item específico, atualiza esse item com a nova origem
        if (itemId) {
          updatePerformanceItem(itemId, 'origem', origemTrimmed);
        }
      } else {
        // Se a origem já existe e foi chamado de um item específico, atualiza o item
        if (itemId) {
          updatePerformanceItem(itemId, 'origem', origemTrimmed);
        }
      }
    }
  };

  const removerOrigemPerformance = (origem: string) => {
    if (confirm(`Deseja realmente remover a origem "${origem}"? Todos os itens com esta origem serão atualizados para "Performance".`)) {
      // Remove a origem da lista
      setOrigensPerformance(prev => prev.filter(o => o !== origem));
      // Atualiza todos os itens Performance que usam esta origem para "Performance"
      setPerformanceItems(prev => prev.map(item =>
        item.origem === origem ? { ...item, origem: 'Performance' } : item
      ));
      // Limpa o filtro se estava usando esta origem
      if (filtroOrigemPerformance === origem) {
        setFiltroOrigemPerformance('');
      }
    }
  };

  const adicionarOrigem = (itemId?: string) => {
    const novaOrigem = prompt('Digite o nome da nova Origem:');
    if (novaOrigem && novaOrigem.trim()) {
      const origemTrimmed = novaOrigem.trim();
      if (!origens.includes(origemTrimmed)) {
        setOrigens(prev => [...prev, origemTrimmed]);
        // Se foi chamado de um item específico, atualiza esse item com a nova origem
        if (itemId) {
          updateFupItem(itemId, 'origem', origemTrimmed);
        }
      } else {
        // Se a origem já existe e foi chamado de um item específico, atualiza o item
        if (itemId) {
          updateFupItem(itemId, 'origem', origemTrimmed);
        }
      }
    }
  };

  const removerOrigem = (origem: string) => {
    if (confirm(`Deseja realmente remover a origem "${origem}"? Todos os itens com esta origem serão atualizados para "Negócios".`)) {
      // Remove a origem da lista
      setOrigens(prev => prev.filter(o => o !== origem));
      // Atualiza todos os itens que usam esta origem para "Negócios"
      setFupItems(prev => prev.map(item =>
        item.origem === origem ? { ...item, origem: 'Negócios' } : item
      ));
      // Limpa o filtro se estava usando esta origem
      if (filtroOrigem === origem) {
        setFiltroOrigem('');
      }
    }
  };

  // Funções para Performance - Área Solicitante
  const adicionarAreaSolicitante = (itemId?: string) => {
    const novaArea = prompt('Digite o nome da nova Área Solicitante:');
    if (novaArea && novaArea.trim()) {
      const areaTrimmed = novaArea.trim();
      if (!areasSolicitantes.includes(areaTrimmed)) {
        setAreasSolicitantes(prev => [...prev, areaTrimmed]);
        if (itemId) {
          updatePerformanceItem(itemId, 'areaSolicitante', areaTrimmed);
        }
      } else {
        if (itemId) {
          updatePerformanceItem(itemId, 'areaSolicitante', areaTrimmed);
        }
      }
    }
  };

  const removerAreaSolicitante = (area: string) => {
    if (confirm(`Deseja realmente remover a área "${area}"? Todos os itens com esta área serão atualizados para "Performance".`)) {
      setAreasSolicitantes(prev => prev.filter(a => a !== area));
      setPerformanceItems(prev => prev.map(item =>
        item.areaSolicitante === area ? { ...item, areaSolicitante: 'Performance' } : item
      ));
      if (filtroAreaSolicitante === area) {
        setFiltroAreaSolicitante('');
      }
    }
  };

  // Funções para Performance - Tipo
  const adicionarTipo = (itemId?: string) => {
    const novoTipo = prompt('Digite o nome do novo Tipo:');
    if (novoTipo && novoTipo.trim()) {
      const tipoTrimmed = novoTipo.trim();
      if (!tipos.includes(tipoTrimmed)) {
        setTipos(prev => [...prev, tipoTrimmed]);
        if (itemId) {
          updatePerformanceItem(itemId, 'tipo', tipoTrimmed);
        }
      } else {
        if (itemId) {
          updatePerformanceItem(itemId, 'tipo', tipoTrimmed);
        }
      }
    }
  };

  const removerTipo = (tipo: string) => {
    if (confirm(`Deseja realmente remover o tipo "${tipo}"? Todos os itens com este tipo serão atualizados para "Roadmap".`)) {
      setTipos(prev => prev.filter(t => t !== tipo));
      setPerformanceItems(prev => prev.map(item =>
        item.tipo === tipo ? { ...item, tipo: 'Roadmap' } : item
      ));
      if (filtroTipo === tipo) {
        setFiltroTipo('');
      }
    }
  };

  // Snapshot da última versão persistida dos fupItems (id → JSON) para o
  // diff-sync com a tabela fup_items (fonte de verdade no banco)
  const lastFupRef = useRef<Map<string, string>>(new Map());
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(id);

  // Normaliza para o dicionário oficial antes de gravar no banco
  // (o status interno 'UX' não existe no dicionário → 'Desenv. UX')
  const toRow = (item: FupItem) => {
    const row = fupToRow(item as any);
    if ((item.status as string) === 'UX') row.status = 'Desenv. UX';
    return row;
  };

  // Salvar: estado auxiliar → kv_store · fupItems → diff-sync na tabela
  const saveDataToSupabase = async () => {
    try {
      setIsSaving(true);
      // 1) Dados auxiliares no kv (SEM fupItems — a tabela é a fonte de verdade)
      await api.kvSet(KV_KEY, {
        performanceItems, kpis, temasMacro, origens,
        temasMacroPerformance, origensPerformance, areasSolicitantes,
        tipos, impedimentosTasks, uxItems
      });
      // 2) Diff-sync dos projetos com a tabela fup_items
      const prev = lastFupRef.current;
      const nextIds = new Set(fupItems.map(i => i.id));
      for (const item of fupItems) {
        const snap = JSON.stringify(item);
        if (!prev.has(item.id)) {
          if (isUuid(item.id)) { prev.set(item.id, snap); continue; } // veio do banco
          const created = await api.fupInsert(toRow(item));           // novo (id local)
          prev.delete(item.id);
          prev.set(created.id, JSON.stringify({ ...item, id: created.id }));
          setFupItems(ps => ps.map(p => p.id === item.id ? { ...p, id: created.id } : p));
        } else if (prev.get(item.id) !== snap) {
          await api.fupUpdate(item.id, toRow(item));
          prev.set(item.id, snap);
        }
      }
      const removidos = [...prev.keys()].filter(id => !nextIds.has(id));
      for (const id of removidos) { await api.fupDelete(id); prev.delete(id); }
      onDataChanged?.();
      console.log('✅ Dados salvos no banco');
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Carregar do banco: fup_items (fonte de verdade) + kv 'dashboard-data'
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [rows, savedData] = await Promise.all([api.fupList(), api.kvGet(KV_KEY)]);
        const items = (rows ?? []).map(rowToFup) as unknown as FupItem[];
        setFupItems(items);
        lastFupRef.current = new Map(items.map(i => [i.id, JSON.stringify(i)]));
        if (savedData) {
          if (savedData.performanceItems?.length > 0) setPerformanceItems(savedData.performanceItems);
          if (savedData.kpis) setKpis(savedData.kpis);
          if (savedData.temasMacro) setTemasMacro(savedData.temasMacro);
          if (savedData.origens) setOrigens(savedData.origens);
          if (savedData.temasMacroPerformance) setTemasMacroPerformance(savedData.temasMacroPerformance);
          if (savedData.origensPerformance) setOrigensPerformance(savedData.origensPerformance);
          if (savedData.areasSolicitantes) setAreasSolicitantes(savedData.areasSolicitantes);
          if (savedData.tipos) setTipos(savedData.tipos);
          if (savedData.impedimentosTasks) setImpedimentosTasks(savedData.impedimentosTasks);
          if (savedData.uxItems) setUxItems(savedData.uxItems);
        }
        console.log('✅ Dados carregados do banco');
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Salvar automaticamente com debounce (espera 1 segundo após a última alteração)
  useEffect(() => {
    if (isLoading) return; // Não salvar durante o carregamento inicial

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDataToSupabase();
    }, 1000); // 1 segundo de delay

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fupItems, performanceItems, uxItems, kpis, temasMacro, origens, temasMacroPerformance, origensPerformance, areasSolicitantes, tipos, impedimentosTasks, isLoading]);

  const exportToExcel = () => {
    let data: any[] = [];
    let headers: string[] = [];
    let filename = '';

    if (activeTab === 'projetos' || activeTab === 'historico') {
      const itemsToExport = activeTab === 'projetos'
        ? fupItems.filter(item => !['Concluído', 'Cancelado'].includes(item.status))
        : fupItems.filter(item => ['Concluído', 'Cancelado'].includes(item.status));

      headers = ['Atividade', 'Área', 'Origem', 'Tema Macro', 'Status', 'Descrição', 'Resumo Status', 'Focal', 'Prioridade', 'Data Limite', 'Dependências', 'Link UX', 'Link RoadMap'];
      data = itemsToExport.map(item => [
        item.atividade,
        item.area,
        item.origem,
        item.temaMacro,
        item.status,
        item.descricao,
        item.resumoStatus,
        item.focal,
        item.prioridade,
        item.dataLimite,
        item.dependencias,
        item.linkUX,
        item.linkRoadMap
      ]);
      filename = activeTab === 'projetos' ? 'Projetos.csv' : 'Historico_Projetos.csv';
    } else if (activeTab === 'performance') {
      headers = ['Tema Macro', 'Origem', 'Demanda', 'Área Solicitante', 'Tipo', 'Owner', 'Data Solicitação', 'Prazo Início', 'Prazo Entrega', 'Status', 'Complexidade', 'Impacto', 'Descrição', 'Resumo Status', 'Outputs', 'Dependências'];
      data = performanceItemsFiltrados.map(item => [
        item.temaMacro,
        item.origem,
        item.demanda,
        item.areaSolicitante,
        item.tipo,
        item.owner,
        item.dataSolicitacao,
        item.prazoInicio,
        item.prazoEntrega,
        item.status,
        item.complexidade,
        item.impacto,
        item.descricao,
        item.resumoStatus,
        item.outputs,
        item.dependencias
      ]);
      filename = 'Performance.csv';
    }

    const csvContent = [
      headers.join(';'),
      ...data.map(row => row.map((cell: string) => `"${cell || ''}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const itemsFiltrados = fupItems.filter(item => {
      const matchAtividade = !filtroAtividade || item.atividade.toLowerCase().includes(filtroAtividade.toLowerCase());
      const matchArea = filtroArea.length === 0 || filtroArea.includes(item.area as Area);
      const matchOrigem = filtroOrigem.length === 0 || filtroOrigem.includes(item.origem);
      const matchTemaMacro = filtroTemaMacro.length === 0 || filtroTemaMacro.includes(item.temaMacro);
      const matchStatus = filtroStatus.length === 0 || filtroStatus.includes(item.status as FupStatus);
      const matchPrioridade = filtroPrioridade.length === 0 || filtroPrioridade.includes(item.prioridade as Prioridade);
      const matchFocal = filtroFocal.length === 0 || filtroFocal.includes(item.focal);
      return matchAtividade && matchArea && matchOrigem && matchTemaMacro && matchStatus && matchPrioridade && matchFocal;
    });

    const cadastroItems = itemsFiltrados
      .filter(item => item.area === 'Cadastro')
      .map((item) => ({
        id: `cad-${item.id}`,
        status: mapFupStatusToTaskStatus(item.status),
        title: item.atividade,
        responsible: item.focal || 'A definir'
      }));

    const contaCorrenteItems = itemsFiltrados
      .filter(item => item.area === 'Conta Corrente')
      .map((item) => ({
        id: `cc-${item.id}`,
        status: mapFupStatusToTaskStatus(item.status),
        title: item.atividade,
        responsible: item.focal || 'A definir'
      }));

    const appItems = itemsFiltrados
      .filter(item => item.area === 'APP')
      .map((item) => ({
        id: `app-${item.id}`,
        status: mapFupStatusToTaskStatus(item.status),
        title: item.atividade,
        responsible: item.focal || 'A definir'
      }));

    setCadastroTasks(cadastroItems);
    setContaCorrenteTasks(contaCorrenteItems);
    setAppEstruturalTasks(appItems);
  }, [fupItems, filtroAtividade, filtroArea, filtroOrigem, filtroTemaMacro, filtroStatus, filtroPrioridade, filtroFocal]);

  // Calcular métricas baseadas nos dados da FUP (usando dados filtrados para as verticais, mas total geral para cards)
  const totalTarefas = fupItems.filter(item => !['Concluído', 'Cancelado'].includes(item.status)).length
    + performanceItems.filter(item => !['Concluído', 'Cancelado'].includes(item.status)).length;
  const concluidas = fupItems.filter(item => item.status === 'Concluído').length
    + performanceItems.filter(item => item.status === 'Concluído').length;
  const excluirEmAndamento = ['Backlog', 'Bloqueado', 'Pausado', 'Concluído', 'Cancelado'];
  const emAndamento = fupItems.filter(item => !excluirEmAndamento.includes(item.status)).length
    + performanceItems.filter(item => !['Backlog', 'Pausado', 'Concluído', 'Cancelado'].includes(item.status)).length;
  const atrasadas = fupItems.filter(item => {
    if (!item.dataLimite) return false;
    const dataLimite = new Date(item.dataLimite);
    const hoje = new Date();
    return dataLimite < hoje && item.status !== 'Concluído';
  }).length;

  // Dados do gráfico de pizza (status)
  const totalValido = fupItems.length || 1;
  const pieData = [
    { name: 'Concluído', value: Math.round((concluidas / totalValido) * 100), color: '#10b981' },
    { name: 'Em Andamento', value: Math.round((emAndamento / totalValido) * 100), color: '#3b82f6' },
    { name: 'Pendente', value: Math.round(((totalTarefas - concluidas - emAndamento) / totalValido) * 100), color: '#f59e0b' }
  ];


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-50 p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg mb-2 flex justify-between items-center shrink-0">
        <div>
          <p className="text-[9px] text-blue-100">Cadastro, Conta Corrente e APP Estrutural</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isSaving ? (
              <>
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold">Salvando...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs font-semibold">Salvo ✓</span>
              </>
            )}
          </div>
          <div className="text-right">
            <p className="text-[9px] text-blue-100">Atualizado em</p>
            <p className="text-xs font-semibold">03/06/2026</p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mb-2 shrink-0">
        <div className="grid grid-cols-4 gap-4 w-full">
          <MetricCard icon={<ClipboardList />} value={totalTarefas.toString()} label="Total de Tarefas" color="bg-blue-500" />
          <MetricCard icon={<CheckCircle2 />} value={concluidas.toString()} label="Concluídas" color="bg-green-500" />
          <MetricCard icon={<Clock />} value={emAndamento.toString()} label="Em Andamento" color="bg-orange-500" />
          <MetricCard icon={<AlertCircle />} value={atrasadas.toString()} label="Atrasadas" color="bg-red-500" />
        </div>
      </div>

      <div className="flex justify-center">
        {/* Centralized Charts Container */}
        <div className="w-full max-w-4xl grid grid-cols-2 gap-4">
          {/* Status Geral */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Status Geral
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setStatusGeralTab('projetos')}
                  className={`px-2 py-1 text-[10px] rounded transition-all ${
                    statusGeralTab === 'projetos'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Projetos
                </button>
                <button
                  onClick={() => setStatusGeralTab('performance')}
                  className={`px-2 py-1 text-[10px] rounded transition-all ${
                    statusGeralTab === 'performance'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Performance
                </button>
              </div>
            </div>

            {statusGeralTab === 'projetos' ? (
              <div className="space-y-3">
                {/* Gráfico de Status */}
                <div>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span>{item.name}</span>
                        </div>
                        <span className="font-semibold">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prioridades */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] font-semibold mb-1.5 text-gray-700">Prioridades</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-red-50 p-1.5 rounded">
                      <div className="text-[9px] text-gray-600">Crítico</div>
                      <div className="text-sm font-bold text-red-600">
                        {fupItems.filter(i => i.prioridade === 'Crítico' && !['Concluído', 'Cancelado'].includes(i.status)).length}
                      </div>
                    </div>
                    <div className="bg-orange-50 p-1.5 rounded">
                      <div className="text-[9px] text-gray-600">Alto</div>
                      <div className="text-sm font-bold text-orange-600">
                        {fupItems.filter(i => i.prioridade === 'Alto' && !['Concluído', 'Cancelado'].includes(i.status)).length}
                      </div>
                    </div>
                    <div className="bg-yellow-50 p-1.5 rounded">
                      <div className="text-[9px] text-gray-600">Médio</div>
                      <div className="text-sm font-bold text-yellow-700">
                        {fupItems.filter(i => i.prioridade === 'Médio' && !['Concluído', 'Cancelado'].includes(i.status)).length}
                      </div>
                    </div>
                    <div className="bg-blue-50 p-1.5 rounded">
                      <div className="text-[9px] text-gray-600">Baixo</div>
                      <div className="text-sm font-bold text-blue-600">
                        {fupItems.filter(i => i.prioridade === 'Baixo' && !['Concluído', 'Cancelado'].includes(i.status)).length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Status Performance */}
                <div>
                  <div className="text-[10px] font-semibold mb-2 text-gray-700">Status das Demandas</div>
                  <div className="space-y-1.5">
                    {['Andamento', 'Backlog'].map(status => {
                      const count = performanceItems.filter(i => i.status.toLowerCase().includes(status.toLowerCase())).length;
                      const total = performanceItems.length || 1;
                      const percentage = Math.round((count / total) * 100);
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span>{status}</span>
                            <span className="font-semibold">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${status === 'Andamento' ? 'bg-blue-500' : 'bg-gray-500'}`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Complexidade vs Impacto */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] font-semibold mb-1.5 text-gray-700">Complexidade</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Alto', 'Médio', 'Baixo'].map(nivel => (
                      <div key={nivel} className={`${nivel === 'Alto' ? 'bg-red-50' : nivel === 'Médio' ? 'bg-yellow-50' : 'bg-green-50'} p-1.5 rounded`}>
                        <div className="text-[9px] text-gray-600">{nivel}</div>
                        <div className={`text-sm font-bold ${nivel === 'Alto' ? 'text-red-600' : nivel === 'Médio' ? 'text-yellow-700' : 'text-green-600'}`}>
                          {performanceItems.filter(i => i.complexidade === nivel).length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] font-semibold mb-1.5 text-gray-700">Impacto</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Alto', 'Médio', 'Baixo'].map(nivel => (
                      <div key={nivel} className={`${nivel === 'Alto' ? 'bg-red-50' : nivel === 'Médio' ? 'bg-yellow-50' : 'bg-green-50'} p-1.5 rounded`}>
                        <div className="text-[9px] text-gray-600">{nivel}</div>
                        <div className={`text-sm font-bold ${nivel === 'Alto' ? 'text-red-600' : nivel === 'Médio' ? 'text-yellow-700' : 'text-green-600'}`}>
                          {performanceItems.filter(i => i.impacto === nivel).length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tipos */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-[10px] font-semibold mb-1.5 text-gray-700">Tipos de Demanda</div>
                  <div className="space-y-1">
                    {tipos.map(tipo => (
                      <div key={tipo} className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-600">{tipo}</span>
                        <span className="font-bold text-purple-600">
                          {performanceItems.filter(i => i.tipo === tipo).length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Report */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold mb-3">Status Report</h3>
            <div className="space-y-3">
              {['Cadastro', 'Conta Corrente', 'APP'].map((area) => {
                const areaItems = fupItems.filter(item => item.area === area);
                const statusCounts = {
                  total: areaItems.length,
                  backlog: areaItems.filter(i => i.status === 'Backlog').length,
                  emAndamento: areaItems.filter(i => ['Discovery', 'Desenv. UX', 'Desenv. Técnico', 'Teste'].includes(i.status)).length,
                  bloqueado: areaItems.filter(i => i.status === 'Bloqueado').length,
                  concluido: areaItems.filter(i => i.status === 'Concluído').length,
                };

                return (
                  <div key={area} className="border border-gray-200 rounded-lg p-2">
                    <h5 className="font-semibold text-xs mb-2">{area}</h5>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      <div className="bg-gray-100 p-1 rounded text-center">
                        <div className="font-bold text-sm">{statusCounts.backlog}</div>
                        <div className="text-gray-600 text-[9px]">Backlog</div>
                      </div>
                      <div className="bg-blue-100 p-1 rounded text-center">
                        <div className="font-bold text-sm">{statusCounts.emAndamento}</div>
                        <div className="text-gray-600 text-[9px]">Em Andamento</div>
                      </div>
                      <div className="bg-red-100 p-1 rounded text-center">
                        <div className="font-bold text-sm">{statusCounts.bloqueado}</div>
                        <div className="text-gray-600 text-[9px]">Bloqueado</div>
                      </div>
                      <div className="bg-green-100 p-1 rounded text-center">
                        <div className="font-bold text-sm">{statusCounts.concluido}</div>
                        <div className="text-gray-600 text-[9px]">Concluído</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] mb-1">
                        <span>Progresso</span>
                        <span className="font-semibold">{Math.round((statusCounts.concluido / statusCounts.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.round((statusCounts.concluido / statusCounts.total) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximas Entregas */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold mb-3">📅 Próximas Entregas</h3>
            <div className="space-y-2">
              <DeliveryItem date="28/05" title="Release Cadastro v2.0" />
              <DeliveryItem date="02/06" title="Dashboard Conta Corrente" />
              <DeliveryItem date="10/06" title="Migração Microserviços" />
            </div>
          </div>

          {/* KPIs */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">📊 Marcos da Semana</h3>
              {!editandoKpis && (
                <button
                  onClick={iniciarEdicaoKpis}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-100 rounded"
                  title="Editar KPIs"
                >
                  <Pencil className="w-3 h-3 text-blue-600" />
                </button>
              )}
            </div>
            {editandoKpis ? (
              <div className="space-y-3">
                {kpisTemp.map((kpi) => (
                  <div key={kpi.id} className="border border-gray-200 rounded p-2 space-y-2">
                    <input
                      type="text"
                      value={kpi.label}
                      onChange={(e) => atualizarKpiTemp(kpi.id, 'label', e.target.value)}
                      placeholder="Nome do KPI"
                      className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={kpi.value}
                      onChange={(e) => atualizarKpiTemp(kpi.id, 'value', e.target.value)}
                      placeholder="Valor"
                      className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={kpi.trend}
                      onChange={(e) => atualizarKpiTemp(kpi.id, 'trend', e.target.value)}
                      className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="up">Tendência Positiva ↗</option>
                      <option value="down">Tendência Negativa ↘</option>
                    </select>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={salvarKpis}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded transition-colors"
                  >
                    Postar
                  </button>
                  <button
                    onClick={cancelarEdicaoKpis}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xs font-semibold px-3 py-2 rounded transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <KpiItem key={kpi.id} label={kpi.label} value={kpi.value} trend={kpi.trend} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FUP Vertical Section */}
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-lg border-2 border-blue-200 p-6">
        {/* Title and Tabs */}
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-blue-900 tracking-tight mb-4">FUP Vertical - Cadastro / APP Estrutural e Conta Corrente</h2>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('projetos')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'projetos'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Projetos
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'performance'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Performance
              </button>
              <button
                onClick={() => setActiveTab('ux')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'ux'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                UX
              </button>
              <button
                onClick={() => setActiveTab('status-report')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'status-report'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Status Report
              </button>
              <button
                onClick={() => setActiveTab('historico')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'historico'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Histórico
              </button>
            </div>
            <div className="flex items-center gap-2">
              {activeTab !== 'status-report' && activeTab !== 'historico' && (
                <button
                  onClick={activeTab === 'projetos' || activeTab === 'historico' ? addFupItem : activeTab === 'ux' ? () => setUxItems(prev => [...prev, { id: Date.now().toString(), tema: '', atividade: '', status: 'Backlog', prioridade: 'Médio', dataInicio: '', dataEntrega: '' }]) : addPerformanceItem}
                  className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-xl transform hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Item
                </button>
              )}
              {(activeTab === 'projetos' || activeTab === 'historico' || activeTab === 'performance' || activeTab === 'ux') && (
                <button
                  onClick={() => exportToExcel()}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-xl transform hover:scale-105"
                >
                  Exportar Excel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Projetos Table */}
        {activeTab === 'projetos' && (
          <div className="overflow-x-auto rounded-xl border-2 border-gray-300 shadow-inner bg-white">
            {/* Barra de Filtros */}
            <div className="bg-blue-100 p-3 border-b-2 border-blue-300 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-blue-900">Filtros:</span>

              <input
                type="text"
                placeholder="Buscar atividade..."
                value={filtroAtividade}
                onChange={(e) => setFiltroAtividade(e.target.value)}
                className="text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <MultiSelectFilter
                selected={filtroArea}
                onChange={(v) => setFiltroArea(v as Area[])}
                options={['APP', 'Cadastro', 'Conta Corrente']}
                placeholder="Todas as Áreas"
              />

              <MultiSelectFilter
                selected={filtroOrigem}
                onChange={setFiltroOrigem}
                options={origens}
                placeholder="Todas as Origens"
              />

              <MultiSelectFilter
                selected={filtroTemaMacro}
                onChange={setFiltroTemaMacro}
                options={temasMacro}
                placeholder="Todos os Temas Macro"
              />

              <MultiSelectFilter
                selected={filtroStatus}
                onChange={setFiltroStatus}
                options={['Backlog','Discovery','Handover','Refin. Técnico','Desenv. UX','Desenv. Técnico','Teste','Pausado','Bloqueado','Concluído','Cancelado']}
                placeholder="Todos os Status"
                colorMap={{
                  'Backlog': 'bg-gray-500 text-white',
                  'Discovery': 'bg-purple-500 text-white',
                  'Handover': 'bg-blue-400 text-white',
                  'Refin. Técnico': 'bg-cyan-500 text-white',
                  'Desenv. UX': 'bg-pink-500 text-white',
                  'Desenv. Técnico': 'bg-orange-500 text-white',
                  'Teste': 'bg-yellow-500 text-white',
                  'Concluído': 'bg-green-600 text-white',
                  'Pausado': 'bg-yellow-600 text-white',
                  'Cancelado': 'bg-red-600 text-white',
                  'Bloqueado': 'bg-red-500 text-white',
                }}
              />

              <MultiSelectFilter
                selected={filtroPrioridade}
                onChange={(v) => setFiltroPrioridade(v as Prioridade[])}
                options={['Baixo', 'Médio', 'Alto', 'Crítico']}
                placeholder="Todas as Prioridades"
                colorMap={{
                  'Baixo': 'bg-blue-500 text-white',
                  'Médio': 'bg-yellow-500 text-white',
                  'Alto': 'bg-orange-500 text-white',
                  'Crítico': 'bg-red-500 text-white',
                }}
              />

              <MultiSelectFilter
                selected={filtroFocal}
                onChange={setFiltroFocal}
                options={['Maiune','Luke','Juliana','Cristiane','Felipe','Dionathan','Guilherme','Leticia','Bruno','Pedro','Welligton']}
                placeholder="Todos os Focais"
              />

              <button
                onClick={limparFiltros}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded font-semibold transition-colors"
              >
                Limpar Filtros
              </button>

              <span className="text-xs text-blue-700 font-semibold ml-auto">
                {fupItemsFiltrados.filter(item => !['Concluído', 'Cancelado'].includes(item.status)).length} de {fupItems.filter(item => !['Concluído', 'Cancelado'].includes(item.status)).length} itens
              </span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-700 to-blue-600 text-white text-xs font-bold">
                  <th className="sticky left-0 z-20 bg-blue-700 border-r border-blue-500 p-2 min-w-[150px] text-center shadow-[2px_0_4px_rgba(0,0,0,0.15)]">Tema Macro</th>
                  <th className="sticky left-[150px] z-20 bg-blue-700 border-r border-blue-500 p-2 min-w-[220px] text-center shadow-[2px_0_4px_rgba(0,0,0,0.15)]">Atividade</th>
                  <th className="border-r border-blue-500 p-2 min-w-[120px] text-center">Prioridade</th>
                  <th className="border-r border-blue-500 p-2 min-w-[130px] text-center">Data Limite</th>
                  <th className="border-r border-blue-500 p-2 min-w-[120px] text-center">Focal</th>
                  <th className="border-r border-blue-500 p-2 min-w-[140px] text-center">Status</th>
                  <th className="border-r border-blue-500 p-2 min-w-[250px] text-center">Descrição</th>
                  <th className="border-r border-blue-500 p-2 min-w-[250px] text-center">Resumo Status</th>
                  <th className="border-r border-blue-500 p-2 min-w-[120px] text-center">Área</th>
                  <th className="border-r border-blue-500 p-2 min-w-[150px] text-center">Origem</th>
                  <th className="border-r border-blue-500 p-2 min-w-[200px] text-center">Dependências</th>
                  <th className="border-r border-blue-500 p-2 min-w-[150px] text-center">Link UX</th>
                  <th className="border-r border-blue-500 p-2 min-w-[150px] text-center">Link RoadMap</th>
                  <th className="p-2 text-center min-w-[60px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fupItemsFiltrados.filter(item => !['Concluído', 'Cancelado'].includes(item.status)).map((item, index) => (
                  <FupTableRow
                    key={item.id}
                    item={item}
                    onUpdate={updateFupItem}
                    onRemove={removeFupItem}
                    isEven={index % 2 === 0}
                    temasMacro={temasMacro}
                    origens={origens}
                    onAdicionarTemaMacro={adicionarTemaMacro}
                    onRemoverTemaMacro={removerTemaMacro}
                    onAdicionarOrigem={adicionarOrigem}
                    onRemoverOrigem={removerOrigem}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Histórico Table */}
        {activeTab === 'historico' && (
          <div className="overflow-x-auto rounded-xl border-2 border-gray-300 shadow-inner bg-white">
            {/* Barra de Filtros */}
            <div className="bg-gray-100 p-3 border-b-2 border-gray-300 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-gray-900">Filtros:</span>

              <input
                type="text"
                placeholder="Buscar atividade..."
                value={filtroAtividade}
                onChange={(e) => setFiltroAtividade(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-500"
              />

              <MultiSelectFilter
                selected={filtroArea}
                onChange={(v) => setFiltroArea(v as Area[])}
                options={['APP', 'Cadastro', 'Conta Corrente']}
                placeholder="Todas as Áreas"
              />

              <MultiSelectFilter
                selected={filtroOrigem}
                onChange={setFiltroOrigem}
                options={origens}
                placeholder="Todas as Origens"
              />

              <MultiSelectFilter
                selected={filtroTemaMacro}
                onChange={setFiltroTemaMacro}
                options={temasMacro}
                placeholder="Todos os Temas Macro"
              />

              <button
                onClick={limparFiltros}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded font-semibold transition-colors"
              >
                Limpar Filtros
              </button>

              <span className="text-xs text-gray-700 font-semibold ml-auto">
                {fupItemsFiltrados.filter(item => ['Concluído', 'Cancelado'].includes(item.status)).length} projetos + {performanceItemsHistorico.length} performance arquivados
              </span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-gray-700 to-gray-600 text-white text-xs font-bold">
                  <th className="border-r border-gray-500 p-2 min-w-[150px] text-center">Tema Macro</th>
                  <th className="border-r border-gray-500 p-2 min-w-[200px] text-center">Atividade</th>
                  <th className="border-r border-gray-500 p-2 min-w-[120px] text-center">Área</th>
                  <th className="border-r border-gray-500 p-2 min-w-[150px] text-center">Origem</th>
                  <th className="border-r border-gray-500 p-2 min-w-[140px] text-center">Status</th>
                  <th className="border-r border-gray-500 p-2 min-w-[250px] text-center">Descrição</th>
                  <th className="border-r border-gray-500 p-2 min-w-[250px] text-center">Resumo Status</th>
                  <th className="border-r border-gray-500 p-2 min-w-[120px] text-center">Focal</th>
                  <th className="border-r border-gray-500 p-2 min-w-[120px] text-center">Prioridade</th>
                  <th className="border-r border-gray-500 p-2 min-w-[130px] text-center">Data Limite</th>
                  <th className="border-r border-gray-500 p-2 min-w-[200px] text-center">Dependências</th>
                  <th className="border-r border-gray-500 p-2 min-w-[150px] text-center">Link UX</th>
                  <th className="border-r border-gray-500 p-2 min-w-[150px] text-center">Link RoadMap</th>
                  <th className="p-2 text-center min-w-[60px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fupItemsFiltrados.filter(item => ['Concluído', 'Cancelado'].includes(item.status)).map((item, index) => (
                  <FupTableRow
                    key={item.id}
                    item={item}
                    onUpdate={updateFupItem}
                    onRemove={removeFupItem}
                    isEven={index % 2 === 0}
                    temasMacro={temasMacro}
                    origens={origens}
                    onAdicionarTemaMacro={adicionarTemaMacro}
                    onRemoverTemaMacro={removerTemaMacro}
                    onAdicionarOrigem={adicionarOrigem}
                    onRemoverOrigem={removerOrigem}
                  />
                ))}
              </tbody>
            </table>

            {/* Performance Histórico */}
            {performanceItemsHistorico.length > 0 && (
              <div className="mt-6">
                <div className="bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-t-lg flex items-center gap-2">
                  <span>Performance — Concluído / Cancelado</span>
                  <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-[10px]">{performanceItemsHistorico.length}</span>
                </div>
                <div className="overflow-x-auto border-2 border-purple-300 rounded-b-lg">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-purple-100 text-purple-900 text-xs font-bold">
                        <th className="border-r border-purple-200 p-2 min-w-[150px] text-center">Tema Macro</th>
                        <th className="border-r border-purple-200 p-2 min-w-[250px] text-center">Demanda</th>
                        <th className="border-r border-purple-200 p-2 min-w-[120px] text-center">Owner</th>
                        <th className="border-r border-purple-200 p-2 min-w-[120px] text-center">Status</th>
                        <th className="border-r border-purple-200 p-2 min-w-[140px] text-center">Prazo de entrega</th>
                        <th className="border-r border-purple-200 p-2 min-w-[250px] text-center">Resumo Status</th>
                        <th className="border-r border-purple-200 p-2 min-w-[250px] text-center">Outputs</th>
                        <th className="p-2 text-center min-w-[60px]">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {performanceItemsHistorico.map((item, index) => (
                        <tr key={item.id} className={`hover:bg-purple-50 group ${index % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}`}>
                          <td className="border-r border-purple-200 p-2 text-xs text-gray-700">{item.temaMacro}</td>
                          <td className="border-r border-purple-200 p-2 text-xs font-medium text-gray-800">{item.demanda}</td>
                          <td className="border-r border-purple-200 p-2 text-xs text-gray-700">{item.owner}</td>
                          <td className="border-r border-purple-200 p-2 text-xs">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                              item.status === 'Concluído' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>{item.status}</span>
                          </td>
                          <td className="border-r border-purple-200 p-2 text-xs text-gray-600">{item.prazoEntrega}</td>
                          <td className="border-r border-purple-200 p-2 text-xs text-gray-700">{item.resumoStatus}</td>
                          <td className="border-r border-purple-200 p-2 text-xs text-gray-700">{item.outputs}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => removePerformanceItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-100 rounded-full"
                              title="Remover item"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Performance Table */}
        {activeTab === 'performance' && (
          <div className="overflow-x-auto rounded-xl border-2 border-gray-300 shadow-inner bg-white">
            {/* Barra de Filtros */}
            <div className="bg-purple-100 p-3 border-b-2 border-purple-300 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-purple-900">Filtros:</span>

              <MultiSelectFilter
                selected={filtroTemaMacroPerformance}
                onChange={setFiltroTemaMacroPerformance}
                options={temasMacroPerformance}
                placeholder="Todos os Temas Macro"
              />

              <MultiSelectFilter
                selected={filtroOrigemPerformance}
                onChange={setFiltroOrigemPerformance}
                options={origensPerformance}
                placeholder="Todas as Origens"
              />

              <input
                type="text"
                placeholder="Buscar demanda..."
                value={filtroDemanda}
                onChange={(e) => setFiltroDemanda(e.target.value)}
                className="text-xs border border-purple-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <MultiSelectFilter
                selected={filtroAreaSolicitante}
                onChange={setFiltroAreaSolicitante}
                options={areasSolicitantes}
                placeholder="Todas as Áreas Solicitantes"
              />

              <MultiSelectFilter
                selected={filtroTipo}
                onChange={setFiltroTipo}
                options={tipos}
                placeholder="Todos os Tipos"
              />

              <MultiSelectFilter
                selected={filtroOwner}
                onChange={setFiltroOwner}
                options={['Maiune','Luke','Juliana','Cristiane','Felipe','Dionathan','Guilherme','Leticia','Bruno','Pedro','Welligton']}
                placeholder="Todos os Owners"
              />

              <MultiSelectFilter
                selected={filtroStatusPerformance}
                onChange={setFiltroStatusPerformance}
                options={['Backlog', 'Em Andamento', 'Pausado']}
                placeholder="Todos os Status"
                colorMap={{
                  'Backlog': 'bg-gray-500 text-white',
                  'Em Andamento': 'bg-blue-500 text-white',
                  'Pausado': 'bg-yellow-600 text-white',
                }}
              />

              <MultiSelectFilter
                selected={filtroComplexidade}
                onChange={(v) => setFiltroComplexidade(v as Complexidade[])}
                options={['Baixo', 'Médio', 'Alto']}
                placeholder="Todas as Complexidades"
                colorMap={{
                  'Baixo': 'bg-green-500 text-white',
                  'Médio': 'bg-yellow-500 text-white',
                  'Alto': 'bg-red-500 text-white',
                }}
              />

              <MultiSelectFilter
                selected={filtroImpacto}
                onChange={(v) => setFiltroImpacto(v as Impacto[])}
                options={['Baixo', 'Médio', 'Alto']}
                placeholder="Todos os Impactos"
                colorMap={{
                  'Baixo': 'bg-gray-400 text-white',
                  'Médio': 'bg-blue-500 text-white',
                  'Alto': 'bg-orange-500 text-white',
                }}
              />

              <button
                onClick={limparFiltrosPerformance}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded font-semibold transition-colors"
              >
                Limpar Filtros
              </button>

              <span className="text-xs text-purple-700 font-semibold ml-auto">
                {performanceItemsFiltrados.length} de {performanceItems.length} itens
              </span>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-700 to-purple-600 text-white text-xs font-bold">
                  <th className="sticky left-0 z-20 bg-purple-700 border-r border-purple-500 p-2 min-w-[250px] text-center shadow-[2px_0_4px_rgba(0,0,0,0.15)]">Demanda</th>
                  <th className="border-r border-purple-500 p-2 min-w-[120px] text-center">Impacto</th>
                  <th className="border-r border-purple-500 p-2 min-w-[120px] text-center">Complexidade</th>
                  <th className="border-r border-purple-500 p-2 min-w-[140px] text-center">Prazo de entrega</th>
                  <th className="border-r border-purple-500 p-2 min-w-[120px] text-center">Owner</th>
                  <th className="border-r border-purple-500 p-2 min-w-[130px] text-center">Status</th>
                  <th className="border-r border-purple-500 p-2 min-w-[250px] text-center">Descrição</th>
                  <th className="border-r border-purple-500 p-2 min-w-[250px] text-center">Resumo Status</th>
                  <th className="border-r border-purple-500 p-2 min-w-[250px] text-center">Outputs</th>
                  <th className="border-r border-purple-500 p-2 min-w-[150px] text-center">Tema Macro</th>
                  <th className="border-r border-purple-500 p-2 min-w-[150px] text-center">Origem</th>
                  <th className="border-r border-purple-500 p-2 min-w-[140px] text-center">Área solicitante</th>
                  <th className="border-r border-purple-500 p-2 min-w-[120px] text-center">Tipo</th>
                  <th className="border-r border-purple-500 p-2 min-w-[140px] text-center">Data solicitação</th>
                  <th className="border-r border-purple-500 p-2 min-w-[140px] text-center">Prazo início</th>
                  <th className="border-r border-purple-500 p-2 min-w-[200px] text-center">Dependências</th>
                  <th className="p-2 text-center min-w-[60px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {performanceItemsFiltrados.map((item, index) => (
                  <PerformanceTableRow
                    key={item.id}
                    item={item}
                    onUpdate={updatePerformanceItem}
                    onRemove={removePerformanceItem}
                    isEven={index % 2 === 0}
                    temasMacro={temasMacroPerformance}
                    origens={origensPerformance}
                    areasSolicitantes={areasSolicitantes}
                    tipos={tipos}
                    onAdicionarTemaMacro={adicionarTemaMacroPerformance}
                    onRemoverTemaMacro={removerTemaMacroPerformance}
                    onAdicionarOrigem={adicionarOrigemPerformance}
                    onRemoverOrigem={removerOrigemPerformance}
                    onAdicionarAreaSolicitante={adicionarAreaSolicitante}
                    onRemoverAreaSolicitante={removerAreaSolicitante}
                    onAdicionarTipo={adicionarTipo}
                    onRemoverTipo={removerTipo}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* UX Tab */}
        {activeTab === 'ux' && (
          <div className="overflow-x-auto rounded-xl border-2 border-purple-200 shadow-inner bg-white">
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 p-4 bg-purple-50 border-b border-purple-100">
              <MultiSelectFilter
                selected={filtroTemaUx}
                onChange={(v) => setFiltroTemaUx(v)}
                options={[...new Set(uxItems.map(i => i.tema).filter(Boolean))]}
                placeholder="Tema"
              />
              <MultiSelectFilter
                selected={filtroStatusUx as string[]}
                onChange={(v) => setFiltroStatusUx(v as FupStatus[])}
                options={['Backlog','Discovery','Handover','Refin. Técnico','Desenv. UX','Desenv. Técnico','Teste','Concluído','Pausado','Cancelado','Bloqueado']}
                placeholder="Status"
                colorMap={{
                  'Backlog': 'bg-gray-100 text-gray-700',
                  'Discovery': 'bg-purple-100 text-purple-700',
                  'Handover': 'bg-blue-100 text-blue-700',
                  'Refin. Técnico': 'bg-cyan-100 text-cyan-700',
                  'Desenv. UX': 'bg-pink-100 text-pink-700',
                  'Desenv. Técnico': 'bg-orange-100 text-orange-700',
                  'Teste': 'bg-yellow-100 text-yellow-700',
                  'Concluído': 'bg-green-100 text-green-700',
                  'Pausado': 'bg-yellow-100 text-yellow-800',
                  'Cancelado': 'bg-red-100 text-red-700',
                  'Bloqueado': 'bg-red-100 text-red-600',
                }}
              />
              <MultiSelectFilter
                selected={filtroPrioridadeUx as string[]}
                onChange={(v) => setFiltroPrioridadeUx(v as Prioridade[])}
                options={['Baixo','Médio','Alto','Crítico']}
                placeholder="Prioridade"
                colorMap={{
                  'Baixo': 'bg-blue-100 text-blue-700',
                  'Médio': 'bg-yellow-100 text-yellow-700',
                  'Alto': 'bg-orange-100 text-orange-700',
                  'Crítico': 'bg-red-100 text-red-700',
                }}
              />
              {(filtroTemaUx.length > 0 || filtroStatusUx.length > 0 || filtroPrioridadeUx.length > 0) && (
                <button
                  onClick={() => { setFiltroTemaUx([]); setFiltroStatusUx([]); setFiltroPrioridadeUx([]); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <X className="w-3 h-3" /> Limpar filtros
                </button>
              )}
            </div>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-purple-700 text-white text-left">
                  <th className="sticky left-0 z-10 bg-purple-700 p-3 font-bold min-w-[180px]">Tema</th>
                  <th className="p-3 font-bold min-w-[220px]">Atividade</th>
                  <th className="p-3 font-bold min-w-[150px]">Status</th>
                  <th className="p-3 font-bold min-w-[120px]">Prioridade</th>
                  <th className="p-3 font-bold min-w-[130px]">Data de Início</th>
                  <th className="p-3 font-bold min-w-[130px]">Data de Entrega</th>
                  <th className="p-3 font-bold min-w-[60px] text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {uxItems
                  .filter(item => {
                    const matchTema = filtroTemaUx.length === 0 || filtroTemaUx.includes(item.tema);
                    const matchStatus = filtroStatusUx.length === 0 || filtroStatusUx.includes(item.status);
                    const matchPrioridade = filtroPrioridadeUx.length === 0 || filtroPrioridadeUx.includes(item.prioridade);
                    return matchTema && matchStatus && matchPrioridade;
                  })
                  .map((item, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = isEven ? 'bg-white' : 'bg-purple-50';
                    const statusColors: Record<FupStatus, string> = {
                      'Backlog': 'bg-gray-500 text-white',
                      'Discovery': 'bg-purple-500 text-white',
                      'Handover': 'bg-blue-400 text-white',
                      'Refin. Técnico': 'bg-cyan-500 text-white',
                      'Desenv. UX': 'bg-pink-500 text-white',
                      'Desenv. Técnico': 'bg-orange-500 text-white',
                      'Teste': 'bg-yellow-500 text-white',
                      'Concluído': 'bg-green-600 text-white',
                      'Pausado': 'bg-yellow-600 text-white',
                      'Cancelado': 'bg-red-600 text-white',
                      'Bloqueado': 'bg-red-500 text-white',
                      'UX': 'bg-purple-600 text-white',
                    };
                    const prioridadeColors: Record<Prioridade, string> = {
                      'Baixo': 'bg-blue-100 text-blue-700',
                      'Médio': 'bg-yellow-100 text-yellow-700',
                      'Alto': 'bg-orange-100 text-orange-700',
                      'Crítico': 'bg-red-100 text-red-700',
                    };
                    const updateUx = (id: string, field: keyof UxItem, value: string) => {
                      setUxItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
                    };
                    return (
                      <tr key={item.id} className={`border-b border-gray-200 hover:bg-purple-100 transition-colors ${rowBg}`}>
                        <td className={`sticky left-0 z-10 border-r border-gray-300 p-2 align-top shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${rowBg}`}>
                          <input
                            className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-purple-300 rounded p-1"
                            value={item.tema}
                            onChange={e => updateUx(item.id, 'tema', e.target.value)}
                            placeholder="Tema..."
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-purple-300 rounded p-1"
                            value={item.atividade}
                            onChange={e => updateUx(item.id, 'atividade', e.target.value)}
                            placeholder="Atividade..."
                          />
                        </td>
                        <td className="p-2 align-top">
                          <select
                            value={item.status}
                            onChange={e => updateUx(item.id, 'status', e.target.value)}
                            className={`text-xs font-bold rounded-full px-3 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-sm ${statusColors[item.status]}`}
                          >
                            {(['Backlog','Discovery','Handover','Refin. Técnico','Desenv. UX','Desenv. Técnico','Teste','Concluído','Pausado','Cancelado','Bloqueado'] as FupStatus[]).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 align-top">
                          <select
                            value={item.prioridade}
                            onChange={e => updateUx(item.id, 'prioridade', e.target.value as Prioridade)}
                            className={`text-xs font-bold rounded-full px-3 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-sm ${prioridadeColors[item.prioridade]}`}
                          >
                            {(['Baixo','Médio','Alto','Crítico'] as Prioridade[]).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="date"
                            className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-purple-300 rounded p-1"
                            value={item.dataInicio}
                            onChange={e => updateUx(item.id, 'dataInicio', e.target.value)}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="date"
                            className="w-full text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-purple-300 rounded p-1"
                            value={item.dataEntrega}
                            onChange={e => updateUx(item.id, 'dataEntrega', e.target.value)}
                          />
                        </td>
                        <td className="p-2 align-top text-center">
                          <button
                            onClick={() => setUxItems(prev => prev.filter(i => i.id !== item.id))}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {uxItems.filter(item => {
                  const matchTema = filtroTemaUx.length === 0 || filtroTemaUx.includes(item.tema);
                  const matchStatus = filtroStatusUx.length === 0 || filtroStatusUx.includes(item.status);
                  const matchPrioridade = filtroPrioridadeUx.length === 0 || filtroPrioridadeUx.includes(item.prioridade);
                  return matchTema && matchStatus && matchPrioridade;
                }).length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl">🎨</span>
                        <span className="font-medium">Nenhuma atividade UX cadastrada</span>
                        <span className="text-xs">Clique em "Adicionar Item" para começar</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Status Report */}
        {activeTab === 'status-report' && (
          <div className="bg-white rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Relatório de Status Geral</h3>
            <div className="grid grid-cols-3 gap-6">
              {/* Status por Vertical */}
              <div className="col-span-3">
                <h4 className="text-md font-semibold mb-3 text-gray-800">Status por Vertical</h4>
                <div className="space-y-4">
                  {['Cadastro', 'Conta Corrente', 'APP'].map((area) => {
                    const areaItems = fupItems.filter(item => item.area === area);
                    const statusCounts = {
                      total: areaItems.length,
                      backlog: areaItems.filter(i => i.status === 'Backlog').length,
                      emAndamento: areaItems.filter(i => ['Discovery', 'Desenv. UX', 'Desenv. Técnico'].includes(i.status)).length,
                      emTeste: areaItems.filter(i => i.status === 'Teste').length,
                      concluido: areaItems.filter(i => i.status === 'Concluído').length,
                      pausado: areaItems.filter(i => i.status === 'Pausado').length,
                      bloqueado: areaItems.filter(i => i.status === 'Bloqueado').length,
                      cancelado: areaItems.filter(i => i.status === 'Cancelado').length,
                    };

                    return (
                      <div key={area} className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-semibold text-sm mb-3">{area}</h5>
                        <div className="grid grid-cols-7 gap-2 text-xs">
                          <div className="bg-gray-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.backlog}</div>
                            <div className="text-gray-600">Backlog</div>
                          </div>
                          <div className="bg-blue-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.emAndamento}</div>
                            <div className="text-gray-600">Em Andamento</div>
                          </div>
                          <div className="bg-purple-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.emTeste}</div>
                            <div className="text-gray-600">Em Teste</div>
                          </div>
                          <div className="bg-green-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.concluido}</div>
                            <div className="text-gray-600">Concluído</div>
                          </div>
                          <div className="bg-yellow-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.pausado}</div>
                            <div className="text-gray-600">Pausado</div>
                          </div>
                          <div className="bg-red-100 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.bloqueado}</div>
                            <div className="text-gray-600">Bloqueado</div>
                          </div>
                          <div className="bg-gray-300 p-2 rounded text-center">
                            <div className="font-bold text-lg">{statusCounts.cancelado}</div>
                            <div className="text-gray-600">Cancelado</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progresso</span>
                            <span className="font-semibold">{Math.round((statusCounts.concluido / statusCounts.total) * 100)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full transition-all"
                              style={{ width: `${Math.round((statusCounts.concluido / statusCounts.total) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline Simplificada */}
              <div className="col-span-3">
                <h4 className="text-md font-semibold mb-3 text-gray-800 mt-6">Próximas Entregas (30 dias)</h4>
                <div className="space-y-2">
                  {fupItems
                    .filter(item => {
                      if (!item.dataLimite) return false;
                      const dataLimite = new Date(item.dataLimite);
                      const hoje = new Date();
                      const diff = Math.ceil((dataLimite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      return diff >= 0 && diff <= 30;
                    })
                    .sort((a, b) => new Date(a.dataLimite).getTime() - new Date(b.dataLimite).getTime())
                    .slice(0, 10)
                    .map((item) => {
                      const dataLimite = new Date(item.dataLimite);
                      const hoje = new Date();
                      const diff = Math.ceil((dataLimite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      const isUrgent = diff <= 7;

                      return (
                        <div key={item.id} className={`border-l-4 ${isUrgent ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'} p-3 rounded`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{item.atividade}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {item.area} • {item.origem} • {item.status}
                              </div>
                            </div>
                            <div className={`text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-blue-600'}`}>
                              {diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `${diff} dias`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 w-full">
      <div className={`${color} w-14 h-14 rounded-lg flex items-center justify-center text-white mb-3`}>
        <div className="scale-125">{icon}</div>
      </div>
      <div className="text-4xl font-bold mb-2 leading-none">{value}</div>
      <div className="text-base text-gray-600 leading-tight">{label}</div>
    </div>
  );
}

function Section({ title, bgColor, borderColor, children }: { title: string; bgColor: string; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={`${bgColor} p-1.5 rounded-lg border-l-4 ${borderColor} shrink-0`}>
      <h2 className="font-bold text-[10px] mb-1 leading-tight">{title}</h2>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

function ReadOnlySection({
  title,
  bgColor,
  borderColor,
  tasks,
  isExpanded,
  onToggle
}: {
  title: string;
  bgColor: string;
  borderColor: string;
  tasks: Task[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${bgColor} p-1.5 rounded-lg border-l-4 ${borderColor} shrink-0`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-1">
          <h2 className="font-bold text-[10px] leading-tight">{title}</h2>
          <span className="text-[9px] text-gray-500 italic">Sincronizado com FUP</span>
        </div>
        <button
          onClick={onToggle}
          className="p-0.5 hover:bg-white/50 rounded transition-colors"
          title={isExpanded ? "Recolher" : "Expandir"}
        >
          <ChevronDown
            className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
          />
        </button>
      </div>
      {isExpanded && (
        <div className="space-y-0.5">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              status={task.status}
              title={task.title}
              responsible={task.responsible}
              priority={task.priority}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditableSection({
  title,
  bgColor,
  borderColor,
  tasks,
  onAdd,
  onUpdate,
  onRemove,
  isExpanded,
  onToggle
}: {
  title: string;
  bgColor: string;
  borderColor: string;
  tasks: Task[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Task, value: string) => void;
  onRemove: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`${bgColor} p-1.5 rounded-lg border-l-4 ${borderColor} shrink-0`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-[10px] leading-tight flex-1">{title}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onAdd}
            className="bg-white hover:bg-gray-100 p-0.5 rounded shadow-sm border border-gray-300 transition-colors"
            title="Adicionar novo tema"
          >
            <Plus className="w-3 h-3 text-gray-700" />
          </button>
          <button
            onClick={onToggle}
            className="p-0.5 hover:bg-white/50 rounded transition-colors"
            title={isExpanded ? "Recolher" : "Expandir"}
          >
            <ChevronDown
              className={`w-3 h-3 text-gray-600 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
            />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="space-y-0.5">
          {tasks.map(task => (
            <EditableTaskItem
              key={task.id}
              task={task}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskItem({ status, title, responsible, priority }: { status: 'complete' | 'progress' | 'pending' | 'alert'; title: string; responsible: string; priority?: string }) {
  const statusConfig = {
    complete: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600', bg: 'bg-green-100' },
    progress: { icon: <Clock className="w-3 h-3" />, color: 'text-blue-600', bg: 'bg-blue-100' },
    pending: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-gray-600', bg: 'bg-gray-100' },
    alert: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-600', bg: 'bg-red-100' }
  };

  const config = statusConfig[status];

  return (
    <div className="bg-white p-1.5 rounded-md shadow-sm flex items-center gap-1.5 hover:shadow-md transition-shadow">
      <div className={`${config.bg} ${config.color} p-0.5 rounded`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[10px] truncate leading-tight">{title}</div>
        <div className="text-[9px] text-gray-500 leading-tight">
          {responsible}
          {priority && <span className="ml-1 font-semibold text-red-600">• {priority}</span>}
        </div>
      </div>
    </div>
  );
}

function EditableTaskItem({
  task,
  onUpdate,
  onRemove
}: {
  task: Task;
  onUpdate: (id: string, field: keyof Task, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const statusConfig = {
    complete: { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600', bg: 'bg-green-100' },
    progress: { icon: <Clock className="w-3 h-3" />, color: 'text-blue-600', bg: 'bg-blue-100' },
    pending: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-gray-600', bg: 'bg-gray-100' },
    alert: { icon: <AlertCircle className="w-3 h-3" />, color: 'text-red-600', bg: 'bg-red-100' }
  };

  const config = statusConfig[task.status];

  return (
    <div className="bg-white p-1.5 rounded-md shadow-sm flex items-center gap-1.5 hover:shadow-md transition-shadow group">
      <select
        value={task.status}
        onChange={(e) => onUpdate(task.id, 'status', e.target.value)}
        className={`${config.bg} ${config.color} p-0.5 rounded border-0 text-[8px] cursor-pointer`}
      >
        <option value="complete">✓</option>
        <option value="progress">⏳</option>
        <option value="pending">○</option>
        <option value="alert">⚠</option>
      </select>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <input
          type="text"
          value={task.title}
          onChange={(e) => onUpdate(task.id, 'title', e.target.value)}
          placeholder="Nome do tema..."
          className="font-medium text-[10px] leading-tight bg-transparent border-0 focus:outline-none focus:bg-gray-50 rounded px-0.5 w-full"
        />
        <div className="flex gap-1 items-center">
          <input
            type="text"
            value={task.responsible}
            onChange={(e) => onUpdate(task.id, 'responsible', e.target.value)}
            placeholder="Responsável..."
            className="text-[9px] text-gray-500 leading-tight bg-transparent border-0 focus:outline-none focus:bg-gray-50 rounded px-0.5 flex-1"
          />
          {task.status === 'alert' && (
            <select
              value={task.priority || ''}
              onChange={(e) => onUpdate(task.id, 'priority', e.target.value)}
              className="text-[9px] text-red-600 font-semibold bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              <option value="">-</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(task.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
        title="Remover tema"
      >
        <X className="w-3 h-3 text-red-600" />
      </button>
    </div>
  );
}

function FupTableRow({
  item,
  onUpdate,
  onRemove,
  isEven,
  temasMacro,
  origens,
  onAdicionarTemaMacro,
  onRemoverTemaMacro,
  onAdicionarOrigem,
  onRemoverOrigem
}: {
  item: FupItem;
  onUpdate: (id: string, field: keyof FupItem, value: string) => void;
  onRemove: (id: string) => void;
  isEven?: boolean;
  temasMacro: string[];
  origens: string[];
  onAdicionarTemaMacro: (itemId?: string) => void;
  onRemoverTemaMacro: (tema: string) => void;
  onAdicionarOrigem: (itemId?: string) => void;
  onRemoverOrigem: (origem: string) => void;
}) {
  const statusColors: Record<FupStatus, string> = {
    'Backlog': 'bg-gray-500 hover:bg-gray-600 text-white',
    'Discovery': 'bg-purple-500 hover:bg-purple-600 text-white',
    'Handover': 'bg-blue-400 hover:bg-blue-500 text-white',
    'Refin. Técnico': 'bg-cyan-500 hover:bg-cyan-600 text-white',
    'Desenv. UX': 'bg-pink-500 hover:bg-pink-600 text-white',
    'Desenv. Técnico': 'bg-orange-500 hover:bg-orange-600 text-white',
    'Teste': 'bg-yellow-500 hover:bg-yellow-600 text-white',
    'Concluído': 'bg-green-600 hover:bg-green-700 text-white',
    'Pausado': 'bg-yellow-600 hover:bg-yellow-700 text-white',
    'Cancelado': 'bg-red-600 hover:bg-red-700 text-white',
    'Bloqueado': 'bg-red-500 hover:bg-red-600 text-white',
    'UX': 'bg-purple-600 hover:bg-purple-700 text-white'
  };

  const prioridadeColors: Record<Prioridade, string> = {
    'Baixo': 'bg-blue-500 hover:bg-blue-600 text-white',
    'Médio': 'bg-yellow-500 hover:bg-yellow-600 text-white',
    'Alto': 'bg-orange-500 hover:bg-orange-600 text-white',
    'Crítico': 'bg-red-500 hover:bg-red-600 text-white'
  };

  const rowBg = isEven ? 'bg-white' : 'bg-gray-50';
  return (
    <tr className={`hover:bg-blue-50 group transition-all duration-200 ${rowBg}`}>
      {/* Tema Macro — coluna 1 congelada */}
      <td className={`sticky left-0 z-10 border-r border-gray-300 p-2 align-top shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${rowBg}`}>
        <CustomSelectWithDelete
          value={item.temaMacro}
          onChange={(value) => onUpdate(item.id, 'temaMacro', value)}
          options={temasMacro}
          onDelete={onRemoverTemaMacro}
          onAddNew={() => onAdicionarTemaMacro(item.id)}
          placeholder="Selecione tema..."
          className="w-full"
        />
      </td>

      {/* Atividade — coluna 2 congelada */}
      <td className={`sticky left-[150px] z-10 border-r border-gray-300 p-2 align-top shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${rowBg}`}>
        <input
          type="text"
          value={item.atividade}
          onChange={(e) => onUpdate(item.id, 'atividade', e.target.value)}
          placeholder="Nome da atividade..."
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </td>

      {/* Prioridade */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.prioridade}
          onChange={(e) => onUpdate(item.id, 'prioridade', e.target.value as Prioridade)}
          className={`text-xs font-bold rounded-full px-3 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all ${prioridadeColors[item.prioridade]}`}
        >
          <option value="Baixo">Baixo</option>
          <option value="Médio">Médio</option>
          <option value="Alto">Alto</option>
          <option value="Crítico">Crítico</option>
        </select>
      </td>

      {/* Data Limite */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="date"
          value={item.dataLimite}
          onChange={(e) => onUpdate(item.id, 'dataLimite', e.target.value)}
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        />
      </td>

      {/* Focal */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.focal}
          onChange={(e) => onUpdate(item.id, 'focal', e.target.value)}
          className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione...</option>
          <option value="Maiune">Maiune</option>
          <option value="Luke">Luke</option>
          <option value="Juliana">Juliana</option>
          <option value="Cristiane">Cristiane</option>
          <option value="Felipe">Felipe</option>
          <option value="Dionathan">Dionathan</option>
          <option value="Guilherme">Guilherme</option>
          <option value="Leticia">Leticia</option>
          <option value="Bruno">Bruno</option>
          <option value="Pedro">Pedro</option>
          <option value="Welligton">Welligton</option>
        </select>
      </td>

      {/* Status */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.status}
          onChange={(e) => onUpdate(item.id, 'status', e.target.value as FupStatus)}
          className={`text-xs font-bold rounded-full px-3 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all ${statusColors[item.status]}`}
        >
          <option value="Backlog">Backlog</option>
          <option value="Discovery">Discovery</option>
          <option value="Handover">Handover</option>
          <option value="Refin. Técnico">Refin. Técnico</option>
          <option value="Desenv. UX">Desenv. UX</option>
          <option value="Desenv. Técnico">Desenv. Técnico</option>
          <option value="UX">UX ↗</option>
          <option value="Teste">Teste</option>
          <option value="Concluído">Concluído</option>
          <option value="Pausado">Pausado</option>
          <option value="Cancelado">Cancelado</option>
          <option value="Bloqueado">Bloqueado</option>
        </select>
      </td>

      {/* Descrição */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.descricao}
          onChange={(e) => onUpdate(item.id, 'descricao', e.target.value)}
          placeholder="Descrição detalhada..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </td>

      {/* Resumo Status */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.resumoStatus}
          onChange={(e) => onUpdate(item.id, 'resumoStatus', e.target.value)}
          placeholder="Última atualização..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </td>

      {/* Área */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.area}
          onChange={(e) => onUpdate(item.id, 'area', e.target.value as Area)}
          className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="APP">APP</option>
          <option value="Cadastro">Cadastro</option>
          <option value="Conta Corrente">Conta Corrente</option>
        </select>
      </td>

      {/* Origem */}
      <td className="border-r border-gray-300 p-2 align-top">
        <CustomSelectWithDelete
          value={item.origem}
          onChange={(value) => onUpdate(item.id, 'origem', value)}
          options={origens}
          onDelete={onRemoverOrigem}
          onAddNew={() => onAdicionarOrigem(item.id)}
          placeholder="Selecione origem..."
          className="w-full"
        />
      </td>

      {/* Dependências */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.dependencias}
          onChange={(e) => onUpdate(item.id, 'dependencias', e.target.value)}
          placeholder="Ex: Focal, Área, Tarefa..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </td>

      {/* Link UX */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="url"
          value={item.linkUX}
          onChange={(e) => onUpdate(item.id, 'linkUX', e.target.value)}
          placeholder="https://..."
          className="text-xs text-blue-600 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 hover:underline"
        />
      </td>

      {/* Link RoadMap */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="url"
          value={item.linkRoadMap}
          onChange={(e) => onUpdate(item.id, 'linkRoadMap', e.target.value)}
          placeholder="https://..."
          className="text-xs text-blue-600 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 hover:underline"
        />
      </td>

      {/* Ações */}
      <td className="p-2 text-center align-top">
        <button
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-100 rounded-full"
          title="Remover item"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      </td>
    </tr>
  );
}

function PerformanceTableRow({
  item,
  onUpdate,
  onRemove,
  isEven,
  temasMacro,
  origens,
  areasSolicitantes,
  tipos,
  onAdicionarTemaMacro,
  onRemoverTemaMacro,
  onAdicionarOrigem,
  onRemoverOrigem,
  onAdicionarAreaSolicitante,
  onRemoverAreaSolicitante,
  onAdicionarTipo,
  onRemoverTipo
}: {
  item: PerformanceItem;
  onUpdate: (id: string, field: keyof PerformanceItem, value: string) => void;
  onRemove: (id: string) => void;
  isEven?: boolean;
  temasMacro: string[];
  origens: string[];
  areasSolicitantes: string[];
  tipos: string[];
  onAdicionarTemaMacro: (itemId?: string) => void;
  onRemoverTemaMacro: (tema: string) => void;
  onAdicionarOrigem: (itemId?: string) => void;
  onRemoverOrigem: (origem: string) => void;
  onAdicionarAreaSolicitante: (itemId?: string) => void;
  onRemoverAreaSolicitante: (area: string) => void;
  onAdicionarTipo: (itemId?: string) => void;
  onRemoverTipo: (tipo: string) => void;
}) {
  const rowBg = isEven ? 'bg-white' : 'bg-gray-50';
  return (
    <tr className={`hover:bg-purple-50 group transition-all duration-200 ${rowBg}`}>
      {/* Demanda — coluna congelada */}
      <td className={`sticky left-0 z-10 border-r border-gray-300 p-2 align-top shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${rowBg}`}>
        <input
          type="text"
          value={item.demanda}
          onChange={(e) => onUpdate(item.id, 'demanda', e.target.value)}
          placeholder="Nome da demanda..."
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
      </td>

      {/* Impacto */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.impacto}
          onChange={(e) => onUpdate(item.id, 'impacto', e.target.value)}
          className={`text-xs font-bold rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 border ${
            item.impacto === 'Alto' ? 'bg-orange-100 text-orange-800 border-orange-300' :
            item.impacto === 'Médio' ? 'bg-blue-100 text-blue-800 border-blue-300' :
            item.impacto === 'Baixo' ? 'bg-gray-100 text-gray-600 border-gray-300' :
            'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          <option value="Baixo">Baixo</option>
          <option value="Médio">Médio</option>
          <option value="Alto">Alto</option>
        </select>
      </td>

      {/* Complexidade */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.complexidade}
          onChange={(e) => onUpdate(item.id, 'complexidade', e.target.value)}
          className={`text-xs font-bold rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 border ${
            item.complexidade === 'Alto' ? 'bg-red-100 text-red-800 border-red-300' :
            item.complexidade === 'Médio' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
            item.complexidade === 'Baixo' ? 'bg-green-100 text-green-800 border-green-300' :
            'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          <option value="Baixo">Baixo</option>
          <option value="Médio">Médio</option>
          <option value="Alto">Alto</option>
        </select>
      </td>

      {/* Prazo de entrega */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="date"
          value={item.prazoEntrega}
          onChange={(e) => onUpdate(item.id, 'prazoEntrega', e.target.value)}
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
        />
      </td>

      {/* Owner */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.owner}
          onChange={(e) => onUpdate(item.id, 'owner', e.target.value)}
          className="text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Selecione...</option>
          <option value="Maiune">Maiune</option>
          <option value="Luke">Luke</option>
          <option value="Juliana">Juliana</option>
          <option value="Cristiane">Cristiane</option>
          <option value="Felipe">Felipe</option>
          <option value="Dionathan">Dionathan</option>
          <option value="Guilherme">Guilherme</option>
          <option value="Leticia">Leticia</option>
          <option value="Bruno">Bruno</option>
          <option value="Pedro">Pedro</option>
          <option value="Welligton">Welligton</option>
        </select>
      </td>

      {/* Status */}
      <td className="border-r border-gray-300 p-2 align-top">
        <select
          value={item.status}
          onChange={(e) => onUpdate(item.id, 'status', e.target.value)}
          className={`text-xs font-bold rounded px-2 py-1 w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 border ${
            item.status === 'Concluído' ? 'bg-green-100 text-green-800 border-green-300' :
            item.status === 'Em Andamento' ? 'bg-blue-100 text-blue-800 border-blue-300' :
            item.status === 'Pausado' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
            item.status === 'Cancelado' ? 'bg-red-100 text-red-800 border-red-300' :
            'bg-gray-100 text-gray-700 border-gray-300'
          }`}
        >
          <option value="">Selecione...</option>
          <option value="Backlog">Backlog</option>
          <option value="Em Andamento">Em Andamento</option>
          <option value="Concluído">Concluído</option>
          <option value="Pausado">Pausado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </td>

      {/* Descrição */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.descricao}
          onChange={(e) => onUpdate(item.id, 'descricao', e.target.value)}
          placeholder="Descrição detalhada..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </td>

      {/* Resumo Status */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.resumoStatus}
          onChange={(e) => onUpdate(item.id, 'resumoStatus', e.target.value)}
          placeholder="Última atualização..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </td>

      {/* Outputs */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.outputs}
          onChange={(e) => onUpdate(item.id, 'outputs', e.target.value)}
          placeholder="Resultados e entregas..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </td>

      {/* Tema Macro */}
      <td className="border-r border-gray-300 p-2 align-top">
        <CustomSelectWithDelete
          value={item.temaMacro}
          onChange={(value) => onUpdate(item.id, 'temaMacro', value)}
          options={temasMacro}
          onDelete={onRemoverTemaMacro}
          onAddNew={() => onAdicionarTemaMacro(item.id)}
          placeholder="Selecione tema..."
          className="w-full"
        />
      </td>

      {/* Origem */}
      <td className="border-r border-gray-300 p-2 align-top">
        <CustomSelectWithDelete
          value={item.origem}
          onChange={(value) => onUpdate(item.id, 'origem', value)}
          options={origens}
          onDelete={onRemoverOrigem}
          onAddNew={() => onAdicionarOrigem(item.id)}
          placeholder="Selecione origem..."
          className="w-full"
        />
      </td>

      {/* Área solicitante */}
      <td className="border-r border-gray-300 p-2 align-top">
        <CustomSelectWithDelete
          value={item.areaSolicitante}
          onChange={(value) => onUpdate(item.id, 'areaSolicitante', value)}
          options={areasSolicitantes}
          onDelete={onRemoverAreaSolicitante}
          onAddNew={() => onAdicionarAreaSolicitante(item.id)}
          placeholder="Selecione área..."
          className="w-full"
        />
      </td>

      {/* Tipo */}
      <td className="border-r border-gray-300 p-2 align-top">
        <CustomSelectWithDelete
          value={item.tipo}
          onChange={(value) => onUpdate(item.id, 'tipo', value)}
          options={tipos}
          onDelete={onRemoverTipo}
          onAddNew={() => onAdicionarTipo(item.id)}
          placeholder="Selecione tipo..."
          className="w-full"
        />
      </td>

      {/* Data de solicitação */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="date"
          value={item.dataSolicitacao}
          onChange={(e) => onUpdate(item.id, 'dataSolicitacao', e.target.value)}
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
        />
      </td>

      {/* Prazo de início */}
      <td className="border-r border-gray-300 p-2 align-top">
        <input
          type="date"
          value={item.prazoInicio}
          onChange={(e) => onUpdate(item.id, 'prazoInicio', e.target.value)}
          className="text-xs font-medium text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
        />
      </td>

      {/* Dependências */}
      <td className="border-r border-gray-300 p-2 align-top">
        <textarea
          value={item.dependencias}
          onChange={(e) => onUpdate(item.id, 'dependencias', e.target.value)}
          placeholder="Áreas dependentes..."
          rows={2}
          className="text-xs text-gray-700 bg-white border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
        />
      </td>

      {/* Ações */}
      <td className="p-2 text-center align-top">
        <button
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-red-100 rounded-full"
          title="Remover item"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      </td>
    </tr>
  );
}

function DeliveryItem({ date, title }: { date: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100 last:border-b-0 last:pb-0">
      <div className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap">
        {date}
      </div>
      <div className="text-[10px] flex-1 truncate">{title}</div>
    </div>
  );
}

function KpiItem({ label, value, trend }: { label: string; value: string; trend: 'up' | 'down' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-[10px]">{value}</span>
        <TrendingUp className={`w-3 h-3 ${trend === 'up' ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
      </div>
    </div>
  );
}
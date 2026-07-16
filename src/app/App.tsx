import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, ChevronRight, AlertTriangle, Trash2, Edit3,
  LayoutGrid, BarChart3, Search, X, Calendar,
  TrendingUp, AlertCircle, Filter, ChevronDown,
  Activity, Flag, Link2, RotateCcw, Zap, Target,
  CheckCircle2, Clock, Users
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "discovery" | "backlog" | "dev" | "homolog" | "done" | "blocked";
type Category = "Validação" | "Documentos" | "Onboarding" | "Atualização Cadastral" | "Integrações";
type Quarter =
  | "Q1 2025" | "Q2 2025" | "Q3 2025" | "Q4 2025"
  | "Q1 2026" | "Q2 2026" | "Q3 2026" | "Q4 2026"
  | "Q1 2027" | "Q2 2027";
type View = "roadmap" | "timeline" | "dashboard";

interface Project {
  id: string;
  title: string;
  category: Category;
  status: Status;
  quarter: Quarter;
  progress: number;
  startDate: string;
  endDate: string;
  owner: string;
  ownerInitials: string;
  ownerColor: string;
  epicJira: string;
  description: string;
  tags: string[];
  hasDependencies: boolean;
  blockedReason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SC: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  discovery: { label: "Discovery",         color: "#9333EA", bg: "rgba(147,51,234,0.14)",  border: "rgba(147,51,234,0.35)" },
  backlog:   { label: "Backlog",           color: "#60A5FA", bg: "rgba(96,165,250,0.14)",  border: "rgba(96,165,250,0.35)" },
  dev:       { label: "Em Desenvolvimento",color: "#FB923C", bg: "rgba(251,146,60,0.14)",  border: "rgba(251,146,60,0.35)" },
  homolog:   { label: "Em Homologação",    color: "#FBBF24", bg: "rgba(251,191,36,0.14)",  border: "rgba(251,191,36,0.35)" },
  done:      { label: "Concluído",         color: "#34D399", bg: "rgba(52,211,153,0.14)",  border: "rgba(52,211,153,0.35)" },
  blocked:   { label: "Bloqueado",         color: "#EF4444", bg: "rgba(239,68,68,0.14)",   border: "rgba(239,68,68,0.35)" },
};

const NEXT_STATUS: Partial<Record<Status, Status>> = {
  discovery: "backlog",
  backlog: "dev",
  dev: "homolog",
  homolog: "done",
};

const KANBAN_COLS: Status[] = ["discovery", "backlog", "dev", "homolog", "done", "blocked"];
const QUARTERS: Quarter[] = [
  "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025",
  "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026",
  "Q1 2027", "Q2 2027",
];
const CATEGORIES: Category[] = ["Validação", "Documentos", "Onboarding", "Atualização Cadastral", "Integrações"];

const CAT_COLOR: Record<Category, string> = {
  "Validação":             "#A78BFA",
  "Documentos":            "#38BDF8",
  "Onboarding":            "#34D399",
  "Atualização Cadastral": "#FB923C",
  "Integrações":           "#F472B6",
};

interface Owner {
  id: string | null;
  name: string;
  initials: string;
  color: string;
}

const OWNER_PALETTE = ["#6366F1", "#EC4899", "#14B8A6", "#F59E0B", "#8B5CF6", "#38BDF8", "#F472B6", "#34D399"];

const DEFAULT_OWNERS: Owner[] = [
  { id: null, name: "Guilherme Bassin",   initials: "GB", color: "#6366F1" },
  { id: null, name: "Juliana Genova",     initials: "JG", color: "#EC4899" },
  { id: null, name: "Pedro Gabriel Silva", initials: "PG", color: "#14B8A6" },
];

// ─── Supabase ────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? "https://hrfcmlqhgxzwjhnwawvc.supabase.co";
// Chave publicável (publishable/anon) — segura para uso no browser com RLS ativado.
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_vu9hGerEQY1IMrZ-kNpOBQ_AH_okmx3";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUS_ALIASES: Record<string, Status> = {
  "discovery": "discovery",
  "backlog": "backlog",
  "dev": "dev",
  "em desenvolvimento": "dev",
  "homolog": "homolog",
  "em homologação": "homolog",
  "done": "done",
  "concluído": "done",
  "concluido": "done",
  "blocked": "blocked",
  "bloqueado": "blocked",
};

function normalizeStatus(s: string | null): Status {
  if (!s) return "discovery";
  return STATUS_ALIASES[s.trim().toLowerCase()] ?? "discovery";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase() || "??";
}

function rowToProject(row: any, owners: Owner[]): Project {
  const owner = owners.find(o => o.id === row.owner_id);
  return {
    id: row.id,
    title: row.nome ?? "",
    category: (row.categoria as Category) ?? "Validação",
    status: normalizeStatus(row.status),
    quarter: (row.quarter_entrega as Quarter) ?? "Q1 2026",
    progress: row.progresso ?? 0,
    startDate: row.data_inicio ?? "",
    endDate: row.data_previsao ?? "",
    owner: owner?.name ?? "—",
    ownerInitials: owner?.initials ?? "??",
    ownerColor: owner?.color ?? "#6366F1",
    epicJira: row.epico_jira ?? "",
    description: row.descricao ?? "",
    tags: row.tags ?? [],
    hasDependencies: row.possui_dependencias ?? false,
    blockedReason: row.mensagem_alerta ?? undefined,
  };
}

function projectToRow(p: Partial<Project>, owners: Owner[]) {
  const owner = owners.find(o => o.name === p.owner);
  return {
    nome: p.title ?? "",
    descricao: p.description ?? "",
    categoria: p.category ?? "Validação",
    quarter_entrega: p.quarter ?? "Q1 2026",
    status: p.status ?? "discovery",
    owner_id: owner?.id ?? null,
    data_inicio: p.startDate || null,
    data_previsao: p.endDate || null,
    epico_jira: p.epicJira ?? "",
    progresso: p.progress ?? 0,
    possui_dependencias: p.hasDependencies ?? false,
    tags: p.tags ?? [],
    mensagem_alerta: p.blockedReason ?? null,
  };
}

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INITIAL: Project[] = [
  {
    id: "1", title: "Validação Biométrica em Tempo Real",
    category: "Validação", status: "dev", quarter: "Q2 2025",
    progress: 65, startDate: "2025-04-01", endDate: "2025-06-30",
    owner: "Lucas Ferreira", ownerInitials: "LF", ownerColor: "#6366F1",
    epicJira: "CAD-3250",
    description: "Validação biométrica facial em tempo real para onboarding digital.",
    tags: ["biometria", "IA"], hasDependencies: true,
  },
  {
    id: "2", title: "Atualização Cadastral PF Regulatória",
    category: "Atualização Cadastral", status: "homolog", quarter: "Q1 2025",
    progress: 90, startDate: "2025-01-15", endDate: "2025-03-31",
    owner: "Ana Paula Costa", ownerInitials: "AC", ownerColor: "#EC4899",
    epicJira: "CAD-2890",
    description: "Adequação regulatória para atualização de dados cadastrais de PF.",
    tags: ["compliance", "regulatório"], hasDependencies: false,
  },
  {
    id: "3", title: "Integração Bureau de Crédito Externo",
    category: "Integrações", status: "discovery", quarter: "Q3 2025",
    progress: 15, startDate: "2025-07-01", endDate: "2025-09-30",
    owner: "Rafael Mendes", ownerInitials: "RM", ownerColor: "#14B8A6",
    epicJira: "",
    description: "Discovery para integração com bureau de crédito externo.",
    tags: ["bureau", "crédito"], hasDependencies: false,
  },
  {
    id: "4", title: "Onboarding Digital Completo PJ",
    category: "Onboarding", status: "backlog", quarter: "Q2 2025",
    progress: 5, startDate: "2025-04-15", endDate: "2025-06-15",
    owner: "Camila Santos", ownerInitials: "CS", ownerColor: "#F59E0B",
    epicJira: "CAD-3180",
    description: "Novo fluxo de onboarding digital completo para pessoas jurídicas.",
    tags: ["PJ", "onboarding"], hasDependencies: true,
  },
  {
    id: "5", title: "Documentação KYC Automatizada",
    category: "Documentos", status: "dev", quarter: "Q2 2025",
    progress: 40, startDate: "2025-03-01", endDate: "2025-05-31",
    owner: "Lucas Ferreira", ownerInitials: "LF", ownerColor: "#6366F1",
    epicJira: "CAD-3100",
    description: "Automação da coleta e validação de documentos KYC.",
    tags: ["KYC", "automação"], hasDependencies: false,
  },
  {
    id: "6", title: "Validação de Documentos por IA",
    category: "Validação", status: "discovery", quarter: "Q3 2025",
    progress: 10, startDate: "2025-07-01", endDate: "2025-09-15",
    owner: "Fernanda Lima", ownerInitials: "FL", ownerColor: "#8B5CF6",
    epicJira: "",
    description: "IA para validação automática de documentos de identidade.",
    tags: ["IA", "OCR"], hasDependencies: true,
  },
  {
    id: "7", title: "Integração Receita Federal",
    category: "Integrações", status: "done", quarter: "Q1 2025",
    progress: 100, startDate: "2025-01-05", endDate: "2025-02-28",
    owner: "Rafael Mendes", ownerInitials: "RM", ownerColor: "#14B8A6",
    epicJira: "CAD-2750",
    description: "Integração com Receita Federal para consulta de CPF/CNPJ.",
    tags: ["Receita Federal"], hasDependencies: false,
  },
  {
    id: "8", title: "Atualização de Endereço via API Correios",
    category: "Atualização Cadastral", status: "blocked", quarter: "Q2 2025",
    progress: 30, startDate: "2025-02-01", endDate: "2025-04-30",
    owner: "Ana Paula Costa", ownerInitials: "AC", ownerColor: "#EC4899",
    epicJira: "CAD-2950",
    description: "Atualização automática de endereço via API dos Correios.",
    tags: ["endereço", "Correios"], hasDependencies: true,
    blockedReason: "Aguardando definição de contrato com API dos Correios",
  },
  {
    id: "9", title: "Portal Self-Service Cadastral",
    category: "Atualização Cadastral", status: "backlog", quarter: "Q3 2025",
    progress: 0, startDate: "2025-07-15", endDate: "2025-09-30",
    owner: "Camila Santos", ownerInitials: "CS", ownerColor: "#F59E0B",
    epicJira: "",
    description: "Portal para clientes atualizarem dados cadastrais de forma autônoma.",
    tags: ["self-service", "portal"], hasDependencies: false,
  },
  {
    id: "10", title: "Revalidação Cadastral Periódica",
    category: "Validação", status: "discovery", quarter: "Q4 2025",
    progress: 5, startDate: "2025-10-01", endDate: "2025-12-15",
    owner: "Fernanda Lima", ownerInitials: "FL", ownerColor: "#8B5CF6",
    epicJira: "",
    description: "Sistema de revalidação periódica automática dos dados cadastrais.",
    tags: ["revalidação", "automação"], hasDependencies: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function dateToMonthFrac(d: string): number {
  const dt = new Date(d);
  return dt.getMonth() + dt.getDate() / 31;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 24 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const c = SC[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

// ─── CategoryTag ─────────────────────────────────────────────────────────────

function CategoryTag({ category }: { category: Category }) {
  const color = CAT_COLOR[category];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {category}
    </span>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

interface CardProps {
  project: Project;
  onMove: (id: string, status: Status) => void;
  onEdit: (project: Project) => void;
  onDelete: (id: string) => void;
  onBlock: (project: Project) => void;
  onUnblock: (id: string) => void;
  draggable?: boolean;
  onDragStart?: () => void;
}

function ProjectCard({ project, onMove, onEdit, onDelete, onBlock, onUnblock, draggable, onDragStart }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = SC[project.status];
  const nextSt = NEXT_STATUS[project.status];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      className="relative rounded-xl p-3.5 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing select-none transition-all duration-200"
      style={{
        background: "#0F1729",
        border: `1px solid ${hovered ? cfg.border : "rgba(255,255,255,0.07)"}`,
        boxShadow: hovered ? `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${cfg.border}` : "0 2px 8px rgba(0,0,0,0.2)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-white flex-1" style={{ fontFamily: "Inter, sans-serif" }}>
          {project.title}
        </p>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: "#64748B", background: menuOpen ? "rgba(255,255,255,0.08)" : "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </button>
      </div>

      {/* Category */}
      <CategoryTag category={project.category} />

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
            progresso
          </span>
          <span className="text-xs font-medium" style={{ color: cfg.color, fontFamily: "JetBrains Mono, monospace" }}>
            {project.progress}%
          </span>
        </div>
        <ProgressBar value={project.progress} color={cfg.color} />
      </div>

      {/* Blocked reason */}
      {project.status === "blocked" && project.blockedReason && (
        <div className="flex items-start gap-1.5 rounded-lg p-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
          <span className="text-xs leading-relaxed" style={{ color: "#FCA5A5" }}>{project.blockedReason}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar initials={project.ownerInitials} color={project.ownerColor} size={22} />
          {project.epicJira && (
            <span className="text-xs font-medium" style={{ color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>
              {project.epicJira}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {project.hasDependencies && (
            <span title="Possui dependências">
              <Link2 size={11} style={{ color: "#FBBF24" }} />
            </span>
          )}
          <span className="text-xs" style={{ color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>
            {fmtDate(project.endDate)}
          </span>
        </div>
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 3).map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8" }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Quarter badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#334155", fontFamily: "JetBrains Mono, monospace" }}>
          {project.quarter}
        </span>
        {/* Action buttons - visible on hover */}
        <div className={`flex items-center gap-1 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}>
          {project.status === "blocked" ? (
            <button
              onClick={() => onUnblock(project.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.25)" }}
              title="Desbloquear"
            >
              <RotateCcw size={10} />
              Desbloquear
            </button>
          ) : nextSt ? (
            <button
              onClick={() => onMove(project.id, nextSt)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: SC[nextSt].bg, color: SC[nextSt].color, border: `1px solid ${SC[nextSt].border}` }}
              title={`Mover para ${SC[nextSt].label}`}
            >
              {SC[nextSt].label.split(" ")[0]}
              <ChevronRight size={10} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-2 top-10 z-30 rounded-xl py-1 min-w-[160px]"
          style={{ background: "#131F35", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
        >
          <MenuItem icon={<Edit3 size={12} />} label="Editar" onClick={() => { setMenuOpen(false); onEdit(project); }} />
          {project.status !== "blocked" && (
            <MenuItem icon={<AlertTriangle size={12} />} label="Bloquear" onClick={() => { setMenuOpen(false); onBlock(project); }} color="#FBBF24" />
          )}
          <MenuItem icon={<Trash2 size={12} />} label="Excluir" onClick={() => { setMenuOpen(false); onDelete(project.id); }} color="#EF4444" />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left hover:bg-white/5"
      style={{ color: color ?? "#94A3B8" }}
    >
      {icon} {label}
    </button>
  );
}

// ─── Roadmap View ─────────────────────────────────────────────────────────────

function RoadmapView({
  projects, filterQuarter, filterCategory, filterStatus,
  onMove, onEdit, onDelete, onBlock, onUnblock, onNew,
}: {
  projects: Project[];
  filterQuarter: string; filterCategory: string; filterStatus: string;
  onMove: (id: string, status: Status) => void;
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
  onBlock: (p: Project) => void;
  onUnblock: (id: string) => void;
  onNew: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);

  const filtered = projects.filter(p =>
    (filterQuarter === "all" || p.quarter === filterQuarter) &&
    (filterCategory === "all" || p.category === filterCategory) &&
    (filterStatus === "all" || p.status === filterStatus)
  );

  return (
    <div className="flex gap-4 h-full pb-4 overflow-x-auto min-w-0 pr-2">
      {KANBAN_COLS.map(status => {
        const cfg = SC[status];
        const cards = filtered.filter(p => p.status === status);
        const isTarget = dropTarget === status && dragId != null;

        return (
          <div
            key={status}
            className="flex-shrink-0 flex flex-col rounded-xl"
            style={{
              width: 288,
              background: "#0B1220",
              border: `1px solid ${isTarget ? cfg.color : "rgba(255,255,255,0.06)"}`,
              boxShadow: isTarget ? `0 0 0 1px ${cfg.color}, 0 0 24px ${cfg.bg}` : "none",
              transition: "all 0.15s ease",
            }}
            onDragOver={e => { e.preventDefault(); setDropTarget(status); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => {
              if (dragId) onMove(dragId, status);
              setDragId(null); setDropTarget(null);
            }}
          >
            {/* Column header */}
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-sm font-semibold" style={{ color: cfg.color, fontFamily: "Inter, sans-serif" }}>
                  {cfg.label}
                </span>
              </div>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color, fontFamily: "JetBrains Mono, monospace" }}
              >
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
              {cards.map(p => (
                <ProjectCard
                  key={p.id} project={p}
                  onMove={onMove} onEdit={onEdit} onDelete={onDelete} onBlock={onBlock} onUnblock={onUnblock}
                  draggable onDragStart={() => setDragId(p.id)}
                />
              ))}
              {cards.length === 0 && (
                <div
                  className="flex items-center justify-center h-24 rounded-xl text-xs"
                  style={{ border: "1px dashed rgba(255,255,255,0.08)", color: "#334155" }}
                >
                  Arraste um card aqui
                </div>
              )}
              {status === "discovery" && (
                <button
                  onClick={onNew}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-xs font-medium transition-all duration-150 hover:opacity-80"
                  style={{ border: "1px dashed rgba(147,51,234,0.3)", color: "#9333EA", background: "rgba(147,51,234,0.04)" }}
                >
                  <Plus size={13} /> Novo Projeto
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Timeline / Gantt View ────────────────────────────────────────────────────

const MILESTONES: Record<string, { label: string; icon: React.ReactNode }> = {
  kickoff:   { label: "Kick-off",           icon: <Flag size={10} /> },
  dev_done:  { label: "Dev Concluído",       icon: <CheckCircle2 size={10} /> },
  golive:    { label: "Go-live",             icon: <Zap size={10} /> },
};

function TimelineView({ projects }: { projects: Project[] }) {
  const TOTAL_MONTHS = 12; // Jan–Dec 2025

  function monthFrac(dateStr: string): number {
    const d = new Date(dateStr);
    return d.getMonth() + (d.getDate() - 1) / 31;
  }

  const sorted = [...projects].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Quarter labels */}
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)", paddingLeft: 220 }}>
        {["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"].map((q, i) => (
          <div key={q} className="flex-1 text-center text-xs font-semibold py-2" style={{ color: "#475569" }}>
            {q}
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.05)", paddingLeft: 220 }}>
        {MONTHS_PT.map((m, i) => (
          <div key={m} className="flex-1 text-center py-1.5" style={{ fontSize: 10, color: "#334155", fontFamily: "JetBrains Mono, monospace" }}>
            {m}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p, idx) => {
          const startFrac = Math.max(0, Math.min(1, monthFrac(p.startDate) / TOTAL_MONTHS));
          const endFrac = Math.max(0, Math.min(1, (monthFrac(p.endDate) + 0.9) / TOTAL_MONTHS));
          const widthFrac = Math.max(0.01, endFrac - startFrac);
          const cfg = SC[p.status];

          return (
            <div
              key={p.id}
              className="flex items-center border-b hover:bg-white/[0.02] transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.04)", minHeight: 56 }}
            >
              {/* Project info */}
              <div className="flex-shrink-0 flex items-center gap-2.5 pr-4 pl-3" style={{ width: 220 }}>
                <Avatar initials={p.ownerInitials} color={p.ownerColor} size={22} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#CBD5E1", maxWidth: 155 }}>{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>

              {/* Gantt area */}
              <div className="flex-1 relative" style={{ height: 56 }}>
                {/* Month grid lines */}
                {MONTHS_PT.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${(i / TOTAL_MONTHS) * 100}%`, width: 1, background: "rgba(255,255,255,0.035)" }}
                  />
                ))}

                {/* Bar */}
                <div
                  className="absolute top-1/2 rounded-lg flex items-center px-2 overflow-hidden"
                  style={{
                    left: `${startFrac * 100}%`,
                    width: `${widthFrac * 100}%`,
                    height: 28,
                    transform: "translateY(-50%)",
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    minWidth: 32,
                  }}
                >
                  {/* Progress fill */}
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{ width: `${p.progress}%`, background: `${cfg.color}22` }}
                  />
                  <span className="relative text-xs font-medium truncate" style={{ color: cfg.color, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
                    {p.progress}%
                  </span>
                  {p.hasDependencies && (
                    <Link2 size={9} className="relative ml-1 flex-shrink-0" style={{ color: "#FBBF24" }} />
                  )}
                </div>

                {/* Go-live diamond at end */}
                <div
                  className="absolute top-1/2"
                  style={{
                    left: `calc(${endFrac * 100}% - 6px)`,
                    transform: "translateY(-50%) rotate(45deg)",
                    width: 10, height: 10,
                    background: cfg.color,
                    border: "2px solid #080E1C",
                    borderRadius: 2,
                  }}
                  title="Go-live previsto"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({ projects }: { projects: Project[] }) {
  const counts = KANBAN_COLS.map(s => ({ status: s, count: projects.filter(p => p.status === s).length }));
  const total = projects.length;
  const done = projects.filter(p => p.status === "done").length;
  const blocked = projects.filter(p => p.status === "blocked").length;
  const inDev = projects.filter(p => p.status === "dev").length;
  const noOwner = projects.filter(p => !p.owner).length;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  const atRisk = projects.filter(p => p.status === "blocked" || (p.progress < 50 && p.status === "homolog"));

  const upcoming = projects
    .filter(p => p.status !== "done" && p.status !== "blocked")
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .slice(0, 5);

  const chartData = counts
    .filter(c => c.count > 0)
    .map(c => ({ name: SC[c.status as Status].label, value: c.count, color: SC[c.status as Status].color }));

  const metricCards = [
    { label: "Total de Projetos", value: total, icon: <Target size={18} />, color: "#6366F1" },
    { label: "Em Desenvolvimento", value: inDev, icon: <Activity size={18} />, color: "#FB923C" },
    { label: "Concluídos",         value: done,    icon: <CheckCircle2 size={18} />, color: "#34D399" },
    { label: "Bloqueados",         value: blocked, icon: <AlertCircle size={18} />, color: "#EF4444" },
    { label: "Taxa de Conclusão",  value: `${completion}%`, icon: <TrendingUp size={18} />, color: "#FBBF24" },
    { label: "Sem Owner",          value: noOwner, icon: <Users size={18} />, color: noOwner > 0 ? "#EF4444" : "#34D399" },
  ];

  return (
    <div className="grid gap-5 pb-6" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto 1fr" }}>
      {/* Metric cards */}
      <div className="col-span-2 grid gap-3" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {metricCards.map(m => (
          <div
            key={m.label}
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "#0F1729", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#64748B" }}>{m.label}</span>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}>{m.value}</span>
            <div className="h-px" style={{ background: `${m.color}22` }} />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl p-5" style={{ background: "#0F1729", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#CBD5E1", fontFamily: "Inter, sans-serif" }}>
          Projetos por Status
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="30%">
            <XAxis
              dataKey="name"
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false} allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ background: "#131F35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E2E8F0", fontSize: 12 }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Right column: risk + upcoming */}
      <div className="flex flex-col gap-4">
        {/* At risk */}
        <div className="rounded-xl p-5" style={{ background: "#0F1729", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} style={{ color: "#EF4444" }} />
            <h3 className="text-sm font-semibold" style={{ color: "#CBD5E1", fontFamily: "Inter, sans-serif" }}>
              Projetos em Risco
            </h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
              {atRisk.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {atRisk.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#475569" }}>Nenhum projeto em risco</p>
            ) : atRisk.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <Avatar initials={p.ownerInitials} color={p.ownerColor} size={26} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "#CBD5E1" }}>{p.title}</p>
                  <StatusBadge status={p.status} />
                </div>
                <span className="text-xs font-mono" style={{ color: "#EF4444", flexShrink: 0 }}>{p.progress}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming go-lives */}
        <div className="rounded-xl p-5 flex-1" style={{ background: "#0F1729", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} style={{ color: "#34D399" }} />
            <h3 className="text-sm font-semibold" style={{ color: "#CBD5E1", fontFamily: "Inter, sans-serif" }}>
              Próximos Go-lives
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-white/[0.03]">
                <span className="text-xs font-mono w-4 text-center" style={{ color: "#334155" }}>{i + 1}</span>
                <CategoryTag category={p.category} />
                <p className="text-xs flex-1 truncate" style={{ color: "#94A3B8" }}>{p.title}</p>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "#FBBF24" }}>{fmtDate(p.endDate)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

interface ModalProps {
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
  initial?: Project;
  owners: Owner[];
}

function ProjectModal({ onClose, onSave, initial, owners }: ModalProps) {
  const OWNERS = owners.length > 0 ? owners : DEFAULT_OWNERS;
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "Validação" as Category,
    quarter: initial?.quarter ?? "Q3 2026" as Quarter,
    status: initial?.status ?? "discovery" as Status,
    progress: initial?.progress ?? 0,
    startDate: initial?.startDate ?? "2026-07-01",
    endDate: initial?.endDate ?? "2026-09-30",
    epicJira: initial?.epicJira ?? "",
    owner: initial?.owner ?? (owners[0]?.name ?? "Guilherme Bassin"),
    hasDependencies: initial?.hasDependencies ?? false,
  });

  const ownerObj = OWNERS.find(o => o.name === form.owner) ?? OWNERS[0];

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleSave() {
    if (!form.title.trim()) return;
    onSave({ ...form, ownerInitials: ownerObj.initials, ownerColor: ownerObj.color });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "#0F1729", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}>
            {initial ? "Editar Projeto" : "Novo Projeto"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10" style={{ color: "#64748B" }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          <Field label="Nome do Projeto *">
            <input
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Ex: Validação Biométrica em Tempo Real"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={2}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-all"
              style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={form.category} onChange={v => set("category", v as Category)} options={CATEGORIES} />
            </Field>
            <Field label="Quarter de Entrega">
              <Select value={form.quarter} onChange={v => set("quarter", v as Quarter)} options={QUARTERS} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status Inicial">
              <Select
                value={form.status}
                onChange={v => set("status", v as Status)}
                options={["discovery", "backlog", "dev", "homolog", "done", "blocked"]}
                labels={Object.fromEntries(KANBAN_COLS.map(s => [s, SC[s].label]))}
              />
            </Field>
            <Field label="Owner">
              <Select value={form.owner} onChange={v => set("owner", v)} options={OWNERS.map(o => o.name)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <input
                type="date"
                value={form.startDate}
                onChange={e => set("startDate", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", colorScheme: "dark" }}
              />
            </Field>
            <Field label="Previsão de Entrega">
              <input
                type="date"
                value={form.endDate}
                onChange={e => set("endDate", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", colorScheme: "dark" }}
              />
            </Field>
          </div>

          <Field label="Épico Jira">
            <input
              value={form.epicJira}
              onChange={e => set("epicJira", e.target.value)}
              placeholder="CAD-XXXX"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
              style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", fontFamily: "JetBrains Mono, monospace" }}
            />
          </Field>

          <Field label={`Progresso: ${form.progress}%`}>
            <input
              type="range" min={0} max={100}
              value={form.progress}
              onChange={e => set("progress", Number(e.target.value))}
              className="w-full accent-indigo-500"
              style={{ accentColor: "#6366F1" }}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasDependencies}
              onChange={e => set("hasDependencies", e.target.checked)}
              className="w-4 h-4 rounded accent-yellow-400"
              style={{ accentColor: "#FBBF24" }}
            />
            <span className="text-sm" style={{ color: "#94A3B8" }}>Possui dependências</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40"
            style={{ background: "#6366F1", color: "#FFFFFF" }}
          >
            {initial ? "Salvar Alterações" : "Criar Projeto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: "#64748B", fontFamily: "Inter, sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, labels }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none appearance-none"
      style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}
    >
      {options.map(o => (
        <option key={o} value={o}>{labels ? labels[o] : o}</option>
      ))}
    </select>
  );
}

// ─── Block Modal ──────────────────────────────────────────────────────────────

function BlockModal({ project, onClose, onBlock }: { project: Project; onClose: () => void; onBlock: (id: string, reason: string) => void }) {
  const [reason, setReason] = useState(project.blockedReason ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#0F1729", border: "1px solid rgba(239,68,68,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
            <AlertTriangle size={18} style={{ color: "#EF4444" }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#E2E8F0" }}>Marcar como Bloqueado</h2>
            <p className="text-xs" style={{ color: "#64748B" }}>{project.title}</p>
          </div>
        </div>
        <Field label="Motivo do Bloqueio">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Ex: Aguardando definição de API externa..."
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "#1A2540", border: "1px solid rgba(239,68,68,0.2)", color: "#E2E8F0", fontFamily: "Inter, sans-serif" }}
          />
        </Field>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8" }}>
            Cancelar
          </button>
          <button
            onClick={() => onBlock(project.id, reason)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#EF4444", color: "#fff" }}
          >
            Confirmar Bloqueio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: users, error: uErr } = await supabase
          .from("usuarios").select("*").order("created_at", { ascending: true });
        if (uErr) throw uErr;
        const loadedOwners: Owner[] = (users ?? []).map((u: any, i: number) => ({
          id: u.id,
          name: u.nome,
          initials: u.iniciais || initialsOf(u.nome),
          color: OWNER_PALETTE[i % OWNER_PALETTE.length],
        }));
        const { data: rows, error: pErr } = await supabase
          .from("projetos").select("*").order("created_at", { ascending: true });
        if (pErr) throw pErr;
        setOwners(loadedOwners);
        setProjects((rows ?? []).map((r: any) => rowToProject(r, loadedOwners)));
        setLoadError(null);
      } catch (e: any) {
        console.error("Erro ao carregar dados do Supabase:", e);
        setLoadError(e?.message ?? "Erro ao conectar ao banco de dados");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function persistUpdate(id: string, fields: Record<string, any>) {
    const { error } = await supabase.from("projetos").update(fields).eq("id", id);
    if (error) console.error("Erro ao salvar no Supabase:", error);
  }
  const [view, setView] = useState<View>("roadmap");
  const [search, setSearch] = useState("");
  const [filterQuarter, setFilterQuarter] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [blockProject, setBlockProject] = useState<Project | null>(null);

  const filtered = projects.filter(p =>
    search === "" || p.title.toLowerCase().includes(search.toLowerCase()) || p.epicJira.toLowerCase().includes(search.toLowerCase())
  );

  function moveProject(id: string, status: Status) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status } : p));
    persistUpdate(id, { status });
  }

  function unblockProject(id: string) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: "dev", blockedReason: undefined } : p));
    persistUpdate(id, { status: "dev", mensagem_alerta: null });
  }

  function deleteProject(id: string) {
    setProjects(ps => ps.filter(p => p.id !== id));
    supabase.from("projetos").delete().eq("id", id)
      .then(({ error }) => { if (error) console.error("Erro ao excluir no Supabase:", error); });
  }

  async function saveProject(data: Partial<Project>) {
    if (editProject) {
      const merged = { ...editProject, ...data };
      setProjects(ps => ps.map(p => p.id === editProject.id ? merged : p));
      setEditProject(null);
      persistUpdate(editProject.id, projectToRow(merged, owners));
    } else {
      setCreateOpen(false);
      const row = projectToRow({ ...data, tags: data.tags ?? [] }, owners);
      const { data: inserted, error } = await supabase
        .from("projetos").insert(row).select().single();
      if (error || !inserted) {
        console.error("Erro ao criar projeto no Supabase:", error);
        alert("Erro ao salvar o projeto no banco de dados. Tente novamente.");
        return;
      }
      setProjects(ps => [...ps, rowToProject(inserted, owners)]);
    }
  }

  function blockConfirm(id: string, reason: string) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: "blocked", blockedReason: reason } : p));
    setBlockProject(null);
    persistUpdate(id, { status: "blocked", mensagem_alerta: reason });
  }

  const blockedCount = projects.filter(p => p.status === "blocked").length;
  const doneCount = projects.filter(p => p.status === "done").length;
  const devCount = projects.filter(p => p.status === "dev").length;

  const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "roadmap",   label: "Roadmap",  icon: <LayoutGrid size={14} /> },
    { id: "timeline",  label: "Timeline", icon: <BarChart3 size={14} /> },
    { id: "dashboard", label: "Dashboard", icon: <Activity size={14} /> },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#080E1C", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <header className="flex-shrink-0 border-b px-6 py-3 flex items-center gap-4" style={{ borderColor: "rgba(255,255,255,0.07)", background: "#0A1020" }}>
        {/* Brand */}
        <div className="flex items-center gap-3 pr-6 border-r" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            <Target size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: "#E2E8F0" }}>Squad Cadastro</p>
            <p className="text-xs leading-tight" style={{ color: "#475569" }}>Agibank · Roadmap 2025</p>
          </div>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: view === v.id ? "#1A2540" : "transparent",
                color: view === v.id ? "#E2E8F0" : "#475569",
                border: view === v.id ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-4 ml-2">
          <Stat label="Em Dev" value={devCount} color="#FB923C" />
          <Stat label="Concluídos" value={doneCount} color="#34D399" />
          {blockedCount > 0 && <Stat label="Bloqueados" value={blockedCount} color="#EF4444" pulse />}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar projeto ou épico..."
            className="pl-8 pr-3 py-2 rounded-xl text-xs outline-none w-52 transition-all focus:w-64"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#E2E8F0" }}
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{
            background: showFilters ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${showFilters ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: showFilters ? "#818CF8" : "#64748B",
          }}
        >
          <Filter size={13} /> Filtros
        </button>

        {/* New project */}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
        >
          <Plus size={14} /> Novo Projeto
        </button>
      </header>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", background: "#090F1D" }}>
          <FilterSelect label="Quarter" value={filterQuarter} onChange={setFilterQuarter} options={["all", ...QUARTERS]} labels={{ all: "Todos os Quarters" }} />
          <FilterSelect label="Categoria" value={filterCategory} onChange={setFilterCategory} options={["all", ...CATEGORIES]} labels={{ all: "Todas as Categorias" }} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus}
            options={["all", ...KANBAN_COLS]}
            labels={{ all: "Todos os Status", ...Object.fromEntries(KANBAN_COLS.map(s => [s, SC[s].label])) }}
          />
          {(filterQuarter !== "all" || filterCategory !== "all" || filterStatus !== "all" || search) && (
            <button
              onClick={() => { setFilterQuarter("all"); setFilterCategory("all"); setFilterStatus("all"); setSearch(""); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <X size={11} /> Limpar Filtros
            </button>
          )}
          <span className="ml-auto text-xs font-mono" style={{ color: "#475569" }}>
            {filtered.length} de {projects.length} projetos
          </span>
        </div>
      )}

      {/* Loading / error banners */}
      {loading && (
        <div className="px-6 py-2 text-xs" style={{ color: "#94A3B8", background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
          Carregando projetos do banco de dados…
        </div>
      )}
      {loadError && (
        <div className="px-6 py-2 text-xs" style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
          Erro ao conectar ao banco de dados: {loadError}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden px-6 pt-5">
        {view === "roadmap" && (
          <RoadmapView
            projects={filtered}
            filterQuarter={filterQuarter}
            filterCategory={filterCategory}
            filterStatus={filterStatus}
            onMove={moveProject}
            onEdit={setEditProject}
            onDelete={deleteProject}
            onBlock={setBlockProject}
            onUnblock={unblockProject}
            onNew={() => setCreateOpen(true)}
          />
        )}
        {view === "timeline" && (
          <div className="h-full overflow-hidden rounded-xl" style={{ background: "#0F1729", border: "1px solid rgba(255,255,255,0.07)" }}>
            <TimelineView projects={filtered} />
          </div>
        )}
        {view === "dashboard" && (
          <div className="h-full overflow-y-auto">
            <DashboardView projects={filtered} />
          </div>
        )}
      </main>

      {/* Modals */}
      {createOpen && (
        <ProjectModal onClose={() => setCreateOpen(false)} onSave={saveProject} owners={owners} />
      )}
      {editProject && (
        <ProjectModal onClose={() => setEditProject(null)} onSave={saveProject} initial={editProject} owners={owners} />
      )}
      {blockProject && (
        <BlockModal project={blockProject} onClose={() => setBlockProject(null)} onBlock={blockConfirm} />
      )}
    </div>
  );
}

// ─── Mini components ─────────────────────────────────────────────────────────

function Stat({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`relative w-1.5 h-1.5 rounded-full ${pulse ? "animate-ping absolute" : ""}`} style={{ background: color }} />
      {pulse && <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      <span className="text-xs" style={{ color: "#475569" }}>{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, labels }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; labels?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: "#475569" }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-lg px-2.5 py-1.5 outline-none appearance-none"
        style={{ background: "#1A2540", border: "1px solid rgba(255,255,255,0.1)", color: "#CBD5E1", fontFamily: "Inter, sans-serif" }}
      >
        {options.map(o => (
          <option key={o} value={o}>{labels?.[o] ?? o}</option>
        ))}
      </select>
    </div>
  );
}

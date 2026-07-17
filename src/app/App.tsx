import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus, ChevronRight, AlertTriangle, Trash2, Edit3,
  LayoutGrid, BarChart3, Search, X,
  TrendingUp, AlertCircle, Filter,
  Activity, Link2, RotateCcw, Target,
  CheckCircle2, Clock, Users, ClipboardList,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Area, FupStatus, Prioridade, FupItem,
  AREAS, FUP_STATUSES, PRIORIDADES, OWNERS,
  TEMAS_MACRO_INICIAIS, ORIGENS_INICIAIS,
  STATUS_CFG, PRIORIDADE_CFG, AREA_CFG,
  emAndamento, ownerColor, initialsOf, NEXT_STATUS,
  rowToFup, fupToRow,
} from "./dicionario";

// ─── Supabase (BASE ÚNICA do Dash — projeto do usuário, compartilhada com o
//     Controle de Demandas) ──────────────────────────────────────────────────

const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? "https://hrfcmlqhgxzwjhnwawvc.supabase.co";
const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_vu9hGerEQY1IMrZ-kNpOBQ_AH_okmx3";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type View = "roadmap" | "timeline" | "dashboard";

const KANBAN_COLS: FupStatus[] = [...FUP_STATUSES];

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ nome, size = 24 }: { nome: string; size?: number }) {
  const color = nome ? ownerColor(nome) : "#94A3B8";
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      title={nome || "Sem focal"}
    >
      {initialsOf(nome)}
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FupStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
      {status}
    </span>
  );
}

function TemaTag({ tema }: { tema: string }) {
  if (!tema) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ background: "rgba(99,102,241,0.09)", color: "#6366F1", border: "1px solid rgba(99,102,241,0.19)" }}
    >
      {tema}
    </span>
  );
}

function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const c = PRIORIDADE_CFG[prioridade];
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: c.bg, color: c.color }}>
      {prioridade}
    </span>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(15,23,42,0.08)" }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

// ─── ProjectCard ─────────────────────────────────────────────────────────────

interface CardProps {
  project: FupItem;
  onMove: (id: string, status: FupStatus) => void;
  onEdit: (project: FupItem) => void;
  onDelete: (id: string) => void;
  onBlock: (project: FupItem) => void;
  onUnblock: (id: string) => void;
  draggable?: boolean;
  onDragStart?: () => void;
}

function ProjectCard({ project, onMove, onEdit, onDelete, onBlock, onUnblock, draggable, onDragStart }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = STATUS_CFG[project.status];
  const nextSt = NEXT_STATUS[project.status];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      className="relative rounded-xl p-3.5 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing select-none transition-all duration-200"
      style={{
        background: "#FFFFFF",
        border: `1px solid ${hovered ? cfg.border : "rgba(15,23,42,0.07)"}`,
        boxShadow: hovered ? `0 4px 24px rgba(15,23,42,0.10), 0 0 0 1px ${cfg.border}` : "0 2px 8px rgba(15,23,42,0.06)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug flex-1" style={{ color: "#1E293B", fontFamily: "Inter, sans-serif" }}>
          {project.atividade}
        </p>
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors"
          style={{ color: "#64748B", background: menuOpen ? "rgba(15,23,42,0.08)" : "transparent" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="12" r="1.2"/>
          </svg>
        </button>
      </div>

      {/* Tema Macro + Prioridade */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <TemaTag tema={project.temaMacro} />
        <PrioridadeBadge prioridade={project.prioridade} />
      </div>

      {/* Progress (auxiliar Timeline) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
            progresso
          </span>
          <span className="text-xs font-medium" style={{ color: cfg.color, fontFamily: "JetBrains Mono, monospace" }}>
            {project.progresso ?? 0}%
          </span>
        </div>
        <ProgressBar value={project.progresso ?? 0} color={cfg.color} />
      </div>

      {/* Resumo de status (motivo do bloqueio quando Bloqueado) */}
      {project.status === "Bloqueado" && project.resumoStatus && (
        <div className="flex items-start gap-1.5 rounded-lg p-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
          <span className="text-xs leading-relaxed" style={{ color: "#DC2626" }}>{project.resumoStatus}</span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar nome={project.focal} size={22} />
          {project.linkRoadMap && (
            <span className="text-xs font-medium" style={{ color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
              {project.linkRoadMap}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {project.dependencias && (
            <span title={`Dependências: ${project.dependencias}`}>
              <Link2 size={11} style={{ color: "#D97706" }} />
            </span>
          )}
          <span className="text-xs" style={{ color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
            {fmtDate(project.dataLimite)}
          </span>
        </div>
      </div>

      {/* Origem + avançar */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
          {project.origem || "—"}
        </span>
        <div className={`flex items-center gap-1 transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}>
          {project.status === "Bloqueado" ? (
            <button
              onClick={() => onUnblock(project.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: "rgba(52,211,153,0.12)", color: "#10B981", border: "1px solid rgba(52,211,153,0.25)" }}
              title="Desbloquear"
            >
              <RotateCcw size={10} />
              Desbloquear
            </button>
          ) : nextSt ? (
            <button
              onClick={() => onMove(project.id, nextSt)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ background: STATUS_CFG[nextSt].bg, color: STATUS_CFG[nextSt].color, border: `1px solid ${STATUS_CFG[nextSt].border}` }}
              title={`Mover para ${nextSt}`}
            >
              {nextSt.split(" ")[0]}
              <ChevronRight size={10} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="absolute right-2 top-10 z-30 rounded-xl py-1 min-w-[160px]"
          style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", boxShadow: "0 8px 32px rgba(15,23,42,0.12)" }}
        >
          <MenuItem icon={<Edit3 size={12} />} label="Editar" onClick={() => { setMenuOpen(false); onEdit(project); }} />
          {project.status !== "Bloqueado" && (
            <MenuItem icon={<AlertTriangle size={12} />} label="Bloquear" onClick={() => { setMenuOpen(false); onBlock(project); }} color="#D97706" />
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
      style={{ color: color ?? "#64748B" }}
    >
      {icon} {label}
    </button>
  );
}

// ─── Roadmap View ─────────────────────────────────────────────────────────────

function RoadmapView({
  projects, onMove, onEdit, onDelete, onBlock, onUnblock, onNew,
}: {
  projects: FupItem[];
  onMove: (id: string, status: FupStatus) => void;
  onEdit: (p: FupItem) => void;
  onDelete: (id: string) => void;
  onBlock: (p: FupItem) => void;
  onUnblock: (id: string) => void;
  onNew: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<FupStatus | null>(null);

  return (
    <div className="flex gap-4 h-full pb-4 overflow-x-auto min-w-0 pr-2">
      {KANBAN_COLS.map(status => {
        const cfg = STATUS_CFG[status];
        const cards = projects.filter(p => p.status === status);
        const isTarget = dropTarget === status && dragId != null;

        return (
          <div
            key={status}
            className="flex-shrink-0 flex flex-col rounded-xl"
            style={{
              width: 272,
              background: "#F8FAFC",
              border: `1px solid ${isTarget ? cfg.color : "rgba(15,23,42,0.06)"}`,
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
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                <span className="text-sm font-semibold whitespace-nowrap" style={{ color: cfg.color, fontFamily: "Inter, sans-serif" }}>
                  {status}
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
                  style={{ border: "1px dashed rgba(15,23,42,0.08)", color: "#94A3B8" }}
                >
                  Arraste um card aqui
                </div>
              )}
              {status === "Backlog" && (
                <button
                  onClick={onNew}
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-xs font-medium transition-all duration-150 hover:opacity-80"
                  style={{ border: "1px dashed rgba(99,102,241,0.3)", color: "#6366F1", background: "rgba(99,102,241,0.04)" }}
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

function TimelineView({ projects }: { projects: FupItem[] }) {
  const TOTAL_MONTHS = 12;

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  function monthFrac(dateStr: string): number {
    const d = new Date(dateStr + "T12:00:00");
    const yearOffset = (d.getFullYear() - year) * 12;
    return yearOffset + d.getMonth() + (d.getDate() - 1) / 31;
  }

  // Itens com pelo menos uma data entram no gráfico; sem datas ficam listados abaixo
  const withDates = projects.filter(p => p.dataLimite || p.dataInicio);
  const noDates = projects.filter(p => !p.dataLimite && !p.dataInicio);

  const sorted = [...withDates].sort((a, b) => {
    const sa = a.dataInicio || a.dataLimite || "";
    const sb = b.dataInicio || b.dataLimite || "";
    return new Date(sa).getTime() - new Date(sb).getTime();
  });

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Year selector + quarter labels */}
      <div className="flex items-center border-b" style={{ borderColor: "rgba(15,23,42,0.07)" }}>
        <div className="flex items-center gap-1 flex-shrink-0 pl-3" style={{ width: 220 }}>
          <button onClick={() => setYear(y => y - 1)} className="px-2 py-1 rounded text-xs" style={{ color: "#64748B", background: "rgba(15,23,42,0.05)" }}>‹</button>
          <span className="text-xs font-bold px-2" style={{ color: "#475569", fontFamily: "JetBrains Mono, monospace" }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="px-2 py-1 rounded text-xs" style={{ color: "#64748B", background: "rgba(15,23,42,0.05)" }}>›</button>
        </div>
        {[`Q1 ${year}`, `Q2 ${year}`, `Q3 ${year}`, `Q4 ${year}`].map(q => (
          <div key={q} className="flex-1 text-center text-xs font-semibold py-2" style={{ color: "#94A3B8" }}>
            {q}
          </div>
        ))}
      </div>

      {/* Month labels */}
      <div className="flex border-b" style={{ borderColor: "rgba(15,23,42,0.05)", paddingLeft: 220 }}>
        {MONTHS_PT.map(m => (
          <div key={m} className="flex-1 text-center py-1.5" style={{ fontSize: 10, color: "#94A3B8", fontFamily: "JetBrains Mono, monospace" }}>
            {m}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(p => {
          const start = p.dataInicio || p.dataLimite;
          const end = p.dataLimite || p.dataInicio;
          const startFrac = Math.max(0, Math.min(1, monthFrac(start!) / TOTAL_MONTHS));
          const endFrac = Math.max(0, Math.min(1, (monthFrac(end!) + 0.9) / TOTAL_MONTHS));
          const widthFrac = Math.max(0.01, endFrac - startFrac);
          const cfg = STATUS_CFG[p.status];
          const visible = endFrac > 0 && startFrac < 1;

          return (
            <div
              key={p.id}
              className="flex items-center border-b hover:bg-white/[0.02] transition-colors"
              style={{ borderColor: "rgba(15,23,42,0.04)", minHeight: 56 }}
            >
              {/* Project info */}
              <div className="flex-shrink-0 flex items-center gap-2.5 pr-4 pl-3" style={{ width: 220 }}>
                <Avatar nome={p.focal} size={22} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "#475569", maxWidth: 155 }} title={p.atividade}>{p.atividade}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>

              {/* Gantt area */}
              <div className="flex-1 relative" style={{ height: 56 }}>
                {MONTHS_PT.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0"
                    style={{ left: `${(i / TOTAL_MONTHS) * 100}%`, width: 1, background: "rgba(15,23,42,0.035)" }}
                  />
                ))}

                {visible && (
                  <>
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
                      <div
                        className="absolute inset-0 rounded-lg"
                        style={{ width: `${p.progresso ?? 0}%`, background: `${cfg.color}22` }}
                      />
                      <span className="relative text-xs font-medium truncate" style={{ color: cfg.color, fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
                        {p.progresso ?? 0}%
                      </span>
                      {p.dependencias && (
                        <Link2 size={9} className="relative ml-1 flex-shrink-0" style={{ color: "#D97706" }} />
                      )}
                    </div>

                    {/* Data limite (diamond) */}
                    <div
                      className="absolute top-1/2"
                      style={{
                        left: `calc(${endFrac * 100}% - 6px)`,
                        transform: "translateY(-50%) rotate(45deg)",
                        width: 10, height: 10,
                        background: cfg.color,
                        border: "2px solid #F4F6FB",
                        borderRadius: 2,
                      }}
                      title={`Data limite: ${fmtDate(p.dataLimite)}`}
                    />
                  </>
                )}
                {!visible && (
                  <span className="absolute top-1/2 -translate-y-1/2 left-3 text-xs" style={{ color: "#CBD5E1", fontFamily: "JetBrains Mono, monospace" }}>
                    fora de {year}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {noDates.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs mb-2 font-semibold" style={{ color: "#94A3B8" }}>Sem datas definidas ({noDates.length})</p>
            <div className="flex flex-wrap gap-2">
              {noDates.map(p => (
                <span key={p.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(15,23,42,0.04)", color: "#64748B" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CFG[p.status].color }} />
                  {p.atividade}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard View (Controle de Vertical) ───────────────────────────────────

function DashboardView({ projects, onCadastro }: { projects: FupItem[]; onCadastro: () => void }) {
  const counts = KANBAN_COLS.map(s => ({ status: s, count: projects.filter(p => p.status === s).length }));
  const total = projects.length;
  const done = projects.filter(p => p.status === "Concluído").length;
  const blocked = projects.filter(p => p.status === "Bloqueado").length;
  const andamento = projects.filter(p => emAndamento(p.status)).length;
  const semFocal = projects.filter(p => !p.focal).length;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  const atRisk = projects.filter(p =>
    p.status === "Bloqueado" ||
    (p.prioridade === "Crítico" && p.status !== "Concluído" && p.status !== "Cancelado")
  );

  const upcoming = projects
    .filter(p => p.status !== "Concluído" && p.status !== "Cancelado" && p.status !== "Bloqueado" && p.dataLimite)
    .sort((a, b) => new Date(a.dataLimite).getTime() - new Date(b.dataLimite).getTime())
    .slice(0, 5);

  const chartData = counts
    .filter(c => c.count > 0)
    .map(c => ({ name: c.status, value: c.count, color: STATUS_CFG[c.status].color }));

  const metricCards = [
    { label: "Total de Projetos", value: total, icon: <Target size={18} />, color: "#6366F1" },
    { label: "Em Andamento",      value: andamento, icon: <Activity size={18} />, color: "#EA580C" },
    { label: "Concluídos",        value: done,    icon: <CheckCircle2 size={18} />, color: "#10B981" },
    { label: "Bloqueados",        value: blocked, icon: <AlertCircle size={18} />, color: "#EF4444" },
    { label: "Taxa de Conclusão", value: `${completion}%`, icon: <TrendingUp size={18} />, color: "#D97706" },
    { label: "Sem Focal",         value: semFocal, icon: <Users size={18} />, color: semFocal > 0 ? "#EF4444" : "#10B981" },
  ];

  return (
    <div className="grid gap-5 pb-6" style={{ gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto 1fr" }}>
      {/* Botão de Cadastro — conecta ao fluxo de cadastro de projetos existente */}
      <div className="col-span-2 flex items-center justify-between rounded-xl p-4" style={{ background: "#FFFFFF", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.12)" }}>
            <ClipboardList size={18} style={{ color: "#6366F1" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#1E293B" }}>Cadastro de Projetos</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Novos projetos alimentam automaticamente o Roadmap e a Timeline</p>
          </div>
        </div>
        <button
          onClick={onCadastro}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", boxShadow: "0 4px 16px rgba(99,102,241,0.35)" }}
        >
          <Plus size={14} /> Cadastro
        </button>
      </div>

      {/* Metric cards */}
      <div className="col-span-2 grid gap-3" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {metricCards.map(m => (
          <div
            key={m.label}
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#64748B" }}>{m.label}</span>
              <span style={{ color: m.color }}>{m.icon}</span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#1E293B", fontFamily: "Inter, sans-serif" }}>{m.value}</span>
            <div className="h-px" style={{ background: `${m.color}22` }} />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.07)" }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}>
          Projetos por Status
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="30%">
            <XAxis
              dataKey="name"
              tick={{ fill: "#94A3B8", fontSize: 9, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50}
            />
            <YAxis
              tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false} tickLine={false} allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#1E293B", fontSize: 12 }}
              cursor={{ fill: "rgba(15,23,42,0.03)" }}
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
        <div className="rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={14} style={{ color: "#EF4444" }} />
            <h3 className="text-sm font-semibold" style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}>
              Projetos em Risco
            </h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
              {atRisk.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {atRisk.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#94A3B8" }}>Nenhum projeto em risco</p>
            ) : atRisk.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <Avatar nome={p.focal} size={26} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "#475569" }}>{p.atividade}</p>
                  <StatusBadge status={p.status} />
                </div>
                <PrioridadeBadge prioridade={p.prioridade} />
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="rounded-xl p-5 flex-1" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.07)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} style={{ color: "#10B981" }} />
            <h3 className="text-sm font-semibold" style={{ color: "#475569", fontFamily: "Inter, sans-serif" }}>
              Próximas Datas Limite
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "#94A3B8" }}>Nenhuma data limite próxima</p>
            ) : upcoming.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-white/[0.03]">
                <span className="text-xs font-mono w-4 text-center" style={{ color: "#94A3B8" }}>{i + 1}</span>
                <TemaTag tema={p.temaMacro} />
                <p className="text-xs flex-1 truncate" style={{ color: "#64748B" }}>{p.atividade}</p>
                <span className="text-xs font-mono flex-shrink-0" style={{ color: "#D97706" }}>{fmtDate(p.dataLimite)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Modal (fluxo de cadastro de projetos) ─────────────────────

interface ModalProps {
  onClose: () => void;
  onSave: (data: Partial<FupItem>) => void;
  initial?: FupItem;
  defaultArea: Area;
  temasMacro: string[];
  origens: string[];
  onAddTema: (v: string) => void;
  onAddOrigem: (v: string) => void;
}

const ADD_NEW = "__add_new__";

function ProjectModal({ onClose, onSave, initial, defaultArea, temasMacro, origens, onAddTema, onAddOrigem }: ModalProps) {
  const [form, setForm] = useState<Partial<FupItem>>({
    atividade: initial?.atividade ?? "",
    area: initial?.area ?? defaultArea,
    origem: initial?.origem ?? (origens[0] ?? ""),
    temaMacro: initial?.temaMacro ?? (temasMacro[0] ?? ""),
    status: initial?.status ?? "Backlog",
    descricao: initial?.descricao ?? "",
    resumoStatus: initial?.resumoStatus ?? "",
    focal: initial?.focal ?? "",
    prioridade: initial?.prioridade ?? "Médio",
    dataLimite: initial?.dataLimite ?? "",
    dependencias: initial?.dependencias ?? "",
    linkUX: initial?.linkUX ?? "",
    linkRoadMap: initial?.linkRoadMap ?? "",
    dataInicio: initial?.dataInicio ?? "",
    progresso: initial?.progresso ?? 0,
  });

  function set<K extends keyof FupItem>(k: K, v: FupItem[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleDynamicSelect(value: string, kind: "temaMacro" | "origem") {
    if (value === ADD_NEW) {
      const novo = window.prompt(kind === "temaMacro" ? "Novo Tema Macro:" : "Nova Origem:");
      const trimmed = novo?.trim();
      if (!trimmed) return;
      if (kind === "temaMacro") { onAddTema(trimmed); set("temaMacro", trimmed); }
      else { onAddOrigem(trimmed); set("origem", trimmed); }
    } else {
      set(kind, value);
    }
  }

  function handleSave() {
    if (!form.atividade?.trim()) return;
    onSave(form);
  }

  const inputStyle = { background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#1E293B", fontFamily: "Inter, sans-serif" } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", boxShadow: "0 24px 64px rgba(15,23,42,0.15)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: "#1E293B", fontFamily: "Inter, sans-serif" }}>
            {initial ? "Editar Projeto" : "Novo Projeto"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10" style={{ color: "#64748B" }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4">
          <Field label="Atividade *">
            <input
              value={form.atividade}
              onChange={e => set("atividade", e.target.value)}
              placeholder="Ex: Atualização Cadastral com Fluxo de Consequência"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              rows={2}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-all"
              style={inputStyle}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Área / Frente">
              <Select value={form.area!} onChange={v => set("area", v as Area)} options={AREAS} />
            </Field>
            <Field label="Origem">
              <Select
                value={form.origem!}
                onChange={v => handleDynamicSelect(v, "origem")}
                options={[...origens, ADD_NEW]}
                labels={{ [ADD_NEW]: "+ Adicionar nova..." }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tema Macro">
              <Select
                value={form.temaMacro!}
                onChange={v => handleDynamicSelect(v, "temaMacro")}
                options={[...temasMacro, ADD_NEW]}
                labels={{ [ADD_NEW]: "+ Adicionar novo..." }}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status!} onChange={v => set("status", v as FupStatus)} options={FUP_STATUSES} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Focal">
              <Select value={form.focal!} onChange={v => set("focal", v)} options={["", ...OWNERS]} labels={{ "": "— Sem focal —" }} />
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade!} onChange={v => set("prioridade", v as Prioridade)} options={PRIORIDADES} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Início (Timeline)">
              <input
                type="date"
                value={form.dataInicio}
                onChange={e => set("dataInicio", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
            <Field label="Data Limite">
              <input
                type="date"
                value={form.dataLimite}
                onChange={e => set("dataLimite", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Resumo de Status">
            <input
              value={form.resumoStatus}
              onChange={e => set("resumoStatus", e.target.value)}
              placeholder="Ex: Subida prevista para 11/08"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </Field>

          <Field label="Dependências">
            <input
              value={form.dependencias}
              onChange={e => set("dependencias", e.target.value)}
              placeholder="Ex: API dos Correios; Squad Plataforma"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Link UX">
              <input
                value={form.linkUX}
                onChange={e => set("linkUX", e.target.value)}
                placeholder="https://figma.com/..."
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }}
              />
            </Field>
            <Field label="Link RoadMap / Épico">
              <input
                value={form.linkRoadMap}
                onChange={e => set("linkRoadMap", e.target.value)}
                placeholder="Roadmap: 2058 / TPLAT-805"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-mono"
                style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }}
              />
            </Field>
          </div>

          <Field label={`Progresso (Timeline): ${form.progresso ?? 0}%`}>
            <input
              type="range" min={0} max={100}
              value={form.progresso ?? 0}
              onChange={e => set("progresso", Number(e.target.value))}
              className="w-full accent-indigo-500"
              style={{ accentColor: "#6366F1" }}
            />
          </Field>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: "rgba(15,23,42,0.07)" }}>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(15,23,42,0.05)", color: "#64748B", border: "1px solid rgba(15,23,42,0.08)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.atividade?.trim()}
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
      style={{ background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#1E293B", fontFamily: "Inter, sans-serif" }}
    >
      {options.map(o => (
        <option key={o} value={o}>{labels?.[o] ?? o}</option>
      ))}
    </select>
  );
}

// ─── Block Modal ──────────────────────────────────────────────────────────────

function BlockModal({ project, onClose, onBlock }: { project: FupItem; onClose: () => void; onBlock: (id: string, reason: string) => void }) {
  const [reason, setReason] = useState(project.status === "Bloqueado" ? project.resumoStatus : "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#FFFFFF", border: "1px solid rgba(239,68,68,0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
            <AlertTriangle size={18} style={{ color: "#EF4444" }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#1E293B" }}>Marcar como Bloqueado</h2>
            <p className="text-xs" style={{ color: "#64748B" }}>{project.atividade}</p>
          </div>
        </div>
        <Field label="Motivo do Bloqueio (Resumo de Status)">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Ex: Aguardando definição de API externa..."
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "#EEF2F7", border: "1px solid rgba(239,68,68,0.2)", color: "#1E293B", fontFamily: "Inter, sans-serif" }}
          />
        </Field>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: "rgba(15,23,42,0.05)", color: "#64748B" }}>
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

function areaFromHash(): Area {
  const h = window.location.hash.toLowerCase();
  if (h.includes("conta-corrente")) return "Conta Corrente";
  if (h.includes("app")) return "APP";
  return "Cadastro";
}

export default function App() {
  const [projects, setProjects] = useState<FupItem[]>([]);
  const [temasMacro, setTemasMacro] = useState<string[]>(TEMAS_MACRO_INICIAIS);
  const [origens, setOrigens] = useState<string[]>(ORIGENS_INICIAIS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Área ativa (páginas: Cadastro | Conta Corrente | APP)
  const [area, setArea] = useState<Area>(areaFromHash());

  async function loadAll() {
    try {
      const [{ data: rows, error: pErr }, { data: listas, error: lErr }] = await Promise.all([
        supabase.from("fup_items").select("*").order("created_at", { ascending: true }),
        supabase.from("listas").select("*"),
      ]);
      if (pErr) throw pErr;
      if (lErr) throw lErr;
      setProjects((rows ?? []).map(rowToFup));
      const temas = (listas ?? []).filter((l: any) => l.tipo === "temaMacro").map((l: any) => l.valor);
      const orgs = (listas ?? []).filter((l: any) => l.tipo === "origem").map((l: any) => l.valor);
      if (temas.length) setTemasMacro(temas);
      if (orgs.length) setOrigens(orgs);
      setLoadError(null);
    } catch (e: any) {
      console.error("Erro ao carregar dados do Supabase:", e);
      setLoadError(e?.message ?? "Erro ao conectar ao banco de dados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();

    // Sincronização em tempo real: alterações feitas no Controle de Demandas
    // (ou em outra aba) refletem aqui automaticamente.
    const channel = supabase
      .channel("dash-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "fup_items" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "listas" }, () => loadAll())
      .subscribe();

    const onHash = () => setArea(areaFromHash());
    window.addEventListener("hashchange", onHash);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  function selectArea(a: Area) {
    setArea(a);
    const slug = a === "Conta Corrente" ? "conta-corrente" : a.toLowerCase();
    window.location.hash = `/${slug}`;
  }

  async function persistUpdate(id: string, fields: Record<string, any>) {
    const { error } = await supabase.from("fup_items").update(fields).eq("id", id);
    if (error) console.error("Erro ao salvar no Supabase:", error);
  }

  async function addLista(tipo: "temaMacro" | "origem", valor: string) {
    if (tipo === "temaMacro") setTemasMacro(ts => ts.includes(valor) ? ts : [...ts, valor]);
    else setOrigens(os => os.includes(valor) ? os : [...os, valor]);
    const { error } = await supabase.from("listas").upsert({ tipo, valor }, { onConflict: "tipo,valor" });
    if (error) console.error("Erro ao salvar lista:", error);
  }

  const [view, setView] = useState<View>("roadmap");
  const [search, setSearch] = useState("");
  const [filterTema, setFilterTema] = useState("all");
  const [filterOrigem, setFilterOrigem] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPrioridade, setFilterPrioridade] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<FupItem | null>(null);
  const [blockProject, setBlockProject] = useState<FupItem | null>(null);

  const areaProjects = useMemo(() => projects.filter(p => p.area === area), [projects, area]);

  const filtered = areaProjects.filter(p =>
    (search === "" ||
      p.atividade.toLowerCase().includes(search.toLowerCase()) ||
      p.linkRoadMap.toLowerCase().includes(search.toLowerCase())) &&
    (filterTema === "all" || p.temaMacro === filterTema) &&
    (filterOrigem === "all" || p.origem === filterOrigem) &&
    (filterStatus === "all" || p.status === filterStatus) &&
    (filterPrioridade === "all" || p.prioridade === filterPrioridade)
  );

  function moveProject(id: string, status: FupStatus) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status } : p));
    persistUpdate(id, { status });
  }

  function unblockProject(id: string) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: "Desenv. Técnico" as FupStatus, resumoStatus: "" } : p));
    persistUpdate(id, { status: "Desenv. Técnico", resumo_status: "" });
  }

  function deleteProject(id: string) {
    setProjects(ps => ps.filter(p => p.id !== id));
    supabase.from("fup_items").delete().eq("id", id)
      .then(({ error }) => { if (error) console.error("Erro ao excluir no Supabase:", error); });
  }

  async function saveProject(data: Partial<FupItem>) {
    if (editProject) {
      const merged = { ...editProject, ...data };
      setProjects(ps => ps.map(p => p.id === editProject.id ? merged : p));
      setEditProject(null);
      persistUpdate(editProject.id, fupToRow(merged));
    } else {
      setCreateOpen(false);
      const { data: inserted, error } = await supabase
        .from("fup_items").insert(fupToRow(data)).select().single();
      if (error || !inserted) {
        console.error("Erro ao criar projeto no Supabase:", error);
        alert("Erro ao salvar o projeto no banco de dados. Tente novamente.");
        return;
      }
      setProjects(ps => [...ps, rowToFup(inserted)]);
    }
  }

  function blockConfirm(id: string, reason: string) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: "Bloqueado" as FupStatus, resumoStatus: reason } : p));
    setBlockProject(null);
    persistUpdate(id, { status: "Bloqueado", resumo_status: reason });
  }

  const blockedCount = areaProjects.filter(p => p.status === "Bloqueado").length;
  const doneCount = areaProjects.filter(p => p.status === "Concluído").length;
  const andamentoCount = areaProjects.filter(p => emAndamento(p.status)).length;

  const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "roadmap",   label: "Roadmap",  icon: <LayoutGrid size={14} /> },
    { id: "timeline",  label: "Timeline", icon: <BarChart3 size={14} /> },
    { id: "dashboard", label: "Controle de Vertical", icon: <Activity size={14} /> },
  ];

  const hasActiveFilters = filterTema !== "all" || filterOrigem !== "all" || filterStatus !== "all" || filterPrioridade !== "all" || search;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#F4F6FB", fontFamily: "Inter, sans-serif" }}>

      {/* Header */}
      <header className="flex-shrink-0 border-b px-6 py-3 flex items-center gap-4" style={{ borderColor: "rgba(15,23,42,0.07)", background: "#FFFFFF" }}>
        {/* Brand */}
        <div className="flex items-center gap-3 pr-6 border-r" style={{ borderColor: "rgba(15,23,42,0.07)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg,${AREA_CFG[area].color},#8B5CF6)` }}>
            <Target size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: "#1E293B" }}>Vertical {area}</p>
            <p className="text-xs leading-tight" style={{ color: "#94A3B8" }}>Agibank · Dash Unificado</p>
          </div>
        </div>

        {/* Area selector (páginas por frente) */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.06)" }}>
          {AREAS.map(a => (
            <button
              key={a}
              onClick={() => selectArea(a)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: area === a ? AREA_CFG[a].color : "transparent",
                color: area === a ? "#FFFFFF" : "#94A3B8",
              }}
            >
              {AREA_CFG[a].short}
            </button>
          ))}
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.06)" }}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap"
              style={{
                background: view === v.id ? "#EEF2F7" : "transparent",
                color: view === v.id ? "#1E293B" : "#94A3B8",
                border: view === v.id ? "1px solid rgba(15,23,42,0.1)" : "1px solid transparent",
              }}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Quick stats */}
        <div className="hidden lg:flex items-center gap-4 ml-2">
          <Stat label="Em Andamento" value={andamentoCount} color="#EA580C" />
          <Stat label="Concluídos" value={doneCount} color="#10B981" />
          {blockedCount > 0 && <Stat label="Bloqueados" value={blockedCount} color="#EF4444" pulse />}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar atividade ou roadmap..."
            className="pl-8 pr-3 py-2 rounded-xl text-xs outline-none w-52 transition-all focus:w-64"
            style={{ background: "rgba(15,23,42,0.05)", border: "1px solid rgba(15,23,42,0.08)", color: "#1E293B" }}
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
          style={{
            background: showFilters ? "rgba(99,102,241,0.15)" : "rgba(15,23,42,0.05)",
            border: `1px solid ${showFilters ? "rgba(99,102,241,0.4)" : "rgba(15,23,42,0.08)"}`,
            color: showFilters ? "#6366F1" : "#64748B",
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
        <div className="flex-shrink-0 flex items-center gap-4 px-6 py-3 border-b flex-wrap" style={{ borderColor: "rgba(15,23,42,0.05)", background: "#F4F6FB" }}>
          <FilterSelect label="Tema Macro" value={filterTema} onChange={setFilterTema} options={["all", ...temasMacro]} labels={{ all: "Todos os Temas" }} />
          <FilterSelect label="Origem" value={filterOrigem} onChange={setFilterOrigem} options={["all", ...origens]} labels={{ all: "Todas as Origens" }} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={["all", ...FUP_STATUSES]} labels={{ all: "Todos os Status" }} />
          <FilterSelect label="Prioridade" value={filterPrioridade} onChange={setFilterPrioridade} options={["all", ...PRIORIDADES]} labels={{ all: "Todas" }} />
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterTema("all"); setFilterOrigem("all"); setFilterStatus("all"); setFilterPrioridade("all"); setSearch(""); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <X size={11} /> Limpar Filtros
            </button>
          )}
          <span className="ml-auto text-xs font-mono" style={{ color: "#94A3B8" }}>
            {filtered.length} de {areaProjects.length} projetos
          </span>
        </div>
      )}

      {/* Loading / error banners */}
      {loading && (
        <div className="px-6 py-2 text-xs" style={{ color: "#64748B", background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
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
            onMove={moveProject}
            onEdit={setEditProject}
            onDelete={deleteProject}
            onBlock={setBlockProject}
            onUnblock={unblockProject}
            onNew={() => setCreateOpen(true)}
          />
        )}
        {view === "timeline" && (
          <div className="h-full overflow-hidden rounded-xl" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.07)" }}>
            <TimelineView projects={filtered} />
          </div>
        )}
        {view === "dashboard" && (
          <div className="h-full overflow-y-auto">
            <DashboardView projects={filtered} onCadastro={() => setCreateOpen(true)} />
          </div>
        )}
      </main>

      {/* Modals (fluxo de cadastro de projetos — único para todas as telas) */}
      {createOpen && (
        <ProjectModal
          onClose={() => setCreateOpen(false)}
          onSave={saveProject}
          defaultArea={area}
          temasMacro={temasMacro}
          origens={origens}
          onAddTema={v => addLista("temaMacro", v)}
          onAddOrigem={v => addLista("origem", v)}
        />
      )}
      {editProject && (
        <ProjectModal
          onClose={() => setEditProject(null)}
          onSave={saveProject}
          initial={editProject}
          defaultArea={area}
          temasMacro={temasMacro}
          origens={origens}
          onAddTema={v => addLista("temaMacro", v)}
          onAddOrigem={v => addLista("origem", v)}
        />
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
      <span className="text-xs" style={{ color: "#94A3B8" }}>{label}</span>
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
      <span className="text-xs" style={{ color: "#94A3B8" }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-lg px-2.5 py-1.5 outline-none appearance-none"
        style={{ background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#475569", fontFamily: "Inter, sans-serif" }}
      >
        {options.map(o => (
          <option key={o} value={o}>{labels?.[o] ?? o}</option>
        ))}
      </select>
    </div>
  );
}

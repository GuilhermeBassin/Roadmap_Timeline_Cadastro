// ============================================================================
// Integração Jira (Agibank) — vínculo por chave (ex.: ROADMAP-2058), status/
// prioridade puxados do Jira e sincronizados conforme o card evolui.
//
// As credenciais NÃO ficam no front nem no banco: vivem como env vars
// seguras na Vercel (JIRA_URL, JIRA_EMAIL, JIRA_TOKEN, JIRA_PROJETO) e são
// usadas apenas pela API Route /api/jira. O front só chama a API.
// ============================================================================
import { useEffect, useState } from "react";
import { X, Plug, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { FupItem } from "./dicionario";
import { api } from "./api";

const SYNC_THROTTLE_MS = 30 * 60 * 1000; // sync automática: no máx. a cada 30 min

// ── Vínculo por chave ───────────────────────────────────────────────────────

/** Extrai a chave Jira de um projeto: campo jiraKey ou linkRoadMap
 *  ("Roadmap: 2058" → ROADMAP-2058 · "TPLAT-805" → TPLAT-805). */
export function chaveJiraDe(p: FupItem, projetoPadrao = "ROADMAP"): string | null {
  if (p.jiraKey?.trim()) return p.jiraKey.trim().toUpperCase();
  const lr = (p.linkRoadMap ?? "").trim();
  if (!lr) return null;
  let m = lr.match(/^([A-Za-z][A-Za-z0-9]+)-(\d+)$/);          // TPLAT-805
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;
  m = lr.match(/^roadmap\s*:?\s*(\d+)$/i);                     // Roadmap: 2058
  if (m) return `${projetoPadrao}-${m[1]}`;
  return null;
}

// ── Sincronização ───────────────────────────────────────────────────────────

export interface SyncResultado { sincronizados: number; concluidosNoJira: number; }

/** Puxa status/prioridade do Jira para todos os projetos vinculados e grava
 *  no banco. Card cuja categoria no Jira é "done" evolui para Concluído no
 *  Dash; demais casos espelham o status Jira no chip "via Jira". */
export async function sincronizarComJira(projects: FupItem[], projetoPadrao = "ROADMAP"): Promise<SyncResultado> {
  const vinculados = projects
    .map(p => ({ p, key: chaveJiraDe(p, projetoPadrao) }))
    .filter((x): x is { p: FupItem; key: string } => !!x.key);
  if (!vinculados.length) return { sincronizados: 0, concluidosNoJira: 0 };

  const issues = await api.jiraIssues([...new Set(vinculados.map(v => v.key))]);
  const porChave = new Map(issues.map(i => [i.key, i]));
  const agora = new Date().toISOString();

  let sincronizados = 0, concluidos = 0;
  for (const { p, key } of vinculados) {
    const issue = porChave.get(key);
    if (!issue) continue;
    const fields: Record<string, any> = {
      jira_key: key,
      jira_status: issue.status,
      jira_prioridade: issue.prioridade,
      jira_sync_at: agora,
    };
    // Card movido no Jira → status do Dash evolui junto (regra conservadora:
    // apenas conclusão é automática; estados intermediários são espelhados
    // no chip "via Jira" sem sobrescrever o detalhamento interno do Dash)
    if (issue.statusCategory === "done" && p.status !== "Concluído" && p.status !== "Cancelado") {
      fields.status = "Concluído";
      concluidos++;
    }
    try { await api.fupUpdate(p.id, fields); sincronizados++; }
    catch (e) { console.error(`Erro ao sincronizar ${key}:`, e); }
  }
  return { sincronizados, concluidosNoJira: concluidos };
}

/** Sync automática no carregamento (no máx. a cada 30 min), silenciosa. */
export async function syncAutomatica(projects: FupItem[]) {
  try {
    const last = Number(localStorage.getItem("jira_last_sync") ?? 0);
    if (Date.now() - last < SYNC_THROTTLE_MS) return;
    const cfg = await api.jiraConfig();
    if (!cfg.configured) return;
    localStorage.setItem("jira_last_sync", String(Date.now()));
    await sincronizarComJira(projects, cfg.projeto);
  } catch (e) {
    console.warn("Sync automática do Jira falhou (silencioso):", e);
  }
}

// ── Modal de status/sincronização ───────────────────────────────────────────

export function JiraConfigModal({ projects, onClose, onSynced }: {
  projects: FupItem[]; onClose: () => void; onSynced: () => void;
}) {
  const [cfg, setCfg] = useState<{ configured: boolean; projeto: string } | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [busy, setBusy] = useState<"" | "teste" | "sync">("");

  useEffect(() => {
    api.jiraConfig().then(setCfg).catch(() => setCfg({ configured: false, projeto: "ROADMAP" }));
  }, []);

  async function testar() {
    setBusy("teste"); setMsg(null);
    try {
      const r = await api.jiraTest();
      setMsg({ tipo: "ok", texto: `Conexão OK — autenticado como ${r.displayName} (projeto ${r.projeto})` });
    } catch (e: any) { setMsg({ tipo: "erro", texto: e?.message ?? "Falha na conexão" }); }
    finally { setBusy(""); }
  }

  async function sincronizar() {
    setBusy("sync"); setMsg(null);
    try {
      const r = await sincronizarComJira(projects, cfg?.projeto ?? "ROADMAP");
      localStorage.setItem("jira_last_sync", String(Date.now()));
      setMsg({
        tipo: "ok",
        texto: `${r.sincronizados} projeto(s) sincronizado(s)` +
          (r.concluidosNoJira ? ` · ${r.concluidosNoJira} evoluíram para Concluído` : "") +
          (r.sincronizados === 0 ? " — nenhum projeto com vínculo Jira (Chave Jira ou 'Roadmap: NNNN' no Link RoadMap)" : ""),
      });
      onSynced();
    } catch (e: any) { setMsg({ tipo: "erro", texto: e?.message ?? "Erro na sincronização" }); }
    finally { setBusy(""); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", boxShadow: "0 24px 64px rgba(15,23,42,0.15)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug size={16} style={{ color: "#0033B0" }} />
            <h2 className="text-base font-bold" style={{ color: "#1E293B" }}>Integração Jira</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "#64748B" }}><X size={16} /></button>
        </div>

        {cfg === null ? (
          <p className="text-xs" style={{ color: "#94A3B8" }}>Verificando configuração…</p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{
              background: cfg.configured ? "rgba(16,185,129,0.08)" : "rgba(234,88,12,0.08)",
              border: `1px solid ${cfg.configured ? "rgba(16,185,129,0.25)" : "rgba(234,88,12,0.3)"}`,
              color: cfg.configured ? "#059669" : "#EA580C",
            }}>
              {cfg.configured
                ? <>Credenciais configuradas no ambiente seguro (Vercel) · projeto <b>{cfg.projeto}</b></>
                : <>Credenciais ausentes — defina JIRA_URL, JIRA_EMAIL e JIRA_TOKEN (e opcionalmente JIRA_PROJETO) nas Environment Variables da Vercel e faça redeploy</>}
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
              Vínculo por projeto: preencha a Chave Jira no cadastro (ex.: ROADMAP-2058) ou use o Link
              RoadMap no formato "Roadmap: 2058". Cards movidos no Jira evoluem o status aqui na próxima
              sincronização (automática ao abrir o Dash, a cada 30 min, ou manual abaixo). O card mostra
              "via Jira" com o status espelhado e a data/hora da última sincronização.
            </p>

            {msg && (
              <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{
                background: msg.tipo === "ok" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${msg.tipo === "ok" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.25)"}`,
                color: msg.tipo === "ok" ? "#059669" : "#DC2626",
              }}>
                {msg.tipo === "ok" ? <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
                {msg.texto}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={testar} disabled={!!busy || !cfg.configured}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: "rgba(15,23,42,0.05)", color: "#475569", border: "1px solid rgba(15,23,42,0.1)" }}>
                {busy === "teste" ? "Testando…" : "Testar conexão"}
              </button>
              <button onClick={sincronizar} disabled={!!busy || !cfg.configured}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#2FC750,#10B981)", color: "#fff" }}>
                <RefreshCw size={12} className={busy === "sync" ? "animate-spin" : ""} />
                {busy === "sync" ? "Sincronizando…" : "Sincronizar agora"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

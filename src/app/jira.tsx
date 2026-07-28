// ============================================================================
// Integração Jira (Agibank) — configuração com teste de conexão, vínculo por
// chave (ex.: ROADMAP-2058), status/prioridade puxados do Jira e sincronizados.
//
// Arquitetura: o browser NÃO chama o Jira direto (CORS/token). As chamadas
// passam pela Edge Function `jira-proxy` (supabase/functions/jira-proxy),
// que fala com a API REST do Jira no servidor. A configuração fica no
// kv_store (chave 'jira_config').
// ============================================================================
import { useEffect, useState } from "react";
import { X, Plug, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FupItem } from "./dicionario";

export interface JiraConfig {
  url: string;      // ex.: https://agibank.atlassian.net
  email: string;    // e-mail da conta Atlassian
  token: string;    // API token
  projeto: string;  // ex.: ROADMAP
}

const KV_KEY = "jira_config";
const SYNC_THROTTLE_MS = 30 * 60 * 1000; // sync automática no load: no máx. a cada 30 min

// ── Config no kv_store ──────────────────────────────────────────────────────

export async function getJiraConfig(supabase: SupabaseClient): Promise<JiraConfig | null> {
  const { data } = await supabase.from("kv_store_e6688139").select("value").eq("key", KV_KEY).maybeSingle();
  const v = data?.value as JiraConfig | undefined;
  return v?.url && v?.email && v?.token ? v : null;
}

export async function saveJiraConfig(supabase: SupabaseClient, cfg: JiraConfig) {
  const { error } = await supabase.from("kv_store_e6688139").upsert({ key: KV_KEY, value: cfg }, { onConflict: "key" });
  if (error) throw error;
}

// ── Chamadas à Edge Function ────────────────────────────────────────────────

async function callProxy(supabaseUrl: string, anonKey: string, body: any): Promise<any> {
  const res = await fetch(`${supabaseUrl}/functions/v1/jira-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    body: JSON.stringify(body),
  });
  if (res.status === 404) {
    throw new Error("Edge Function 'jira-proxy' não está publicada no Supabase. Publique com: supabase functions deploy jira-proxy");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status} na Edge Function`);
  return json;
}

export async function testarConexaoJira(supabaseUrl: string, anonKey: string, cfg: JiraConfig): Promise<string> {
  const r = await callProxy(supabaseUrl, anonKey, { action: "test", config: cfg });
  return r.displayName as string;
}

export interface JiraIssueInfo { key: string; status: string; statusCategory: string; prioridade: string; }

export async function buscarIssuesJira(supabaseUrl: string, anonKey: string, cfg: JiraConfig, keys: string[]): Promise<JiraIssueInfo[]> {
  if (!keys.length) return [];
  const r = await callProxy(supabaseUrl, anonKey, { action: "issues", config: cfg, keys });
  return (r.issues ?? []) as JiraIssueInfo[];
}

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

export interface SyncResultado { sincronizados: number; concluidosNoJira: number; erro?: string; }

/** Puxa status/prioridade do Jira para todos os projetos vinculados e grava
 *  no banco. Card cuja categoria no Jira é "done" evolui para Concluído no
 *  Dash; demais casos espelham o status Jira no chip "via Jira". */
export async function sincronizarComJira(
  supabase: SupabaseClient, supabaseUrl: string, anonKey: string,
  projects: FupItem[], cfg: JiraConfig,
): Promise<SyncResultado> {
  const vinculados = projects
    .map(p => ({ p, key: chaveJiraDe(p, cfg.projeto || "ROADMAP") }))
    .filter((x): x is { p: FupItem; key: string } => !!x.key);
  if (!vinculados.length) return { sincronizados: 0, concluidosNoJira: 0 };

  const issues = await buscarIssuesJira(supabaseUrl, anonKey, cfg, [...new Set(vinculados.map(v => v.key))]);
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
    const { error } = await supabase.from("fup_items").update(fields).eq("id", p.id);
    if (!error) sincronizados++;
  }
  return { sincronizados, concluidosNoJira: concluidos };
}

/** Sync automática no carregamento (no máx. a cada 30 min), silenciosa. */
export async function syncAutomatica(
  supabase: SupabaseClient, supabaseUrl: string, anonKey: string, projects: FupItem[],
) {
  try {
    const last = Number(localStorage.getItem("jira_last_sync") ?? 0);
    if (Date.now() - last < SYNC_THROTTLE_MS) return;
    const cfg = await getJiraConfig(supabase);
    if (!cfg) return;
    localStorage.setItem("jira_last_sync", String(Date.now()));
    await sincronizarComJira(supabase, supabaseUrl, anonKey, projects, cfg);
  } catch (e) {
    console.warn("Sync automática do Jira falhou (silencioso):", e);
  }
}

// ── Modal de configuração ───────────────────────────────────────────────────

export function JiraConfigModal({ supabase, supabaseUrl, anonKey, projects, onClose, onSynced }: {
  supabase: SupabaseClient; supabaseUrl: string; anonKey: string;
  projects: FupItem[]; onClose: () => void; onSynced: () => void;
}) {
  const [cfg, setCfg] = useState<JiraConfig>({ url: "https://agibank.atlassian.net", email: "", token: "", projeto: "ROADMAP" });
  const [carregando, setCarregando] = useState(true);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [busy, setBusy] = useState<"" | "teste" | "salvar" | "sync">("");

  useEffect(() => {
    getJiraConfig(supabase).then(c => { if (c) setCfg(c); }).finally(() => setCarregando(false));
  }, []);

  const inputStyle = { background: "#EEF2F7", border: "1px solid rgba(15,23,42,0.1)", color: "#1E293B" } as const;
  const set = (k: keyof JiraConfig, v: string) => setCfg(c => ({ ...c, [k]: v }));

  async function testar() {
    setBusy("teste"); setMsg(null);
    try {
      const nome = await testarConexaoJira(supabaseUrl, anonKey, cfg);
      setMsg({ tipo: "ok", texto: `Conexão OK — autenticado como ${nome}` });
    } catch (e: any) { setMsg({ tipo: "erro", texto: e?.message ?? "Falha na conexão" }); }
    finally { setBusy(""); }
  }

  async function salvar() {
    setBusy("salvar"); setMsg(null);
    try {
      await saveJiraConfig(supabase, cfg);
      setMsg({ tipo: "ok", texto: "Configuração salva. A sincronização automática roda ao abrir o Dash (a cada 30 min)." });
    } catch (e: any) { setMsg({ tipo: "erro", texto: e?.message ?? "Erro ao salvar" }); }
    finally { setBusy(""); }
  }

  async function sincronizar() {
    setBusy("sync"); setMsg(null);
    try {
      await saveJiraConfig(supabase, cfg);
      const r = await sincronizarComJira(supabase, supabaseUrl, anonKey, projects, cfg);
      localStorage.setItem("jira_last_sync", String(Date.now()));
      setMsg({
        tipo: "ok",
        texto: `${r.sincronizados} projeto(s) sincronizado(s)` +
          (r.concluidosNoJira ? ` · ${r.concluidosNoJira} evoluíram para Concluído` : "") +
          (r.sincronizados === 0 ? " — nenhum projeto com vínculo Jira (chave ou 'Roadmap: NNNN' no Link RoadMap)" : ""),
      });
      onSynced();
    } catch (e: any) { setMsg({ tipo: "erro", texto: e?.message ?? "Erro na sincronização" }); }
    finally { setBusy(""); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", boxShadow: "0 24px 64px rgba(15,23,42,0.15)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug size={16} style={{ color: "#0033B0" }} />
            <h2 className="text-base font-bold" style={{ color: "#1E293B" }}>Conexão com o Jira</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "#64748B" }}><X size={16} /></button>
        </div>

        {carregando ? (
          <p className="text-xs" style={{ color: "#94A3B8" }}>Carregando configuração…</p>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "#64748B" }}>URL da instância</span>
              <input value={cfg.url} onChange={e => set("url", e.target.value)} placeholder="https://agibank.atlassian.net"
                className="rounded-lg px-3 py-2.5 text-sm outline-none font-mono" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "#64748B" }}>E-mail (conta Atlassian)</span>
              <input value={cfg.email} onChange={e => set("email", e.target.value)} placeholder="voce@agibank.com.br"
                className="rounded-lg px-3 py-2.5 text-sm outline-none" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "#64748B" }}>API Token</span>
              <input value={cfg.token} onChange={e => set("token", e.target.value)} type="password" placeholder="Gerado em id.atlassian.com/manage-profile/security/api-tokens"
                className="rounded-lg px-3 py-2.5 text-sm outline-none font-mono" style={inputStyle} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium" style={{ color: "#64748B" }}>Projeto (chave dos épicos)</span>
              <input value={cfg.projeto} onChange={e => set("projeto", e.target.value)} placeholder="ROADMAP"
                className="rounded-lg px-3 py-2.5 text-sm outline-none font-mono" style={inputStyle} />
            </label>

            <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
              Vínculo por projeto: preencha a Chave Jira no cadastro (ex.: ROADMAP-2058) ou use o Link
              RoadMap no formato "Roadmap: 2058". Cards movidos no Jira evoluem o status aqui na
              próxima sincronização (automática ao abrir o Dash, a cada 30 min, ou manual abaixo).
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
              <button onClick={testar} disabled={!!busy || !cfg.url || !cfg.email || !cfg.token}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: "rgba(15,23,42,0.05)", color: "#475569", border: "1px solid rgba(15,23,42,0.1)" }}>
                {busy === "teste" ? "Testando…" : "Testar conexão"}
              </button>
              <button onClick={salvar} disabled={!!busy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: "#0033B0", color: "#fff" }}>
                {busy === "salvar" ? "Salvando…" : "Salvar"}
              </button>
              <button onClick={sincronizar} disabled={!!busy || !cfg.url || !cfg.email || !cfg.token}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#2FC750,#10B981)", color: "#fff" }}>
                <RefreshCw size={12} className={busy === "sync" ? "animate-spin" : ""} />
                {busy === "sync" ? "Sincronizando…" : "Sincronizar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

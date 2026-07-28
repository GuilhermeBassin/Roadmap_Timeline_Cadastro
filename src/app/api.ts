// ============================================================================
// Cliente de dados do front — fala apenas com as API Routes da Vercel
// (/api/db e /api/jira). O banco (Neon) nunca é acessado direto do browser.
// Em dev local: `vercel dev` sobe front + APIs juntos.
// ============================================================================

async function call(endpoint: "db" | "jira", body: any): Promise<any> {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status} em /api/${endpoint}`);
  return json;
}

export const api = {
  // fup_items
  fupList: (): Promise<any[]> => call("db", { action: "fup_list" }).then(r => r.rows),
  fupInsert: (fields: Record<string, any>): Promise<any> => call("db", { action: "fup_insert", fields }).then(r => r.row),
  fupUpdate: (id: string, fields: Record<string, any>): Promise<any> => call("db", { action: "fup_update", id, fields }).then(r => r.row),
  fupDelete: (id: string): Promise<void> => call("db", { action: "fup_delete", id }),

  // RPCs de priorização
  definirPrioridade: (id: string, num: number | null): Promise<void> => call("db", { action: "definir_prioridade", id, num }),
  compactarPrioridades: (area: string): Promise<void> => call("db", { action: "compactar_prioridades", area }),

  // listas dinâmicas
  listasList: (): Promise<{ tipo: string; valor: string }[]> => call("db", { action: "listas_list" }).then(r => r.rows),
  listasUpsert: (tipo: string, valor: string): Promise<void> => call("db", { action: "listas_upsert", tipo, valor }),

  // kv store
  kvGet: (key: string): Promise<any> => call("db", { action: "kv_get", key }).then(r => r.value),
  kvSet: (key: string, value: any): Promise<void> => call("db", { action: "kv_set", key, value }),

  // Jira (credenciais em env vars da Vercel — nada no front)
  jiraConfig: (): Promise<{ configured: boolean; projeto: string }> => call("jira", { action: "config" }),
  jiraTest: (): Promise<{ displayName: string; projeto: string }> => call("jira", { action: "test" }),
  jiraIssues: (keys: string[]): Promise<{ key: string; status: string; statusCategory: string; prioridade: string }[]> =>
    call("jira", { action: "issues", keys }).then(r => r.issues),
};

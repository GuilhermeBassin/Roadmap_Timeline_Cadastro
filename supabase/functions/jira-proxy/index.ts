// ============================================================================
// Edge Function: jira-proxy
// Ponte entre o Dash (browser) e a API REST do Jira — o browser não consegue
// chamar o Jira direto (CORS + credenciais). Publicar com:
//   supabase functions deploy jira-proxy --no-verify-jwt
//
// Ações:
//   { action: "test",   config }          → { displayName }
//   { action: "issues", config, keys[] }  → { issues: [{ key, status, statusCategory, prioridade }] }
// config = { url, email, token }
// ============================================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: "Use POST" }, 405);

  try {
    const { action, config, keys } = await req.json();
    if (!config?.url || !config?.email || !config?.token) {
      return jsonResp({ error: "Configuração incompleta (url, email, token)" }, 400);
    }

    const base = String(config.url).replace(/\/+$/, "");
    const auth = "Basic " + btoa(`${config.email}:${config.token}`);
    const headers = { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" };

    if (action === "test") {
      const r = await fetch(`${base}/rest/api/3/myself`, { headers });
      if (!r.ok) return jsonResp({ error: `Jira respondeu ${r.status} — verifique URL, e-mail e token` }, 400);
      const me = await r.json();
      return jsonResp({ displayName: me.displayName ?? me.emailAddress ?? "OK" });
    }

    if (action === "issues") {
      const lista = (keys as string[] ?? []).filter(k => /^[A-Z][A-Z0-9]+-\d+$/.test(k)).slice(0, 200);
      if (!lista.length) return jsonResp({ issues: [] });
      const jql = `key in (${lista.join(",")})`;
      const r = await fetch(`${base}/rest/api/3/search/jql`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jql, maxResults: 200, fields: ["status", "priority"] }),
      });
      if (!r.ok) {
        // fallback para instâncias sem o endpoint novo
        const r2 = await fetch(`${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=status,priority`, { headers });
        if (!r2.ok) return jsonResp({ error: `Busca no Jira falhou (${r.status}/${r2.status})` }, 400);
        const d2 = await r2.json();
        return jsonResp({ issues: mapIssues(d2.issues ?? []) });
      }
      const data = await r.json();
      return jsonResp({ issues: mapIssues(data.issues ?? []) });
    }

    return jsonResp({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return jsonResp({ error: (e as Error)?.message ?? "Erro interno" }, 500);
  }
});

function mapIssues(issues: any[]) {
  return issues.map(i => ({
    key: i.key,
    status: i.fields?.status?.name ?? "",
    statusCategory: i.fields?.status?.statusCategory?.key ?? "",
    prioridade: i.fields?.priority?.name ?? "",
  }));
}

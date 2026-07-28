// ============================================================================
// API Route (Vercel) — ponte com o Jira (Agibank).
// As credenciais NÃO ficam no front nem no banco: vivem como env vars
// seguras na Vercel (Settings → Environment Variables):
//   JIRA_URL     = https://agibank.atlassian.net
//   JIRA_EMAIL   = conta Atlassian
//   JIRA_TOKEN   = API token (id.atlassian.com/manage-profile/security/api-tokens)
//   JIRA_PROJETO = ROADMAP (chave dos épicos; opcional, padrão ROADMAP)
//
// Ações:
//   { action: "config" }         → { configured, projeto }   (sem segredos)
//   { action: "test" }           → { displayName }
//   { action: "issues", keys[] } → { issues: [{ key, status, statusCategory, prioridade }] }
// ============================================================================

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const url = (process.env.JIRA_URL ?? "").replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_TOKEN ?? "";
  const projeto = process.env.JIRA_PROJETO || "ROADMAP";
  const configured = Boolean(url && email && token);

  const { action, keys } = req.body ?? {};

  if (action === "config") return res.json({ configured, projeto });

  if (!configured) {
    return res.status(400).json({
      error: "Jira não configurado — defina JIRA_URL, JIRA_EMAIL e JIRA_TOKEN nas env vars da Vercel",
    });
  }

  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  const headers = { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" };

  try {
    if (action === "test") {
      const r = await fetch(`${url}/rest/api/3/myself`, { headers });
      if (!r.ok) return res.status(400).json({ error: `Jira respondeu ${r.status} — verifique URL, e-mail e token` });
      const me: any = await r.json();
      return res.json({ displayName: me.displayName ?? me.emailAddress ?? "OK", projeto });
    }

    if (action === "issues") {
      const lista = ((keys as string[]) ?? []).filter(k => /^[A-Z][A-Z0-9]+-\d+$/.test(k)).slice(0, 200);
      if (!lista.length) return res.json({ issues: [] });
      const jql = `key in (${lista.join(",")})`;
      let issues: any[] = [];
      const r = await fetch(`${url}/rest/api/3/search/jql`, {
        method: "POST", headers,
        body: JSON.stringify({ jql, maxResults: 200, fields: ["status", "priority"] }),
      });
      if (r.ok) {
        issues = ((await r.json()) as any).issues ?? [];
      } else {
        // fallback para instâncias sem o endpoint novo
        const r2 = await fetch(`${url}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=200&fields=status,priority`, { headers });
        if (!r2.ok) return res.status(400).json({ error: `Busca no Jira falhou (${r.status}/${r2.status})` });
        issues = ((await r2.json()) as any).issues ?? [];
      }
      return res.json({
        issues: issues.map(i => ({
          key: i.key,
          status: i.fields?.status?.name ?? "",
          statusCategory: i.fields?.status?.statusCategory?.key ?? "",
          prioridade: i.fields?.priority?.name ?? "",
        })),
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch (e: any) {
    console.error("api/jira erro:", e);
    return res.status(500).json({ error: e?.message ?? "Erro interno" });
  }
}

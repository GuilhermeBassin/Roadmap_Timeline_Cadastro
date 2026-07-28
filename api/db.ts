// ============================================================================
// API Route (Vercel) — camada de dados sobre o Neon (Postgres serverless).
// O front NUNCA acessa o banco direto: todas as operações passam por aqui.
// Env var necessária (Vercel → Settings → Environment Variables):
//   DATABASE_URL = connection string do Neon (pooled)
// ============================================================================
import { neon } from "@neondatabase/serverless";

// Colunas permitidas em insert/update (prioridade_num NUNCA entra aqui —
// apenas via RPCs definir_prioridade/compactar_prioridades)
const FUP_COLS = new Set([
  "atividade", "area", "origem", "tema_macro", "status", "descricao",
  "resumo_status", "focal", "prioridade", "data_limite", "dependencias",
  "link_ux", "link_roadmap", "data_inicio", "progresso",
  "impacto_financeiro", "nota_impacto", "dependencia_squads", "emergencial",
  "pontuacao_prioridade", "jira_key", "jira_status", "jira_prioridade", "jira_sync_at",
]);

function pickCols(fields: Record<string, any>): { cols: string[]; vals: any[] } {
  const cols: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (FUP_COLS.has(k)) { cols.push(k); vals.push(v); }
  }
  return { cols, vals };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: "DATABASE_URL não configurada na Vercel" });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { action, ...p } = req.body ?? {};

  try {
    switch (action) {
      // ── fup_items ─────────────────────────────────────────────────────────
      case "fup_list": {
        const rows = await sql.query("select * from fup_items order by created_at asc");
        return res.json({ rows });
      }
      case "fup_insert": {
        const { cols, vals } = pickCols(p.fields);
        if (!cols.length) return res.status(400).json({ error: "Sem campos válidos" });
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
        const rows = await sql.query(
          `insert into fup_items (${cols.join(",")}) values (${placeholders}) returning *`, vals,
        );
        return res.json({ row: rows[0] });
      }
      case "fup_update": {
        const { cols, vals } = pickCols(p.fields);
        if (!cols.length) return res.status(400).json({ error: "Sem campos válidos" });
        const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
        const rows = await sql.query(
          `update fup_items set ${sets}, updated_at = now() where id = $${cols.length + 1} returning *`,
          [...vals, p.id],
        );
        return res.json({ row: rows[0] ?? null });
      }
      case "fup_delete": {
        await sql.query("delete from fup_items where id = $1", [p.id]);
        return res.json({ ok: true });
      }

      // ── RPCs de priorização (atômicas — nunca gravar prioridade_num direto)
      case "definir_prioridade": {
        await sql.query("select definir_prioridade($1, $2)", [p.id, p.num ?? null]);
        return res.json({ ok: true });
      }
      case "compactar_prioridades": {
        await sql.query("select compactar_prioridades($1)", [p.area]);
        return res.json({ ok: true });
      }

      // ── listas (temas macro / origens dinâmicos) ─────────────────────────
      case "listas_list": {
        const rows = await sql.query("select tipo, valor from listas order by valor");
        return res.json({ rows });
      }
      case "listas_upsert": {
        await sql.query(
          "insert into listas (tipo, valor) values ($1, $2) on conflict (tipo, valor) do nothing",
          [p.tipo, p.valor],
        );
        return res.json({ ok: true });
      }

      // ── kv_store (dashboard-data do Controle de Demandas etc.) ───────────
      case "kv_get": {
        const rows = await sql.query("select value from kv_store_e6688139 where key = $1", [p.key]);
        return res.json({ value: rows[0]?.value ?? null });
      }
      case "kv_set": {
        await sql.query(
          `insert into kv_store_e6688139 (key, value) values ($1, $2)
           on conflict (key) do update set value = excluded.value`,
          [p.key, JSON.stringify(p.value)],
        );
        return res.json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Ação desconhecida: ${action}` });
    }
  } catch (e: any) {
    console.error("api/db erro:", e);
    return res.status(500).json({ error: e?.message ?? "Erro interno" });
  }
}

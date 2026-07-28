# Dash Unificado — Roadmap e Timeline para Projetos (Agibank)

Gestão de projetos das verticais **Cadastro, Conta Corrente e APP**: Roadmap (kanban), Timeline (Gantt), Controle de Vertical e **Controle de Demandas** (Projetos, Performance, UX, Status Report e Histórico), com base única no **Neon** (Postgres, tabela `fup_items`).

## Arquitetura

```
Browser (React/Vite SPA)
   └── /api/db    (Vercel Function) ── Neon Postgres  ← DATABASE_URL
   └── /api/jira  (Vercel Function) ── Jira Agibank   ← JIRA_URL / JIRA_EMAIL / JIRA_TOKEN / JIRA_PROJETO
```

- O browser **nunca** acessa o banco nem o Jira diretamente — tudo passa pelas API Routes (`api/db.ts`, `api/jira.ts`).
- Credenciais só existem como **Environment Variables na Vercel** (ambiente seguro). Nada de segredo no front ou no banco.
- Sem realtime: o front faz polling a cada 30s (mutações locais recarregam na hora).
- Schema do banco: `neon/schema.sql` (idempotente — rodar no SQL Editor do Neon). O diretório `supabase/` é **legado** (histórico da migração Supabase → Neon).

## Rodando

```bash
npm i
vercel dev       # desenvolvimento com as API Routes (requer `npm i -g vercel`)
npm run build    # build de produção (validar antes de commitar)
```

Push na `main` → deploy automático na Vercel.

## Env vars (Vercel → Settings → Environment Variables)

| Nome | Conteúdo |
| --- | --- |
| `DATABASE_URL` | Connection string **pooled** do Neon |
| `JIRA_URL` | `https://agibank.atlassian.net` |
| `JIRA_EMAIL` | Conta Atlassian |
| `JIRA_TOKEN` | API token (id.atlassian.com → Security → API tokens) |
| `JIRA_PROJETO` | `ROADMAP` (opcional; padrão ROADMAP) |

## Funcionalidades

- **Priorização**: questionário obrigatório no cadastro/edição (Impacto Financeiro, Nota 0–10, Dependência de squads, Emergencial) → Pontuação 0–100 (pesos em `CRITERIOS_PRIORIDADE`, `src/app/dicionario.ts`). Nº único por frente com remanejamento atômico via funções SQL `definir_prioridade`/`compactar_prioridades` — nunca gravar `prioridade_num` direto. Painel "Fila de Prioridades" no Controle de Vertical.
- **Controle de Demandas** (view "Demandas"): tabela editável de Projetos + Performance + UX + Status Report + Histórico. Projetos vivem na tabela `fup_items` (fonte única — refletem no Roadmap/Timeline); demais dados no `kv_store` (chave `dashboard-data`).
- **Exportar PPT**: período → projetos em andamento, ordem de prioridade, timeline padrão Agibank.
- **Exportar Excel**: todos os projetos e campos completos (datas como data, números como número).
- **Importar .xlsx**: template para download; cada linha válida vira projeto; erros listados por linha sem interromper as demais.
- **Jira**: vínculo por Chave Jira (ex.: `ROADMAP-2058`) ou Link RoadMap `"Roadmap: 2058"`; teste de conexão e sync manual no modal "Jira"; sync automática ao abrir (máx. a cada 30 min); chip "via Jira" no card; concluído no Jira → Concluído no Dash.

---
Projeto originado no Figma Make (https://www.figma.com/design/OzIlXcYNST75yO2JrKBsLg/Roadmap-e-Timeline-para-Projetos); o desenvolvimento é exclusivamente via git + Vercel.

# Dash Unificado — Roadmap e Timeline para Projetos (Agibank)

Gestão de projetos das verticais **Cadastro, Conta Corrente e APP**: Roadmap (kanban), Timeline (Gantt) e Controle de Vertical, com base única no Supabase (`fup_items`).

## Rodando

```bash
npm i
npm run dev      # desenvolvimento
npm run build    # build de produção (validar antes de commitar)
```

Push na `main` → deploy automático na Vercel. Migrações em `supabase/migrations/` mescladas na `main` são aplicadas ao banco pela integração GitHub ↔ Supabase (todas são idempotentes).

## Funcionalidades

- **Priorização**: questionário obrigatório no cadastro/edição (Impacto Financeiro, Nota 0–10, Dependência de squads, Emergencial) → Pontuação 0–100 (pesos em `CRITERIOS_PRIORIDADE`, `src/app/dicionario.ts`). Nº único por frente com remanejamento atômico via RPCs `definir_prioridade`/`compactar_prioridades` — nunca gravar `prioridade_num` direto. Painel "Fila de Prioridades" no Controle de Vertical.
- **Exportar PPT**: `src/app/exportPpt.tsx` (período → projetos em andamento, ordem de prioridade, timeline padrão Agibank).
- **Exportar Excel**: botão "Excel" gera .xlsx com todos os projetos e campos completos (datas como data, números como número).
- **Importar .xlsx**: botão "Importar" → baixar template, cada linha válida vira projeto; linhas com erro são listadas com o motivo sem interromper as demais.
- **Jira**: botão "Jira" → conexão (URL, e-mail, API token, projeto) com teste; vínculo por Chave Jira (ex.: `ROADMAP-2058`) ou Link RoadMap `"Roadmap: 2058"`; sync manual e automática (ao abrir, no máx. a cada 30 min) espelha status/prioridade do épico ("via Jira" no card) e conclui no Dash o que foi concluído no Jira.

### Publicar a Edge Function do Jira (uma vez)

O browser não chama o Jira direto (CORS); as chamadas passam por `supabase/functions/jira-proxy`. Publicar com CLI:

```bash
supabase functions deploy jira-proxy --no-verify-jwt --project-ref hrfcmlqhgxzwjhnwawvc
```

ou colar o conteúdo de `supabase/functions/jira-proxy/index.ts` no editor de Edge Functions do dashboard do Supabase (desativando "Enforce JWT verification").

---
Projeto originado no Figma Make (https://www.figma.com/design/OzIlXcYNST75yO2JrKBsLg/Roadmap-e-Timeline-para-Projetos); hoje o desenvolvimento é exclusivamente via git + Vercel.

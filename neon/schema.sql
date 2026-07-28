-- ============================================================================
-- Schema completo do Dash Unificado no NEON (Postgres).
-- Rodar UMA VEZ no SQL Editor do Neon (idempotente — pode reaplicar).
-- Os dados são migrados do Supabase (fonte de verdade) num script separado.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── fup_items: projetos (dicionário oficial em src/app/dicionario.ts) ───────
create table if not exists public.fup_items (
  id                   uuid primary key default gen_random_uuid(),
  atividade            text not null default '',
  area                 text not null default 'Cadastro',
  origem               text not null default '',
  tema_macro           text not null default '',
  status               text not null default 'Backlog',
  descricao            text not null default '',
  resumo_status        text not null default '',
  focal                text not null default '',
  prioridade           text not null default 'Médio',
  data_limite          date,
  dependencias         text not null default '',
  link_ux              text not null default '',
  link_roadmap         text not null default '',
  data_inicio          date,
  progresso            integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- priorização (questionário obrigatório)
  impacto_financeiro   boolean,
  nota_impacto         integer check (nota_impacto between 0 and 10),
  dependencia_squads   boolean,
  emergencial          boolean,
  pontuacao_prioridade integer,
  prioridade_num       integer,
  -- integração Jira
  jira_key             text,
  jira_status          text,
  jira_prioridade      text,
  jira_sync_at         timestamptz
);

create unique index if not exists fup_items_area_prioridade_num_uidx
  on public.fup_items (area, prioridade_num)
  where prioridade_num is not null;

-- ── listas: temas macro / origens dinâmicos ─────────────────────────────────
create table if not exists public.listas (
  tipo  text not null,
  valor text not null,
  primary key (tipo, valor)
);

-- ── kv_store: dashboard-data do Controle de Demandas etc. ───────────────────
create table if not exists public.kv_store_e6688139 (
  key   text primary key,
  value jsonb
);

-- ── Funções atômicas de fila de prioridade (NUNCA gravar prioridade_num
--    direto — sempre via estas funções) ───────────────────────────────────────

create or replace function public.compactar_prioridades(p_area text)
returns void
language plpgsql
as $$
begin
  update public.fup_items
     set prioridade_num = -prioridade_num
   where area = p_area and prioridade_num is not null;

  with ordenados as (
    select id, row_number() over (order by -prioridade_num) as novo_num
      from public.fup_items
     where area = p_area and prioridade_num is not null
  )
  update public.fup_items f
     set prioridade_num = o.novo_num
    from ordenados o
   where f.id = o.id;
end;
$$;

create or replace function public.definir_prioridade(p_id uuid, p_num integer)
returns void
language plpgsql
as $$
declare
  v_area text;
begin
  select area into v_area from public.fup_items where id = p_id;
  if v_area is null then
    raise exception 'Projeto % não encontrado', p_id;
  end if;

  update public.fup_items set prioridade_num = null where id = p_id;

  if p_num is not null then
    update public.fup_items
       set prioridade_num = -(prioridade_num + 1)
     where area = v_area and prioridade_num >= p_num;

    update public.fup_items
       set prioridade_num = -prioridade_num
     where area = v_area and prioridade_num < 0;

    update public.fup_items set prioridade_num = p_num where id = p_id;
  end if;

  perform public.compactar_prioridades(v_area);
end;
$$;

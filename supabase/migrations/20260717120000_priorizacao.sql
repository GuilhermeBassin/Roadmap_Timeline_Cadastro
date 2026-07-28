-- ============================================================================
-- Sistema de Priorização (questionário + pontuação + nº único por frente)
-- Idempotente: já foi executada manualmente no banco em 17/07/2026; este
-- arquivo versiona o schema e pode ser reaplicado sem efeitos colaterais.
-- ============================================================================

-- Critérios do questionário (novo critério = nova coluna homônima +
-- entrada em CRITERIOS_PRIORIDADE no dicionario.ts)
alter table public.fup_items add column if not exists impacto_financeiro   boolean;
alter table public.fup_items add column if not exists nota_impacto         integer check (nota_impacto between 0 and 10);
alter table public.fup_items add column if not exists dependencia_squads   boolean;
alter table public.fup_items add column if not exists emergencial          boolean;

-- Pontuação de Prioridade (0–100): Nota×4 + 25 se Impacto Financeiro
-- + 25 se Emergencial − 10 se Dependência de squads
alter table public.fup_items add column if not exists pontuacao_prioridade integer;

-- Nº único de prioridade dentro de cada frente (1, 2, 3…)
alter table public.fup_items add column if not exists prioridade_num       integer;
create unique index if not exists fup_items_area_prioridade_num_uidx
  on public.fup_items (area, prioridade_num)
  where prioridade_num is not null;

-- ── Funções atômicas de fila (NUNCA gravar prioridade_num direto) ───────────

-- Compacta a fila de uma frente: renumera 1..k por ordem atual, sem buracos.
create or replace function public.compactar_prioridades(p_area text)
returns void
language plpgsql
security definer
as $$
begin
  -- desocupa temporariamente para não violar o índice único durante a renumeração
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

-- Define o nº N para um projeto; se ocupado, o anterior e todos abaixo
-- caem uma posição. Ao final, compacta (1..k sem buracos/duplicidades).
create or replace function public.definir_prioridade(p_id uuid, p_num integer)
returns void
language plpgsql
security definer
as $$
declare
  v_area text;
begin
  select area into v_area from public.fup_items where id = p_id;
  if v_area is null then
    raise exception 'Projeto % não encontrado', p_id;
  end if;

  -- solta a posição atual do projeto
  update public.fup_items set prioridade_num = null where id = p_id;

  if p_num is not null then
    -- abre espaço: N e todos abaixo caem uma posição (de baixo p/ cima,
    -- via negativação, para não violar o índice único)
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

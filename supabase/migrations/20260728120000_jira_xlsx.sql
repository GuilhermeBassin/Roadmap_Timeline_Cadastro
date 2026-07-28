-- ============================================================================
-- Integração Jira: vínculo por chave + espelho de status/prioridade + sync.
-- Idempotente.
-- ============================================================================

alter table public.fup_items add column if not exists jira_key         text;
alter table public.fup_items add column if not exists jira_status      text;
alter table public.fup_items add column if not exists jira_prioridade  text;
alter table public.fup_items add column if not exists jira_sync_at     timestamptz;

-- Configuração do Jira fica no kv_store (chave 'jira_config'), já existente.

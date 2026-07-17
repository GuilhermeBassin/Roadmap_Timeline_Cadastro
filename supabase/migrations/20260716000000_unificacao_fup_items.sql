-- ============================================================================
-- UNIFICAÇÃO DO DASH — Base única de projetos
-- ✅ JÁ EXECUTADA em 17/07/2026 no projeto hrfcmlqhgxzwjhnwawvc (GuilhermeBassin's Project),
--    incluindo a migração dos 86 projetos do banco antigo do Figma Make (mmzxrz…).
--    Mantida aqui como registro e para recriação do ambiente se necessário (é idempotente).
-- ============================================================================

-- 1. Tabela única de projetos (FupItem — dicionário oficial)
CREATE TABLE IF NOT EXISTS public.fup_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Campos oficiais do FupItem
    atividade      TEXT NOT NULL,
    area           TEXT NOT NULL DEFAULT 'Cadastro'
                   CHECK (area IN ('APP', 'Cadastro', 'Conta Corrente')),
    origem         TEXT DEFAULT '',
    tema_macro     TEXT DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'Backlog'
                   CHECK (status IN ('Backlog','Discovery','Handover','Refin. Técnico',
                                     'Desenv. UX','Desenv. Técnico','Teste','Pausado',
                                     'Bloqueado','Concluído','Cancelado')),
    descricao      TEXT DEFAULT '',
    resumo_status  TEXT DEFAULT '',
    focal          TEXT DEFAULT '',
    prioridade     TEXT DEFAULT 'Médio'
                   CHECK (prioridade IN ('Baixo','Médio','Alto','Crítico')),
    data_limite    DATE,
    dependencias   TEXT DEFAULT '',
    link_ux        TEXT DEFAULT '',
    link_roadmap   TEXT DEFAULT '',

    -- Campos auxiliares de exibição (Timeline/Gantt) — não fazem parte do dicionário
    data_inicio    DATE,
    progresso      INTEGER DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. Listas dinâmicas unificadas (Temas Macro e Origens — editáveis pelo usuário)
CREATE TABLE IF NOT EXISTS public.listas (
    id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo  TEXT NOT NULL CHECK (tipo IN ('temaMacro','origem')),
    valor TEXT NOT NULL,
    UNIQUE (tipo, valor)
);

-- 3. KV do Controle de Demandas (performance, KPIs etc. — dados não-projeto)
CREATE TABLE IF NOT EXISTS public.kv_store_e6688139 (
    key   TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Semente com os valores oficiais
INSERT INTO public.listas (tipo, valor) VALUES
  ('temaMacro','GDD'), ('temaMacro','Abertura de Conta'), ('temaMacro','Atualização Cadastral'),
  ('temaMacro','TCD'), ('temaMacro','SIMBA'), ('temaMacro','Onboarding'),
  ('temaMacro','Encerramento'), ('temaMacro','Outro'),
  ('origem','Riscos e Regulatórios'), ('origem','Projetos'), ('origem','Metas/KPIs'),
  ('origem','Fast-Track'), ('origem','PA'), ('origem','Performance'), ('origem','Negócios')
ON CONFLICT (tipo, valor) DO NOTHING;

-- 4. RLS (mesmo padrão já usado pelos apps)
ALTER TABLE public.fup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store_e6688139 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total fup_items" ON public.fup_items;
DROP POLICY IF EXISTS "Acesso total listas"    ON public.listas;
DROP POLICY IF EXISTS "Acesso total kv"        ON public.kv_store_e6688139;
CREATE POLICY "Acesso total fup_items" ON public.fup_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total listas"    ON public.listas    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total kv"        ON public.kv_store_e6688139 FOR ALL USING (true) WITH CHECK (true);

-- 5. Realtime (sincronização automática entre Controle de Demandas e Roadmap/Timeline)
DO $dd$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fup_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $dd$;
DO $dd$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.listas;
EXCEPTION WHEN duplicate_object THEN NULL; END $dd$;

-- 6. updated_at automático
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fup_items_updated ON public.fup_items;
CREATE TRIGGER trg_fup_items_updated BEFORE UPDATE ON public.fup_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- MIGRAÇÃO DE DADOS (✅ já executada em 17/07/2026):
--  • 86 fupItems do blob kv do banco antigo (mmzxrz…) → fup_items
--  • Temas/Origens personalizados → listas (10 valores extras)
--  • Blob (performanceItems, kpis etc.) → kv_store_e6688139
--  • Enriquecimento dos 2 projetos que existiam na tabela legada `projetos`
--    (TPLAT-805 e TPLAT-798: descrição, épico, datas e progresso)
-- As tabelas legadas `projetos` e `usuarios` deste banco não são mais usadas.
-- ============================================================================

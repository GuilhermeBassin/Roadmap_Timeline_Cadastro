-- ============================================================================
-- UNIFICAÇÃO DO DASH — Base única de projetos (fonte de verdade: Controle de Demandas)
-- Executar no SQL Editor do Supabase do CONTROLE DE DEMANDAS (projeto mmzxrzstcdwpsdajczzp)
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

-- Semente com os valores oficiais
INSERT INTO public.listas (tipo, valor) VALUES
  ('temaMacro','GDD'), ('temaMacro','Abertura de Conta'), ('temaMacro','Atualização Cadastral'),
  ('temaMacro','TCD'), ('temaMacro','SIMBA'), ('temaMacro','Onboarding'),
  ('temaMacro','Encerramento'), ('temaMacro','Outro'),
  ('origem','Riscos e Regulatórios'), ('origem','Projetos'), ('origem','Metas/KPIs'),
  ('origem','Fast-Track'), ('origem','PA'), ('origem','Performance'), ('origem','Negócios')
ON CONFLICT (tipo, valor) DO NOTHING;

-- 3. RLS (mesmo padrão já usado pelo app)
ALTER TABLE public.fup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas    ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total fup_items" ON public.fup_items;
DROP POLICY IF EXISTS "Acesso total listas"    ON public.listas;
CREATE POLICY "Acesso total fup_items" ON public.fup_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total listas"    ON public.listas    FOR ALL USING (true) WITH CHECK (true);

-- 4. Realtime (sincronização automática entre Controle de Demandas e Roadmap/Timeline)
ALTER PUBLICATION supabase_realtime ADD TABLE public.fup_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.listas;

-- 5. updated_at automático
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = timezone('utc', now()); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_fup_items_updated ON public.fup_items;
CREATE TRIGGER trg_fup_items_updated BEFORE UPDATE ON public.fup_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- MIGRAÇÃO DE DADOS
-- a) Os projetos do Controle de Demandas (blob kv_store "dashboard-data") são
--    importados automaticamente pelo próprio app na primeira carga após o deploy
--    desta versão (auto-migração quando fup_items está vazia).
-- b) A base antiga do Roadmap (projeto hrfcmlqhgxzwjhnwawvc) tinha 2 projetos,
--    ambos já existentes no Controle de Demandas. Após a auto-migração do item (a),
--    execute o bloco abaixo para enriquecer esses 2 registros com os dados que só
--    existiam no Roadmap (descrição, épico Jira, datas e progresso):
-- ============================================================================

-- Executar SOMENTE depois que o app tiver feito a auto-migração (fup_items populada):
UPDATE public.fup_items SET
  descricao    = 'Descontinuação planejada do sistema CADU, assegurando migração e disponibilidade dos dados e funcionalidades críticas no AppSmith, com uso de APIs padronizadas e comunicação a todos os envolvidos.',
  link_roadmap = 'TPLAT-805',
  data_inicio  = '2026-03-01',
  data_limite  = COALESCE(data_limite, '2026-09-30'),
  progresso    = 55
WHERE atividade ILIKE 'Migra%CADU%MDM%';

UPDATE public.fup_items SET
  descricao    = 'Necessidade de base única considerada por todos os canais, jornadas, produtos e serviços para alimentação dos dados cadastrais (tanto input quanto consumo).',
  link_roadmap = 'TPLAT-798',
  data_inicio  = '2026-01-01',
  data_limite  = COALESCE(data_limite, '2026-12-31'),
  progresso    = 46
WHERE atividade ILIKE 'UNIFICA%bases%Telefone%';

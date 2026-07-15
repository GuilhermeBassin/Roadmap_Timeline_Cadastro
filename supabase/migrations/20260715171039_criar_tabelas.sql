-- 1. Tabela de Usuários (Profiles)
-- Usada para popular o campo "Owner" e mostrar as iniciais (ex: GB, RM, CS) nos cards
CREATE TABLE public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    iniciais TEXT, -- Ex: 'GB' para Guilherme Bassin
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela Principal de Projetos (Roadmap/Timeline)
-- Baseada exatamente no seu formulário modal e nos cards do Kanban
CREATE TABLE public.projetos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Informações Básicas
    nome TEXT NOT NULL,
    descricao TEXT,
    categoria TEXT, -- Ex: 'Validação', 'Integrações'
    quarter_entrega TEXT, -- Ex: 'Q2 2025'
    
    -- Status e Responsável
    status TEXT NOT NULL DEFAULT 'Discovery', -- Discovery, Backlog, Em Desenvolvimento, etc.
    owner_id UUID REFERENCES public.usuarios(id), -- Conecta com a tabela de usuários
    
    -- Datas para a Timeline
    data_inicio DATE,
    data_previsao DATE,
    
    -- Detalhes Técnicos e Progresso
    epico_jira TEXT, -- Ex: 'CAD-3180'
    progresso INTEGER DEFAULT 0, -- De 0 a 100
    possui_dependencias BOOLEAN DEFAULT false,
    
    -- Campos extras visíveis nos cards
    tags TEXT[], -- Array para guardar as hashtags ex: '{"#bureau", "#crédito"}'
    mensagem_alerta TEXT, -- Para a mensagem vermelha nos cards bloqueados (ex: "Aguardando definição...")
    
    -- Controle de sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configuração de Segurança (Row Level Security - Obrigatório no Supabase)
-- Isso garante que sua API funcione corretamente quando você conectar o Next.js
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- Cria políticas permitindo leitura e escrita (Para facilitar o seu desenvolvimento agora)
CREATE POLICY "Permitir acesso total aos projetos" ON public.projetos FOR ALL USING (true);
CREATE POLICY "Permitir acesso total aos usuarios" ON public.usuarios FOR ALL USING (true);
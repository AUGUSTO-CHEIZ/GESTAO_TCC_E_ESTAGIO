-- ==============================================================================
-- MIGRAÇÃO SUPABASE - GESTÃO DE BANCAS TCC (PSICOLOGIA)
-- ==============================================================================
-- Este script cria todas as tabelas, tipos, perfis de usuários, triggers automáticos
-- e políticas de segurança RLS (Row-Level Security) necessárias para o projeto.
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA DE PERFIS DE USUÁRIOS (perfis)
-- ==============================================================================
-- Papéis permitidos: 'admin', 'professor', 'user' (público / visitante)
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nome TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'professor', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS em perfis
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se o usuário autenticado é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Função auxiliar para verificar se o usuário autenticado é professor
CREATE OR REPLACE FUNCTION public.is_professor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis
    WHERE id = auth.uid() AND role = 'professor'
  );
$$;

-- Políticas de RLS para perfis (sem recursão com is_admin)
DROP POLICY IF EXISTS "Usuário pode visualizar seu próprio perfil" ON public.perfis;
CREATE POLICY "Usuário pode visualizar seu próprio perfil"
ON public.perfis FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuário pode atualizar seu próprio perfil" ON public.perfis;
CREATE POLICY "Usuário pode atualizar seu próprio perfil"
ON public.perfis FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admin pode inserir perfis" ON public.perfis;
CREATE POLICY "Usuário pode inserir seu próprio perfil"
ON public.perfis FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Trigger para criar automaticamente perfil quando usuário se registra no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role TEXT := 'user';
    prof_id UUID;
BEGIN
    -- Se o e-mail estiver cadastrado na tabela de professores, define papel como professor
    SELECT id INTO prof_id FROM public.professores WHERE LOWER(email) = LOWER(NEW.email) LIMIT 1;
    IF prof_id IS NOT NULL THEN
        user_role := 'professor';
        -- Vincula automaticamente o professor ao novo user_id
        UPDATE public.professores SET user_id = NEW.id WHERE id = prof_id;
    END IF;

    -- Se o e-mail vier com metadata de role ou for o primeiro usuário
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
        user_role := NEW.raw_user_meta_data->>'role';
    END IF;

    INSERT INTO public.perfis (id, email, nome, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        user_role
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nome = COALESCE(EXCLUDED.nome, public.perfis.nome),
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. TABELA DE PROFESSORES (professores)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.professores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    telefone TEXT,
    titulacao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;

-- Leitura de professores: aberta ao público (necessário para seletores em inscrições e agendas)
CREATE POLICY "Professores leitura pública"
ON public.professores FOR SELECT
USING (true);

-- Modificações de professores: administradores ou o próprio professor atualizando seu user_id
CREATE POLICY "Admin gerencia professores"
ON public.professores FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Professor pode vincular seu próprio user_id"
ON public.professores FOR UPDATE
USING (auth.uid() IS NOT NULL AND (LOWER(email) = LOWER(auth.jwt()->>'email') OR user_id = auth.uid()))
WITH CHECK (auth.uid() IS NOT NULL AND (LOWER(email) = LOWER(auth.jwt()->>'email') OR user_id = auth.uid()));

-- ==============================================================================
-- 4. TABELA DE HORÁRIOS (horarios)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.horarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Horários leitura pública"
ON public.horarios FOR SELECT
USING (true);

CREATE POLICY "Admin gerencia horários"
ON public.horarios FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 5. TABELA DE SALAS (salas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    capacidade INTEGER NOT NULL DEFAULT 30,
    localizacao TEXT,
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salas leitura pública"
ON public.salas FOR SELECT
USING (true);

CREATE POLICY "Admin gerencia salas"
ON public.salas FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 6. TABELA DE BANCAS (bancas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo_tcc TEXT NOT NULL,
    horario_id UUID REFERENCES public.horarios(id) ON DELETE SET NULL,
    horario_descricao TEXT,
    horario_data TEXT,
    sala_id UUID REFERENCES public.salas(id) ON DELETE SET NULL,
    sala_nome TEXT,
    orientador_id UUID REFERENCES public.professores(id) ON DELETE SET NULL,
    orientador_nome TEXT,
    orientador_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    apresentador_nome TEXT,
    apresentador_email TEXT,
    avaliador1_id UUID REFERENCES public.professores(id) ON DELETE SET NULL,
    avaliador1_nome TEXT,
    avaliador2_id UUID REFERENCES public.professores(id) ON DELETE SET NULL,
    avaliador2_nome TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'agendada', 'realizada', 'cancelada')),
    vagas_espectadores INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bancas leitura pública"
ON public.bancas FOR SELECT
USING (true);

CREATE POLICY "Criação de banca pelo público ou admin"
ON public.bancas FOR INSERT
WITH CHECK (true);

CREATE POLICY "Atualização de banca por orientador ou admin"
ON public.bancas FOR UPDATE
USING (public.is_admin() OR orientador_user_id = auth.uid())
WITH CHECK (public.is_admin() OR orientador_user_id = auth.uid());

CREATE POLICY "Admin exclui bancas"
ON public.bancas FOR DELETE
USING (public.is_admin());

-- ==============================================================================
-- 7. TABELA DE INSCRIÇÕES (inscricoes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inscricoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banca_id UUID REFERENCES public.bancas(id) ON DELETE CASCADE,
    banca_titulo TEXT,
    horario_descricao TEXT,
    horario_data TEXT,
    sala_nome TEXT,
    orientador_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('apresentador', 'academico', 'familiar')),
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    codigo_academico TEXT,
    curso TEXT DEFAULT 'Psicologia',
    semestre TEXT,
    parentesco TEXT,
    titulo_tcc TEXT,
    orientador_nome TEXT,
    presente BOOLEAN NOT NULL DEFAULT false,
    inclusao_ultima_hora BOOLEAN NOT NULL DEFAULT false,
    added_by_professor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_by_professor_nome TEXT,
    email_enviado BOOLEAN NOT NULL DEFAULT false,
    email_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

-- Leitura de inscrições: pública para busca por e-mail, e orientadores/admins vêem suas bancas
CREATE POLICY "Inscrições leitura pública e restrita"
ON public.inscricoes FOR SELECT
USING (true);

CREATE POLICY "Inscrições criação pública"
ON public.inscricoes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Atualização de inscrições por orientador ou admin"
ON public.inscricoes FOR UPDATE
USING (public.is_admin() OR orientador_user_id = auth.uid())
WITH CHECK (public.is_admin() OR orientador_user_id = auth.uid());

CREATE POLICY "Admin exclui inscrições"
ON public.inscricoes FOR DELETE
USING (public.is_admin());

-- ==============================================================================
-- 8. TABELA DE PRESENÇAS (presencas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscricao_id UUID REFERENCES public.inscricoes(id) ON DELETE CASCADE,
    inscricao_nome TEXT,
    inscricao_tipo TEXT,
    banca_id UUID REFERENCES public.bancas(id) ON DELETE CASCADE,
    banca_titulo TEXT,
    orientador_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    presente BOOLEAN NOT NULL DEFAULT false,
    confirmado_por_professor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmado_por_nome TEXT,
    data_confirmacao TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presenças leitura por orientador ou admin"
ON public.presencas FOR SELECT
USING (public.is_admin() OR orientador_user_id = auth.uid());

CREATE POLICY "Presenças gravação por orientador ou admin"
ON public.presencas FOR ALL
USING (public.is_admin() OR orientador_user_id = auth.uid())
WITH CHECK (public.is_admin() OR orientador_user_id = auth.uid());

-- ==============================================================================
-- 9. CONFIGURAÇÃO DE EVENTO (configuracao_evento)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracao_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_evento TEXT NOT NULL DEFAULT 'Bancas de TCC - Psicologia',
    data_inicio DATE,
    data_fim DATE,
    local TEXT,
    descricao TEXT,
    inscricoes_abertas BOOLEAN NOT NULL DEFAULT true,
    max_bancas_por_horario INTEGER NOT NULL DEFAULT 2,
    vagas_espectadores_padrao INTEGER NOT NULL DEFAULT 20,
    email_confirmacao_template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracao_evento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configuração evento leitura pública"
ON public.configuracao_evento FOR SELECT
USING (true);

CREATE POLICY "Admin gerencia configuração evento"
ON public.configuracao_evento FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Inserir configuração padrão inicial caso não exista
INSERT INTO public.configuracao_evento (nome_evento, descricao, inscricoes_abertas, max_bancas_por_horario, vagas_espectadores_padrao)
SELECT 'Bancas de TCC - Psicologia', 'Plataforma de gestão e acompanhamento das bancas de TCC. Inscreva-se, acompanhe a agenda e consulte sua inscrição.', true, 2, 20
WHERE NOT EXISTS (SELECT 1 FROM public.configuracao_evento);

-- ==============================================================================
-- 10. CONFIGURAÇÃO DE CERTIFICADO (configuracao_certificado)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracao_certificado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carga_horaria_apresentador NUMERIC NOT NULL DEFAULT 1,
    carga_horaria_academico NUMERIC NOT NULL DEFAULT 2,
    template_texto TEXT,
    assinatura_responsavel TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracao_certificado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia configuração certificado"
ON public.configuracao_certificado FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- 11. TEMPLATES DE E-MAIL (templates_email)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.templates_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL UNIQUE,
    assunto TEXT NOT NULL,
    corpo TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates_email ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates email leitura e gravação admin"
ON public.templates_email FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Inserir template padrão de confirmação de inscrição
INSERT INTO public.templates_email (tipo, assunto, corpo, ativo)
VALUES (
    'confirmacao_inscricao',
    'Confirmação de Inscrição - Bancas TCC Psicologia',
    'Olá [NOME], sua inscrição para a banca "[TITULO_TCC]" foi confirmada com sucesso! Data: [DATA] às [HORARIO] na sala [SALA]. Tipo de participação: [TIPO].',
    true
)
ON CONFLICT (tipo) DO NOTHING;

-- ==============================================================================
-- FIM DA MIGRAÇÃO
-- ==============================================================================

-- 007_staff_auth.sql
-- Separa consumidores (Supabase Auth, public.users) do staff (auth própria).
-- - public.users passa a ter role padrão 'user' (consumidor); staff sai desta tabela.
-- - Nova tabela public.staff_users com credenciais próprias (login/sessão custom no app).
--   Acesso só via service-role do servidor: RLS habilitada SEM policies (bloqueia anon/auth).

-- ---------- public.users: role de consumidor ----------
-- Remove o CHECK antigo (admin/content_manager/affiliate_manager/freelancer),
-- migra contas de staff remanescentes para consumidor e restringe ao novo conjunto.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE public.users SET role = 'user'
  WHERE role NOT IN ('user', 'freelancer');

ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'user';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'freelancer'));

-- academy_articles é conteúdo do staff, que não vive em public.users; o autor
-- deixa de ser obrigatório (gravado como NULL para artigos criados pelo staff).
ALTER TABLE public.academy_articles ALTER COLUMN author_id DROP NOT NULL;

-- ---------- public.staff_users: auth separada do staff ----------
CREATE TABLE public.staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  full_name varchar(100),
  role varchar(30) NOT NULL
    CHECK (role IN ('content_manager', 'affiliate_manager', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Sem policies: nenhuma role de cliente (anon/authenticated) acessa.
-- O servidor lê/escreve exclusivamente com a service_role key (ignora RLS).
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- ---------- Seed: admin inicial ----------
-- Senha padrão: Admin@123  (TROCAR após o primeiro acesso).
INSERT INTO public.staff_users (email, password_hash, full_name, role)
VALUES (
  'admin@palpitetododia.com',
  '$2b$10$XCeWTqICXEyH4boEWO3qquEJHLe2kYeYbT.FiyUDfo4G/QeAXWct6',
  'Administrador',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

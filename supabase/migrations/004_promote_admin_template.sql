-- ============================================================================
-- MIGRATION 004 (EXECUÇÃO MANUAL): PROMOVER SUA CONTA A ADMINISTRADOR MASTER
-- ============================================================================
-- 1) Substitua 'MEU_EMAIL' pelo seu e-mail exato já cadastrado no Supabase Auth
--    (por exemplo: 'jt.designer21@gmail.com').
-- 2) Execute no SQL Editor do Supabase.
-- ============================================================================

-- Garante que o perfil exista em public.profiles caso o usuário já esteja em auth.users
insert into public.profiles (id, email, nome, role, status, approved_at)
select
  u.id,
  lower(trim(u.email)),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nome'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ),
  'admin',
  'approved',
  now()
from auth.users u
where lower(trim(u.email)) = lower(trim('MEU_EMAIL'))
on conflict (id) do update set
  role = 'admin',
  status = 'approved',
  approved_at = coalesce(public.profiles.approved_at, now()),
  updated_at = now();

-- Atualiza também diretamente por e-mail (caso o perfil já exista)
update public.profiles
set
  role = 'admin',
  status = 'approved',
  approved_at = coalesce(approved_at, now()),
  updated_at = now()
where lower(trim(email)) = lower(trim('MEU_EMAIL'));

-- Mantém perfis_usuarios sincronizado (compatibilidade com tabelas legadas)
update public.perfis_usuarios
set
  tipo = 'admin',
  cargo = 'Administrador Oficial',
  ativo = true,
  atualizado_em = now()
where lower(trim(email)) = lower(trim('MEU_EMAIL'));

-- Conferência imediata (deve mostrar sua conta com role = 'admin' e status = 'approved')
select id, email, nome, role, status, approved_at
from public.profiles
where lower(trim(email)) = lower(trim('MEU_EMAIL'));

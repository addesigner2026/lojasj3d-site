-- ============================================================================
-- MIGRATION 001: CONTROLE DE ACESSO (PROFILES), TRIGGER DE CADASTRO E RLS
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- Projeto: Loja SJ 3D
-- ============================================================================

-- 1. TABELA DE PERFIS LIGADA A auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text not null default '',
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);

-- Índices para performance das consultas do painel e políticas RLS
create index if not exists idx_profiles_email on public.profiles (lower(email));
create index if not exists idx_profiles_status on public.profiles (status);
create index if not exists idx_profiles_role_status on public.profiles (role, status);

-- 2. BACKFILL DE CONTAS JÁ EXISTENTES EM auth.users (sem apagar nada)
insert into public.profiles (id, email, nome, role, status, approved_at, created_at)
select
  u.id,
  lower(trim(u.email)),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nome'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    split_part(u.email, '@', 1)
  ),
  case
    when exists (
      select 1 from public.perfis_usuarios pu
      where pu.id = u.id and pu.tipo = 'admin' and pu.ativo = true
    ) then 'admin'
    else 'user'
  end,
  case
    when exists (
      select 1 from public.perfis_usuarios pu
      where pu.id = u.id and pu.tipo = 'admin' and pu.ativo = true
    ) then 'approved'
    else 'pending'
  end,
  case
    when exists (
      select 1 from public.perfis_usuarios pu
      where pu.id = u.id and pu.tipo = 'admin' and pu.ativo = true
    ) then now()
    else null
  end,
  coalesce(u.created_at, now())
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- 3. FUNÇÃO AUXILIAR is_admin() (SECURITY DEFINER — EVITA RECURSÃO DE RLS)
-- Verifica se o usuário logado tem role = 'admin' E status = 'approved' em public.profiles
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'approved'
  );
$$;

-- Mantém as funções legadas (is_admin_ou_vendedor e is_equipe_interna) integradas a public.profiles
-- para que todas as tabelas existentes (clientes, orcamentos, configuracoes_site, LGPD) continuem funcionando.
create or replace function public.is_admin_ou_vendedor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.perfis_usuarios
      where id = (select auth.uid())
        and tipo in ('operador', 'admin')
        and ativo = true
    );
$$;

create or replace function public.is_equipe_interna()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.perfis_usuarios
      where id = (select auth.uid())
        and tipo in ('operador', 'admin', 'financeiro')
        and ativo = true
    );
$$;

-- Garante execução apenas para roles autenticados (anon sempre retorna false)
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 4. TRIGGER AUTOMÁTICO NO CADASTRO (auth.users -> public.profiles)
-- SEGURANÇA CRÍTICA: Toda conta nova nasce SEMPRE como role = 'user' e status = 'pending'.
-- Ninguém consegue se auto-aprovar ou virar admin no ato do cadastro.
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_email text;
begin
  v_email := lower(trim(coalesce(new.email, '')));
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );

  -- Cria perfil na tabela oficial public.profiles (sempre pendente e usuário comum)
  if v_email <> '' then
    insert into public.profiles (id, email, nome, role, status)
    values (new.id, v_email, v_nome, 'user', 'pending')
    on conflict (id) do update set
      email = excluded.email,
      nome = case when coalesce(public.profiles.nome, '') = '' then excluded.nome else public.profiles.nome end,
      updated_at = now();
  end if;

  -- Mantém compatibilidade com a tabela legada perfis_usuarios (sempre cliente)
  if to_regclass('public.perfis_usuarios') is not null and v_email <> '' then
    insert into public.perfis_usuarios (id, nome, email, cargo, tipo, foto_url)
    values (
      new.id,
      v_nome,
      v_email,
      'Cliente',
      'cliente',
      new.raw_user_meta_data->>'avatar_url'
    )
    on conflict (id) do update set
      nome = excluded.nome,
      email = excluded.email,
      atualizado_em = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario();

-- 5. TRIGGER DE PROTEÇÃO DE SEGURANÇA EM public.profiles
-- Regras aplicadas no banco (impossível burlar pelo front-end):
-- (a) Usuário comum NÃO pode alterar o próprio role, status, approved_at ou approved_by.
-- (b) Um admin NÃO pode remover, bloquear ou rebaixar o próprio acesso por engano.
-- (c) Nunca pode ficar com zero administradores aprovados no sistema.
-- (d) Preenche approved_at e approved_by automaticamente quando aprovado.
-- (e) Sincroniza perfis_usuarios automaticamente quando role/status mudam.
create or replace function public.proteger_profiles_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eh_admin boolean := public.is_admin();
  v_outros_admins integer := 0;
begin
  -- Se estiver rodando direto no SQL Editor do Supabase (v_uid is null = superusuário/postgres), permite manutenção manual
  if v_uid is null then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
      if new.status = 'approved' and old.status is distinct from 'approved' and new.approved_at is null then
        new.approved_at := now();
      end if;
      return new;
    end if;
    return old;
  end if;

  if tg_op = 'DELETE' then
    if not v_eh_admin then
      raise exception 'Acesso negado: apenas administradores aprovados podem excluir perfis.';
    end if;
    if old.id = v_uid then
      raise exception 'Ação bloqueada: você não pode excluir a própria conta administrativa.';
    end if;
    if old.role = 'admin' and old.status = 'approved' then
      select count(*) into v_outros_admins
      from public.profiles
      where role = 'admin' and status = 'approved' and id <> old.id;
      if v_outros_admins < 1 then
        raise exception 'Ação bloqueada: deve existir sempre pelo menos um administrador aprovado no sistema.';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Usuário comum tentando mexer em role/status/aprovação -> BLOQUEADO
    if not v_eh_admin then
      if new.role is distinct from old.role
         or new.status is distinct from old.status
         or new.approved_at is distinct from old.approved_at
         or new.approved_by is distinct from old.approved_by
         or new.email is distinct from old.email then
        raise exception 'Acesso negado: você não tem permissão para alterar seu papel ou status de acesso.';
      end if;
    else
      -- Admin tentando rebaixar ou bloquear a si mesmo -> BLOQUEADO
      if old.id = v_uid and (new.role <> 'admin' or new.status <> 'approved') then
        raise exception 'Ação bloqueada: você não pode rebaixar ou bloquear o próprio acesso administrativo.';
      end if;

      -- Impede remover/rebaixar o último admin aprovado do sistema
      if old.role = 'admin' and old.status = 'approved' and (new.role <> 'admin' or new.status <> 'approved') then
        select count(*) into v_outros_admins
        from public.profiles
        where role = 'admin' and status = 'approved' and id <> old.id;
        if v_outros_admins < 1 then
          raise exception 'Ação bloqueada: deve existir sempre pelo menos um administrador aprovado no sistema.';
        end if;
      end if;

      -- Auditoria automática de aprovação
      if new.status = 'approved' and old.status is distinct from 'approved' then
        new.approved_at := now();
        new.approved_by := v_uid;
      elsif new.status <> 'approved' then
        new.approved_at := null;
        new.approved_by := null;
      end if;
    end if;

    new.updated_at := now();

    -- Mantém tabela legada perfis_usuarios sincronizada (se existir)
    if to_regclass('public.perfis_usuarios') is not null then
      update public.perfis_usuarios
      set
        tipo = case when new.role = 'admin' and new.status = 'approved' then 'admin' else 'cliente' end,
        cargo = case when new.role = 'admin' and new.status = 'approved' then 'Administrador' else 'Cliente' end,
        ativo = (new.status <> 'blocked'),
        atualizado_em = now()
      where id = new.id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_profiles_seguranca on public.profiles;
create trigger trg_proteger_profiles_seguranca
  before update or delete on public.profiles
  for each row execute function public.proteger_profiles_seguranca();

-- 6. ROW LEVEL SECURITY (RLS) E PERMISSÕES EM public.profiles
alter table public.profiles enable row level security;

-- Permissões explícitas na Data API (anon não acessa nem lista perfis)
revoke all on public.profiles from anon;
grant select, update, delete on public.profiles to authenticated;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

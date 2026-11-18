-- ============================================================================
-- MIGRATION 005: SEPARAÇÃO DE PAPÉIS (ADMIN / STAFF / CUSTOMER), TRIGGER SEGURO E RLS
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- NÃO apaga dados nem altera contas 'admin' já existentes.
-- Projeto: Loja SJ 3D
-- ============================================================================

-- 1. CAMPOS DE DADOS DO CLIENTE / EQUIPE EM public.profiles
alter table public.profiles add column if not exists telefone text not null default '';
alter table public.profiles add column if not exists endereco text not null default '';
alter table public.profiles add column if not exists cidade_uf text not null default '';
alter table public.profiles add column if not exists cargo text not null default '';

-- 2. ATUALIZA CHECK CONSTRAINT DE role PARA ('admin', 'staff', 'customer')
-- Remove qualquer CHECK antigo sobre a coluna role antes de migrar os valores
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- 3. MIGRAÇÃO SEGURA DAS CONTAS JÁ EXISTENTES
-- Regra definida pelo proprietário:
--   - Conta(s) 'admin' permanecem INTACTAS.
--   - Todas as demais contas antigas ('user') passam a ser 'customer' (cliente),
--     mantendo 'blocked' se já estavam bloqueadas, ou 'approved' para acessarem /conta.
update public.profiles
set
  role = 'customer',
  status = case when status = 'blocked' then 'blocked' else 'approved' end,
  approved_at = case when status = 'blocked' then null else coalesce(approved_at, now()) end,
  updated_at = now()
where role not in ('admin', 'staff', 'customer');

-- Adiciona a nova regra oficial de papéis e ajusta defaults
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'staff', 'customer'));

alter table public.profiles alter column role set default 'customer';
alter table public.profiles alter column status set default 'approved';

-- 4. FUNÇÕES AUXILIARES DE PERMISSÃO (SECURITY DEFINER — SEM RECURSÃO DE RLS)
-- is_admin(): verdadeiro SOMENTE para role = 'admin' E status = 'approved'
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

-- is_staff(): verdadeiro para role in ('admin', 'staff') E status = 'approved'
-- Um funcionário 'pending' ou 'blocked' SEMPRE recebe FALSE no banco.
create or replace function public.is_staff()
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
      and role in ('admin', 'staff')
      and status = 'approved'
  );
$$;

-- Mantém funções legadas integradas a is_staff() para compatibilidade total
create or replace function public.is_admin_ou_vendedor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_staff();
$$;

create or replace function public.is_equipe_interna()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_staff();
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

revoke all on function public.is_admin_ou_vendedor() from public;
grant execute on function public.is_admin_ou_vendedor() to authenticated;

revoke all on function public.is_equipe_interna() from public;
grant execute on function public.is_equipe_interna() to authenticated;

-- 5. TRIGGER DE CADASTRO BLINDADO (auth.users -> public.profiles)
-- SEGURANÇA CRÍTICA:
--   - Aceita EXCLUSIVAMENTE 'customer' ou 'staff' vindos do front-end (raw_user_meta_data->>'account_type').
--   - NUNCA permite cadastro como 'admin' (qualquer tentativa de enviar 'admin' cai como 'customer').
--   - 'customer' nasce com status = 'approved' (entra direto no painel /conta).
--   - 'staff' nasce SEMPRE com status = 'pending' (sem acesso algum até o admin aprovar).
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_email text;
  v_telefone text;
  v_endereco text;
  v_cargo text;
  v_requested_type text;
  v_final_role text;
  v_final_status text;
  v_approved_at timestamptz;
begin
  v_email := lower(trim(coalesce(new.email, '')));
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(v_email, '@', 1)
  );
  v_telefone := trim(coalesce(new.raw_user_meta_data->>'telefone', ''));
  v_endereco := trim(coalesce(new.raw_user_meta_data->>'endereco', ''));
  v_cargo := trim(coalesce(new.raw_user_meta_data->>'cargo', ''));

  -- Whitelist estrita: SOMENTE 'staff' ou 'customer'.
  -- Qualquer tentativa de enviar 'admin' ou outro valor é bloqueada/convertida em 'customer'.
  v_requested_type := lower(trim(coalesce(new.raw_user_meta_data->>'account_type', 'customer')));

  if v_requested_type = 'staff' then
    v_final_role := 'staff';
    v_final_status := 'pending';
    v_approved_at := null;
  else
    v_final_role := 'customer';
    v_final_status := 'approved';
    v_approved_at := now();
  end if;

  if v_email <> '' then
    insert into public.profiles (id, email, nome, telefone, endereco, cargo, role, status, approved_at)
    values (new.id, v_email, v_nome, v_telefone, v_endereco, v_cargo, v_final_role, v_final_status, v_approved_at)
    on conflict (id) do update set
      email = excluded.email,
      nome = case when coalesce(public.profiles.nome, '') = '' then excluded.nome else public.profiles.nome end,
      updated_at = now();
  end if;

  -- Mantém compatibilidade com tabela legada perfis_usuarios (sempre cliente no cadastro)
  if to_regclass('public.perfis_usuarios') is not null and v_email <> '' then
    insert into public.perfis_usuarios (id, nome, email, cargo, tipo, foto_url)
    values (
      new.id,
      v_nome,
      v_email,
      case when v_final_role = 'staff' then 'Equipe (Pendente)' else 'Cliente' end,
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

-- 6. TRIGGER DE PROTEÇÃO EM public.profiles (IMPEDE ESCALAÇÃO DE PRIVILÉGIOS E AUTO-REMOÇÃO)
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
  -- Execução manual no SQL Editor do Supabase (v_uid is null = manutenção pelo dono)
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
      raise exception 'Acesso negado: apenas administradores aprovados podem excluir contas.';
    end if;
    if old.id = v_uid then
      raise exception 'Ação bloqueada: você não pode excluir a própria conta administrativa.';
    end if;
    if old.role = 'admin' and old.status = 'approved' then
      select count(*) into v_outros_admins
      from public.profiles
      where role = 'admin' and status = 'approved' and id <> old.id;
      if v_outros_admins < 1 then
        raise exception 'Ação bloqueada: deve existir sempre pelo menos um administrador aprovado.';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Cliente ou Staff NÃO pode alterar role, status, approved_at, approved_by ou email
    if not v_eh_admin then
      if new.role is distinct from old.role
         or new.status is distinct from old.status
         or new.approved_at is distinct from old.approved_at
         or new.approved_by is distinct from old.approved_by
         or new.email is distinct from old.email then
        raise exception 'Acesso negado: você não tem permissão para alterar papel ou status de acesso.';
      end if;
    else
      -- Admin não pode rebaixar ou bloquear a si mesmo por engano
      if old.id = v_uid and (new.role <> 'admin' or new.status <> 'approved') then
        raise exception 'Ação bloqueada: você não pode rebaixar ou bloquear o próprio acesso administrativo.';
      end if;

      -- Nunca permitir ficar sem nenhum administrador aprovado
      if old.role = 'admin' and old.status = 'approved' and (new.role <> 'admin' or new.status <> 'approved') then
        select count(*) into v_outros_admins
        from public.profiles
        where role = 'admin' and status = 'approved' and id <> old.id;
        if v_outros_admins < 1 then
          raise exception 'Ação bloqueada: deve existir sempre pelo menos um administrador aprovado.';
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

    -- Mantém tabela legada perfis_usuarios sincronizada
    if to_regclass('public.perfis_usuarios') is not null then
      update public.perfis_usuarios
      set
        nome = coalesce(nullif(trim(new.nome), ''), nome),
        tipo = case
          when new.role = 'admin' and new.status = 'approved' then 'admin'
          when new.role = 'staff' and new.status = 'approved' then 'operador'
          else 'cliente'
        end,
        cargo = case
          when new.role = 'admin' and new.status = 'approved' then 'Administrador'
          when new.role = 'staff' and new.status = 'approved' then coalesce(nullif(trim(new.cargo), ''), 'Funcionário')
          else 'Cliente'
        end,
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

-- 7. POLÍTICAS RLS EM public.profiles (APENAS PRÓPRIO PERFIL OU ADMIN)
alter table public.profiles enable row level security;

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

-- 8. ATUALIZA POLÍTICAS DE ESCRITA EM public.products PARA PERMITIR STAFF APROVADO E ADMIN
-- Leitura continua pública; escrita agora é permitida para is_staff() (admin + staff aprovado).
drop policy if exists "products_insert_admin_only" on public.products;
drop policy if exists "products_insert_staff_only" on public.products;
create policy "products_insert_staff_only"
  on public.products for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "products_update_admin_only" on public.products;
drop policy if exists "products_update_staff_only" on public.products;
create policy "products_update_staff_only"
  on public.products for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "products_delete_admin_only" on public.products;
drop policy if exists "products_delete_staff_only" on public.products;
create policy "products_delete_staff_only"
  on public.products for delete
  to authenticated
  using (public.is_staff());

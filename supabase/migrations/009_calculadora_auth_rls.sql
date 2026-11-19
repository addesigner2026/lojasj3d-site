-- ============================================================================
-- MIGRATION 009: LOGIN ÚNICO & RLS DA CALCULADORA 3D (HISTÓRICO, AJUSTES E LEADS)
-- ============================================================================
-- 100% idempotente (seguro para executar mais de uma vez).
-- Unifica a autenticação da calculadora (/calculadora) ao Supabase Auth do site:
--   - Cada usuário aprovado (customer, staff, admin) tem seu próprio histórico
--     (public.calc_history) e preferências (public.calc_preferences) isolados por user_id.
--   - Cliente A NUNCA acessa histórico/ajustes do Cliente B nem a tabela calc_leads.
--   - Apenas staff aprovado e admin (public.is_staff()) acessam e gerenciam calc_leads.
--   - Respeita MFA/TOTP (AAL2) automaticamente caso esteja habilitado na conta.
--   - Preserva e migra leads legados (configuracoes_site -> calc_leads) casando por e-mail.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) BACKUP PREVENTIVO DE CONFIGURACOES DA CALCULADORA LEGADA (SE EXISTIR)
do $$
begin
  if to_regclass('public.configuracoes_site') is not null then
    execute 'create table if not exists public.configuracoes_site_backup_009 (like public.configuracoes_site including all)';
    execute $q$
      insert into public.configuracoes_site_backup_009
      select * from public.configuracoes_site
      where chave = 'calculadora_leads_v1'
      on conflict do nothing
    $q$;
  end if;
end $$;

-- 2) TABELA DE LEADS / USUÁRIOS DA CALCULADORA (ACESSO EXCLUSIVO STAFF/ADMIN VIA RLS)
create table if not exists public.calc_leads (
  id uuid primary key default gen_random_uuid(),
  legacy_id text,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null default '',
  email text not null unique,
  whatsapp text not null default '',
  cidade text not null default '',
  status text not null default 'ativo' check (status in ('ativo', 'revogado')),
  origem text not null default 'conta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_calc_leads_email_lower on public.calc_leads (lower(email));
create index if not exists idx_calc_leads_user_id on public.calc_leads (user_id);

-- 3) TABELA DE HISTÓRICO DE CÁLCULOS POR USUÁRIO (user_id = auth.uid())
create table if not exists public.calc_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_item_id text not null,
  name text not null default 'Peça Impressa 3D',
  marketplace_key text not null default 'ml_premium',
  marketplace_name text not null default 'Marketplace',
  sale_price numeric(12,2) not null default 0,
  net_profit numeric(12,2) not null default 0,
  net_margin numeric(8,2) not null default 0,
  weight_grams numeric(10,2) not null default 0,
  calc_date_label text not null default '',
  state_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_calc_history_user_item unique (user_id, client_item_id)
);

create index if not exists idx_calc_history_user_created on public.calc_history (user_id, created_at desc);

-- 4) TABELA DE AJUSTES / PREFERÊNCIAS DE OFICINA POR USUÁRIO
create table if not exists public.calc_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 5) HELPER DE AUTORIZAÇÃO (CONTA APPROVED + NÃO REVOGADA + MFA AAL2 SE ATIVO)
create or replace function public.is_calc_authorized()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'approved'
      and (
        p.role = 'admin'
        or not exists (
          select 1
          from public.calc_leads cl
          where lower(cl.email) = lower(p.email)
            and cl.status = 'revogado'
        )
      )
  )
  and (
    not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = (select auth.uid())
        and f.status = 'verified'
    )
    or coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
  );
$$;

revoke all on function public.is_calc_authorized() from public;
grant execute on function public.is_calc_authorized() to authenticated;

-- 6) RPC PARA O PRÓPRIO USUÁRIO CONSULTAR SEU STATUS DE ACESSO À CALCULADORA
-- Nunca expõe dados de outros usuários nem permite leitura da tabela calc_leads por clientes.
create or replace function public.obter_meu_status_calculadora()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_lead_status text := null;
  v_has_verified_mfa boolean := false;
  v_aal text := coalesce(auth.jwt()->>'aal', 'aal1');
begin
  if v_uid is null then
    return jsonb_build_object(
      'autenticado', false,
      'autorizado', false,
      'motivo', 'no_session'
    );
  end if;

  select * into v_prof
  from public.profiles
  where id = v_uid
  limit 1;

  if v_prof.id is null then
    return jsonb_build_object(
      'autenticado', true,
      'autorizado', false,
      'motivo', 'no_profile'
    );
  end if;

  select exists (
    select 1
    from auth.mfa_factors f
    where f.user_id = v_uid
      and f.status = 'verified'
  ) into v_has_verified_mfa;

  if v_has_verified_mfa and v_aal <> 'aal2' then
    return jsonb_build_object(
      'autenticado', true,
      'autorizado', false,
      'motivo', 'mfa_required',
      'requires_mfa', true,
      'role', v_prof.role,
      'profile_status', v_prof.status,
      'nome', v_prof.nome,
      'email', v_prof.email
    );
  end if;

  select cl.status into v_lead_status
  from public.calc_leads cl
  where lower(cl.email) = lower(v_prof.email)
  limit 1;

  if v_prof.status = 'pending' then
    return jsonb_build_object(
      'autenticado', true,
      'autorizado', false,
      'motivo', 'pending',
      'role', v_prof.role,
      'profile_status', v_prof.status,
      'lead_status', v_lead_status,
      'nome', v_prof.nome,
      'email', v_prof.email
    );
  end if;

  if v_prof.status = 'blocked' or (v_prof.role <> 'admin' and v_lead_status = 'revogado') then
    return jsonb_build_object(
      'autenticado', true,
      'autorizado', false,
      'motivo', 'blocked',
      'role', v_prof.role,
      'profile_status', v_prof.status,
      'lead_status', v_lead_status,
      'nome', v_prof.nome,
      'email', v_prof.email
    );
  end if;

  if v_prof.status = 'approved' then
    return jsonb_build_object(
      'autenticado', true,
      'autorizado', true,
      'motivo', 'ok',
      'role', v_prof.role,
      'profile_status', v_prof.status,
      'lead_status', coalesce(v_lead_status, 'ativo'),
      'nome', v_prof.nome,
      'email', v_prof.email
    );
  end if;

  return jsonb_build_object(
    'autenticado', true,
    'autorizado', false,
    'motivo', 'pending',
    'role', v_prof.role,
    'profile_status', v_prof.status,
    'nome', v_prof.nome,
    'email', v_prof.email
  );
end;
$$;

revoke all on function public.obter_meu_status_calculadora() from public, anon;
grant execute on function public.obter_meu_status_calculadora() to authenticated;

-- 7) TRIGGER DE NORMALIZAÇÃO E PROTEÇÃO EM public.calc_leads
create or replace function public.proteger_calc_leads_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid;
  v_target_role text;
begin
  if tg_op = 'DELETE' then
    select role into v_target_role
    from public.profiles
    where lower(email) = lower(old.email)
    limit 1;
    if v_target_role = 'admin' then
      raise exception 'Não é permitido excluir um administrador mestre da lista.';
    end if;
    return old;
  end if;

  new.email := lower(trim(coalesce(new.email, '')));
  new.nome := trim(coalesce(new.nome, ''));
  new.whatsapp := trim(coalesce(new.whatsapp, ''));
  new.cidade := trim(coalesce(new.cidade, ''));
  new.updated_at := now();

  if new.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido para registro na calculadora.';
  end if;

  if new.user_id is null then
    select id into v_uid
    from auth.users
    where lower(email) = new.email
    limit 1;
    new.user_id := v_uid;
  end if;

  if new.status = 'revogado' then
    select role into v_target_role
    from public.profiles
    where lower(email) = new.email
    limit 1;
    if v_target_role = 'admin' then
      raise exception 'Não é permitido revogar acesso de um administrador.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_calc_leads_seguranca on public.calc_leads;
create trigger trg_proteger_calc_leads_seguranca
  before insert or update or delete on public.calc_leads
  for each row execute function public.proteger_calc_leads_seguranca();

-- 8) SINCRONIZAÇÃO AUTOMÁTICA DE NOVOS CLIENTES / PERFIS -> public.calc_leads
create or replace function public.sync_profile_para_calc_leads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cidade text;
begin
  if trim(coalesce(new.email, '')) = '' then
    return new;
  end if;

  v_cidade := trim(concat_ws(' / ', nullif(trim(coalesce(new.cidade, '')), ''), nullif(trim(coalesce(new.uf, '')), '')));
  if v_cidade = '' then
    v_cidade := trim(coalesce(new.cidade_uf, ''));
  end if;

  insert into public.calc_leads (user_id, nome, email, whatsapp, cidade, status, origem, created_at)
  values (
    new.id,
    coalesce(nullif(trim(new.nome), ''), split_part(lower(new.email), '@', 1)),
    lower(trim(new.email)),
    coalesce(new.telefone, ''),
    v_cidade,
    case when new.status = 'blocked' then 'revogado' else 'ativo' end,
    case when new.role = 'admin' then 'admin' when new.role = 'staff' then 'equipe' else 'conta' end,
    coalesce(new.created_at, now())
  )
  on conflict (email) do update set
    user_id = coalesce(public.calc_leads.user_id, excluded.user_id),
    nome = case when coalesce(public.calc_leads.nome, '') = '' then excluded.nome else public.calc_leads.nome end,
    whatsapp = case when coalesce(public.calc_leads.whatsapp, '') = '' then excluded.whatsapp else public.calc_leads.whatsapp end,
    cidade = case when coalesce(public.calc_leads.cidade, '') = '' then excluded.cidade else public.calc_leads.cidade end,
    status = case
      when new.status = 'blocked' and new.role <> 'admin' then 'revogado'
      when public.calc_leads.status = 'revogado' then 'revogado'
      else 'ativo'
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_calc_leads on public.profiles;
create trigger trg_sync_profile_calc_leads
  after insert or update of nome, telefone, cidade, uf, cidade_uf, status, role on public.profiles
  for each row execute function public.sync_profile_para_calc_leads();

-- 9) POLÍTICAS RLS ESTRITAS NAS 3 TABELAS DA CALCULADORA
-- 9.1 calc_history: somente o próprio usuário aprovado (user_id = auth.uid())
alter table public.calc_history enable row level security;
revoke all on public.calc_history from public, anon;
grant select, insert, update, delete on public.calc_history to authenticated;

drop policy if exists "calc_history_select_own" on public.calc_history;
create policy "calc_history_select_own"
  on public.calc_history for select
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_history_insert_own" on public.calc_history;
create policy "calc_history_insert_own"
  on public.calc_history for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_history_update_own" on public.calc_history;
create policy "calc_history_update_own"
  on public.calc_history for update
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized())
  with check (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_history_delete_own" on public.calc_history;
create policy "calc_history_delete_own"
  on public.calc_history for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized());

-- 9.2 calc_preferences: somente o próprio usuário aprovado (user_id = auth.uid())
alter table public.calc_preferences enable row level security;
revoke all on public.calc_preferences from public, anon;
grant select, insert, update, delete on public.calc_preferences to authenticated;

drop policy if exists "calc_preferences_select_own" on public.calc_preferences;
create policy "calc_preferences_select_own"
  on public.calc_preferences for select
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_preferences_insert_own" on public.calc_preferences;
create policy "calc_preferences_insert_own"
  on public.calc_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_preferences_update_own" on public.calc_preferences;
create policy "calc_preferences_update_own"
  on public.calc_preferences for update
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized())
  with check (user_id = (select auth.uid()) and public.is_calc_authorized());

drop policy if exists "calc_preferences_delete_own" on public.calc_preferences;
create policy "calc_preferences_delete_own"
  on public.calc_preferences for delete
  to authenticated
  using (user_id = (select auth.uid()) and public.is_calc_authorized());

-- 9.3 calc_leads: SOMENTE staff aprovado e admin (is_staff()); cliente não lê nem escreve
alter table public.calc_leads enable row level security;
revoke all on public.calc_leads from public, anon;
grant select, insert, update, delete on public.calc_leads to authenticated;

drop policy if exists "calc_leads_staff_select" on public.calc_leads;
create policy "calc_leads_staff_select"
  on public.calc_leads for select
  to authenticated
  using (public.is_staff());

drop policy if exists "calc_leads_staff_insert" on public.calc_leads;
create policy "calc_leads_staff_insert"
  on public.calc_leads for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "calc_leads_staff_update" on public.calc_leads;
create policy "calc_leads_staff_update"
  on public.calc_leads for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "calc_leads_staff_delete" on public.calc_leads;
create policy "calc_leads_staff_delete"
  on public.calc_leads for delete
  to authenticated
  using (public.is_staff());

-- 10) MIGRAÇÃO IDEMPOTENTE DE LEADS LEGADOS E PERFIS EXISTENTES -> calc_leads
do $$
declare
  v_valor jsonb;
  v_revogados text[] := array[]::text[];
  v_item jsonb;
  v_email text;
  v_uid uuid;
begin
  -- 10.1 Migra leads de configuracoes_site ('calculadora_leads_v1') se houver
  if to_regclass('public.configuracoes_site') is not null then
    select valor into v_valor
    from public.configuracoes_site
    where chave = 'calculadora_leads_v1'
    limit 1;

    if v_valor is not null and jsonb_typeof(v_valor->'revogados') = 'array' then
      select coalesce(array_agg(lower(trim(x))), array[]::text[])
      into v_revogados
      from jsonb_array_elements_text(v_valor->'revogados') as t(x);
    end if;

    if v_valor is not null and jsonb_typeof(v_valor->'leads') = 'array' then
      for v_item in select * from jsonb_array_elements(v_valor->'leads') loop
        v_email := lower(trim(coalesce(v_item->>'email', '')));
        if v_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
          select id into v_uid from auth.users where lower(email) = v_email limit 1;
          insert into public.calc_leads (legacy_id, user_id, nome, email, whatsapp, cidade, status, origem, created_at)
          values (
            nullif(v_item->>'id', ''),
            v_uid,
            coalesce(nullif(trim(v_item->>'nome'), ''), split_part(v_email, '@', 1)),
            v_email,
            coalesce(v_item->>'whatsapp', ''),
            coalesce(v_item->>'cidade', ''),
            case
              when coalesce(v_item->>'status', '') = 'revogado' or v_email = any(v_revogados) then 'revogado'
              else 'ativo'
            end,
            'legado_calculadora',
            coalesce(nullif(v_item->>'data', '')::timestamptz, now())
          )
          on conflict (email) do update set
            user_id = coalesce(public.calc_leads.user_id, excluded.user_id),
            legacy_id = coalesce(public.calc_leads.legacy_id, excluded.legacy_id),
            updated_at = now();
        end if;
      end loop;
    end if;
  end if;

  -- 10.2 Garante que todas as contas já cadastradas em public.profiles apareçam em calc_leads
  insert into public.calc_leads (user_id, nome, email, whatsapp, cidade, status, origem, created_at)
  select
    p.id,
    coalesce(nullif(trim(p.nome), ''), split_part(lower(p.email), '@', 1)),
    lower(trim(p.email)),
    coalesce(p.telefone, ''),
    coalesce(
      nullif(trim(concat_ws(' / ', nullif(trim(coalesce(p.cidade, '')), ''), nullif(trim(coalesce(p.uf, '')), ''))), ''),
      trim(coalesce(p.cidade_uf, ''))
    ),
    case when p.status = 'blocked' and p.role <> 'admin' then 'revogado' else 'ativo' end,
    case when p.role = 'admin' then 'admin' when p.role = 'staff' then 'equipe' else 'conta' end,
    coalesce(p.created_at, now())
  from public.profiles p
  where trim(coalesce(p.email, '')) <> ''
  on conflict (email) do update set
    user_id = coalesce(public.calc_leads.user_id, excluded.user_id),
    updated_at = now();
end $$;

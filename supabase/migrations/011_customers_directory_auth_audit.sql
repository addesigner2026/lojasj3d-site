-- ============================================================================
-- MIGRATION 011: DIRETÓRIO DE CLIENTES CADASTRADOS, AUTH PROVIDERS E AUDITORIA
-- ============================================================================
-- 100% idempotente. Não altera regras de login, /conta, loja pública nem RLS
-- existente de outras tabelas.
-- Implementa:
--   1. Funções imutáveis sj_norm_text / sj_only_digits e índices de busca
--   2. Regra central no banco de "cadastro completo" (PF e PJ)
--   3. Tabela public.customer_audit_logs (LGPD: view_doc, export_csv, edit_profile, block)
--   4. RPCs SECURITY DEFINER restritas a public.is_staff() / public.is_admin()
--      lendo apenas id, provedores, email_confirmado, created_at e last_sign_in_at
--      de auth.users/auth.identities (NUNCA hashes, tokens ou metadados internos)
-- ============================================================================

-- 1. FUNÇÕES AUXILIARES DE NORMALIZAÇÃO PARA BUSCA SEM ACENTOS / PONTUAÇÃO
create or replace function public.sj_norm_text(p_txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(
    translate(
      coalesce(p_txt, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )
  );
$$;

create or replace function public.sj_only_digits(p_txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(coalesce(p_txt, ''), '\D', '', 'g');
$$;

-- Índices para busca paginada rápida direto no banco
create index if not exists idx_profiles_role_created on public.profiles (role, created_at desc);
create index if not exists idx_profiles_norm_search on public.profiles (
  sj_norm_text(nome),
  sj_norm_text(razao_social),
  sj_norm_text(nome_fantasia),
  sj_norm_text(email)
);
create index if not exists idx_profiles_phone_digits on public.profiles (sj_only_digits(telefone));

-- 2. MASCARAMENTO SEGURO E REGRA CENTRAL DE CADASTRO COMPLETO
create or replace function public.sj_mask_doc(p_doc text, p_type text default 'pf')
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_d text := regexp_replace(coalesce(p_doc, ''), '\D', '', 'g');
begin
  if v_d = '' then
    return '';
  end if;
  if length(v_d) = 11 then
    return '***.' || substr(v_d, 4, 3) || '.***-' || substr(v_d, 10, 2);
  end if;
  if length(v_d) = 14 then
    return substr(v_d, 1, 2) || '.***.***/****-' || substr(v_d, 13, 2);
  end if;
  return '***';
end;
$$;

-- Regra única de "Cadastro Completo" no banco (espelha a regra do front-end):
--   PF: nome, cpf válido, telefone, email, cep, logradouro, numero, bairro, cidade, uf
--   PJ: cnpj válido, razao_social, (ie_tipo in isento/nao_contribuinte ou inscricao_estadual), contato_nome, telefone, email, cep, logradouro, numero, bairro, cidade, uf
--   Complemento é opcional.
create or replace function public.sj_evaluate_profile_completeness(p public.profiles)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_type text := case when coalesce(p.person_type, 'pf') = 'pj' then 'pj' else 'pf' end;
  v_missing text[] := array[]::text[];
  v_total integer := 10;
  v_done integer := 0;
  v_cpf text := regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g');
  v_cnpj text := regexp_replace(coalesce(p.cnpj, ''), '\D', '', 'g');
  v_tel text := regexp_replace(coalesce(p.telefone, ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(p.cep, ''), '\D', '', 'g');
begin
  if v_type = 'pj' then
    v_total := 12;
    if length(v_cnpj) <> 14 or not public.validar_cnpj(v_cnpj) then v_missing := array_append(v_missing, 'CNPJ'); end if;
    if trim(coalesce(p.razao_social, '')) = '' then v_missing := array_append(v_missing, 'Razão social'); end if;
    if coalesce(p.ie_tipo, 'contribuinte') = 'contribuinte' and trim(coalesce(p.inscricao_estadual, '')) = '' then
      v_missing := array_append(v_missing, 'Inscrição estadual');
    end if;
    if trim(coalesce(p.contato_nome, '')) = '' then v_missing := array_append(v_missing, 'Pessoa de contato'); end if;
  else
    v_total := 10;
    if trim(coalesce(p.nome, '')) = '' then v_missing := array_append(v_missing, 'Nome completo'); end if;
    if length(v_cpf) <> 11 or not public.validar_cpf(v_cpf) then v_missing := array_append(v_missing, 'CPF'); end if;
  end if;

  if length(v_tel) < 8 then v_missing := array_append(v_missing, 'Telefone'); end if;
  if trim(coalesce(p.email, '')) = '' then v_missing := array_append(v_missing, 'E-mail'); end if;
  if length(v_cep) <> 8 then v_missing := array_append(v_missing, 'CEP'); end if;
  if trim(coalesce(p.logradouro, '')) = '' then v_missing := array_append(v_missing, 'Rua / Logradouro'); end if;
  if trim(coalesce(p.numero, '')) = '' then v_missing := array_append(v_missing, 'Número'); end if;
  if trim(coalesce(p.bairro, '')) = '' then v_missing := array_append(v_missing, 'Bairro'); end if;
  if trim(coalesce(p.cidade, '')) = '' then v_missing := array_append(v_missing, 'Cidade'); end if;
  if length(trim(coalesce(p.uf, ''))) <> 2 then v_missing := array_append(v_missing, 'UF'); end if;

  v_done := greatest(0, v_total - coalesce(array_length(v_missing, 1), 0));

  return jsonb_build_object(
    'is_complete', (coalesce(array_length(v_missing, 1), 0) = 0),
    'missing_fields', to_jsonb(v_missing),
    'missing_count', coalesce(array_length(v_missing, 1), 0),
    'total_required', v_total,
    'completed_required', v_done
  );
end;
$$;

-- 3. TABELA DE AUDITORIA LGPD PARA CLIENTES
create table if not exists public.customer_audit_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('view_doc', 'export_csv', 'edit_profile', 'block_access', 'unblock_access')),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  actor_name text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_audit_cust_created on public.customer_audit_logs (customer_id, created_at desc);

alter table public.customer_audit_logs enable row level security;
revoke all on public.customer_audit_logs from anon;
grant select, insert on public.customer_audit_logs to authenticated;

drop policy if exists "customer_audit_admin_select" on public.customer_audit_logs;
create policy "customer_audit_admin_select"
  on public.customer_audit_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "customer_audit_staff_insert" on public.customer_audit_logs;
create policy "customer_audit_staff_insert"
  on public.customer_audit_logs for insert
  to authenticated
  with check (public.is_staff() and actor_id = (select auth.uid()));

-- 4. RPC DE BUSCA INTELIGENTE NO "EMITIR ORÇAMENTO" (STAFF & ADMIN)
-- Retorna dados completos do cliente + selo Completo/Incompleto + solicitações em aberto.
create or replace function public.admin_search_customers_for_quote(p_query text default '', p_limit integer default 12)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_q text := public.sj_norm_text(trim(coalesce(p_query, '')));
  v_digits text := public.sj_only_digits(p_query);
  v_lim integer := least(30, greatest(1, coalesce(p_limit, 12)));
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Acesso negado: apenas a equipe autorizada pode pesquisar clientes.';
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into v_rows
  from (
    select
      p.id,
      p.person_type,
      p.nome,
      p.razao_social,
      p.nome_fantasia,
      p.inscricao_estadual,
      p.ie_tipo,
      p.contato_nome,
      p.cpf,
      p.cnpj,
      public.sj_mask_doc(case when p.person_type = 'pj' then p.cnpj else p.cpf end, p.person_type) as doc_masked,
      p.telefone,
      p.email,
      p.cep,
      p.logradouro,
      p.numero,
      p.complemento,
      p.bairro,
      p.cidade,
      p.uf,
      p.endereco,
      p.cidade_uf,
      p.status,
      public.sj_evaluate_profile_completeness(p) as completeness,
      coalesce((
        select count(*)::integer
        from public.quotes q
        where q.user_id = p.id
          and q.status in ('solicitado', 'em_analise')
      ), 0) as open_quotes_count
    from public.profiles p
    where p.role in ('customer', 'user')
      and (
        v_q = ''
        or public.sj_norm_text(p.nome) like '%' || v_q || '%'
        or public.sj_norm_text(p.razao_social) like '%' || v_q || '%'
        or public.sj_norm_text(p.nome_fantasia) like '%' || v_q || '%'
        or public.sj_norm_text(p.email) like '%' || v_q || '%'
        or (v_digits <> '' and (
          public.sj_only_digits(p.cpf) like '%' || v_digits || '%'
          or public.sj_only_digits(p.cnpj) like '%' || v_digits || '%'
          or public.sj_only_digits(p.telefone) like '%' || v_digits || '%'
        ))
      )
    order by p.updated_at desc nulls last, p.created_at desc
    limit v_lim
  ) as item;

  return v_rows;
end;
$$;

revoke all on function public.admin_search_customers_for_quote(text, integer) from public;
grant execute on function public.admin_search_customers_for_quote(text, integer) to authenticated;

-- 5. RPC PRINCIPAL DA PÁGINA "CLIENTES CADASTRADOS" (PAGINAÇÃO, FILTROS, CONTADORES, AUTH PROVIDERS)
-- NUNCA retorna hashes de senha, tokens ou metadados internos de auth.users.
create or replace function public.admin_list_registered_customers(
  p_query text default '',
  p_filter text default 'todos',
  p_sort text default 'created_desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_q text := public.sj_norm_text(trim(coalesce(p_query, '')));
  v_digits text := public.sj_only_digits(p_query);
  v_filter text := coalesce(nullif(trim(p_filter), ''), 'todos');
  v_sort text := coalesce(nullif(trim(p_sort), ''), 'created_desc');
  v_limit integer := least(100, greatest(1, coalesce(p_limit, 25)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_kpis jsonb;
  v_total_filtered integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_has_issued boolean := (to_regclass('public.issued_quotes') is not null);
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Acesso negado: apenas a equipe autorizada pode acessar o diretório de clientes.';
  end if;

  with base as (
    select
      p.id,
      coalesce(nullif(p.person_type, ''), 'pf') as person_type,
      p.nome,
      p.razao_social,
      p.nome_fantasia,
      p.inscricao_estadual,
      p.ie_tipo,
      p.contato_nome,
      public.sj_mask_doc(case when coalesce(p.person_type, 'pf') = 'pj' then p.cnpj else p.cpf end, p.person_type) as doc_masked,
      (coalesce(p.cpf, '') <> '' or coalesce(p.cnpj, '') <> '') as has_doc,
      p.telefone,
      p.email,
      p.cep,
      p.logradouro,
      p.numero,
      p.complemento,
      p.bairro,
      p.cidade,
      p.uf,
      p.status,
      p.created_at,
      p.updated_at,
      public.sj_evaluate_profile_completeness(p) as completeness,
      coalesce(
        (
          select array_agg(distinct lower(i.provider))
          from auth.identities i
          where i.user_id = p.id
            and coalesce(i.provider, '') <> ''
        ),
        case
          when jsonb_typeof(u.raw_app_meta_data->'providers') = 'array' then
            array(select lower(x) from jsonb_array_elements_text(u.raw_app_meta_data->'providers') as x)
          else
            array[lower(coalesce(nullif(u.raw_app_meta_data->>'provider', ''), 'email'))]
        end
      ) as providers,
      (u.email_confirmed_at is not null) as email_confirmed,
      u.last_sign_in_at,
      coalesce(u.created_at, p.created_at) as auth_created_at,
      coalesce((select count(*)::integer from public.quotes q where q.user_id = p.id), 0) as site_quotes_count,
      coalesce((select count(*)::integer from public.quotes q where q.user_id = p.id and q.status in ('solicitado', 'em_analise')), 0) as open_quotes_count
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.role in ('customer', 'user')
  ),
  filtered as (
    select
      b.*,
      (b.completeness->>'is_complete')::boolean as is_complete,
      (b.completeness->>'missing_count')::integer as missing_count
    from base b
    where (
      v_q = ''
      or public.sj_norm_text(b.nome) like '%' || v_q || '%'
      or public.sj_norm_text(b.razao_social) like '%' || v_q || '%'
      or public.sj_norm_text(b.nome_fantasia) like '%' || v_q || '%'
      or public.sj_norm_text(b.email) like '%' || v_q || '%'
      or (v_digits <> '' and exists (
        select 1 from public.profiles px
        where px.id = b.id
          and (
            public.sj_only_digits(px.cpf) like '%' || v_digits || '%'
            or public.sj_only_digits(px.cnpj) like '%' || v_digits || '%'
            or public.sj_only_digits(px.telefone) like '%' || v_digits || '%'
          )
      ))
    )
    and (
      v_filter = 'todos'
      or (v_filter = 'completos' and (b.completeness->>'is_complete')::boolean = true)
      or (v_filter = 'incompletos' and (b.completeness->>'is_complete')::boolean = false)
      or (v_filter = 'google' and 'google' = any(b.providers))
      or (v_filter = 'email' and 'email' = any(b.providers))
      or (v_filter = 'pf' and b.person_type = 'pf')
      or (v_filter = 'pj' and b.person_type = 'pj')
      or (v_filter = 'nao_confirmado' and b.email_confirmed = false)
      or (v_filter = 'novos_7d' and b.auth_created_at >= now() - interval '7 days')
    )
  )
  select
    (select jsonb_build_object(
      'total', count(*),
      'completos', count(*) filter (where (completeness->>'is_complete')::boolean = true),
      'incompletos', count(*) filter (where (completeness->>'is_complete')::boolean = false),
      'google', count(*) filter (where 'google' = any(providers)),
      'email', count(*) filter (where 'email' = any(providers))
    ) from base),
    (select count(*)::integer from filtered),
    coalesce((
      select jsonb_agg(t) from (
        select
          f.id, f.person_type, f.nome, f.razao_social, f.nome_fantasia,
          f.doc_masked, f.has_doc, f.telefone, f.email, f.cidade, f.uf,
          f.status, f.completeness, f.providers, f.email_confirmed,
          f.last_sign_in_at, f.auth_created_at as created_at,
          f.site_quotes_count, f.open_quotes_count,
          case when v_has_issued then
            coalesce((select count(*)::integer from public.issued_quotes iq where iq.customer_profile_id = f.id), 0)
          else 0 end as issued_quotes_count
        from filtered f
        order by
          case when v_sort = 'name_asc' then public.sj_norm_text(coalesce(nullif(f.razao_social, ''), f.nome)) end asc nulls last,
          case when v_sort = 'last_sign_in_desc' then f.last_sign_in_at end desc nulls last,
          case when v_sort = 'quotes_desc' then f.site_quotes_count end desc nulls last,
          case when v_sort = 'completeness_asc' then f.missing_count end desc nulls last,
          f.auth_created_at desc nulls last
        limit v_limit
        offset v_offset
      ) t
    ), '[]'::jsonb)
  into v_kpis, v_total_filtered, v_rows;

  return jsonb_build_object(
    'kpis', coalesce(v_kpis, '{}'::jsonb),
    'total_filtered', coalesce(v_total_filtered, 0),
    'items', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_list_registered_customers(text, text, text, integer, integer) from public;
grant execute on function public.admin_list_registered_customers(text, text, text, integer, integer) to authenticated;

-- 6. RPC DETALHE DO CLIENTE (SEM EXPOR DOCUMENTO COMPLETO ATÉ O BOTÃO "MOSTRAR")
create or replace function public.admin_get_customer_detail(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_prof public.profiles%rowtype;
  v_providers text[];
  v_email_confirmed boolean := false;
  v_last_sign_in timestamptz;
  v_auth_created timestamptz;
  v_quotes jsonb := '[]'::jsonb;
  v_issued jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Acesso negado.';
  end if;

  select * into v_prof
  from public.profiles
  where id = p_customer_id and role in ('customer', 'user');

  if v_prof.id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  select
    coalesce(
      (select array_agg(distinct lower(i.provider)) from auth.identities i where i.user_id = u.id and coalesce(i.provider, '') <> ''),
      case
        when jsonb_typeof(u.raw_app_meta_data->'providers') = 'array' then
          array(select lower(x) from jsonb_array_elements_text(u.raw_app_meta_data->'providers') as x)
        else
          array[lower(coalesce(nullif(u.raw_app_meta_data->>'provider', ''), 'email'))]
      end
    ),
    (u.email_confirmed_at is not null),
    u.last_sign_in_at,
    coalesce(u.created_at, v_prof.created_at)
  into v_providers, v_email_confirmed, v_last_sign_in, v_auth_created
  from auth.users u
  where u.id = v_prof.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'quote_number', q.quote_number,
    'status', q.status,
    'precisa_nota_fiscal', q.precisa_nota_fiscal,
    'admin_total', q.admin_total,
    'created_at', q.created_at,
    'items_count', (select count(*)::integer from public.quote_items qi where qi.quote_id = q.id)
  ) order by q.created_at desc), '[]'::jsonb)
  into v_quotes
  from public.quotes q
  where q.user_id = v_prof.id;

  if to_regclass('public.issued_quotes') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', iq.id,
      'quote_code', iq.quote_code,
      'status', iq.status,
      'needs_invoice', iq.needs_invoice,
      'total_amount', iq.total_amount,
      'issue_date', iq.issue_date,
      'created_at', iq.created_at
    ) order by iq.created_at desc), '[]'::jsonb)
    into v_issued
    from public.issued_quotes iq
    where iq.customer_profile_id = v_prof.id;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_prof.id,
      'person_type', coalesce(nullif(v_prof.person_type, ''), 'pf'),
      'nome', v_prof.nome,
      'razao_social', v_prof.razao_social,
      'nome_fantasia', v_prof.nome_fantasia,
      'inscricao_estadual', v_prof.inscricao_estadual,
      'ie_tipo', v_prof.ie_tipo,
      'contato_nome', v_prof.contato_nome,
      'doc_masked', public.sj_mask_doc(case when v_prof.person_type = 'pj' then v_prof.cnpj else v_prof.cpf end, v_prof.person_type),
      'has_doc', (coalesce(v_prof.cpf, '') <> '' or coalesce(v_prof.cnpj, '') <> ''),
      'telefone', v_prof.telefone,
      'email', v_prof.email,
      'cep', v_prof.cep,
      'logradouro', v_prof.logradouro,
      'numero', v_prof.numero,
      'complemento', v_prof.complemento,
      'bairro', v_prof.bairro,
      'cidade', v_prof.cidade,
      'uf', v_prof.uf,
      'status', v_prof.status,
      'created_at', v_auth_created,
      'updated_at', v_prof.updated_at,
      'last_sign_in_at', v_last_sign_in,
      'email_confirmed', coalesce(v_email_confirmed, false),
      'providers', coalesce(v_providers, array['email']::text[]),
      'completeness', public.sj_evaluate_profile_completeness(v_prof)
    ),
    'site_quotes', v_quotes,
    'issued_quotes', v_issued
  );
end;
$$;

revoke all on function public.admin_get_customer_detail(uuid) from public;
grant execute on function public.admin_get_customer_detail(uuid) to authenticated;

-- 7. RPC PARA REVELAR CPF/CNPJ COMPLETO E REGISTRAR AUDITORIA LGPD
create or replace function public.admin_reveal_customer_doc(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor record;
  v_prof public.profiles%rowtype;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Acesso negado.';
  end if;

  select * into v_prof from public.profiles where id = p_customer_id and role in ('customer', 'user');
  if v_prof.id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  select email, nome into v_actor from public.profiles where id = v_uid;

  insert into public.customer_audit_logs (customer_id, action, actor_id, actor_email, actor_name, details)
  values (
    v_prof.id,
    'view_doc',
    v_uid,
    coalesce(v_actor.email, ''),
    coalesce(v_actor.nome, ''),
    jsonb_build_object('person_type', v_prof.person_type)
  );

  return jsonb_build_object(
    'cpf', coalesce(v_prof.cpf, ''),
    'cnpj', coalesce(v_prof.cnpj, ''),
    'person_type', coalesce(nullif(v_prof.person_type, ''), 'pf')
  );
end;
$$;

revoke all on function public.admin_reveal_customer_doc(uuid) from public;
grant execute on function public.admin_reveal_customer_doc(uuid) to authenticated;

-- 8. RPC PARA EQUIPE (ADMIN & STAFF) EDITAR DADOS CADASTRAIS DO CLIENTE COM AUDITORIA
create or replace function public.admin_update_customer_profile(p_customer_id uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor record;
  v_prof public.profiles%rowtype;
  v_type text := case when coalesce(p_dados->>'person_type', 'pf') = 'pj' then 'pj' else 'pf' end;
  v_ie_tipo text := case when coalesce(p_dados->>'ie_tipo', 'contribuinte') in ('contribuinte', 'isento', 'nao_contribuinte') then p_dados->>'ie_tipo' else 'contribuinte' end;
  v_cpf text := nullif(public.sj_only_digits(p_dados->>'cpf'), '');
  v_cnpj text := nullif(public.sj_only_digits(p_dados->>'cnpj'), '');
  v_cep text := nullif(public.sj_only_digits(p_dados->>'cep'), '');
  v_uf text := nullif(upper(trim(coalesce(p_dados->>'uf', ''))), '');
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Acesso negado: apenas a equipe autorizada pode editar dados de clientes.';
  end if;

  select * into v_prof from public.profiles where id = p_customer_id and role in ('customer', 'user');
  if v_prof.id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  if v_cpf is not null and not public.validar_cpf(v_cpf) then
    raise exception 'CPF inválido. Confira os 11 dígitos.';
  end if;
  if v_cnpj is not null and not public.validar_cnpj(v_cnpj) then
    raise exception 'CNPJ inválido. Confira os 14 dígitos.';
  end if;

  update public.profiles
  set
    person_type = v_type,
    nome = coalesce(nullif(trim(coalesce(p_dados->>'nome', '')), ''), nome),
    razao_social = trim(coalesce(p_dados->>'razao_social', razao_social)),
    nome_fantasia = trim(coalesce(p_dados->>'nome_fantasia', nome_fantasia)),
    ie_tipo = v_ie_tipo,
    inscricao_estadual = case when v_ie_tipo = 'contribuinte' then trim(coalesce(p_dados->>'inscricao_estadual', inscricao_estadual)) else '' end,
    contato_nome = trim(coalesce(p_dados->>'contato_nome', contato_nome)),
    cpf = case when p_dados ? 'cpf' then v_cpf else cpf end,
    cnpj = case when p_dados ? 'cnpj' then v_cnpj else cnpj end,
    telefone = trim(coalesce(p_dados->>'telefone', telefone)),
    cep = case when p_dados ? 'cep' then v_cep else cep end,
    logradouro = trim(coalesce(p_dados->>'logradouro', logradouro)),
    numero = trim(coalesce(p_dados->>'numero', numero)),
    complemento = trim(coalesce(p_dados->>'complemento', complemento)),
    bairro = trim(coalesce(p_dados->>'bairro', bairro)),
    cidade = trim(coalesce(p_dados->>'cidade', cidade)),
    uf = case when p_dados ? 'uf' then v_uf else uf end,
    updated_at = now()
  where id = v_prof.id
  returning * into v_prof;

  select email, nome into v_actor from public.profiles where id = v_uid;

  insert into public.customer_audit_logs (customer_id, action, actor_id, actor_email, actor_name, details)
  values (
    v_prof.id,
    'edit_profile',
    v_uid,
    coalesce(v_actor.email, ''),
    coalesce(v_actor.nome, ''),
    jsonb_build_object('person_type', v_prof.person_type, 'source', coalesce(p_dados->>'source', 'admin_panel'))
  );

  return jsonb_build_object(
    'sucesso', true,
    'completeness', public.sj_evaluate_profile_completeness(v_prof)
  );
end;
$$;

revoke all on function public.admin_update_customer_profile(uuid, jsonb) from public;
grant execute on function public.admin_update_customer_profile(uuid, jsonb) to authenticated;

-- 9. RPC SOMENTE ADMIN: BLOQUEAR/DESBLOQUEAR CLIENTE E EXPORTAR CSV COM AUDITORIA
create or replace function public.admin_set_customer_block(p_customer_id uuid, p_blocked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor record;
  v_prof public.profiles%rowtype;
  v_status text := case when p_blocked then 'blocked' else 'approved' end;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Acesso negado: apenas o administrador pode bloquear ou desbloquear clientes.';
  end if;

  select * into v_prof from public.profiles where id = p_customer_id and role in ('customer', 'user');
  if v_prof.id is null then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.profiles
  set status = v_status, updated_at = now()
  where id = v_prof.id;

  select email, nome into v_actor from public.profiles where id = v_uid;

  insert into public.customer_audit_logs (customer_id, action, actor_id, actor_email, actor_name, details)
  values (
    v_prof.id,
    case when p_blocked then 'block_access' else 'unblock_access' end,
    v_uid,
    coalesce(v_actor.email, ''),
    coalesce(v_actor.nome, ''),
    jsonb_build_object('new_status', v_status)
  );

  return jsonb_build_object('sucesso', true, 'status', v_status);
end;
$$;

revoke all on function public.admin_set_customer_block(uuid, boolean) from public;
grant execute on function public.admin_set_customer_block(uuid, boolean) to authenticated;

create or replace function public.admin_export_customers_csv()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_actor record;
  v_rows jsonb := '[]'::jsonb;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Acesso negado: apenas o administrador pode exportar a lista de clientes.';
  end if;

  select email, nome into v_actor from public.profiles where id = v_uid;

  select coalesce(jsonb_agg(item order by item->>'nome'), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'person_type', coalesce(nullif(p.person_type, ''), 'pf'),
      'nome', coalesce(nullif(p.razao_social, ''), p.nome),
      'nome_fantasia', p.nome_fantasia,
      'documento', coalesce(nullif(p.cnpj, ''), p.cpf, ''),
      'inscricao_estadual', p.inscricao_estadual,
      'telefone', p.telefone,
      'email', p.email,
      'cep', p.cep,
      'logradouro', p.logradouro,
      'numero', p.numero,
      'complemento', p.complemento,
      'bairro', p.bairro,
      'cidade', p.cidade,
      'uf', p.uf,
      'status', p.status,
      'providers', coalesce(
        (select array_to_string(array_agg(distinct lower(i.provider)), ',') from auth.identities i where i.user_id = p.id),
        coalesce(nullif(u.raw_app_meta_data->>'provider', ''), 'email')
      ),
      'email_confirmed', (u.email_confirmed_at is not null),
      'created_at', coalesce(u.created_at, p.created_at),
      'last_sign_in_at', u.last_sign_in_at
    ) as item
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.role in ('customer', 'user')
  ) s;

  insert into public.customer_audit_logs (customer_id, action, actor_id, actor_email, actor_name, details)
  values (
    null,
    'export_csv',
    v_uid,
    coalesce(v_actor.email, ''),
    coalesce(v_actor.nome, ''),
    jsonb_build_object('total_exported', jsonb_array_length(v_rows))
  );

  return v_rows;
end;
$$;

revoke all on function public.admin_export_customers_csv() from public;
grant execute on function public.admin_export_customers_csv() to authenticated;

-- ============================================================================
-- MIGRATION 010: EMISSOR DE ORÇAMENTOS TIMBRADOS (INDEPENDENTE) + AUDITORIA
-- ============================================================================
-- 100% idempotente e aditiva.
-- NÃO altera nem apaga public.orcamentos, public.quotes ou public.quote_items.
-- Implementa:
--   1. public.issued_quote_counters (numeração sequencial atômica 2026-0001)
--   2. public.issued_quotes (rascunhos, emitidos, versões -v2, snapshot fiscal)
--   3. public.issued_quote_items (itens com cálculo estrito no servidor)
--   4. public.issued_quote_audit_logs (log de criação, emissão, versão, status)
--   5. Funções RPC SECURITY DEFINER (save_issued_quote, update_issued_quote_status,
--      search_customers_for_quote) com RLS estrita para is_staff()
--   6. Configuração padrão reutilizável em configuracoes_site ('orcamento_padroes_v1')
-- ============================================================================

-- 1. CONTADOR SEQUENCIAL ANUAL ATÔMICO
create table if not exists public.issued_quote_counters (
  quote_year integer primary key,
  last_seq integer not null default 0 check (last_seq >= 0),
  updated_at timestamptz not null default now()
);

alter table public.issued_quote_counters enable row level security;
revoke all on public.issued_quote_counters from anon;
revoke all on public.issued_quote_counters from authenticated;

-- 2. TABELA PRINCIPAL: public.issued_quotes
create table if not exists public.issued_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_code text not null unique,
  quote_year integer not null,
  quote_seq integer not null check (quote_seq >= 1),
  version_number integer not null default 1 check (version_number >= 1),
  parent_quote_id uuid references public.issued_quotes(id) on delete set null,
  source_customer_quote_id uuid references public.quotes(id) on delete set null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'emitido', 'enviado', 'aprovado', 'recusado', 'vencido', 'cancelado')),
  issue_date date not null default current_date,
  validity_days integer not null default 7 check (validity_days >= 1 and validity_days <= 365),
  valid_until date,
  validity_label text not null default '7 dias',
  needs_invoice boolean not null default false,
  customer_type text not null default 'pf' check (customer_type in ('pf', 'pj')),
  customer_profile_id uuid references public.profiles(id) on delete set null,
  customer_snapshot jsonb not null default '{}'::jsonb,
  seller_id uuid references auth.users(id) on delete set null,
  seller_name text not null default '',
  payment_method text not null default 'PIX à Vista (5% OFF)',
  payment_installments integer not null default 1 check (payment_installments >= 1 and payment_installments <= 24),
  delivery_term text not null default 'Pronta Entrega / Imediato',
  freight_amount numeric(10, 2) not null default 0 check (freight_amount >= 0),
  general_discount_type text not null default 'fixed' check (general_discount_type in ('fixed', 'percent')),
  general_discount_value numeric(10, 2) not null default 0 check (general_discount_value >= 0),
  general_discount_amount numeric(10, 2) not null default 0 check (general_discount_amount >= 0),
  items_gross_amount numeric(10, 2) not null default 0 check (items_gross_amount >= 0),
  subtotal_amount numeric(10, 2) not null default 0 check (subtotal_amount >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  notes text not null default '',
  internal_notes text not null default '',
  is_locked boolean not null default false,
  issued_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_issued_quotes_year_seq on public.issued_quotes (quote_year desc, quote_seq desc, version_number desc);
create index if not exists idx_issued_quotes_status_created on public.issued_quotes (status, created_at desc);
create index if not exists idx_issued_quotes_source_quote on public.issued_quotes (source_customer_quote_id) where source_customer_quote_id is not null;

-- 3. ITENS DO ORÇAMENTO EMITIDO
create table if not exists public.issued_quote_items (
  id uuid primary key default gen_random_uuid(),
  issued_quote_id uuid not null references public.issued_quotes(id) on delete cascade,
  sort_order integer not null default 0,
  product_id text,
  product_code text not null default '',
  title text not null,
  description text not null default '',
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null default 0 check (unit_price >= 0),
  discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percent')),
  discount_value numeric(10, 2) not null default 0 check (discount_value >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  line_total numeric(10, 2) not null default 0 check (line_total >= 0),
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_issued_quote_items_parent on public.issued_quote_items (issued_quote_id, sort_order asc);

-- 4. AUDITORIA DE ORÇAMENTOS EMITIDOS
create table if not exists public.issued_quote_audit_logs (
  id uuid primary key default gen_random_uuid(),
  issued_quote_id uuid not null references public.issued_quotes(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  actor_name text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_issued_quote_audit_parent on public.issued_quote_audit_logs (issued_quote_id, created_at desc);

-- 5. RLS ESTRITO (APENAS EQUIPE APROVADA is_staff())
alter table public.issued_quotes enable row level security;
alter table public.issued_quote_items enable row level security;
alter table public.issued_quote_audit_logs enable row level security;

revoke all on public.issued_quotes from anon;
revoke all on public.issued_quote_items from anon;
revoke all on public.issued_quote_audit_logs from anon;

grant select, insert, update, delete on public.issued_quotes to authenticated;
grant select, insert, update, delete on public.issued_quote_items to authenticated;
grant select, insert on public.issued_quote_audit_logs to authenticated;

drop policy if exists "issued_quotes_staff_select" on public.issued_quotes;
create policy "issued_quotes_staff_select"
  on public.issued_quotes for select
  to authenticated
  using (public.is_staff());

drop policy if exists "issued_quotes_staff_insert" on public.issued_quotes;
create policy "issued_quotes_staff_insert"
  on public.issued_quotes for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "issued_quotes_staff_update" on public.issued_quotes;
create policy "issued_quotes_staff_update"
  on public.issued_quotes for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "issued_quotes_admin_delete_draft" on public.issued_quotes;
create policy "issued_quotes_admin_delete_draft"
  on public.issued_quotes for delete
  to authenticated
  using (public.is_admin() and is_locked = false);

drop policy if exists "issued_quote_items_staff_all" on public.issued_quote_items;
create policy "issued_quote_items_staff_all"
  on public.issued_quote_items for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "issued_quote_audit_staff_select" on public.issued_quote_audit_logs;
create policy "issued_quote_audit_staff_select"
  on public.issued_quote_audit_logs for select
  to authenticated
  using (public.is_staff());

drop policy if exists "issued_quote_audit_staff_insert" on public.issued_quote_audit_logs;
create policy "issued_quote_audit_staff_insert"
  on public.issued_quote_audit_logs for insert
  to authenticated
  with check (public.is_staff());

-- 6. GERADOR SEQUENCIAL ATÔMICO POR ANO (EX.: 2026-0001)
create or replace function public.allocate_issued_quote_number(p_year integer default extract(year from current_date)::integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := coalesce(p_year, extract(year from current_date)::integer);
  v_existing_max integer := 0;
  v_next integer;
begin
  select coalesce(max(quote_seq), 0)
  into v_existing_max
  from public.issued_quotes
  where quote_year = v_year;

  insert into public.issued_quote_counters (quote_year, last_seq, updated_at)
  values (v_year, v_existing_max + 1, now())
  on conflict (quote_year) do update
    set last_seq = greatest(public.issued_quote_counters.last_seq, v_existing_max) + 1,
        updated_at = now()
  returning last_seq into v_next;

  return v_next;
end;
$$;

revoke all on function public.allocate_issued_quote_number(integer) from public;

-- 7. FUNÇÃO AUXILIAR: RECÁLCULO DE TOTAIS NO SERVIDOR
create or replace function public.recalculate_issued_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross numeric(10, 2) := 0;
  v_subtotal numeric(10, 2) := 0;
  v_freight numeric(10, 2) := 0;
  v_disc_type text := 'fixed';
  v_disc_val numeric(10, 2) := 0;
  v_disc_amt numeric(10, 2) := 0;
  v_total numeric(10, 2) := 0;
begin
  select
    coalesce(sum(round(quantity * unit_price, 2)), 0),
    coalesce(sum(line_total), 0)
  into v_gross, v_subtotal
  from public.issued_quote_items
  where issued_quote_id = p_quote_id;

  select
    greatest(0, coalesce(freight_amount, 0)),
    coalesce(general_discount_type, 'fixed'),
    greatest(0, coalesce(general_discount_value, 0))
  into v_freight, v_disc_type, v_disc_val
  from public.issued_quotes
  where id = p_quote_id;

  if v_disc_type = 'percent' then
    v_disc_val := least(100, v_disc_val);
    v_disc_amt := round(v_subtotal * (v_disc_val / 100.0), 2);
  else
    v_disc_amt := least(v_subtotal, round(v_disc_val, 2));
  end if;

  v_total := greatest(0, round(v_subtotal + v_freight - v_disc_amt, 2));

  update public.issued_quotes
  set
    items_gross_amount = v_gross,
    subtotal_amount = v_subtotal,
    general_discount_amount = v_disc_amt,
    total_amount = v_total,
    updated_at = now()
  where id = p_quote_id;
end;
$$;

revoke all on function public.recalculate_issued_quote_totals(uuid) from public;

-- Trigger de proteção em public.issued_quote_items (calcula desconto e impede alteração se bloqueado)
create or replace function public.trg_issued_quote_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid := coalesce(new.issued_quote_id, old.issued_quote_id);
  v_locked boolean := false;
  v_gross numeric(10, 2);
  v_disc numeric(10, 2);
begin
  select coalesce(is_locked, false) into v_locked
  from public.issued_quotes
  where id = v_quote_id;

  if v_locked and current_setting('app.bypass_quote_lock', true) is distinct from '1' then
    raise exception 'Este orçamento já foi emitido e não pode ter os itens modificados diretamente. Crie uma nova versão.';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new.quantity := greatest(0.01, round(coalesce(new.quantity, 1), 2));
    new.unit_price := greatest(0, round(coalesce(new.unit_price, 0), 2));
    new.discount_type := case when new.discount_type = 'percent' then 'percent' else 'fixed' end;
    new.discount_value := greatest(0, round(coalesce(new.discount_value, 0), 2));
    v_gross := round(new.quantity * new.unit_price, 2);

    if new.discount_type = 'percent' then
      new.discount_value := least(100, new.discount_value);
      v_disc := round(v_gross * (new.discount_value / 100.0), 2);
    else
      v_disc := least(v_gross, new.discount_value);
    end if;

    new.discount_amount := v_disc;
    new.line_total := greatest(0, round(v_gross - v_disc, 2));
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_01_issued_quote_items_guard on public.issued_quote_items;
create trigger trg_01_issued_quote_items_guard
  before insert or update or delete on public.issued_quote_items
  for each row execute function public.trg_issued_quote_items_guard();

-- Trigger de proteção em public.issued_quotes (validade + imutabilidade após emissão)
create or replace function public.trg_issued_quotes_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.issue_date := coalesce(new.issue_date, current_date);
    new.validity_days := greatest(1, least(365, coalesce(new.validity_days, 7)));
    new.valid_until := new.issue_date + new.validity_days;
    if coalesce(trim(new.validity_label), '') = '' then
      new.validity_label := new.validity_days::text || case when new.validity_days = 1 then ' dia' else ' dias' end;
    end if;
    new.updated_at := now();
  end if;

  if tg_op = 'UPDATE' then
    if old.is_locked = true and current_setting('app.bypass_quote_lock', true) is distinct from '1' then
      -- Após emitido (locked), apenas status, observações internas e metadados operacionais podem mudar;
      -- valor/cliente/itens exigem nova versão (-v2).
      if new.quote_code is distinct from old.quote_code
         or new.customer_snapshot is distinct from old.customer_snapshot
         or new.needs_invoice is distinct from old.needs_invoice
         or new.freight_amount is distinct from old.freight_amount
         or new.general_discount_amount is distinct from old.general_discount_amount
         or new.total_amount is distinct from old.total_amount
         or new.is_locked = false then
        raise exception 'Orçamento já emitido é imutável. Use "Criar nova versão" para alterar valores ou cliente.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_01_issued_quotes_guard on public.issued_quotes;
create trigger trg_01_issued_quotes_guard
  before insert or update on public.issued_quotes
  for each row execute function public.trg_issued_quotes_guard();

-- 8. RPC ATÔMICA: SALVAR RASCUNHO OU EMITIR ORÇAMENTO (E GERAR VERSÃO -v2)
create or replace function public.save_issued_quote(p_payload jsonb, p_emit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_email text := '';
  v_actor_name text := '';
  v_quote_id uuid := nullif(trim(coalesce(p_payload->>'id', '')), '')::uuid;
  v_existing public.issued_quotes%rowtype;
  v_create_version boolean := coalesce((p_payload->>'create_version')::boolean, false);
  v_year integer;
  v_seq integer;
  v_version integer := 1;
  v_code text;
  v_parent_id uuid := null;
  v_source_quote_id uuid := nullif(trim(coalesce(p_payload->>'source_customer_quote_id', '')), '')::uuid;
  v_needs_invoice boolean := coalesce((p_payload->>'needs_invoice')::boolean, false);
  v_customer_type text := case when coalesce(p_payload->>'customer_type', 'pf') = 'pj' then 'pj' else 'pf' end;
  v_profile_id uuid := nullif(trim(coalesce(p_payload->>'customer_profile_id', '')), '')::uuid;
  v_snap jsonb := coalesce(p_payload->'customer_snapshot', '{}'::jsonb);
  v_doc text;
  v_nome text;
  v_tel text;
  v_cep text;
  v_logradouro text;
  v_cidade text;
  v_items jsonb := coalesce(p_payload->'items', '[]'::jsonb);
  v_item jsonb;
  v_idx integer := 0;
  v_items_count integer := 0;
  v_result_quote public.issued_quotes%rowtype;
  v_result_items jsonb;
  v_action text := 'saved_draft';
  v_status text;
  v_issue_date date := coalesce(nullif(trim(coalesce(p_payload->>'issue_date', '')), '')::date, current_date);
  v_validity_days integer := greatest(1, least(365, coalesce((p_payload->>'validity_days')::integer, 7)));
  v_validity_label text := nullif(trim(coalesce(p_payload->>'validity_label', '')), '');
  v_disc_type text := case when coalesce(p_payload->>'general_discount_type', 'fixed') = 'percent' then 'percent' else 'fixed' end;
  v_disc_val numeric(10, 2) := greatest(0, coalesce((p_payload->>'general_discount_value')::numeric, 0));
  v_freight numeric(10, 2) := greatest(0, coalesce((p_payload->>'freight_amount')::numeric, 0));
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Acesso negado: apenas a equipe autorizada pode gerenciar orçamentos.';
  end if;

  select coalesce(email, ''), coalesce(nullif(trim(nome), ''), split_part(email, '@', 1))
  into v_actor_email, v_actor_name
  from public.profiles
  where id = v_uid;

  v_nome := trim(coalesce(
    case when v_customer_type = 'pj' then nullif(trim(v_snap->>'razao_social'), '') else null end,
    v_snap->>'nome',
    ''
  ));
  v_tel := trim(coalesce(v_snap->>'telefone', ''));
  v_doc := regexp_replace(coalesce(
    case when v_customer_type = 'pj' then nullif(v_snap->>'cnpj', '') else nullif(v_snap->>'cpf', '') end,
    v_snap->>'documento',
    ''
  ), '\D', '', 'g');
  v_cep := regexp_replace(coalesce(v_snap->>'cep', ''), '\D', '', 'g');
  v_logradouro := trim(coalesce(v_snap->>'logradouro', ''));
  v_cidade := trim(coalesce(v_snap->>'cidade', ''));

  -- Validação de documento quando informado
  if v_doc <> '' then
    if length(v_doc) = 11 then
      if not public.validar_cpf(v_doc) then
        raise exception 'CPF informado é inválido. Confira os 11 dígitos.';
      end if;
    elsif length(v_doc) = 14 then
      if not public.validar_cnpj(v_doc) then
        raise exception 'CNPJ informado é inválido. Confira os 14 dígitos.';
      end if;
    else
      raise exception 'Documento inválido: informe um CPF (11 dígitos) ou CNPJ (14 dígitos).';
    end if;
  end if;

  -- Validações rígidas apenas ao EMITIR (rascunho aceita preenchimento parcial)
  if p_emit then
    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
      raise exception 'Adicione pelo menos 1 produto ou serviço antes de emitir o orçamento.';
    end if;

    if v_nome = '' then
      raise exception 'Informe o nome completo ou razão social do cliente antes de emitir.';
    end if;

    if length(regexp_replace(v_tel, '\D', '', 'g')) < 8 then
      raise exception 'Informe o telefone/WhatsApp do cliente antes de emitir.';
    end if;

    if v_doc = '' then
      raise exception 'Informe o CPF ou CNPJ do cliente antes de emitir o orçamento.';
    end if;

    if v_needs_invoice then
      if v_customer_type = 'pj' and length(v_doc) <> 14 then
        raise exception 'Orçamento COM nota fiscal para PJ exige CNPJ válido com 14 dígitos.';
      end if;
      if v_customer_type = 'pf' and length(v_doc) <> 11 then
        raise exception 'Orçamento COM nota fiscal para PF exige CPF válido com 11 dígitos.';
      end if;
      if v_logradouro = '' or v_cidade = '' then
        raise exception 'Orçamento COM nota fiscal exige endereço completo (logradouro e cidade/UF).';
      end if;
    end if;
  end if;

  -- Verifica se já existe registro
  if v_quote_id is not null then
    select * into v_existing from public.issued_quotes where id = v_quote_id;
  end if;

  perform set_config('app.bypass_quote_lock', '1', true);

  if v_existing.id is not null and (v_existing.is_locked or v_create_version) then
    -- Cria NOVA VERSÃO imutável (-v2, -v3...) preservando a sequência base
    v_parent_id := coalesce(v_existing.parent_quote_id, v_existing.id);
    v_year := v_existing.quote_year;
    v_seq := v_existing.quote_seq;

    select coalesce(max(version_number), 1) + 1
    into v_version
    from public.issued_quotes
    where quote_year = v_year and quote_seq = v_seq;

    v_code := v_year::text || '-' || lpad(v_seq::text, 4, '0') || '-v' || v_version::text;
    v_quote_id := null;
    v_action := case when p_emit then 'version_issued' else 'version_created' end;
  elsif v_existing.id is not null then
    -- Atualiza rascunho existente
    v_year := v_existing.quote_year;
    v_seq := v_existing.quote_seq;
    v_version := v_existing.version_number;
    v_code := v_existing.quote_code;
    v_action := case when p_emit then 'issued' else 'saved_draft' end;
  else
    -- Novo orçamento: reserva sequência atômica YYYY-0001
    v_year := extract(year from v_issue_date)::integer;
    v_seq := public.allocate_issued_quote_number(v_year);
    v_version := 1;
    v_code := v_year::text || '-' || lpad(v_seq::text, 4, '0');
    v_action := case when p_emit then 'issued' else 'created_draft' end;
  end if;

  v_status := case
    when p_emit then 'emitido'
    else coalesce(nullif(trim(coalesce(p_payload->>'status', '')), ''), 'rascunho')
  end;
  if v_status not in ('rascunho', 'emitido', 'enviado', 'aprovado', 'recusado', 'vencido', 'cancelado') then
    v_status := case when p_emit then 'emitido' else 'rascunho' end;
  end if;

  if v_quote_id is null then
    insert into public.issued_quotes (
      quote_code, quote_year, quote_seq, version_number, parent_quote_id,
      source_customer_quote_id, status, issue_date, validity_days, validity_label,
      needs_invoice, customer_type, customer_profile_id, customer_snapshot,
      seller_id, seller_name, payment_method, payment_installments, delivery_term,
      freight_amount, general_discount_type, general_discount_value,
      notes, internal_notes, is_locked, issued_at, created_by, updated_by
    ) values (
      v_code, v_year, v_seq, v_version, v_parent_id,
      v_source_quote_id, v_status, v_issue_date, v_validity_days,
      coalesce(v_validity_label, v_validity_days::text || case when v_validity_days = 1 then ' dia' else ' dias' end),
      v_needs_invoice, v_customer_type, v_profile_id, v_snap,
      v_uid, coalesce(nullif(trim(coalesce(p_payload->>'seller_name', '')), ''), v_actor_name),
      coalesce(nullif(trim(coalesce(p_payload->>'payment_method', '')), ''), 'PIX à Vista (5% OFF)'),
      greatest(1, least(24, coalesce((p_payload->>'payment_installments')::integer, 1))),
      coalesce(nullif(trim(coalesce(p_payload->>'delivery_term', '')), ''), 'Pronta Entrega / Imediato'),
      v_freight, v_disc_type, v_disc_val,
      coalesce(p_payload->>'notes', ''), coalesce(p_payload->>'internal_notes', ''),
      p_emit, case when p_emit then now() else null end, v_uid, v_uid
    )
    returning * into v_result_quote;
  else
    update public.issued_quotes
    set
      source_customer_quote_id = v_source_quote_id,
      status = v_status,
      issue_date = v_issue_date,
      validity_days = v_validity_days,
      validity_label = coalesce(v_validity_label, v_validity_days::text || case when v_validity_days = 1 then ' dia' else ' dias' end),
      needs_invoice = v_needs_invoice,
      customer_type = v_customer_type,
      customer_profile_id = v_profile_id,
      customer_snapshot = v_snap,
      seller_name = coalesce(nullif(trim(coalesce(p_payload->>'seller_name', '')), ''), v_actor_name),
      payment_method = coalesce(nullif(trim(coalesce(p_payload->>'payment_method', '')), ''), 'PIX à Vista (5% OFF)'),
      payment_installments = greatest(1, least(24, coalesce((p_payload->>'payment_installments')::integer, 1))),
      delivery_term = coalesce(nullif(trim(coalesce(p_payload->>'delivery_term', '')), ''), 'Pronta Entrega / Imediato'),
      freight_amount = v_freight,
      general_discount_type = v_disc_type,
      general_discount_value = v_disc_val,
      notes = coalesce(p_payload->>'notes', ''),
      internal_notes = coalesce(p_payload->>'internal_notes', ''),
      is_locked = p_emit,
      issued_at = case when p_emit then coalesce(issued_at, now()) else issued_at end,
      updated_by = v_uid
    where id = v_quote_id
    returning * into v_result_quote;

    delete from public.issued_quote_items where issued_quote_id = v_result_quote.id;
  end if;

  if jsonb_typeof(v_items) = 'array' then
    for v_item in select * from jsonb_array_elements(v_items)
    loop
      v_idx := v_idx + 1;
      if trim(coalesce(v_item->>'title', '')) = '' then
        continue;
      end if;
      v_items_count := v_items_count + 1;
      insert into public.issued_quote_items (
        issued_quote_id, sort_order, product_id, product_code,
        title, description, quantity, unit_price,
        discount_type, discount_value, is_custom
      ) values (
        v_result_quote.id,
        v_idx,
        nullif(trim(coalesce(v_item->>'product_id', '')), ''),
        trim(coalesce(v_item->>'product_code', '')),
        trim(v_item->>'title'),
        trim(coalesce(v_item->>'description', '')),
        greatest(0.01, coalesce((v_item->>'quantity')::numeric, 1)),
        greatest(0, coalesce((v_item->>'unit_price')::numeric, 0)),
        case when coalesce(v_item->>'discount_type', 'fixed') = 'percent' then 'percent' else 'fixed' end,
        greatest(0, coalesce((v_item->>'discount_value')::numeric, 0)),
        coalesce((v_item->>'is_custom')::boolean, false)
      );
    end loop;
  end if;

  if p_emit and v_items_count = 0 then
    raise exception 'Adicione pelo menos 1 item válido antes de emitir o orçamento.';
  end if;

  perform public.recalculate_issued_quote_totals(v_result_quote.id);

  select * into v_result_quote from public.issued_quotes where id = v_result_quote.id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order asc), '[]'::jsonb)
  into v_result_items
  from public.issued_quote_items i
  where i.issued_quote_id = v_result_quote.id;

  -- Ao emitir orçamento importado de solicitação do cliente, responde automaticamente em /conta
  if p_emit and v_source_quote_id is not null then
    update public.quotes
    set
      status = 'respondido',
      admin_total = v_result_quote.total_amount,
      admin_response = case
        when coalesce(trim(admin_response), '') = ''
          then 'Orçamento oficial nº ' || v_result_quote.quote_code || ' emitido pela equipe Loja SJ 3D.'
        else admin_response
      end,
      changed_by_customer = false,
      updated_at = now()
    where id = v_source_quote_id;
  end if;

  insert into public.issued_quote_audit_logs (
    issued_quote_id, action, actor_id, actor_email, actor_name, details
  ) values (
    v_result_quote.id,
    v_action,
    v_uid,
    v_actor_email,
    v_actor_name,
    jsonb_build_object(
      'quote_code', v_result_quote.quote_code,
      'status', v_result_quote.status,
      'total_amount', v_result_quote.total_amount,
      'items_count', v_items_count,
      'source_customer_quote_id', v_source_quote_id
    )
  );

  perform set_config('app.bypass_quote_lock', '0', true);

  return jsonb_build_object(
    'quote', to_jsonb(v_result_quote),
    'items', v_result_items
  );
end;
$$;

revoke all on function public.save_issued_quote(jsonb, boolean) from public;
grant execute on function public.save_issued_quote(jsonb, boolean) to authenticated;

-- 9. RPC PARA ALTERAR STATUS E GRAVAR AUDITORIA
create or replace function public.update_issued_quote_status(p_id uuid, p_status text)
returns public.issued_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.issued_quotes%rowtype;
  v_new public.issued_quotes%rowtype;
  v_actor_email text := '';
  v_actor_name text := '';
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Acesso negado.';
  end if;

  if p_status not in ('rascunho', 'emitido', 'enviado', 'aprovado', 'recusado', 'vencido', 'cancelado') then
    raise exception 'Status inválido.';
  end if;

  select * into v_old from public.issued_quotes where id = p_id;
  if v_old.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  select coalesce(email, ''), coalesce(nullif(trim(nome), ''), split_part(email, '@', 1))
  into v_actor_email, v_actor_name
  from public.profiles
  where id = v_uid;

  update public.issued_quotes
  set status = p_status, updated_by = v_uid, updated_at = now()
  where id = p_id
  returning * into v_new;

  insert into public.issued_quote_audit_logs (
    issued_quote_id, action, actor_id, actor_email, actor_name, details
  ) values (
    p_id,
    'status_changed',
    v_uid,
    v_actor_email,
    v_actor_name,
    jsonb_build_object('from', v_old.status, 'to', p_status, 'quote_code', v_new.quote_code)
  );

  return v_new;
end;
$$;

revoke all on function public.update_issued_quote_status(uuid, text) from public;
grant execute on function public.update_issued_quote_status(uuid, text) to authenticated;

-- 10. BUSCA SEGURA DE CLIENTES PARA EQUIPE (APENAS role = 'customer')
create or replace function public.search_customers_for_quote(p_query text default '')
returns table (
  id uuid,
  person_type text,
  nome text,
  razao_social text,
  nome_fantasia text,
  inscricao_estadual text,
  ie_tipo text,
  contato_nome text,
  cpf text,
  cnpj text,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
  v_digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    p.id, p.person_type, p.nome, p.razao_social, p.nome_fantasia,
    p.inscricao_estadual, p.ie_tipo, p.contato_nome, p.cpf, p.cnpj,
    p.telefone, p.email, p.cep, p.logradouro, p.numero, p.complemento,
    p.bairro, p.cidade, p.uf
  from public.profiles p
  where p.role = 'customer'
    and (
      v_q = ''
      or lower(coalesce(p.nome, '')) like '%' || v_q || '%'
      or lower(coalesce(p.razao_social, '')) like '%' || v_q || '%'
      or lower(coalesce(p.nome_fantasia, '')) like '%' || v_q || '%'
      or lower(coalesce(p.email, '')) like '%' || v_q || '%'
      or (v_digits <> '' and (
        coalesce(p.cpf, '') like '%' || v_digits || '%'
        or coalesce(p.cnpj, '') like '%' || v_digits || '%'
        or regexp_replace(coalesce(p.telefone, ''), '\D', '', 'g') like '%' || v_digits || '%'
      ))
    )
  order by p.updated_at desc nulls last
  limit 15;
end;
$$;

revoke all on function public.search_customers_for_quote(text) from public;
grant execute on function public.search_customers_for_quote(text) to authenticated;

-- 11. CONFIGURAÇÃO REUTILIZÁVEL DE TEXTOS PADRÃO DE ORÇAMENTO
insert into public.configuracoes_site (chave, valor)
values (
  'orcamento_padroes_v1',
  jsonb_build_object(
    'validadeDiasPadrao', 7,
    'garantiaTexto', 'Garantia oficial do Grupo SJ em produtos novos lacrados.',
    'pixFavorecido', 'SJ NOVAIS E CIA LTDA',
    'pixChave', '66.275.129/0001-10',
    'observacoesPadrao', 'Produtos novos lacrados com garantia oficial Grupo SJ. Av. Portugal, 6759 - Umuarama/PR. Chave PIX CNPJ: 66.275.129/0001-10'
  )
)
on conflict (chave) do nothing;

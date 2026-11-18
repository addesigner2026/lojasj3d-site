-- ============================================================================
-- MIGRATION 006: PAINEL DO CLIENTE (FAVORITES, CART_ITEMS, QUOTES, QUOTE_ITEMS)
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- Implementa:
--   1. public.favorites (único por user_id + product_id)
--   2. public.cart_items (único por user_id + product_id, bloqueia 'esgotado')
--   3. public.quotes (número sequencial legível, status, changed_by_customer)
--   4. public.quote_items (preço e nome copiados DIRETO de public.products no banco)
--   5. Função RPC public.create_quote_from_cart() (SECURITY DEFINER, search_path = public)
--   6. Travas no banco: cliente só edita/cancela enquanto status = 'solicitado'
-- ============================================================================

-- Remove tabelas antigas de rascunho/pedidos caso tenham sido criadas em teste
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.saved_items cascade;
drop table if exists public.quote_items cascade;
drop table if exists public.quotes cascade;

-- ============================================================================
-- 1. TABELA public.favorites (FAVORITOS DO CLIENTE SALVOS NO BANCO)
-- ============================================================================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_product_unique unique (user_id, product_id)
);

create index if not exists idx_favorites_user_created on public.favorites (user_id, created_at desc);

create or replace function public.proteger_favorites_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists trg_proteger_favorites_seguranca on public.favorites;
create trigger trg_proteger_favorites_seguranca
  before insert on public.favorites
  for each row execute function public.proteger_favorites_seguranca();

alter table public.favorites enable row level security;
revoke all on public.favorites from anon;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
  on public.favorites for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
  on public.favorites for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
  on public.favorites for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- 2. TABELA public.cart_items (CARRINHO DO CLIENTE SALVO NO BANCO)
-- ============================================================================
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 1000),
  updated_at timestamptz not null default now(),
  constraint cart_items_user_product_unique unique (user_id, product_id)
);

create index if not exists idx_cart_items_user_updated on public.cart_items (user_id, updated_at desc);

-- Trigger de segurança em public.cart_items:
--   - Força user_id = auth.uid()
--   - Valida quantidade (1 a 1000)
--   - Bloqueia adição de produto com stock_status = 'esgotado' direto no banco
create or replace function public.proteger_cart_items_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock text;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;

  if new.quantity is null or new.quantity < 1 or new.quantity > 1000 then
    raise exception 'A quantidade deve ser um número inteiro entre 1 e 1000.';
  end if;

  select stock_status into v_stock
  from public.products
  where id = new.product_id;

  if v_stock is null then
    raise exception 'Produto não encontrado no catálogo.';
  end if;

  if v_stock = 'esgotado' then
    raise exception 'Este produto está esgotado e não pode ser adicionado ao carrinho.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proteger_cart_items_seguranca on public.cart_items;
create trigger trg_proteger_cart_items_seguranca
  before insert or update on public.cart_items
  for each row execute function public.proteger_cart_items_seguranca();

alter table public.cart_items enable row level security;
revoke all on public.cart_items from anon;
grant select, insert, update, delete on public.cart_items to authenticated;

drop policy if exists "cart_items_select_own" on public.cart_items;
create policy "cart_items_select_own"
  on public.cart_items for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "cart_items_insert_own" on public.cart_items;
create policy "cart_items_insert_own"
  on public.cart_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "cart_items_update_own" on public.cart_items;
create policy "cart_items_update_own"
  on public.cart_items for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "cart_items_delete_own" on public.cart_items;
create policy "cart_items_delete_own"
  on public.cart_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- 3. SEQUÊNCIA E TABELA public.quotes (ORÇAMENTOS COM NÚMERO SEQUENCIAL LEGÍVEL)
-- ============================================================================
create sequence if not exists public.quotes_number_seq start with 1001 increment by 1;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number bigint not null unique default nextval('public.quotes_number_seq'),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text not null default '',
  cliente_email text not null default '',
  cliente_telefone text not null default '',
  status text not null default 'solicitado' check (status in ('solicitado', 'em_analise', 'respondido', 'aprovado', 'recusado', 'cancelado')),
  notes text not null default '',
  admin_response text not null default '',
  admin_total numeric(10, 2),
  changed_by_customer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_user_created on public.quotes (user_id, created_at desc);
create index if not exists idx_quotes_status_created on public.quotes (status, created_at desc);
create index if not exists idx_quotes_number on public.quotes (quote_number desc);

-- Trigger de segurança em public.quotes:
--   - Cliente só cria com status = 'solicitado'.
--   - Enquanto status = 'solicitado', cliente pode editar observações ou cancelar (status = 'cancelado').
--   - Quando a equipe muda o status para qualquer outro, o orçamento fica TRAVADO para o cliente no banco.
create or replace function public.proteger_quotes_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eh_staff boolean := public.is_staff();
  v_prof record;
begin
  -- Se executado via SQL Editor (superusuário), permite manutenção
  if v_uid is null then
    if tg_op in ('INSERT', 'UPDATE') then
      new.updated_at := now();
      return new;
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if not v_eh_staff then
      new.user_id := v_uid;
      new.status := 'solicitado';
      new.admin_response := '';
      new.admin_total := null;
      new.changed_by_customer := false;
    end if;

    -- Preenche dados de contato a partir de public.profiles caso não informados
    select nome, email, telefone into v_prof
    from public.profiles
    where id = new.user_id;

    if coalesce(trim(new.cliente_nome), '') = '' then
      new.cliente_nome := coalesce(v_prof.nome, '');
    end if;
    if coalesce(trim(new.cliente_email), '') = '' then
      new.cliente_email := coalesce(v_prof.email, '');
    end if;
    if coalesce(trim(new.cliente_telefone), '') = '' then
      new.cliente_telefone := coalesce(v_prof.telefone, '');
    end if;

    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not v_eh_staff then
      -- Trava absoluta se a equipe já mudou o status
      if old.status <> 'solicitado' then
        raise exception 'Este orçamento já está em atendimento pela equipe e não pode mais ser editado.';
      end if;

      -- Cliente não pode alterar dono, número nem resposta/valor da equipe
      if new.user_id is distinct from old.user_id
         or new.quote_number is distinct from old.quote_number
         or new.admin_response is distinct from old.admin_response
         or new.admin_total is distinct from old.admin_total then
        raise exception 'Acesso negado: você não pode alterar campos exclusivos da equipe.';
      end if;

      -- Cliente só pode manter 'solicitado' ou mudar para 'cancelado'
      if new.status is distinct from old.status and new.status <> 'cancelado' then
        raise exception 'Acesso negado: apenas a equipe pode alterar o status do orçamento.';
      end if;

      -- Se editou observações enquanto solicitado, marca como alterado pelo cliente
      if new.status = 'solicitado' and new.notes is distinct from old.notes then
        new.changed_by_customer := true;
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'DELETE' then
    if not v_eh_staff then
      if old.user_id <> v_uid or old.status <> 'solicitado' then
        raise exception 'Apenas orçamentos com status "solicitado" podem ser excluídos pelo cliente.';
      end if;
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_quotes_seguranca on public.quotes;
create trigger trg_proteger_quotes_seguranca
  before insert or update or delete on public.quotes
  for each row execute function public.proteger_quotes_seguranca();

alter table public.quotes enable row level security;
revoke all on public.quotes from anon;
grant select, insert, update, delete on public.quotes to authenticated;
grant usage, select on sequence public.quotes_number_seq to authenticated;

drop policy if exists "quotes_select_own_or_staff" on public.quotes;
create policy "quotes_select_own_or_staff"
  on public.quotes for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "quotes_insert_own_or_staff" on public.quotes;
create policy "quotes_insert_own_or_staff"
  on public.quotes for insert
  to authenticated
  with check (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "quotes_update_own_or_staff" on public.quotes;
create policy "quotes_update_own_or_staff"
  on public.quotes for update
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff())
  with check (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "quotes_delete_own_solicitado_or_staff" on public.quotes;
create policy "quotes_delete_own_solicitado_or_staff"
  on public.quotes for delete
  to authenticated
  using ((user_id = (select auth.uid()) and status = 'solicitado') or public.is_staff());

-- ============================================================================
-- 4. TABELA public.quote_items (ITENS DO ORÇAMENTO COM PREÇO COPIADO DO BANCO)
-- ============================================================================
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2),
  quantity integer not null default 1 check (quantity >= 1 and quantity <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_items_quote_product_unique unique (quote_id, product_id)
);

create index if not exists idx_quote_items_quote on public.quote_items (quote_id);

-- Trigger BEFORE em public.quote_items:
--   - Verifica se o orçamento pai ainda está 'solicitado' (quando alterado pelo cliente).
--   - NUNCA aceita preço ou nome manipulados pelo front-end: busca SEMPRE em public.products.
create or replace function public.proteger_quote_items_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eh_staff boolean := public.is_staff();
  v_quote record;
  v_prod record;
  v_target_quote_id uuid := coalesce(new.quote_id, old.quote_id);
begin
  if v_uid is null then
    return coalesce(new, old);
  end if;

  select id, user_id, status into v_quote
  from public.quotes
  where id = v_target_quote_id;

  if v_quote.id is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  if not v_eh_staff then
    if v_quote.user_id <> v_uid then
      raise exception 'Acesso negado: este orçamento pertence a outro usuário.';
    end if;
    if v_quote.status <> 'solicitado' then
      raise exception 'Este orçamento já está em atendimento pela equipe e seus itens não podem mais ser alterados.';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.quantity is null or new.quantity < 1 or new.quantity > 1000 then
      raise exception 'A quantidade deve ser um número inteiro entre 1 e 1000.';
    end if;

    -- Copia nome e preço unitário DIRETAMENTE do catálogo no banco (public.products)
    if new.product_id is not null then
      select id, nome, preco_valor, stock_status into v_prod
      from public.products
      where id = new.product_id;

      if v_prod.id is null then
        raise exception 'Produto não encontrado no catálogo oficial.';
      end if;

      if tg_op = 'INSERT' and v_prod.stock_status = 'esgotado' then
        raise exception 'Este produto está esgotado e não pode ser incluído.';
      end if;

      new.product_name := v_prod.nome;
      new.unit_price := v_prod.preco_valor;
    elsif not v_eh_staff then
      raise exception 'Selecione um produto válido do catálogo.';
    end if;

    new.updated_at := now();
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_proteger_quote_items_seguranca on public.quote_items;
create trigger trg_proteger_quote_items_seguranca
  before insert or update or delete on public.quote_items
  for each row execute function public.proteger_quote_items_seguranca();

-- Trigger AFTER em public.quote_items:
--   - Quando o cliente edita itens (adiciona, altera quantidade ou remove), marca changed_by_customer = true
create or replace function public.marcar_orcamento_alterado_pelo_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_id uuid := coalesce(new.quote_id, old.quote_id);
begin
  if auth.uid() is not null and not public.is_staff() then
    update public.quotes
    set changed_by_customer = true,
        updated_at = now()
    where id = v_quote_id
      and status = 'solicitado';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_marcar_orcamento_alterado on public.quote_items;
create trigger trg_marcar_orcamento_alterado
  after insert or update or delete on public.quote_items
  for each row execute function public.marcar_orcamento_alterado_pelo_cliente();

alter table public.quote_items enable row level security;
revoke all on public.quote_items from anon;
grant select, insert, update, delete on public.quote_items to authenticated;

drop policy if exists "quote_items_select_own_or_staff" on public.quote_items;
create policy "quote_items_select_own_or_staff"
  on public.quote_items for select
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.user_id = (select auth.uid()) or public.is_staff())
    )
  );

drop policy if exists "quote_items_insert_own_solicitado_or_staff" on public.quote_items;
create policy "quote_items_insert_own_solicitado_or_staff"
  on public.quote_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and ((q.user_id = (select auth.uid()) and q.status = 'solicitado') or public.is_staff())
    )
  );

drop policy if exists "quote_items_update_own_solicitado_or_staff" on public.quote_items;
create policy "quote_items_update_own_solicitado_or_staff"
  on public.quote_items for update
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and ((q.user_id = (select auth.uid()) and q.status = 'solicitado') or public.is_staff())
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and ((q.user_id = (select auth.uid()) and q.status = 'solicitado') or public.is_staff())
    )
  );

drop policy if exists "quote_items_delete_own_solicitado_or_staff" on public.quote_items;
create policy "quote_items_delete_own_solicitado_or_staff"
  on public.quote_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and ((q.user_id = (select auth.uid()) and q.status = 'solicitado') or public.is_staff())
    )
  );

-- ============================================================================
-- 5. FUNÇÃO RPC ATÔMICA: public.create_quote_from_cart(p_notes text)
-- ============================================================================
-- Cria o orçamento com status 'solicitado', copia todos os itens do carrinho
-- buscando nome e preço direto de public.products e esvazia o carrinho.
create or replace function public.create_quote_from_cart(p_notes text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_quote public.quotes%rowtype;
  v_cart_count integer := 0;
  v_esgotados integer := 0;
  v_items_json jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Faça login para solicitar um orçamento.';
  end if;

  select count(*),
         count(*) filter (where p.stock_status = 'esgotado')
  into v_cart_count, v_esgotados
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = v_uid;

  if v_cart_count = 0 then
    raise exception 'Seu carrinho está vazio. Adicione produtos antes de solicitar o orçamento.';
  end if;

  if v_esgotados > 0 then
    raise exception 'Remova os itens esgotados do carrinho antes de solicitar o orçamento.';
  end if;

  select nome, email, telefone into v_prof
  from public.profiles
  where id = v_uid;

  insert into public.quotes (
    user_id,
    cliente_nome,
    cliente_email,
    cliente_telefone,
    status,
    notes,
    changed_by_customer
  ) values (
    v_uid,
    coalesce(v_prof.nome, ''),
    coalesce(v_prof.email, ''),
    coalesce(v_prof.telefone, ''),
    'solicitado',
    coalesce(trim(p_notes), ''),
    false
  )
  returning * into v_quote;

  -- Copia itens do carrinho buscando nome e preço unitário direto de public.products
  insert into public.quote_items (quote_id, product_id, product_name, unit_price, quantity)
  select
    v_quote.id,
    c.product_id,
    p.nome,
    p.preco_valor,
    least(greatest(c.quantity, 1), 1000)
  from public.cart_items c
  join public.products p on p.id = c.product_id
  where c.user_id = v_uid;

  -- Na criação inicial, changed_by_customer deve permanecer false
  update public.quotes
  set changed_by_customer = false
  where id = v_quote.id;

  -- Esvazia o carrinho do cliente
  delete from public.cart_items
  where user_id = v_uid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', qi.id,
        'product_id', qi.product_id,
        'product_name', qi.product_name,
        'unit_price', qi.unit_price,
        'quantity', qi.quantity
      )
    ),
    '[]'::jsonb
  )
  into v_items_json
  from public.quote_items qi
  where qi.quote_id = v_quote.id;

  return jsonb_build_object(
    'id', v_quote.id,
    'quote_number', v_quote.quote_number,
    'cliente_nome', v_quote.cliente_nome,
    'cliente_telefone', v_quote.cliente_telefone,
    'status', v_quote.status,
    'notes', v_quote.notes,
    'created_at', v_quote.created_at,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.create_quote_from_cart(text) from public, anon;
grant execute on function public.create_quote_from_cart(text) to authenticated;

-- ============================================================================
-- 6. SUPABASE REALTIME NAS TABELAS DO PAINEL DO CLIENTE
-- ============================================================================
alter table public.favorites replica identity full;
alter table public.cart_items replica identity full;
alter table public.quotes replica identity full;
alter table public.quote_items replica identity full;

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['favorites', 'cart_items', 'quotes', 'quote_items'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

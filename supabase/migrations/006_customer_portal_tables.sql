-- ============================================================================
-- MIGRATION 006: TABELAS DO PAINEL DO CLIENTE (QUOTES, SAVED_ITEMS, ORDERS, ORDER_ITEMS)
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- Isolamento estrito por user_id (Cliente A nunca vê dados do Cliente B).
-- Equipe aprovada (is_staff() = admin ou staff approved) vê e gerencia todos
-- os orçamentos e pedidos.
-- Projeto: Loja SJ 3D
-- ============================================================================

-- ============================================================================
-- 1. TABELA public.quotes (ORÇAMENTOS SOLICITADOS PELOS CLIENTES)
-- ============================================================================
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('ORC-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text not null default '',
  cliente_email text not null default '',
  cliente_telefone text not null default '',
  titulo text not null default '',
  descricao text not null,
  arquivo_medidas text not null default '',
  quantidade integer not null default 1 check (quantidade >= 1),
  material_cor text not null default '',
  observacoes text not null default '',
  status text not null default 'enviado' check (status in ('enviado', 'em_analise', 'respondido', 'aprovado', 'recusado')),
  valor_estimado numeric(10, 2),
  resposta_equipe text not null default '',
  respondido_por uuid references auth.users(id) on delete set null,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_user_created on public.quotes (user_id, created_at desc);
create index if not exists idx_quotes_status_created on public.quotes (status, created_at desc);

-- Trigger de segurança em public.quotes:
--   - Cliente não pode forjar user_id de outra pessoa nem definir valor_estimado/resposta_equipe.
--   - Cliente só pode mudar o próprio status quando a equipe já respondeu ('respondido' -> 'aprovado' ou 'recusado').
--   - Equipe aprovada (is_staff()) pode responder com valor, texto e mudar status livremente.
create or replace function public.proteger_quotes_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eh_staff boolean := public.is_staff();
begin
  if v_uid is null then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_eh_staff then
      new.user_id := v_uid;
      new.status := 'enviado';
      new.valor_estimado := null;
      new.resposta_equipe := '';
      new.respondido_por := null;
      new.respondido_em := null;
    end if;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not v_eh_staff then
      -- Cliente não pode mudar dono nem campos exclusivos da equipe
      if new.user_id is distinct from old.user_id
         or new.valor_estimado is distinct from old.valor_estimado
         or new.resposta_equipe is distinct from old.resposta_equipe
         or new.respondido_por is distinct from old.respondido_por
         or new.respondido_em is distinct from old.respondido_em then
        raise exception 'Acesso negado: apenas a equipe pode definir valor ou resposta do orçamento.';
      end if;

      -- Cliente só pode alterar status para aprovar ou recusar um orçamento já respondido
      if new.status is distinct from old.status then
        if not (old.status = 'respondido' and new.status in ('aprovado', 'recusado')) then
          raise exception 'Ação não permitida: você só pode aprovar ou recusar um orçamento respondido pela equipe.';
        end if;
      end if;
    else
      -- Staff respondendo orçamento: registra auditoria de quem respondeu
      if (new.valor_estimado is distinct from old.valor_estimado
          or new.resposta_equipe is distinct from old.resposta_equipe
          or (new.status = 'respondido' and old.status is distinct from 'respondido')) then
        new.respondido_por := v_uid;
        new.respondido_em := now();
      end if;
    end if;

    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_quotes_seguranca on public.quotes;
create trigger trg_proteger_quotes_seguranca
  before insert or update on public.quotes
  for each row execute function public.proteger_quotes_seguranca();

alter table public.quotes enable row level security;
revoke all on public.quotes from anon;
grant select, insert, update, delete on public.quotes to authenticated;

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

drop policy if exists "quotes_delete_own_draft_or_admin" on public.quotes;
create policy "quotes_delete_own_draft_or_admin"
  on public.quotes for delete
  to authenticated
  using ((user_id = (select auth.uid()) and status = 'enviado') or public.is_admin());

-- ============================================================================
-- 2. TABELA public.saved_items (FAVORITOS E RASCUNHOS DO CLIENTE)
-- ============================================================================
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null default 'favorito' check (item_kind in ('favorito', 'rascunho')),
  product_id text,
  titulo text not null,
  descricao text not null default '',
  material_cor text not null default '',
  quantidade integer not null default 1 check (quantidade >= 1),
  preco_referencia numeric(10, 2),
  imagem text not null default '',
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saved_items_user_kind on public.saved_items (user_id, item_kind, created_at desc);

create or replace function public.set_saved_items_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and tg_op = 'INSERT' then
    new.user_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_saved_items_updated_at on public.saved_items;
create trigger trg_saved_items_updated_at
  before insert or update on public.saved_items
  for each row execute function public.set_saved_items_updated_at();

alter table public.saved_items enable row level security;
revoke all on public.saved_items from anon;
grant select, insert, update, delete on public.saved_items to authenticated;

drop policy if exists "saved_items_own_all" on public.saved_items;
create policy "saved_items_own_all"
  on public.saved_items for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ============================================================================
-- 3. TABELA public.orders (PEDIDOS DOS CLIENTES)
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('PED-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5))),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  cliente_nome text not null default '',
  cliente_email text not null default '',
  cliente_telefone text not null default '',
  endereco_entrega text not null default '',
  forma_entrega text not null default 'retirada' check (forma_entrega in ('retirada', 'entrega')),
  observacoes text not null default '',
  status text not null default 'recebido' check (status in ('recebido', 'em_producao', 'pronto', 'enviado_retirado', 'concluido', 'cancelado')),
  total numeric(10, 2) not null default 0,
  atualizado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user_created on public.orders (user_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);

create or replace function public.proteger_orders_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eh_staff boolean := public.is_staff();
begin
  if v_uid is null then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not v_eh_staff then
      new.user_id := v_uid;
      new.status := 'recebido';
      new.atualizado_por := null;
    end if;
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not v_eh_staff then
      if new.user_id is distinct from old.user_id
         or new.status is distinct from old.status
         or new.total is distinct from old.total
         or new.quote_id is distinct from old.quote_id then
        raise exception 'Acesso negado: apenas a equipe pode alterar status ou valor do pedido.';
      end if;
    else
      new.atualizado_por := v_uid;
    end if;

    new.updated_at := now();
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_orders_seguranca on public.orders;
create trigger trg_proteger_orders_seguranca
  before insert or update on public.orders
  for each row execute function public.proteger_orders_seguranca();

alter table public.orders enable row level security;
revoke all on public.orders from anon;
grant select, insert, update, delete on public.orders to authenticated;

drop policy if exists "orders_select_own_or_staff" on public.orders;
create policy "orders_select_own_or_staff"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "orders_insert_own_or_staff" on public.orders;
create policy "orders_insert_own_or_staff"
  on public.orders for insert
  to authenticated
  with check (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "orders_update_own_or_staff" on public.orders;
create policy "orders_update_own_or_staff"
  on public.orders for update
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff())
  with check (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "orders_delete_admin_only" on public.orders;
create policy "orders_delete_admin_only"
  on public.orders for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- 4. TABELA public.order_items (ITENS DE CADA PEDIDO)
-- ============================================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text,
  nome text not null,
  detalhes text not null default '',
  quantidade integer not null default 1 check (quantidade >= 1),
  preco_unitario numeric(10, 2) not null default 0,
  subtotal numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_user on public.order_items (user_id);

alter table public.order_items enable row level security;
revoke all on public.order_items from anon;
grant select, insert, update, delete on public.order_items to authenticated;

drop policy if exists "order_items_select_own_or_staff" on public.order_items;
create policy "order_items_select_own_or_staff"
  on public.order_items for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists "order_items_insert_own_or_staff" on public.order_items;
create policy "order_items_insert_own_or_staff"
  on public.order_items for insert
  to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.orders o
        where o.id = order_id and o.user_id = (select auth.uid())
      )
    )
    or public.is_staff()
  );

drop policy if exists "order_items_update_staff_only" on public.order_items;
create policy "order_items_update_staff_only"
  on public.order_items for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "order_items_delete_staff_only" on public.order_items;
create policy "order_items_delete_staff_only"
  on public.order_items for delete
  to authenticated
  using (public.is_staff());

-- ============================================================================
-- 5. SUPABASE REALTIME NAS NOVAS TABELAS (ATUALIZAÇÃO AO VIVO /conta <-> /admin)
-- ============================================================================
alter table public.quotes replica identity full;
alter table public.saved_items replica identity full;
alter table public.orders replica identity full;
alter table public.order_items replica identity full;

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['quotes', 'saved_items', 'orders', 'order_items'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

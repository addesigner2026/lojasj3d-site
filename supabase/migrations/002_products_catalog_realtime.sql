-- ============================================================================
-- MIGRATION 002: CATÁLOGO GLOBAL (PRODUCTS), ESTOQUE EM TEMPO REAL E RLS
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- Projeto: Loja SJ 3D
-- ============================================================================

-- 1. TABELA UNIFICADA DE PRODUTOS E CORES DE FILAMENTO (CATÁLOGO OFICIAL)
create table if not exists public.products (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  preco text not null default 'Sob consulta',
  preco_valor numeric(10, 2) not null default 0,
  imagem text not null default '',
  categoria text not null default 'filamentos' check (categoria in ('filamentos', 'impressoras', 'pecas', 'manutencao')),
  marca text not null default 'Loja SJ 3D',
  stock_status text not null default 'disponivel' check (stock_status in ('disponivel', 'poucas_unidades', 'esgotado')),
  item_type text not null default 'product' check (item_type in ('product', 'filament_color')),
  paleta_chave text,
  cod text,
  hex text,
  ordem integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Índices para consultas rápidas no catálogo público e no painel admin
create index if not exists idx_products_type_cat_ordem on public.products (item_type, categoria, ordem);
create index if not exists idx_products_paleta_ordem on public.products (paleta_chave, ordem);
create index if not exists idx_products_stock_status on public.products (stock_status);

-- 2. TRIGGER DE AUDITORIA AUTOMÁTICA (updated_at e updated_by)
create or replace function public.set_products_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_audit_fields on public.products;
create trigger trg_products_audit_fields
  before insert or update on public.products
  for each row execute function public.set_products_audit_fields();

-- 3. ROW LEVEL SECURITY (RLS) E PERMISSÕES NA DATA API
-- Leitura: pública (visitantes da loja veem catálogo e selos de estoque em tempo real).
-- Escrita (INSERT, UPDATE, DELETE): EXCLUSIVAMENTE administradores aprovados (public.is_admin()).
alter table public.products enable row level security;

revoke all on public.products from anon;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "products_select_public" on public.products;
create policy "products_select_public"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "products_insert_admin_only" on public.products;
create policy "products_insert_admin_only"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "products_update_admin_only" on public.products;
create policy "products_update_admin_only"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_delete_admin_only" on public.products;
create policy "products_delete_admin_only"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- 4. ATIVAÇÃO DO SUPABASE REALTIME EM public.products E public.profiles
-- Permite que alterações de estoque, preço, nome ou aprovação apareçam
-- automaticamente em todos os navegadores abertos sem precisar recarregar.
alter table public.products replica identity full;
alter table public.profiles replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
    ) then
      alter publication supabase_realtime add table public.products;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;
  end if;
end $$;

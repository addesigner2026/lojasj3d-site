-- ============================================================================
-- MIGRATION 014: BLINDAGEM FINAL DE RLS, TABELAS DE BACKUP E MENOR PRIVILÉGIO
-- ============================================================================
-- 100% idempotente (segura para rodar mais de uma vez no SQL Editor do Supabase).
-- ============================================================================

-- 1. Ativa RLS e revoga TODO acesso de anon/authenticated em tabelas de backup
--    criadas por migrations anteriores dentro do schema public.
do $$
declare
  tbl text;
  backup_tables text[] := array[
    'solicitacoes_titular_backup_008',
    'configuracoes_site_backup_009'
  ];
begin
  foreach tbl in array backup_tables loop
    if to_regclass(format('public.%I', tbl)) is not null then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('alter table public.%I force row level security', tbl);
      execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    end if;
  end loop;
end $$;

-- 2. Garante RLS ativado em TODAS as tabelas do schema public sem exceção
do $$
declare
  rec record;
begin
  for rec in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and rowsecurity = false
  loop
    execute format('alter table public.%I enable row level security', rec.tablename);
  end loop;
end $$;

-- 3. Garante security_invoker = true em todas as views do schema public (se existirem)
do $$
declare
  rec record;
begin
  for rec in
    select viewname
    from pg_views
    where schemaname = 'public'
  loop
    execute format('alter view public.%I set (security_invoker = true)', rec.viewname);
  end loop;
end $$;

-- 4. Restringe leitura pública de public.configuracoes_site SOMENTE a chaves
--    estritamente públicas (bloqueia leitura anônima de equipe_admin_v1 e leads)
do $$
begin
  if to_regclass('public.configuracoes_site') is not null then
    execute 'drop policy if exists "Leitura pública de configurações do site" on public.configuracoes_site';
    execute 'drop policy if exists "configuracoes_site_select_public" on public.configuracoes_site';
    execute 'drop policy if exists "configuracoes_site_select_safe" on public.configuracoes_site';
    execute $p$
      create policy "configuracoes_site_select_safe"
        on public.configuracoes_site
        for select
        to anon, authenticated
        using (
          chave in ('catalogo_oficial_v1', 'banners_home_v1', 'loja_config_publica')
          or (
            auth.uid() is not null
            and exists (
              select 1 from public.profiles p
              where p.id = auth.uid()
                and p.status = 'approved'
                and p.role in ('admin', 'staff')
            )
          )
        )
    $p$;
  end if;
end $$;

-- 5. Revoga permissões de escrita desnecessárias do role anon em tabelas sensíveis
do $$
declare
  tbl text;
  no_anon_write text[] := array[
    'profiles',
    'products',
    'favorites',
    'cart_items',
    'quotes',
    'quote_items',
    'issued_quotes',
    'issued_quote_items',
    'issued_quote_counters',
    'issued_quote_audit_logs',
    'customer_audit_logs',
    'auditoria_logs',
    'lgpd_rate_limits',
    'calc_history',
    'calc_preferences',
    'configuracoes_site'
  ];
begin
  foreach tbl in array no_anon_write loop
    if to_regclass(format('public.%I', tbl)) is not null then
      execute format('revoke insert, update, delete, truncate on table public.%I from anon', tbl);
    end if;
  end loop;
end $$;

-- 6. Revoga leitura anônima de tabelas estritamente privadas
do $$
declare
  tbl text;
  no_anon_select text[] := array[
    'profiles',
    'favorites',
    'cart_items',
    'quotes',
    'quote_items',
    'issued_quotes',
    'issued_quote_items',
    'issued_quote_counters',
    'issued_quote_audit_logs',
    'customer_audit_logs',
    'auditoria_logs',
    'lgpd_rate_limits',
    'solicitacoes_titular',
    'calc_history',
    'calc_preferences'
  ];
begin
  foreach tbl in array no_anon_select loop
    if to_regclass(format('public.%I', tbl)) is not null then
      execute format('revoke select on table public.%I from anon', tbl);
    end if;
  end loop;
end $$;

-- ============================================================================
-- MIGRATION 015: REAJUSTE DE PREÇO (+R$ 5,00) EXCLUSIVO PARA FILAMENTOS
-- Lote: reajuste-2026-11-+5
-- ============================================================================
-- REGRAS DE SEGURANÇA:
--   1. Execução 100% ATÔMICA (BEGIN ... COMMIT: tudo ou nada).
--   2. IDEMPOTENTE COM TRAVA DE LOTE: se tentar rodar de novo, recusa e avisa
--      "Reajuste já aplicado" (impossível somar +R$ 5,00 duas vezes).
--   3. AFETA EXCLUSIVAMENTE categoria = 'filamentos' E preco_valor > 0
--      (inclui disponivel, poucas_unidades e esgotado; nunca altera itens
--      com preço 0 / Sob consulta, impressoras, peças ou manutenção).
--   4. HISTÓRICO COMPLETO em public.product_price_history para consulta e
--      reversão (rollback via 015_rollback_reajuste_filamentos_mais_5.sql).
--   5. AUDITORIA registrada em public.auditoria_logs.
--   6. RLS ativado em todas as tabelas novas (acesso restrito a admins).
-- ============================================================================

begin;

-- 1. TABELA DE CONTROLE DE LOTES DE REAJUSTE (TRAVA CONTRA DUPLA APLICAÇÃO)
create table if not exists public.product_price_batches (
  batch_id text primary key,
  descricao text not null default '',
  categoria_alvo text not null,
  delta_valor numeric(10, 2) not null,
  items_affected integer not null default 0,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users(id) on delete set null
);

alter table public.product_price_batches enable row level security;
revoke all on public.product_price_batches from public, anon, authenticated;
grant select on public.product_price_batches to authenticated;

drop policy if exists "price_batches_select_admin_only" on public.product_price_batches;
create policy "price_batches_select_admin_only"
  on public.product_price_batches for select
  to authenticated
  using (public.is_admin());

-- 2. TABELA DE HISTÓRICO DE PREÇOS (PARA AUDITORIA E DESFAZER/ROLLBACK)
create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references public.product_price_batches(batch_id) on delete cascade,
  product_id text not null,
  product_name text not null default '',
  cod text not null default '',
  categoria text not null,
  stock_status text not null default '',
  old_preco text not null,
  old_preco_valor numeric(10, 2) not null,
  new_preco text not null,
  new_preco_valor numeric(10, 2) not null,
  delta_valor numeric(10, 2) not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_product_price_history_batch on public.product_price_history (batch_id, product_id);
create index if not exists idx_product_price_history_product on public.product_price_history (product_id, changed_at desc);

alter table public.product_price_history enable row level security;
revoke all on public.product_price_history from public, anon, authenticated;
grant select on public.product_price_history to authenticated;

drop policy if exists "price_history_select_admin_only" on public.product_price_history;
create policy "price_history_select_admin_only"
  on public.product_price_history for select
  to authenticated
  using (public.is_admin());

-- 3. APLICAÇÃO ATÔMICA DO LOTE reajuste-2026-11-+5
do $$
declare
  v_batch_id constant text := 'reajuste-2026-11-+5';
  v_delta constant numeric(10, 2) := 5.00;
  v_uid uuid := auth.uid();
  v_email text := '';
  v_count integer := 0;
  v_zero_skipped integer := 0;
begin
  -- Trava contra execução duplicada
  if exists (
    select 1
    from public.product_price_batches
    where batch_id = v_batch_id
      and rolled_back_at is null
  ) then
    raise exception 'Reajuste já aplicado (lote: %). Nenhuma alteração foi feita.', v_batch_id;
  end if;

  -- Se houve rollback anterior deste mesmo lote, limpa o histórico antigo antes de reaplicar
  if exists (
    select 1
    from public.product_price_batches
    where batch_id = v_batch_id
      and rolled_back_at is not null
  ) then
    delete from public.product_price_history where batch_id = v_batch_id;
    delete from public.product_price_batches where batch_id = v_batch_id;
  end if;

  if v_uid is not null then
    select coalesce(email, '') into v_email from public.profiles where id = v_uid;
  end if;

  -- Conta filamentos ignorados por estarem sem preço / preço 0 (proteção contra virar R$ 5,00)
  select count(*)::integer
  into v_zero_skipped
  from public.products
  where categoria = 'filamentos'
    and coalesce(preco_valor, 0) <= 0;

  -- Cria o cabeçalho do lote antes de gravar o histórico (FK)
  insert into public.product_price_batches (
    batch_id, descricao, categoria_alvo, delta_valor, items_affected, applied_by
  ) values (
    v_batch_id,
    'Reajuste fixo de +R$ 5,00 em todos os filamentos (Masterprint e Bambu Lab)',
    'filamentos',
    v_delta,
    0,
    v_uid
  );

  -- Grava o histórico completo (preço antigo -> preço novo) antes do UPDATE
  insert into public.product_price_history (
    batch_id, product_id, product_name, cod, categoria, stock_status,
    old_preco, old_preco_valor, new_preco, new_preco_valor, delta_valor, changed_by
  )
  select
    v_batch_id,
    p.id,
    p.nome,
    coalesce(p.cod, ''),
    p.categoria,
    p.stock_status,
    p.preco,
    p.preco_valor,
    'R$ ' || replace(to_char(round(p.preco_valor + v_delta, 2), 'FM9999990.00'), '.', ','),
    round(p.preco_valor + v_delta, 2),
    v_delta,
    v_uid
  from public.products p
  where p.categoria = 'filamentos'
    and coalesce(p.preco_valor, 0) > 0;

  get diagnostics v_count = row_count;

  -- Aplica o reajuste exclusivamente nos produtos gravados no histórico deste lote
  update public.products p
  set
    preco_valor = h.new_preco_valor,
    preco = h.new_preco,
    updated_at = now()
  from public.product_price_history h
  where h.batch_id = v_batch_id
    and h.product_id = p.id
    and p.categoria = 'filamentos';

  -- Atualiza a contagem real no cabeçalho do lote
  update public.product_price_batches
  set items_affected = v_count
  where batch_id = v_batch_id;

  -- Registra na tabela de auditoria oficial
  if to_regclass('public.auditoria_logs') is not null then
    insert into public.auditoria_logs (
      tabela, operacao, registro_id, usuario_id, usuario_email, dados_novos
    ) values (
      'products',
      'REAJUSTE_PRECO_LOTE',
      v_batch_id,
      v_uid,
      nullif(v_email, ''),
      jsonb_build_object(
        'batch_id', v_batch_id,
        'categoria', 'filamentos',
        'delta_brl', v_delta,
        'items_affected', v_count,
        'zero_price_skipped', v_zero_skipped
      )
    );
  end if;

  raise notice 'Reajuste % aplicado com sucesso: % filamentos atualizados (+R$ 5,00). Ignorados com preço 0: %.',
    v_batch_id, v_count, v_zero_skipped;
end $$;

commit;

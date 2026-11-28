-- ============================================================================
-- ROLLBACK DA MIGRATION 015: DESFAZER REAJUSTE (+R$ 5,00) EM FILAMENTOS
-- Lote alvo: reajuste-2026-11-+5
-- ============================================================================
-- USE APENAS SE PRECISAR REVERTER O REAJUSTE DE PREÇOS.
-- Execução 100% ATÔMICA: devolve cada filamento exatamente ao preço antigo
-- salvo em public.product_price_history e registra a reversão na auditoria.
-- ============================================================================

begin;

do $$
declare
  v_batch_id constant text := 'reajuste-2026-11-+5';
  v_uid uuid := auth.uid();
  v_email text := '';
  v_restored integer := 0;
begin
  if not exists (
    select 1
    from public.product_price_batches
    where batch_id = v_batch_id
      and rolled_back_at is null
  ) then
    raise exception 'Lote % não encontrado ou já foi revertido anteriormente. Nenhuma alteração foi feita.', v_batch_id;
  end if;

  if v_uid is not null then
    select coalesce(email, '') into v_email from public.profiles where id = v_uid;
  end if;

  -- Restaura exatamente o preço antigo salvo no histórico do lote
  update public.products p
  set
    preco_valor = h.old_preco_valor,
    preco = h.old_preco,
    updated_at = now()
  from public.product_price_history h
  where h.batch_id = v_batch_id
    and h.product_id = p.id
    and p.categoria = 'filamentos';

  get diagnostics v_restored = row_count;

  -- Marca o lote como revertido
  update public.product_price_batches
  set
    rolled_back_at = now(),
    rolled_back_by = v_uid
  where batch_id = v_batch_id;

  -- Registra a reversão na auditoria
  if to_regclass('public.auditoria_logs') is not null then
    insert into public.auditoria_logs (
      tabela, operacao, registro_id, usuario_id, usuario_email, dados_novos
    ) values (
      'products',
      'ROLLBACK_REAJUSTE_PRECO_LOTE',
      v_batch_id,
      v_uid,
      nullif(v_email, ''),
      jsonb_build_object(
        'batch_id', v_batch_id,
        'items_restored', v_restored
      )
    );
  end if;

  raise notice 'Rollback do lote % concluído: % filamentos restaurados ao preço anterior.',
    v_batch_id, v_restored;
end $$;

commit;

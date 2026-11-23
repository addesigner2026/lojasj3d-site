-- ============================================================================
-- MIGRATION 012: BUSCA PAGINADA DE CATÁLOGO NO BANCO & AUDITORIA DE PREÇOS
-- ============================================================================
-- 100% idempotente e segura. NÃO altera RLS de outras tabelas, login, loja
-- pública nem modelo do timbrado.
-- Implementa:
--   1. Funções auxiliares de extração/resolução de preço idênticas à loja pública
--   2. Colunas de rastreabilidade (catalog_unit_price, price_overridden) em issued_quote_items
--   3. RPC admin_search_catalog_picker (busca no banco com paginação 24-48 e filtros)
--   4. Atualização de save_issued_quote para validar item zerado, existência no catálogo
--      e auditar automaticamente preços negociados diferentes do catálogo
-- ============================================================================

-- 1. EXTRAÇÃO E RESOLUÇÃO OFICIAL DE PREÇO (MESMA REGRA DA LOJA PÚBLICA)
create or replace function public.sj_extract_price_br(p_txt text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_raw text := trim(coalesce(p_txt, ''));
  v_clean text;
begin
  if v_raw = '' then
    return 0;
  end if;
  -- Mantém apenas dígitos, pontos e vírgulas
  v_clean := regexp_replace(v_raw, '[^0-9.,]', '', 'g');
  if v_clean = '' then
    return 0;
  end if;
  if position(',' in v_clean) > 0 then
    -- Formato BR (ex: 1.961,00 ou 79,90)
    v_clean := replace(replace(v_clean, '.', ''), ',', '.');
  end if;
  begin
    return greatest(0, round(v_clean::numeric, 2));
  exception when others then
    return 0;
  end;
end;
$$;

create or replace function public.sj_resolve_product_price(p_preco_valor numeric, p_preco text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(p_preco_valor, 0) > 0 then round(p_preco_valor::numeric, 2)
    else public.sj_extract_price_br(p_preco)
  end;
$$;

-- Índices para acelerar busca por texto/código/família em public.products
create index if not exists idx_products_picker_search on public.products (
  item_type,
  categoria,
  stock_status,
  ordem
);

create index if not exists idx_products_norm_nome_cod on public.products (
  sj_norm_text(nome),
  sj_norm_text(cod),
  sj_norm_text(marca)
);

-- 2. RASTREABILIDADE DE PREÇO DE CATÁLOGO NOS ITENS DO ORÇAMENTO TIMBRADO
alter table public.issued_quote_items
  add column if not exists catalog_unit_price numeric(10, 2),
  add column if not exists price_overridden boolean not null default false;

-- 3. RPC DE BUSCA E PAGINAÇÃO DE CATÁLOGO PARA O PAINEL ADMIN (STAFF/ADMIN)
create or replace function public.admin_search_catalog_picker(
  p_query text default '',
  p_categoria text default 'todos',
  p_marca text default 'todas',
  p_stock text default 'todos',
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(48, coalesce(p_limit, 24)));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_cat text := lower(trim(coalesce(p_categoria, 'todos')));
  v_brand text := sj_norm_text(trim(coalesce(p_marca, 'todas')));
  v_stock text := lower(trim(coalesce(p_stock, 'todos')));
  v_query_norm text := sj_norm_text(trim(coalesce(p_query, '')));
  v_tokens text[];
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_brands jsonb := '[]'::jsonb;
begin
  if v_uid is null or not public.is_staff() then
    raise exception 'Acesso negado: apenas a equipe autorizada pode consultar o catálogo.';
  end if;

  if v_query_norm <> '' then
    v_tokens := regexp_split_to_array(v_query_norm, '\s+');
  else
    v_tokens := array[]::text[];
  end if;

  with parent_families as (
    select
      p.id as parent_id,
      p.nome as family_name,
      p.marca as parent_marca,
      p.preco as parent_preco,
      p.preco_valor as parent_preco_valor,
      p.imagem as parent_imagem,
      p.metadata->>'usaCoresDinamicas' as dyn_key,
      case p.metadata->>'usaCoresDinamicas'
        when 'bambu' then 'coresBambuLab'
        when 'maxprint' then 'coresMaxPrint'
        when 'plasilk' then 'coresPlaSilk'
        when 'petg' then 'coresPetg'
        when 'tpu' then 'coresTpu'
        when 'absespeciais' then 'coresAbsEspeciais'
        else null
      end as palette_key
    from public.products p
    where p.item_type = 'product'
      and coalesce((p.metadata->>'tipoFilamento')::boolean, false) = true
  ),
  sellable_skus as (
    select
      p.id,
      p.item_type,
      p.categoria,
      case
        when lower(trim(coalesce(p.marca, ''))) in ('maxprint', 'masterprint') then 'Masterprint'
        else coalesce(nullif(trim(p.marca), ''), 'Loja SJ 3D')
      end as marca,
      p.stock_status,
      coalesce(p.cod, '') as cod,
      coalesce(p.hex, '') as hex,
      coalesce(p.paleta_chave, '') as paleta_chave,
      coalesce(
        pf.family_name,
        nullif(trim(p.metadata->>'grupoCatalogo'), ''),
        case p.categoria
          when 'filamentos' then 'Filamentos 3D'
          when 'impressoras' then 'Impressoras 3D'
          when 'pecas' then 'Peças & Acessórios'
          when 'manutencao' then 'Serviços & Manutenção'
          else 'Catálogo'
        end
      ) as familia,
      case
        when p.item_type = 'filament_color' and pf.family_name is not null
          then pf.family_name || ' — ' || p.nome
        else p.nome
      end as nome_exibicao,
      p.nome as nome_curto,
      coalesce(nullif(trim(p.descricao), ''), nullif(trim(p.metadata->>'tipo'), ''), '') as subtitulo,
      coalesce(
        nullif(trim(p.imagem), ''),
        nullif(trim(p.metadata->>'imgCatalogo'), ''),
        nullif(trim(pf.parent_imagem), ''),
        'assets/img/icone-laranja.png'
      ) as imagem,
      coalesce(nullif(trim(p.preco), ''), pf.parent_preco, 'Sob consulta') as preco_texto,
      case
        when sj_resolve_product_price(p.preco_valor, p.preco) > 0
          then sj_resolve_product_price(p.preco_valor, p.preco)
        when p.item_type = 'filament_color' and pf.parent_id is not null
          then sj_resolve_product_price(pf.parent_preco_valor, pf.parent_preco)
        else 0
      end as preco_num,
      p.ordem,
      sj_norm_text(
        coalesce(p.nome, '') || ' ' ||
        coalesce(pf.family_name, '') || ' ' ||
        coalesce(p.descricao, '') || ' ' ||
        coalesce(p.marca, '') || ' ' ||
        case when lower(trim(coalesce(p.marca, ''))) in ('maxprint', 'masterprint') then 'masterprint maxprint ' else '' end ||
        coalesce(p.cod, '') || ' ' ||
        case when coalesce(p.cod, '') <> '' then 'cod ' || p.cod || ' ' else '' end ||
        coalesce(p.id, '') || ' ' ||
        coalesce(p.paleta_chave, '') || ' ' ||
        coalesce(p.categoria, '')
      ) as search_blob
    from public.products p
    left join parent_families pf
      on p.item_type = 'filament_color'
     and pf.palette_key = p.paleta_chave
    where (
      p.item_type = 'filament_color'
      or (
        p.item_type = 'product'
        and (
          coalesce((p.metadata->>'tipoFilamento')::boolean, false) = false
          or not exists (
            select 1
            from public.products c
            where c.item_type = 'filament_color'
              and c.paleta_chave = (
                case p.metadata->>'usaCoresDinamicas'
                  when 'bambu' then 'coresBambuLab'
                  when 'maxprint' then 'coresMaxPrint'
                  when 'plasilk' then 'coresPlaSilk'
                  when 'petg' then 'coresPetg'
                  when 'tpu' then 'coresTpu'
                  when 'absespeciais' then 'coresAbsEspeciais'
                  else null
                end
              )
          )
        )
      )
    )
  ),
  filtered as (
    select s.*
    from sellable_skus s
    where (v_cat in ('', 'todos') or s.categoria = v_cat)
      and (
        v_brand in ('', 'todas', 'todos')
        or (
          case
            when v_brand in ('masterprint', 'maxprint') then sj_norm_text(s.marca) in ('masterprint', 'maxprint')
            else sj_norm_text(s.marca) = v_brand
          end
        )
      )
      and (v_stock in ('', 'todos') or s.stock_status = v_stock)
      and (
        coalesce(array_length(v_tokens, 1), 0) = 0
        or not exists (
          select 1
          from unnest(v_tokens) as tok
          where tok <> '' and position(tok in s.search_blob) = 0
        )
      )
  ),
  paged as (
    select *
    from filtered
    order by
      case categoria
        when 'filamentos' then 1
        when 'impressoras' then 2
        when 'pecas' then 3
        when 'manutencao' then 4
        else 5
      end,
      ordem asc,
      nome_exibicao asc
    limit v_limit offset v_offset
  )
  select
    (select count(*)::integer from filtered),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'product_id', p.id,
        'item_type', p.item_type,
        'categoria', p.categoria,
        'marca', p.marca,
        'familia', p.familia,
        'nome', p.nome_exibicao,
        'nome_curto', p.nome_curto,
        'subtitulo', p.subtitulo,
        'codigo', case when p.cod <> '' then 'CÓD. ' || p.cod else p.id end,
        'cod', p.cod,
        'hex', p.hex,
        'paleta_chave', p.paleta_chave,
        'stock_status', p.stock_status,
        'imagem', p.imagem,
        'preco_texto', p.preco_texto,
        'preco_num', p.preco_num,
        'sem_preco', (p.preco_num <= 0)
      ))
      from paged p
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(b.marca order by b.marca)
      from (select distinct marca from sellable_skus where trim(marca) <> '') b
    ), '[]'::jsonb)
  into v_total, v_items, v_brands;

  return jsonb_build_object(
    'total_count', v_total,
    'items', v_items,
    'brands', v_brands,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

revoke all on function public.admin_search_catalog_picker(text, text, text, text, integer, integer) from public;
grant execute on function public.admin_search_catalog_picker(text, text, text, text, integer, integer) to authenticated;

-- 4. REVALIDAÇÃO DE PRODUTO, BLOQUEIO DE PREÇO ZERO E AUDITORIA DE DESCONTO EM save_issued_quote
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
  v_has_catalog boolean := exists(select 1 from public.products limit 1);
  v_prod_id text;
  v_prod_cod text;
  v_is_custom boolean;
  v_unit_price numeric(10, 2);
  v_catalog_price numeric(10, 2);
  v_price_overridden boolean;
  v_prod_row public.products%rowtype;
  v_price_diffs jsonb := '[]'::jsonb;
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
    case when v_customer_type = 'pj' then nullif(trim(v_snap->>'cnpj'), '') else nullif(trim(v_snap->>'cpf'), '') end,
    v_snap->>'documento',
    ''
  ), '\D', '', 'g');
  v_cep := regexp_replace(coalesce(v_snap->>'cep', ''), '\D', '', 'g');
  v_logradouro := trim(coalesce(v_snap->>'logradouro', ''));
  v_cidade := trim(coalesce(v_snap->>'cidade', ''));

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

  -- Validações rígidas apenas ao EMITIR
  if p_emit then
    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
      raise exception 'Adicione pelo menos 1 produto ou serviço antes de emitir o orçamento.';
    end if;

    for v_item in select * from jsonb_array_elements(v_items)
    loop
      if trim(coalesce(v_item->>'title', '')) = '' then
        raise exception 'Todos os itens precisam de nome/descrição antes de emitir.';
      end if;
      if coalesce((v_item->>'unit_price')::numeric, 0) <= 0 then
        raise exception 'O item "%" está sem preço (R$ 0,00). Preencha o valor unitário antes de emitir.', trim(v_item->>'title');
      end if;
    end loop;

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

  if v_quote_id is not null then
    select * into v_existing from public.issued_quotes where id = v_quote_id;
  end if;

  perform set_config('app.bypass_quote_lock', '1', true);

  if v_existing.id is not null and (v_existing.is_locked or v_create_version) then
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
    v_year := v_existing.quote_year;
    v_seq := v_existing.quote_seq;
    v_version := v_existing.version_number;
    v_code := v_existing.quote_code;
    v_action := case when p_emit then 'issued' else 'saved_draft' end;
  else
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
      v_prod_id := nullif(trim(coalesce(v_item->>'product_id', '')), '');
      v_prod_cod := trim(coalesce(v_item->>'product_code', ''));
      v_is_custom := coalesce((v_item->>'is_custom')::boolean, false);
      v_unit_price := greatest(0, round(coalesce((v_item->>'unit_price')::numeric, 0), 2));
      v_catalog_price := null;
      v_price_overridden := false;
      v_prod_row := null;

      if v_prod_id is not null and not v_is_custom and v_has_catalog then
        select * into v_prod_row
        from public.products
        where id = v_prod_id
        limit 1;

        -- Compatibilidade com IDs legados no formato <familia-id>-<cod>
        if v_prod_row.id is null and v_prod_cod <> '' then
          select * into v_prod_row
          from public.products
          where item_type = 'filament_color'
            and cod = v_prod_cod
          limit 1;
        end if;

        if v_prod_row.id is null then
          if p_emit and v_source_quote_id is null then
            raise exception 'Produto não encontrado no catálogo: "%".', trim(v_item->>'title');
          end if;
        else
          v_prod_id := v_prod_row.id;
          v_catalog_price := public.sj_resolve_product_price(v_prod_row.preco_valor, v_prod_row.preco);
          if v_catalog_price > 0 and abs(v_unit_price - v_catalog_price) >= 0.01 then
            v_price_overridden := true;
            v_price_diffs := v_price_diffs || jsonb_build_object(
              'product_id', v_prod_row.id,
              'item_title', trim(v_item->>'title'),
              'catalog_price', v_catalog_price,
              'quoted_price', v_unit_price
            );
          end if;
        end if;
      end if;

      insert into public.issued_quote_items (
        issued_quote_id, sort_order, product_id, product_code,
        title, description, quantity, unit_price,
        discount_type, discount_value, is_custom,
        catalog_unit_price, price_overridden
      ) values (
        v_result_quote.id,
        v_idx,
        v_prod_id,
        v_prod_cod,
        trim(v_item->>'title'),
        trim(coalesce(v_item->>'description', '')),
        greatest(0.01, coalesce((v_item->>'quantity')::numeric, 1)),
        v_unit_price,
        case when coalesce(v_item->>'discount_type', 'fixed') = 'percent' then 'percent' else 'fixed' end,
        greatest(0, coalesce((v_item->>'discount_value')::numeric, 0)),
        v_is_custom,
        v_catalog_price,
        v_price_overridden
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
      'source_customer_quote_id', v_source_quote_id,
      'price_overrides_count', jsonb_array_length(v_price_diffs),
      'price_overrides', v_price_diffs
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

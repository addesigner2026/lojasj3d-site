-- ============================================================================
-- MIGRATION 007: DADOS FISCAIS PF/PJ EM PROFILES, SNAPSHOT EM QUOTES E REGRAS NF
-- ============================================================================
-- Seguro para rodar mais de uma vez (100% idempotente).
-- NÃO apaga dados existentes. Novos campos entram como opcionais para contas atuais.
-- Impõe unicidade de CPF e CNPJ (quando preenchidos) para 1 conta por CPF/CNPJ.
-- Validação estrita de dígitos verificadores e regras COM/SEM Nota Fiscal no banco.
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÕES OFICIAIS DE VALIDAÇÃO MATEMÁTICA DE CPF E CNPJ NO BANCO
-- ============================================================================
create or replace function public.validar_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_sum integer;
  v_rem integer;
  i integer;
begin
  if length(v_digits) <> 11 then
    return false;
  end if;

  -- Rejeita sequências repetidas (00000000000, 11111111111, etc.)
  if v_digits ~ '^(\d)\1{10}$' then
    return false;
  end if;

  -- 1º dígito verificador
  v_sum := 0;
  for i in 1..9 loop
    v_sum := v_sum + (substr(v_digits, i, 1)::integer * (11 - i));
  end loop;
  v_rem := (v_sum * 10) % 11;
  if v_rem = 10 or v_rem = 11 then
    v_rem := 0;
  end if;
  if v_rem <> substr(v_digits, 10, 1)::integer then
    return false;
  end if;

  -- 2º dígito verificador
  v_sum := 0;
  for i in 1..10 loop
    v_sum := v_sum + (substr(v_digits, i, 1)::integer * (12 - i));
  end loop;
  v_rem := (v_sum * 10) % 11;
  if v_rem = 10 or v_rem = 11 then
    v_rem := 0;
  end if;
  if v_rem <> substr(v_digits, 11, 1)::integer then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.validar_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
  v_w1 integer[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_w2 integer[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_sum integer;
  v_rem integer;
  v_d1 integer;
  v_d2 integer;
  i integer;
begin
  if length(v_digits) <> 14 then
    return false;
  end if;

  if v_digits ~ '^(\d)\1{13}$' then
    return false;
  end if;

  -- 1º dígito verificador
  v_sum := 0;
  for i in 1..12 loop
    v_sum := v_sum + (substr(v_digits, i, 1)::integer * v_w1[i]);
  end loop;
  v_rem := v_sum % 11;
  v_d1 := case when v_rem < 2 then 0 else 11 - v_rem end;
  if v_d1 <> substr(v_digits, 13, 1)::integer then
    return false;
  end if;

  -- 2º dígito verificador
  v_sum := 0;
  for i in 1..13 loop
    v_sum := v_sum + (substr(v_digits, i, 1)::integer * v_w2[i]);
  end loop;
  v_rem := v_sum % 11;
  v_d2 := case when v_rem < 2 then 0 else 11 - v_rem end;
  if v_d2 <> substr(v_digits, 14, 1)::integer then
    return false;
  end if;

  return true;
end;
$$;

-- ============================================================================
-- 2. NOVOS CAMPOS EM public.profiles (OPCIONAIS PARA CONTAS EXISTENTES)
-- ============================================================================
alter table public.profiles add column if not exists person_type text default 'pf';
alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists cnpj text;
alter table public.profiles add column if not exists razao_social text not null default '';
alter table public.profiles add column if not exists nome_fantasia text not null default '';
alter table public.profiles add column if not exists inscricao_estadual text not null default '';
alter table public.profiles add column if not exists ie_tipo text not null default 'contribuinte';
alter table public.profiles add column if not exists contato_nome text not null default '';
alter table public.profiles add column if not exists cep text;
alter table public.profiles add column if not exists logradouro text not null default '';
alter table public.profiles add column if not exists numero text not null default '';
alter table public.profiles add column if not exists complemento text not null default '';
alter table public.profiles add column if not exists bairro text not null default '';
alter table public.profiles add column if not exists cidade text not null default '';
alter table public.profiles add column if not exists uf text;

-- Limpa eventuais strings vazias antigas antes de aplicar constraints
update public.profiles set person_type = 'pf' where person_type is null or person_type not in ('pf', 'pj');
update public.profiles set cpf = null where trim(coalesce(cpf, '')) = '';
update public.profiles set cnpj = null where trim(coalesce(cnpj, '')) = '';
update public.profiles set cep = null where trim(coalesce(cep, '')) = '';
update public.profiles set uf = null where trim(coalesce(uf, '')) = '';
update public.profiles set ie_tipo = 'contribuinte' where ie_tipo is null or ie_tipo not in ('contribuinte', 'isento', 'nao_contribuinte');

-- Constraints idempotentes de formato e integridade matemática
alter table public.profiles drop constraint if exists profiles_person_type_check;
alter table public.profiles add constraint profiles_person_type_check
  check (person_type in ('pf', 'pj'));

alter table public.profiles drop constraint if exists profiles_ie_tipo_check;
alter table public.profiles add constraint profiles_ie_tipo_check
  check (ie_tipo in ('contribuinte', 'isento', 'nao_contribuinte'));

alter table public.profiles drop constraint if exists profiles_cpf_check;
alter table public.profiles add constraint profiles_cpf_check
  check (cpf is null or (cpf ~ '^[0-9]{11}$' and public.validar_cpf(cpf)));

alter table public.profiles drop constraint if exists profiles_cnpj_check;
alter table public.profiles add constraint profiles_cnpj_check
  check (cnpj is null or (cnpj ~ '^[0-9]{14}$' and public.validar_cnpj(cnpj)));

alter table public.profiles drop constraint if exists profiles_cep_check;
alter table public.profiles add constraint profiles_cep_check
  check (cep is null or cep ~ '^[0-9]{8}$');

alter table public.profiles drop constraint if exists profiles_uf_check;
alter table public.profiles add constraint profiles_uf_check
  check (uf is null or uf ~ '^[A-Z]{2}$');

-- Unicidade estrita por documento: 1 conta por CPF e 1 conta por CNPJ (quando preenchidos)
create unique index if not exists idx_profiles_cpf_unique
  on public.profiles (cpf)
  where cpf is not null;

create unique index if not exists idx_profiles_cnpj_unique
  on public.profiles (cnpj)
  where cnpj is not null;

-- Trigger de normalização automática em public.profiles antes de validar constraints
create or replace function public.normalizar_dados_fiscais_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text;
  v_cnpj text;
  v_cep text;
  v_uf text;
  v_end_resumo text;
begin
  if new.person_type is null or new.person_type not in ('pf', 'pj') then
    new.person_type := 'pf';
  end if;

  if new.ie_tipo is null or new.ie_tipo not in ('contribuinte', 'isento', 'nao_contribuinte') then
    new.ie_tipo := 'contribuinte';
  end if;

  v_cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  new.cpf := case when v_cpf = '' then null else v_cpf end;

  v_cnpj := regexp_replace(coalesce(new.cnpj, ''), '\D', '', 'g');
  new.cnpj := case when v_cnpj = '' then null else v_cnpj end;

  v_cep := regexp_replace(coalesce(new.cep, ''), '\D', '', 'g');
  new.cep := case when v_cep = '' then null else v_cep end;

  v_uf := upper(trim(coalesce(new.uf, '')));
  new.uf := case when v_uf = '' then null else v_uf end;

  new.razao_social := trim(coalesce(new.razao_social, ''));
  new.nome_fantasia := trim(coalesce(new.nome_fantasia, ''));
  new.inscricao_estadual := trim(coalesce(new.inscricao_estadual, ''));
  new.contato_nome := trim(coalesce(new.contato_nome, ''));
  new.logradouro := trim(coalesce(new.logradouro, ''));
  new.numero := trim(coalesce(new.numero, ''));
  new.complemento := trim(coalesce(new.complemento, ''));
  new.bairro := trim(coalesce(new.bairro, ''));
  new.cidade := trim(coalesce(new.cidade, ''));

  if new.ie_tipo in ('isento', 'nao_contribuinte') then
    new.inscricao_estadual := '';
  end if;

  -- Mantém campos legados endereco e cidade_uf sincronizados quando endereço estruturado for salvo
  v_end_resumo := concat_ws(', ',
    nullif(new.logradouro, ''),
    nullif(new.numero, ''),
    nullif(new.complemento, ''),
    nullif(new.bairro, '')
  );
  if v_end_resumo <> '' then
    new.endereco := v_end_resumo;
  end if;
  if new.cidade <> '' or coalesce(new.uf, '') <> '' then
    new.cidade_uf := concat_ws(' / ', nullif(new.cidade, ''), nullif(coalesce(new.uf, ''), ''));
  end if;

  return new;
end;
$$;

-- Garante execução ANTES de trg_proteger_profiles_seguranca (ordem alfabética 'trg_01' < 'trg_proteger')
drop trigger if exists trg_01_normalizar_profile_fiscal on public.profiles;
create trigger trg_01_normalizar_profile_fiscal
  before insert or update on public.profiles
  for each row execute function public.normalizar_dados_fiscais_profile();

-- ============================================================================
-- 3. CAMPOS DE NOTA FISCAL E SNAPSHOT IMUTÁVEL EM public.quotes
-- ============================================================================
alter table public.quotes add column if not exists precisa_nota_fiscal boolean not null default false;
alter table public.quotes add column if not exists customer_snapshot jsonb not null default '{}'::jsonb;

create index if not exists idx_quotes_nota_fiscal on public.quotes (precisa_nota_fiscal, created_at desc);

-- Protege precisa_nota_fiscal e customer_snapshot contra manipulação após criação do orçamento
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

    select * into v_prof
    from public.profiles
    where id = new.user_id;

    if coalesce(trim(new.cliente_nome), '') = '' then
      new.cliente_nome := coalesce(nullif(v_prof.razao_social, ''), nullif(v_prof.nome_fantasia, ''), v_prof.nome, '');
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
      if old.status <> 'solicitado' then
        raise exception 'Este orçamento já está em atendimento pela equipe e não pode mais ser editado.';
      end if;

      if new.user_id is distinct from old.user_id
         or new.quote_number is distinct from old.quote_number
         or new.admin_response is distinct from old.admin_response
         or new.admin_total is distinct from old.admin_total
         or new.precisa_nota_fiscal is distinct from old.precisa_nota_fiscal
         or new.customer_snapshot is distinct from old.customer_snapshot then
        raise exception 'Acesso negado: não é permitido adulterar dados fiscais ou de atendimento deste orçamento.';
      end if;

      if new.status is distinct from old.status and new.status <> 'cancelado' then
        raise exception 'Acesso negado: apenas a equipe pode alterar o status do orçamento.';
      end if;

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

-- ============================================================================
-- 4. FUNÇÃO RPC SEGURA DE CRIAÇÃO DO ORÇAMENTO COM VALIDAÇÃO NF NO BANCO
-- ============================================================================
-- Remove versão antiga de 1 argumento para não haver ambiguidade na Data API
drop function if exists public.create_quote_from_cart(text);

create or replace function public.create_quote_from_cart(
  p_notes text default '',
  p_precisa_nota_fiscal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles%rowtype;
  v_quote public.quotes%rowtype;
  v_cart_count integer := 0;
  v_esgotados integer := 0;
  v_items_json jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_tipo text;
  v_tel_digits text;
  v_faltando text[] := array[]::text[];
  v_nome_exibicao text;
  v_doc text;
  v_ie_label text;
begin
  if v_uid is null then
    raise exception 'Faça login para solicitar um orçamento.';
  end if;

  if p_precisa_nota_fiscal is null then
    raise exception 'Informe se precisa de nota fiscal (Sim ou Não).';
  end if;

  select * into v_prof
  from public.profiles
  where id = v_uid;

  if v_prof.id is null then
    raise exception 'Perfil do cliente não encontrado.';
  end if;

  v_tipo := coalesce(v_prof.person_type, 'pf');
  v_tel_digits := regexp_replace(coalesce(v_prof.telefone, ''), '\D', '', 'g');

  -- Valida dados obrigatórios conforme PF / PJ e COM / SEM Nota Fiscal
  if v_tipo = 'pf' then
    if trim(coalesce(v_prof.nome, '')) = '' then
      v_faltando := array_append(v_faltando, 'Nome completo');
    end if;
    if length(v_tel_digits) < 10 then
      v_faltando := array_append(v_faltando, 'Telefone/WhatsApp com DDD');
    end if;
    if v_prof.cpf is null or not public.validar_cpf(v_prof.cpf) then
      v_faltando := array_append(v_faltando, 'CPF válido');
    end if;

    if p_precisa_nota_fiscal then
      if trim(coalesce(v_prof.email, '')) = '' then
        v_faltando := array_append(v_faltando, 'E-mail');
      end if;
      if v_prof.cep is null or v_prof.cep !~ '^[0-9]{8}$' then
        v_faltando := array_append(v_faltando, 'CEP');
      end if;
      if trim(coalesce(v_prof.logradouro, '')) = '' then
        v_faltando := array_append(v_faltando, 'Rua / Logradouro');
      end if;
      if trim(coalesce(v_prof.numero, '')) = '' then
        v_faltando := array_append(v_faltando, 'Número');
      end if;
      if trim(coalesce(v_prof.bairro, '')) = '' then
        v_faltando := array_append(v_faltando, 'Bairro');
      end if;
      if trim(coalesce(v_prof.cidade, '')) = '' then
        v_faltando := array_append(v_faltando, 'Cidade');
      end if;
      if v_prof.uf is null or v_prof.uf !~ '^[A-Z]{2}$' then
        v_faltando := array_append(v_faltando, 'UF');
      end if;
    end if;

    v_nome_exibicao := trim(coalesce(v_prof.nome, ''));
    v_doc := coalesce(v_prof.cpf, '');
    v_ie_label := '';
  else
    -- Pessoa Jurídica
    if p_precisa_nota_fiscal then
      if trim(coalesce(v_prof.razao_social, '')) = '' then
        v_faltando := array_append(v_faltando, 'Razão social');
      end if;
      if trim(coalesce(v_prof.contato_nome, '')) = '' then
        v_faltando := array_append(v_faltando, 'Nome da pessoa de contato');
      end if;
      if trim(coalesce(v_prof.email, '')) = '' then
        v_faltando := array_append(v_faltando, 'E-mail');
      end if;
      if v_prof.ie_tipo = 'contribuinte' and trim(coalesce(v_prof.inscricao_estadual, '')) = '' then
        v_faltando := array_append(v_faltando, 'Inscrição estadual (ou marcar Isento / Não contribuinte)');
      end if;
      if v_prof.cep is null or v_prof.cep !~ '^[0-9]{8}$' then
        v_faltando := array_append(v_faltando, 'CEP');
      end if;
      if trim(coalesce(v_prof.logradouro, '')) = '' then
        v_faltando := array_append(v_faltando, 'Rua / Logradouro');
      end if;
      if trim(coalesce(v_prof.numero, '')) = '' then
        v_faltando := array_append(v_faltando, 'Número');
      end if;
      if trim(coalesce(v_prof.bairro, '')) = '' then
        v_faltando := array_append(v_faltando, 'Bairro');
      end if;
      if trim(coalesce(v_prof.cidade, '')) = '' then
        v_faltando := array_append(v_faltando, 'Cidade');
      end if;
      if v_prof.uf is null or v_prof.uf !~ '^[A-Z]{2}$' then
        v_faltando := array_append(v_faltando, 'UF');
      end if;
    else
      if trim(coalesce(v_prof.razao_social, '')) = '' and trim(coalesce(v_prof.nome_fantasia, '')) = '' then
        v_faltando := array_append(v_faltando, 'Razão social ou Nome fantasia');
      end if;
    end if;

    if length(v_tel_digits) < 10 then
      v_faltando := array_append(v_faltando, 'Telefone/WhatsApp com DDD');
    end if;
    if v_prof.cnpj is null or not public.validar_cnpj(v_prof.cnpj) then
      v_faltando := array_append(v_faltando, 'CNPJ válido');
    end if;

    v_nome_exibicao := coalesce(nullif(trim(v_prof.razao_social), ''), nullif(trim(v_prof.nome_fantasia), ''), trim(v_prof.nome));
    v_doc := coalesce(v_prof.cnpj, '');
    v_ie_label := case
      when v_prof.ie_tipo = 'isento' then 'Isento'
      when v_prof.ie_tipo = 'nao_contribuinte' then 'Não contribuinte'
      else trim(coalesce(v_prof.inscricao_estadual, ''))
    end;
  end if;

  if array_length(v_faltando, 1) > 0 then
    raise exception 'Dados obrigatórios incompletos para o orçamento: %', array_to_string(v_faltando, ', ');
  end if;

  -- Verifica carrinho
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

  -- Monta snapshot fiscal imutável do momento da solicitação
  v_snapshot := jsonb_build_object(
    'person_type', v_tipo,
    'precisa_nota_fiscal', p_precisa_nota_fiscal,
    'nome', trim(coalesce(v_prof.nome, '')),
    'razao_social', trim(coalesce(v_prof.razao_social, '')),
    'nome_fantasia', trim(coalesce(v_prof.nome_fantasia, '')),
    'contato_nome', trim(coalesce(v_prof.contato_nome, '')),
    'display_name', v_nome_exibicao,
    'cpf', case when v_tipo = 'pf' then v_prof.cpf else null end,
    'cnpj', case when v_tipo = 'pj' then v_prof.cnpj else null end,
    'documento', v_doc,
    'inscricao_estadual', v_ie_label,
    'ie_tipo', v_prof.ie_tipo,
    'telefone', trim(coalesce(v_prof.telefone, '')),
    'email', trim(coalesce(v_prof.email, '')),
    'cep', coalesce(v_prof.cep, ''),
    'logradouro', trim(coalesce(v_prof.logradouro, '')),
    'numero', trim(coalesce(v_prof.numero, '')),
    'complemento', trim(coalesce(v_prof.complemento, '')),
    'bairro', trim(coalesce(v_prof.bairro, '')),
    'cidade', trim(coalesce(v_prof.cidade, '')),
    'uf', coalesce(v_prof.uf, '')
  );

  insert into public.quotes (
    user_id,
    cliente_nome,
    cliente_email,
    cliente_telefone,
    status,
    notes,
    precisa_nota_fiscal,
    customer_snapshot,
    changed_by_customer
  ) values (
    v_uid,
    v_nome_exibicao,
    coalesce(v_prof.email, ''),
    coalesce(v_prof.telefone, ''),
    'solicitado',
    coalesce(trim(p_notes), ''),
    p_precisa_nota_fiscal,
    v_snapshot,
    false
  )
  returning * into v_quote;

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

  update public.quotes
  set changed_by_customer = false
  where id = v_quote.id;

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
    'precisa_nota_fiscal', v_quote.precisa_nota_fiscal,
    'customer_snapshot', v_quote.customer_snapshot,
    'status', v_quote.status,
    'notes', v_quote.notes,
    'created_at', v_quote.created_at,
    'items', v_items_json
  );
end;
$$;

revoke all on function public.create_quote_from_cart(text, boolean) from public, anon;
grant execute on function public.create_quote_from_cart(text, boolean) to authenticated;

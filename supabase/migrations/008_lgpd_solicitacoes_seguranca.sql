-- ============================================================================
-- MIGRATION 008: CANAL LGPD (DIREITOS DO TITULAR) + SEGURANÇA + REALTIME
-- ============================================================================
-- 100% idempotente (seguro para executar mais de uma vez).
-- Faz backup automático caso public.solicitacoes_titular já exista com dados,
-- preserva protocolos antigos e aplica blindagem completa:
--   - RLS estrita: usuário logado vê apenas user_id = auth.uid(); staff/admin
--     aprovados (is_staff()) veem e atualizam todas as solicitações.
--   - Consulta pública por protocolo via RPC SECURITY DEFINER exigindo
--     protocolo + e-mail exatos (sem vazar se o protocolo existe ou CPF/CNPJ).
--   - Criação via RPC/API com sanitização, limites de tamanho, protocolo
--     criptográfico não adivinhável e rate limiting no banco por IP/e-mail.
--   - Trilha de auditoria sem nunca gravar CPF/CNPJ em logs.
--   - Pedido de exclusão NUNCA apaga dados automaticamente (revisão manual).
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) BACKUP DE SEGURANÇA ANTES DE ALTERAR ESTRUTURA
do $$
begin
  if to_regclass('public.solicitacoes_titular') is not null then
    execute 'create table if not exists public.solicitacoes_titular_backup_008 (like public.solicitacoes_titular including all)';
    execute 'insert into public.solicitacoes_titular_backup_008 select * from public.solicitacoes_titular on conflict do nothing';
  end if;
end $$;

-- 2) TABELA PRINCIPAL DE SOLICITAÇÕES LGPD
create table if not exists public.solicitacoes_titular (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  titular_nome text not null,
  titular_email text not null,
  titular_cpf text,
  cpf_cnpj text,
  tipo_solicitacao text not null,
  detalhes_solicitacao text,
  status text not null default 'recebida',
  prazo_limite timestamptz not null default (now() + interval '15 days'),
  prazo_resposta timestamptz not null default (now() + interval '15 days'),
  responsavel_email text,
  respondido_por uuid references auth.users(id) on delete set null,
  resposta_texto text,
  resposta text,
  motivo_negativa text,
  dados_exportados jsonb,
  ip_solicitante text,
  ip_hash text,
  concluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante colunas em ambientes onde a tabela já existia pelo schema antigo
alter table public.solicitacoes_titular add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.solicitacoes_titular add column if not exists cpf_cnpj text;
alter table public.solicitacoes_titular add column if not exists prazo_resposta timestamptz not null default (now() + interval '15 days');
alter table public.solicitacoes_titular add column if not exists respondido_por uuid references auth.users(id) on delete set null;
alter table public.solicitacoes_titular add column if not exists resposta text;
alter table public.solicitacoes_titular add column if not exists motivo_negativa text;
alter table public.solicitacoes_titular add column if not exists ip_hash text;
alter table public.solicitacoes_titular add column if not exists created_at timestamptz not null default now();
alter table public.solicitacoes_titular add column if not exists updated_at timestamptz not null default now();

-- Sincroniza registros antigos com as colunas novas
update public.solicitacoes_titular
set
  cpf_cnpj = coalesce(cpf_cnpj, titular_cpf),
  titular_cpf = coalesce(titular_cpf, cpf_cnpj),
  prazo_resposta = coalesce(prazo_resposta, prazo_limite, criado_em + interval '15 days'),
  prazo_limite = coalesce(prazo_limite, prazo_resposta, criado_em + interval '15 days'),
  resposta = coalesce(resposta, resposta_texto),
  resposta_texto = coalesce(resposta_texto, resposta),
  created_at = coalesce(created_at, criado_em, now()),
  updated_at = coalesce(updated_at, atualizado_em, now())
where cpf_cnpj is distinct from coalesce(cpf_cnpj, titular_cpf)
   or prazo_resposta is null
   or created_at is null
   or updated_at is null;

-- Atualiza constraints de tipo e status mantendo compatibilidade com registros antigos
alter table public.solicitacoes_titular drop constraint if exists solicitacoes_titular_tipo_solicitacao_check;
alter table public.solicitacoes_titular add constraint solicitacoes_titular_tipo_solicitacao_check
  check (tipo_solicitacao in (
    'acesso_dados',
    'correcao_dados',
    'eliminacao_dados',
    'portabilidade_dados',
    'revogacao_consentimento',
    'informacao_compartilhamento',
    'outro'
  ));

alter table public.solicitacoes_titular drop constraint if exists solicitacoes_titular_status_check;
alter table public.solicitacoes_titular add constraint solicitacoes_titular_status_check
  check (status in (
    'recebida',
    'em_analise',
    'concluida',
    'negada_parcialmente',
    'rejeitada',
    'cancelada'
  ));

alter table public.solicitacoes_titular alter column status set default 'recebida';

create index if not exists idx_solic_protocolo_upper on public.solicitacoes_titular (upper(protocolo));
create index if not exists idx_solic_email_lower on public.solicitacoes_titular (lower(titular_email));
create index if not exists idx_solic_user_id on public.solicitacoes_titular (user_id, created_at desc);
create index if not exists idx_solic_status_prazo on public.solicitacoes_titular (status, prazo_limite);

-- 3) TABELA DE RATE LIMITING PARA ENVIO E CONSULTA LGPD
create table if not exists public.lgpd_rate_limits (
  id bigint generated always as identity primary key,
  scope_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lgpd_rate_scope_time on public.lgpd_rate_limits (scope_key, created_at desc);

alter table public.lgpd_rate_limits enable row level security;
revoke all on public.lgpd_rate_limits from public, anon, authenticated;

-- Garante tabela de auditoria se não existir
create table if not exists public.auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  operacao text not null,
  registro_id text,
  usuario_id uuid references auth.users(id),
  usuario_email text,
  dados_anteriores jsonb,
  dados_novos jsonb,
  ip_origem text,
  criado_em timestamptz not null default now()
);

alter table public.auditoria_logs enable row level security;
drop policy if exists "auditoria_admin_only" on public.auditoria_logs;
create policy "auditoria_admin_only"
  on public.auditoria_logs for select
  to authenticated
  using (public.is_admin());

-- 4) HELPERS INTERNOS DE SANITIZAÇÃO, PROTOCOLO E RATE LIMIT
create or replace function public.sanitizar_texto_lgpd(p_txt text, p_max integer)
returns text
language sql
immutable
set search_path = public
as $$
  select left(
    trim(
      regexp_replace(
        regexp_replace(coalesce(p_txt, ''), '<[^>]*>', '', 'g'),
        '\s+', ' ', 'g'
      )
    ),
    greatest(1, p_max)
  );
$$;

create or replace function public.gerar_protocolo_lgpd()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prot text;
  v_tentativas integer := 0;
begin
  loop
    v_tentativas := v_tentativas + 1;
    v_prot := 'LGPD-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.solicitacoes_titular where upper(protocolo) = v_prot);
    if v_tentativas >= 10 then
      v_prot := 'LGPD-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
      exit;
    end if;
  end loop;
  return v_prot;
end;
$$;

create or replace function public.verificar_rate_limit_lgpd(
  p_scope_key text,
  p_max_hits integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_scope_key is null or trim(p_scope_key) = '' then
    return true;
  end if;

  delete from public.lgpd_rate_limits
  where created_at < now() - interval '24 hours'
    and id in (
      select id from public.lgpd_rate_limits
      where created_at < now() - interval '24 hours'
      limit 200
    );

  select count(*) into v_hits
  from public.lgpd_rate_limits
  where scope_key = p_scope_key
    and created_at >= now() - p_window;

  if v_hits >= p_max_hits then
    return false;
  end if;

  insert into public.lgpd_rate_limits (scope_key) values (p_scope_key);
  return true;
end;
$$;

revoke all on function public.verificar_rate_limit_lgpd(text, integer, interval) from public, anon, authenticated;

-- 5) TRIGGER DE SEGURANÇA NA INSERÇÃO E ATUALIZAÇÃO
create or replace function public.proteger_solicitacao_lgpd_seguranca()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_doc text;
  v_agora timestamptz := now();
begin
  if tg_op = 'INSERT' then
    new.titular_nome := public.sanitizar_texto_lgpd(new.titular_nome, 120);
    new.titular_email := lower(public.sanitizar_texto_lgpd(new.titular_email, 160));
    new.detalhes_solicitacao := nullif(public.sanitizar_texto_lgpd(new.detalhes_solicitacao, 2000), '');

    if length(new.titular_nome) < 2 then
      raise exception 'Informe seu nome completo.';
    end if;
    if new.titular_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Informe um e-mail válido.';
    end if;

    v_doc := nullif(regexp_replace(coalesce(new.cpf_cnpj, new.titular_cpf, ''), '\D', '', 'g'), '');
    if v_doc is not null and length(v_doc) not in (11, 14) then
      raise exception 'CPF ou CNPJ deve conter 11 ou 14 dígitos.';
    end if;
    new.cpf_cnpj := v_doc;
    new.titular_cpf := v_doc;

    if not public.verificar_rate_limit_lgpd('email:' || md5(new.titular_email), 5, interval '1 hour') then
      raise exception 'Limite de solicitações atingido para este e-mail. Tente novamente mais tarde.';
    end if;
    if new.ip_hash is not null and not public.verificar_rate_limit_lgpd('ip:' || new.ip_hash, 12, interval '1 hour') then
      raise exception 'Muitas solicitações seguidas deste endereço. Tente novamente mais tarde.';
    end if;

    if new.protocolo is null or trim(new.protocolo) = '' then
      new.protocolo := public.gerar_protocolo_lgpd();
    else
      new.protocolo := upper(trim(new.protocolo));
    end if;

    if v_uid is not null then
      new.user_id := v_uid;
    end if;

    new.status := 'recebida';
    new.criado_em := v_agora;
    new.created_at := v_agora;
    new.atualizado_em := v_agora;
    new.updated_at := v_agora;
    new.prazo_limite := v_agora + interval '15 days';
    new.prazo_resposta := new.prazo_limite;
    new.resposta_texto := null;
    new.resposta := null;
    new.motivo_negativa := null;
    new.respondido_por := null;
    new.responsavel_email := null;
    new.concluida_em := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if not public.is_staff() then
      raise exception 'Apenas equipe autorizada pode atualizar solicitações LGPD.';
    end if;

    new.id := old.id;
    new.protocolo := old.protocolo;
    new.user_id := old.user_id;
    new.titular_nome := old.titular_nome;
    new.titular_email := old.titular_email;
    new.titular_cpf := old.titular_cpf;
    new.cpf_cnpj := old.cpf_cnpj;
    new.tipo_solicitacao := old.tipo_solicitacao;
    new.detalhes_solicitacao := old.detalhes_solicitacao;
    new.criado_em := old.criado_em;
    new.created_at := old.created_at;
    new.prazo_limite := old.prazo_limite;
    new.prazo_resposta := old.prazo_resposta;

    new.resposta_texto := nullif(public.sanitizar_texto_lgpd(coalesce(new.resposta_texto, new.resposta), 3000), '');
    new.resposta := new.resposta_texto;
    new.motivo_negativa := nullif(public.sanitizar_texto_lgpd(new.motivo_negativa, 1000), '');

    select email into v_email from auth.users where id = v_uid;
    new.respondido_por := coalesce(v_uid, old.respondido_por);
    new.responsavel_email := coalesce(v_email, new.responsavel_email, old.responsavel_email);
    new.atualizado_em := v_agora;
    new.updated_at := v_agora;

    if new.status in ('concluida', 'negada_parcialmente') and old.concluida_em is null then
      new.concluida_em := v_agora;
    elsif new.status not in ('concluida', 'negada_parcialmente') then
      new.concluida_em := null;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_solicitacao_lgpd_seguranca on public.solicitacoes_titular;
create trigger trg_proteger_solicitacao_lgpd_seguranca
  before insert or update on public.solicitacoes_titular
  for each row execute function public.proteger_solicitacao_lgpd_seguranca();

-- 6) TRIGGER DE AUDITORIA (NUNCA REGISTRA CPF/CNPJ EM LOGS)
create or replace function public.auditoria_solicitacoes_lgpd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is not null then
    select email into v_email from auth.users where id = v_uid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.auditoria_logs (
      tabela, operacao, registro_id, usuario_id, usuario_email, dados_novos
    ) values (
      'solicitacoes_titular',
      'INSERT',
      new.id::text,
      v_uid,
      coalesce(v_email, 'canal_publico'),
      jsonb_build_object(
        'protocolo', new.protocolo,
        'tipo_solicitacao', new.tipo_solicitacao,
        'status', new.status,
        'prazo_resposta', new.prazo_resposta
      )
    );
  elsif tg_op = 'UPDATE' then
    insert into public.auditoria_logs (
      tabela, operacao, registro_id, usuario_id, usuario_email, dados_anteriores, dados_novos
    ) values (
      'solicitacoes_titular',
      'UPDATE',
      new.id::text,
      v_uid,
      coalesce(v_email, new.responsavel_email, 'equipe'),
      jsonb_build_object(
        'status', old.status,
        'possui_resposta', (old.resposta_texto is not null)
      ),
      jsonb_build_object(
        'protocolo', new.protocolo,
        'status', new.status,
        'respondido_por', new.respondido_por,
        'possui_resposta', (new.resposta_texto is not null),
        'motivo_negativa', new.motivo_negativa
      )
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_solicitacoes on public.solicitacoes_titular;
create trigger trg_audit_solicitacoes
  after insert or update on public.solicitacoes_titular
  for each row execute function public.auditoria_solicitacoes_lgpd();

-- 7) POLÍTICAS RLS ESTRITAS (ISOLAMENTO DE CLIENTE + EQUIPE APROVADA)
alter table public.solicitacoes_titular enable row level security;

revoke all on public.solicitacoes_titular from anon, authenticated;
grant select, update on public.solicitacoes_titular to authenticated;

-- Ninguém anônimo lê a tabela diretamente; logado lê apenas as próprias (user_id = auth.uid()) ou staff/admin aprovados
drop policy if exists "solicitacoes_titular_insert" on public.solicitacoes_titular;
drop policy if exists "solicitacoes_titular_select" on public.solicitacoes_titular;
create policy "solicitacoes_titular_select"
  on public.solicitacoes_titular for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_staff()
  );

drop policy if exists "solicitacoes_titular_update" on public.solicitacoes_titular;
create policy "solicitacoes_titular_update"
  on public.solicitacoes_titular for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- 8) FUNÇÃO SEGURA PARA CRIAR SOLICITAÇÃO (CHAMADA PELO BACKEND OU USUÁRIO AUTENTICADO)
create or replace function public.criar_solicitacao_lgpd(
  p_nome text,
  p_email text,
  p_cpf_cnpj text default null,
  p_tipo text default 'acesso_dados',
  p_detalhes text default '',
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.solicitacoes_titular;
begin
  insert into public.solicitacoes_titular (
    protocolo,
    user_id,
    titular_nome,
    titular_email,
    titular_cpf,
    cpf_cnpj,
    tipo_solicitacao,
    detalhes_solicitacao,
    status,
    ip_hash
  ) values (
    public.gerar_protocolo_lgpd(),
    auth.uid(),
    p_nome,
    p_email,
    p_cpf_cnpj,
    p_cpf_cnpj,
    coalesce(nullif(trim(p_tipo), ''), 'acesso_dados'),
    p_detalhes,
    'recebida',
    nullif(trim(coalesce(p_ip_hash, '')), '')
  )
  returning * into v_row;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_row.id,
    'protocolo', v_row.protocolo,
    'status', v_row.status,
    'prazo_limite', v_row.prazo_limite,
    'prazo_resposta', v_row.prazo_resposta,
    'criado_em', v_row.criado_em
  );
end;
$$;

revoke all on function public.criar_solicitacao_lgpd(text, text, text, text, text, text) from public, anon;
grant execute on function public.criar_solicitacao_lgpd(text, text, text, text, text, text) to anon, authenticated;

-- 9) FUNÇÃO SEGURA DE CONSULTA DE PROTOCOLO (EXIGE PROTOCOLO + E-MAIL EXATOS)
create or replace function public.consultar_protocolo_lgpd(
  p_protocolo text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prot text := upper(trim(coalesce(p_protocolo, '')));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_row public.solicitacoes_titular;
begin
  if length(v_prot) < 6 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('encontrado', false);
  end if;

  select * into v_row
  from public.solicitacoes_titular
  where upper(protocolo) = v_prot
    and lower(titular_email) = v_email
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('encontrado', false);
  end if;

  -- Retorna apenas status, tipo, prazo e resposta (sem listar nem expor CPF/CNPJ)
  return jsonb_build_object(
    'encontrado', true,
    'protocolo', v_row.protocolo,
    'tipo_solicitacao', v_row.tipo_solicitacao,
    'status', v_row.status,
    'criado_em', v_row.criado_em,
    'prazo_limite', v_row.prazo_limite,
    'prazo_resposta', v_row.prazo_resposta,
    'atualizado_em', v_row.atualizado_em,
    'concluida_em', v_row.concluida_em,
    'resposta_texto', v_row.resposta_texto,
    'motivo_negativa', v_row.motivo_negativa
  );
end;
$$;

revoke all on function public.consultar_protocolo_lgpd(text, text) from public;
grant execute on function public.consultar_protocolo_lgpd(text, text) to anon, authenticated;

-- 9B) RPC PARA REGISTRAR VISUALIZAÇÃO DE CPF/CNPJ NO PAINEL (SEM EXPOR INSERT DIRETO EM AUDITORIA)
create or replace function public.registrar_visualizacao_lgpd(p_solicitacao_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_prot text;
begin
  if not public.is_staff() then
    return false;
  end if;
  select email into v_email from auth.users where id = v_uid;
  select protocolo into v_prot from public.solicitacoes_titular where id = p_solicitacao_id;
  if v_prot is null then
    return false;
  end if;
  insert into public.auditoria_logs (
    tabela, operacao, registro_id, usuario_id, usuario_email, dados_novos
  ) values (
    'solicitacoes_titular',
    'VISUALIZACAO_CPF_CNPJ',
    p_solicitacao_id::text,
    v_uid,
    coalesce(v_email, 'equipe'),
    jsonb_build_object('protocolo', v_prot, 'acao', 'revelar_documento_painel_admin')
  );
  return true;
end;
$$;

revoke all on function public.registrar_visualizacao_lgpd(uuid) from public, anon;
grant execute on function public.registrar_visualizacao_lgpd(uuid) to authenticated;

-- 10) HABILITA SUPABASE REALTIME NA TABELA
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'solicitacoes_titular'
    ) then
      alter publication supabase_realtime add table public.solicitacoes_titular;
    end if;
  end if;
end $$;

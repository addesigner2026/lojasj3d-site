-- ============================================================================
-- BANCO DE DADOS & REGRAS DE SEGURANÇA (RLS) — LOJA SJ 3D (UMUARAMA - PR)
-- ============================================================================
-- Execute este script no SQL Editor do seu projeto Supabase (Dashboard -> SQL Editor)
--
-- Recursos inclusos:
-- 1. Extensões e Tipos
-- 2. Tabela de Perfis de Vendedores/Usuários (integrada com Supabase Auth)
-- 3. Tabela de Configurações do Site (Banner Promocional e Dados da Loja)
-- 4. Tabela de Produtos (Impressoras, Filamentos, Peças, Serviços)
-- 5. Tabela de Cores de Filamentos (+80 cores com CÓD. e paletas)
-- 6. Tabela de Clientes da Loja
-- 7. Tabela de Orçamentos e Propostas Comerciais
-- 8. Ativação de Row Level Security (RLS) e Políticas TO anon / TO authenticated
-- 9. Storage Bucket para Fotos e Banners (produtos-midia)
-- ============================================================================

-- 1. EXTENSÕES
create extension if not exists "uuid-ossp";

-- 2. PERFIS DE USUÁRIOS (CLIENTES, VENDEDORES E ADMINISTRADORES)
-- Sincroniza automaticamente com auth.users do Supabase
create table if not exists public.perfis_usuarios (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null unique,
  cargo text not null default 'Cliente',
  tipo text not null default 'cliente', -- cliente | operador | admin
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Trigger para criar perfil automaticamente no SignUp via Supabase Auth
-- REGRA DE SEGURANÇA: Todo novo usuário nasce estritamente como 'cliente'.
-- Promoções de cargo/tipo só podem ser feitas por Administradores autenticados.
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis_usuarios (id, nome, email, cargo, tipo, foto_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    'Cliente',
    'cliente',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email,
    atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_novo_usuario();

-- Funções granulares de segurança (Security Definer) por papel
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis_usuarios
    where id = auth.uid()
      and tipo = 'admin'
      and ativo = true
  );
$$;

create or replace function public.is_equipe_interna()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis_usuarios
    where id = auth.uid()
      and tipo in ('operador', 'admin', 'financeiro')
      and ativo = true
  );
$$;

create or replace function public.is_admin_ou_vendedor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis_usuarios
    where id = auth.uid()
      and tipo in ('operador', 'admin')
      and ativo = true
  );
$$;

-- Trigger para bloquear qualquer auto-promoção de perfil (usuário comum virar admin/operador)
create or replace function public.bloquear_auto_promocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.tipo is distinct from new.tipo or old.cargo is distinct from new.cargo) then
    if not (public.is_admin()) then
      raise exception 'Acesso negado: Somente administradores ativos podem alterar cargos e tipos de acesso.';
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_bloquear_auto_promocao on public.perfis_usuarios;
create trigger trg_bloquear_auto_promocao
  before update on public.perfis_usuarios
  for each row execute function public.bloquear_auto_promocao();

-- 3. CONFIGURAÇÕES DO SITE (BANNER DO SORTEIO/PROMOÇÕES E DADOS DA LOJA)
create table if not exists public.configuracoes_site (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now()
);

-- 4. PRODUTOS DO CATÁLOGO
create table if not exists public.produtos (
  id text primary key,
  categoria text not null, -- filamentos | impressoras | pecas | manutencao
  marca text not null,
  nome text not null,
  subtitulo text,
  preco_vista text not null,
  preco_vista_valor numeric(10,2) not null default 0,
  preco_parcelado text,
  imagem_url text not null,
  tipo_filamento boolean not null default false,
  permite_trocar_marca boolean not null default false,
  usa_cores_dinamicas text,
  tag_destaque text,
  grupo_catalogo text,
  ficha_tecnica jsonb not null default '{}'::jsonb,
  select1_label text,
  select1_opcoes jsonb not null default '[]'::jsonb,
  select2_opcoes jsonb not null default '[]'::jsonb,
  botao_texto text not null default 'Adicionar ao Pedido',
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 5. CORES DE FILAMENTOS COM CÓDIGO
create table if not exists public.filamento_cores (
  id text primary key,
  paleta_chave text not null, -- coresBambuLab | coresMaxPrint | coresPlaSilk | coresPetg | coresTpu | coresAbsEspeciais
  cod text not null,
  nome text not null,
  hex text not null,
  preco text not null,
  valor numeric(10,2) not null default 0,
  filtro_css text default 'none',
  img_catalogo text,
  usa_foto_catalogo_direta boolean not null default false,
  tipo text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- 6. CLIENTES (HISTÓRICO E AUTOCOMPLETAR DE ORÇAMENTOS)
create table if not exists public.clientes (
  id text primary key,
  nome text not null,
  cnpj_cpf text,
  endereco text,
  bairro_cidade_uf text,
  cep_telefone text,
  email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 7. ORÇAMENTOS & PROPOSTAS COMERCIAIS
create table if not exists public.orcamentos (
  id text primary key, -- ex: SJ-2026-4821
  cliente_id text references public.clientes(id) on delete set null,
  cliente_nome text not null,
  vendedor text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'faturado', 'cancelado')),
  total numeric(10,2) not null default 0,
  itens_qtd integer not null default 0,
  metadados jsonb not null default '{}'::jsonb,
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ÍNDICES PARA ALTA PERFORMANCE
create index if not exists idx_produtos_categoria on public.produtos(categoria, ativo);
create index if not exists idx_produtos_marca on public.produtos(marca);
create index if not exists idx_filamento_cores_paleta on public.filamento_cores(paleta_chave, ordem);
create index if not exists idx_clientes_nome on public.clientes(lower(nome));
create index if not exists idx_clientes_doc on public.clientes(cnpj_cpf);
create index if not exists idx_orcamentos_data on public.orcamentos(criado_em desc);
create index if not exists idx_orcamentos_status on public.orcamentos(status);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) & POLÍTICAS DE ACESSO
-- ============================================================================

-- Ativa RLS em todas as tabelas expostas
alter table public.perfis_usuarios enable row level security;
alter table public.configuracoes_site enable row level security;
alter table public.produtos enable row level security;
alter table public.filamento_cores enable row level security;
alter table public.clientes enable row level security;
alter table public.orcamentos enable row level security;

-- Permissões do Data API (Defesa em Profundidade: anon NÃO tem permissão de escrita)
grant usage on schema public to anon, authenticated;
grant select on public.configuracoes_site, public.produtos, public.filamento_cores to anon, authenticated;
grant select, update on public.perfis_usuarios to authenticated;
grant select, insert, update on public.clientes, public.orcamentos to authenticated;
grant all on public.configuracoes_site, public.produtos, public.filamento_cores to authenticated;

-- Revogação explícita de qualquer escrita pelo papel anônimo (Anon não acessa dados privados)
revoke insert, update, delete on public.perfis_usuarios from anon;
revoke insert, update, delete on public.clientes from anon;
revoke insert, update, delete on public.orcamentos from anon;
revoke insert, update, delete on public.configuracoes_site from anon;
revoke insert, update, delete on public.produtos from anon;
revoke insert, update, delete on public.filamento_cores from anon;

-- Políticas: CONFIGURAÇÕES DO SITE (Leitura pública, Modificação apenas Operadores/Admins)
drop policy if exists "Público pode ler configurações do site" on public.configuracoes_site;
drop policy if exists "configuracoes_site_select_policy" on public.configuracoes_site;
create policy "configuracoes_site_select_policy"
  on public.configuracoes_site for select
  to anon, authenticated
  using (true);

drop policy if exists "Vendedores autenticados podem alterar configurações do site" on public.configuracoes_site;
drop policy if exists "Vendedores autenticados podem alterar configurações do s" on public.configuracoes_site;
drop policy if exists "configuracoes_site_modify_policy" on public.configuracoes_site;
create policy "configuracoes_site_modify_policy"
  on public.configuracoes_site for all
  to authenticated
  using (public.is_admin_ou_vendedor())
  with check (public.is_admin_ou_vendedor());

-- Políticas: PRODUTOS (Público/Clientes leem produtos ativos, Vendedor/Admin gerencia tudo)
drop policy if exists "Público pode ver produtos ativos" on public.produtos;
drop policy if exists "Vendedores autenticados podem ver todos os produtos" on public.produtos;
drop policy if exists "Apenas administradores autenticados podem alterar produtos" on public.produtos;
drop policy if exists "Visualização de produtos ativos ou catálogo completo por vendedor" on public.produtos;
drop policy if exists "Visualização de produtos ativos ou catálogo completo por ven" on public.produtos;
drop policy if exists "produtos_select_policy" on public.produtos;
create policy "produtos_select_policy"
  on public.produtos for select
  to anon, authenticated
  using (ativo = true or public.is_admin_ou_vendedor());

drop policy if exists "Vendedores autenticados podem inserir produtos" on public.produtos;
drop policy if exists "produtos_insert_policy" on public.produtos;
create policy "produtos_insert_policy"
  on public.produtos for insert
  to authenticated
  with check (public.is_admin_ou_vendedor());

drop policy if exists "Vendedores autenticados podem atualizar produtos" on public.produtos;
drop policy if exists "produtos_update_policy" on public.produtos;
create policy "produtos_update_policy"
  on public.produtos for update
  to authenticated
  using (public.is_admin_ou_vendedor())
  with check (public.is_admin_ou_vendedor());

drop policy if exists "Vendedores autenticados podem deletar produtos" on public.produtos;
drop policy if exists "produtos_delete_policy" on public.produtos;
create policy "produtos_delete_policy"
  on public.produtos for delete
  to authenticated
  using (public.is_admin_ou_vendedor());

-- Políticas: CORES DE FILAMENTOS (Leitura pública ativa, Gerenciamento apenas Vendedor/Admin)
drop policy if exists "Público pode ver cores ativas de filamentos" on public.filamento_cores;
drop policy if exists "filamento_cores_select_policy" on public.filamento_cores;
create policy "filamento_cores_select_policy"
  on public.filamento_cores for select
  to anon, authenticated
  using (ativo = true or public.is_admin_ou_vendedor());

drop policy if exists "Vendedores autenticados podem gerenciar cores" on public.filamento_cores;
drop policy if exists "filamento_cores_all_policy" on public.filamento_cores;
create policy "filamento_cores_all_policy"
  on public.filamento_cores for all
  to authenticated
  using (public.is_admin_ou_vendedor())
  with check (public.is_admin_ou_vendedor());

-- Políticas: PERFIS DE USUÁRIOS (Isolamento por ID do Usuário)
drop policy if exists "Usuários autenticados podem ler perfis" on public.perfis_usuarios;
drop policy if exists "Usuários leem seus próprios perfis ou vendedores leem todos" on public.perfis_usuarios;
drop policy if exists "Usuários leem seus próprios perfis ou vendedores leem tod" on public.perfis_usuarios;
drop policy if exists "perfis_usuarios_select_policy" on public.perfis_usuarios;
create policy "perfis_usuarios_select_policy"
  on public.perfis_usuarios for select
  to authenticated
  using (id = auth.uid() or public.is_admin_ou_vendedor());

drop policy if exists "Usuário autenticado pode atualizar seu próprio perfil" on public.perfis_usuarios;
drop policy if exists "perfis_usuarios_update_policy" on public.perfis_usuarios;
create policy "perfis_usuarios_update_policy"
  on public.perfis_usuarios for update
  to authenticated
  using (id = auth.uid() or public.is_admin_ou_vendedor())
  with check (id = auth.uid() or public.is_admin_ou_vendedor());

-- Políticas: CLIENTES (Isolamento Estrito de Dados Pessoais / LGPD)
drop policy if exists "Apenas vendedores autenticados podem ler clientes" on public.clientes;
drop policy if exists "Clientes leem seus dados e vendedores leem todos" on public.clientes;
drop policy if exists "clientes_select_policy" on public.clientes;
create policy "clientes_select_policy"
  on public.clientes for select
  to authenticated
  using (id = auth.uid()::text or public.is_equipe_interna());

drop policy if exists "Apenas vendedores autenticados podem inserir clientes" on public.clientes;
drop policy if exists "Público e vendedores podem cadastrar clientes" on public.clientes;
drop policy if exists "Cadastro de novos clientes" on public.clientes;
drop policy if exists "clientes_insert_policy" on public.clientes;
create policy "clientes_insert_policy"
  on public.clientes for insert
  to authenticated
  with check (
    (id = auth.uid()::text)
    or public.is_equipe_interna()
  );

drop policy if exists "Apenas vendedores autenticados podem atualizar clientes" on public.clientes;
drop policy if exists "Clientes atualizam seus dados e vendedores atualizam todos" on public.clientes;
drop policy if exists "Clientes atualizam seus dados e vendedores atualizam tod" on public.clientes;
drop policy if exists "clientes_update_policy" on public.clientes;
create policy "clientes_update_policy"
  on public.clientes for update
  to authenticated
  using (id = auth.uid()::text or public.is_equipe_interna())
  with check (id = auth.uid()::text or public.is_equipe_interna());

drop policy if exists "Apenas vendedores autenticados podem excluir clientes" on public.clientes;
drop policy if exists "clientes_delete_policy" on public.clientes;
create policy "clientes_delete_policy"
  on public.clientes for delete
  to authenticated
  using (public.is_admin());

-- Políticas: ORÇAMENTOS (Isolamento de Pedidos e Propostas por Cliente)
drop policy if exists "Apenas vendedores autenticados podem ler orçamentos" on public.orcamentos;
drop policy if exists "Clientes leem seus orçamentos e vendedores leem todos" on public.orcamentos;
drop policy if exists "Clientes leem seus orçamentos e vendedores leem tod" on public.orcamentos;
drop policy if exists "orcamentos_select_policy" on public.orcamentos;
create policy "orcamentos_select_policy"
  on public.orcamentos for select
  to authenticated
  using (cliente_id = auth.uid()::text or public.is_equipe_interna());

drop policy if exists "Apenas vendedores autenticados podem criar orçamentos" on public.orcamentos;
drop policy if exists "Clientes criam seus orçamentos e vendedores criam para todos" on public.orcamentos;
drop policy if exists "Clientes criam seus orçamentos e vendedores criam para tod" on public.orcamentos;
drop policy if exists "orcamentos_insert_policy" on public.orcamentos;
create policy "orcamentos_insert_policy"
  on public.orcamentos for insert
  to authenticated
  with check (
    (cliente_id = auth.uid()::text)
    or public.is_equipe_interna()
  );

drop policy if exists "Apenas vendedores autenticados podem atualizar orçamentos" on public.orcamentos;
drop policy if exists "Clientes atualizam seus orçamentos e vendedores atualizam todos" on public.orcamentos;
drop policy if exists "Clientes atualizam seus orçamentos e vendedores atualizam tod" on public.orcamentos;
drop policy if exists "orcamentos_update_policy" on public.orcamentos;
create policy "orcamentos_update_policy"
  on public.orcamentos for update
  to authenticated
  using (cliente_id = auth.uid()::text or public.is_equipe_interna())
  with check (cliente_id = auth.uid()::text or public.is_equipe_interna());

drop policy if exists "Apenas vendedores autenticados podem excluir orçamentos" on public.orcamentos;
drop policy if exists "orcamentos_delete_policy" on public.orcamentos;
create policy "orcamentos_delete_policy"
  on public.orcamentos for delete
  to authenticated
  using (public.is_admin());

-- ============================================================================
-- 9. STORAGE BUCKETS (PÚBLICO E PRIVADO)
-- ============================================================================
-- 9.1 Bucket Público de Mídias do Catálogo (produtos-midia)
insert into storage.buckets (id, name, public)
values ('produtos-midia', 'produtos-midia', true)
on conflict (id) do nothing;

drop policy if exists "Visualização pública de imagens no bucket produtos-midia" on storage.objects;
drop policy if exists "storage_produtos_midia_select" on storage.objects;
create policy "storage_produtos_midia_select"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'produtos-midia');

drop policy if exists "Upload de imagens por vendedores autenticados" on storage.objects;
drop policy if exists "storage_produtos_midia_insert" on storage.objects;
create policy "storage_produtos_midia_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos-midia' and public.is_equipe_interna());

drop policy if exists "Atualização de imagens por vendedores autenticados" on storage.objects;
drop policy if exists "storage_produtos_midia_update" on storage.objects;
create policy "storage_produtos_midia_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos-midia' and public.is_equipe_interna())
  with check (bucket_id = 'produtos-midia' and public.is_equipe_interna());

drop policy if exists "Exclusão de imagens por vendedores autenticados" on storage.objects;
drop policy if exists "storage_produtos_midia_delete" on storage.objects;
create policy "storage_produtos_midia_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos-midia' and public.is_admin());

-- 9.2 Bucket Privado para Notas Fiscais e Documentos Comerciais (documentos-privados)
insert into storage.buckets (id, name, public)
values ('documentos-privados', 'documentos-privados', false)
on conflict (id) do nothing;

drop policy if exists "storage_doc_privados_select" on storage.objects;
create policy "storage_doc_privados_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos-privados' and public.is_equipe_interna());

drop policy if exists "storage_doc_privados_insert" on storage.objects;
create policy "storage_doc_privados_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos-privados' and public.is_equipe_interna());

drop policy if exists "storage_doc_privados_delete" on storage.objects;
create policy "storage_doc_privados_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documentos-privados' and public.is_admin());

-- ============================================================================
-- 10. TABELA DE AUDITORIA DE SEGURANÇA & LOGS LGPD
-- ============================================================================
create table if not exists public.auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  operacao text not null, -- INSERT | UPDATE | DELETE
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

create or replace function public.gravar_log_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria_logs (
    tabela,
    operacao,
    registro_id,
    usuario_id,
    usuario_email,
    dados_anteriores,
    dados_novos
  ) values (
    TG_TABLE_NAME,
    TG_OP,
    case when TG_OP = 'DELETE' then old.id::text else new.id::text end,
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return null;
end;
$$;

drop trigger if exists trg_audit_clientes on public.clientes;
create trigger trg_audit_clientes
  after insert or update or delete on public.clientes
  for each row execute function public.gravar_log_auditoria();

drop trigger if exists trg_audit_orcamentos on public.orcamentos;
create trigger trg_audit_orcamentos
  after insert or update or delete on public.orcamentos
  for each row execute function public.gravar_log_auditoria();

drop trigger if exists trg_audit_produtos on public.produtos;
create trigger trg_audit_produtos
  after insert or update or delete on public.produtos
  for each row execute function public.gravar_log_auditoria();

-- ============================================================================
-- 11. DADOS INICIAIS DE CONFIGURAÇÃO (SEED INICIAL)
-- ============================================================================
insert into public.configuracoes_site (chave, valor)
values 
  ('loja', '{
    "nome": "LOJA SJ 3D",
    "razaoSocial": "SJ NOVAIS E CIA LTDA",
    "cnpj": "66.275.129/0001-10",
    "whatsapp": "5544991351318",
    "whatsappFormatado": "(44) 99135-1318",
    "endereco": "Avenida Portugal, nº 6759 — Zona 1A, Umuarama - PR",
    "email": "contato@gruposj.com.br"
  }'::jsonb),
  ('banner_promocao', '{
    "ativo": true,
    "estilo": "sorteio",
    "badge": "A MAIOR BLACK FRIDAY DA LOJA SJ",
    "tituloPrincipal": "SORTEIO <em>A1 MINI</em>",
    "subtituloPremio": "+ KIT COM 4 KG DE FILAMENTOS",
    "descricaoCurta": "Compre na Loja SJ 3D em Umuarama - PR e concorra a uma Impressora Bambu Lab A1 Mini!",
    "dataSorteio": "SORTEIO: 20 DE DEZEMBRO (DOMINGO) • LIVE AO VIVO"
  }'::jsonb)
on conflict (chave) do nothing;


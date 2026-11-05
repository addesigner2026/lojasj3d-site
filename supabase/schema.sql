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

-- 2. PERFIS DE VENDEDORES / USUÁRIOS
-- Sincroniza automaticamente com auth.users do Supabase
create table if not exists public.perfis_usuarios (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null unique,
  cargo text not null default 'Vendedor',
  tipo text not null default 'operador', -- operador | admin
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Trigger para criar perfil automaticamente no SignUp via Supabase Auth
create or replace function public.handle_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis_usuarios (id, nome, email, cargo, foto_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'cargo', 'Vendedor'),
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

-- Permissões básicas do Data API para as roles anon e authenticated
grant usage on schema public to anon, authenticated;
grant select on public.configuracoes_site, public.produtos, public.filamento_cores to anon, authenticated;
grant all on public.perfis_usuarios, public.configuracoes_site, public.produtos, public.filamento_cores, public.clientes, public.orcamentos to authenticated;

-- Políticas: CONFIGURAÇÕES DO SITE
drop policy if exists "Público pode ler configurações do site" on public.configuracoes_site;
create policy "Público pode ler configurações do site"
  on public.configuracoes_site for select
  to anon, authenticated
  using (true);

drop policy if exists "Vendedores autenticados podem alterar configurações do site" on public.configuracoes_site;
create policy "Vendedores autenticados podem alterar configurações do site"
  on public.configuracoes_site for all
  to authenticated
  using (true)
  with check (true);

-- Políticas: PRODUTOS (Público lê produtos ativos, Vendedor gerencia tudo)
drop policy if exists "Público pode ver produtos ativos" on public.produtos;
create policy "Público pode ver produtos ativos"
  on public.produtos for select
  to anon, authenticated
  using (ativo = true);

drop policy if exists "Vendedores autenticados podem ver todos os produtos" on public.produtos;
create policy "Vendedores autenticados podem ver todos os produtos"
  on public.produtos for select
  to authenticated
  using (true);

drop policy if exists "Vendedores autenticados podem inserir produtos" on public.produtos;
create policy "Vendedores autenticados podem inserir produtos"
  on public.produtos for insert
  to authenticated
  with check (true);

drop policy if exists "Vendedores autenticados podem atualizar produtos" on public.produtos;
create policy "Vendedores autenticados podem atualizar produtos"
  on public.produtos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Vendedores autenticados podem deletar produtos" on public.produtos;
create policy "Vendedores autenticados podem deletar produtos"
  on public.produtos for delete
  to authenticated
  using (true);

-- Políticas: CORES DE FILAMENTOS
drop policy if exists "Público pode ver cores ativas de filamentos" on public.filamento_cores;
create policy "Público pode ver cores ativas de filamentos"
  on public.filamento_cores for select
  to anon, authenticated
  using (ativo = true);

drop policy if exists "Vendedores autenticados podem gerenciar cores" on public.filamento_cores;
create policy "Vendedores autenticados podem gerenciar cores"
  on public.filamento_cores for all
  to authenticated
  using (true)
  with check (true);

-- Políticas: PERFIS DE USUÁRIOS
drop policy if exists "Usuários autenticados podem ler perfis" on public.perfis_usuarios;
create policy "Usuários autenticados podem ler perfis"
  on public.perfis_usuarios for select
  to authenticated
  using (true);

drop policy if exists "Usuário autenticado pode atualizar seu próprio perfil" on public.perfis_usuarios;
create policy "Usuário autenticado pode atualizar seu próprio perfil"
  on public.perfis_usuarios for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Políticas: CLIENTES (PROTEGIDO — Somente Vendedores Autenticados)
drop policy if exists "Apenas vendedores autenticados podem ler clientes" on public.clientes;
create policy "Apenas vendedores autenticados podem ler clientes"
  on public.clientes for select
  to authenticated
  using (true);

drop policy if exists "Apenas vendedores autenticados podem inserir clientes" on public.clientes;
create policy "Apenas vendedores autenticados podem inserir clientes"
  on public.clientes for insert
  to authenticated
  with check (true);

drop policy if exists "Apenas vendedores autenticados podem atualizar clientes" on public.clientes;
create policy "Apenas vendedores autenticados podem atualizar clientes"
  on public.clientes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Apenas vendedores autenticados podem excluir clientes" on public.clientes;
create policy "Apenas vendedores autenticados podem excluir clientes"
  on public.clientes for delete
  to authenticated
  using (true);

-- Políticas: ORÇAMENTOS (PROTEGIDO — Somente Vendedores Autenticados)
drop policy if exists "Apenas vendedores autenticados podem ler orçamentos" on public.orcamentos;
create policy "Apenas vendedores autenticados podem ler orçamentos"
  on public.orcamentos for select
  to authenticated
  using (true);

drop policy if exists "Apenas vendedores autenticados podem criar orçamentos" on public.orcamentos;
create policy "Apenas vendedores autenticados podem criar orçamentos"
  on public.orcamentos for insert
  to authenticated
  with check (true);

drop policy if exists "Apenas vendedores autenticados podem atualizar orçamentos" on public.orcamentos;
create policy "Apenas vendedores autenticados podem atualizar orçamentos"
  on public.orcamentos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Apenas vendedores autenticados podem excluir orçamentos" on public.orcamentos;
create policy "Apenas vendedores autenticados podem excluir orçamentos"
  on public.orcamentos for delete
  to authenticated
  using (true);

-- ============================================================================
-- 9. STORAGE BUCKET PARA FOTOS DE PRODUTOS E BANNERS (produtos-midia)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('produtos-midia', 'produtos-midia', true)
on conflict (id) do nothing;

drop policy if exists "Visualização pública de imagens no bucket produtos-midia" on storage.objects;
create policy "Visualização pública de imagens no bucket produtos-midia"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'produtos-midia');

drop policy if exists "Upload de imagens por vendedores autenticados" on storage.objects;
create policy "Upload de imagens por vendedores autenticados"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'produtos-midia');

drop policy if exists "Atualização de imagens por vendedores autenticados" on storage.objects;
create policy "Atualização de imagens por vendedores autenticados"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'produtos-midia')
  with check (bucket_id = 'produtos-midia');

drop policy if exists "Exclusão de imagens por vendedores autenticados" on storage.objects;
create policy "Exclusão de imagens por vendedores autenticados"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'produtos-midia');

-- ============================================================================
-- 10. DADOS INICIAIS DE CONFIGURAÇÃO (SEED INICIAL)
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


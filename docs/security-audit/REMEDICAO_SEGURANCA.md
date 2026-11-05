# Registro de Correções e Melhorias de Segurança — Loja SJ 3D

**Data de Aplicação:** 05/11/2026  
**Status:** Todas as 5 categorias de vulnerabilidades corrigidas com sucesso.

---

## 1. Banco Sem Tranca (Supabase RLS & Isolamento de Inquilino)
- **Arquivo modificado:** [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql)
- **Correções implementadas:**
  1. Criação da função de segurança `public.is_admin_ou_vendedor()` com atributo `security definer` e `stable`, validando perfil ativo com tipo `'operador'` ou `'admin'`.
  2. Ajuste do gatilho `handle_novo_usuario()`: novos usuários criados via Supabase Auth agora recebem `tipo = 'cliente'` e `cargo = 'Cliente'` por padrão, impedindo escalação de privilégios no ato do cadastro.
  3. Restrição de escrita em `public.configuracoes_site`, `public.produtos`, `public.filamento_cores` e `storage.objects` (bucket `produtos-midia`), permitindo apenas operadores/administradores autenticados.
  4. Isolamento estrito de `public.clientes`: cada cliente autenticado tem permissão de leitura e edição exclusivamente de sua própria linha (`id = auth.uid()::text`). Vendedores e administradores mantêm visibilidade total para atendimento balcão.
  5. Isolamento estrito de `public.orcamentos`: clientes acessam, criam e atualizam somente propostas vinculadas ao seu `cliente_id = auth.uid()::text`. Vendedores e operadores gerenciam propostas globais.

---

## 2. Permissão Definida no Navegador & Proteção do Backend
- **Arquivo modificado:** [server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/server.js)
- **Correções implementadas:**
  1. Criação do validador de autorização no servidor `verificarAutorizacaoAdmin(req, db)`.
  2. Bloqueio de rotas administrativas mutáveis: `POST /api/catalogo` e `DELETE /api/catalogo` agora exigem privilégios válidos.
  3. Fechamento dos endpoints de backup: `GET /api/db/export` e `POST /api/db/import` agora exigem autorização administrativa.

---

## 3. IDOR (Insecure Direct Object References)
- **Arquivos modificados:** [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql) e [server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/server.js)
- **Correções implementadas:**
  1. No Supabase PostgREST: exclusões (`DELETE`) em `orcamentos` e `clientes` foram restritas a administradores/vendedores. Clientes não podem manipular nem excluir orçamentos de terceiros via API.
  2. No servidor local (`server.js`): `DELETE /api/orcamentos/:id` agora valida autorização antes de realizar a remoção.

---

## 4. Chaves Expostas, Credenciais e Backdoors
- **Arquivos modificados:** [js/database.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/database.js), [server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/server.js), e `.git/config`
- **Correções implementadas:**
  1. **Remoção do backdoor:** Excluído o bloco em `js/database.js` que permitia autenticação imediata e privilégios totais com o e-mail `contato@gruposj.com.br` e senha estática `123456`.
  2. Sanitização da exportação de banco (`GET /api/db/export`): o campo `senhaHash` de todos os usuários é removido antes do envio da resposta JSON.
  3. Sanitização do repositório Git: o token pessoal (PAT) embutido no URL da `origin` em `.git/config` foi substituído pelo endereço padrão limpo `https://github.com/addesigner2026/lojasj3d-site.git`, utilizando o gerenciador de credenciais do sistema (`osxkeychain`).
  4. Padronização de mensagens de erro de autenticação para `"E-mail ou senha incorretos."`, eliminando a enumeração de usuários.

---

## 5. Inputs sem Tratamento (Prevenção contra DOM XSS)
- **Arquivo modificado:** [js/app.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/app.js)
- **Correções implementadas:**
  1. Implementação da função `escaparHtml(str)` para codificação segura de entidades HTML (`&`, `<`, `>`, `"`, `'`).
  2. Implementação do sanitizador `sanitizarHtmlBasico(html)` para remoção de tags `<script>`, handlers inline (`onerror=`, `onload=`) e pseudoprotocolos `javascript:`.
  3. Correção no mecanismo de busca ao vivo (`renderizarSugestoesBuscaAoVivo`): o termo buscado (`termoRaw`) agora é codificado antes de ser injetado no DOM via `innerHTML`.
  4. Endurecimento do componente `mostrarToast`: mensagens textuais passam por sanitização ativa ou atribuição segura via `textContent`.
  5. Proteção de dados na Área do Cliente (`renderizarAreaCliente`): campos cadastrais de perfil (`c.nome`, `c.email`, `c.whatsapp`, `c.cpf`, `c.cidadeUf`) são devidamente escapados antes da renderização no perfil e nos formulários de edição.

---

## Como Aplicar no Supabase da Loja
Para aplicar as novas políticas de segurança no banco de dados de produção do Supabase:
1. Acesse o **Supabase Dashboard** do projeto `tqeifmettwhwngeyzboh`.
2. Vá em **SQL Editor** -> **New query**.
3. Copie e cole todo o conteúdo do arquivo atualizado [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql).
4. Clique em **Run**. Todas as funções e políticas RLS serão recriadas sem perda dos dados existentes.

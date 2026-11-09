# Registro de Correções e Melhorias de Segurança — Loja SJ 3D

**Data da Auditoria e Correções:** 09/11/2026  
**Status:** Todas as 5 categorias de vulnerabilidades corrigidas, validadas e testadas contra novas brechas.

---

## 1. Banco Sem Tranca (Supabase RLS & Isolamento de Inquilino)
- **Arquivo modificado:** [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql)
- **Correções implementadas:**
  1. Criação da função de segurança `public.is_admin_ou_vendedor()` com atributo `security definer` e `stable`, validando perfil ativo com tipo `'operador'` ou `'admin'`.
  2. Ajuste do gatilho `handle_novo_usuario()`: novos usuários criados via Supabase Auth recebem `tipo = 'cliente'` e `cargo = 'Cliente'` por padrão, impedindo escalação de privilégios no ato do cadastro.
  3. Restrição de escrita em `public.configuracoes_site`, `public.produtos`, `public.filamento_cores` e `storage.objects` (bucket `produtos-midia`), permitindo apenas operadores/administradores autenticados.
  4. Isolamento estrito de `public.clientes`: cada cliente autenticado tem permissão de leitura e edição exclusivamente de sua própria linha (`id = auth.uid()::text`). Vendedores e administradores mantêm visibilidade total para atendimento balcão. Na inserção, clientes anônimos só podem gerar IDs com prefixo de lead (`cli-%`).
  5. Isolamento estrito de `public.orcamentos`: clientes acessam, criam e atualizam somente propostas vinculadas ao seu `cliente_id = auth.uid()::text`. Vendedores e operadores gerenciam propostas globais.

---

## 2. Permissão Definida no Navegador & Proteção do Backend
- **Arquivo modificado:** [scripts/local-server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/scripts/local-server.js)
- **Correções implementadas:**
  1. Criação do validador de autorização no servidor `verificarAutorizacaoAdmin(req, db)`.
  2. **Eliminação do bypass de localhost:** Removida a checagem insegura de cabeçalhos `Host`/`Origin`/`Referer` que concedia acesso administrativo irrestrito em conexões locais.
  3. Proteção nas rotas de listagem: `GET /api/orcamentos` agora só retorna orçamentos pertencentes ao cliente autenticado (ou todos se for administrador). `GET /api/clientes` e `GET /api/auth/users` são restritos a operadores/administradores com token válido.
  4. Bloqueio de rotas administrativas mutáveis: `POST /api/catalogo` e `DELETE /api/catalogo` exigem privilégios válidos.
  5. Fechamento dos endpoints de backup: `GET /api/db/export` e `POST /api/db/import` exigem autorização administrativa explícita.

---

## 3. IDOR (Insecure Direct Object References)
- **Arquivos modificados:** [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql) e [scripts/local-server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/scripts/local-server.js)
- **Correções implementadas:**
  1. No Supabase PostgREST: exclusões (`DELETE`) em `orcamentos` e `clientes` foram restritas a administradores/vendedores. Clientes não podem manipular nem excluir orçamentos de terceiros via API.
  2. No servidor local (`scripts/local-server.js`):
     - `POST /api/orcamentos`: validação estrita de posse para atualização de propostas existentes. Apenas o cliente proprietário do orçamento ou administradores podem sobrescrever um registro.
     - `POST /api/clientes`: validação estrita ao atualizar dados cadastrais de clientes existentes, impedindo que chamadas anônimas substituam registros de terceiros.
     - `DELETE /api/orcamentos/:id` e `PATCH /api/orcamentos/:id/status` exigem validação de autorização antes de realizar a remoção ou modificação de status.

---

## 4. Chaves Expostas, Credenciais e Backdoors
- **Arquivos modificados:** [js/database.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/database.js), [scripts/local-server.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/scripts/local-server.js), [data/db.json](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/data/db.json) e `.git/config`
- **Correções implementadas:**
  1. **Remoção do backdoor e senhas em texto puro:** Removida a senha fixa `@Metallica1984` do código em [js/database.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/database.js). Implementada função utilitária `hashSenha` via Web Crypto API (SHA-256) no navegador e `gerarHashSenha` (crypto nativo) no servidor.
  2. Senhas armazenadas no banco local [data/db.json](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/data/db.json) migradas de texto plano para hash SHA-256.
  3. Validação de startup de segredo em produção: `scripts/local-server.js` aborta a inicialização se `SJ_ADMIN_KEY` não for configurada em ambiente de produção, evitando o uso de defaults públicos.
  4. Sanitização da exportação de banco (`GET /api/db/export`): o campo `senhaHash` de todos os usuários é removido antes do envio da resposta JSON.
  5. **Sanitização do repositório Git:** O token pessoal (PAT) embutido no URL da `origin` em `.git/config` foi removido e substituído pela URL limpa padrão `https://github.com/addesigner2026/lojasj3d-site.git`.
  6. Padronização de mensagens de erro de autenticação para `"E-mail ou senha incorretos."`, eliminando a enumeração de usuários.

---

## 5. Inputs sem Tratamento, Uploads e Sanitização
- **Arquivos modificados:** [js/app.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/app.js) e [js/database.js](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/js/database.js)
- **Correções implementadas:**
  1. **Validação estrita de upload de imagem:** A função `comprimirImagemUpload` agora valida o tipo MIME (`image/jpeg`, `image/png`, `image/webp`), limita o tamanho máximo em 8 MB e rejeita arquivos SVG ou não-renderizáveis.
  2. **Proteção contra DoS e Prototype Pollution no backup:** A importação de backup (`input-backup-import` e `importarJson`) agora limita o tamanho em 5 MB, rejeita chaves perigosas (`__proto__`, `constructor`, `prototype`) e sanitiza as propriedades antes de gravar nas tabelas.
  3. Implementação da função `escaparHtml(str)` para codificação segura de entidades HTML (`&`, `<`, `>`, `"`, `'`).
  4. Implementação do sanitizador `sanitizarHtmlBasico(html)` para remoção de tags `<script>`, handlers inline (`onerror=`, `onload=`) e pseudoprotocolos `javascript:`.
  5. Correção no mecanismo de busca ao vivo (`renderizarSugestoesBuscaAoVivo`): o termo buscado (`termoRaw`) é codificado antes de ser injetado no DOM via `innerHTML`.
  6. Endurecimento do componente `mostrarToast`: mensagens textuais passam por sanitização ativa ou atribuição segura via `textContent`.
  7. Proteção de dados na Área do Cliente (`renderizarAreaCliente`): campos cadastrais de perfil (`c.nome`, `c.email`, `c.whatsapp`, `c.cpf`, `c.cidadeUf`) e avatar (`fotoSegura`, validando estritamente URLs `https://`, `http://` ou `data:image/`) são devidamente filtrados e escapados antes da renderização no DOM.

---

## Como Aplicar no Supabase da Loja
Para aplicar as novas políticas de segurança no banco de dados de produção do Supabase:
1. Acesse o **Supabase Dashboard** do projeto `tqeifmettwhwngeyzboh`.
2. Vá em **SQL Editor** -> **New query**.
3. Copie e cole todo o conteúdo do arquivo atualizado [supabase/schema.sql](file:///Users/ThiagoeSheila/Library/Mobile%20Documents/com~apple~CloudDocs/Antigravity/Site/supabase/schema.sql).
4. Clique em **Run**. Todas as funções e políticas RLS serão recriadas sem perda dos dados existentes.

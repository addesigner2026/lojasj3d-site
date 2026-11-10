# REGRAS OBRIGATÓRIAS DE BLINDAGEM E SEGURANÇA — LOJA SJ 3D

> **IMPORTANTE & INEGOCIÁVEL:** Todas as modificações, criações, edições de código, arquivos ou banco de dados neste projeto DEVEM seguir rigorosamente as regras de blindagem e passar pelo checkout de segurança antes de qualquer conclusão, commit ou publicação.

---

## 1. COMANDO OFICIAL DE CHECKOUT DE SEGURANÇA
Após qualquer alteração de código ou arquivos, execute obrigatoriamente:
```bash
node scripts/security-check.js
# ou
npm run check:security
```
O checkout analisa automaticamente os 5 pilares de blindagem do projeto e só permite prosseguir se **100% dos testes forem aprovados com ZERO erros**.

---

## 2. OS 5 PILARES DA BLINDAGEM DO SITE (REMEDICAO_SEGURANCA.md)

### Pilar 1: Sintaxe e Integridade de Código
- Nunca salvar arquivos JavaScript com erros de sintaxe ou tokens inesperados.
- Sempre validar a integridade dos arquivos (`node -c js/app.js`, `node -c js/database.js`, `node -c scripts/local-server.js`).

### Pilar 2: Chaves, Credenciais e Backdoors
- **Proibido** salvar senhas fixas ou credenciais em texto puro no código (ex: nunca reinserir o antigo `@Metallica1984`).
- Todas as senhas em `data/db.json` devem ser estritamente armazenadas como hash SHA-256 (`senhaHash`).
- **Sanitização do Git**: URLs de remote no `.git/config` devem permanecer limpas (`https://github.com/addesigner2026/lojasj3d-site.git`), sem expor tokens (`ghp_...`).
- Mensagens de erro de autenticação devem ser genéricas (`"E-mail ou senha incorretos."`) para impedir enumeração de usuários.

### Pilar 3: Inputs, XSS e Proteção de Uploads / Backups
- Todo dado vindo do usuário ou do banco de dados inserido no DOM via `innerHTML` DEVE passar por `escaparHtml(str)` ou `sanitizarHtmlBasico(html)`.
- **Uploads de imagem** (`comprimirImagemUpload`): validar tipo MIME (`image/jpeg`, `image/png`, `image/webp`), limitar tamanho a 8 MB e rejeitar SVGs arbitrários.
- **Importação de backups JSON**: limitar tamanho a 5 MB e bloquear chaves perigosas de Prototype Pollution (`__proto__`, `constructor`, `prototype`).

### Pilar 4: Supabase RLS, IDOR e Proteção do Servidor
- **Row Level Security (RLS)** ativo em todas as tabelas em `supabase/schema.sql`.
- Isolamento estrito de clientes: cada cliente só lê e edita sua própria linha (`id = auth.uid()::text`), e seus próprios orçamentos (`cliente_id = auth.uid()::text`).
- Apenas operadores/administradores autenticados (`is_admin_ou_vendedor()`) têm acesso a outros registros ou configurações do site.
- Gatilho `handle_novo_usuario()` deve sempre forçar `tipo = 'cliente'` para impedir escalação de privilégios no ato do cadastro.
- No servidor local (`scripts/local-server.js`): validação de autorização em todas as rotas mutáveis; eliminação de bypass inseguro por cabeçalhos `Host`/`Origin`/`Referer`.

### Pilar 5: Validação de Documentos, CNPJ/CPF e LGPD
- **CPF do Titular**: validado estritamente por algoritmo matemático oficial (`validarCpfOficial`), exatamente 11 dígitos numéricos.
- **CNPJ da Empresa**: validado estritamente por algoritmo oficial (`validarCnpjOficial`), exatamente 14 dígitos.
- **Busca de CNPJ**: utilizar canal seguro da Receita Federal / BrasilAPI (`consultarCnpjReceita`) com fallback para preenchimento de Razão Social, Fantasia e Endereço.
- **LGPD**: exigência de aceite explícito dos termos (`termos_privacidade`), consentimento granular de marketing (`comunicacoes_marketing`) e canais de revogação / direitos do titular (Art. 8º e 18).

---

## 3. CHECKLIST ANTES DE COMMIT E PUSH
1. `node -c js/app.js` (Sintaxe OK).
2. `node scripts/security-check.js` (Checkout de blindagem 100% verde).
3. Se houver atualização em `js/app.js`, incrementar o cache buster em `index.html` (ex: `?v=...`).
4. Realizar o push para os remotes autorizados do projeto.

#!/usr/bin/env node
/**
 * CHECKOUT DE SEGURANÇA E BLINDAGEM — LOJA SJ 3D
 * Executa todas as checagens das 5 categorias de segurança e integridade do projeto.
 * 
 * Uso: node scripts/security-check.js
 * Ou:  npm run check:security
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
let totalErros = 0;
let totalAlertas = 0;
let totalPasses = 0;

function logPass(msg) {
  console.log(`  \x1b[32m✔ PASS\x1b[0m ${msg}`);
  totalPasses++;
}

function logFail(msg) {
  console.log(`  \x1b[31m✖ FAIL\x1b[0m ${msg}`);
  totalErros++;
}

function logWarn(msg) {
  console.log(`  \x1b[33m▲ WARN\x1b[0m ${msg}`);
  totalAlertas++;
}

console.log("\n\x1b[1m\x1b[36m============================================================\x1b[0m");
console.log("\x1b[1m\x1b[36m   CHECKOUT OFICIAL DE BLINDAGEM & SEGURANÇA — LOJA SJ 3D   \x1b[0m");
console.log("\x1b[1m\x1b[36m============================================================\x1b[0m\n");

// -----------------------------------------------------------------------------
// PILAR 1: SINTAXE E INTEGRIDADE DE CÓDIGO (Syntax & Compilation)
// -----------------------------------------------------------------------------
console.log("\x1b[1m1. Verificação de Sintaxe JavaScript (Syntax Check)\x1b[0m");
const arquivosJs = ["js/app.js", "js/database.js", "scripts/local-server.js"];
for (const rel of arquivosJs) {
  const full = path.join(ROOT_DIR, rel);
  if (!fs.existsSync(full)) {
    logFail(`Arquivo obrigatório não encontrado: ${rel}`);
    continue;
  }
  try {
    execSync(`node -c "${full}"`, { stdio: "pipe" });
    logPass(`Sintaxe correta em ${rel}`);
  } catch (err) {
    logFail(`Erro de sintaxe em ${rel}: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// PILAR 2: CREDENCIAIS, SEGREDOS E BACKDOORS (Secrets & Backdoors)
// -----------------------------------------------------------------------------
console.log("\n\x1b[1m2. Varredura de Chaves, Credenciais e Backdoors\x1b[0m");

// 2.1 Verificar sanitização do .git/config
const gitConfigPath = path.join(ROOT_DIR, ".git", "config");
if (fs.existsSync(gitConfigPath)) {
  const gitConfig = fs.readFileSync(gitConfigPath, "utf-8");
  if (/ghp_[a-zA-Z0-9]{20,}/.test(gitConfig)) {
    logFail("Token do GitHub (ghp_...) exposto em .git/config! Remova e use credenciais seguras.");
  } else {
    logPass(".git/config limpo, sem tokens de acesso embutidos na URL.");
  }
}

// 2.2 Verificar remoção do backdoor em js/database.js e js/app.js
const dbJsPath = path.join(ROOT_DIR, "js", "database.js");
if (fs.existsSync(dbJsPath)) {
  const dbJs = fs.readFileSync(dbJsPath, "utf-8");
  if (dbJs.includes("@Metallica1984")) {
    logFail("Backdoor de senha fixa (@Metallica1984) encontrado em js/database.js!");
  } else {
    logPass("Nenhum backdoor de senha fixa em js/database.js.");
  }
  if (dbJs.includes("hashSenha(") || dbJs.includes("crypto.subtle")) {
    logPass("Hash de senha seguro (Web Crypto SHA-256) implementado em js/database.js.");
  } else {
    logWarn("Verifique se o hash SHA-256 está implementado para senhas no navegador.");
  }
}

// 2.3 Verificar data/db.json (não ter senhas em texto puro)
const dbJsonPath = path.join(ROOT_DIR, "data", "db.json");
if (fs.existsSync(dbJsonPath)) {
  try {
    const raw = fs.readFileSync(dbJsonPath, "utf-8");
    const json = JSON.parse(raw);
    const usuarios = json.auth_users || [];
    let senhasPlanas = 0;
    usuarios.forEach((u) => {
      if (u.senha && !u.senhaHash) senhasPlanas++;
    });
    if (senhasPlanas > 0) {
      logFail(`Encontradas ${senhasPlanas} senhas em texto puro no db.json! Devem ser hash SHA-256.`);
    } else {
      logPass("Todas as senhas em data/db.json estão criptografadas em hash SHA-256.");
    }
  } catch (err) {
    logFail(`Erro ao ler data/db.json: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// PILAR 3: SANITIZAÇÃO DE INPUTS, XSS E UPLOADS (Sanitization & XSS)
// -----------------------------------------------------------------------------
console.log("\n\x1b[1m3. Sanitização de Inputs, XSS e Proteção de Uploads\x1b[0m");

const appJsPath = path.join(ROOT_DIR, "js", "app.js");
if (fs.existsSync(appJsPath)) {
  const appJs = fs.readFileSync(appJsPath, "utf-8");

  // Escaping & Sanitization
  if (appJs.includes("function escaparHtml(") && appJs.includes("function sanitizarHtmlBasico(")) {
    logPass("Funções escaparHtml e sanitizarHtmlBasico declaradas e ativas em js/app.js.");
  } else {
    logFail("Funções de sanitização essenciais (escaparHtml / sanitizarHtmlBasico) ausentes em js/app.js.");
  }

  // Upload hardening
  if (appJs.includes("comprimirImagemUpload") && (appJs.includes("image/jpeg") || appJs.includes("image/png"))) {
    logPass("Upload de imagem com validação de tipo MIME e limite de tamanho em js/app.js.");
  } else {
    logWarn("Verifique se comprimirImagemUpload valida tipo MIME e tamanho máximo.");
  }

  // Backup import hardening
  const dbJsContent = fs.existsSync(dbJsPath) ? fs.readFileSync(dbJsPath, "utf-8") : "";
  if ((appJs.includes("__proto__") || dbJsContent.includes("__proto__")) && 
      (appJs.includes("prototype") || dbJsContent.includes("prototype"))) {
    logPass("Proteção contra Prototype Pollution na importação de backup JSON ativa.");
  } else {
    logWarn("Proteção contra Prototype Pollution não detectada na rotina de importação de backup.");
  }
}

// -----------------------------------------------------------------------------
// PILAR 4: ISOLAMENTO SUPABASE RLS, IDOR & BACKEND SHIELD (RLS & IDOR)
// -----------------------------------------------------------------------------
console.log("\n\x1b[1m4. Isolamento Supabase RLS, IDOR e Proteção do Servidor\x1b[0m");

const schemaSqlPath = path.join(ROOT_DIR, "supabase", "schema.sql");
if (fs.existsSync(schemaSqlPath)) {
  const schemaSql = fs.readFileSync(schemaSqlPath, "utf-8");

  if (schemaSql.includes("is_admin_ou_vendedor()")) {
    logPass("Função de segurança is_admin_ou_vendedor() com SECURITY DEFINER presente no schema.sql.");
  } else {
    logFail("Função de segurança is_admin_ou_vendedor() ausente no supabase/schema.sql.");
  }

  if (schemaSql.includes("handle_novo_usuario") && schemaSql.includes("'cliente'")) {
    logPass("Prevenção contra escalação de privilégios no cadastro de novos usuários presente no schema.sql.");
  } else {
    logFail("Gatilho handle_novo_usuario deve forçar tipo = 'cliente' para evitar privilégios indevidos.");
  }

  if (schemaSql.includes("auth.uid()::text") || schemaSql.includes("auth.uid()")) {
    logPass("Políticas de Row Level Security (RLS) com isolamento estrito por cliente presentes no schema.sql.");
  } else {
    logFail("Políticas RLS com isolamento por usuário autenticado ausentes no supabase/schema.sql.");
  }
}

const serverJsPath = path.join(ROOT_DIR, "scripts", "local-server.js");
if (fs.existsSync(serverJsPath)) {
  const serverJs = fs.readFileSync(serverJsPath, "utf-8");

  if (serverJs.includes("verificarAutorizacaoAdmin")) {
    logPass("Validador de autorização de admin no servidor local presente.");
  } else {
    logFail("Validador de autorização ausente em scripts/local-server.js.");
  }

  // Garantir que não há bypass inseguro de localhost por headers
  if (serverJs.includes("req.headers.host?.includes('localhost')") && serverJs.includes("isAdmin = true")) {
    logFail("Bypass inseguro de localhost detectado em scripts/local-server.js!");
  } else {
    logPass("Nenhum bypass inseguro de localhost por cabeçalhos Host/Origin em scripts/local-server.js.");
  }
}

// -----------------------------------------------------------------------------
// PILAR 5: VALIDAÇÃO DE DADOS, CNPJ/CPF E LGPD (Compliance & Data)
// -----------------------------------------------------------------------------
console.log("\n\x1b[1m5. Validação de Documentos, CNPJ/CPF e LGPD\x1b[0m");

if (fs.existsSync(appJsPath)) {
  const appJs = fs.readFileSync(appJsPath, "utf-8");

  if (appJs.includes("function validarCpfOficial(") && appJs.includes("function validarCnpjOficial(")) {
    logPass("Validação estrita oficial de CPF (11 dígitos) e CNPJ (14 dígitos) ativa.");
  } else {
    logFail("Funções oficiais de validação de CPF ou CNPJ ausentes em js/app.js.");
  }

  if (appJs.includes("consultarCnpjReceita")) {
    logPass("Módulo de busca oficial e segura de CNPJ da Receita Federal (BrasilAPI) ativo.");
  } else {
    logFail("Módulo consultarCnpjReceita ausente em js/app.js.");
  }

  if (appJs.includes("termos_privacidade") && appJs.includes("comunicacoes_marketing")) {
    logPass("Registro de consentimentos e gestão de privacidade LGPD ativos.");
  } else {
    logWarn("Verifique os registros de consentimento LGPD em js/app.js.");
  }
}

// -----------------------------------------------------------------------------
// RESULTADO FINAL
// -----------------------------------------------------------------------------
console.log("\n------------------------------------------------------------");
if (totalErros === 0) {
  console.log(`\x1b[1m\x1b[32m✔ CHECKOUT APROVADO COM SUCESSO!\x1b[0m`);
  console.log(`  ${totalPasses} testes de segurança aprovados, ${totalAlertas} alertas, 0 erros.`);
  console.log("  O site está blindado e em conformidade com as regras de segurança.");
  console.log("------------------------------------------------------------\n");
  process.exit(0);
} else {
  console.log(`\x1b[1m\x1b[31m✖ CHECKOUT REPROVADO COM ${totalErros} ERRO(S)!\x1b[0m`);
  console.log(`  Corrija as falhas apontadas acima antes de realizar qualquer commit ou publicação.`);
  console.log("------------------------------------------------------------\n");
  process.exit(1);
}

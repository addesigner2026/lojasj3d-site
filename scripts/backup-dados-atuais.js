#!/usr/bin/env node
/**
 * SCRIPT DE BACKUP & EXPORTAÇÃO SEGURA — LOJA SJ 3D
 * =====================================================================
 * Exporta um snapshot completo antes de qualquer alteração no banco:
 * - Catálogo estático atual (34 produtos + 132 cores de filamentos de js/dados.js)
 * - Banco local atual (data/db.json: usuários, clientes, orçamentos)
 * - Configurações públicas atuais no Supabase (configuracoes_site)
 *
 * Uso: node scripts/backup-dados-atuais.js
 * Saída: backups/backup-lojasj3d-<timestamp>.json (ignorado no .gitignore)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, "backups");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

async function exportar() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 1) Carrega catálogo de js/dados.js
  global.window = {};
  require(path.join(ROOT, "js", "dados.js"));
  const siteData = global.window.SITE_DATA || {};

  // 2) Carrega data/db.json (se existir)
  let dbLocal = null;
  const dbPath = path.join(ROOT, "data", "db.json");
  if (fs.existsSync(dbPath)) {
    try {
      dbLocal = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch (e) {
      console.warn("[BACKUP] Aviso ao ler data/db.json:", e.message);
    }
  }

  // 3) Tenta capturar snapshot das tabelas públicas do Supabase (somente leitura)
  const supabaseSnapshot = {
    capturadoEm: new Date().toISOString(),
    configuracoes_site: null,
    produtos: null,
    filamento_cores: null
  };

  if (typeof fetch === "function") {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    };
    for (const tabela of ["configuracoes_site", "produtos", "filamento_cores"]) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?select=*`, { headers });
        if (res.ok) {
          supabaseSnapshot[tabela] = await res.json();
        }
      } catch (_) {
        supabaseSnapshot[tabela] = "offline_ou_indisponivel";
      }
    }
  }

  const paletas = ["coresBambuLab", "coresMaxPrint", "coresPlaSilk", "coresPetg", "coresTpu", "coresAbsEspeciais"];
  const totalCores = paletas.reduce((acc, k) => acc + (Array.isArray(siteData[k]) ? siteData[k].length : 0), 0);

  const backup = {
    meta: {
      geradoEm: new Date().toISOString(),
      versao: "pre-refactor-supabase-auth-v1",
      resumo: {
        produtosDadosJs: (siteData.catalogo || []).length,
        coresFilamentosDadosJs: totalCores,
        usuariosLocal: dbLocal && Array.isArray(dbLocal.usuarios) ? dbLocal.usuarios.length : 0,
        clientesLocal: dbLocal && Array.isArray(dbLocal.clientes) ? dbLocal.clientes.length : 0,
        orcamentosLocal: dbLocal && Array.isArray(dbLocal.orcamentos) ? dbLocal.orcamentos.length : 0,
        chavesSupabaseConfig: Array.isArray(supabaseSnapshot.configuracoes_site)
          ? supabaseSnapshot.configuracoes_site.map((r) => r.chave)
          : []
      }
    },
    dadosJs: siteData,
    dbLocal,
    supabaseSnapshot
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(BACKUP_DIR, `backup-lojasj3d-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), "utf8");

  console.log("✅ Backup completo salvo com sucesso em:", outFile);
  console.log("📊 Resumo:", JSON.stringify(backup.meta.resumo, null, 2));
}

exportar().catch((err) => {
  console.error("❌ Erro ao gerar backup:", err);
  process.exit(1);
});

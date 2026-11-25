/**
 * MÓDULO CENTRAL DE SEGURANÇA PARA API ROUTES (VERCEL SERVERLESS)
 * =================================================================
 * - CORS restrito estritamente aos domínios oficiais da Loja SJ 3D
 * - Headers de segurança obrigatórios em toda resposta
 * - Rate limiting por IP + rota (janela deslizante em memória)
 * - Validação server-side de JWT no Supabase Auth + verificação de papel/status
 *   em public.profiles (nunca confia em cabeçalhos forjados pelo navegador)
 * - Parser JSON protegido contra Prototype Pollution e payloads gigantes
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const ALLOWED_ORIGINS = new Set([
  "https://www.lojasj3d.com.br",
  "https://lojasj3d.com.br"
]);

if (process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production") {
  ALLOWED_ORIGINS.add("http://localhost:3000");
  ALLOWED_ORIGINS.add("http://127.0.0.1:3000");
}

const rateBuckets = new Map();

function getClientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

function aplicarHeadersSeguranca(req, res, methods = "GET, POST, OPTIONS") {
  const origin = String(req.headers.origin || "").trim();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function checarRateLimit(req, res, rota, maxReqs = 30, janelaMs = 60 * 1000) {
  const ip = getClientIp(req);
  const chave = `${rota}:${ip}`;
  const agora = Date.now();
  let lista = rateBuckets.get(chave) || [];
  lista = lista.filter((ts) => agora - ts < janelaMs);
  if (lista.length >= maxReqs) {
    res.setHeader("Retry-After", String(Math.ceil(janelaMs / 1000)));
    sendJson(res, 429, {
      sucesso: false,
      mensagem: "Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente."
    });
    return false;
  }
  lista.push(agora);
  rateBuckets.set(chave, lista);
  if (rateBuckets.size > 2000) {
    const primeira = rateBuckets.keys().next().value;
    if (primeira) rateBuckets.delete(primeira);
  }
  return true;
}

async function parseJsonSeguro(req, maxBytes = 2 * 1024 * 1024) {
  const contemChavePerigosa = (str) =>
    str.includes('"__proto__"') || str.includes('"constructor"') || str.includes('"prototype"');

  if (req.body && typeof req.body === "object") {
    const txt = JSON.stringify(req.body);
    if (txt.length > maxBytes || contemChavePerigosa(txt)) return null;
    return req.body;
  }
  if (typeof req.body === "string") {
    if (req.body.length > maxBytes || contemChavePerigosa(req.body)) return null;
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return null;
    }
  }
  return new Promise((resolve) => {
    let data = "";
    let exceeded = false;
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > maxBytes) exceeded = true;
    });
    req.on("end", () => {
      if (exceeded || contemChavePerigosa(data)) return resolve(null);
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (_) {
        resolve(null);
      }
    });
  });
}

async function validarUsuarioJwt(req, { rolesPermitidos = ["admin", "staff"] } = {}) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (
    !authHeader.toLowerCase().startsWith("bearer ") ||
    authHeader.length < 40 ||
    authHeader.includes(SUPABASE_ANON_KEY)
  ) {
    return { ok: false, status: 401, mensagem: "Autenticação obrigatória." };
  }

  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meRes.ok) {
      return { ok: false, status: 401, mensagem: "Sessão expirada ou inválida." };
    }
    const user = await meRes.json();
    if (!user || !user.id) {
      return { ok: false, status: 401, mensagem: "Usuário não autenticado." };
    }

    const checkKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const checkAuth = SUPABASE_SERVICE_ROLE_KEY ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` : authHeader;
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role,status`,
      { headers: { apikey: checkKey, Authorization: checkAuth } }
    );
    const profRows = profRes.ok ? await profRes.json() : [];
    const profile = Array.isArray(profRows) ? profRows[0] : null;

    if (!profile || profile.status !== "approved" || !rolesPermitidos.includes(profile.role)) {
      return { ok: false, status: 403, mensagem: "Acesso negado para este perfil." };
    }

    return {
      ok: true,
      user,
      profile,
      authHeader,
      writeHeaders: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      }
    };
  } catch (_) {
    return { ok: false, status: 500, mensagem: "Erro ao validar credenciais." };
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro,
  validarUsuarioJwt
};

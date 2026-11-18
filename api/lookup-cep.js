/**
 * ENDPOINT SERVER-SIDE DE CONSULTA DE CEP — LOJA SJ 3D
 * ============================================================================
 * - Exige usuário autenticado (valida JWT direto no Supabase Auth).
 * - Aplica rate limiting por usuário e por IP.
 * - Consulta ViaCEP (principal) com fallback BrasilAPI CEP, evitando expor CSP.
 */

const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQ = 25;

function verificarRateLimit(chave) {
  const agora = Date.now();
  const item = rateBucket.get(chave) || { count: 0, resetAt: agora + RATE_WINDOW_MS };
  if (agora > item.resetAt) {
    item.count = 0;
    item.resetAt = agora + RATE_WINDOW_MS;
  }
  item.count += 1;
  rateBucket.set(chave, item);
  if (rateBucket.size > 2000) rateBucket.clear();
  return item.count <= RATE_MAX_REQ;
}

async function fetchComTimeout(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "LojaSJ3D-Server/1.0" }
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ sucesso: false, mensagem: "Método não permitido." });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ") || authHeader.length < 40) {
    return res.status(401).json({ sucesso: false, mensagem: "Autenticação obrigatória para consultar CEP." });
  }

  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meRes.ok) {
      return res.status(401).json({ sucesso: false, mensagem: "Sessão expirada." });
    }
    const meUser = await meRes.json();
    if (!meUser?.id) {
      return res.status(401).json({ sucesso: false, mensagem: "Usuário não autenticado." });
    }

    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
    if (!verificarRateLimit(`u:${meUser.id}`) || (ip && !verificarRateLimit(`ip:${ip}`))) {
      return res.status(429).json({ sucesso: false, mensagem: "Muitas consultas de CEP. Aguarde 1 minuto." });
    }

    const digits = String(req.query?.cep || "").replace(/\D/g, "");
    if (digits.length !== 8) {
      return res.status(400).json({ sucesso: false, mensagem: "CEP inválido. Informe 8 números." });
    }

    try {
      const r1 = await fetchComTimeout(`https://viacep.com.br/ws/${digits}/json/`);
      if (r1.ok) {
        const d = await r1.json();
        if (d && !d.erro) {
          return res.status(200).json({
            sucesso: true,
            dados: {
              cep: digits,
              logradouro: String(d.logradouro || "").trim(),
              complemento: String(d.complemento || "").trim(),
              bairro: String(d.bairro || "").trim(),
              cidade: String(d.localidade || "").trim(),
              uf: String(d.uf || "").trim().toUpperCase()
            }
          });
        }
      }
    } catch (_) {}

    try {
      const r2 = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v1/${digits}`);
      if (r2.ok) {
        const d2 = await r2.json();
        return res.status(200).json({
          sucesso: true,
          dados: {
            cep: digits,
            logradouro: String(d2.street || "").trim(),
            complemento: "",
            bairro: String(d2.neighborhood || "").trim(),
            cidade: String(d2.city || "").trim(),
            uf: String(d2.state || "").trim().toUpperCase()
          }
        });
      }
    } catch (_) {}

    return res.status(404).json({
      sucesso: false,
      mensagem: "CEP não encontrado. Preencha o endereço manualmente."
    });
  } catch (_) {
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao consultar CEP. Preencha manualmente."
    });
  }
};

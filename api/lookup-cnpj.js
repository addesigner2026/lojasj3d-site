/**
 * ENDPOINT SERVER-SIDE DE CONSULTA DE CNPJ — LOJA SJ 3D
 * ============================================================================
 * - Exige usuário autenticado (valida JWT direto no Supabase Auth).
 * - Valida formato (14 dígitos) e dígitos verificadores ANTES de consultar API externa.
 * - Aplica rate limiting por usuário e por IP.
 * - Consulta BrasilAPI (principal) com fallback para ReceitaWS / MinhaReceita.
 * - NUNCA registra CNPJ ou dados pessoais em logs.
 */

const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQ = 15;

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

function validarCnpjOficial(digits) {
  if (!digits || digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  if (d1 !== Number(digits[12])) return false;
  const d2 = calc(digits.slice(0, 13), w2);
  return d2 === Number(digits[13]);
}

function formatarTelefoneBR(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return "";
}

async function fetchComTimeout(url, timeoutMs = 7000) {
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
    return res.status(401).json({ sucesso: false, mensagem: "Autenticação obrigatória para consultar CNPJ." });
  }

  try {
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meRes.ok) {
      return res.status(401).json({ sucesso: false, mensagem: "Sessão expirada. Entre novamente." });
    }
    const meUser = await meRes.json();
    if (!meUser?.id) {
      return res.status(401).json({ sucesso: false, mensagem: "Usuário não autenticado." });
    }

    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
    if (!verificarRateLimit(`u:${meUser.id}`) || (ip && !verificarRateLimit(`ip:${ip}`))) {
      return res.status(429).json({ sucesso: false, mensagem: "Muitas consultas em seguida. Aguarde 1 minuto e tente novamente." });
    }

    let rawCnpj = req.query?.cnpj || "";
    if (!rawCnpj && req.method === "POST") {
      const body = await new Promise((resolve) => {
        if (req.body && typeof req.body === "object") return resolve(req.body);
        let raw = "";
        req.on("data", (c) => { raw += c; });
        req.on("end", () => {
          try { resolve(JSON.parse(raw || "{}")); } catch (_) { resolve({}); }
        });
      });
      rawCnpj = body.cnpj || "";
    }

    const digits = String(rawCnpj || "").replace(/\D/g, "");
    if (!validarCnpjOficial(digits)) {
      return res.status(400).json({ sucesso: false, mensagem: "CNPJ inválido. Confira os 14 números informados." });
    }

    // 1. Provedor principal: BrasilAPI
    try {
      const r1 = await fetchComTimeout(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (r1.ok) {
        const d = await r1.json();
        const situacao = String(d.descricao_situacao_cadastral || "ATIVA").trim().toUpperCase();
        const tipoLog = d.descricao_tipo_de_logradouro ? `${d.descricao_tipo_de_logradouro} ` : "";
        return res.status(200).json({
          sucesso: true,
          dados: {
            cnpj: digits,
            razao_social: String(d.razao_social || "").trim(),
            nome_fantasia: String(d.nome_fantasia || "").trim(),
            situacao_cadastral: situacao,
            ativa: situacao === "ATIVA",
            cep: String(d.cep || "").replace(/\D/g, ""),
            logradouro: `${tipoLog}${d.logradouro || ""}`.trim(),
            numero: String(d.numero || "").trim(),
            complemento: String(d.complemento || "").trim(),
            bairro: String(d.bairro || "").trim(),
            cidade: String(d.municipio || "").trim(),
            uf: String(d.uf || "").trim().toUpperCase(),
            telefone: formatarTelefoneBR(d.ddd_telefone_1 || ""),
            email: String(d.email || "").trim().toLowerCase()
          }
        });
      }
    } catch (_) {}

    // 2. Plano B: ReceitaWS
    try {
      const r2 = await fetchComTimeout(`https://receitaws.com.br/v1/cnpj/${digits}`);
      if (r2.ok) {
        const d2 = await r2.json();
        if (d2 && d2.status !== "ERROR") {
          const situacao = String(d2.situacao || "ATIVA").trim().toUpperCase();
          return res.status(200).json({
            sucesso: true,
            dados: {
              cnpj: digits,
              razao_social: String(d2.nome || "").trim(),
              nome_fantasia: String(d2.fantasia || "").trim(),
              situacao_cadastral: situacao,
              ativa: situacao === "ATIVA",
              cep: String(d2.cep || "").replace(/\D/g, ""),
              logradouro: String(d2.logradouro || "").trim(),
              numero: String(d2.numero || "").trim(),
              complemento: String(d2.complemento || "").trim(),
              bairro: String(d2.bairro || "").trim(),
              cidade: String(d2.municipio || "").trim(),
              uf: String(d2.uf || "").trim().toUpperCase(),
              telefone: formatarTelefoneBR(d2.telefone || ""),
              email: String(d2.email || "").trim().toLowerCase()
            }
          });
        }
      }
    } catch (_) {}

    // 3. Plano C: MinhaReceita
    try {
      const r3 = await fetchComTimeout(`https://minhareceita.org/${digits}`);
      if (r3.ok) {
        const d3 = await r3.json();
        const situacao = String(d3.descricao_situacao_cadastral || "ATIVA").trim().toUpperCase();
        const tipoLog3 = d3.descricao_tipo_de_logradouro ? `${d3.descricao_tipo_de_logradouro} ` : "";
        return res.status(200).json({
          sucesso: true,
          dados: {
            cnpj: digits,
            razao_social: String(d3.razao_social || "").trim(),
            nome_fantasia: String(d3.nome_fantasia || "").trim(),
            situacao_cadastral: situacao,
            ativa: situacao === "ATIVA",
            cep: String(d3.cep || "").replace(/\D/g, ""),
            logradouro: `${tipoLog3}${d3.logradouro || ""}`.trim(),
            numero: String(d3.numero || "").trim(),
            complemento: String(d3.complemento || "").trim(),
            bairro: String(d3.bairro || "").trim(),
            cidade: String(d3.municipio || "").trim(),
            uf: String(d3.uf || "").trim().toUpperCase(),
            telefone: formatarTelefoneBR(d3.ddd_telefone_1 || ""),
            email: String(d3.email || "").trim().toLowerCase()
          }
        });
      }
    } catch (_) {}

    return res.status(404).json({
      sucesso: false,
      mensagem: "Não localizamos dados automáticos para este documento. Você pode preencher manualmente abaixo."
    });
  } catch (_) {
    return res.status(500).json({
      sucesso: false,
      mensagem: "Serviço de consulta temporariamente indisponível. Preencha os dados manualmente."
    });
  }
};

/**
 * API PÚBLICA & CONSULTAS FISCAIS SERVER-SIDE — LOJA SJ 3D
 * ============================================================================
 * Reunida em um único endpoint para respeitar o limite de Serverless Functions
 * da Vercel:
 * - Sem ?tipo: retorna apenas configurações públicas seguras (whatsappNumber).
 * - ?tipo=cnpj&cnpj=...: exige JWT Supabase válido, valida dígitos do CNPJ,
 *   aplica rate limiting e consulta BrasilAPI / ReceitaWS / MinhaReceita.
 * - ?tipo=cep&cep=...: exige JWT Supabase válido, aplica rate limiting e
 *   consulta ViaCEP / BrasilAPI CEP.
 * NUNCA expõe service_role e NUNCA registra CPF/CNPJ em logs.
 */

const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQ = 20;

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
  if (calc(digits.slice(0, 12), w1) !== Number(digits[12])) return false;
  return calc(digits.slice(0, 13), w2) === Number(digits[13]);
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

async function autenticarUsuarioSupabase(req, supabaseUrl, supabaseAnonKey) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ") || authHeader.length < 40) {
    return null;
  }
  try {
    const meRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: authHeader }
    });
    if (!meRes.ok) return null;
    const meUser = await meRes.json();
    return meUser?.id ? meUser : null;
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const tipo = String(req.query?.tipo || "").trim().toLowerCase();

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  // 1) Modo padrão: apenas configurações públicas da loja (WhatsApp)
  if (!tipo) {
    const rawWhatsapp =
      process.env.WHATSAPP_NUMBER ||
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
      process.env.VITE_WHATSAPP_NUMBER ||
      "5544991351318";

    const whatsappNumber = String(rawWhatsapp).replace(/\D/g, "") || "5544991351318";

    return res.status(200).json({
      ok: true,
      whatsappNumber,
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null
    });
  }

  // 2) Consultas fiscais (CNPJ / CEP): exigem usuário logado + rate limit
  const user = await autenticarUsuarioSupabase(req, SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!user) {
    return res.status(401).json({ sucesso: false, mensagem: "Faça login na sua conta para consultar dados." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  if (!verificarRateLimit(`u:${user.id}`) || (ip && !verificarRateLimit(`ip:${ip}`))) {
    return res.status(429).json({ sucesso: false, mensagem: "Muitas consultas em seguida. Aguarde 1 minuto." });
  }

  if (tipo === "cnpj") {
    const digits = String(req.query?.cnpj || "").replace(/\D/g, "");
    if (!validarCnpjOficial(digits)) {
      return res.status(400).json({ sucesso: false, mensagem: "CNPJ inválido. Confira os 14 números informados." });
    }

    // Principal: BrasilAPI
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

    // Plano B: ReceitaWS
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

    // Plano C: MinhaReceita
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
      mensagem: "Não localizamos dados automáticos para este CNPJ. Você pode preencher os campos manualmente."
    });
  }

  if (tipo === "cep") {
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
  }

  return res.status(400).json({ sucesso: false, mensagem: "Tipo de consulta inválido." });
};

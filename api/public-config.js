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

const crypto = require("crypto");

const rateBucket = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQ = 20;

const lgpdRateBucket = new Map();

function verificarRateLimitJanela(map, chave, maxHits, windowMs) {
  const agora = Date.now();
  const item = map.get(chave) || { count: 0, resetAt: agora + windowMs };
  if (agora > item.resetAt) {
    item.count = 0;
    item.resetAt = agora + windowMs;
  }
  item.count += 1;
  map.set(chave, item);
  if (map.size > 3000) map.clear();
  return item.count <= maxHits;
}

function verificarRateLimit(chave) {
  return verificarRateLimitJanela(rateBucket, chave, RATE_MAX_REQ, RATE_WINDOW_MS);
}

function obterChallengeSecret(supabaseAnonKey) {
  return process.env.LGPD_CHALLENGE_SECRET || process.env.TURNSTILE_SECRET_KEY || `${supabaseAnonKey}:sj3d-lgpd-v1`;
}

function ehChaveTurnstileValida(chave) {
  return /^[0-3]x[A-Za-z0-9_-]{16,128}$/.test(String(chave || "").trim());
}

function obterConfigTurnstile() {
  const rawSite = process.env.TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const rawSecret = process.env.TURNSTILE_SECRET_KEY || "";
  const siteKey = ehChaveTurnstileValida(rawSite) ? String(rawSite).trim() : null;
  const secretKey = ehChaveTurnstileValida(rawSecret) ? String(rawSecret).trim() : "";
  if (!siteKey || !secretKey) {
    return { siteKey: null, secretKey: "" };
  }
  return { siteKey, secretKey };
}

function gerarTokenDesafioLgpd(supabaseAnonKey) {
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${ts}.${nonce}`;
  const sig = crypto.createHmac("sha256", obterChallengeSecret(supabaseAnonKey)).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function validarTokenDesafioLgpd(token, supabaseAnonKey) {
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 3) return false;
  const [tsStr, nonce, sig] = parts;
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || !nonce || !sig) return false;
  const idadeMs = Date.now() - ts;
  if (idadeMs < 800 || idadeMs > 2 * 60 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", obterChallengeSecret(supabaseAnonKey)).update(`${tsStr}.${nonce}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch (_) {
    return false;
  }
}

function validarCpfOficial(digits) {
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(digits[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(digits[10]);
}

function sanitizarTextoSeguro(txt, maxLen) {
  return String(txt || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

async function lerBodyJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    if (req.body.length > 64 * 1024) return null;
    try { return JSON.parse(req.body); } catch (_) { return null; }
  }
  return new Promise((resolve) => {
    let raw = "";
    let exceeded = false;
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) exceeded = true;
    });
    req.on("end", () => {
      if (exceeded) return resolve(null);
      try { resolve(JSON.parse(raw || "{}")); } catch (_) { resolve(null); }
    });
  });
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

  // 1) Modo padrão: apenas configurações públicas da loja (WhatsApp + CAPTCHA site key + desafio anti-bot)
  if (!tipo) {
    const rawWhatsapp =
      process.env.WHATSAPP_NUMBER ||
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
      process.env.VITE_WHATSAPP_NUMBER ||
      "5544991351318";

    const whatsappNumber = String(rawWhatsapp).replace(/\D/g, "") || "5544991351318";
    const { siteKey: turnstileSiteKey } = obterConfigTurnstile();

    return res.status(200).json({
      ok: true,
      whatsappNumber,
      supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null,
      turnstileSiteKey,
      lgpdChallengeToken: gerarTokenDesafioLgpd(SUPABASE_ANON_KEY)
    });
  }

  // 1B) Novo desafio anti-bot sob demanda
  if (tipo === "lgpd-challenge") {
    const { siteKey: turnstileSiteKey } = obterConfigTurnstile();
    return res.status(200).json({
      ok: true,
      turnstileSiteKey,
      lgpdChallengeToken: gerarTokenDesafioLgpd(SUPABASE_ANON_KEY)
    });
  }

  // 1C) Envio público ou autenticado de solicitação LGPD (com rate limit + CAPTCHA + sanitização)
  if (tipo === "lgpd") {
    if (req.method !== "POST") {
      return res.status(405).json({ sucesso: false, mensagem: "Método não permitido." });
    }

    const ipBruto = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
    const ipHash = ipBruto ? crypto.createHash("sha256").update(ipBruto).digest("hex").slice(0, 32) : "no-ip";

    if (!verificarRateLimitJanela(lgpdRateBucket, `lgpd:ip:${ipHash}`, 5, 10 * 60 * 1000)) {
      return res.status(429).json({
        sucesso: false,
        mensagem: "Muitas solicitações seguidas. Aguarde alguns minutos antes de tentar novamente."
      });
    }

    const body = await lerBodyJson(req);
    if (!body || typeof body !== "object") {
      return res.status(400).json({ sucesso: false, mensagem: "Dados inválidos na solicitação." });
    }

    // Honeypot anti-bot
    if (String(body.website_url || "").trim() !== "") {
      return res.status(400).json({ sucesso: false, mensagem: "Validação de segurança recusada." });
    }

    // Verificação CAPTCHA (Turnstile quando configurado; senão desafio assinado pelo servidor)
    const { secretKey: turnstileSecret } = obterConfigTurnstile();
    if (turnstileSecret) {
      const cfToken = String(body.captchaToken || "").trim();
      if (!cfToken) {
        return res.status(400).json({ sucesso: false, mensagem: "Confirme o verificador de segurança (CAPTCHA) antes de enviar." });
      }
      try {
        const formData = new URLSearchParams();
        formData.set("secret", turnstileSecret);
        formData.set("response", cfToken);
        if (ipBruto) formData.set("remoteip", ipBruto);
        const cfRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          body: formData
        });
        const cfData = await cfRes.json();
        if (!cfData?.success) {
          return res.status(403).json({ sucesso: false, mensagem: "Verificação CAPTCHA inválida ou expirada. Tente novamente." });
        }
      } catch (_) {
        return res.status(503).json({ sucesso: false, mensagem: "Falha ao validar CAPTCHA. Tente novamente em instantes." });
      }
    } else {
      if (body.humanVerified !== true || !validarTokenDesafioLgpd(body.challengeToken, SUPABASE_ANON_KEY)) {
        return res.status(400).json({ sucesso: false, mensagem: "Marque a caixa de verificação de segurança para enviar." });
      }
    }

    const nome = sanitizarTextoSeguro(body.nome, 120);
    const email = sanitizarTextoSeguro(body.email, 160).toLowerCase();
    const tipoSolic = sanitizarTextoSeguro(body.tipo, 60);
    const detalhes = sanitizarTextoSeguro(body.detalhes, 2000);
    const docDigits = String(body.cpf_cnpj || body.cpf || "").replace(/\D/g, "");

    const tiposValidos = new Set([
      "acesso_dados",
      "correcao_dados",
      "eliminacao_dados",
      "portabilidade_dados",
      "revogacao_consentimento",
      "outro"
    ]);

    if (nome.length < 2) {
      return res.status(400).json({ sucesso: false, mensagem: "Informe seu nome completo." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ sucesso: false, mensagem: "Informe um e-mail válido." });
    }
    if (!tiposValidos.has(tipoSolic)) {
      return res.status(400).json({ sucesso: false, mensagem: "Escolha um tipo de solicitação válido." });
    }
    if (docDigits) {
      const docOk = docDigits.length === 11 ? validarCpfOficial(docDigits) : (docDigits.length === 14 && validarCnpjOficial(docDigits));
      if (!docOk) {
        return res.status(400).json({ sucesso: false, mensagem: "CPF ou CNPJ inválido. Confira os dígitos ou deixe em branco." });
      }
    }

    const emailHash = crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);
    if (!verificarRateLimitJanela(lgpdRateBucket, `lgpd:em:${emailHash}`, 4, 60 * 60 * 1000)) {
      return res.status(429).json({
        sucesso: false,
        mensagem: "Você já enviou várias solicitações recentes para este e-mail. Aguarde antes de enviar outra."
      });
    }

    const authHeader = String(req.headers.authorization || "").trim();
    const userBearer = authHeader.toLowerCase().startsWith("bearer ") && authHeader.length > 40 && !authHeader.includes(SUPABASE_ANON_KEY)
      ? authHeader
      : `Bearer ${SUPABASE_ANON_KEY}`;

    try {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_solicitacao_lgpd`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: userBearer,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_nome: nome,
          p_email: email,
          p_cpf_cnpj: docDigits || null,
          p_tipo: tipoSolic,
          p_detalhes: detalhes,
          p_ip_hash: ipHash
        })
      });

      const rpcData = await rpcRes.json().catch(() => ({}));
      if (!rpcRes.ok || !rpcData?.sucesso) {
        const msgSegura = typeof rpcData?.message === "string" && rpcData.message.includes("Limite")
          ? rpcData.message
          : "Não foi possível registrar a solicitação agora. Tente novamente em instantes.";
        return res.status(rpcRes.status >= 400 && rpcRes.status < 500 ? rpcRes.status : 500).json({
          sucesso: false,
          mensagem: msgSegura
        });
      }

      return res.status(200).json({
        sucesso: true,
        protocolo: rpcData.protocolo,
        status: rpcData.status,
        prazo_limite: rpcData.prazo_limite,
        prazo_resposta: rpcData.prazo_resposta,
        criado_em: rpcData.criado_em
      });
    } catch (_) {
      return res.status(502).json({
        sucesso: false,
        mensagem: "Erro de comunicação ao registrar sua solicitação. Tente novamente."
      });
    }
  }

  // 1D) Consulta pública de protocolo (rate limit + protocolo & e-mail obrigatórios via RPC SECURITY DEFINER)
  if (tipo === "lgpd-consulta") {
    if (req.method !== "POST") {
      return res.status(405).json({ sucesso: false, mensagem: "Método não permitido." });
    }
    const ipBruto = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
    const ipHash = ipBruto ? crypto.createHash("sha256").update(ipBruto).digest("hex").slice(0, 32) : "no-ip";
    if (!verificarRateLimitJanela(lgpdRateBucket, `lgpd:q:${ipHash}`, 15, 60 * 1000)) {
      return res.status(429).json({
        sucesso: false,
        mensagem: "Muitas consultas em seguida. Aguarde 1 minuto."
      });
    }

    const body = await lerBodyJson(req);
    const protocolo = sanitizarTextoSeguro(body?.protocolo, 40).toUpperCase();
    const email = sanitizarTextoSeguro(body?.email, 160).toLowerCase();
    if (!protocolo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe o número do protocolo e o e-mail usado na solicitação."
      });
    }

    try {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consultar_protocolo_lgpd`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_protocolo: protocolo,
          p_email: email
        })
      });
      const rpcData = await rpcRes.json().catch(() => null);
      if (!rpcRes.ok || !rpcData || rpcData.encontrado !== true) {
        return res.status(200).json({ sucesso: true, encontrado: false });
      }
      return res.status(200).json({ sucesso: true, encontrado: true, dados: rpcData });
    } catch (_) {
      return res.status(502).json({ sucesso: false, mensagem: "Erro ao consultar protocolo." });
    }
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

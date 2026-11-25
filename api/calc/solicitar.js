const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro
} = require("../_security");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
  }

  // Rate limit rigoroso contra spam de leads (10 por minuto por IP)
  if (!checarRateLimit(req, res, "api-calc-solicitar", 10, 60 * 1000)) return;

  const body = await parseJsonSeguro(req, 32 * 1024);
  if (!body || typeof body !== "object") {
    return sendJson(res, 400, { sucesso: false, mensagem: "Dados inválidos." });
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 160);
  const nome = String(body.nome || "").trim().slice(0, 120);
  const whatsapp = String(body.whatsapp || "").replace(/[^\d+\s()-]/g, "").trim().slice(0, 32);
  const cidade = String(body.cidade || "").trim().slice(0, 80);

  if (!EMAIL_RE.test(email) || nome.length < 2) {
    return sendJson(res, 400, { sucesso: false, mensagem: "Informe um nome e e-mail válidos." });
  }

  const novoLead = {
    id: `lead-${Date.now()}`,
    nome,
    whatsapp,
    cidade,
    email,
    data: new Date().toISOString(),
    status: "ativo"
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/termos_consentimento`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        titular_identificador: email,
        titular_tipo: "visitante",
        canal: "calculadora",
        finalidade: "cadastro_lead_calculadora",
        consentimento_concedido: true
      })
    });
  } catch (_) { }

  return sendJson(res, 200, {
    sucesso: true,
    lead: novoLead,
    mensagem: "Cadastro concluído com sucesso."
  });
};

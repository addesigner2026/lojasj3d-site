module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ sucesso: false, mensagem: "Método não permitido" }));
  }

  async function parseBody(request) {
    if (request.body && typeof request.body === "object") return request.body;
    if (typeof request.body === "string") {
      try { return JSON.parse(request.body); } catch (_) { return {}; }
    }
    return new Promise((resolve) => {
      let data = "";
      request.on("data", chunk => { data += chunk; });
      request.on("end", () => {
        try { resolve(JSON.parse(data || "{}")); } catch (_) { resolve({}); }
      });
    });
  }

  const body = await parseBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  const whatsapp = String(body.whatsapp || "").trim();

  if (!email || !nome) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ sucesso: false, mensagem: "Nome e e-mail são obrigatórios." }));
  }

  const pendente = {
    id: "solic-" + Date.now(),
    nome,
    whatsapp,
    email,
    data: new Date().toISOString()
  };

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/termos_consentimento`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        titular_identificador: email,
        titular_tipo: "visitante",
        canal: "calculadora",
        finalidade: "solicitacao_acesso_calc",
        consentimento_concedido: true,
        motivo_revogacao: JSON.stringify(pendente)
      })
    });
  } catch (_) {}

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ sucesso: true, pendente, mensagem: "Solicitação recebida com sucesso." }));
};

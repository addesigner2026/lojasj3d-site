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
  const MASTER_EMAILS = ["jt.designer21@gmail.com", "ad.design2050@gmail.com", "contato@gruposj.com.br"];

  if (!email) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ sucesso: false, mensagem: "E-mail obrigatório." }));
  }

  if (MASTER_EMAILS.includes(email)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ sucesso: false, mensagem: "Não é permitido revogar um administrador mestre." }));
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.calculadora_leads_v1&select=valor`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    let leads = [];
    let revogados = [];
    if (cfgRes.ok) {
      const rows = await cfgRes.json();
      if (Array.isArray(rows) && rows[0]?.valor) {
        leads = Array.isArray(rows[0].valor.leads) ? rows[0].valor.leads : [];
        revogados = Array.isArray(rows[0].valor.revogados) ? rows[0].valor.revogados : [];
      }
    }

    if (!revogados.includes(email)) {
      revogados.push(email);
    }

    leads = leads.map(l => {
      if (String(l.email || "").toLowerCase().trim() === email) {
        return { ...l, status: "revogado" };
      }
      return l;
    });

    await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        chave: "calculadora_leads_v1",
        valor: { leads, revogados },
        atualizado_em: new Date().toISOString()
      })
    });
  } catch (_) {}

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ sucesso: true, mensagem: `Acesso revogado com sucesso para ${email}` }));
};

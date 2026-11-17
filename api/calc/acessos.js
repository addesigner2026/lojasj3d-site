module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const DEFAULT_APPROVED = [
    "jt.designer21@gmail.com",
    "ad.design2050@gmail.com",
    "contato@gruposj.com.br",
    "sheilagarcia1606@gmail.com",
    "sjnovaisecia@gmail.com"
  ];

  let aprovados = [...DEFAULT_APPROVED];
  let leads = [];
  let revogados = [];
  let solicitacoes = [];

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  try {
    // 1. Lê configuracoes_site calculadora_leads_v1
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.calculadora_leads_v1&select=valor`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (cfgRes.ok) {
      const rows = await cfgRes.json();
      if (Array.isArray(rows) && rows[0]?.valor) {
        if (Array.isArray(rows[0].valor.leads)) {
          leads = rows[0].valor.leads;
        }
        if (Array.isArray(rows[0].valor.revogados)) {
          revogados = rows[0].valor.revogados.map(e => String(e).toLowerCase().trim());
        }
      }
    }

    // 2. Lê consentimentos registrados (fallback / complemento de leads)
    const termsRes = await fetch(`${SUPABASE_URL}/rest/v1/termos_consentimento?select=id,titular_identificador,motivo_revogacao,concedido_em&finalidade=in.(cadastro_lead_calculadora,solicitacao_acesso_calc)&order=concedido_em.desc`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (termsRes.ok) {
      const terms = await termsRes.json();
      if (Array.isArray(terms)) {
        const mapa = new Map();
        leads.forEach(l => mapa.set(String(l.email || "").toLowerCase().trim(), l));
        terms.forEach(t => {
          try {
            const parsed = t.motivo_revogacao ? JSON.parse(t.motivo_revogacao) : null;
            const em = String(parsed?.email || t.titular_identificador || "").toLowerCase().trim();
            if (em && !mapa.has(em)) {
              mapa.set(em, {
                id: parsed?.id || t.id,
                nome: parsed?.nome || em.split("@")[0],
                whatsapp: parsed?.whatsapp || "",
                cidade: parsed?.cidade || "",
                email: em,
                data: parsed?.data || t.concedido_em,
                status: revogados.includes(em) ? "revogado" : "ativo"
              });
            }
          } catch (_) {}
        });
        leads = Array.from(mapa.values());
      }
    }
  } catch (_) {}

  // Aprovados inclui todos os leads ativos + master
  const emailsLeadsAtivos = leads
    .filter(l => l.status !== "revogado" && !revogados.includes(String(l.email || "").toLowerCase().trim()))
    .map(l => String(l.email || "").toLowerCase().trim());

  aprovados = [...new Set([...aprovados, ...emailsLeadsAtivos])];

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
    sucesso: true,
    leads,
    revogados,
    aprovados,
    solicitacoes
  }));
};

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
  let solicitacoes = [];

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";

  try {
    const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.calculadora_acessos_v1&select=valor`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (supaRes.ok) {
      const rows = await supaRes.json();
      if (Array.isArray(rows) && rows[0]?.valor) {
        if (Array.isArray(rows[0].valor.aprovados)) {
          aprovados = [...new Set([...aprovados, ...rows[0].valor.aprovados.map(e => String(e).toLowerCase().trim())])];
        }
        if (Array.isArray(rows[0].valor.solicitacoes)) {
          solicitacoes = rows[0].valor.solicitacoes;
        }
      }
    }
  } catch (_) {}

  // Filtra quem já foi aprovado
  solicitacoes = solicitacoes.filter(s => !aprovados.includes(String(s.email || "").toLowerCase().trim()));

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
    sucesso: true,
    aprovados,
    solicitacoes
  }));
};

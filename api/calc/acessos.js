const {
  SUPABASE_URL,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  validarUsuarioJwt
} = require("../_security");

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
  }

  if (!checarRateLimit(req, res, "api-calc-acessos", 30, 60 * 1000)) return;

  // Exige admin/staff aprovado para consultar lista de leads e acessos da calculadora
  const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin", "staff"] });
  if (!authCheck.ok) {
    return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });
  }

  let leads = [];
  let revogados = [];

  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.calculadora_leads_v1&select=valor`, {
      headers: {
        apikey: authCheck.writeHeaders.apikey,
        Authorization: authCheck.authHeader
      }
    });

    if (cfgRes.ok) {
      const rows = await cfgRes.json();
      if (Array.isArray(rows) && rows[0]?.valor) {
        if (Array.isArray(rows[0].valor.leads)) leads = rows[0].valor.leads;
        if (Array.isArray(rows[0].valor.revogados)) {
          revogados = rows[0].valor.revogados.map((e) => String(e).toLowerCase().trim());
        }
      }
    }
  } catch (_) { }

  const aprovados = leads
    .filter((l) => l.status !== "revogado" && !revogados.includes(String(l.email || "").toLowerCase().trim()))
    .map((l) => String(l.email || "").toLowerCase().trim());

  return sendJson(res, 200, {
    sucesso: true,
    leads,
    revogados,
    aprovados: [...new Set(aprovados)],
    solicitacoes: []
  });
};

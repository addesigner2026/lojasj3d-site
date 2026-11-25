const {
  SUPABASE_URL,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro,
  validarUsuarioJwt
} = require("../_security");

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
  if (!checarRateLimit(req, res, "api-calc-revogar", 20, 60 * 1000)) return;

  const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin", "staff"] });
  if (!authCheck.ok) return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });

  const body = await parseJsonSeguro(req, 16 * 1024);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return sendJson(res, 400, { sucesso: false, mensagem: "E-mail é obrigatório." });

  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.calculadora_leads_v1&select=valor`, {
      headers: { apikey: authCheck.writeHeaders.apikey, Authorization: authCheck.authHeader }
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
    if (!revogados.includes(email)) revogados.push(email);
    leads = leads.map((l) => (String(l.email || "").toLowerCase().trim() === email ? { ...l, status: "revogado" } : l));

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site`, {
      method: "POST",
      headers: authCheck.writeHeaders,
      body: JSON.stringify({ chave: "calculadora_leads_v1", valor: { leads, revogados }, atualizado_em: new Date().toISOString() })
    });
    if (!saveRes.ok) return sendJson(res, 403, { sucesso: false, mensagem: "Permissão negada." });
    return sendJson(res, 200, { sucesso: true, email, status: "revogado" });
  } catch (_) {
    return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao revogar acesso." });
  }
};

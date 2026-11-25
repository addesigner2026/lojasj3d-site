const {
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
  if (!checarRateLimit(req, res, "api-calc-aprovar", 20, 60 * 1000)) return;

  const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin", "staff"] });
  if (!authCheck.ok) return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });

  const body = await parseJsonSeguro(req, 16 * 1024);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return sendJson(res, 400, { sucesso: false, mensagem: "E-mail é obrigatório." });

  return sendJson(res, 200, { sucesso: true, email, status: "aprovado" });
};

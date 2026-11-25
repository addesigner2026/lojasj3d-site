/**
 * ENDPOINT SERVER-SIDE PARA EXCLUSÃO DE USUÁRIO POR ADMINISTRADOR
 * =====================================================================
 * - NUNCA expõe service_role key no front-end.
 * - Valida JWT no Supabase Auth + confirma role='admin' e status='approved'.
 * - Valida formato UUID do userId, aplica rate limit e CORS restrito.
 * - Mensagens de erro sempre genéricas (sem expor detalhes do banco).
 */

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro,
  validarUsuarioJwt
} = require("./_security");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "POST, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST" && req.method !== "DELETE") {
    return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
  }

  if (!checarRateLimit(req, res, "api-admin-delete-user", 15, 60 * 1000)) return;

  const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin"] });
  if (!authCheck.ok) {
    return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });
  }

  const body = await parseJsonSeguro(req, 64 * 1024);
  const targetUserId = String(body?.userId || "").trim();
  if (!UUID_RE.test(targetUserId)) {
    return sendJson(res, 400, { sucesso: false, mensagem: "ID de usuário inválido." });
  }

  if (authCheck.user.id === targetUserId) {
    return sendJson(res, 400, { sucesso: false, mensagem: "Você não pode excluir a própria conta administrativa." });
  }

  try {
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const delAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (delAuthRes.ok) {
        return sendJson(res, 200, { sucesso: true, mensagem: "Usuário excluído permanentemente." });
      }
    }

    const delProfRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: authCheck.authHeader }
      }
    );
    if (!delProfRes.ok) {
      return sendJson(res, 400, { sucesso: false, mensagem: "Não foi possível excluir o perfil." });
    }

    return sendJson(res, 200, { sucesso: true, mensagem: "Perfil removido com sucesso." });
  } catch (_) {
    return sendJson(res, 500, { sucesso: false, mensagem: "Erro interno ao excluir usuário." });
  }
};

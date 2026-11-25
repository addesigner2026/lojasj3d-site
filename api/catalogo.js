const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro,
  validarUsuarioJwt
} = require("./_security");

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "GET, POST, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET") {
    if (!checarRateLimit(req, res, "api-catalogo-get", 90, 60 * 1000)) return;
    try {
      const supaRes = await fetch(
        `${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.catalogo_oficial_v1&select=valor,atualizado_em`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
          }
        }
      );

      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows) && rows[0] && rows[0].valor && typeof rows[0].valor === "object") {
          return sendJson(res, 200, rows[0].valor);
        }
      }
      return sendJson(res, 200, null);
    } catch (_) {
      return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao consultar catálogo." });
    }
  }

  if (req.method === "POST") {
    if (!checarRateLimit(req, res, "api-catalogo-write", 25, 60 * 1000)) return;
    const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin", "staff"] });
    if (!authCheck.ok) {
      return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });
    }

    const body = await parseJsonSeguro(req, 5 * 1024 * 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(res, 400, { sucesso: false, mensagem: "Payload inválido ou rejeitado por segurança." });
    }

    const payload = {
      ...body,
      atualizadoEm: body.atualizadoEm || new Date().toISOString()
    };

    try {
      const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site`, {
        method: "POST",
        headers: authCheck.writeHeaders,
        body: JSON.stringify({
          chave: "catalogo_oficial_v1",
          valor: payload,
          atualizado_em: payload.atualizadoEm
        })
      });

      if (!supaRes.ok) {
        return sendJson(res, supaRes.status === 401 || supaRes.status === 403 ? 403 : 502, {
          sucesso: false,
          mensagem: "Permissão negada para gravar o catálogo."
        });
      }

      return sendJson(res, 200, { sucesso: true, atualizadoEm: payload.atualizadoEm });
    } catch (_) {
      return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao salvar catálogo." });
    }
  }

  if (req.method === "DELETE") {
    if (!checarRateLimit(req, res, "api-catalogo-write", 10, 60 * 1000)) return;
    const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin"] });
    if (!authCheck.ok) {
      return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });
    }

    try {
      const delHeaders = { ...authCheck.writeHeaders };
      delete delHeaders["Content-Type"];
      delete delHeaders.Prefer;
      await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.catalogo_oficial_v1`, {
        method: "DELETE",
        headers: delHeaders
      });
      return sendJson(res, 200, { sucesso: true, mensagem: "Catálogo restaurado ao padrão de fábrica." });
    } catch (_) {
      return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao restaurar catálogo." });
    }
  }

  return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
};

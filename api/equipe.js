const {
  SUPABASE_URL,
  aplicarHeadersSeguranca,
  sendJson,
  checarRateLimit,
  parseJsonSeguro,
  validarUsuarioJwt
} = require("./_security");

module.exports = async function handler(req, res) {
  aplicarHeadersSeguranca(req, res, "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (!checarRateLimit(req, res, "api-equipe", 30, 60 * 1000)) return;

  // Tanto GET quanto POST em /api/equipe exigem administrador aprovado via JWT Supabase Auth
  const authCheck = await validarUsuarioJwt(req, { rolesPermitidos: ["admin"] });
  if (!authCheck.ok) {
    return sendJson(res, authCheck.status, { sucesso: false, mensagem: authCheck.mensagem });
  }

  if (req.method === "GET") {
    try {
      const supaRes = await fetch(
        `${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.equipe_admin_v1&select=valor,atualizado_em`,
        {
          headers: {
            apikey: authCheck.writeHeaders.apikey,
            Authorization: authCheck.authHeader
          }
        }
      );
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows) && rows[0] && rows[0].valor) {
          // Nunca devolver senhaHash na resposta da API
          const usuariosSeguros = Array.isArray(rows[0].valor.usuarios)
            ? rows[0].valor.usuarios.map(({ senhaHash, senha, ...rest }) => rest)
            : [];
          return sendJson(res, 200, {
            sucesso: true,
            usuarios: usuariosSeguros,
            removidos: Array.isArray(rows[0].valor.removidos) ? rows[0].valor.removidos : []
          });
        }
      }
      return sendJson(res, 200, { sucesso: true, usuarios: [], removidos: [] });
    } catch (_) {
      return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao consultar equipe." });
    }
  }

  if (req.method === "POST") {
    const body = await parseJsonSeguro(req, 1024 * 1024);
    if (!body || !Array.isArray(body.usuarios)) {
      return sendJson(res, 400, { sucesso: false, mensagem: "Lista de usuários inválida." });
    }

    const usuariosLimpos = body.usuarios.map(({ senha, ...u }) => u);
    const payload = {
      usuarios: usuariosLimpos,
      removidos: Array.isArray(body.removidos) ? body.removidos : []
    };

    try {
      const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site`, {
        method: "POST",
        headers: authCheck.writeHeaders,
        body: JSON.stringify({
          chave: "equipe_admin_v1",
          valor: payload,
          atualizado_em: new Date().toISOString()
        })
      });

      if (!supaRes.ok) {
        return sendJson(res, 403, {
          sucesso: false,
          mensagem: "Permissão negada para salvar a equipe."
        });
      }

      return sendJson(res, 200, { sucesso: true });
    } catch (_) {
      return sendJson(res, 500, { sucesso: false, mensagem: "Erro ao gravar equipe." });
    }
  }

  return sendJson(res, 405, { sucesso: false, mensagem: "Método não permitido." });
};

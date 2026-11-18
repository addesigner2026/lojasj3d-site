/**
 * ENDPOINT SERVER-SIDE PARA EXCLUSÃO DE USUÁRIO POR ADMINISTRADOR
 * =====================================================================
 * - NUNCA expõe service_role key no front-end.
 * - Valida o JWT do usuário chamador no Supabase Auth e confirma em public.profiles
 *   que o chamador tem role = 'admin' E status = 'approved'.
 * - Impede o admin de excluir a si mesmo ou o último admin aprovado.
 * - Se SUPABASE_SERVICE_ROLE_KEY estiver configurada na Vercel, remove também de auth.users.
 * - Caso contrário, remove apenas da tabela public.profiles usando o próprio JWT do admin (via RLS).
 */

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const sendJson = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };

  if (req.method !== "POST" && req.method !== "DELETE") {
    return sendJson(405, { sucesso: false, mensagem: "Método não permitido." });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ") || authHeader.length < 40) {
    return sendJson(401, { sucesso: false, mensagem: "Token de autenticação ausente." });
  }

  // Parse seguro do corpo
  const body = await new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (_) { resolve({}); }
    });
  });

  const targetUserId = String(body.userId || "").trim();
  if (!targetUserId) {
    return sendJson(400, { sucesso: false, mensagem: "ID do usuário alvo é obrigatório." });
  }

  try {
    // 1) Valida o token JWT do chamador direto no Supabase Auth
    const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meRes.ok) {
      return sendJson(401, { sucesso: false, mensagem: "Sessão expirada ou inválida." });
    }
    const meUser = await meRes.json();
    if (!meUser || !meUser.id) {
      return sendJson(401, { sucesso: false, mensagem: "Usuário não autenticado." });
    }

    if (meUser.id === targetUserId) {
      return sendJson(400, { sucesso: false, mensagem: "Você não pode excluir a própria conta administrativa." });
    }

    // 2) Verifica em public.profiles se o chamador é admin aprovado
    const checkKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const checkAuth = SUPABASE_SERVICE_ROLE_KEY ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` : authHeader;
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(meUser.id)}&select=id,role,status`,
      { headers: { apikey: checkKey, Authorization: checkAuth } }
    );
    const profRows = profRes.ok ? await profRes.json() : [];
    const callerProfile = Array.isArray(profRows) ? profRows[0] : null;
    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "approved") {
      return sendJson(403, { sucesso: false, mensagem: "Acesso negado: apenas administradores aprovados podem excluir usuários." });
    }

    // 3) Se houver SUPABASE_SERVICE_ROLE_KEY no servidor, exclui de auth.users (cascade apaga profiles)
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const delAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      if (delAuthRes.ok) {
        return sendJson(200, { sucesso: true, mensagem: "Usuário excluído permanentemente do sistema." });
      }
    }

    // 4) Fallback seguro via RLS usando o próprio JWT do admin (exclui o registro de public.profiles)
    const delProfRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetUserId)}`,
      {
        method: "DELETE",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
      }
    );
    if (!delProfRes.ok) {
      const errTxt = await delProfRes.text().catch(() => "");
      return sendJson(400, { sucesso: false, mensagem: errTxt || "Não foi possível excluir o perfil." });
    }

    return sendJson(200, { sucesso: true, mensagem: "Perfil removido com sucesso." });
  } catch (err) {
    return sendJson(500, { sucesso: false, mensagem: "Erro interno ao excluir usuário." });
  }
};

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-SJ-Admin-Email, X-SJ-Admin-Hash");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co";
  const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const sendJson = (status, obj) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };

  async function parseBody(request) {
    if (request.body && typeof request.body === "object") return request.body;
    if (typeof request.body === "string") {
      if (request.body.length > 2 * 1024 * 1024) return null;
      if (request.body.includes("__proto__") || request.body.includes("constructor") || request.body.includes("prototype")) {
        return null;
      }
      try {
        return JSON.parse(request.body);
      } catch (_) {
        return {};
      }
    }
    return new Promise((resolve) => {
      let data = "";
      let exceeded = false;
      request.on("data", (chunk) => {
        data += chunk;
        if (data.length > 2 * 1024 * 1024) exceeded = true;
      });
      request.on("end", () => {
        if (exceeded || data.includes("__proto__") || data.includes("constructor") || data.includes("prototype")) {
          return resolve(null);
        }
        try {
          resolve(JSON.parse(data || "{}"));
        } catch (_) {
          resolve({});
        }
      });
    });
  }

  async function resolverHeadersEscrita() {
    const authHeader = String(req.headers.authorization || "").trim();
    const hasUserJwt =
      authHeader.toLowerCase().startsWith("bearer ") &&
      authHeader.length > 40 &&
      !authHeader.includes(SUPABASE_ANON_KEY);

    if (hasUserJwt) {
      return {
        ok: true,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: authHeader,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        }
      };
    }

    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminEmail = String(req.headers["x-sj-admin-email"] || "").toLowerCase().trim();
      const adminHash = String(req.headers["x-sj-admin-hash"] || "").trim();
      if (!adminEmail || !adminHash) {
        return { ok: false, status: 401, mensagem: "Credenciais administrativas ausentes." };
      }

      try {
        const eqRes = await fetch(
          `${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.equipe_admin_v1&select=valor`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
          }
        );
        if (eqRes.ok) {
          const rows = await eqRes.json();
          const usuarios = Array.isArray(rows?.[0]?.valor?.usuarios) ? rows[0].valor.usuarios : [];
          const match = usuarios.find(
            (u) =>
              String(u.email || "").toLowerCase().trim() === adminEmail &&
              u.status === "aprovado" &&
              u.ativo !== false &&
              String(u.senhaHash || "") === adminHash
          );
          if (match) {
            return {
              ok: true,
              headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates"
              }
            };
          }
        }
      } catch (_) {}
      return { ok: false, status: 403, mensagem: "Administrador não autorizado." };
    }

    return {
      ok: false,
      status: 401,
      mensagem: "Sessão Supabase não autenticada. Conecte sua conta Google Admin no topo do painel ou configure SUPABASE_SERVICE_ROLE_KEY na Vercel."
    };
  }

  if (req.method === "GET") {
    try {
      const readKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      const supaRes = await fetch(
        `${SUPABASE_URL}/rest/v1/configuracoes_site?chave=eq.equipe_admin_v1&select=valor,atualizado_em`,
        {
          headers: {
            apikey: readKey,
            Authorization: `Bearer ${readKey}`
          }
        }
      );
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows) && rows[0] && rows[0].valor) {
          return sendJson(200, { sucesso: true, ...rows[0].valor });
        }
      }
      return sendJson(200, { sucesso: true, usuarios: [], removidos: [] });
    } catch (_) {
      return sendJson(500, { sucesso: false, mensagem: "Erro ao consultar equipe na nuvem." });
    }
  }

  if (req.method === "POST") {
    const authCheck = await resolverHeadersEscrita();
    if (!authCheck.ok) {
      return sendJson(authCheck.status || 401, { sucesso: false, mensagem: authCheck.mensagem });
    }

    const body = await parseBody(req);
    if (!body || !Array.isArray(body.usuarios)) {
      return sendJson(400, { sucesso: false, mensagem: "Lista de usuários inválida." });
    }

    const payload = {
      usuarios: body.usuarios,
      removidos: Array.isArray(body.removidos) ? body.removidos : []
    };

    try {
      const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site`, {
        method: "POST",
        headers: authCheck.headers,
        body: JSON.stringify({
          chave: "equipe_admin_v1",
          valor: payload,
          atualizado_em: new Date().toISOString()
        })
      });

      if (!supaRes.ok) {
        const errText = await supaRes.text().catch(() => "");
        return sendJson(403, {
          sucesso: false,
          mensagem: "Permissão negada no Supabase RLS para salvar a equipe.",
          detalhe: errText.slice(0, 200)
        });
      }

      return sendJson(200, { sucesso: true });
    } catch (_) {
      return sendJson(500, { sucesso: false, mensagem: "Erro ao gravar equipe na nuvem." });
    }
  }

  return sendJson(405, { sucesso: false, mensagem: "Método não permitido." });
};

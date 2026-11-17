module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";

  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ sucesso: false, mensagem: "Método não permitido" }));
  }

  async function parseBody(request) {
    if (request.body && typeof request.body === "object") return request.body;
    if (typeof request.body === "string") {
      try { return JSON.parse(request.body); } catch (_) { return {}; }
    }
    return new Promise((resolve) => {
      let data = "";
      request.on("data", chunk => { data += chunk; });
      request.on("end", () => {
        try { resolve(JSON.parse(data || "{}")); } catch (_) { resolve({}); }
      });
    });
  }

  const body = await parseBody(req);
  const email = String(body.email || "").trim().toLowerCase();

  if (!email) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ sucesso: false, mensagem: "E-mail obrigatório." }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ sucesso: true, mensagem: `Acesso liberado com sucesso para ${email}` }));
};

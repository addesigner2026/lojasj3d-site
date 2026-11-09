module.exports = function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedHost = req.headers.host || "";

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

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      status: "online",
      servidor: "Loja SJ 3D (Vercel Serverless)",
      plataforma: "Vercel",
      banco: "Supabase Cloud",
      horario: new Date().toISOString()
    })
  );
};


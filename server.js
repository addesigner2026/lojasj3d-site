/**
 * SERVIDOR LOCAL DE DESENVOLVIMENTO — LOJA SJ 3D
 * Rode com: npm run dev  (ou: npm start)
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.split("?")[0];
  const relativePath = cleanUrl === "/" ? "/index.html" : cleanUrl;
  const filePath = path.join(ROOT, decodeURIComponent(relativePath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>404 - Arquivo não encontrado</h1>");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log("\n========================================================");
  console.log("🚀 LOJA SJ 3D — Servidor Local Iniciado com Sucesso!");
  console.log(`👉 Acesse no navegador: ${url}`);
  console.log("========================================================\n");

  // Abre automaticamente no navegador padrão do Mac
  if (process.platform === "darwin") {
    exec(`open ${url}`);
  }
});


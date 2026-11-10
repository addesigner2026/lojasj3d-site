/**
 * SERVIDOR LOCAL DE DESENVOLVIMENTO & API DE DADOS — LOJA SJ 3D
 * =====================================================================
 * Rode com: npm run dev  (ou: npm start)
 * - Servidor de Arquivos Estáticos (HTML, CSS, JS, Imagens, Banners)
 * - API REST de Banco de Dados JSON Local (/api/auth, /api/orcamentos, /api/clientes)
 * - Armazenamento persistente no arquivo: data/db.json
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

function gerarHashSenha(senha) {
  if (!senha) return "";
  return crypto.createHash("sha256").update(String(senha)).digest("hex");
}

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "db.json");

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

// Funções de Banco de Dados JSON
function garantirPastaData() {
  const dataDir = path.join(ROOT, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function carregarBanco() {
  garantirPastaData();
  if (!fs.existsSync(DB_PATH)) {
    const padrao = {
      versao: "1.0.0",
      atualizadoEm: new Date().toISOString(),
      usuarios: [
        {
          id: "usr-admin-1",
          nome: "Thiago Novais",
          email: "contato@gruposj.com.br",
          senhaHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
          cargo: "Administrador / Vendedor",
          tipo: "operador",
          foto: null,
          ativo: true,
          criadoEm: new Date().toISOString(),
          ultimoLogin: new Date().toISOString()
        }
      ],
      clientes: [
        {
          id: "cli-1",
          nome: "Cliente Balcão - Loja SJ 3D",
          cnpjCpf: "66.275.129/0001-10",
          endereco: "Avenida Portugal, 6759",
          bairroCidadeUf: "Zona 1A - Umuarama/PR",
          cepTelefone: "(44) 99135-1318",
          email: "contato@gruposj.com.br"
        }
      ],
      orcamentos: []
    };
    salvarBanco(padrao);
    return padrao;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[Servidor] Erro ao carregar db.json:", e);
    return { usuarios: [], clientes: [], orcamentos: [] };
  }
}

function salvarBanco(dados) {
  garantirPastaData();
  dados.atualizadoEm = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2), "utf-8");
}

function responderJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key"
  });
  res.end(JSON.stringify(payload));
}

const ADMIN_API_KEY = process.env.SJ_ADMIN_KEY || (process.env.NODE_ENV === "production" ? null : "sj-admin-dev-local");

if (!ADMIN_API_KEY && process.env.NODE_ENV === "production") {
  console.error("FATAL: A variável de ambiente SJ_ADMIN_KEY é obrigatória em produção.");
  process.exit(1);
}

function verificarAutorizacaoAdmin(req, db) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const customKey = req.headers["x-admin-key"] || "";

  if (ADMIN_API_KEY && (token === ADMIN_API_KEY || customKey === ADMIN_API_KEY)) {
    return true;
  }

  if (token && db && Array.isArray(db.usuarios)) {
    const user = db.usuarios.find(
      (u) => (u.id === token || u.email?.toLowerCase() === token.toLowerCase()) &&
             (u.tipo === "operador" || u.tipo === "admin" || String(u.cargo).toLowerCase().includes("vendedor") || String(u.cargo).toLowerCase().includes("admin"))
    );
    if (user) return true;
  }

  return false;
}

function lerCorpoRequisicao(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e7) {
        req.connection.destroy();
        reject(new Error("Corpo muito grande"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Tratamento de CORS Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // =========================================================================
  // ROTAS DA API DE BANCO DE DADOS & AUTENTICAÇÃO (/api/...)
  // =========================================================================

  if (pathname.startsWith("/api/")) {
    const db = carregarBanco();

    // 1. Status do Servidor
    if (pathname === "/api/status" && req.method === "GET") {
      responderJson(res, 200, {
        status: "online",
        servidor: "Loja SJ 3D - API Local",
        banco: "data/db.json",
        totalUsuarios: db.usuarios.length,
        totalClientes: db.clientes.length,
        totalOrcamentos: db.orcamentos.length,
        horario: new Date().toISOString()
      });
      return;
    }

    // 2. Login de Usuário (Google ou E-mail/Senha)
    if (pathname === "/api/auth/login" && req.method === "POST") {
      const body = await lerCorpoRequisicao(req);

      if (body.tipo === "google" && body.usuario) {
        const u = body.usuario;
        const existente = db.usuarios.find((usr) => usr.email.toLowerCase() === u.email.toLowerCase());
        if (existente) {
          existente.ultimoLogin = new Date().toISOString();
          if (u.foto) existente.foto = u.foto;
        } else {
          db.usuarios.push({
            id: u.id || ("usr-google-" + Date.now()),
            nome: u.nome,
            email: u.email,
            cargo: "Vendedor (Google)",
            tipo: "google",
            foto: u.foto || null,
            ativo: true,
            criadoEm: new Date().toISOString(),
            ultimoLogin: new Date().toISOString()
          });
        }
        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, usuario: u });
        return;
      }

      // Login por E-mail e Senha
      const email = (body.email || "").toLowerCase().trim();
      const senha = (body.senha || "").trim();
      const user = db.usuarios.find((usr) => usr.email.toLowerCase() === email);

      const hashCalculado = gerarHashSenha(senha);
      const senhaValida = user && user.senhaHash && (user.senhaHash === hashCalculado || user.senhaHash === senha);

      if (!user || !senhaValida) {
        responderJson(res, 401, { sucesso: false, mensagem: "E-mail ou senha incorretos." });
        return;
      }

      // Migração automática de senha em texto plano para SHA-256
      if (user.senhaHash === senha) {
        user.senhaHash = hashCalculado;
      }

      user.ultimoLogin = new Date().toISOString();
      salvarBanco(db);

      responderJson(res, 200, {
        sucesso: true,
        usuario: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          cargo: user.cargo,
          tipo: user.tipo,
          foto: user.foto,
          ultimoLogin: user.ultimoLogin
        }
      });
      return;
    }

    // 3. Cadastro de Novo Vendedor
    if (pathname === "/api/auth/register" && req.method === "POST") {
      const body = await lerCorpoRequisicao(req);
      const email = (body.email || "").toLowerCase().trim();
      if (!body.nome || !email) {
        responderJson(res, 400, { sucesso: false, mensagem: "Dados incompletos." });
        return;
      }

      if (db.usuarios.some((u) => u.email.toLowerCase() === email)) {
        responderJson(res, 400, { sucesso: false, mensagem: "E-mail já cadastrado." });
        return;
      }

      const senhaOriginal = body.senha || body.senhaHash || "123456";
      const novo = {
        id: "usr-" + Date.now(),
        nome: body.nome.trim(),
        email: email,
        senhaHash: gerarHashSenha(senhaOriginal),
        cargo: body.cargo || "Vendedor",
        tipo: "operador",
        foto: null,
        ativo: true,
        criadoEm: new Date().toISOString(),
        ultimoLogin: new Date().toISOString()
      };

      db.usuarios.push(novo);
      salvarBanco(db);

      responderJson(res, 201, {
        sucesso: true,
        usuario: {
          id: novo.id,
          nome: novo.nome,
          email: novo.email,
          cargo: novo.cargo,
          tipo: novo.tipo,
          ultimoLogin: novo.ultimoLogin
        }
      });
      return;
    }

    // 4. Listar Usuários (Acesso Restrito)
    if (pathname === "/api/auth/users" && req.method === "GET") {
      if (!verificarAutorizacaoAdmin(req, db)) {
        responderJson(res, 403, { sucesso: false, mensagem: "Acesso restrito a administradores." });
        return;
      }
      const lista = db.usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo,
        tipo: u.tipo,
        foto: u.foto,
        ativo: u.ativo,
        ultimoLogin: u.ultimoLogin
      }));
      responderJson(res, 200, lista);
      return;
    }

    // 5. Orçamentos: Listar (GET) ou Salvar (POST)
    if (pathname === "/api/orcamentos") {
      if (req.method === "GET") {
        if (verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 200, db.orcamentos);
          return;
        }
        const authHeader = req.headers["authorization"] || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (token) {
          const filtrados = (db.orcamentos || []).filter(
            (o) => o.clienteId === token || o.metadados?.clienteId === token || o.cliente_id === token
          );
          responderJson(res, 200, filtrados);
          return;
        }
        responderJson(res, 401, { sucesso: false, mensagem: "Acesso não autorizado para listar orçamentos." });
        return;
      }

      if (req.method === "POST") {
        const body = await lerCorpoRequisicao(req);
        if (!body.id && !body.metadados?.numero) {
          responderJson(res, 400, { sucesso: false, mensagem: "Número do orçamento obrigatório" });
          return;
        }

        const idOrc = body.id || body.metadados.numero;
        const idx = db.orcamentos.findIndex((o) => o.id === idOrc);

        // Auto-salva dados do cliente no banco
        if (body.metadados?.cliente && body.metadados.cliente.nome) {
          const cli = body.metadados.cliente;
          const cliIdx = db.clientes.findIndex((c) => c.nome.toLowerCase() === cli.nome.toLowerCase().trim());
          const clienteAtualizado = {
            id: cliIdx >= 0 ? db.clientes[cliIdx].id : ("cli-" + Date.now()),
            nome: cli.nome.trim(),
            cnpjCpf: cli.cnpjCpf || "",
            endereco: cli.endereco || "",
            bairroCidadeUf: cli.bairroCidadeUf || "",
            cepTelefone: cli.cepTelefone || "",
            email: cli.email || "",
            atualizadoEm: new Date().toISOString()
          };
          if (cliIdx >= 0) {
            db.clientes[cliIdx] = { ...db.clientes[cliIdx], ...clienteAtualizado };
          } else {
            clienteAtualizado.criadoEm = new Date().toISOString();
            db.clientes.unshift(clienteAtualizado);
          }
        }

        if (idx >= 0) {
          const authHeader = req.headers["authorization"] || "";
          const token = authHeader.replace(/^Bearer\s+/i, "").trim();
          const orcExistente = db.orcamentos[idx];
          const ehAdmin = verificarAutorizacaoAdmin(req, db);
          const ehDono = token && (orcExistente.clienteId === token || orcExistente.metadados?.clienteId === token || orcExistente.cliente_id === token);

          if (!ehAdmin && !ehDono) {
            responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para modificar este orçamento." });
            return;
          }
          db.orcamentos[idx] = { ...db.orcamentos[idx], ...body, id: orcExistente.id, atualizadoEm: new Date().toISOString() };
        } else {
          db.orcamentos.unshift({ ...body, dataHoraSalvo: new Date().toISOString() });
        }

        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, orcamento: body });
        return;
      }
    }

    // 6. Atualizar Status ou Excluir Orçamento específico
    const matchOrcamento = pathname.match(/^\/api\/orcamentos\/([^/]+)(\/status)?$/);
    if (matchOrcamento) {
      const id = decodeURIComponent(matchOrcamento[1]);
      const isStatusOnly = Boolean(matchOrcamento[2]);

      if (req.method === "DELETE") {
        if (!verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para excluir orçamentos." });
          return;
        }
        db.orcamentos = db.orcamentos.filter((o) => o.id !== id);
        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, idExcluido: id });
        return;
      }

      if (req.method === "PATCH" && isStatusOnly) {
        if (!verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para alterar status de orçamentos." });
          return;
        }
        const body = await lerCorpoRequisicao(req);
        const orc = db.orcamentos.find((o) => o.id === id);
        if (orc) {
          const statusPermitidos = ["pendente", "aprovado", "faturado", "cancelado", "guardado", "enviado_whatsapp"];
          if (body.status && statusPermitidos.includes(body.status)) {
            orc.status = body.status;
            orc.statusAtualizadoEm = new Date().toISOString();
            salvarBanco(db);
            responderJson(res, 200, { sucesso: true, orcamento: orc });
          } else {
            responderJson(res, 400, { sucesso: false, mensagem: "Status de orçamento inválido." });
          }
        } else {
          responderJson(res, 404, { sucesso: false, mensagem: "Orçamento não encontrado" });
        }
        return;
      }
    }

    // 7. Clientes: Listar (GET) ou Salvar (POST)
    if (pathname === "/api/clientes") {
      if (req.method === "GET") {
        if (!verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 403, { sucesso: false, mensagem: "Acesso restrito a vendedores e administradores." });
          return;
        }
        responderJson(res, 200, db.clientes);
        return;
      }

      if (req.method === "POST") {
        const body = await lerCorpoRequisicao(req);
        if (!body.nome) {
          responderJson(res, 400, { sucesso: false, mensagem: "Nome do cliente obrigatório" });
          return;
        }

        const authHeader = req.headers["authorization"] || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const nomeTrim = body.nome.toLowerCase().trim();
        const idx = db.clientes.findIndex((c) => (body.id && c.id === body.id) || c.nome.toLowerCase() === nomeTrim);

        if (idx >= 0) {
          const cliExistente = db.clientes[idx];
          const ehAdmin = verificarAutorizacaoAdmin(req, db);
          const ehProprio = token && (cliExistente.id === token || (cliExistente.email && cliExistente.email.toLowerCase() === token.toLowerCase()));

          if (!ehAdmin && !ehProprio) {
            responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para modificar os dados deste cliente." });
            return;
          }
          db.clientes[idx] = { ...db.clientes[idx], ...body, id: cliExistente.id, atualizadoEm: new Date().toISOString() };
        } else {
          body.id = body.id || ("cli-" + Date.now());
          body.criadoEm = new Date().toISOString();
          db.clientes.unshift(body);
        }

        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, cliente: body });
        return;
      }
    }

    // 8. Catálogo & Banner Promocional (CMS Admin): GET, POST ou DELETE
    if (pathname === "/api/catalogo") {
      if (req.method === "GET") {
        responderJson(res, 200, db.catalogoCustom || {});
        return;
      }

      if (req.method === "POST") {
        if (!verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para editar catálogo." });
          return;
        }
        const body = await lerCorpoRequisicao(req);
        db.catalogoCustom = {
          ...(db.catalogoCustom || {}),
          ...body,
          atualizadoEm: new Date().toISOString()
        };
        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, catalogoCustom: db.catalogoCustom });
        return;
      }

      if (req.method === "DELETE") {
        if (!verificarAutorizacaoAdmin(req, db)) {
          responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para restaurar catálogo." });
          return;
        }
        delete db.catalogoCustom;
        salvarBanco(db);
        responderJson(res, 200, { sucesso: true, mensagem: "Catálogo restaurado para o padrão de fábrica." });
        return;
      }
    }

    // 9. Backup Completo: Exportar (GET) ou Importar (POST)
    if (pathname === "/api/db/export" && req.method === "GET") {
      if (!verificarAutorizacaoAdmin(req, db)) {
        responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para exportar dados." });
        return;
      }
      // Sanitiza dados de usuários para nunca expor hashes ou senhas
      const backupSanitizado = {
        ...db,
        usuarios: (db.usuarios || []).map(({ senhaHash, ...resto }) => resto)
      };
      responderJson(res, 200, backupSanitizado);
      return;
    }

    if (pathname === "/api/db/import" && req.method === "POST") {
      if (!verificarAutorizacaoAdmin(req, db)) {
        responderJson(res, 403, { sucesso: false, mensagem: "Acesso não autorizado para importar dados." });
        return;
      }
      const body = await lerCorpoRequisicao(req);
      if (body && Array.isArray(body.usuarios)) {
        salvarBanco(body);
        responderJson(res, 200, { sucesso: true, mensagem: "Banco restaurado com sucesso!" });
      } else {
        responderJson(res, 400, { sucesso: false, mensagem: "Formato de banco inválido" });
      }
      return;
    }

    responderJson(res, 404, { erro: "Rota de API não encontrada" });
    return;
  }

  // =========================================================================
  // SERVIDOR DE ARQUIVOS ESTÁTICOS DO SITE
  // =========================================================================

  const cleanUrl = (pathname === "/admin" || pathname === "/admin/")
    ? "/admin.html"
    : (pathname === "/" ? "/index.html" : pathname);
  const filePath = path.join(ROOT, decodeURIComponent(cleanUrl));

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
  console.log("🚀 LOJA SJ 3D — Servidor & Banco de Dados Iniciados!");
  console.log(`👉 Acesse a Loja no navegador: ${url}`);
  console.log(`💾 API de Dados & Auth ativa em: ${url}/api/status`);
  console.log("========================================================\n");

  if (process.platform === "darwin" && !process.env.CI) {
    exec(`open ${url}`);
  }
});

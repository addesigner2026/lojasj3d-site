/**
 * SISTEMA DE DADOS E AUTENTICAÇÃO — LOJA SJ 3D (UMUARAMA - PR)
 * =====================================================================
 * Módulo de Banco de Dados e Autenticação (SJ_DB):
 * - Suporte Híbrido: Sincroniza com API local (Node.js/server.js) e persiste
 *   no armazenamento local (localStorage / IndexedDB) para funcionar
 *   perfeitamente tanto em desenvolvimento local quanto no GitHub Pages.
 * - Gerenciamento de Usuários e Vendedores (Google OAuth e E-mail/Senha).
 * - Gerenciamento de Clientes (com autocompletar automático).
 * - Gerenciamento de Orçamentos com status comercial (Pendente, Aprovado, Faturado, Cancelado).
 * - Backup em 1 clique (Exportação e Importação de JSON).
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SJ_DB = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STORAGE_KEYS = {
    USUARIO_ATIVO: "sj_db_auth_user_v1",
    USUARIOS_TABELA: "sj_db_usuarios_v1",
    CLIENTES_TABELA: "sj_db_clientes_v1",
    ORCAMENTOS_TABELA: "sj_db_orcamentos_v1",
    CONFIG_TABELA: "sj_db_config_v1",
    CATALOGO_CUSTOM: "sj_db_catalogo_custom_v1"
  };

  // Snapshot original do SITE_DATA para permitir restaurar padrão de fábrica
  const SITE_DATA_FACTORY =
    typeof window !== "undefined" && window.SITE_DATA
      ? JSON.parse(JSON.stringify(window.SITE_DATA))
      : null;

  // Usuário padrão inicial caso a base local esteja vazia
  const USUARIO_PADRAO = {
    id: "usr-admin-1",
    nome: "Thiago Novais",
    email: "contato@gruposj.com.br",
    senhaHash: "123456",
    cargo: "Administrador / Vendedor",
    tipo: "operador",
    foto: null,
    ativo: true,
    criadoEm: "2026-11-04T12:00:00.000Z"
  };

  const CLIENTES_PADRAO = [
    {
      id: "cli-1",
      nome: "Cliente Balcão - Loja SJ 3D",
      cnpjCpf: "66.275.129/0001-10",
      endereco: "Avenida Portugal, 6759",
      bairroCidadeUf: "Zona 1A - Umuarama/PR",
      cepTelefone: "(44) 99135-1318",
      email: "contato@gruposj.com.br"
    }
  ];

  // Estado interno do Banco
  const state = {
    usuarioAtual: null,
    conectadoComServidor: false,
    authListeners: []
  };

  // Utilitários de Armazenamento Local Seguro
  function lerLocal(key, valorPadrao) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item) return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`[SJ_DB] Erro ao ler ${key}:`, e);
    }
    return valorPadrao;
  }

  function gravarLocal(key, valor) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(valor));
        return true;
      }
    } catch (e) {
      console.warn(`[SJ_DB] Erro ao gravar ${key}:`, e);
    }
    return false;
  }

  // Inicializa tabelas locais se estiverem vazias
  function inicializarTabelas() {
    const usuarios = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, null);
    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]);
    }

    const clientes = lerLocal(STORAGE_KEYS.CLIENTES_TABELA, null);
    if (!clientes || !Array.isArray(clientes)) {
      gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, CLIENTES_PADRAO);
    }

    const orcamentos = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, null);
    if (!orcamentos || !Array.isArray(orcamentos)) {
      gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
    }

    // Carrega sessão ativa
    state.usuarioAtual = lerLocal(STORAGE_KEYS.USUARIO_ATIVO, null);
  }

  // Notifica ouvintes de mudança na autenticação
  function notificarAuth() {
    state.authListeners.forEach((cb) => {
      try {
        cb(state.usuarioAtual);
      } catch (err) {
        console.error("[SJ_DB] Erro no listener de auth:", err);
      }
    });
  }

  // Tentativa assíncrona de sincronização com o servidor local (server.js)
  async function testarConexaoServidor() {
    if (typeof window === "undefined" || !window.fetch) return false;
    try {
      const res = await fetch("/api/status", { method: "GET", headers: { Accept: "application/json" } });
      if (res.ok) {
        state.conectadoComServidor = true;
        return true;
      }
    } catch (_) {
      state.conectadoComServidor = false;
    }
    return false;
  }

  // Chamada de API com fallback para o armazenamento local
  async function chamarApiOuLocal(endpoint, options = {}, fallbackFn) {
    if (state.conectadoComServidor && typeof window !== "undefined" && window.fetch) {
      try {
        const res = await fetch(endpoint, {
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          ...options
        });
        if (res.ok) {
          const dados = await res.json();
          return dados;
        }
      } catch (e) {
        console.warn(`[SJ_DB] Falha na API ${endpoint}, usando fallback local:`, e);
      }
    }
    return fallbackFn();
  }

  // =========================================================================
  // 1. MÓDULO DE AUTENTICAÇÃO (AUTH)
  // =========================================================================

  const auth = {
    // Retorna usuário da sessão atual
    getUsuarioAtual: function () {
      if (!state.usuarioAtual) {
        state.usuarioAtual = lerLocal(STORAGE_KEYS.USUARIO_ATIVO, null);
      }
      return state.usuarioAtual;
    },

    // Permite que o cliente Supabase atualize diretamente o usuário ativo
    definirUsuarioAtivo: function (usuario) {
      state.usuarioAtual = usuario;
      if (usuario) {
        gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, usuario);
      } else if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.USUARIO_ATIVO);
      }
      notificarAuth();
    },

    // Registra listener para reagir a login/logout
    onAuthStateChanged: function (callback) {
      if (typeof callback === "function") {
        state.authListeners.push(callback);
        callback(auth.getUsuarioAtual());
      }
    },

    // Login com Google (integração Supabase Auth com fallback local)
    loginGoogle: async function (dadosGoogle) {
      if (typeof window !== "undefined" && window.SJ_SUPABASE && window.SJ_SUPABASE.isConfigured()) {
        const resSupa = await window.SJ_SUPABASE.auth.loginGoogle();
        if (resSupa && resSupa.sucesso) {
          return resSupa;
        }
      }

      const email = (dadosGoogle?.email || "").toLowerCase().trim();
      const nome = dadosGoogle?.nome || dadosGoogle?.name || "Vendedor Google";
      const foto = dadosGoogle?.foto || dadosGoogle?.picture || null;

      const usuario = {
        id: "usr-google-" + Date.now(),
        nome: nome,
        email: email,
        cargo: "Vendedor (Google)",
        tipo: "google",
        foto: foto,
        ativo: true,
        ultimoLogin: new Date().toISOString()
      };

      // Salva na lista de usuários locais se ainda não existir
      const usuarios = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, []);
      const existente = usuarios.find((u) => u.email.toLowerCase() === email);
      if (existente) {
        existente.ultimoLogin = new Date().toISOString();
        if (foto) existente.foto = foto;
        gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuarios);
        state.usuarioAtual = existente;
      } else {
        usuarios.push(usuario);
        gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuarios);
        state.usuarioAtual = usuario;
      }

      gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
      notificarAuth();

      // Envia assíncrono para o server se conectado
      chamarApiOuLocal("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ tipo: "google", usuario: state.usuarioAtual })
      }, () => state.usuarioAtual);

      return { sucesso: true, usuario: state.usuarioAtual };
    },

    // Login corporativo com E-mail e Senha (Supabase Auth com fallback local)
    loginEmail: async function (email, senha) {
      const emailLimpo = (email || "").toLowerCase().trim();
      const senhaLimpa = (senha || "").trim();

      if (!emailLimpo || !senhaLimpa) {
        return { sucesso: false, mensagem: "Informe o e-mail e a senha de acesso." };
      }

      // 1. Tenta autenticar primeiro no Supabase se configurado
      if (typeof window !== "undefined" && window.SJ_SUPABASE && window.SJ_SUPABASE.isConfigured()) {
        const resSupa = await window.SJ_SUPABASE.auth.loginEmail(emailLimpo, senhaLimpa);
        if (resSupa.sucesso) {
          state.usuarioAtual = resSupa.usuario;
          gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
          notificarAuth();
          return resSupa;
        }
        if (!resSupa.fallback) {
          return resSupa;
        }
      }

      // 2. Validação local / Fallback
      const usuarios = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]);
      const user = usuarios.find((u) => u.email.toLowerCase() === emailLimpo);

      if (!user) {
        // Se for o e-mail do admin principal, permite cadastrar/acessar com 123456
        if (emailLimpo === "contato@gruposj.com.br" && senhaLimpa === "123456") {
          state.usuarioAtual = { ...USUARIO_PADRAO, ultimoLogin: new Date().toISOString() };
          gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
          notificarAuth();
          return { sucesso: true, usuario: state.usuarioAtual };
        }
        return { sucesso: false, mensagem: "Usuário não encontrado no cadastro da loja." };
      }

      if (user.senhaHash && user.senhaHash !== senhaLimpa) {
        return { sucesso: false, mensagem: "Senha incorreta. Verifique suas credenciais." };
      }

      user.ultimoLogin = new Date().toISOString();
      gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuarios);

      state.usuarioAtual = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo || "Vendedor",
        tipo: user.tipo || "operador",
        foto: user.foto || null,
        ultimoLogin: user.ultimoLogin
      };

      gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
      notificarAuth();

      // Notifica server se conectado
      chamarApiOuLocal("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: emailLimpo, senha: senhaLimpa })
      }, () => state.usuarioAtual);

      return { sucesso: true, usuario: state.usuarioAtual };
    },

    // Cadastro de Novo Vendedor / Operador (Supabase Auth com fallback local)
    registrar: async function ({ nome, email, senha, cargo = "Vendedor" }) {
      const nomeLimpo = (nome || "").trim();
      const emailLimpo = (email || "").toLowerCase().trim();
      const senhaLimpa = (senha || "").trim();

      if (!nomeLimpo || !emailLimpo || !senhaLimpa) {
        return { sucesso: false, mensagem: "Preencha todos os campos obrigatórios." };
      }

      if (senhaLimpa.length < 6) {
        return { sucesso: false, mensagem: "A senha deve ter no mínimo 6 caracteres." };
      }

      // 1. Tenta cadastrar no Supabase se configurado
      if (typeof window !== "undefined" && window.SJ_SUPABASE && window.SJ_SUPABASE.isConfigured()) {
        const resSupa = await window.SJ_SUPABASE.auth.registrar({
          nome: nomeLimpo,
          email: emailLimpo,
          password: senhaLimpa,
          cargo: cargo
        });
        if (resSupa.sucesso) {
          if (resSupa.usuario) {
            state.usuarioAtual = resSupa.usuario;
            gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
            notificarAuth();
          }
          return resSupa;
        }
        if (!resSupa.fallback) {
          return resSupa;
        }
      }

      // 2. Fallback Local
      const usuarios = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, []);
      const existente = usuarios.find((u) => u.email.toLowerCase() === emailLimpo);
      if (existente) {
        return { sucesso: false, mensagem: "Já existe um vendedor cadastrado com este e-mail." };
      }

      const novoUsuario = {
        id: "usr-" + Date.now(),
        nome: nomeLimpo,
        email: emailLimpo,
        senhaHash: senhaLimpa,
        cargo: cargo,
        tipo: "operador",
        foto: null,
        ativo: true,
        criadoEm: new Date().toISOString(),
        ultimoLogin: new Date().toISOString()
      };

      usuarios.push(novoUsuario);
      gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuarios);

      state.usuarioAtual = {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        cargo: novoUsuario.cargo,
        tipo: novoUsuario.tipo,
        foto: null,
        ultimoLogin: novoUsuario.ultimoLogin
      };

      gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
      notificarAuth();

      chamarApiOuLocal("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(novoUsuario)
      }, () => state.usuarioAtual);

      return { sucesso: true, usuario: state.usuarioAtual };
    },

    // Encerra a sessão
    logout: async function () {
      if (typeof window !== "undefined" && window.SJ_SUPABASE) {
        await window.SJ_SUPABASE.auth.logout();
      }
      state.usuarioAtual = null;
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.USUARIO_ATIVO);
      }
      notificarAuth();
      return true;
    },

    // Lista todos os usuários cadastrados (sem as senhas)
    listarUsuarios: function () {
      const usuarios = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, []);
      return usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo,
        tipo: u.tipo,
        foto: u.foto,
        ativo: u.ativo,
        ultimoLogin: u.ultimoLogin
      }));
    }
  };

  // =========================================================================
  // 2. MÓDULO DE CLIENTES (CLIENTES & AUTOCOMPLETAR)
  // =========================================================================

  const clientes = {
    // Retorna todos os clientes salvos
    listar: function () {
      return lerLocal(STORAGE_KEYS.CLIENTES_TABELA, CLIENTES_PADRAO);
    },

    // Salva ou atualiza os dados de um cliente
    salvar: function (dadosCliente) {
      if (!dadosCliente || !dadosCliente.nome) return null;

      const lista = clientes.listar();
      const nomeLimpo = dadosCliente.nome.trim();
      const cnpjCpfLimpo = (dadosCliente.cnpjCpf || "").trim();

      // Busca por CPF/CNPJ se preenchido, ou por Nome
      const idx = lista.findIndex((c) => {
        if (cnpjCpfLimpo && c.cnpjCpf && c.cnpjCpf.trim() === cnpjCpfLimpo) return true;
        return c.nome.toLowerCase() === nomeLimpo.toLowerCase();
      });

      const clientePronto = {
        id: idx >= 0 ? lista[idx].id : ("cli-" + Date.now()),
        nome: nomeLimpo,
        cnpjCpf: cnpjCpfLimpo,
        endereco: (dadosCliente.endereco || "").trim(),
        bairroCidadeUf: (dadosCliente.bairroCidadeUf || "").trim(),
        cepTelefone: (dadosCliente.cepTelefone || "").trim(),
        email: (dadosCliente.email || "").trim(),
        atualizadoEm: new Date().toISOString()
      };

      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...clientePronto };
      } else {
        clientePronto.criadoEm = new Date().toISOString();
        lista.unshift(clientePronto);
      }

      gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, lista);

      chamarApiOuLocal("/api/clientes", {
        method: "POST",
        body: JSON.stringify(clientePronto)
      }, () => clientePronto);

      return clientePronto;
    },

    // Busca clientes por termo (para sugestões e autocompletar)
    buscar: function (termo) {
      if (!termo || termo.trim().length === 0) return clientes.listar();
      const q = termo.toLowerCase().trim();
      const lista = clientes.listar();
      return lista.filter((c) => {
        return (
          (c.nome && c.nome.toLowerCase().includes(q)) ||
          (c.cnpjCpf && c.cnpjCpf.toLowerCase().includes(q)) ||
          (c.cepTelefone && c.cepTelefone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      });
    }
  };

  // =========================================================================
  // 3. MÓDULO DE ORÇAMENTOS (ORCAMENTOS & STATUS)
  // =========================================================================

  const orcamentos = {
    // Lista orçamentos com filtro opcional por status ou texto
    listar: function (filtro = {}) {
      let lista = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
      if (!Array.isArray(lista)) lista = [];

      if (filtro.status && filtro.status !== "todos") {
        lista = lista.filter((o) => (o.status || "pendente").toLowerCase() === filtro.status.toLowerCase());
      }

      if (filtro.busca && filtro.busca.trim().length > 0) {
        const q = filtro.busca.toLowerCase().trim();
        lista = lista.filter((o) => {
          return (
            (o.id && o.id.toLowerCase().includes(q)) ||
            (o.clienteNome && o.clienteNome.toLowerCase().includes(q)) ||
            (o.vendedor && o.vendedor.toLowerCase().includes(q))
          );
        });
      }

      return lista;
    },

    // Obtém orçamento específico por ID / Número
    obter: function (id) {
      const lista = orcamentos.listar();
      return lista.find((o) => o.id === id) || null;
    },

    // Salva ou atualiza um orçamento
    salvar: function (dadosOrcamento) {
      if (!dadosOrcamento || !dadosOrcamento.metadados) {
        throw new Error("Metadados do orçamento são obrigatórios");
      }

      const meta = dadosOrcamento.metadados;
      const clienteNome = (meta.cliente && meta.cliente.nome) ? meta.cliente.nome.trim() : "Cliente Balcão";
      const itens = Array.isArray(dadosOrcamento.itens) ? dadosOrcamento.itens : [];

      const subtotal = itens.reduce(
        (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
        0
      );
      const frete = Number(meta.frete) || 0;
      const desconto = Number(meta.desconto) || 0;
      const total = Math.max(0, subtotal + frete - desconto);

      // Auto-cadastra/atualiza o cliente na base de clientes
      if (meta.cliente && meta.cliente.nome) {
        clientes.salvar(meta.cliente);
      }

      const registro = {
        id: meta.numero,
        dataHoraSalvo: new Date().toISOString(),
        vendedor: dadosOrcamento.vendedor || (state.usuarioAtual ? state.usuarioAtual.nome : "Operador"),
        clienteNome: clienteNome,
        status: dadosOrcamento.status || meta.status || "pendente", // pendente | aprovado | faturado | cancelado
        total: total,
        itensQtd: itens.length,
        metadados: JSON.parse(JSON.stringify(meta)),
        itens: JSON.parse(JSON.stringify(itens))
      };

      const lista = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
      const idx = lista.findIndex((o) => o.id === registro.id);

      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...registro };
      } else {
        lista.unshift(registro);
      }

      // Mantém até 100 propostas locais
      if (lista.length > 100) lista.length = 100;

      gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, lista);

      chamarApiOuLocal("/api/orcamentos", {
        method: "POST",
        body: JSON.stringify(registro)
      }, () => registro);

      return registro;
    },

    // Atualiza apenas o status comercial do orçamento
    atualizarStatus: function (id, novoStatus) {
      const lista = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
      const idx = lista.findIndex((o) => o.id === id);
      if (idx >= 0) {
        lista[idx].status = novoStatus;
        lista[idx].statusAtualizadoEm = new Date().toISOString();
        gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, lista);

        chamarApiOuLocal(`/api/orcamentos/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: novoStatus })
        }, () => lista[idx]);

        return lista[idx];
      }
      return null;
    },

    // Exclui um orçamento
    excluir: function (id) {
      let lista = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
      const antes = lista.length;
      lista = lista.filter((o) => o.id !== id);
      const excluiu = lista.length < antes;

      if (excluiu) {
        gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, lista);
        chamarApiOuLocal(`/api/orcamentos/${encodeURIComponent(id)}`, {
          method: "DELETE"
        }, () => true);
      }
      return excluiu;
    }
  };

  // =========================================================================
  // 4. MÓDULO DE GESTÃO DO CATÁLOGO, PRODUTOS E BANNER (CMS ADMIN)
  // =========================================================================

  const CHAVES_PALETAS = [
    "coresBambuLab",
    "coresMaxPrint",
    "coresPlaSilk",
    "coresPetg",
    "coresTpu",
    "coresAbsEspeciais"
  ];

  const catalogo = {
    // Obtém customizações salvas localmente
    obterCustomizacoes: function () {
      return lerLocal(STORAGE_KEYS.CATALOGO_CUSTOM, null);
    },

    // Aplica customizações salvas sobre window.SITE_DATA
    aplicarCustomizacoes: function (customObj) {
      if (typeof window === "undefined" || !window.SITE_DATA) return false;
      const custom = customObj || catalogo.obterCustomizacoes();
      if (!custom || typeof custom !== "object") return false;

      if (custom.bannerPromocao && typeof custom.bannerPromocao === "object") {
        window.SITE_DATA.bannerPromocao = {
          ...(window.SITE_DATA.bannerPromocao || {}),
          ...JSON.parse(JSON.stringify(custom.bannerPromocao))
        };
      }

      if (Array.isArray(custom.catalogo) && custom.catalogo.length > 0) {
        window.SITE_DATA.catalogo = JSON.parse(JSON.stringify(custom.catalogo));
      }

      CHAVES_PALETAS.forEach((chave) => {
        if (Array.isArray(custom[chave]) && custom[chave].length > 0) {
          window.SITE_DATA[chave] = JSON.parse(JSON.stringify(custom[chave]));
        }
      });

      return true;
    },

    // Persiste o estado atual do window.SITE_DATA no localStorage e no servidor local
    persistirEstadoAtual: async function () {
      if (typeof window === "undefined" || !window.SITE_DATA) return false;

      const payload = {
        atualizadoEm: new Date().toISOString(),
        bannerPromocao: window.SITE_DATA.bannerPromocao || {},
        catalogo: window.SITE_DATA.catalogo || []
      };

      CHAVES_PALETAS.forEach((chave) => {
        if (Array.isArray(window.SITE_DATA[chave])) {
          payload[chave] = window.SITE_DATA[chave];
        }
      });

      gravarLocal(STORAGE_KEYS.CATALOGO_CUSTOM, payload);

      await chamarApiOuLocal(
        "/api/catalogo",
        {
          method: "POST",
          body: JSON.stringify(payload)
        },
        () => payload
      );

      return true;
    },

    // Salva alterações no Banner Principal de Promoção
    salvarBanner: async function (novoBanner) {
      if (typeof window === "undefined" || !window.SITE_DATA) return null;
      window.SITE_DATA.bannerPromocao = {
        ...(window.SITE_DATA.bannerPromocao || {}),
        ...novoBanner
      };
      await catalogo.persistirEstadoAtual();
      return window.SITE_DATA.bannerPromocao;
    },

    // Salva ou adiciona um produto no catálogo
    salvarProduto: async function (dadosProduto) {
      if (typeof window === "undefined" || !window.SITE_DATA || !dadosProduto) return null;
      const lista = window.SITE_DATA.catalogo || [];
      const id = (dadosProduto.id || ("prod-" + Date.now())).trim();
      dadosProduto.id = id;

      const idx = lista.findIndex((p) => p.id === id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...dadosProduto };
      } else {
        lista.push(dadosProduto);
      }

      window.SITE_DATA.catalogo = lista;
      await catalogo.persistirEstadoAtual();
      return dadosProduto;
    },

    // Exclui um produto do catálogo
    excluirProduto: async function (idProduto) {
      if (typeof window === "undefined" || !window.SITE_DATA) return false;
      const antes = (window.SITE_DATA.catalogo || []).length;
      window.SITE_DATA.catalogo = (window.SITE_DATA.catalogo || []).filter((p) => p.id !== idProduto);
      const excluiu = window.SITE_DATA.catalogo.length < antes;
      if (excluiu) {
        await catalogo.persistirEstadoAtual();
      }
      return excluiu;
    },

    // Salva alterações na paleta de cores de uma linha de filamento
    salvarPaletaCores: async function (chavePaleta, novaListaCores) {
      if (typeof window === "undefined" || !window.SITE_DATA) return false;
      if (!CHAVES_PALETAS.includes(chavePaleta) || !Array.isArray(novaListaCores)) return false;
      window.SITE_DATA[chavePaleta] = novaListaCores;
      await catalogo.persistirEstadoAtual();
      return true;
    },

    // Restaura todo o catálogo e banner para o padrão original de fábrica
    restaurarPadraoFabrica: async function () {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.CATALOGO_CUSTOM);
      }
      if (SITE_DATA_FACTORY && typeof window !== "undefined") {
        window.SITE_DATA = JSON.parse(JSON.stringify(SITE_DATA_FACTORY));
      }
      await chamarApiOuLocal(
        "/api/catalogo",
        {
          method: "DELETE"
        },
        () => true
      );
      return true;
    },

    // Gera o conteúdo completo do arquivo js/dados.js pronto para download ou gravação
    gerarConteudoDadosJs: function () {
      const dados = (typeof window !== "undefined" && window.SITE_DATA) ? window.SITE_DATA : {};
      return (
        "/**\n" +
        " * CATÁLOGO COMPLETO — LOJA SJ 3D (UMUARAMA - PR)\n" +
        " * Arquivo atualizado pelo Painel Administrativo (/admin) em " + new Date().toLocaleString("pt-BR") + "\n" +
        " */\n\n" +
        "window.SITE_DATA = " +
        JSON.stringify(dados, null, 2) +
        ";\n"
      );
    },

    // Baixa o arquivo dados.js atualizado no computador do Administrador
    baixarArquivoDadosJs: function () {
      const codigo = catalogo.gerarConteudoDadosJs();
      const blob = new Blob([codigo], { type: "application/javascript;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dados.js";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // =========================================================================
  // 5. MÓDULO DE BACKUP & EXPORTAÇÃO
  // =========================================================================

  const backup = {
    // Exporta base completa em formato JSON
    exportarJson: function () {
      const dump = {
        versao: "1.0.0",
        exportadoEm: new Date().toISOString(),
        loja: window.SITE_DATA ? window.SITE_DATA.loja : {},
        usuarios: auth.listarUsuarios(),
        clientes: clientes.listar(),
        orcamentos: orcamentos.listar(),
        catalogoCustom: catalogo.obterCustomizacoes()
      };
      return JSON.stringify(dump, null, 2);
    },

    // Baixa o arquivo .json diretamente no computador
    baixarBackupArquivo: function () {
      const json = backup.exportarJson();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dataStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup_lojasj3d_dados_${dataStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    // Restaura base completa a partir de texto JSON
    importarJson: function (jsonString) {
      try {
        const dados = JSON.parse(jsonString);
        if (!dados || typeof dados !== "object") {
          return { sucesso: false, mensagem: "Arquivo JSON inválido." };
        }

        if (Array.isArray(dados.usuarios) && dados.usuarios.length > 0) {
          gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, dados.usuarios);
        }

        if (Array.isArray(dados.clientes)) {
          gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, dados.clientes);
        }

        if (Array.isArray(dados.orcamentos)) {
          gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, dados.orcamentos);
        }

        if (dados.catalogoCustom && typeof dados.catalogoCustom === "object") {
          gravarLocal(STORAGE_KEYS.CATALOGO_CUSTOM, dados.catalogoCustom);
          catalogo.aplicarCustomizacoes(dados.catalogoCustom);
        }

        return {
          sucesso: true,
          totalUsuarios: (dados.usuarios || []).length,
          totalClientes: (dados.clientes || []).length,
          totalOrcamentos: (dados.orcamentos || []).length
        };
      } catch (e) {
        return { sucesso: false, mensagem: "Erro ao processar JSON: " + e.message };
      }
    }
  };

  // Auto-inicialização
  inicializarTabelas();
  catalogo.aplicarCustomizacoes();
  testarConexaoServidor().then((conectado) => {
    if (conectado && typeof window !== "undefined" && window.fetch) {
      fetch("/api/catalogo")
        .then((r) => (r.ok ? r.json() : null))
        .then((remoto) => {
          if (remoto && remoto.catalogo && Array.isArray(remoto.catalogo)) {
            gravarLocal(STORAGE_KEYS.CATALOGO_CUSTOM, remoto);
            catalogo.aplicarCustomizacoes(remoto);
            window.dispatchEvent(new CustomEvent("sj-catalogo-sincronizado"));
          }
        })
        .catch(() => {});
    }
  });

  return {
    auth,
    clientes,
    orcamentos,
    catalogo,
    backup,
    versao: "1.1.0",
    estaConectadoAoServidor: () => state.conectadoComServidor
  };
});


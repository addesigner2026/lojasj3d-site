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
    CATALOGO_CUSTOM: "sj_db_catalogo_custom_v2"
  };

  // Snapshot original do SITE_DATA para permitir restaurar padrão de fábrica
  const SITE_DATA_FACTORY =
    typeof window !== "undefined" && window.SITE_DATA
      ? JSON.parse(JSON.stringify(window.SITE_DATA))
      : null;

  const ADMIN_MASTER_EMAIL = "jt.designer21@gmail.com";

  // Função utilitária de hashing SHA-256 no navegador para proteger senhas contra exposição em texto plano
  async function hashSenha(senha) {
    if (!senha) return "";
    try {
      if (typeof window !== "undefined" && window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
        const buffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(senha));
        return Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch (_) {}
    let hash = 0;
    for (let i = 0; i < senha.length; i++) {
      hash = (hash << 5) - hash + senha.charCodeAt(i);
      hash |= 0;
    }
    return "legacy_" + Math.abs(hash).toString(16);
  }

  // Administrador Oficial Master da Loja SJ 3D (senha protegida com hash criptográfico SHA-256)
  const USUARIO_PADRAO = {
    id: "usr-admin-master",
    nome: "Thiago Novais (Admin Oficial)",
    email: ADMIN_MASTER_EMAIL,
    senhaHash: "84f42efb145bdfb59d0a60ae69cbc65356e0dd74b505b3ede2392acf541693ba",
    cargo: "Administrador Oficial",
    tipo: "operador",
    status: "aprovado",
    isMaster: true,
    foto: null,
    ativo: true,
    criadoEm: "2026-11-06T00:00:00.000Z"
  };

  const CLIENTES_PADRAO = [
    {
      id: "cli-1",
      nome: "Cliente Balcão - Loja SJ 3D",
      cnpjCpf: "66.275.129/0001-10",
      endereco: "Avenida Portugal, 6759",
      bairroCidadeUf: "Zona 1A - Umuarama/PR",
      cepTelefone: "(44) 99135-1318",
      email: "jt.designer21@gmail.com"
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

  function normalizarListaUsuarios(lista) {
    let usuarios = Array.isArray(lista) ? lista : [];
    // Remove o antigo usuário padrão de demonstração (contato@gruposj.com.br / 123456)
    usuarios = usuarios.filter(
      (u) => u && u.id !== "usr-admin-1" && String(u.email || "").toLowerCase() !== "contato@gruposj.com.br"
    );

    const idxMaster = usuarios.findIndex(
      (u) => String(u.email || "").toLowerCase() === ADMIN_MASTER_EMAIL
    );

    if (idxMaster === -1) {
      usuarios.unshift({ ...USUARIO_PADRAO });
    } else {
      usuarios[idxMaster] = {
        ...USUARIO_PADRAO,
        ...usuarios[idxMaster],
        email: ADMIN_MASTER_EMAIL,
        senhaHash: usuarios[idxMaster].senhaHash || USUARIO_PADRAO.senhaHash,
        status: "aprovado",
        isMaster: true,
        ativo: true
      };
    }

    return usuarios.map((u) => {
      const ehMaster = String(u.email || "").toLowerCase() === ADMIN_MASTER_EMAIL;
      const status = ehMaster ? "aprovado" : (u.status || (u.ativo ? "aprovado" : "pendente"));
      return {
        ...u,
        status,
        isMaster: ehMaster,
        ativo: status === "aprovado"
      };
    });
  }

  // Inicializa tabelas locais se estiverem vazias
  function inicializarTabelas() {
    const usuariosBrutos = lerLocal(STORAGE_KEYS.USUARIOS_TABELA, null);
    const usuariosNormalizados = normalizarListaUsuarios(usuariosBrutos);
    gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuariosNormalizados);

    const clientes = lerLocal(STORAGE_KEYS.CLIENTES_TABELA, null);
    if (!clientes || !Array.isArray(clientes)) {
      gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, CLIENTES_PADRAO);
    }

    const orcamentos = lerLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, null);
    if (!orcamentos || !Array.isArray(orcamentos)) {
      gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, []);
    }

    // Carrega sessão ativa e valida se ainda é um administrador aprovado
    const sessaoSalva = lerLocal(STORAGE_KEYS.USUARIO_ATIVO, null);
    if (sessaoSalva && sessaoSalva.email) {
      const emailSessao = String(sessaoSalva.email).toLowerCase();
      const encontrado = usuariosNormalizados.find(
        (u) => String(u.email || "").toLowerCase() === emailSessao
      );
      if (encontrado && encontrado.status === "aprovado" && encontrado.ativo) {
        state.usuarioAtual = {
          ...sessaoSalva,
          status: "aprovado",
          isMaster: encontrado.isMaster,
          ehEquipe: true
        };
      } else {
        state.usuarioAtual = null;
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEYS.USUARIO_ATIVO);
        }
      }
    } else {
      state.usuarioAtual = null;
    }
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
        const token = state.usuarioAtual?.supabaseSession?.access_token || state.usuarioAtual?.id || "";
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {})
        };
        const res = await fetch(endpoint, {
          ...options,
          headers
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

    // Sincronização em nuvem da lista de administradores/solicitações via Supabase (quando conectado)
    sincronizarEquipeNuvem: async function (listaSalvar = null) {
      try {
        if (typeof window === "undefined" || !window.SJ_SUPABASE || !window.SJ_SUPABASE.isConfigured()) {
          return normalizarListaUsuarios(lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]));
        }
        const supa = window.SJ_SUPABASE.getClient();
        if (!supa) return normalizarListaUsuarios(lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]));

        if (Array.isArray(listaSalvar)) {
          const norm = normalizarListaUsuarios(listaSalvar);
          gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, norm);
          await supa.from("configuracoes_site").upsert(
            {
              chave: "equipe_admin_v1",
              valor: { usuarios: norm },
              atualizado_em: new Date().toISOString()
            },
            { onConflict: "chave" }
          );
          return norm;
        } else {
          const { data, error } = await supa
            .from("configuracoes_site")
            .select("valor")
            .eq("chave", "equipe_admin_v1")
            .maybeSingle();

          const local = normalizarListaUsuarios(lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]));
          if (!error && data && data.valor && Array.isArray(data.valor.usuarios)) {
            const nuvem = data.valor.usuarios;
            // Mescla usuários da nuvem com os locais preservando todos os registros
            const mapa = new Map();
            local.forEach((u) => mapa.set(String(u.email || "").toLowerCase(), u));
            nuvem.forEach((u) => {
              const em = String(u.email || "").toLowerCase();
              if (em) mapa.set(em, { ...(mapa.get(em) || {}), ...u });
            });
            const mesclado = normalizarListaUsuarios(Array.from(mapa.values()));
            gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, mesclado);
            return mesclado;
          }
          return local;
        }
      } catch (_) {
        return normalizarListaUsuarios(lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]));
      }
    },

    // Login Administrativo Exclusivo na Área Restrita (E-mail e Senha)
    loginEmail: async function (email, senha) {
      const emailLimpo = (email || "").toLowerCase().trim();
      const senhaLimpa = (senha || "").trim();

      if (!emailLimpo || !senhaLimpa) {
        return { sucesso: false, mensagem: "Informe o e-mail e a senha de acesso administrativo." };
      }

      const usuarios = await auth.sincronizarEquipeNuvem();
      const user = usuarios.find((u) => String(u.email || "").toLowerCase() === emailLimpo);

      if (!user) {
        return {
          sucesso: false,
          mensagem: "Este e-mail não possui acesso à Área Restrita. Use a aba 'Solicitar Autorização' para enviar um pedido ao Administrador Oficial."
        };
      }

      if (user.status === "pendente") {
        return {
          sucesso: false,
          mensagem: `⏳ Solicitação em análise! O e-mail ${emailLimpo} aguarda liberação do Administrador Oficial.`
        };
      }

      if (user.status === "bloqueado" || user.ativo === false) {
        return {
          sucesso: false,
          mensagem: "🚫 Acesso bloqueado pelo Administrador Oficial da Loja SJ 3D."
        };
      }

      const hashCalc = await hashSenha(senhaLimpa);
      const confere = user.senhaHash === hashCalc || user.senhaHash === senhaLimpa;
      if (!confere) {
        return { sucesso: false, mensagem: "Senha administrativa incorreta." };
      }
      if (user.senhaHash === senhaLimpa) {
        user.senhaHash = hashCalc;
      }

      user.ultimoLogin = new Date().toISOString();
      await auth.sincronizarEquipeNuvem(usuarios);

      const ehMaster = emailLimpo === ADMIN_MASTER_EMAIL;
      state.usuarioAtual = {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: ehMaster ? "Administrador Oficial" : (user.cargo || "Administrador Autorizado"),
        tipo: "operador",
        status: "aprovado",
        isMaster: ehMaster,
        ehEquipe: true,
        foto: user.foto || null,
        ultimoLogin: user.ultimoLogin
      };

      gravarLocal(STORAGE_KEYS.USUARIO_ATIVO, state.usuarioAtual);
      notificarAuth();

      return { sucesso: true, usuario: state.usuarioAtual };
    },

    // Solicitação de Autorização para ser Administrador (Fica PENDENTE até o Admin Master liberar)
    registrar: async function ({ nome, email, senha, cargo = "Administrador Autorizado", motivo = "" }) {
      const nomeLimpo = (nome || "").trim();
      const emailLimpo = (email || "").toLowerCase().trim();
      const senhaLimpa = (senha || "").trim();

      if (!nomeLimpo || !emailLimpo || !senhaLimpa) {
        return { sucesso: false, mensagem: "Preencha nome, e-mail e a senha desejada." };
      }

      if (senhaLimpa.length < 4) {
        return { sucesso: false, mensagem: "A senha deve ter no mínimo 4 caracteres." };
      }

      const usuarios = await auth.sincronizarEquipeNuvem();
      const existente = usuarios.find((u) => String(u.email || "").toLowerCase() === emailLimpo);

      if (existente) {
        if (existente.status === "pendente") {
          return {
            sucesso: false,
            mensagem: "Já existe uma solicitação pendente para este e-mail. Aguarde a liberação do Administrador Oficial."
          };
        }
        if (existente.status === "bloqueado") {
          return {
            sucesso: false,
            mensagem: "Este e-mail foi bloqueado pelo Administrador Oficial."
          };
        }
        return {
          sucesso: false,
          mensagem: "Este e-mail já está autorizado! Utilize a aba 'Login Administrador' para entrar."
        };
      }

      const novaSolicitacao = {
        id: "usr-req-" + Date.now(),
        nome: nomeLimpo,
        email: emailLimpo,
        senhaHash: senhaLimpa,
        cargo: cargo || "Administrador Autorizado",
        motivo: (motivo || "").trim(),
        tipo: "operador",
        status: "pendente",
        isMaster: false,
        foto: null,
        ativo: false,
        criadoEm: new Date().toISOString(),
        ultimoLogin: null
      };

      usuarios.push(novaSolicitacao);
      await auth.sincronizarEquipeNuvem(usuarios);

      return {
        sucesso: true,
        pendente: true,
        usuario: {
          id: novaSolicitacao.id,
          nome: novaSolicitacao.nome,
          email: novaSolicitacao.email,
          cargo: novaSolicitacao.cargo,
          status: "pendente"
        },
        mensagem: "✅ Solicitação enviada com sucesso! O Administrador Oficial receberá o aviso no painel da Área Restrita para liberar seu acesso."
      };
    },

    // Aprovar (Liberar) ou Bloquear um usuário no painel do Administrador
    alterarStatusUsuario: async function (idOuEmail, novoStatus) {
      const alvo = String(idOuEmail || "").toLowerCase().trim();
      const usuarios = await auth.sincronizarEquipeNuvem();
      const idx = usuarios.findIndex(
        (u) => String(u.id || "").toLowerCase() === alvo || String(u.email || "").toLowerCase() === alvo
      );

      if (idx === -1) {
        return { sucesso: false, mensagem: "Usuário não encontrado." };
      }

      if (String(usuarios[idx].email || "").toLowerCase() === ADMIN_MASTER_EMAIL) {
        return { sucesso: false, mensagem: "O Administrador Oficial Master não pode ser bloqueado." };
      }

      usuarios[idx].status = novoStatus;
      usuarios[idx].ativo = novoStatus === "aprovado";
      usuarios[idx].atualizadoEm = new Date().toISOString();

      await auth.sincronizarEquipeNuvem(usuarios);
      return {
        sucesso: true,
        usuario: usuarios[idx],
        mensagem:
          novoStatus === "aprovado"
            ? `✅ Acesso administrativo LIBERADO para ${usuarios[idx].email}!`
            : `🚫 Acesso administrativo BLOQUEADO para ${usuarios[idx].email}.`
      };
    },

    // Excluir solicitação ou usuário (exceto Admin Master)
    removerUsuario: async function (idOuEmail) {
      const alvo = String(idOuEmail || "").toLowerCase().trim();
      const usuarios = await auth.sincronizarEquipeNuvem();
      const user = usuarios.find(
        (u) => String(u.id || "").toLowerCase() === alvo || String(u.email || "").toLowerCase() === alvo
      );

      if (!user) {
        return { sucesso: false, mensagem: "Registro não encontrado." };
      }

      if (String(user.email || "").toLowerCase() === ADMIN_MASTER_EMAIL) {
        return { sucesso: false, mensagem: "O Administrador Oficial Master não pode ser removido." };
      }

      const filtrados = usuarios.filter(
        (u) => String(u.id || "").toLowerCase() !== alvo && String(u.email || "").toLowerCase() !== alvo
      );
      await auth.sincronizarEquipeNuvem(filtrados);
      return { sucesso: true, mensagem: `Registro de ${user.email} removido com sucesso.` };
    },

    // Alterar senha do Administrador logado
    alterarSenhaAdmin: async function (email, senhaAtual, novaSenha) {
      const emailLimpo = String(email || "").toLowerCase().trim();
      const sAtual = String(senhaAtual || "").trim();
      const sNova = String(novaSenha || "").trim();

      if (!sAtual || !sNova) {
        return { sucesso: false, mensagem: "Preencha a senha atual e a nova senha." };
      }
      if (sNova.length < 4) {
        return { sucesso: false, mensagem: "A nova senha deve ter pelo menos 4 caracteres." };
      }

      const usuarios = await auth.sincronizarEquipeNuvem();
      const idx = usuarios.findIndex((u) => String(u.email || "").toLowerCase() === emailLimpo);

      if (idx === -1) {
        return { sucesso: false, mensagem: "Administrador não localizado." };
      }

      if (usuarios[idx].senhaHash !== sAtual) {
        return { sucesso: false, mensagem: "A senha atual informada está incorreta." };
      }

      usuarios[idx].senhaHash = sNova;
      usuarios[idx].atualizadoEm = new Date().toISOString();
      await auth.sincronizarEquipeNuvem(usuarios);

      return { sucesso: true, mensagem: "✅ Senha administrativa alterada com sucesso!" };
    },

    // Encerra a sessão administrativa
    logout: async function () {
      state.usuarioAtual = null;
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEYS.USUARIO_ATIVO);
      }
      notificarAuth();
      return true;
    },

    // Lista todos os usuários e solicitações (sem expor senhaHash)
    listarUsuarios: function () {
      const usuarios = normalizarListaUsuarios(lerLocal(STORAGE_KEYS.USUARIOS_TABELA, [USUARIO_PADRAO]));
      return usuarios.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cargo: u.cargo,
        motivo: u.motivo || "",
        tipo: u.tipo,
        status: u.status || (u.ativo ? "aprovado" : "pendente"),
        isMaster: Boolean(u.isMaster || String(u.email || "").toLowerCase() === ADMIN_MASTER_EMAIL),
        foto: u.foto,
        ativo: u.status === "aprovado",
        criadoEm: u.criadoEm,
        ultimoLogin: u.ultimoLogin
      }));
    }
  };

  // =========================================================================
  // 2. MÓDULO DE CLIENTES & LEADS (CRM BANCO DE DADOS DE CLIENTES)
  // =========================================================================

  const clientes = {
    // Retorna todos os clientes e leads salvos
    listar: function () {
      const lista = lerLocal(STORAGE_KEYS.CLIENTES_TABELA, CLIENTES_PADRAO);
      return Array.isArray(lista) ? lista : CLIENTES_PADRAO;
    },

    // Sincroniza a base de clientes/leads com o Supabase (configuracoes_site -> clientes_leads_v1)
    sincronizarNuvem: async function (listaParaSalvar = null) {
      try {
        if (typeof window === "undefined" || !window.SJ_SUPABASE || !window.SJ_SUPABASE.isConfigured()) {
          return clientes.listar();
        }
        const supa = window.SJ_SUPABASE.getClient();
        if (!supa) return clientes.listar();

        if (Array.isArray(listaParaSalvar)) {
          gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, listaParaSalvar);
          await supa.from("configuracoes_site").upsert(
            {
              chave: "clientes_leads_v1",
              valor: { clientes: listaParaSalvar },
              atualizado_em: new Date().toISOString()
            },
            { onConflict: "chave" }
          );
          return listaParaSalvar;
        } else {
          const { data, error } = await supa
            .from("configuracoes_site")
            .select("valor")
            .eq("chave", "clientes_leads_v1")
            .maybeSingle();

          const local = clientes.listar();
          if (!error && data && data.valor && Array.isArray(data.valor.clientes)) {
            const nuvem = data.valor.clientes;
            const mapa = new Map();
            const gerarChave = (c) =>
              String(c.id || c.email || c.cnpjCpf || c.cpf || c.nome || "").trim().toLowerCase();
            local.forEach((c) => {
              const k = gerarChave(c);
              if (k) mapa.set(k, c);
            });
            nuvem.forEach((c) => {
              const k = gerarChave(c);
              if (k) mapa.set(k, { ...(mapa.get(k) || {}), ...c });
            });
            const mesclado = Array.from(mapa.values());
            gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, mesclado);
            return mesclado;
          }
          return local;
        }
      } catch (_) {
        return clientes.listar();
      }
    },

    // Salva ou atualiza os dados de um cliente/lead (incluindo dados fiscais e origem do lead)
    salvar: function (dadosCliente) {
      if (!dadosCliente || !dadosCliente.nome) return null;

      const lista = clientes.listar();
      const nomeLimpo = dadosCliente.nome.trim();
      const cnpjCpfLimpo = (dadosCliente.cnpjCpf || dadosCliente.cpf || "").trim();
      const emailLimpo = (dadosCliente.email || "").trim().toLowerCase();
      const idAlvo = (dadosCliente.id || "").trim();

      // Busca por ID, E-mail, CPF/CNPJ se preenchido, ou por Nome
      const idx = lista.findIndex((c) => {
        if (idAlvo && c.id && c.id === idAlvo) return true;
        if (emailLimpo && c.email && c.email.trim().toLowerCase() === emailLimpo) return true;
        if (cnpjCpfLimpo && (c.cnpjCpf || c.cpf) && (c.cnpjCpf || c.cpf).trim() === cnpjCpfLimpo) return true;
        return c.nome && c.nome.toLowerCase() === nomeLimpo.toLowerCase();
      });

      const existente = idx >= 0 ? lista[idx] : {};

      const logradouro = (dadosCliente.logradouro ?? existente.logradouro ?? "").trim();
      const numero = (dadosCliente.numero ?? existente.numero ?? "").trim();
      const complemento = (dadosCliente.complemento ?? existente.complemento ?? "").trim();
      const bairro = (dadosCliente.bairro ?? existente.bairro ?? "").trim();
      const cidade = (dadosCliente.cidade ?? existente.cidade ?? "").trim();
      const uf = (dadosCliente.uf ?? existente.uf ?? "").trim().toUpperCase();
      const cep = (dadosCliente.cep ?? existente.cep ?? "").trim();
      const whatsapp = (dadosCliente.whatsapp || dadosCliente.cepTelefone || existente.whatsapp || existente.cepTelefone || "").trim();

      const enderecoMontado = (dadosCliente.endereco || "").trim() ||
        [logradouro, numero ? `nº ${numero}` : "", complemento].filter(Boolean).join(", ") ||
        (existente.endereco || "");
      const bairroCidadeMontado = (dadosCliente.bairroCidadeUf || "").trim() ||
        [bairro, [cidade, uf].filter(Boolean).join("/")].filter(Boolean).join(" - ") ||
        (existente.bairroCidadeUf || "");

      const clientePronto = {
        ...existente,
        id: idAlvo || existente.id || ("cli-" + Date.now()),
        nome: nomeLimpo,
        cnpjCpf: cnpjCpfLimpo || existente.cnpjCpf || "",
        cpf: cnpjCpfLimpo || existente.cpf || "",
        inscricaoEstadual: (dadosCliente.inscricaoEstadual ?? existente.inscricaoEstadual ?? "").trim(),
        precisaNotaFiscal: dadosCliente.precisaNotaFiscal !== undefined ? Boolean(dadosCliente.precisaNotaFiscal) : Boolean(existente.precisaNotaFiscal),
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        whatsapp,
        endereco: enderecoMontado,
        bairroCidadeUf: bairroCidadeMontado,
        cepTelefone: [cep ? `CEP ${cep}` : "", whatsapp].filter(Boolean).join(" • ") || whatsapp,
        email: emailLimpo || existente.email || "",
        origem: dadosCliente.origem || existente.origem || "Cadastro no Site",
        observacoes: (dadosCliente.observacoes ?? existente.observacoes ?? "").trim(),
        cadastroAprovado: dadosCliente.cadastroAprovado !== undefined ? Boolean(dadosCliente.cadastroAprovado) : Boolean(existente.cadastroAprovado),
        criadoEm: existente.criadoEm || dadosCliente.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      if (idx >= 0) {
        lista[idx] = clientePronto;
      } else {
        lista.unshift(clientePronto);
      }

      gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, lista);
      clientes.sincronizarNuvem(lista).catch(() => {});

      chamarApiOuLocal("/api/clientes", {
        method: "POST",
        body: JSON.stringify(clientePronto)
      }, () => clientePronto);

      return clientePronto;
    },

    // Exclui um cliente/lead pelo ID
    excluir: function (id) {
      if (!id) return false;
      const lista = clientes.listar();
      const novaLista = lista.filter((c) => String(c.id) !== String(id));
      if (novaLista.length === lista.length) return false;
      gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, novaLista);
      clientes.sincronizarNuvem(novaLista).catch(() => {});
      return true;
    },

    // Busca clientes por termo (para sugestões, autocompletar e filtro de leads)
    buscar: function (termo) {
      if (!termo || termo.trim().length === 0) return clientes.listar();
      const q = termo.toLowerCase().trim();
      const lista = clientes.listar();
      return lista.filter((c) => {
        return (
          (c.nome && c.nome.toLowerCase().includes(q)) ||
          (c.cnpjCpf && c.cnpjCpf.toLowerCase().includes(q)) ||
          (c.cpf && c.cpf.toLowerCase().includes(q)) ||
          (c.whatsapp && c.whatsapp.toLowerCase().includes(q)) ||
          (c.cepTelefone && c.cepTelefone.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.bairroCidadeUf && c.bairroCidadeUf.toLowerCase().includes(q)) ||
          (c.cidade && c.cidade.toLowerCase().includes(q))
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
        // Smart merge: preserva todos os novos itens de dados.js (ex: 22 peças de reposição)
        const customMap = new Map();
        custom.catalogo.forEach((c) => {
          if (c && c.id) customMap.set(c.id, c);
        });

        const legadosRemovidos = ["peca-hotend-a1", "peca-placa-pei", "peca-extrusora-ams"];
        legadosRemovidos.forEach((legId) => customMap.delete(legId));

        window.SITE_DATA.catalogo = (window.SITE_DATA.catalogo || []).map((prod) => {
          if (customMap.has(prod.id)) {
            const editado = customMap.get(prod.id);
            customMap.delete(prod.id);
            return { ...prod, ...editado };
          }
          return prod;
        });

        // Adiciona itens novos criados pelo usuário no painel admin
        customMap.forEach((itemCustom) => {
          if (itemCustom && itemCustom.id) {
            window.SITE_DATA.catalogo.push(itemCustom);
          }
        });
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

    // Restaura base completa a partir de texto JSON com sanitização e validação de segurança
    importarJson: function (jsonString) {
      try {
        if (!jsonString || typeof jsonString !== "string" || jsonString.length > 5 * 1024 * 1024) {
          return { sucesso: false, mensagem: "Arquivo de backup inválido ou muito grande (máximo 5 MB)." };
        }

        // Prevenção contra Prototype Pollution
        if (jsonString.includes("__proto__") || jsonString.includes("constructor") || jsonString.includes("prototype")) {
          return { sucesso: false, mensagem: "Tentativa de injeção de propriedades maliciosas rejeitada." };
        }

        const dados = JSON.parse(jsonString);
        if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
          return { sucesso: false, mensagem: "Estrutura do arquivo JSON inválida." };
        }

        if (Array.isArray(dados.usuarios) && dados.usuarios.length > 0) {
          // Sanitiza para não aceitar tipos maliciosos
          const usuariosSanitizados = dados.usuarios
            .filter((u) => u && typeof u === "object" && u.email && u.nome)
            .map((u) => ({
              id: String(u.id || "usr-" + Date.now()),
              nome: String(u.nome).slice(0, 100),
              email: String(u.email).slice(0, 150),
              cargo: String(u.cargo || "Vendedor").slice(0, 50),
              tipo: u.tipo === "admin" || u.tipo === "operador" ? u.tipo : "operador",
              foto: u.foto ? String(u.foto) : null,
              ativo: Boolean(u.ativo !== false),
              criadoEm: u.criadoEm || new Date().toISOString()
            }));
          gravarLocal(STORAGE_KEYS.USUARIOS_TABELA, usuariosSanitizados);
        }

        if (Array.isArray(dados.clientes)) {
          const clientesSanitizados = dados.clientes
            .filter((c) => c && typeof c === "object" && c.nome)
            .map((c) => ({
              id: String(c.id || "cli-" + Date.now()),
              nome: String(c.nome).slice(0, 120),
              cnpjCpf: String(c.cnpjCpf || "").slice(0, 30),
              endereco: String(c.endereco || "").slice(0, 200),
              bairroCidadeUf: String(c.bairroCidadeUf || "").slice(0, 100),
              cepTelefone: String(c.cepTelefone || "").slice(0, 50),
              email: String(c.email || "").slice(0, 150)
            }));
          gravarLocal(STORAGE_KEYS.CLIENTES_TABELA, clientesSanitizados);
        }

        if (Array.isArray(dados.orcamentos)) {
          const orcamentosSanitizados = dados.orcamentos
            .filter((o) => o && typeof o === "object" && (o.id || o.metadados?.numero))
            .map((o) => ({
              ...o,
              id: String(o.id || o.metadados?.numero)
            }));
          gravarLocal(STORAGE_KEYS.ORCAMENTOS_TABELA, orcamentosSanitizados);
        }

        if (dados.catalogoCustom && typeof dados.catalogoCustom === "object" && !Array.isArray(dados.catalogoCustom)) {
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


/**
 * CLIENTE SUPABASE & GUARDIÃO DE ROTAS PROTEGIDAS — LOJA SJ 3D
 * =====================================================================
 * Este arquivo gerencia:
 * 1. Inicialização segura do cliente Supabase (usando a Publishable / Anon Key).
 * 2. Supabase Auth (E-mail/Senha, Google OAuth, Sessão Persistente).
 * 3. Guardião de Rotas Protegidas (#admin, /admin, #orcamento).
 * 4. Sincronização automática com window.SJ_DB.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SJ_SUPABASE = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STORAGE_KEY_CONFIG = "sj_supabase_config_v1";

  // Configuração Padrão (Você pode preencher aqui ou colar no painel /admin)
  // IMPORTANTE: Use apenas a URL do Projeto e a chave Anon/Publishable pública.
  // NUNCA utilize a service_role key no frontend.
  const DEFAULT_CONFIG = {
    url: window.SUPABASE_URL || "https://tqeifmettwhwngeyzboh.supabase.co",
    anonKey: window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZWlmbWV0dHdod25nZXl6Ym9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MDM5NjUsImV4cCI6MjEwOTQ3OTk2NX0.cgc9bDqnscMv9PCe8ttB7aYlkAmuBYOrnT_j_ukUrX0"
  };

  let supabaseInstance = null;
  let authListenerSub = null;

  function obterConfiguracaoSalva() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_CONFIG);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.url && parsed.anonKey) {
            return parsed;
          }
        }
      }
    } catch (_) {}
    return DEFAULT_CONFIG;
  }

  function inicializarCliente() {
    if (supabaseInstance) return supabaseInstance;

    const config = obterConfiguracaoSalva();
    if (!config.url || !config.anonKey) {
      return null;
    }

    if (typeof window === "undefined" || !window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("[SJ_SUPABASE] Biblioteca @supabase/supabase-js não encontrada no escopo global.");
      return null;
    }

    try {
      supabaseInstance = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      console.log("[SJ_SUPABASE] Conectado ao projeto Supabase com sucesso:", config.url);
      configurarListenerAuth(supabaseInstance);
      return supabaseInstance;
    } catch (err) {
      console.error("[SJ_SUPABASE] Erro ao instanciar cliente Supabase:", err);
      return null;
    }
  }

  function configurarListenerAuth(client) {
    if (!client || authListenerSub) return;

    try {
      const { data } = client.auth.onAuthStateChange(async (event, session) => {
        console.log(`[SJ_SUPABASE Auth] Evento: ${event}`, session?.user?.email || "sem usuário");

        const usuarioFormatado = session?.user
          ? {
              id: session.user.id,
              nome:
                session.user.user_metadata?.name ||
                session.user.user_metadata?.nome ||
                session.user.email.split("@")[0],
              email: session.user.email,
              cargo: session.user.user_metadata?.cargo || "Vendedor",
              foto: session.user.user_metadata?.avatar_url || null,
              tipo: session.user.app_metadata?.provider === "google" ? "google" : "operador",
              supabaseSession: session
            }
          : null;

        // Atualiza estado no window.SJ_DB
        if (window.SJ_DB && window.SJ_DB.auth && typeof window.SJ_DB.auth.definirUsuarioAtivo === "function") {
          window.SJ_DB.auth.definirUsuarioAtivo(usuarioFormatado);
        }

        // Dispara evento customizado no navegador
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sj-auth-state-changed", {
              detail: { event, session, usuario: usuarioFormatado }
            })
          );
        }
      });
      authListenerSub = data?.subscription;
    } catch (e) {
      console.warn("[SJ_SUPABASE] Falha ao registrar onAuthStateChange:", e);
    }
  }

  // =========================================================================
  // MÓDULO AUTH WRAPPER
  // =========================================================================
  const auth = {
    // Retorna a sessão ativa atual
    obterSessao: async function () {
      const client = inicializarCliente();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session || null;
      } catch (err) {
        console.warn("[SJ_SUPABASE] Erro ao obter sessão:", err);
        return null;
      }
    },

    // Retorna o usuário autenticado com validação do servidor Supabase
    obterUsuario: async function () {
      const client = inicializarCliente();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) return null;
        return {
          id: data.user.id,
          nome:
            data.user.user_metadata?.name ||
            data.user.user_metadata?.nome ||
            data.user.email.split("@")[0],
          email: data.user.email,
          cargo: data.user.user_metadata?.cargo || "Vendedor",
          foto: data.user.user_metadata?.avatar_url || null
        };
      } catch (_) {
        return null;
      }
    },

    // Login com E-mail e Senha
    loginEmail: async function (emailOrObj, passwordArg) {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado. Usando base local." };
      }

      let rawEmail = "";
      let rawPass = "";
      if (typeof emailOrObj === "object" && emailOrObj !== null) {
        rawEmail = emailOrObj.email || "";
        rawPass = emailOrObj.password || "";
      } else {
        rawEmail = emailOrObj || "";
        rawPass = passwordArg || "";
      }

      const email = String(rawEmail).trim().toLowerCase();
      const password = String(rawPass).trim();

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) {
          return { sucesso: false, mensagem: traduzirErroAuth(error.message) };
        }

        return {
          sucesso: true,
          usuario: {
            id: data.user.id,
            nome: data.user.user_metadata?.name || data.user.email.split("@")[0],
            email: data.user.email,
            cargo: data.user.user_metadata?.cargo || "Vendedor",
            foto: data.user.user_metadata?.avatar_url || null
          }
        };
      } catch (err) {
        return { sucesso: false, mensagem: err.message || "Erro ao conectar com Supabase." };
      }
    },

    // Aliases para compatibilidade
    loginComEmail: async function (arg1, arg2) {
      return auth.loginEmail(arg1, arg2);
    },

    // Login com Google OAuth
    loginGoogle: async function () {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado." };
      }

      try {
        const redirectTo = window.location.origin + window.location.pathname;
        const { data, error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectTo,
            queryParams: {
              access_type: "offline",
              prompt: "consent"
            }
          }
        });

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true, url: data.url };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    loginComGoogle: async function () {
      return auth.loginGoogle();
    },

    // Cadastro de Novo Vendedor
    registrar: async function ({ nome, email, password, cargo = "Vendedor" }) {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado." };
      }

      try {
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          options: {
            data: {
              name: nome.trim(),
              cargo: cargo.trim()
            }
          }
        });

        if (error) {
          return { sucesso: false, mensagem: traduzirErroAuth(error.message) };
        }

        return {
          sucesso: true,
          requerConfirmacaoEmail: !data.session,
          usuario: data.user
            ? {
                id: data.user.id,
                nome: nome.trim(),
                email: data.user.email,
                cargo: cargo.trim()
              }
            : null
        };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Logout
    logout: async function () {
      const client = inicializarCliente();
      if (client) {
        try {
          await client.auth.signOut();
        } catch (_) {}
      }
      return true;
    }
  };

  // =========================================================================
  // GUARDIÃO DE ROTAS PROTEGIDAS (ADMIN CMS & EMISSÃO DE PROPOSTAS)
  // =========================================================================
  const guardiao = {
    // Lista de rotas que exigem usuário autenticado
    rotasProtegidas: ["#admin", "#orcamento", "/admin", "/admin/"],

    // Verifica se a rota solicitada é protegida
    ehRotaProtegida: function (rotaOuHash) {
      if (!rotaOuHash) return false;
      const alvo = rotaOuHash.toLowerCase();
      return guardiao.rotasProtegidas.some((r) => alvo === r || alvo.startsWith(r));
    },

    // Valida acesso: se a rota for protegida e o usuário não estiver logado,
    // interrompe o fluxo e dispara a abertura do modal de login.
    validarAcessoRota: async function (rotaOuHash, onPermitido, onBloqueado) {
      if (!guardiao.ehRotaProtegida(rotaOuHash)) {
        if (typeof onPermitido === "function") onPermitido();
        return true;
      }

      // Verifica se há usuário ativo (no Supabase ou fallback no SJ_DB)
      let usuarioAtivo = null;
      if (inicializarCliente()) {
        const sessao = await auth.obterSessao();
        if (sessao?.user) {
          usuarioAtivo = sessao.user;
        }
      }

      if (!usuarioAtivo && window.SJ_DB?.auth) {
        usuarioAtivo = window.SJ_DB.auth.getUsuarioAtual();
      }

      if (usuarioAtivo) {
        if (typeof onPermitido === "function") onPermitido(usuarioAtivo);
        return true;
      }

      console.warn(`[Guardiao Rotas] Acesso restrito a '${rotaOuHash}'. Solicitando autenticação.`);
      if (typeof onBloqueado === "function") {
        onBloqueado();
      } else if (typeof window.abrirModalAuthGoogle === "function") {
        window.abrirModalAuthGoogle(() => {
          if (typeof onPermitido === "function") onPermitido();
        });
      }
      return false;
    }
  };

  // Tradução amigável de erros frequentes do Supabase Auth
  function traduzirErroAuth(msg) {
    if (!msg) return "Erro desconhecido de autenticação.";
    const lower = msg.toLowerCase();
    if (lower.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (lower.includes("user already registered")) return "Este e-mail já está cadastrado.";
    if (lower.includes("password should be at least")) return "A senha deve ter no mínimo 6 caracteres.";
    if (lower.includes("email not confirmed")) return "Por favor, confirme seu e-mail antes de entrar.";
    return msg;
  }

  // =========================================================================
  // MÓDULO DE CLIENTES & CADASTRO PÚBLICO (INTEGRADO AO SUPABASE & SJ_DB)
  // =========================================================================
  const clientes = {
    // Cadastra ou atualiza um cliente no Supabase e na base local
    cadastrar: async function (dados) {
      if (!dados || !dados.nome) {
        return { sucesso: false, mensagem: "Nome é obrigatório para o cadastro." };
      }

      const client = inicializarCliente();
      const idGerado = dados.id || "cli-" + Date.now();
      const nomeLimpo = String(dados.nome || "").trim();
      const cnpjCpfLimpo = String(dados.cnpjCpf || dados.cpf || dados.cnpj || "").trim();
      const telefoneLimpo = String(dados.cepTelefone || dados.telefone || dados.whatsapp || "").trim();
      const emailLimpo = String(dados.email || "").trim().toLowerCase();
      const enderecoLimpo = String(dados.endereco || "").trim();
      const bairroCidadeUfLimpo = String(dados.bairroCidadeUf || "Umuarama/PR").trim();

      const payloadSupabase = {
        id: idGerado,
        nome: nomeLimpo,
        cnpj_cpf: cnpjCpfLimpo || null,
        endereco: enderecoLimpo || null,
        bairro_cidade_uf: bairroCidadeUfLimpo,
        cep_telefone: telefoneLimpo || null,
        email: emailLimpo || null,
        atualizado_em: new Date().toISOString()
      };

      let salvoNoSupabase = false;
      let mensagemErroSupabase = null;

      if (client) {
        try {
          const { error } = await client
            .from("clientes")
            .upsert(payloadSupabase, { onConflict: "id" });

          if (error) {
            console.warn("[SJ_SUPABASE] Aviso ao salvar cliente no Supabase:", error.message);
            mensagemErroSupabase = error.message;
          } else {
            salvoNoSupabase = true;
            console.log("[SJ_SUPABASE] Cliente salvo com sucesso no Supabase:", nomeLimpo);
          }
        } catch (err) {
          console.warn("[SJ_SUPABASE] Exceção ao gravar no Supabase:", err);
          mensagemErroSupabase = err.message;
        }
      }

      // Salva ou sincroniza também com o banco local (SJ_DB)
      let clienteLocal = null;
      if (window.SJ_DB?.clientes?.salvar) {
        clienteLocal = window.SJ_DB.clientes.salvar({
          id: idGerado,
          nome: nomeLimpo,
          cnpjCpf: cnpjCpfLimpo,
          endereco: enderecoLimpo,
          bairroCidadeUf: bairroCidadeUfLimpo,
          cepTelefone: telefoneLimpo,
          email: emailLimpo,
          tipoPessoa: dados.tipoPessoa || "pf",
          interesses: dados.interesses || []
        });
      }

      return {
        sucesso: true,
        id: idGerado,
        salvoNoSupabase,
        mensagemErroSupabase,
        cliente: clienteLocal || payloadSupabase
      };
    }
  };

  // Inicializa na carga
  inicializarCliente();

  return {
    getClient: inicializarCliente,
    isConfigured: () => Boolean(obterConfiguracaoSalva().url && obterConfiguracaoSalva().anonKey),
    getConfig: obterConfiguracaoSalva,
    salvarConfig: function (url, anonKey) {
      if (!url || !anonKey) return false;
      const cfg = { url: url.trim(), anonKey: anonKey.trim() };
      try {
        window.localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
        supabaseInstance = null;
        inicializarCliente();
        return true;
      } catch (e) {
        console.error("[SJ_SUPABASE] Erro ao salvar configuração:", e);
        return false;
      }
    },
    auth,
    clientes,
    guardiao
  };
});

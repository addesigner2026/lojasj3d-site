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
    } catch (_) { }
    return DEFAULT_CONFIG;
  }

  function inicializarCliente() {
    if (supabaseInstance) return supabaseInstance;

    const config = obterConfiguracaoSalva();
    if (!config.url || !config.anonKey) {
      return null;
    }

    const supaGlobal =
      typeof window !== "undefined"
        ? (window.supabase && typeof window.supabase.createClient === "function"
          ? window.supabase
          : window.supabaseJs && typeof window.supabaseJs.createClient === "function"
            ? window.supabaseJs
            : null)
        : null;

    if (!supaGlobal) {
      console.warn("[SJ_SUPABASE] Biblioteca @supabase/supabase-js não encontrada no escopo global, operando em modo local.");
      return null;
    }

    try {
      supabaseInstance = supaGlobal.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      configurarListenerAuth(supabaseInstance);
      return supabaseInstance;
    } catch (err) {
      return null;
    }
  }

  function configurarListenerAuth(client) {
    if (!client || authListenerSub) return;

    try {
      const { data } = client.auth.onAuthStateChange(async (event, session) => {
        if (!session?.user) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("sj-auth-state-changed", {
                detail: { event, session: null, usuario: null }
              })
            );
          }
          return;
        }

        const userMeta = session.user.user_metadata || {};
        const email = (session.user.email || "").toLowerCase().trim();

        // REGRA DE SEGURANÇA ESTRITA:
        // Qualquer autenticação via Supabase Auth no front-end da loja (Google OAuth ou Cadastro de Cliente)
        // é SEMPRE tratada exclusivamente como CLIENTE.
        // O login de Administrador ocorre estritamente pela Área Restrita com aprovação do Admin Oficial (jt.designer21@gmail.com).
        const usuarioFormatado = {
          id: session.user.id,
          nome:
            userMeta.name ||
            userMeta.nome ||
            email.split("@")[0],
          email: session.user.email,
          cargo: "Cliente",
          foto: userMeta.avatar_url || null,
          tipo: "cliente",
          ehEquipe: false,
          supabaseSession: session
        };

        // Dispara evento customizado no navegador para o portal do cliente
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

    // Login com Google OAuth (preserva destino interno seguro se informado)
    loginGoogle: async function (nextPath) {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado." };
      }

      try {
        const baseOrigin = (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("lojasj3d.com.br")))
          ? "https://www.lojasj3d.com.br"
          : (window.location.origin || "");
        const safeNext = (typeof nextPath === "string" && nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\"))
          ? nextPath
          : "";
        const pathActual = window.location.pathname || "/";
        const redirectTo = safeNext
          ? `${baseOrigin}${pathActual}?next=${encodeURIComponent(safeNext)}`
          : `${baseOrigin}${pathActual}`;
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

    loginComGoogle: async function (nextPath) {
      return auth.loginGoogle(nextPath);
    },

    obterNivelMfa: async function () {
      const client = inicializarCliente();
      if (!client?.auth?.mfa || typeof client.auth.mfa.getAuthenticatorAssuranceLevel !== "function") {
        return { currentLevel: "aal1", nextLevel: "aal1", requiresMfa: false };
      }
      try {
        const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error || !data) {
          return { currentLevel: "aal1", nextLevel: "aal1", requiresMfa: false };
        }
        const requiresMfa = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
        return {
          currentLevel: data.currentLevel || "aal1",
          nextLevel: data.nextLevel || "aal1",
          requiresMfa
        };
      } catch (_) {
        return { currentLevel: "aal1", nextLevel: "aal1", requiresMfa: false };
      }
    },

    verificarTotpMfa: async function (codigoRaw) {
      const client = inicializarCliente();
      if (!client?.auth?.mfa) {
        return { sucesso: false, mensagem: "Autenticação em duas etapas não disponível." };
      }
      const code = String(codigoRaw || "").replace(/\D/g, "").slice(0, 8);
      if (code.length < 6) {
        return { sucesso: false, mensagem: "Informe o código de 6 dígitos do aplicativo autenticador." };
      }
      try {
        const { data: factors, error: errF } = await client.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === "verified");
        if (errF || !totp) {
          return { sucesso: false, mensagem: "Nenhum fator TOTP verificado encontrado." };
        }
        const { error: errV } = await client.auth.mfa.challengeAndVerify({
          factorId: totp.id,
          code
        });
        if (errV) {
          return { sucesso: false, mensagem: "Código inválido ou expirado. Tente novamente." };
        }
        return { sucesso: true };
      } catch (_) {
        return { sucesso: false, mensagem: "Falha ao validar o código de verificação." };
      }
    },

    // Cadastro de Novo Usuário (Cliente em /conta ou Funcionário em /admin)
    // SEGURANÇA: accountType só aceita 'customer' ou 'staff' (e o trigger no banco valida novamente, nunca aceitando 'admin').
    registrar: async function ({ nome, email, password, cargo = "", telefone = "", endereco = "", accountType = "customer" }) {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado." };
      }

      const tipoSeguro = String(accountType || "customer").toLowerCase().trim() === "staff" ? "staff" : "customer";

      try {
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password.trim(),
          options: {
            data: {
              name: (nome || "").trim(),
              nome: (nome || "").trim(),
              cargo: (cargo || "").trim(),
              telefone: (telefone || "").trim(),
              endereco: (endereco || "").trim(),
              account_type: tipoSeguro
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
              nome: (nome || "").trim(),
              email: data.user.email,
              cargo: (cargo || "").trim(),
              accountType: tipoSeguro
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
        } catch (_) {
          try {
            await client.auth.signOut({ scope: "local" });
          } catch (_) { }
        }
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

      // Verifica se há usuário administrador aprovado ativo no SJ_DB (Área Restrita)
      let usuarioAdmin = null;
      if (window.SJ_DB?.auth) {
        const uLocal = window.SJ_DB.auth.getUsuarioAtual();
        if (uLocal) {
          const email = String(uLocal.email || "").toLowerCase();
          const status = String(uLocal.status || "").toLowerCase();
          const tipo = String(uLocal.tipo || "").toLowerCase();

          if (tipo !== "cliente" && status === "aprovado" && uLocal.ativo !== false) {
            usuarioAdmin = uLocal;
          } else if (email === "jt.designer21@gmail.com" && status === "aprovado") {
            usuarioAdmin = uLocal;
          }
        }
      }

      if (usuarioAdmin) {
        if (typeof onPermitido === "function") onPermitido(usuarioAdmin);
        return true;
      }

      console.warn(`[Guardiao Rotas] Acesso restrito a '${rotaOuHash}'. Solicitando autenticação administrativa.`);
      if (typeof onBloqueado === "function") {
        onBloqueado();
      } else if (typeof window.abrirModalAuthGoogle === "function") {
        window.abrirModalAuthGoogle(() => {
          if (typeof onPermitido === "function") onPermitido();
        }, "email");
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
      let userAuthId = null;
      if (client) {
        try {
          const sessao = (await client.auth.getSession())?.data?.session;
          if (sessao?.user?.id) {
            userAuthId = sessao.user.id;
          }
        } catch (_) { }
      }

      const idGerado = dados.id || userAuthId || ("cli-" + Date.now());
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
            mensagemErroSupabase = error.message;
          } else {
            salvoNoSupabase = true;
          }
        } catch (err) {
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

  // Módulo de Consentimentos e Gestão LGPD (Art. 7º e 8º)
  const consentimentos = {
    // Registra a prova de consentimento ou aceite de termos no Supabase
    registrar: async function (dados) {
      if (!dados || !dados.titularIdentificador || !dados.finalidade) {
        return { sucesso: false, mensagem: "Identificador e finalidade são obrigatórios." };
      }

      const client = inicializarCliente();
      const registro = {
        titular_identificador: String(dados.titularIdentificador).trim().toLowerCase(),
        titular_tipo: dados.titularTipo || "cliente",
        canal: dados.canal || "web",
        finalidade: dados.finalidade,
        versao_termo: dados.versaoTermo || "v1.0",
        consentimento_concedido: dados.consentimentoConcedido !== undefined ? Boolean(dados.consentimentoConcedido) : true,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        concedido_em: new Date().toISOString()
      };

      if (!client) {
        try {
          const chave = "sj_consentimentos_v1";
          const lista = JSON.parse(window.localStorage.getItem(chave) || "[]");
          lista.unshift({ ...registro, id: "cons-" + Date.now() });
          window.localStorage.setItem(chave, JSON.stringify(lista.slice(0, 50)));
        } catch (_) { }
        return { sucesso: true, local: true, registro };
      }

      try {
        const { data, error } = await client
          .from("termos_consentimento")
          .insert(registro)
          .select()
          .maybeSingle();

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true, registro: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Revoga um consentimento anteriormente concedido
    revogar: async function (titularIdentificador, finalidade, motivo = "Revogação a pedido do titular") {
      if (!titularIdentificador || !finalidade) {
        return { sucesso: false, mensagem: "Identificador e finalidade são obrigatórios." };
      }

      const idLimpo = String(titularIdentificador).trim().toLowerCase();
      const client = inicializarCliente();

      if (!client) {
        try {
          const chave = "sj_consentimentos_v1";
          const lista = JSON.parse(window.localStorage.getItem(chave) || "[]");
          lista.forEach((c) => {
            if (c.titular_identificador === idLimpo && c.finalidade === finalidade) {
              c.consentimento_concedido = false;
              c.revogado_em = new Date().toISOString();
              c.motivo_revogacao = motivo;
            }
          });
          window.localStorage.setItem(chave, JSON.stringify(lista));
        } catch (_) { }
        return { sucesso: true, local: true };
      }

      try {
        const { error } = await client
          .from("termos_consentimento")
          .update({
            consentimento_concedido: false,
            revogado_em: new Date().toISOString(),
            motivo_revogacao: motivo
          })
          .eq("titular_identificador", idLimpo)
          .eq("finalidade", finalidade)
          .is("revogado_em", null);

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Consulta os consentimentos de um titular
    listar: async function (titularIdentificador) {
      if (!titularIdentificador) return [];
      const idLimpo = String(titularIdentificador).trim().toLowerCase();
      const client = inicializarCliente();

      if (!client) {
        try {
          const chave = "sj_consentimentos_v1";
          const lista = JSON.parse(window.localStorage.getItem(chave) || "[]");
          return lista.filter((c) => c.titular_identificador === idLimpo);
        } catch (_) {
          return [];
        }
      }

      try {
        const { data, error } = await client
          .from("termos_consentimento")
          .select("*")
          .eq("titular_identificador", idLimpo)
          .order("concedido_em", { ascending: false });

        if (error) return [];
        return data || [];
      } catch (_) {
        return [];
      }
    }
  };

  // Módulo de Retenção e Anonimização Automatizada (Art. 16)
  const retencao = {
    executar: async function () {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, mensagem: "Supabase não conectado." };
      }
      try {
        const { data, error } = await client.rpc("executar_rotina_retencao_lgpd");
        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true, resultado: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    }
  };

  // Módulo de Direitos do Titular LGPD (Art. 18 e Art. 19)
  const direitosTitular = {
    obterDesafio: async function () {
      try {
        const res = await fetch("/api/public-config?tipo=lgpd-challenge", { cache: "no-store" });
        if (!res.ok) return { turnstileSiteKey: null, lgpdChallengeToken: null };
        const json = await res.json().catch(() => ({}));
        return {
          turnstileSiteKey: json?.turnstileSiteKey || null,
          lgpdChallengeToken: json?.lgpdChallengeToken || null
        };
      } catch (_) {
        return { turnstileSiteKey: null, lgpdChallengeToken: null };
      }
    },

    solicitar: async function (dados) {
      if (!dados || !dados.nome || !dados.email || !dados.tipo) {
        return { sucesso: false, mensagem: "Nome, e-mail e tipo de solicitação são obrigatórios." };
      }

      const client = inicializarCliente();
      const emailLimpo = String(dados.email).trim().toLowerCase();
      const nomeLimpo = String(dados.nome).trim();
      const docDigits = String(dados.cpf_cnpj || dados.cpf || dados.cnpjCpf || "").replace(/\D/g, "");
      const detalhesLimpo = String(dados.detalhes || "").trim();

      let token = null;
      if (client?.auth?.getSession) {
        try {
          const { data: sessData } = await client.auth.getSession();
          token = sessData?.session?.access_token || null;
        } catch (_) {}
      }

      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const resp = await fetch("/api/public-config?tipo=lgpd", {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({
            nome: nomeLimpo,
            email: emailLimpo,
            cpf_cnpj: docDigits || null,
            tipo: dados.tipo,
            detalhes: detalhesLimpo,
            captchaToken: dados.captchaToken || "",
            humanVerified: Boolean(dados.humanVerified),
            challengeToken: dados.challengeToken || "",
            website_url: dados.website_url || ""
          })
        });
        const json = await resp.json().catch(() => null);
        if (resp.ok && json?.sucesso) {
          return {
            sucesso: true,
            protocolo: json.protocolo,
            status: json.status || "recebida",
            prazo_limite: json.prazo_limite,
            prazo_resposta: json.prazo_resposta || json.prazo_limite,
            criado_em: json.criado_em
          };
        }
        if (json && json.mensagem) {
          return { sucesso: false, mensagem: json.mensagem };
        }
      } catch (_) {}

      // Fallback apenas se a rota /api estiver indisponível localmente (sem pular RPC segura)
      if (!client) {
        return { sucesso: false, mensagem: "Serviço temporariamente indisponível. Tente novamente em instantes." };
      }
      try {
        const { data, error } = await client.rpc("criar_solicitacao_lgpd", {
          p_nome: nomeLimpo,
          p_email: emailLimpo,
          p_cpf_cnpj: docDigits || null,
          p_tipo: dados.tipo,
          p_detalhes: detalhesLimpo,
          p_ip_hash: null
        });
        if (error || !data?.sucesso) {
          return { sucesso: false, mensagem: "Não foi possível enviar a solicitação. Verifique os dados e tente novamente." };
        }
        return {
          sucesso: true,
          protocolo: data.protocolo,
          status: data.status || "recebida",
          prazo_limite: data.prazo_limite,
          prazo_resposta: data.prazo_resposta || data.prazo_limite,
          criado_em: data.criado_em
        };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro de comunicação ao registrar solicitação." };
      }
    },

    consultarProtocolo: async function (protocolo, email) {
      const protLimpo = String(protocolo || "").trim().toUpperCase();
      const emailLimpo = String(email || "").trim().toLowerCase();
      if (!protLimpo || !emailLimpo) return null;

      try {
        const resp = await fetch("/api/public-config?tipo=lgpd-consulta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ protocolo: protLimpo, email: emailLimpo })
        });
        if (resp.ok) {
          const json = await resp.json().catch(() => null);
          if (json?.sucesso) {
            return json.encontrado ? json.dados : null;
          }
        }
      } catch (_) {}

      const client = inicializarCliente();
      if (!client) return null;
      try {
        const { data, error } = await client.rpc("consultar_protocolo_lgpd", {
          p_protocolo: protLimpo,
          p_email: emailLimpo
        });
        if (error || !data || data.encontrado !== true) return null;
        return data;
      } catch (_) {
        return null;
      }
    },

    listarMinhasSolicitacoes: async function () {
      const client = inicializarCliente();
      if (!client) return [];
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return [];
        const { data, error } = await client
          .from("solicitacoes_titular")
          .select("id, protocolo, tipo_solicitacao, status, prazo_limite, prazo_resposta, created_at, updated_at, concluida_em, resposta_texto, motivo_negativa")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });
        if (error) return [];
        return data || [];
      } catch (_) {
        return [];
      }
    },

    listarSolicitacoes: async function () {
      const client = inicializarCliente();
      if (!client) return [];
      try {
        const { data, error } = await client
          .from("solicitacoes_titular")
          .select("*")
          .order("criado_em", { ascending: false });

        if (error) return [];
        return data || [];
      } catch (_) {
        return [];
      }
    },

    atualizarSolicitacao: async function (solicitacaoId, campos = {}) {
      const client = inicializarCliente();
      if (!client || !solicitacaoId) {
        return { sucesso: false, mensagem: "Supabase não conectado." };
      }

      const payload = {};
      if (campos.status) payload.status = campos.status;
      if (campos.resposta_texto !== undefined) {
        payload.resposta_texto = campos.resposta_texto;
        payload.resposta = campos.resposta_texto;
      }
      if (campos.motivo_negativa !== undefined) {
        payload.motivo_negativa = campos.motivo_negativa;
      }

      try {
        const { error } = await client
          .from("solicitacoes_titular")
          .update(payload)
          .eq("id", solicitacaoId);

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    concluirSolicitacao: async function (solicitacaoId, respostaTexto) {
      return await direitosTitular.atualizarSolicitacao(solicitacaoId, {
        status: "concluida",
        resposta_texto: respostaTexto
      });
    },

    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      const canal = client
        .channel("sj3d-lgpd-solicitacoes-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "solicitacoes_titular" },
          (payload) => {
            if (typeof onChange === "function") onChange(payload);
          }
        )
        .subscribe();
      return canal;
    },

    exportarDadosTitular: async function (emailOuDoc) {
      if (!emailOuDoc) return null;
      const chave = String(emailOuDoc).trim().toLowerCase();
      const client = inicializarCliente();

      let cadastro = null;
      let orcamentos = [];
      let consentimentos = [];

      if (client) {
        try {
          const resCli = await client
            .from("clientes")
            .select("*")
            .or(`email.eq.${chave},cnpj_cpf.eq.${chave}`)
            .maybeSingle();
          cadastro = resCli.data;

          if (cadastro?.id) {
            const resOrc = await client
              .from("orcamentos")
              .select("*")
              .eq("cliente_id", cadastro.id);
            orcamentos = resOrc.data || [];
          }

          const resCons = await client
            .from("termos_consentimento")
            .select("*")
            .eq("titular_identificador", chave);
          consentimentos = resCons.data || [];
        } catch (_) {}
      }

      if (!cadastro && window.SJ_DB?.clientes?.listar) {
        const listaLocal = window.SJ_DB.clientes.listar();
        cadastro = listaLocal.find((c) => (c.email || "").toLowerCase() === chave || (c.cnpjCpf || "") === chave) || null;
      }

      return {
        exportado_em: new Date().toISOString(),
        legislacao: "Lei Geral de Proteção de Dados (Lei 13.709/2018) - Art. 18, V",
        controlador: "LOJA SJ 3D - Umuarama / PR",
        titular_solicitante: chave,
        dados_cadastrais: cadastro || {},
        historico_pedidos_e_orcamentos: orcamentos,
        historico_consentimentos: consentimentos
      };
    }
  };

  // =========================================================================
  // MÓDULO DE CONTROLE DE ACESSO E APROVAÇÃO (public.profiles + RLS)
  // =========================================================================
  const profiles = {
    // Retorna o perfil do usuário autenticado atual (role + status) direto do banco
    obterMeuPerfil: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, perfil: null, tabelaAusente: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, perfil: null, tabelaAusente: false, mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("profiles")
          .select("*")
          .eq("id", uid)
          .maybeSingle();

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, perfil: null, tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, perfil: data || null, tabelaAusente: false };
      } catch (err) {
        return { sucesso: false, perfil: null, tabelaAusente: false, mensagem: err.message };
      }
    },

    // Atualiza dados cadastrais e fiscais (PF/PJ + Endereço) do próprio perfil.
    // Role e status são bloqueados pelo banco (RLS + trigger) para não-admins.
    atualizarMeuPerfil: async function (dados) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, mensagem: "Sessão expirada. Faça login novamente." };

        const d = dados || {};
        const personType = d.person_type === "pj" ? "pj" : "pf";
        const ieTipo = ["contribuinte", "isento", "nao_contribuinte"].includes(d.ie_tipo)
          ? d.ie_tipo
          : "contribuinte";

        const limparDigitos = (v) => String(v || "").replace(/\D/g, "");
        const cpfDigits = limparDigitos(d.cpf);
        const cnpjDigits = limparDigitos(d.cnpj);
        const cepDigits = limparDigitos(d.cep);
        const ufLimpo = String(d.uf || "").trim().toUpperCase().slice(0, 2);

        const payload = {
          person_type: personType,
          nome: String(d.nome || "").trim(),
          telefone: String(d.telefone || "").trim(),
          cpf: cpfDigits ? cpfDigits : null,
          cnpj: cnpjDigits ? cnpjDigits : null,
          razao_social: String(d.razao_social || "").trim(),
          nome_fantasia: String(d.nome_fantasia || "").trim(),
          inscricao_estadual: ieTipo === "contribuinte" ? String(d.inscricao_estadual || "").trim() : "",
          ie_tipo: ieTipo,
          contato_nome: String(d.contato_nome || "").trim(),
          cep: cepDigits ? cepDigits : null,
          logradouro: String(d.logradouro || "").trim(),
          numero: String(d.numero || "").trim(),
          complemento: String(d.complemento || "").trim(),
          bairro: String(d.bairro || "").trim(),
          cidade: String(d.cidade || "").trim(),
          uf: ufLimpo ? ufLimpo : null
        };

        // Mantém fallback legado sincronizado caso a Migration 007 ainda não tenha sido aplicada
        if (d.endereco !== undefined) payload.endereco = String(d.endereco || "").trim();
        if (d.cidade_uf !== undefined) payload.cidade_uf = String(d.cidade_uf || "").trim();

        const { data, error } = await client
          .from("profiles")
          .update(payload)
          .eq("id", uid)
          .select("*")
          .maybeSingle();

        if (error) {
          const msgRaw = String(error.message || "");
          if (String(error.code || "") === "23505" || msgRaw.includes("idx_profiles_cpf_unique") || msgRaw.includes("idx_profiles_cnpj_unique")) {
            return { sucesso: false, mensagem: "Este CPF ou CNPJ já está cadastrado em outra conta. Cada documento pode ter apenas uma conta." };
          }
          if (msgRaw.includes("profiles_cpf_check")) {
            return { sucesso: false, mensagem: "CPF inválido. Verifique os 11 dígitos informados." };
          }
          if (msgRaw.includes("profiles_cnpj_check")) {
            return { sucesso: false, mensagem: "CNPJ inválido. Verifique os 14 dígitos informados." };
          }
          return { sucesso: false, mensagem: "Não foi possível salvar os dados. Confira os campos informados." };
        }
        return { sucesso: true, perfil: data };
      } catch (err) {
        return { sucesso: false, mensagem: "Erro ao salvar seus dados cadastrais." };
      }
    },

    // Lista todos os perfis (pendentes, aprovados, bloqueados e clientes) — permitido apenas para admin via RLS
    listarTodos: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [], tabelaAusente: false };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    // Atualiza status ('pending' | 'approved' | 'blocked') de um perfil — protegido por RLS + trigger
    atualizarStatus: async function (id, novoStatus) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const { data, error } = await client
          .from("profiles")
          .update({ status: novoStatus })
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, perfil: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Atualiza papel ('admin' | 'staff' | 'customer') de um perfil — protegido por RLS + trigger
    atualizarRole: async function (id, novaRole) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      const roleValida = ["admin", "staff", "customer"].includes(novaRole) ? novaRole : "customer";
      try {
        const { data, error } = await client
          .from("profiles")
          .update({ role: roleValida })
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, perfil: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Aprova e define o papel em uma única operação ('admin' | 'staff' | 'customer')
    aprovarComRole: async function (id, role = "staff") {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      const roleValida = ["admin", "staff", "customer"].includes(role) ? role : "staff";
      try {
        const { data, error } = await client
          .from("profiles")
          .update({ status: "approved", role: roleValida })
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, perfil: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Exclui usuário (usa /api/admin-delete-user com JWT do admin ou fallback RLS em public.profiles)
    excluir: async function (id) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const token = sessData?.session?.access_token;

        if (token && typeof window !== "undefined" && window.fetch) {
          try {
            const resApi = await fetch("/api/admin-delete-user", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              cache: "no-store",
              body: JSON.stringify({ userId: id })
            });
            const json = await resApi.json().catch(() => null);
            if (resApi.ok && json && json.sucesso) {
              return json;
            }
            if (json && json.mensagem && resApi.status >= 400 && resApi.status < 500) {
              return { sucesso: false, mensagem: json.mensagem };
            }
          } catch (_) { }
        }

        // Fallback direto via RLS (também protegido pelo trigger de auto-exclusão e último admin)
        const { error } = await client.from("profiles").delete().eq("id", id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, mensagem: "Perfil removido com sucesso." };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Assina mudanças em tempo real em public.profiles
    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      try {
        return client
          .channel("sj-profiles-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO DO CATÁLOGO GLOBAL & ESTOQUE EM TEMPO REAL (public.products + RLS)
  // =========================================================================
  const products = {
    // Lê todos os produtos e cores direto do Supabase (sem cache estático)
    listarTodos: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], tabelaAusente: false, mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client
          .from("products")
          .select("*")
          .order("ordem", { ascending: true })
          .order("nome", { ascending: true });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [], tabelaAusente: false };
      } catch (err) {
        return { sucesso: false, dados: [], tabelaAusente: false, mensagem: err.message };
      }
    },

    // Cria ou atualiza um produto/cor em public.products (RLS: apenas admin aprovado)
    salvar: async function (registro) {
      const client = inicializarCliente();
      if (!client || !registro || !registro.id) return { sucesso: false, mensagem: "Dados inválidos." };
      try {
        const { data, error } = await client
          .from("products")
          .upsert(registro, { onConflict: "id" })
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Upsert em lote (usado ao salvar paleta completa de cores)
    salvarLote: async function (registros) {
      const client = inicializarCliente();
      if (!client || !Array.isArray(registros) || registros.length === 0) {
        return { sucesso: false, mensagem: "Lista vazia." };
      }
      try {
        const { error } = await client.from("products").upsert(registros, { onConflict: "id" });
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Atualiza apenas stock_status ('disponivel' | 'poucas_unidades' | 'esgotado')
    atualizarEstoque: async function (id, stockStatus) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { data, error } = await client
          .from("products")
          .update({ stock_status: stockStatus })
          .eq("id", id)
          .select("id, nome, stock_status, updated_at")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Exclui um item de public.products (RLS: apenas admin aprovado)
    excluir: async function (id) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { error } = await client.from("products").delete().eq("id", id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Assina mudanças em tempo real em public.products para atualizar todos os visitantes ao vivo
    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      try {
        return client
          .channel("sj-products-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "products" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO DE FAVORITOS DO CLIENTE (public.favorites + RLS)
  // =========================================================================
  const favorites = {
    listarMeus: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, dados: [], mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("favorites")
          .select("id, user_id, product_id, created_at, products(*)")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    adicionar: async function (productId) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login para favoritar." };

        const { data, error } = await client
          .from("favorites")
          .upsert({ user_id: uid, product_id: String(productId) }, { onConflict: "user_id,product_id" })
          .select("id, user_id, product_id, created_at")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, favoritado: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    remover: async function (productId) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login." };

        const { error } = await client
          .from("favorites")
          .delete()
          .eq("user_id", uid)
          .eq("product_id", String(productId));

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, favoritado: false };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    alternar: async function (productId) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login para favoritar." };

        const { data: existente } = await client
          .from("favorites")
          .select("id")
          .eq("user_id", uid)
          .eq("product_id", String(productId))
          .maybeSingle();

        if (existente?.id) {
          return favorites.remover(productId);
        }
        return favorites.adicionar(productId);
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      try {
        return client
          .channel("sj-favorites-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO DE CARRINHO DO CLIENTE (public.cart_items + RLS)
  // =========================================================================
  const cart = {
    listarMeu: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, dados: [], mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("cart_items")
          .select("id, user_id, product_id, quantity, updated_at, products(*)")
          .eq("user_id", uid)
          .order("updated_at", { ascending: false });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    adicionar: async function (productId, deltaQtd = 1) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login para adicionar ao carrinho." };

        const qtdAdd = Math.max(1, Math.min(1000, parseInt(deltaQtd, 10) || 1));

        // Verifica se já existe no carrinho do usuário
        const { data: existente } = await client
          .from("cart_items")
          .select("id, quantity")
          .eq("user_id", uid)
          .eq("product_id", String(productId))
          .maybeSingle();

        const novaQtd = Math.min(1000, (existente ? Number(existente.quantity || 0) : 0) + qtdAdd);

        const { data, error } = await client
          .from("cart_items")
          .upsert(
            {
              user_id: uid,
              product_id: String(productId),
              quantity: novaQtd
            },
            { onConflict: "user_id,product_id" }
          )
          .select("id, user_id, product_id, quantity, updated_at")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    atualizarQuantidade: async function (productId, novaQtd) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      const qtdInt = parseInt(novaQtd, 10);
      if (isNaN(qtdInt) || qtdInt < 1) {
        return cart.remover(productId);
      }
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login." };

        const { data, error } = await client
          .from("cart_items")
          .update({ quantity: Math.min(1000, qtdInt) })
          .eq("user_id", uid)
          .eq("product_id", String(productId))
          .select("id, product_id, quantity, updated_at")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    remover: async function (productId) {
      const client = inicializarCliente();
      if (!client || !productId) return { sucesso: false, mensagem: "Produto inválido." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login." };

        const { error } = await client
          .from("cart_items")
          .delete()
          .eq("user_id", uid)
          .eq("product_id", String(productId));

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    esvaziar: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, naoAutenticado: true, mensagem: "Faça login." };

        const { error } = await client.from("cart_items").delete().eq("user_id", uid);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      try {
        return client
          .channel("sj-cart-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "cart_items" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO DE ORÇAMENTOS E ITENS (public.quotes + public.quote_items + RLS)
  // =========================================================================
  const quotes = {
    listarMeus: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, dados: [], mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("quotes")
          .select("*, quote_items(*)")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    listarTodos: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client
          .from("quotes")
          .select("*, quote_items(*)")
          .order("created_at", { ascending: false });

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    // Chama a função RPC SECURITY DEFINER create_quote_from_cart no banco:
    // valida obrigatoriedade COM/SEM nota fiscal, grava snapshot fiscal e cria orçamento!
    criarDoCarrinho: async function (notes = "", precisaNotaFiscal = false) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client.rpc("create_quote_from_cart", {
          p_notes: String(notes || "").trim(),
          p_precisa_nota_fiscal: Boolean(precisaNotaFiscal)
        });

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true, orcamento: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente altera quantidade ou adiciona um produto ao orçamento enquanto status = 'solicitado'
    // O trigger do banco valida o status, busca nome/preço em public.products e marca changed_by_customer = true
    salvarItemCliente: async function (quoteId, productId, quantity) {
      const client = inicializarCliente();
      if (!client || !quoteId || !productId) return { sucesso: false, mensagem: "Dados inválidos." };
      const qtd = Math.max(1, Math.min(1000, parseInt(quantity, 10) || 1));
      try {
        const { data, error } = await client
          .from("quote_items")
          .upsert(
            {
              quote_id: quoteId,
              product_id: String(productId),
              product_name: "Item do Catálogo", // sobrescrito pelo trigger no banco a partir de public.products
              quantity: qtd
            },
            { onConflict: "quote_id,product_id" }
          )
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente remove um item do orçamento enquanto status = 'solicitado'
    removerItemCliente: async function (quoteItemId) {
      const client = inicializarCliente();
      if (!client || !quoteItemId) return { sucesso: false, mensagem: "Item inválido." };
      try {
        const { error } = await client.from("quote_items").delete().eq("id", quoteItemId);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente edita observações enquanto status = 'solicitado'
    atualizarObservacoesCliente: async function (quoteId, notes) {
      const client = inicializarCliente();
      if (!client || !quoteId) return { sucesso: false, mensagem: "Orçamento inválido." };
      try {
        const { data, error } = await client
          .from("quotes")
          .update({ notes: String(notes || "").trim() })
          .eq("id", quoteId)
          .select("*, quote_items(*)")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente cancela o orçamento enquanto status = 'solicitado'
    cancelarCliente: async function (quoteId) {
      const client = inicializarCliente();
      if (!client || !quoteId) return { sucesso: false, mensagem: "Orçamento inválido." };
      try {
        const { data, error } = await client
          .from("quotes")
          .update({ status: "cancelado" })
          .eq("id", quoteId)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente exclui o orçamento enquanto status = 'solicitado'
    excluir: async function (quoteId) {
      const client = inicializarCliente();
      if (!client || !quoteId) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { error } = await client.from("quotes").delete().eq("id", quoteId);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Equipe (staff/admin) atualiza status, observação/resposta e valor total do orçamento
    responderEquipe: async function (id, { status, admin_response, admin_total, limparAlterado = false }) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const payload = {
          status: status || "em_analise",
          admin_response: String(admin_response || "").trim()
        };
        if (admin_total !== undefined && admin_total !== "" && admin_total !== null) {
          const num = Number(String(admin_total).replace(",", "."));
          if (!isNaN(num) && num >= 0) payload.admin_total = num;
        } else if (admin_total === "") {
          payload.admin_total = null;
        }
        if (limparAlterado) {
          payload.changed_by_customer = false;
        }

        const { data, error } = await client
          .from("quotes")
          .update(payload)
          .eq("id", id)
          .select("*, quote_items(*)")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    assinarRealtime: function (onChange) {
      const client = inicializarCliente();
      if (!client || typeof client.channel !== "function") return null;
      try {
        return client
          .channel("sj-quotes-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "quote_items" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO WHATSAPP OFICIAL (NÚMERO CONFIGURÁVEL VIA VERCEL ENV VAR)
  // =========================================================================
  let cachedWhatsappNumber = null;

  const whatsapp = {
    obterNumeroLoja: async function () {
      if (cachedWhatsappNumber) return cachedWhatsappNumber;
      if (typeof window !== "undefined" && window.WHATSAPP_NUMBER) {
        cachedWhatsappNumber = String(window.WHATSAPP_NUMBER).replace(/\D/g, "");
        if (cachedWhatsappNumber) return cachedWhatsappNumber;
      }
      if (typeof window !== "undefined" && window.fetch) {
        try {
          const r = await fetch("/api/public-config", { cache: "no-store" });
          if (r.ok) {
            const j = await r.json();
            if (j?.whatsappNumber) {
              cachedWhatsappNumber = String(j.whatsappNumber).replace(/\D/g, "");
              return cachedWhatsappNumber;
            }
          }
        } catch (_) { }
      }
      const fallback =
        (typeof window !== "undefined" && window.SITE_DATA?.loja?.whatsapp) ||
        "5544991351318";
      cachedWhatsappNumber = String(fallback).replace(/\D/g, "") || "5544991351318";
      return cachedWhatsappNumber;
    },

    gerarUrlOrcamento: async function ({
      quoteNumber,
      clienteNome,
      items = [],
      notes = "",
      ehAlteracao = false,
      precisaNotaFiscal = false,
      snapshot = null
    }) {
      const numero = await whatsapp.obterNumeroLoja();
      const snap = snapshot && typeof snapshot === "object" ? snapshot : {};
      const comNota = Boolean(precisaNotaFiscal || snap.precisa_nota_fiscal);
      const tipo = snap.person_type === "pj" ? "pj" : "pf";

      const fmtCpf = (v) => {
        const d = String(v || "").replace(/\D/g, "");
        return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v;
      };
      const fmtCnpj = (v) => {
        const d = String(v || "").replace(/\D/g, "");
        return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v;
      };

      const nomeExibicao = snap.display_name || (tipo === "pj" ? (snap.razao_social || snap.nome_fantasia) : snap.nome) || clienteNome || "";
      const docFmt = tipo === "pj"
        ? (snap.cnpj || snap.documento ? fmtCnpj(snap.cnpj || snap.documento) : "")
        : (snap.cpf || snap.documento ? fmtCpf(snap.cpf || snap.documento) : "");
      const docLabel = tipo === "pj" ? "CNPJ" : "CPF";
      const telefoneCli = snap.telefone || "";

      const linhasItens = (Array.isArray(items) ? items : []).map((it) => {
        const qtd = it.quantity || it.quantidade || 1;
        const nome = it.product_name || it.nome || "Produto";
        const precoUnit = it.unit_price != null && Number(it.unit_price) > 0
          ? ` (${Number(it.unit_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} un.)`
          : "";
        return `• ${qtd}x ${nome}${precoUnit}`;
      });

      const cabecalho = ehAlteracao
        ? `Olá! *Orçamento nº ${quoteNumber} atualizado*`
        : `Olá! Gostaria de solicitar o *Orçamento nº ${quoteNumber}* na Loja SJ 3D:`;

      const cepRaw = String(snap.cep || "").replace(/\D/g, "");
      const cepFmt = cepRaw.length === 8 ? `${cepRaw.slice(0, 5)}-${cepRaw.slice(5)}` : cepRaw;
      const enderecoCompleto = [
        [snap.logradouro, snap.numero].filter(Boolean).join(", "),
        snap.complemento || "",
        snap.bairro || "",
        [snap.cidade, snap.uf].filter(Boolean).join("/"),
        cepFmt ? `CEP ${cepFmt}` : ""
      ].filter(Boolean).join(" - ");

      const blocos = [
        cabecalho,
        `*Orçamento:* #${quoteNumber}`,
        nomeExibicao ? `*${tipo === "pj" ? "Empresa / Razão Social" : "Cliente"}:* ${nomeExibicao}` : "",
        docFmt ? `*${docLabel}:* ${docFmt}` : "",
        telefoneCli ? `*Telefone:* ${telefoneCli}` : "",
        `*Nota fiscal:* ${comNota ? "Sim" : "Não"}`,
        comNota && tipo === "pj" && snap.inscricao_estadual ? `*Inscrição Estadual:* ${snap.inscricao_estadual}` : "",
        comNota && enderecoCompleto ? `*Endereço:* ${enderecoCompleto}` : "",
        "",
        "*Itens solicitados:*",
        ...(linhasItens.length > 0 ? linhasItens : ["• (Sem itens listados)"]),
        notes ? `\n*Observações:* ${notes}` : ""
      ].filter((l) => l !== "");

      const textoCodificado = encodeURIComponent(blocos.join("\n"));
      return `https://wa.me/${numero}?text=${textoCodificado}`;
    }
  };

  // =========================================================================
  // MÓDULO FISCAL SERVER-SIDE (CONSULTA DE CNPJ & CEP VIA API PROTEGIDA)
  // =========================================================================
  const fiscal = {
    consultarCnpj: async function (cnpjRaw) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      const digits = String(cnpjRaw || "").replace(/\D/g, "");
      if (digits.length !== 14) {
        return { sucesso: false, mensagem: "Informe os 14 dígitos do CNPJ." };
      }
      try {
        const { data: sessData } = await client.auth.getSession();
        const token = sessData?.session?.access_token;
        if (!token) return { sucesso: false, mensagem: "Sessão expirada. Entre novamente." };

        const r = await fetch(`/api/public-config?tipo=cnpj&cnpj=${encodeURIComponent(digits)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.sucesso) {
          return { sucesso: false, mensagem: j?.mensagem || "Não foi possível consultar o CNPJ." };
        }
        return j;
      } catch (_) {
        return { sucesso: false, mensagem: "Erro de conexão ao consultar CNPJ. Preencha manualmente." };
      }
    },

    consultarCep: async function (cepRaw) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      const digits = String(cepRaw || "").replace(/\D/g, "");
      if (digits.length !== 8) {
        return { sucesso: false, mensagem: "Informe os 8 dígitos do CEP." };
      }
      try {
        const { data: sessData } = await client.auth.getSession();
        const token = sessData?.session?.access_token;
        if (!token) return { sucesso: false, mensagem: "Sessão expirada. Entre novamente." };

        const r = await fetch(`/api/public-config?tipo=cep&cep=${encodeURIComponent(digits)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.sucesso) {
          return { sucesso: false, mensagem: j?.mensagem || "CEP não encontrado." };
        }
        return j;
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao consultar CEP. Preencha manualmente." };
      }
    }
  };

  // =========================================================================
  // MÓDULO CALCULADORA 3D (SESSÃO ÚNICA + RLS + HISTÓRICO + PREFERÊNCIAS + LEADS)
  // =========================================================================
  const calculadora = {
    obterAcesso: async function () {
      const client = inicializarCliente();
      if (!client) {
        return { autenticado: false, autorizado: false, motivo: "no_client" };
      }
      try {
        const { data: sessData } = await client.auth.getSession();
        const user = sessData?.session?.user;
        if (!user) {
          return { autenticado: false, autorizado: false, motivo: "no_session" };
        }

        const mfaInfo = await auth.obterNivelMfa();
        if (mfaInfo.requiresMfa) {
          return {
            autenticado: true,
            autorizado: false,
            motivo: "mfa_required",
            user
          };
        }

        const resRpc = await client.rpc("obter_meu_status_calculadora");
        if (!resRpc.error && resRpc.data && typeof resRpc.data === "object") {
          return {
            ...resRpc.data,
            user
          };
        }

        // Fallback seguro caso Migration 009 ainda não tenha sido aplicada no banco
        const { data: prof, error: profErr } = await client
          .from("profiles")
          .select("id, nome, email, role, status")
          .eq("id", user.id)
          .maybeSingle();

        if (profErr || !prof) {
          return { autenticado: true, autorizado: false, motivo: "no_profile", user };
        }
        if (prof.status === "blocked") {
          return {
            autenticado: true,
            autorizado: false,
            motivo: "blocked",
            role: prof.role,
            profile_status: prof.status,
            nome: prof.nome,
            email: prof.email,
            user
          };
        }
        if (prof.status !== "approved") {
          return {
            autenticado: true,
            autorizado: false,
            motivo: "pending",
            role: prof.role,
            profile_status: prof.status,
            nome: prof.nome,
            email: prof.email,
            user
          };
        }
        return {
          autenticado: true,
          autorizado: true,
          motivo: "ok",
          role: prof.role || "customer",
          profile_status: prof.status,
          nome: prof.nome || user.user_metadata?.nome || user.user_metadata?.name || user.email.split("@")[0],
          email: prof.email || user.email,
          user,
          migracaoPendente: true
        };
      } catch (_) {
        return { autenticado: false, autorizado: false, motivo: "error" };
      }
    },

    listarHistorico: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], tabelaAusente: true };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, dados: [] };

        const { data, error } = await client
          .from("calc_history")
          .select("id, client_item_id, name, marketplace_key, marketplace_name, sale_price, net_profit, net_margin, weight_grams, calc_date_label, state_json, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente };
        }

        const mapped = (data || []).map((row) => ({
          id: String(row.client_item_id || row.id),
          dbId: row.id,
          date: row.calc_date_label || (row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : ""),
          name: row.name || "Peça Impressa 3D",
          state: row.state_json && typeof row.state_json === "object" ? row.state_json : {},
          salePrice: Number(row.sale_price || 0),
          netProfit: Number(row.net_profit || 0),
          netMargin: Number(row.net_margin || 0),
          marketplaceName: row.marketplace_name || "Marketplace"
        }));
        return { sucesso: true, dados: mapped, tabelaAusente: false };
      } catch (_) {
        return { sucesso: false, dados: [] };
      }
    },

    salvarCalculo: async function (item) {
      const client = inicializarCliente();
      if (!client || !item) return { sucesso: false };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false };

        const row = {
          user_id: uid,
          client_item_id: String(item.id || Date.now()),
          name: String(item.name || "Peça Impressa 3D").slice(0, 160),
          marketplace_key: String(item.state?.marketplaceKey || "ml_premium").slice(0, 60),
          marketplace_name: String(item.marketplaceName || "Marketplace").slice(0, 80),
          sale_price: Number(item.salePrice || 0),
          net_profit: Number(item.netProfit || 0),
          net_margin: Number(item.netMargin || 0),
          weight_grams: Number(item.state?.weightGrams || 0),
          calc_date_label: String(item.date || "").slice(0, 40),
          state_json: item.state && typeof item.state === "object" ? item.state : {}
        };

        const { error } = await client
          .from("calc_history")
          .upsert(row, { onConflict: "user_id,client_item_id" });

        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
          return { sucesso: false, tabelaAusente };
        }
        return { sucesso: true };
      } catch (_) {
        return { sucesso: false };
      }
    },

    migrarHistoricoLocal: async function (itens) {
      const client = inicializarCliente();
      if (!client || !Array.isArray(itens) || itens.length === 0) return { sucesso: true, migrados: 0 };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, migrados: 0 };

        const rows = itens
          .filter((item) => item && (item.id || item.name || item.state))
          .map((item, idx) => ({
            user_id: uid,
            client_item_id: String(item.id || `legacy_${idx}_${String(item.name || "peca").slice(0, 24)}`),
            name: String(item.name || "Peça Impressa 3D").slice(0, 160),
            marketplace_key: String(item.state?.marketplaceKey || "ml_premium").slice(0, 60),
            marketplace_name: String(item.marketplaceName || "Marketplace").slice(0, 80),
            sale_price: Number(item.salePrice || 0),
            net_profit: Number(item.netProfit || 0),
            net_margin: Number(item.netMargin || 0),
            weight_grams: Number(item.state?.weightGrams || 0),
            calc_date_label: String(item.date || "").slice(0, 40),
            state_json: item.state && typeof item.state === "object" ? item.state : {}
          }));

        if (rows.length === 0) return { sucesso: true, migrados: 0 };

        const { error } = await client
          .from("calc_history")
          .upsert(rows, { onConflict: "user_id,client_item_id", ignoreDuplicates: true });

        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
          return { sucesso: false, migrados: 0, tabelaAusente };
        }
        return { sucesso: true, migrados: rows.length };
      } catch (_) {
        return { sucesso: false, migrados: 0 };
      }
    },

    excluirCalculo: async function (clientItemId) {
      const client = inicializarCliente();
      if (!client || !clientItemId) return { sucesso: false };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false };
        const { error } = await client
          .from("calc_history")
          .delete()
          .eq("user_id", uid)
          .eq("client_item_id", String(clientItemId));
        return { sucesso: !error };
      } catch (_) {
        return { sucesso: false };
      }
    },

    obterPreferencias: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, prefs: null };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, prefs: null };
        const { data, error } = await client
          .from("calc_preferences")
          .select("prefs_json")
          .eq("user_id", uid)
          .maybeSingle();
        if (error || !data) return { sucesso: !error, prefs: null };
        return { sucesso: true, prefs: data.prefs_json || null };
      } catch (_) {
        return { sucesso: false, prefs: null };
      }
    },

    salvarPreferencias: async function (prefs) {
      const client = inicializarCliente();
      if (!client || !prefs) return { sucesso: false };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false };
        const { error } = await client
          .from("calc_preferences")
          .upsert({
            user_id: uid,
            prefs_json: prefs,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
        return { sucesso: !error };
      } catch (_) {
        return { sucesso: false };
      }
    },

    // Gestão de Leads (protegida no banco via RLS para is_staff() apenas)
    listarLeads: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [] };
      try {
        const { data, error } = await client
          .from("calc_leads")
          .select("id, legacy_id, user_id, nome, email, whatsapp, cidade, status, origem, created_at")
          .order("created_at", { ascending: false });
        if (error) return { sucesso: false, dados: [] };
        return {
          sucesso: true,
          dados: (data || []).map((row) => ({
            id: row.legacy_id || row.id,
            dbId: row.id,
            user_id: row.user_id,
            nome: row.nome,
            email: row.email,
            whatsapp: row.whatsapp || "",
            cidade: row.cidade || "",
            status: row.status || "ativo",
            origem: row.origem || "conta",
            data: row.created_at
          }))
        };
      } catch (_) {
        return { sucesso: false, dados: [] };
      }
    },

    adicionarLead: async function ({ nome, email, whatsapp = "", cidade = "" }) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      const emailLimpo = String(email || "").trim().toLowerCase();
      if (!nome || !emailLimpo) return { sucesso: false, mensagem: "Nome e e-mail são obrigatórios." };
      try {
        const { error } = await client
          .from("calc_leads")
          .upsert({
            nome: String(nome).trim().slice(0, 120),
            email: emailLimpo,
            whatsapp: String(whatsapp || "").trim().slice(0, 40),
            cidade: String(cidade || "").trim().slice(0, 100),
            status: "ativo",
            origem: "admin_manual"
          }, { onConflict: "email" });
        if (error) return { sucesso: false, mensagem: "Não foi possível salvar o lead." };
        return { sucesso: true };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao salvar lead." };
      }
    },

    atualizarStatusLead: async function (email, novoStatus) {
      const client = inicializarCliente();
      if (!client || !email) return { sucesso: false };
      const statusLimpo = novoStatus === "revogado" ? "revogado" : "ativo";
      try {
        const { error } = await client
          .from("calc_leads")
          .update({ status: statusLimpo })
          .eq("email", String(email).trim().toLowerCase());
        return { sucesso: !error, mensagem: error ? error.message : "" };
      } catch (_) {
        return { sucesso: false };
      }
    },

    excluirLead: async function (email) {
      const client = inicializarCliente();
      if (!client || !email) return { sucesso: false };
      try {
        const { error } = await client
          .from("calc_leads")
          .delete()
          .eq("email", String(email).trim().toLowerCase());
        return { sucesso: !error, mensagem: error ? error.message : "" };
      } catch (_) {
        return { sucesso: false };
      }
    }
  };

  // =========================================================================
  // MÓDULO EMISSOR DE ORÇAMENTOS TIMBRADOS (public.issued_quotes + RPC)
  // =========================================================================
  const issuedQuotes = {
    listarTodos: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], tabelaAusente: false, mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client
          .from("issued_quotes")
          .select("*, issued_quote_items(*)")
          .order("quote_year", { ascending: false })
          .order("quote_seq", { ascending: false })
          .order("version_number", { ascending: false })
          .limit(250);

        if (error) {
          const tabelaAusente = String(error.code || "") === "42P01" || String(error.message || "").includes("does not exist") || String(error.message || "").includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: error.message };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [], tabelaAusente: false };
      } catch (err) {
        return { sucesso: false, dados: [], tabelaAusente: false, mensagem: err.message };
      }
    },

    obterAuditoria: async function (issuedQuoteId) {
      const client = inicializarCliente();
      if (!client || !issuedQuoteId) return { sucesso: false, dados: [] };
      try {
        const { data, error } = await client
          .from("issued_quote_audit_logs")
          .select("*")
          .eq("issued_quote_id", issuedQuoteId)
          .order("created_at", { ascending: false })
          .limit(40);
        if (error) return { sucesso: false, dados: [], mensagem: error.message };
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    salvar: async function (payload, emitir = false) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, tabelaAusente: false, fallbackLocal: true, mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client.rpc("save_issued_quote", {
          p_payload: payload || {},
          p_emit: Boolean(emitir)
        });
        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42883" || String(error.code || "") === "42P01" || msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("function public.save_issued_quote");
          return { sucesso: false, tabelaAusente, mensagem: msg };
        }
        return { sucesso: true, dados: data };
      } catch (err) {
        return { sucesso: false, tabelaAusente: false, mensagem: err.message || "Erro ao salvar orçamento." };
      }
    },

    atualizarStatus: async function (id, status) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const { data, error } = await client.rpc("update_issued_quote_status", {
          p_id: id,
          p_status: status
        });
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    excluirRascunho: async function (id) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { error } = await client
          .from("issued_quotes")
          .delete()
          .eq("id", id)
          .eq("is_locked", false);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    buscarClientes: async function (query = "") {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [] };
      try {
        const { data, error } = await client.rpc("search_customers_for_quote", {
          p_query: String(query || "").trim()
        });
        if (error) return { sucesso: false, dados: [], mensagem: error.message };
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (err) {
        return { sucesso: false, dados: [], mensagem: err.message };
      }
    },

    obterPadroes: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, valor: null };
      try {
        const { data, error } = await client
          .from("configuracoes_site")
          .select("valor")
          .eq("chave", "orcamento_padroes_v1")
          .maybeSingle();
        if (error || !data) return { sucesso: false, valor: null };
        return { sucesso: true, valor: data.valor || null };
      } catch (_) {
        return { sucesso: false, valor: null };
      }
    },

    salvarPadroes: async function (valor) {
      const client = inicializarCliente();
      if (!client || !valor) return { sucesso: false };
      try {
        const { error } = await client
          .from("configuracoes_site")
          .upsert({ chave: "orcamento_padroes_v1", valor }, { onConflict: "chave" });
        return { sucesso: !error, mensagem: error ? error.message : "" };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    }
  };

  // =========================================================================
  // MÓDULO DIRETÓRIO DE CLIENTES CADASTRADOS (ADMIN & STAFF — VIA RPC)
  // =========================================================================
  const customers = {
    buscarParaOrcamento: async function (query = "", limit = 12) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], tabelaAusente: false };
      try {
        const { data, error } = await client.rpc("admin_search_customers_for_quote", {
          p_query: String(query || "").trim(),
          p_limit: Math.min(30, Math.max(1, parseInt(limit, 10) || 12))
        });
        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42883" || msg.includes("does not exist") || msg.includes("schema cache");
          return { sucesso: false, dados: [], tabelaAusente, mensagem: "Não foi possível consultar clientes." };
        }
        return { sucesso: true, dados: Array.isArray(data) ? data : [], tabelaAusente: false };
      } catch (_) {
        return { sucesso: false, dados: [], tabelaAusente: false, mensagem: "Erro ao consultar clientes." };
      }
    },

    listarCadastrados: async function ({ query = "", filter = "todos", sort = "created_desc", limit = 25, offset = 0 } = {}) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, items: [], kpis: {}, totalFiltered: 0, mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client.rpc("admin_list_registered_customers", {
          p_query: String(query || "").trim(),
          p_filter: String(filter || "todos"),
          p_sort: String(sort || "created_desc"),
          p_limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 25)),
          p_offset: Math.max(0, parseInt(offset, 10) || 0)
        });
        if (error) {
          const msg = String(error.message || "");
          const tabelaAusente = String(error.code || "") === "42883" || msg.includes("does not exist") || msg.includes("schema cache");
          return { sucesso: false, items: [], kpis: {}, totalFiltered: 0, tabelaAusente, mensagem: tabelaAusente ? "Execute a Migration 011 no SQL Editor do Supabase." : "Erro ao carregar clientes cadastrados." };
        }
        return {
          sucesso: true,
          kpis: data?.kpis || {},
          totalFiltered: Number(data?.total_filtered) || 0,
          items: Array.isArray(data?.items) ? data.items : [],
          tabelaAusente: false
        };
      } catch (_) {
        return { sucesso: false, items: [], kpis: {}, totalFiltered: 0, mensagem: "Erro ao carregar clientes." };
      }
    },

    obterDetalhe: async function (customerId) {
      const client = inicializarCliente();
      if (!client || !customerId) return { sucesso: false, mensagem: "Cliente inválido." };
      try {
        const { data, error } = await client.rpc("admin_get_customer_detail", {
          p_customer_id: customerId
        });
        if (error) return { sucesso: false, mensagem: "Não foi possível carregar os detalhes do cliente." };
        return { sucesso: true, dados: data };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao carregar detalhes." };
      }
    },

    revelarDocumento: async function (customerId) {
      const client = inicializarCliente();
      if (!client || !customerId) return { sucesso: false, mensagem: "Cliente inválido." };
      try {
        const { data, error } = await client.rpc("admin_reveal_customer_doc", {
          p_customer_id: customerId
        });
        if (error) return { sucesso: false, mensagem: "Sem permissão para revelar documento." };
        return { sucesso: true, dados: data };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao revelar documento." };
      }
    },

    atualizarCadastro: async function (customerId, dados) {
      const client = inicializarCliente();
      if (!client || !customerId) return { sucesso: false, mensagem: "Cliente inválido." };
      try {
        const { data, error } = await client.rpc("admin_update_customer_profile", {
          p_customer_id: customerId,
          p_dados: dados || {}
        });
        if (error) {
          const raw = String(error.message || "");
          if (raw.includes("CPF inválido")) return { sucesso: false, mensagem: "CPF inválido. Confira os 11 dígitos." };
          if (raw.includes("CNPJ inválido")) return { sucesso: false, mensagem: "CNPJ inválido. Confira os 14 dígitos." };
          if (raw.includes("idx_profiles_cpf_unique") || raw.includes("idx_profiles_cnpj_unique") || String(error.code || "") === "23505") {
            return { sucesso: false, mensagem: "Este documento já pertence a outra conta cadastrada." };
          }
          return { sucesso: false, mensagem: "Não foi possível atualizar o cadastro do cliente." };
        }
        return { sucesso: true, dados: data };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao salvar cadastro." };
      }
    },

    definirBloqueio: async function (customerId, blocked) {
      const client = inicializarCliente();
      if (!client || !customerId) return { sucesso: false, mensagem: "Cliente inválido." };
      try {
        const { data, error } = await client.rpc("admin_set_customer_block", {
          p_customer_id: customerId,
          p_blocked: Boolean(blocked)
        });
        if (error) return { sucesso: false, mensagem: error.message || "Ação permitida apenas para administrador." };
        return { sucesso: true, dados: data };
      } catch (_) {
        return { sucesso: false, mensagem: "Erro ao alterar status de acesso." };
      }
    },

    exportarCsv: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data, error } = await client.rpc("admin_export_customers_csv");
        if (error) return { sucesso: false, dados: [], mensagem: "Exportação restrita ao administrador." };
        return { sucesso: true, dados: Array.isArray(data) ? data : [] };
      } catch (_) {
        return { sucesso: false, dados: [], mensagem: "Erro ao exportar clientes." };
      }
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
    profiles,
    products,
    favorites,
    cart,
    quotes,
    issuedQuotes,
    customers,
    whatsapp,
    fiscal,
    clientes,
    consentimentos,
    retencao,
    direitosTitular,
    calculadora,
    guardiao
  };
});

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

    // Login com Google OAuth
    loginGoogle: async function () {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, fallback: true, mensagem: "Supabase não configurado." };
      }

      try {
        const baseOrigin = (typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("lojasj3d.com.br")))
          ? "https://www.lojasj3d.com.br"
          : (window.location.origin || "");
        const redirectTo = baseOrigin + (window.location.pathname || "/");
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
        } catch (_) { }
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
        } catch (_) {}
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
        } catch (_) {}
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
        } catch (_) {}
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
    solicitar: async function (dados) {
      if (!dados || !dados.nome || !dados.email || !dados.tipo) {
        return { sucesso: false, mensagem: "Nome, e-mail e tipo de solicitação são obrigatórios." };
      }

      const client = inicializarCliente();
      const protocolo = "LGPD-2026-" + Math.floor(1000 + Math.random() * 9000);
      const emailLimpo = String(dados.email).trim().toLowerCase();
      const nomeLimpo = String(dados.nome).trim();
      const docLimpo = String(dados.cpf || dados.cnpjCpf || "").trim();

      const registro = {
        protocolo,
        titular_nome: nomeLimpo,
        titular_email: emailLimpo,
        titular_cpf: docLimpo || null,
        tipo_solicitacao: dados.tipo,
        detalhes_solicitacao: String(dados.detalhes || "").trim(),
        status: "em_analise",
        prazo_limite: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        criado_em: new Date().toISOString()
      };

      if (!client) {
        try {
          const chave = "sj_solicitacoes_titular_v1";
          const lista = JSON.parse(window.localStorage.getItem(chave) || "[]");
          lista.unshift({ ...registro, id: "solic-" + Date.now() });
          window.localStorage.setItem(chave, JSON.stringify(lista));
        } catch (_) {}
        return { sucesso: true, protocolo, local: true, registro };
      }

      try {
        const { data, error } = await client
          .from("solicitacoes_titular")
          .insert(registro)
          .select()
          .maybeSingle();

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return { sucesso: true, protocolo, registro: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    consultarProtocolo: async function (protocolo) {
      if (!protocolo) return null;
      const protLimpo = String(protocolo).trim().toUpperCase();
      const client = inicializarCliente();

      if (!client) {
        try {
          const chave = "sj_solicitacoes_titular_v1";
          const lista = JSON.parse(window.localStorage.getItem(chave) || "[]");
          return lista.find((s) => s.protocolo === protLimpo) || null;
        } catch (_) {
          return null;
        }
      }

      try {
        const { data, error } = await client
          .from("solicitacoes_titular")
          .select("*")
          .eq("protocolo", protLimpo)
          .maybeSingle();

        if (error) return null;
        return data;
      } catch (_) {
        return null;
      }
    },

    listarSolicitacoes: async function () {
      const client = inicializarCliente();
      if (!client) {
        try {
          const chave = "sj_solicitacoes_titular_v1";
          return JSON.parse(window.localStorage.getItem(chave) || "[]");
        } catch (_) {
          return [];
        }
      }

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
    },

    processarEliminacao: async function (solicitacaoId, emailOuId, responsavelEmail = "admin@lojasj.com") {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, mensagem: "Supabase não conectado." };
      }

      try {
        const { data, error } = await client.rpc("processar_eliminacao_titular", {
          p_solicitacao_id: solicitacaoId,
          p_email_ou_id: emailOuId,
          p_responsavel_email: responsavelEmail
        });

        if (error) {
          return { sucesso: false, mensagem: error.message };
        }
        return data;
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    concluirSolicitacao: async function (solicitacaoId, respostaTexto, responsavelEmail = "admin@lojasj.com") {
      const client = inicializarCliente();
      if (!client) {
        return { sucesso: false, mensagem: "Supabase não conectado." };
      }

      try {
        const { error } = await client
          .from("solicitacoes_titular")
          .update({
            status: "concluida",
            resposta_texto: respostaTexto,
            responsavel_email: responsavelEmail,
            concluida_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
          })
          .eq("id", solicitacaoId);

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
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

    // Atualiza apenas dados cadastrais do próprio perfil (nome, telefone, endereco, cidade_uf)
    // Role e status são bloqueados pelo banco (RLS + trigger) para não-admins.
    atualizarMeuPerfil: async function ({ nome, telefone, endereco, cidade_uf }) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, mensagem: "Sessão expirada. Faça login novamente." };

        const payload = {
          nome: String(nome || "").trim(),
          telefone: String(telefone || "").trim(),
          endereco: String(endereco || "").trim(),
          cidade_uf: String(cidade_uf || "").trim()
        };

        const { data, error } = await client
          .from("profiles")
          .update(payload)
          .eq("id", uid)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, perfil: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
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
          } catch (_) {}
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
  // MÓDULO DE ORÇAMENTOS DO CLIENTE (public.quotes + RLS + REALTIME)
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
          .select("*")
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
          .select("*")
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

    criar: async function (dados) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const user = sessData?.session?.user;
        if (!user?.id) return { sucesso: false, mensagem: "Faça login para enviar seu orçamento." };

        const payload = {
          user_id: user.id,
          cliente_nome: String(dados.cliente_nome || "").trim(),
          cliente_email: String(dados.cliente_email || user.email || "").trim().toLowerCase(),
          cliente_telefone: String(dados.cliente_telefone || "").trim(),
          titulo: String(dados.titulo || "Solicitação de Orçamento 3D").trim(),
          descricao: String(dados.descricao || "").trim(),
          arquivo_medidas: String(dados.arquivo_medidas || "").trim(),
          quantidade: Math.max(1, parseInt(dados.quantidade, 10) || 1),
          material_cor: String(dados.material_cor || "").trim(),
          observacoes: String(dados.observacoes || "").trim()
        };

        const { data, error } = await client
          .from("quotes")
          .insert(payload)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Equipe (staff/admin) responde orçamento com valor, texto e status
    responderEquipe: async function (id, { status, valor_estimado, resposta_equipe }) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const payload = {
          status: status || "respondido",
          resposta_equipe: String(resposta_equipe || "").trim()
        };
        if (valor_estimado !== undefined && valor_estimado !== "" && valor_estimado !== null) {
          const num = Number(String(valor_estimado).replace(",", "."));
          if (!isNaN(num) && num >= 0) payload.valor_estimado = num;
        }
        const { data, error } = await client
          .from("quotes")
          .update(payload)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    // Cliente aprova ou recusa um orçamento que já foi respondido pela equipe
    responderCliente: async function (id, decisao) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      const statusSeguro = decisao === "aprovado" ? "aprovado" : "recusado";
      try {
        const { data, error } = await client
          .from("quotes")
          .update({ status: statusSeguro })
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    excluir: async function (id) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { error } = await client.from("quotes").delete().eq("id", id);
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
          .channel("sj-quotes-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
      }
    }
  };

  // =========================================================================
  // MÓDULO DE SALVOS & RASCUNHOS DO CLIENTE (public.saved_items + RLS)
  // =========================================================================
  const savedItems = {
    listarMeus: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, dados: [], mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("saved_items")
          .select("*")
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

    criar: async function (dados) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, mensagem: "Faça login para salvar itens." };

        const payload = {
          user_id: uid,
          item_kind: dados.item_kind === "rascunho" ? "rascunho" : "favorito",
          product_id: dados.product_id || null,
          titulo: String(dados.titulo || "Item salvo").trim(),
          descricao: String(dados.descricao || "").trim(),
          material_cor: String(dados.material_cor || "").trim(),
          quantidade: Math.max(1, parseInt(dados.quantidade, 10) || 1),
          preco_referencia: dados.preco_referencia != null && !isNaN(Number(dados.preco_referencia)) ? Number(dados.preco_referencia) : null,
          imagem: String(dados.imagem || "").trim(),
          dados: dados.dados && typeof dados.dados === "object" ? dados.dados : {}
        };

        const { data, error } = await client
          .from("saved_items")
          .insert(payload)
          .select("*")
          .maybeSingle();

        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true, item: data };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    excluir: async function (id) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "ID inválido." };
      try {
        const { error } = await client.from("saved_items").delete().eq("id", id);
        if (error) return { sucesso: false, mensagem: error.message };
        return { sucesso: true };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    }
  };

  // =========================================================================
  // MÓDULO DE PEDIDOS DO CLIENTE (public.orders + public.order_items + RLS)
  // =========================================================================
  const orders = {
    listarMeus: async function () {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, dados: [], mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const uid = sessData?.session?.user?.id;
        if (!uid) return { sucesso: false, dados: [], mensagem: "Não autenticado." };

        const { data, error } = await client
          .from("orders")
          .select("*, order_items(*)")
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
          .from("orders")
          .select("*, order_items(*)")
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

    criarComItens: async function (pedido, itens = []) {
      const client = inicializarCliente();
      if (!client) return { sucesso: false, mensagem: "Supabase não conectado." };
      try {
        const { data: sessData } = await client.auth.getSession();
        const user = sessData?.session?.user;
        if (!user?.id) return { sucesso: false, mensagem: "Faça login para criar um pedido." };

        const itensNormalizados = (Array.isArray(itens) ? itens : []).map((it) => {
          const qtd = Math.max(1, parseInt(it.quantidade, 10) || 1);
          const unit = Number(it.preco_unitario || 0) || 0;
          return {
            product_id: it.product_id || null,
            nome: String(it.nome || "Item Loja SJ 3D").trim(),
            detalhes: String(it.detalhes || "").trim(),
            quantidade: qtd,
            preco_unitario: unit,
            subtotal: Number((qtd * unit).toFixed(2))
          };
        });

        const totalCalculado =
          pedido.total != null && Number(pedido.total) > 0
            ? Number(pedido.total)
            : itensNormalizados.reduce((acc, it) => acc + it.subtotal, 0);

        const payloadPedido = {
          user_id: user.id,
          quote_id: pedido.quote_id || null,
          cliente_nome: String(pedido.cliente_nome || "").trim(),
          cliente_email: String(pedido.cliente_email || user.email || "").trim().toLowerCase(),
          cliente_telefone: String(pedido.cliente_telefone || "").trim(),
          endereco_entrega: String(pedido.endereco_entrega || "").trim(),
          forma_entrega: pedido.forma_entrega === "entrega" ? "entrega" : "retirada",
          observacoes: String(pedido.observacoes || "").trim(),
          total: Number(totalCalculado.toFixed(2))
        };

        const { data: orderRow, error: orderErr } = await client
          .from("orders")
          .insert(payloadPedido)
          .select("*")
          .maybeSingle();

        if (orderErr || !orderRow) {
          return { sucesso: false, mensagem: orderErr?.message || "Erro ao registrar pedido." };
        }

        if (itensNormalizados.length > 0) {
          const rowsItens = itensNormalizados.map((it) => ({
            ...it,
            order_id: orderRow.id,
            user_id: user.id
          }));
          const { error: itemsErr } = await client.from("order_items").insert(rowsItens);
          if (itemsErr) {
            return { sucesso: true, item: orderRow, avisoItens: itemsErr.message };
          }
        }

        return { sucesso: true, item: orderRow };
      } catch (err) {
        return { sucesso: false, mensagem: err.message };
      }
    },

    atualizarStatus: async function (id, novoStatus) {
      const client = inicializarCliente();
      if (!client || !id) return { sucesso: false, mensagem: "Parâmetros inválidos." };
      try {
        const { data, error } = await client
          .from("orders")
          .update({ status: novoStatus })
          .eq("id", id)
          .select("*")
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
          .channel("sj-orders-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
            if (typeof onChange === "function") onChange(payload);
          })
          .subscribe();
      } catch (_) {
        return null;
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
    quotes,
    savedItems,
    orders,
    clientes,
    consentimentos,
    retencao,
    direitosTitular,
    guardiao
  };
});

/**
 * PAINEL DO CLIENTE (/conta) — LOJA SJ 3D
 * =====================================================================
 * 4 áreas:
 * 1. Favoritos (public.favorites) -> Adicionar ao carrinho, Remover
 * 2. Carrinho (public.cart_items) -> Alterar qtd, Pergunta Nota Fiscal, Validação PF/PJ,
 *    Completar dados ali mesmo ou em Meus Dados, Solicitar orçamento no WhatsApp
 * 3. Orçamentos (public.quotes + quote_items + customer_snapshot) -> Editar enquanto 'solicitado',
 *    Enviar alteração / Reenviar no WhatsApp com dados do snapshot, Trava após atendimento
 * 4. Meus Dados (public.profiles) -> Pessoa Física | Pessoa Jurídica, máscaras,
 *    busca server-side de CNPJ e CEP, CPF parcialmente mascarado fora de edição
 *
 * SEGURANÇA E LGPD:
 * - Nunca registra CPF ou CNPJ em console.log ou mensagens de erro.
 * - Valida dígitos verificadores no navegador e também no servidor/banco.
 */
(function () {
  "use strict";

  const PENDING_ACTION_KEY = "sj_pending_store_action_v1";
  const POST_LOGIN_NEXT_KEY = "sj_post_login_next_v1";

  function validarRotaInterna(raw) {
    const val = String(raw || "").trim();
    if (!val || val.length > 160) return "";
    if (!val.startsWith("/") || val.startsWith("//") || val.includes("\\") || val.includes("://")) {
      return "";
    }
    return val;
  }

  function obterDestinoPosLogin() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = validarRotaInterna(params.get("next") || params.get("returnTo"));
    if (fromQuery) return fromQuery;
    try {
      return validarRotaInterna(sessionStorage.getItem(POST_LOGIN_NEXT_KEY));
    } catch (_) {
      return "";
    }
  }

  function consumirDestinoPosLogin() {
    const dest = obterDestinoPosLogin();
    try { sessionStorage.removeItem(POST_LOGIN_NEXT_KEY); } catch (_) {}
    return dest;
  }

  const contaState = {
    perfil: null,
    produtos: [],
    favorites: [],
    cartItems: [],
    quotes: [],
    realtimeAssinado: false,
    personType: "pf",
    editandoCpf: false,
    voltarParaCarrinhoAposSalvar: false,
    ultimoCnpjConsultado: "",
    ultimoCepConsultado: ""
  };

  function escaparHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function apenasDigitos(str) {
    return String(str || "").replace(/\D/g, "");
  }

  function formatarCpf(v) {
    const d = apenasDigitos(v).slice(0, 11);
    if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
    return d;
  }

  function mascararCpfParcial(v) {
    const d = apenasDigitos(v);
    if (d.length !== 11) return "***.***.***-**";
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  }

  function formatarCnpj(v) {
    const d = apenasDigitos(v).slice(0, 14);
    if (d.length > 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    if (d.length > 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    if (d.length > 5) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length > 2) return `${d.slice(0, 2)}.${d.slice(2)}`;
    return d;
  }

  function formatarCep(v) {
    const d = apenasDigitos(v).slice(0, 8);
    if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return d;
  }

  function formatarTelefone(v) {
    const d = apenasDigitos(v).slice(0, 11);
    if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 0) return `(${d}`;
    return "";
  }

  function validarCpfOficial(raw) {
    const d = apenasDigitos(raw);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(d[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== Number(d[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(d[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    return rem === Number(d[10]);
  }

  function validarCnpjOficial(raw) {
    const d = apenasDigitos(raw);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const calc = (base, w) => {
      let s = 0;
      for (let i = 0; i < w.length; i += 1) s += Number(base[i]) * w[i];
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    if (calc(d.slice(0, 12), w1) !== Number(d[12])) return false;
    return calc(d.slice(0, 13), w2) === Number(d[13]);
  }

  function formatarMoeda(valor) {
    const num = Number(valor || 0);
    if (isNaN(num)) return "R$ 0,00";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarData(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return "—";
    }
  }

  function mostrarToast(msg, tipo = "info") {
    const container = document.getElementById("conta-toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `conta-toast ${tipo}`;
    el.innerHTML = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s ease";
      setTimeout(() => el.remove(), 260);
    }, 4400);
  }

  function mostrarFeedback(elId, tipo, texto) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!texto) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    if (tipo === "error") {
      el.style.background = "#fef2f2";
      el.style.color = "#b91c1c";
      el.style.border = "1px solid #fecaca";
    } else if (tipo === "success") {
      el.style.background = "#f0fdf4";
      el.style.color = "#15803d";
      el.style.border = "1px solid #bbf7d0";
    } else {
      el.style.background = "#eff6ff";
      el.style.color = "#1d4ed8";
      el.style.border = "1px solid #bfdbfe";
    }
    el.textContent = texto;
  }

  function labelStatusQuote(status) {
    const map = {
      solicitado: "📨 Solicitado",
      em_analise: "🔍 Em análise",
      respondido: "💬 Respondido",
      aprovado: "✅ Aprovado",
      recusado: "✖️ Recusado",
      cancelado: "🚫 Cancelado"
    };
    return map[status] || status;
  }

  function badgeEstoqueHtml(stockStatus) {
    const st = stockStatus || "disponivel";
    if (st === "esgotado") return `<span class="stock-pill stock-esgotado">🔴 Esgotado</span>`;
    if (st === "poucas_unidades") return `<span class="stock-pill stock-poucas_unidades">🟠 Poucas unidades</span>`;
    return `<span class="stock-pill stock-disponivel">🟢 Disponível</span>`;
  }

  // =========================================================================
  // VALIDAÇÃO DE CAMPOS PARA ORÇAMENTO (SEM NOTA vs COM NOTA FISCAL)
  // =========================================================================
  function validarPerfilParaOrcamento(perfil, precisaNota) {
    const p = perfil || {};
    const tipo = p.person_type === "pj" ? "pj" : "pf";
    const faltando = [];
    const camposFaltandoKeys = [];

    const addFalta = (key, label) => {
      faltando.push(label);
      if (!camposFaltandoKeys.includes(key)) camposFaltandoKeys.push(key);
    };

    const telDigits = apenasDigitos(p.telefone);
    if (telDigits.length < 10) addFalta("telefone", "Telefone / WhatsApp com DDD");

    if (tipo === "pf") {
      if (!String(p.nome || "").trim()) addFalta("nome", "Nome completo");
      if (!validarCpfOficial(p.cpf)) addFalta("cpf", "CPF válido (11 dígitos)");

      if (precisaNota) {
        if (!String(p.email || "").trim()) addFalta("email", "E-mail");
        if (apenasDigitos(p.cep).length !== 8) addFalta("cep", "CEP (8 dígitos)");
        if (!String(p.logradouro || "").trim()) addFalta("logradouro", "Rua / Logradouro");
        if (!String(p.numero || "").trim()) addFalta("numero", "Número do endereço");
        if (!String(p.bairro || "").trim()) addFalta("bairro", "Bairro");
        if (!String(p.cidade || "").trim()) addFalta("cidade", "Cidade");
        if (!/^[A-Z]{2}$/.test(String(p.uf || "").trim().toUpperCase())) addFalta("uf", "UF (Estado com 2 letras)");
      }
    } else {
      const razao = String(p.razao_social || "").trim();
      const fantasia = String(p.nome_fantasia || "").trim();
      if (!validarCnpjOficial(p.cnpj)) addFalta("cnpj", "CNPJ válido (14 dígitos)");

      if (precisaNota) {
        if (!razao) addFalta("razao_social", "Razão social");
        if (!String(p.contato_nome || "").trim()) addFalta("contato_nome", "Nome da pessoa de contato");
        if (!String(p.email || "").trim()) addFalta("email", "E-mail");
        const ieTipo = p.ie_tipo || "contribuinte";
        if (ieTipo === "contribuinte" && !String(p.inscricao_estadual || "").trim()) {
          addFalta("ie", "Inscrição Estadual (ou marcar Isento / Não contribuinte)");
        }
        if (apenasDigitos(p.cep).length !== 8) addFalta("cep", "CEP (8 dígitos)");
        if (!String(p.logradouro || "").trim()) addFalta("logradouro", "Rua / Logradouro");
        if (!String(p.numero || "").trim()) addFalta("numero", "Número do endereço");
        if (!String(p.bairro || "").trim()) addFalta("bairro", "Bairro");
        if (!String(p.cidade || "").trim()) addFalta("cidade", "Cidade");
        if (!/^[A-Z]{2}$/.test(String(p.uf || "").trim().toUpperCase())) addFalta("uf", "UF (Estado com 2 letras)");
      } else {
        if (!razao && !fantasia) addFalta("razao_social", "Razão social ou Nome fantasia");
      }
    }

    return { ok: faltando.length === 0, tipo, faltando, keys: camposFaltandoKeys };
  }

  // =========================================================================
  // CONTROLE DE TELAS (GATE x STATUS x DASHBOARD)
  // =========================================================================
  function exibirGateLogin() {
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    const forms = document.getElementById("conta-gate-forms");
    const statusScr = document.getElementById("conta-gate-status-screen");
    const mfaForm = document.getElementById("form-conta-mfa");
    if (gate) gate.style.display = "flex";
    if (dash) dash.style.display = "none";
    if (forms) forms.style.display = "block";
    if (statusScr) statusScr.style.display = "none";
    if (mfaForm) mfaForm.style.display = "none";
  }

  function exibirTelaMfa() {
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    const forms = document.getElementById("conta-gate-forms");
    const statusScr = document.getElementById("conta-gate-status-screen");
    const mfaForm = document.getElementById("form-conta-mfa");
    if (gate) gate.style.display = "flex";
    if (dash) dash.style.display = "none";
    if (forms) forms.style.display = "none";
    if (statusScr) statusScr.style.display = "none";
    if (mfaForm) {
      mfaForm.style.display = "block";
      document.getElementById("conta-mfa-code")?.focus();
    }
  }

  function exibirTelaStatus({ icon, titulo, desc, email, mostrarLinkAdmin }) {
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    const forms = document.getElementById("conta-gate-forms");
    const statusScr = document.getElementById("conta-gate-status-screen");
    const mfaForm = document.getElementById("form-conta-mfa");
    if (gate) gate.style.display = "flex";
    if (dash) dash.style.display = "none";
    if (forms) forms.style.display = "none";
    if (statusScr) statusScr.style.display = "block";
    if (mfaForm) mfaForm.style.display = "none";

    const iconEl = document.getElementById("conta-status-icon");
    const titleEl = document.getElementById("conta-status-title");
    const descEl = document.getElementById("conta-status-desc");
    const emailEl = document.getElementById("conta-status-email");
    const adminLink = document.getElementById("conta-status-admin-link");
    if (iconEl) iconEl.textContent = icon || "ℹ️";
    if (titleEl) titleEl.textContent = titulo || "";
    if (descEl) descEl.textContent = desc || "";
    if (emailEl) emailEl.textContent = email || "—";
    if (adminLink) adminLink.style.display = mostrarLinkAdmin ? "inline-flex" : "none";
  }

  async function processarAcaoPendentePosLogin() {
    const params = new URLSearchParams(window.location.search);
    let pend = null;
    try {
      const raw = sessionStorage.getItem(PENDING_ACTION_KEY);
      if (raw) {
        pend = JSON.parse(raw);
        sessionStorage.removeItem(PENDING_ACTION_KEY);
      }
    } catch (_) {}

    const action = pend?.action || params.get("action");
    const productId = pend?.productId || params.get("productId");
    const nextDest = validarRotaInterna(pend?.returnTo || consumirDestinoPosLogin());

    if (action && productId) {
      if (action === "fav") {
        await window.SJ_SUPABASE?.favorites?.adicionar(productId);
      } else if (action === "cart") {
        await window.SJ_SUPABASE?.cart?.adicionar(productId, 1);
      }
    }

    if (nextDest && !nextDest.startsWith("/conta")) {
      window.location.replace(nextDest);
      return true;
    }

    const abaUrl = params.get("aba");
    if (abaUrl && ["favoritos", "carrinho", "orcamentos", "dados"].includes(abaUrl)) {
      ativarAbaConta(abaUrl);
    } else if (action === "cart") {
      ativarAbaConta("carrinho");
    }
    return false;
  }

  async function exibirDashboardCliente(perfil) {
    contaState.perfil = perfil;
    const redirecionou = await processarAcaoPendentePosLogin();
    if (redirecionou) return;

    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    if (gate) gate.style.display = "none";
    if (dash) dash.style.display = "block";

    const nomeExibicao =
      (perfil.person_type === "pj" ? (perfil.nome_fantasia || perfil.razao_social) : perfil.nome) ||
      perfil.nome ||
      perfil.email ||
      "Cliente";
    const nameEl = document.getElementById("conta-header-user-name");
    if (nameEl) nameEl.textContent = nomeExibicao;
    const popNameEl = document.getElementById("conta-popover-user-name");
    if (popNameEl) popNameEl.textContent = nomeExibicao;
    const popEmailEl = document.getElementById("conta-popover-user-email");
    if (popEmailEl) popEmailEl.textContent = perfil.email || "—";

    preencherFormularioDados(perfil);
    await carregarTodosOsDadosCliente();
    assinarRealtimeCliente();
  }

  async function verificarSessaoCliente() {
    if (!window.SJ_SUPABASE?.auth || !window.SJ_SUPABASE?.profiles) {
      exibirGateLogin();
      return;
    }

    const sessao = await window.SJ_SUPABASE.auth.obterSessao();
    if (!sessao?.user) {
      exibirGateLogin();
      return;
    }

    const mfaInfo = await window.SJ_SUPABASE.auth.obterNivelMfa?.();
    if (mfaInfo?.requiresMfa) {
      exibirTelaMfa();
      return;
    }

    const res = await window.SJ_SUPABASE.profiles.obterMeuPerfil();
    if (!res.sucesso || !res.perfil) {
      exibirGateLogin();
      return;
    }

    const perfil = res.perfil;
    const role = String(perfil.role || "customer").toLowerCase();
    const status = String(perfil.status || "approved").toLowerCase();

    if (status === "blocked") {
      try { sessionStorage.removeItem(POST_LOGIN_NEXT_KEY); } catch (_) {}
      exibirTelaStatus({
        icon: "🚫",
        titulo: "Conta bloqueada",
        desc: "O acesso desta conta foi suspenso pela administração da Loja SJ 3D.",
        email: perfil.email
      });
      return;
    }

    if ((role === "admin" || role === "staff") && status === "approved") {
      const nextDest = consumirDestinoPosLogin();
      if (nextDest && !nextDest.startsWith("/conta")) {
        window.location.replace(nextDest);
        return;
      }
      exibirTelaStatus({
        icon: "⚙️",
        titulo: "Redirecionando para o Painel de Gestão...",
        desc: "Identificamos sua conta da equipe/administração. Levando você para /admin.",
        email: perfil.email,
        mostrarLinkAdmin: true
      });
      setTimeout(() => {
        window.location.replace("/admin");
      }, 800);
      return;
    }

    if (role === "staff" && status === "pending") {
      exibirTelaStatus({
        icon: "⏳",
        titulo: "Aguardando aprovação do administrador",
        desc: "Sua solicitação de funcionário ainda está pendente. Assim que for aprovada, acesse pelo endereço /admin.",
        email: perfil.email
      });
      return;
    }

    await exibirDashboardCliente(perfil);
  }

  // =========================================================================
  // CATÁLOGO + FAVORITOS + CARRINHO + ORÇAMENTOS
  // =========================================================================
  async function carregarCatalogoProdutos() {
    if (!window.SJ_SUPABASE?.products) return;
    const res = await window.SJ_SUPABASE.products.listarTodos();
    if (!res.sucesso) return;
    contaState.produtos = res.dados || [];

    const selQuick = document.getElementById("cart-quick-add-select");
    if (selQuick) {
      const disponiveis = contaState.produtos.filter((p) => p.stock_status !== "esgotado");
      const esgotados = contaState.produtos.filter((p) => p.stock_status === "esgotado");
      const opts = [`<option value="">+ Adicionar outro filamento ou impressora do catálogo...</option>`];
      disponiveis.forEach((p) => {
        const prefixo = p.item_type === "filament_color" ? "🎨 " : "📦 ";
        const aviso = p.stock_status === "poucas_unidades" ? " (Poucas unidades)" : "";
        opts.push(`<option value="${escaparHtml(p.id)}">${escaparHtml(prefixo + p.nome + " — " + (p.preco || formatarMoeda(p.preco_valor)) + aviso)}</option>`);
      });
      esgotados.forEach((p) => {
        opts.push(`<option value="${escaparHtml(p.id)}" disabled>🔴 [ESGOTADO] ${escaparHtml(p.nome)}</option>`);
      });
      selQuick.innerHTML = opts.join("");
    }
  }

  async function carregarMeusFavoritos() {
    const listEl = document.getElementById("conta-favorites-list");
    const badgeEl = document.getElementById("badge-conta-favorites");
    if (!window.SJ_SUPABASE?.favorites) return;

    const res = await window.SJ_SUPABASE.favorites.listarMeus();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no SQL Editor do Supabase para ativar Favoritos." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.favorites = res.dados || [];
    if (badgeEl) badgeEl.textContent = String(contaState.favorites.length);
    renderizarMeusFavoritos();
  }

  function renderizarMeusFavoritos() {
    const listEl = document.getElementById("conta-favorites-list");
    if (!listEl) return;

    if (contaState.favorites.length === 0) {
      listEl.innerHTML = `
        <div class="conta-empty">
          ❤️ Você ainda não favoritou nenhum filamento ou impressora.<br/>
          Clique no coração nos produtos da <a href="index.html#filamentos" style="color:var(--sj-orange); font-weight:800;">Loja SJ 3D</a> para guardar seus itens preferidos aqui!
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="conta-fav-grid">${contaState.favorites
      .map((fav) => {
        const p = fav.products || contaState.produtos.find((x) => x.id === fav.product_id) || {};
        const nome = p.nome || fav.product_id;
        const preco = p.preco || (p.preco_valor ? formatarMoeda(p.preco_valor) : "Sob consulta");
        const stock = p.stock_status || "disponivel";
        const esgotado = stock === "esgotado";
        const img = p.imagem || "assets/produtos/vaso-padrao.png";

        return `
          <div class="conta-item-card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
            <div>
              <div style="display:flex; gap:12px; align-items:center; margin-bottom:10px;">
                <img src="${escaparHtml(img)}" alt="${escaparHtml(nome)}" style="width:64px; height:64px; object-fit:contain; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; padding:4px;" />
                <div style="flex:1; min-width:0;">
                  <div style="font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase;">${escaparHtml(p.marca || "Loja SJ 3D")}</div>
                  <div style="font-size:0.93rem; font-weight:800; color:#0f172a; line-height:1.3;">${escaparHtml(nome)}</div>
                  <div style="font-size:0.92rem; font-weight:900; color:var(--sj-orange); margin-top:3px;">${escaparHtml(preco)}</div>
                </div>
              </div>
              <div>${badgeEstoqueHtml(stock)}</div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; padding-top:10px; border-top:1px solid #f1f5f9;">
              <button type="button" class="btn-sj-primary" style="flex:1; padding:9px 12px; font-size:0.8rem;" data-fav-add-cart="${escaparHtml(fav.product_id)}" ${esgotado ? "disabled" : ""}>
                ${esgotado ? "🔴 Esgotado" : "🛒 Adicionar ao carrinho"}
              </button>
              <button type="button" class="btn-sj-danger" data-fav-remove="${escaparHtml(fav.product_id)}" title="Remover dos favoritos">
                🗑️ Remover
              </button>
            </div>
          </div>
        `;
      })
      .join("")}</div>`;

    listEl.querySelectorAll("[data-fav-add-cart]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.favAddCart;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.cart.adicionar(pid, 1);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("🛒 Item adicionado ao seu carrinho!", "success");
          await carregarMeuCarrinho();
          ativarAbaConta("carrinho");
        } else {
          mostrarToast(`⚠️ ${escaparHtml(r.mensagem)}`, "warning");
        }
      });
    });

    listEl.querySelectorAll("[data-fav-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.favRemove;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.favorites.remover(pid);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("Removido dos seus favoritos.", "info");
          await carregarMeusFavoritos();
        } else {
          mostrarToast(`❌ Erro: ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });
  }

  async function carregarMeuCarrinho() {
    const listEl = document.getElementById("conta-cart-list");
    const badgeEl = document.getElementById("badge-conta-cart");
    const headerCountEl = document.getElementById("header-conta-cart-count");
    if (!window.SJ_SUPABASE?.cart) return;

    const res = await window.SJ_SUPABASE.cart.listarMeu();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no SQL Editor do Supabase para ativar o Carrinho." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.cartItems = res.dados || [];
    const totalUnidades = contaState.cartItems.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    if (badgeEl) badgeEl.textContent = String(totalUnidades);
    if (headerCountEl) headerCountEl.textContent = String(totalUnidades);
    renderizarMeuCarrinho();
  }

  function renderizarMeuCarrinho() {
    const listEl = document.getElementById("conta-cart-list");
    const btnClear = document.getElementById("btn-cart-clear");
    const btnReq = document.getElementById("btn-cart-request-quote");
    const sumQty = document.getElementById("cart-summary-qty");
    const sumTotal = document.getElementById("cart-summary-total");
    if (!listEl) return;

    const itens = contaState.cartItems;
    if (btnClear) btnClear.style.display = itens.length > 0 ? "inline-flex" : "none";

    const totalQtd = itens.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const valorTotal = itens.reduce((acc, it) => {
      const p = it.products || contaState.produtos.find((x) => x.id === it.product_id) || {};
      return acc + (Number(p.preco_valor || 0) * (Number(it.quantity) || 1));
    }, 0);

    if (sumQty) sumQty.textContent = String(totalQtd);
    if (sumTotal) sumTotal.textContent = formatarMoeda(valorTotal);
    if (btnReq) btnReq.disabled = itens.length === 0;

    if (itens.length === 0) {
      listEl.innerHTML = `
        <div class="conta-empty">
          🛒 Seu carrinho está vazio.<br/>
          Adicione filamentos ou impressoras pelo <a href="index.html#filamentos" style="color:var(--sj-orange); font-weight:800;">Catálogo da Loja</a> ou escolha no seletor acima.
        </div>`;
      return;
    }

    listEl.innerHTML = itens
      .map((item) => {
        const p = item.products || contaState.produtos.find((x) => x.id === item.product_id) || {};
        const nome = p.nome || item.product_id;
        const unit = Number(p.preco_valor || 0);
        const subtotal = unit * (Number(item.quantity) || 1);
        const stock = p.stock_status || "disponivel";
        const img = p.imagem || "assets/produtos/vaso-padrao.png";

        return `
          <div class="conta-item-card" style="display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:220px;">
              <img src="${escaparHtml(img)}" alt="${escaparHtml(nome)}" style="width:58px; height:58px; object-fit:contain; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; padding:4px;" />
              <div>
                <div style="font-size:0.93rem; font-weight:800; color:#0f172a;">${escaparHtml(nome)}</div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:4px;">
                  <span style="font-size:0.82rem; color:#475569;">Unit.: <strong>${escaparHtml(formatarMoeda(unit))}</strong></span>
                  ${badgeEstoqueHtml(stock)}
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <div class="qty-stepper">
                <button type="button" data-cart-step="-1" data-cart-pid="${escaparHtml(item.product_id)}" aria-label="Diminuir quantidade">−</button>
                <input type="number" min="1" max="1000" value="${escaparHtml(item.quantity)}" data-cart-input="${escaparHtml(item.product_id)}" aria-label="Quantidade" />
                <button type="button" data-cart-step="1" data-cart-pid="${escaparHtml(item.product_id)}" aria-label="Aumentar quantidade">+</button>
              </div>
              <div style="min-width:92px; text-align:right; font-weight:900; font-size:0.95rem; color:#0f172a;">
                ${escaparHtml(formatarMoeda(subtotal))}
              </div>
              <button type="button" class="btn-sj-danger" data-cart-remove="${escaparHtml(item.product_id)}" title="Remover item">
                🗑️
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-cart-step]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.cartPid;
        const delta = parseInt(btn.dataset.cartStep, 10) || 0;
        const atual = contaState.cartItems.find((x) => x.product_id === pid);
        if (!atual) return;
        const novaQtd = (Number(atual.quantity) || 1) + delta;
        if (novaQtd < 1) {
          if (!confirm("Remover este item do carrinho?")) return;
          await window.SJ_SUPABASE.cart.remover(pid);
        } else {
          await window.SJ_SUPABASE.cart.atualizarQuantidade(pid, novaQtd);
        }
        await carregarMeuCarrinho();
      });
    });

    listEl.querySelectorAll("[data-cart-input]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const pid = inp.dataset.cartInput;
        const val = Math.max(1, Math.min(1000, parseInt(inp.value, 10) || 1));
        inp.value = String(val);
        await window.SJ_SUPABASE.cart.atualizarQuantidade(pid, val);
        await carregarMeuCarrinho();
      });
    });

    listEl.querySelectorAll("[data-cart-remove]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pid = btn.dataset.cartRemove;
        btn.disabled = true;
        await window.SJ_SUPABASE.cart.remover(pid);
        await carregarMeuCarrinho();
        mostrarToast("Item removido do carrinho.", "info");
      });
    });
  }

  // Renderiza caixinha de campos faltantes diretamente no Carrinho para completar sem sair da tela
  function exibirCaixaCamposFaltantesNoCarrinho(check, precisaNota) {
    const box = document.getElementById("cart-missing-fiscal-box");
    const list = document.getElementById("cart-missing-fields-list");
    const fieldsEl = document.getElementById("cart-inline-quick-fields");
    if (!box || !list || !fieldsEl) return;

    const p = contaState.perfil || {};
    const tipoLabel = check.tipo === "pj" ? "Pessoa Jurídica" : "Pessoa Física";
    list.innerHTML = check.faltando.map((f) => `<li>${escaparHtml(f)}</li>`).join("");

    const inputs = [];
    inputs.push(`
      <div style="font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:2px;">
        Cadastro atual: <strong>${escaparHtml(tipoLabel)}</strong> ${precisaNota ? "• Com Nota Fiscal" : "• Sem Nota Fiscal"}
      </div>
    `);

    if (check.keys.includes("nome")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="nome" placeholder="Nome completo *" value="${escaparHtml(p.nome || "")}" />`);
    }
    if (check.keys.includes("cpf")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="cpf" maxlength="14" inputmode="numeric" placeholder="CPF (11 números) *" value="${escaparHtml(p.cpf ? formatarCpf(p.cpf) : "")}" />`);
    }
    if (check.keys.includes("cnpj")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="cnpj" maxlength="18" inputmode="numeric" placeholder="CNPJ (14 números) *" value="${escaparHtml(p.cnpj ? formatarCnpj(p.cnpj) : "")}" />`);
    }
    if (check.keys.includes("razao_social")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="razao_social" placeholder="Razão Social *" value="${escaparHtml(p.razao_social || "")}" />`);
    }
    if (check.keys.includes("contato_nome")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="contato_nome" placeholder="Nome da pessoa de contato *" value="${escaparHtml(p.contato_nome || "")}" />`);
    }
    if (check.keys.includes("ie")) {
      inputs.push(`
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <select class="conta-select" data-quick-field="ie_tipo" style="padding:9px; font-size:0.8rem;">
            <option value="contribuinte" ${p.ie_tipo === "contribuinte" ? "selected" : ""}>Contribuinte IE</option>
            <option value="isento" ${p.ie_tipo === "isento" ? "selected" : ""}>Isento</option>
            <option value="nao_contribuinte" ${p.ie_tipo === "nao_contribuinte" ? "selected" : ""}>Não contribuinte</option>
          </select>
          <input type="text" class="conta-input" data-quick-field="inscricao_estadual" placeholder="Nº Inscrição Estadual" value="${escaparHtml(p.inscricao_estadual || "")}" style="padding:9px; font-size:0.8rem;" />
        </div>
      `);
    }
    if (check.keys.includes("telefone")) {
      inputs.push(`<input type="tel" class="conta-input" data-quick-field="telefone" maxlength="15" placeholder="Telefone / WhatsApp com DDD *" value="${escaparHtml(p.telefone ? formatarTelefone(p.telefone) : "")}" />`);
    }
    if (check.keys.includes("cep")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="cep" maxlength="9" inputmode="numeric" placeholder="CEP (00000-000) *" value="${escaparHtml(p.cep ? formatarCep(p.cep) : "")}" />`);
    }
    if (check.keys.includes("logradouro")) {
      inputs.push(`<input type="text" class="conta-input" data-quick-field="logradouro" placeholder="Rua / Logradouro *" value="${escaparHtml(p.logradouro || "")}" />`);
    }
    if (check.keys.includes("numero") || check.keys.includes("bairro")) {
      inputs.push(`
        <div style="display:grid; grid-template-columns:100px 1fr; gap:6px;">
          <input type="text" class="conta-input" data-quick-field="numero" placeholder="Número *" value="${escaparHtml(p.numero || "")}" />
          <input type="text" class="conta-input" data-quick-field="bairro" placeholder="Bairro *" value="${escaparHtml(p.bairro || "")}" />
        </div>
      `);
    }
    if (check.keys.includes("cidade") || check.keys.includes("uf")) {
      inputs.push(`
        <div style="display:grid; grid-template-columns:1fr 75px; gap:6px;">
          <input type="text" class="conta-input" data-quick-field="cidade" placeholder="Cidade *" value="${escaparHtml(p.cidade || "")}" />
          <input type="text" class="conta-input" data-quick-field="uf" maxlength="2" placeholder="UF *" style="text-transform:uppercase;" value="${escaparHtml(p.uf || "")}" />
        </div>
      `);
    }

    fieldsEl.innerHTML = inputs.join("");
    box.style.display = "block";

    // Aplica máscaras nos campos rápidos inline
    fieldsEl.querySelector("[data-quick-field='cpf']")?.addEventListener("input", (e) => { e.target.value = formatarCpf(e.target.value); });
    fieldsEl.querySelector("[data-quick-field='cnpj']")?.addEventListener("input", (e) => { e.target.value = formatarCnpj(e.target.value); });
    fieldsEl.querySelector("[data-quick-field='telefone']")?.addEventListener("input", (e) => { e.target.value = formatarTelefone(e.target.value); });
    const qCep = fieldsEl.querySelector("[data-quick-field='cep']");
    qCep?.addEventListener("input", async (e) => {
      e.target.value = formatarCep(e.target.value);
      const dig = apenasDigitos(e.target.value);
      if (dig.length === 8) {
        const resCep = await window.SJ_SUPABASE.fiscal.consultarCep(dig);
        if (resCep?.sucesso && resCep.dados) {
          const setQ = (k, val) => { const el = fieldsEl.querySelector(`[data-quick-field='${k}']`); if (el && !el.value && val) el.value = val; };
          setQ("logradouro", resCep.dados.logradouro);
          setQ("bairro", resCep.dados.bairro);
          setQ("cidade", resCep.dados.cidade);
          setQ("uf", resCep.dados.uf);
        }
      }
    });
  }

  function ocultarCaixaCamposFaltantesNoCarrinho() {
    const box = document.getElementById("cart-missing-fiscal-box");
    if (box) box.style.display = "none";
  }

  // 3. ORÇAMENTOS
  async function carregarMeusOrcamentos() {
    const listEl = document.getElementById("conta-quotes-list");
    const badgeEl = document.getElementById("badge-conta-quotes");
    if (!window.SJ_SUPABASE?.quotes) return;

    const res = await window.SJ_SUPABASE.quotes.listarMeus();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no SQL Editor do Supabase para ativar Orçamentos." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.quotes = res.dados || [];
    if (badgeEl) badgeEl.textContent = String(contaState.quotes.length);
    renderizarMeusOrcamentos();
  }

  function renderizarMeusOrcamentos() {
    const listEl = document.getElementById("conta-quotes-list");
    if (!listEl) return;

    if (contaState.quotes.length === 0) {
      listEl.innerHTML = `
        <div class="conta-empty">
          📋 Você ainda não possui orçamentos solicitados.<br/>
          Adicione itens ao <strong>Carrinho</strong> e clique em <strong>Solicitar orçamento no WhatsApp</strong>!
        </div>`;
      return;
    }

    const opcoesCatalogoDisponiveis = contaState.produtos
      .filter((p) => p.stock_status !== "esgotado")
      .map((p) => {
        const prefixo = p.item_type === "filament_color" ? "🎨 " : "📦 ";
        return `<option value="${escaparHtml(p.id)}">${escaparHtml(prefixo + p.nome + " — " + (p.preco || formatarMoeda(p.preco_valor)))}</option>`;
      })
      .join("");

    listEl.innerHTML = contaState.quotes
      .map((q) => {
        const editavel = q.status === "solicitado";
        const itens = Array.isArray(q.quote_items) ? q.quote_items : [];
        const totalRef = itens.reduce((acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 1), 0);
        const temRespostaEquipe = Boolean(q.admin_response || (q.admin_total != null && Number(q.admin_total) > 0));
        const comNota = Boolean(q.precisa_nota_fiscal);
        const snap = q.customer_snapshot && typeof q.customer_snapshot === "object" ? q.customer_snapshot : {};

        const docLabel = snap.person_type === "pj"
          ? (snap.cnpj ? `CNPJ ${formatarCnpj(snap.cnpj)}` : "")
          : (snap.cpf ? `CPF ${mascararCpfParcial(snap.cpf)}` : "");

        const itensHtml = itens
          .map((it) => {
            const sub = Number(it.unit_price || 0) * Number(it.quantity || 1);
            if (!editavel) {
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px dashed #e2e8f0; font-size:0.85rem;">
                  <span><strong>${escaparHtml(it.quantity)}x</strong> ${escaparHtml(it.product_name)}</span>
                  <span style="font-weight:800;">${escaparHtml(formatarMoeda(sub))}</span>
                </div>`;
            }
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 0; border-bottom:1px dashed #e2e8f0;">
                <div style="flex:1; min-width:180px;">
                  <div style="font-size:0.86rem; font-weight:800; color:#0f172a;">${escaparHtml(it.product_name)}</div>
                  <div style="font-size:0.76rem; color:#64748b;">Unit.: ${escaparHtml(formatarMoeda(it.unit_price))}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div class="qty-stepper">
                    <button type="button" data-qitem-step="-1" data-quote-id="${escaparHtml(q.id)}" data-product-id="${escaparHtml(it.product_id)}" data-current-qty="${escaparHtml(it.quantity)}">−</button>
                    <input type="number" min="1" max="1000" value="${escaparHtml(it.quantity)}" data-qitem-input="${escaparHtml(q.id)}" data-product-id="${escaparHtml(it.product_id)}" />
                    <button type="button" data-qitem-step="1" data-quote-id="${escaparHtml(q.id)}" data-product-id="${escaparHtml(it.product_id)}" data-current-qty="${escaparHtml(it.quantity)}">+</button>
                  </div>
                  <button type="button" class="btn-sj-danger" style="padding:6px 10px;" data-qitem-del="${escaparHtml(it.id)}" title="Remover item do orçamento">🗑️</button>
                </div>
              </div>`;
          })
          .join("");

        return `
          <div class="conta-item-card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="font-size:1.05rem; font-weight:900; color:#0f172a;">Orçamento nº ${escaparHtml(q.quote_number)}</span>
                  <span class="conta-status-badge status-${escaparHtml(q.status)}">${escaparHtml(labelStatusQuote(q.status))}</span>
                  <span style="padding:3px 9px; border-radius:999px; font-size:0.7rem; font-weight:800; background:${comNota ? "#dcfce7" : "#f1f5f9"}; color:${comNota ? "#15803d" : "#475569"};">
                    ${comNota ? "🧾 Com Nota Fiscal" : "📄 Sem Nota Fiscal"}
                  </span>
                  ${q.changed_by_customer ? `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:999px;">✏️ Alterado por você</span>` : ""}
                </div>
                <div style="font-size:0.76rem; color:#64748b; margin-top:4px;">
                  Solicitado em ${escaparHtml(formatarData(q.created_at))} • Referência: <strong>${escaparHtml(formatarMoeda(totalRef))}</strong>
                  ${snap.display_name ? ` • ${escaparHtml(snap.display_name)}` : ""}
                  ${docLabel ? ` (${escaparHtml(docLabel)})` : ""}
                </div>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${editavel && q.changed_by_customer ? `
                  <button type="button" class="btn-sj-whatsapp" style="padding:8px 13px; font-size:0.8rem;" data-quote-whatsapp-updated="${escaparHtml(q.id)}">
                    📲 Enviar alteração no WhatsApp
                  </button>
                ` : ""}
                ${editavel ? `
                  <button type="button" class="btn-sj-secondary" style="padding:8px 13px; font-size:0.8rem;" data-quote-whatsapp-resend="${escaparHtml(q.id)}">
                    📲 Reenviar no WhatsApp
                  </button>
                ` : `
                  <button type="button" class="btn-sj-secondary" style="padding:8px 13px; font-size:0.8rem;" data-quote-whatsapp-ask="${escaparHtml(q.id)}">
                    💬 Falar no WhatsApp
                  </button>
                `}
              </div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; margin-bottom:12px;">
              ${itensHtml || `<div style="font-size:0.82rem; color:#64748b; padding:6px 0;">Nenhum item neste orçamento.</div>`}
            </div>

            ${editavel ? `
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
                <select data-quote-add-select="${escaparHtml(q.id)}" class="conta-select" style="flex:1; min-width:210px; padding:8px 11px; font-size:0.8rem;">
                  <option value="">+ Adicionar item do catálogo a este orçamento...</option>
                  ${opcoesCatalogoDisponiveis}
                </select>
                <button type="button" class="btn-sj-secondary" style="padding:8px 13px; font-size:0.8rem;" data-quote-add-btn="${escaparHtml(q.id)}">+ Adicionar Item</button>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding-top:8px; border-top:1px solid #f1f5f9;">
                <span style="font-size:0.76rem; color:#64748b;">💡 Você pode ajustar itens livremente enquanto a equipe ainda não iniciou o atendimento.</span>
                <div style="display:flex; gap:8px;">
                  <button type="button" class="btn-sj-danger" data-quote-cancel="${escaparHtml(q.id)}">🚫 Cancelar Orçamento</button>
                  <button type="button" class="btn-sj-danger" data-quote-delete="${escaparHtml(q.id)}">🗑️ Excluir</button>
                </div>
              </div>
            ` : `
              <div style="font-size:0.78rem; color:#475569; background:#f1f5f9; padding:9px 12px; border-radius:9px;">
                🔒 Este orçamento já está com status <strong>${escaparHtml(labelStatusQuote(q.status))}</strong> e fica bloqueado para edição direta. Se precisar de ajustes, clique em <strong>Falar no WhatsApp</strong>.
              </div>
            `}

            ${temRespostaEquipe ? `
              <div style="margin-top:12px; padding:12px 14px; border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0;">
                <div style="font-size:0.73rem; font-weight:800; color:#15803d; text-transform:uppercase; margin-bottom:4px;">Retorno da Equipe Loja SJ 3D</div>
                ${q.admin_total != null && Number(q.admin_total) > 0 ? `<div style="font-size:1.12rem; font-weight:900; color:#14532d; margin-bottom:4px;">Valor Final: ${escaparHtml(formatarMoeda(q.admin_total))}</div>` : ""}
                ${q.admin_response ? `<div style="font-size:0.84rem; color:#166534; line-height:1.45;">${escaparHtml(q.admin_response)}</div>` : ""}
              </div>
            ` : ""}
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-qitem-step]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const quoteId = btn.dataset.quoteId;
        const productId = btn.dataset.productId;
        const atual = parseInt(btn.dataset.currentQty, 10) || 1;
        const delta = parseInt(btn.dataset.qitemStep, 10) || 0;
        const nova = atual + delta;
        if (nova < 1) return;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.quotes.salvarItemCliente(quoteId, productId, nova);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("✏️ Quantidade atualizada! Clique em 'Enviar alteração no WhatsApp' para avisar a loja.", "success");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-qitem-input]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const quoteId = inp.dataset.qitemInput;
        const productId = inp.dataset.productId;
        const nova = Math.max(1, Math.min(1000, parseInt(inp.value, 10) || 1));
        const r = await window.SJ_SUPABASE.quotes.salvarItemCliente(quoteId, productId, nova);
        if (r.sucesso) {
          mostrarToast("✏️ Quantidade atualizada!", "success");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-qitem-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.qitemDel;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.quotes.removerItemCliente(itemId);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("Item removido do orçamento.", "info");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-add-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const quoteId = btn.dataset.quoteAddBtn;
        const sel = listEl.querySelector(`[data-quote-add-select="${quoteId}"]`);
        const productId = sel ? sel.value : "";
        if (!productId) {
          mostrarToast("Selecione um produto do catálogo para incluir.", "warning");
          return;
        }
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.quotes.salvarItemCliente(quoteId, productId, 1);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("➕ Item incluído no orçamento! Clique em 'Enviar alteração no WhatsApp'.", "success");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const quoteId = btn.dataset.quoteCancel;
        if (!confirm("Deseja cancelar este orçamento?")) return;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.quotes.cancelarCliente(quoteId);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("Orçamento cancelado.", "info");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const quoteId = btn.dataset.quoteDelete;
        if (!confirm("Excluir permanentemente este orçamento?")) return;
        btn.disabled = true;
        const r = await window.SJ_SUPABASE.quotes.excluir(quoteId);
        btn.disabled = false;
        if (r.sucesso) {
          mostrarToast("🗑️ Orçamento excluído.", "info");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
        }
      });
    });

    async function abrirWhatsAppDoOrcamento(quoteId, ehAlteracao) {
      const q = contaState.quotes.find((x) => x.id === quoteId);
      if (!q) return;
      const snap = q.customer_snapshot && Object.keys(q.customer_snapshot).length > 0
        ? q.customer_snapshot
        : contaState.perfil;
      const url = await window.SJ_SUPABASE.whatsapp.gerarUrlOrcamento({
        quoteNumber: q.quote_number,
        clienteNome: q.cliente_nome || contaState.perfil?.nome,
        items: q.quote_items || [],
        notes: q.notes || "",
        ehAlteracao,
        precisaNotaFiscal: Boolean(q.precisa_nota_fiscal),
        snapshot: snap
      });
      window.open(url, "_blank", "noopener");
    }

    listEl.querySelectorAll("[data-quote-whatsapp-updated]").forEach((btn) => {
      btn.addEventListener("click", () => abrirWhatsAppDoOrcamento(btn.dataset.quoteWhatsappUpdated, true));
    });
    listEl.querySelectorAll("[data-quote-whatsapp-resend]").forEach((btn) => {
      btn.addEventListener("click", () => abrirWhatsAppDoOrcamento(btn.dataset.quoteWhatsappResend, false));
    });
    listEl.querySelectorAll("[data-quote-whatsapp-ask]").forEach((btn) => {
      btn.addEventListener("click", () => abrirWhatsAppDoOrcamento(btn.dataset.quoteWhatsappAsk, true));
    });
  }

  // =========================================================================
  // 4. MEUS DADOS: PF / PJ, MÁSCARAS, CPF MASCARADO, CNPJ & CEP VIA SERVIDOR
  // =========================================================================
  function alternarTipoPessoaFormulario(tipo) {
    contaState.personType = tipo === "pj" ? "pj" : "pf";
    document.querySelectorAll("#profile-person-type-tabs [data-person-type]").forEach((b) => {
      b.classList.toggle("active", b.dataset.personType === contaState.personType);
    });
    const secPf = document.getElementById("profile-section-pf");
    const secPj = document.getElementById("profile-section-pj");
    if (secPf) secPf.style.display = contaState.personType === "pf" ? "block" : "none";
    if (secPj) secPj.style.display = contaState.personType === "pj" ? "block" : "none";
  }

  function atualizarEstadoCampoCpf(cpfSalvo, forcarEdicao = false) {
    const maskWrap = document.getElementById("profile-cpf-masked-wrap");
    const maskText = document.getElementById("profile-cpf-masked-text");
    const cpfInput = document.getElementById("profile-pf-cpf");
    const digitos = apenasDigitos(cpfSalvo);

    if (digitos.length === 11 && validarCpfOficial(digitos) && !forcarEdicao) {
      contaState.editandoCpf = false;
      if (maskText) maskText.textContent = mascararCpfParcial(digitos);
      if (maskWrap) maskWrap.style.display = "flex";
      if (cpfInput) {
        cpfInput.value = formatarCpf(digitos);
        cpfInput.style.display = "none";
      }
    } else {
      contaState.editandoCpf = true;
      if (maskWrap) maskWrap.style.display = "none";
      if (cpfInput) {
        cpfInput.style.display = "block";
        if (digitos) cpfInput.value = formatarCpf(digitos);
      }
    }
  }

  function sincronizarEstadoCampoIE() {
    const selIe = document.getElementById("profile-pj-ie-tipo");
    const inpIe = document.getElementById("profile-pj-ie");
    if (!selIe || !inpIe) return;
    const contribuinte = selIe.value === "contribuinte";
    inpIe.disabled = !contribuinte;
    if (!contribuinte) {
      inpIe.value = "";
      inpIe.placeholder = selIe.value === "isento" ? "Isento de Inscrição Estadual" : "Não contribuinte";
      inpIe.style.background = "#f1f5f9";
    } else {
      inpIe.placeholder = "Número da Inscrição Estadual";
      inpIe.style.background = "#ffffff";
    }
  }

  function preencherFormularioDados(perfil) {
    const p = perfil || {};
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };

    alternarTipoPessoaFormulario(p.person_type === "pj" ? "pj" : "pf");

    setVal("profile-email", p.email || "");
    setVal("profile-pf-nome", p.nome || "");
    atualizarEstadoCampoCpf(p.cpf || "", false);

    setVal("profile-pj-cnpj", p.cnpj ? formatarCnpj(p.cnpj) : "");
    setVal("profile-pj-razao", p.razao_social || "");
    setVal("profile-pj-fantasia", p.nome_fantasia || "");
    setVal("profile-pj-ie-tipo", p.ie_tipo || "contribuinte");
    setVal("profile-pj-ie", p.inscricao_estadual || "");
    setVal("profile-pj-contato", p.contato_nome || p.nome || "");
    sincronizarEstadoCampoIE();

    setVal("profile-telefone", p.telefone ? formatarTelefone(p.telefone) : "");
    setVal("profile-cep", p.cep ? formatarCep(p.cep) : "");
    setVal("profile-logradouro", p.logradouro || "");
    setVal("profile-numero", p.numero || "");
    setVal("profile-complemento", p.complemento || "");
    setVal("profile-bairro", p.bairro || "");
    setVal("profile-cidade", p.cidade || "");
    setVal("profile-uf", (p.uf || "").toUpperCase());
  }

  async function executarBuscaCnpjServidor(cnpjRaw) {
    const fb = document.getElementById("profile-cnpj-feedback");
    const alertBox = document.getElementById("profile-cnpj-status-alert");
    const btn = document.getElementById("btn-lookup-cnpj");
    const digits = apenasDigitos(cnpjRaw);

    if (alertBox) alertBox.style.display = "none";

    if (digits.length !== 14) {
      if (fb) {
        fb.style.display = "block";
        fb.style.color = "#b91c1c";
        fb.textContent = "Informe os 14 dígitos do CNPJ.";
      }
      return;
    }

    if (!validarCnpjOficial(digits)) {
      if (fb) {
        fb.style.display = "block";
        fb.style.color = "#b91c1c";
        fb.textContent = "❌ CNPJ inválido (dígitos verificadores não conferem). Confira os números.";
      }
      return;
    }

    if (fb) {
      fb.style.display = "block";
      fb.style.color = "#1d4ed8";
      fb.textContent = "🔍 Consultando dados oficiais da empresa...";
    }
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Buscando..."; }

    const res = await window.SJ_SUPABASE.fiscal.consultarCnpj(digits);

    if (btn) { btn.disabled = false; btn.textContent = "🔍 Buscar CNPJ"; }

    if (!res?.sucesso || !res.dados) {
      if (fb) {
        fb.style.display = "block";
        fb.style.color = "#b45309";
        fb.textContent = `ℹ️ ${res?.mensagem || "CNPJ não localizado automaticamente. Preencha os campos abaixo manualmente."}`;
      }
      return;
    }

    const d = res.dados;
    const setEdit = (id, v) => {
      const el = document.getElementById(id);
      if (el && v) el.value = v;
    };

    setEdit("profile-pj-razao", d.razao_social);
    setEdit("profile-pj-fantasia", d.nome_fantasia || d.razao_social);
    if (d.cep) setEdit("profile-cep", formatarCep(d.cep));
    setEdit("profile-logradouro", d.logradouro);
    setEdit("profile-numero", d.numero);
    setEdit("profile-complemento", d.complemento);
    setEdit("profile-bairro", d.bairro);
    setEdit("profile-cidade", d.cidade);
    setEdit("profile-uf", d.uf);
    if (d.telefone) {
      const telEl = document.getElementById("profile-telefone");
      if (telEl && !apenasDigitos(telEl.value)) {
        telEl.value = formatarTelefone(d.telefone);
      }
    }

    if (!d.ativa && alertBox) {
      alertBox.style.display = "block";
      alertBox.style.background = "#fef3c7";
      alertBox.style.color = "#92400e";
      alertBox.style.border = "1px solid #fde68a";
      alertBox.textContent = `⚠️ Atenção: situação cadastral informada na Receita: ${d.situacao_cadastral || "INATIVA"}. Verifique antes de emitir nota fiscal (campos liberados para edição).`;
    }

    if (fb) {
      fb.style.display = "block";
      fb.style.color = "#15803d";
      fb.textContent = "✅ Dados preenchidos! Todos os campos continuam editáveis e a Inscrição Estadual deve ser conferida abaixo.";
    }
  }

  async function executarBuscaCepServidor(cepRaw) {
    const fb = document.getElementById("profile-cep-feedback");
    const btn = document.getElementById("btn-lookup-cep");
    const digits = apenasDigitos(cepRaw);
    if (digits.length !== 8) {
      if (fb) {
        fb.style.display = "block";
        fb.style.color = "#b91c1c";
        fb.textContent = "Informe os 8 números do CEP.";
      }
      return;
    }

    if (fb) {
      fb.style.display = "block";
      fb.style.color = "#1d4ed8";
      fb.textContent = "🔍 Buscando endereço pelo CEP...";
    }
    if (btn) btn.disabled = true;

    const res = await window.SJ_SUPABASE.fiscal.consultarCep(digits);

    if (btn) btn.disabled = false;

    if (!res?.sucesso || !res.dados) {
      if (fb) {
        fb.style.display = "block";
        fb.style.color = "#b45309";
        fb.textContent = "CEP não encontrado automaticamente. Preencha manualmente.";
      }
      return;
    }

    const d = res.dados;
    const setEdit = (id, v) => {
      const el = document.getElementById(id);
      if (el && v) el.value = v;
    };
    setEdit("profile-logradouro", d.logradouro);
    if (d.complemento) setEdit("profile-complemento", d.complemento);
    setEdit("profile-bairro", d.bairro);
    setEdit("profile-cidade", d.cidade);
    setEdit("profile-uf", d.uf);

    if (fb) {
      fb.style.display = "block";
      fb.style.color = "#15803d";
      fb.textContent = "✅ Endereço preenchido (editável). Confira o número.";
    }
  }

  async function salvarPerfilDoFormulario() {
    const tipo = contaState.personType;
    const cpfRaw = document.getElementById("profile-pf-cpf")?.value || "";
    const cnpjRaw = document.getElementById("profile-pj-cnpj")?.value || "";
    const cepRaw = document.getElementById("profile-cep")?.value || "";
    const telRaw = document.getElementById("profile-telefone")?.value || "";
    const ufRaw = (document.getElementById("profile-uf")?.value || "").trim().toUpperCase();

    const cpfDigits = apenasDigitos(cpfRaw);
    const cnpjDigits = apenasDigitos(cnpjRaw);
    const cepDigits = apenasDigitos(cepRaw);
    const telDigits = apenasDigitos(telRaw);

    if (telDigits && telDigits.length < 10) {
      mostrarToast("⚠️ Informe um telefone/WhatsApp válido com DDD.", "warning");
      return false;
    }

    if (tipo === "pf" && cpfDigits) {
      if (!validarCpfOficial(cpfDigits)) {
        mostrarToast("❌ CPF inválido. Confira os 11 dígitos informados.", "error");
        return false;
      }
    }

    if (tipo === "pj" && cnpjDigits) {
      if (!validarCnpjOficial(cnpjDigits)) {
        mostrarToast("❌ CNPJ inválido. Confira os 14 dígitos informados.", "error");
        return false;
      }
    }

    if (cepDigits && cepDigits.length !== 8) {
      mostrarToast("⚠️ CEP incompleto (informe os 8 números).", "warning");
      return false;
    }

    if (ufRaw && !/^[A-Z]{2}$/.test(ufRaw)) {
      mostrarToast("⚠️ UF deve ter 2 letras (ex: PR, SP).", "warning");
      return false;
    }

    const nomePf = document.getElementById("profile-pf-nome")?.value.trim() || "";
    const razaoPj = document.getElementById("profile-pj-razao")?.value.trim() || "";
    const fantasiaPj = document.getElementById("profile-pj-fantasia")?.value.trim() || "";
    const contatoPj = document.getElementById("profile-pj-contato")?.value.trim() || "";

    const dadosSalvar = {
      person_type: tipo,
      nome: tipo === "pf" ? nomePf : (contatoPj || fantasiaPj || razaoPj || contaState.perfil?.nome || ""),
      cpf: tipo === "pf" ? cpfDigits : (contaState.perfil?.cpf || ""),
      cnpj: tipo === "pj" ? cnpjDigits : (contaState.perfil?.cnpj || ""),
      razao_social: razaoPj,
      nome_fantasia: fantasiaPj,
      ie_tipo: document.getElementById("profile-pj-ie-tipo")?.value || "contribuinte",
      inscricao_estadual: document.getElementById("profile-pj-ie")?.value.trim() || "",
      contato_nome: contatoPj,
      telefone: telRaw.trim(),
      cep: cepDigits,
      logradouro: document.getElementById("profile-logradouro")?.value.trim() || "",
      numero: document.getElementById("profile-numero")?.value.trim() || "",
      complemento: document.getElementById("profile-complemento")?.value.trim() || "",
      bairro: document.getElementById("profile-bairro")?.value.trim() || "",
      cidade: document.getElementById("profile-cidade")?.value.trim() || "",
      uf: ufRaw
    };

    const btn = document.getElementById("btn-profile-save");
    const btnBack = document.getElementById("btn-profile-save-and-cart");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Salvando..."; }
    if (btnBack) btnBack.disabled = true;

    const res = await window.SJ_SUPABASE.profiles.atualizarMeuPerfil(dadosSalvar);

    if (btn) { btn.disabled = false; btn.textContent = "💾 Salvar Meus Dados"; }
    if (btnBack) btnBack.disabled = false;

    if (!res?.sucesso) {
      mostrarToast(`❌ ${escaparHtml(res?.mensagem || "Não foi possível salvar os dados.")}`, "error");
      return false;
    }

    if (res.perfil) {
      contaState.perfil = res.perfil;
      preencherFormularioDados(res.perfil);
      const nameEl = document.getElementById("conta-header-user-name");
      if (nameEl) {
        nameEl.textContent =
          (res.perfil.person_type === "pj" ? (res.perfil.nome_fantasia || res.perfil.razao_social) : res.perfil.nome) ||
          res.perfil.email;
      }
    }

    mostrarToast("✅ Seus dados cadastrais e fiscais foram salvos com sucesso!", "success");
    return true;
  }

  async function carregarMinhasSolicitacoesLgpd() {
    const listEl = document.getElementById("conta-lgpd-requests-list");
    if (!listEl || !window.SJ_SUPABASE?.direitosTitular?.listarMinhasSolicitacoes) return;

    const itens = await window.SJ_SUPABASE.direitosTitular.listarMinhasSolicitacoes();
    if (!Array.isArray(itens) || itens.length === 0) {
      listEl.innerHTML = `<div style="padding: 12px 14px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; font-size: 0.82rem; color: #64748b;">Nenhuma solicitação de privacidade enviada por esta conta.</div>`;
      return;
    }

    const tipoMap = {
      acesso_dados: "Ver meus dados",
      correcao_dados: "Corrigir meus dados",
      eliminacao_dados: "Excluir meus dados",
      portabilidade_dados: "Levar meus dados",
      revogacao_consentimento: "Parar de receber comunicações",
      informacao_compartilhamento: "Compartilhamento com terceiros",
      outro: "Outro assunto"
    };
    const statusMap = {
      recebida: { txt: "Recebida", bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
      em_analise: { txt: "Em análise", bg: "#fffbeb", fg: "#b45309", bd: "#fde68a" },
      concluida: { txt: "Concluída", bg: "#f0fdf4", fg: "#166534", bd: "#bbf7d0" },
      negada_parcialmente: { txt: "Negada parcialmente", bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
      rejeitada: { txt: "Recusada", bg: "#fef2f2", fg: "#b91c1c", bd: "#fecaca" },
      cancelada: { txt: "Cancelada", bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" }
    };

    listEl.innerHTML = itens.map((s) => {
      const st = statusMap[s.status] || statusMap.recebida;
      const dtAbertura = s.created_at ? new Date(s.created_at).toLocaleDateString("pt-BR") : "—";
      const dtPrazo = (s.prazo_resposta || s.prazo_limite) ? new Date(s.prazo_resposta || s.prazo_limite).toLocaleDateString("pt-BR") : "—";
      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong style="font-size: 0.86rem; color: #0f172a; font-family: ui-monospace, monospace;">${escaparHtml(s.protocolo)}</strong>
            <span style="padding: 2px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; background: ${st.bg}; color: ${st.fg}; border: 1px solid ${st.bd};">${escaparHtml(st.txt)}</span>
          </div>
          <div style="font-size: 0.8rem; color: #334155; margin-top: 4px;">
            <strong>${escaparHtml(tipoMap[s.tipo_solicitacao] || s.tipo_solicitacao)}</strong> · Enviada em ${escaparHtml(dtAbertura)} · Prazo: ${escaparHtml(dtPrazo)}
          </div>
          ${s.resposta_texto ? `<div style="margin-top: 8px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 0.78rem; color: #166534;"><strong>Resposta:</strong> ${escaparHtml(s.resposta_texto)}</div>` : ""}
        </div>
      `;
    }).join("");
  }

  async function carregarTodosOsDadosCliente() {
    await carregarCatalogoProdutos();
    await Promise.all([
      carregarMeusFavoritos(),
      carregarMeuCarrinho(),
      carregarMeusOrcamentos(),
      carregarMinhasSolicitacoesLgpd()
    ]);
  }

  function assinarRealtimeCliente() {
    if (contaState.realtimeAssinado) return;
    contaState.realtimeAssinado = true;

    window.SJ_SUPABASE?.favorites?.assinarRealtime(() => carregarMeusFavoritos());
    window.SJ_SUPABASE?.cart?.assinarRealtime(() => carregarMeuCarrinho());
    window.SJ_SUPABASE?.quotes?.assinarRealtime(() => carregarMeusOrcamentos());
    window.SJ_SUPABASE?.direitosTitular?.assinarRealtime?.(() => carregarMinhasSolicitacoesLgpd());
    window.SJ_SUPABASE?.products?.assinarRealtime(async () => {
      await carregarCatalogoProdutos();
      renderizarMeusFavoritos();
      renderizarMeuCarrinho();
    });
  }

  function ativarAbaConta(aba) {
    document.querySelectorAll("[data-conta-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.contaTab === aba);
    });
    document.querySelectorAll(".conta-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `conta-pane-${aba}`);
    });
    const btnBack = document.getElementById("btn-profile-save-and-cart");
    if (btnBack) {
      btnBack.style.display = contaState.voltarParaCarrinhoAposSalvar && aba === "dados" ? "inline-flex" : "none";
    }
  }

  // Envia a solicitação de orçamento ao banco (RPC segura) e abre o WhatsApp
  async function executarSolicitacaoOrcamento(precisaNotaFiscal) {
    const btn = document.getElementById("btn-cart-request-quote");
    const notesEl = document.getElementById("cart-quote-notes");
    const notes = notesEl ? notesEl.value.trim() : "";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Gerando orçamento e abrindo WhatsApp...";
    }

    const res = await window.SJ_SUPABASE.quotes.criarDoCarrinho(notes, precisaNotaFiscal);

    if (btn) {
      btn.disabled = false;
      btn.textContent = "📲 Solicitar orçamento no WhatsApp";
    }

    if (!res.sucesso || !res.orcamento) {
      mostrarToast(`❌ ${escaparHtml(res.mensagem || "Não foi possível gerar o orçamento.")}`, "error");
      return;
    }

    ocultarCaixaCamposFaltantesNoCarrinho();
    const orc = res.orcamento;
    if (notesEl) notesEl.value = "";

    const urlWhatsApp = await window.SJ_SUPABASE.whatsapp.gerarUrlOrcamento({
      quoteNumber: orc.quote_number,
      clienteNome: orc.cliente_nome || contaState.perfil?.nome,
      items: orc.items || [],
      notes: orc.notes || "",
      ehAlteracao: false,
      precisaNotaFiscal: Boolean(orc.precisa_nota_fiscal),
      snapshot: orc.customer_snapshot || contaState.perfil
    });

    window.open(urlWhatsApp, "_blank", "noopener");
    const vipUrl = window.SJ_SITE_CHROME?.obterLinkComunidadeVip?.() || window.SITE_DATA?.loja?.comunidadeVipUrl;
    mostrarToast(
      `✅ Orçamento nº ${escaparHtml(orc.quote_number)} criado! Receba novidades e cupons no grupo VIP.`,
      "success",
      vipUrl
        ? {
            acaoTexto: "Entrar no grupo →",
            onClick: () => window.open(vipUrl, "_blank", "noopener")
          }
        : undefined
    );
    await Promise.all([carregarMeuCarrinho(), carregarMeusOrcamentos()]);
    ativarAbaConta("orcamentos");
  }

  function inicializarEventos() {
    // Preserva retorno pós-login seguro (?next=/calculadora) e aba inicial (?tab=register)
    const paramsInit = new URLSearchParams(window.location.search);
    const nextInit = validarRotaInterna(paramsInit.get("next") || paramsInit.get("returnTo"));
    if (nextInit) {
      try { sessionStorage.setItem(POST_LOGIN_NEXT_KEY, nextInit); } catch (_) {}
      const gateSub = document.getElementById("conta-gate-subtitle");
      if (gateSub && nextInit.startsWith("/calculadora")) {
        gateSub.textContent = "Entre ou crie sua conta gratuita para liberar e voltar direto para a Calculadora 3D.";
      }
    }
    const tabInit = paramsInit.get("tab");
    if (tabInit === "register" || tabInit === "login") {
      document.querySelectorAll("[data-conta-auth-tab]").forEach((b) => b.classList.toggle("active", b.dataset.contaAuthTab === tabInit));
      const fLogin = document.getElementById("form-conta-login");
      const fReg = document.getElementById("form-conta-register");
      if (fLogin) fLogin.style.display = tabInit === "login" ? "block" : "none";
      if (fReg) fReg.style.display = tabInit === "register" ? "block" : "none";
    }

    // Menu compacto do usuário no cabeçalho
    const menuBtn = document.getElementById("btn-conta-user-menu");
    const menuPop = document.getElementById("conta-user-popover");
    const fecharMenuConta = () => {
      if (menuPop) menuPop.classList.remove("is-open");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    };
    menuBtn?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const aberto = !menuPop?.classList.contains("is-open");
      if (menuPop) menuPop.classList.toggle("is-open", aberto);
      menuBtn.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
    document.addEventListener("click", (ev) => {
      if (menuPop?.classList.contains("is-open") && !ev.target.closest("#conta-acct-anchor")) {
        fecharMenuConta();
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && menuPop?.classList.contains("is-open")) {
        fecharMenuConta();
        menuBtn?.focus();
      }
    });

    // Abas Login / Cadastro no Gate
    document.querySelectorAll("[data-conta-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.contaAuthTab;
        document.querySelectorAll("[data-conta-auth-tab]").forEach((b) => b.classList.toggle("active", b === btn));
        const fLogin = document.getElementById("form-conta-login");
        const fReg = document.getElementById("form-conta-register");
        if (fLogin) fLogin.style.display = tab === "login" ? "block" : "none";
        if (fReg) fReg.style.display = tab === "register" ? "block" : "none";
        mostrarFeedback("conta-login-feedback", "info", "");
        mostrarFeedback("conta-reg-feedback", "info", "");
      });
    });

    // Abas do Dashboard
    document.querySelectorAll("[data-conta-tab]").forEach((btn) => {
      btn.addEventListener("click", () => ativarAbaConta(btn.dataset.contaTab));
    });

    document.getElementById("btn-conta-header-cart")?.addEventListener("click", () => {
      ativarAbaConta("carrinho");
    });

    // Máscara telefone no cadastro rápido
    document.getElementById("conta-reg-telefone")?.addEventListener("input", (e) => {
      e.target.value = formatarTelefone(e.target.value);
    });

    // Login de Cliente
    document.getElementById("form-conta-login")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("conta-login-email")?.value.trim().toLowerCase() || "";
      const password = document.getElementById("conta-login-senha")?.value || "";
      const btn = document.getElementById("btn-conta-login-submit");
      if (btn) { btn.disabled = true; btn.textContent = "⏳ Entrando..."; }
      mostrarFeedback("conta-login-feedback", "info", "");

      const res = await window.SJ_SUPABASE.auth.loginEmail(email, password);
      if (btn) { btn.disabled = false; btn.textContent = "Entrar na Minha Conta →"; }

      if (!res.sucesso) {
        const msg = String(res.mensagem || "").toLowerCase().includes("confirm")
          ? res.mensagem
          : "E-mail ou senha incorretos.";
        mostrarFeedback("conta-login-feedback", "error", `❌ ${msg}`);
        return;
      }

      await verificarSessaoCliente();
    });

    document.getElementById("btn-conta-google")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-conta-google");
      if (btn) btn.disabled = true;
      const nextDest = obterDestinoPosLogin();
      const res = await window.SJ_SUPABASE.auth.loginGoogle(nextDest);
      if (!res.sucesso) {
        if (btn) btn.disabled = false;
        mostrarFeedback("conta-login-feedback", "error", res.mensagem || "Erro ao iniciar login com Google.");
      }
    });

    document.getElementById("form-conta-mfa")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("conta-mfa-code")?.value || "";
      const btn = document.getElementById("btn-conta-mfa-submit");
      if (btn) { btn.disabled = true; btn.textContent = "Verificando..."; }
      mostrarFeedback("conta-mfa-feedback", "info", "");
      const res = await window.SJ_SUPABASE.auth.verificarTotpMfa(code);
      if (btn) { btn.disabled = false; btn.textContent = "Confirmar código →"; }
      if (!res.sucesso) {
        mostrarFeedback("conta-mfa-feedback", "error", res.mensagem || "Código inválido.");
        return;
      }
      await verificarSessaoCliente();
    });

    document.getElementById("form-conta-register")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = document.getElementById("conta-reg-nome")?.value.trim() || "";
      const telefone = document.getElementById("conta-reg-telefone")?.value.trim() || "";
      const email = document.getElementById("conta-reg-email")?.value.trim().toLowerCase() || "";
      const password = document.getElementById("conta-reg-senha")?.value || "";
      const btn = document.getElementById("btn-conta-reg-submit");

      if (password.length < 6) {
        mostrarFeedback("conta-reg-feedback", "error", "A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = "⏳ Criando sua conta..."; }
      mostrarFeedback("conta-reg-feedback", "info", "");

      const res = await window.SJ_SUPABASE.auth.registrar({
        nome,
        email,
        password,
        telefone,
        accountType: "customer"
      });

      if (btn) { btn.disabled = false; btn.textContent = "🚀 Criar Conta e Entrar Agora"; }

      if (!res.sucesso) {
        mostrarFeedback("conta-reg-feedback", "error", `❌ ${res.mensagem || "Não foi possível criar a conta."}`);
        return;
      }

      if (res.requerConfirmacaoEmail) {
        mostrarFeedback(
          "conta-reg-feedback",
          "success",
          "✅ Conta criada! Confirme seu e-mail na caixa de entrada e depois clique em Entrar."
        );
        return;
      }

      mostrarToast("🎉 Conta criada com sucesso! Bem-vindo à Loja SJ 3D.", "success");
      await verificarSessaoCliente();
    });

    async function fazerLogout() {
      await window.SJ_SUPABASE?.auth?.logout();
      contaState.perfil = null;
      exibirGateLogin();
      mostrarToast("Você saiu da sua conta.", "info");
    }
    document.getElementById("btn-conta-logout")?.addEventListener("click", fazerLogout);
    document.getElementById("btn-conta-status-logout")?.addEventListener("click", fazerLogout);
    document.getElementById("btn-conta-mfa-logout")?.addEventListener("click", fazerLogout);

    // Carrinho: incluir rápido, esvaziar e regra da Nota Fiscal
    document.getElementById("btn-cart-quick-add")?.addEventListener("click", async () => {
      const sel = document.getElementById("cart-quick-add-select");
      const pid = sel ? sel.value : "";
      if (!pid) {
        mostrarToast("Selecione um produto ou filamento para adicionar.", "warning");
        return;
      }
      const btn = document.getElementById("btn-cart-quick-add");
      if (btn) btn.disabled = true;
      const r = await window.SJ_SUPABASE.cart.adicionar(pid, 1);
      if (btn) btn.disabled = false;
      if (r.sucesso) {
        if (sel) sel.value = "";
        mostrarToast("🛒 Produto adicionado ao carrinho!", "success");
        await carregarMeuCarrinho();
      } else {
        mostrarToast(`⚠️ ${escaparHtml(r.mensagem)}`, "warning");
      }
    });

    document.getElementById("btn-cart-clear")?.addEventListener("click", async () => {
      if (!confirm("Deseja esvaziar todo o seu carrinho?")) return;
      const r = await window.SJ_SUPABASE.cart.esvaziar();
      if (r.sucesso) {
        mostrarToast("🧹 Carrinho esvaziado.", "info");
        await carregarMeuCarrinho();
      } else {
        mostrarToast(`❌ ${escaparHtml(r.mensagem)}`, "error");
      }
    });

    // Dica dinâmica quando cliente alterna "Precisa de nota fiscal?"
    document.querySelectorAll("input[name='cart_precisa_nf']").forEach((radio) => {
      radio.addEventListener("change", () => {
        const hintEl = document.getElementById("cart-nf-rule-hint");
        const sim = radio.value === "sim";
        if (hintEl) {
          hintEl.textContent = sim
            ? "Para Nota Fiscal, é necessário ter CPF ou CNPJ, telefone, e-mail, Inscrição Estadual (se PJ) e endereço completo."
            : "Sem Nota Fiscal, exigimos apenas nome/razão social, telefone e CPF/CNPJ.";
        }
        ocultarCaixaCamposFaltantesNoCarrinho();
      });
    });

    // Botão Solicitar Orçamento -> valida pergunta NF + campos obrigatórios antes de chamar o banco
    document.getElementById("btn-cart-request-quote")?.addEventListener("click", async () => {
      if (contaState.cartItems.length === 0) {
        mostrarToast("Adicione pelo menos 1 produto ao carrinho antes de solicitar orçamento.", "warning");
        return;
      }

      const selectedNf = document.querySelector("input[name='cart_precisa_nf']:checked");
      if (!selectedNf) {
        mostrarToast("⚠️ Responda primeiro se você precisa de Nota Fiscal (Sim ou Não).", "warning");
        return;
      }

      const precisaNota = selectedNf.value === "sim";
      const check = validarPerfilParaOrcamento(contaState.perfil, precisaNota);
      if (!check.ok) {
        exibirCaixaCamposFaltantesNoCarrinho(check, precisaNota);
        mostrarToast("⚠️ Complete os campos obrigatórios destacados para enviar o orçamento.", "warning");
        return;
      }

      await executarSolicitacaoOrcamento(precisaNota);
    });

    // Salvar campos rápidos inline no Carrinho e já enviar orçamento
    document.getElementById("btn-cart-save-quick-fiscal")?.addEventListener("click", async () => {
      const fieldsEl = document.getElementById("cart-inline-quick-fields");
      const selectedNf = document.querySelector("input[name='cart_precisa_nf']:checked");
      const precisaNota = selectedNf?.value === "sim";
      if (!fieldsEl) return;

      const p = { ...(contaState.perfil || {}) };
      fieldsEl.querySelectorAll("[data-quick-field]").forEach((el) => {
        const k = el.dataset.quickField;
        p[k] = el.value.trim();
      });

      if ((p.person_type || "pf") === "pf" && p.cpf && !validarCpfOficial(p.cpf)) {
        mostrarToast("❌ CPF inválido. Confira os 11 números informados.", "error");
        return;
      }
      if (p.person_type === "pj" && p.cnpj && !validarCnpjOficial(p.cnpj)) {
        mostrarToast("❌ CNPJ inválido. Confira os 14 números informados.", "error");
        return;
      }

      const btnQuick = document.getElementById("btn-cart-save-quick-fiscal");
      if (btnQuick) { btnQuick.disabled = true; btnQuick.textContent = "⏳ Salvando..."; }

      const resSave = await window.SJ_SUPABASE.profiles.atualizarMeuPerfil(p);

      if (btnQuick) { btnQuick.disabled = false; btnQuick.textContent = "💾 Salvar e Solicitar Orçamento"; }

      if (!resSave?.sucesso) {
        mostrarToast(`❌ ${escaparHtml(resSave?.mensagem || "Não foi possível salvar os dados.")}`, "error");
        return;
      }

      if (resSave.perfil) {
        contaState.perfil = resSave.perfil;
        preencherFormularioDados(resSave.perfil);
      }

      const recheck = validarPerfilParaOrcamento(contaState.perfil, precisaNota);
      if (!recheck.ok) {
        exibirCaixaCamposFaltantesNoCarrinho(recheck, precisaNota);
        mostrarToast("⚠️ Ainda faltam campos obrigatórios.", "warning");
        return;
      }

      await executarSolicitacaoOrcamento(precisaNota);
    });

    // Botão "Completar em Meus Dados (voltar depois)"
    document.getElementById("btn-cart-go-profile")?.addEventListener("click", () => {
      contaState.voltarParaCarrinhoAposSalvar = true;
      ativarAbaConta("dados");
      mostrarToast("👤 Complete seus dados abaixo e clique em 'Salvar e Voltar ao Carrinho'.", "info");
    });

    // Eventos da aba Meus Dados (PF/PJ toggle, máscaras, buscas CNPJ/CEP)
    document.querySelectorAll("#profile-person-type-tabs [data-person-type]").forEach((btn) => {
      btn.addEventListener("click", () => alternarTipoPessoaFormulario(btn.dataset.personType));
    });

    document.getElementById("btn-profile-edit-cpf")?.addEventListener("click", () => {
      atualizarEstadoCampoCpf(contaState.perfil?.cpf || "", true);
      document.getElementById("profile-pf-cpf")?.focus();
    });

    document.getElementById("profile-pf-cpf")?.addEventListener("input", (e) => {
      e.target.value = formatarCpf(e.target.value);
      const fb = document.getElementById("profile-cpf-feedback");
      const dig = apenasDigitos(e.target.value);
      if (!fb) return;
      if (dig.length === 0) {
        fb.style.display = "none";
      } else if (dig.length < 11) {
        fb.style.display = "block";
        fb.style.color = "#64748b";
        fb.textContent = "Digite os 11 números do CPF...";
      } else if (validarCpfOficial(dig)) {
        fb.style.display = "block";
        fb.style.color = "#15803d";
        fb.textContent = "✓ CPF válido";
      } else {
        fb.style.display = "block";
        fb.style.color = "#b91c1c";
        fb.textContent = "❌ CPF inválido (dígitos verificadores incorretos)";
      }
    });

    document.getElementById("profile-pj-cnpj")?.addEventListener("input", async (e) => {
      e.target.value = formatarCnpj(e.target.value);
      const dig = apenasDigitos(e.target.value);
      const fb = document.getElementById("profile-cnpj-feedback");
      if (dig.length === 14) {
        if (!validarCnpjOficial(dig)) {
          if (fb) {
            fb.style.display = "block";
            fb.style.color = "#b91c1c";
            fb.textContent = "❌ CNPJ inválido (dígitos verificadores incorretos).";
          }
          return;
        }
        if (contaState.ultimoCnpjConsultado !== dig) {
          contaState.ultimoCnpjConsultado = dig;
          await executarBuscaCnpjServidor(dig);
        }
      } else if (fb) {
        fb.style.display = dig.length > 0 ? "block" : "none";
        fb.style.color = "#64748b";
        fb.textContent = "Digite os 14 números do CNPJ para preenchimento automático...";
      }
    });

    document.getElementById("btn-lookup-cnpj")?.addEventListener("click", () => {
      const cnpj = document.getElementById("profile-pj-cnpj")?.value || "";
      executarBuscaCnpjServidor(cnpj);
    });

    document.getElementById("profile-pj-ie-tipo")?.addEventListener("change", sincronizarEstadoCampoIE);

    document.getElementById("profile-telefone")?.addEventListener("input", (e) => {
      e.target.value = formatarTelefone(e.target.value);
    });

    document.getElementById("profile-cep")?.addEventListener("input", async (e) => {
      e.target.value = formatarCep(e.target.value);
      const dig = apenasDigitos(e.target.value);
      if (dig.length === 8 && contaState.ultimoCepConsultado !== dig) {
        contaState.ultimoCepConsultado = dig;
        await executarBuscaCepServidor(dig);
      }
    });

    document.getElementById("btn-lookup-cep")?.addEventListener("click", () => {
      const cep = document.getElementById("profile-cep")?.value || "";
      executarBuscaCepServidor(cep);
    });

    document.getElementById("profile-uf")?.addEventListener("input", (e) => {
      e.target.value = String(e.target.value || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
    });

    document.getElementById("form-conta-profile")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await salvarPerfilDoFormulario();
    });

    document.getElementById("btn-profile-save-and-cart")?.addEventListener("click", async () => {
      const ok = await salvarPerfilDoFormulario();
      if (ok) {
        contaState.voltarParaCarrinhoAposSalvar = false;
        ativarAbaConta("carrinho");
      }
    });

    document.getElementById("btn-refresh-favorites")?.addEventListener("click", carregarMeusFavoritos);
    document.getElementById("btn-refresh-quotes")?.addEventListener("click", carregarMeusOrcamentos);
  }

  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    verificarSessaoCliente();
  });
})();

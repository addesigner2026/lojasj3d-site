/**
 * PAINEL DO CLIENTE (/conta) — LOJA SJ 3D
 * =====================================================================
 * Implementa as 4 áreas do cliente:
 * 1. Favoritos (public.favorites) -> Adicionar ao carrinho, Remover
 * 2. Carrinho (public.cart_items) -> Alterar qtd, Remover, Esvaziar, Solicitar orçamento
 * 3. Orçamentos (public.quotes + public.quote_items) -> Editar enquanto 'solicitado',
 *    Enviar alteração no WhatsApp, Reenviar no WhatsApp, Trava após atendimento da equipe
 * 4. Meus Dados (public.profiles) -> Nome, Telefone (WhatsApp), E-mail e Endereço opcional
 */
(function () {
  "use strict";

  const PENDING_ACTION_KEY = "sj_pending_store_action_v1";

  const contaState = {
    perfil: null,
    produtos: [],
    favorites: [],
    cartItems: [],
    quotes: [],
    realtimeAssinado: false
  };

  function escaparHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    }, 4200);
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
    if (st === "esgotado") {
      return `<span class="stock-pill stock-esgotado">🔴 Esgotado</span>`;
    }
    if (st === "poucas_unidades") {
      return `<span class="stock-pill stock-poucas_unidades">🟠 Poucas unidades</span>`;
    }
    return `<span class="stock-pill stock-disponivel">🟢 Disponível</span>`;
  }

  // =========================================================================
  // CONTROLE DE TELAS (GATE x STATUS x DASHBOARD)
  // =========================================================================
  function exibirGateLogin() {
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    const forms = document.getElementById("conta-gate-forms");
    const statusScr = document.getElementById("conta-gate-status-screen");
    if (gate) gate.style.display = "flex";
    if (dash) dash.style.display = "none";
    if (forms) forms.style.display = "block";
    if (statusScr) statusScr.style.display = "none";
  }

  function exibirTelaStatus({ icon, titulo, desc, email, mostrarLinkAdmin }) {
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    const forms = document.getElementById("conta-gate-forms");
    const statusScr = document.getElementById("conta-gate-status-screen");
    if (gate) gate.style.display = "flex";
    if (dash) dash.style.display = "none";
    if (forms) forms.style.display = "none";
    if (statusScr) statusScr.style.display = "block";

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

  // Processa ação pendente caso o visitante tenha clicado em Favoritar ou Adicionar ao Carrinho deslogado
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
    const returnTo = pend?.returnTo || params.get("returnTo");

    if (action && productId) {
      if (action === "fav") {
        await window.SJ_SUPABASE?.favorites?.adicionar(productId);
      } else if (action === "cart") {
        await window.SJ_SUPABASE?.cart?.adicionar(productId, 1);
      }
    }

    // Se veio de uma página da loja com returnTo, devolve a pessoa para onde ela estava!
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/conta")) {
      window.location.replace(returnTo);
      return true;
    }

    // Seleciona aba inicial pedida na URL (?aba=carrinho | favoritos | orcamentos | dados)
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

    const nameEl = document.getElementById("conta-header-user-name");
    if (nameEl) nameEl.textContent = perfil.nome || perfil.email || "Cliente";

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

    const res = await window.SJ_SUPABASE.profiles.obterMeuPerfil();
    if (!res.sucesso || !res.perfil) {
      exibirGateLogin();
      return;
    }

    const perfil = res.perfil;
    const role = String(perfil.role || "customer").toLowerCase();
    const status = String(perfil.status || "approved").toLowerCase();

    if (status === "blocked") {
      exibirTelaStatus({
        icon: "🚫",
        titulo: "Conta bloqueada",
        desc: "O acesso desta conta foi suspenso pela administração da Loja SJ 3D.",
        email: perfil.email
      });
      return;
    }

    if ((role === "admin" || role === "staff") && status === "approved") {
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
  // CARREGAMENTO DE DADOS DO CLIENTE (CATÁLOGO + FAVORITOS + CARRINHO + ORÇAMENTOS)
  // =========================================================================
  async function carregarCatalogoProdutos() {
    if (!window.SJ_SUPABASE?.products) return;
    const res = await window.SJ_SUPABASE.products.listarTodos();
    if (!res.sucesso) return;
    contaState.produtos = res.dados || [];

    // Preenche seletor rápido do carrinho (bloqueando itens esgotados)
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

  // 1. FAVORITOS
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

  // 2. CARRINHO
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

    // Stepper +/-
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

    // Input direto de quantidade
    listEl.querySelectorAll("[data-cart-input]").forEach((inp) => {
      inp.addEventListener("change", async () => {
        const pid = inp.dataset.cartInput;
        const val = Math.max(1, Math.min(1000, parseInt(inp.value, 10) || 1));
        inp.value = String(val);
        await window.SJ_SUPABASE.cart.atualizarQuantidade(pid, val);
        await carregarMeuCarrinho();
      });
    });

    // Remover item
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

  // 3. ORÇAMENTOS (SOLICITADOS VIA WHATSAPP + EDIÇÃO ENQUANTO 'solicitado')
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
                  ${q.changed_by_customer ? `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:999px;">✏️ Alterado por você</span>` : ""}
                </div>
                <div style="font-size:0.76rem; color:#64748b; margin-top:3px;">
                  Solicitado em ${escaparHtml(formatarData(q.created_at))} • Referência: <strong>${escaparHtml(formatarMoeda(totalRef))}</strong>
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

            <!-- Lista de Itens do Orçamento -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; margin-bottom:12px;">
              ${itensHtml || `<div style="font-size:0.82rem; color:#64748b; padding:6px 0;">Nenhum item neste orçamento.</div>`}
            </div>

            ${editavel ? `
              <!-- Controles de edição enquanto status === 'solicitado' -->
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

    // Bind botões de edição de itens de orçamento (enquanto 'solicitado')
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

    // Abrir WhatsApp (Reenviar / Enviar alteração / Pedir mudança)
    async function abrirWhatsAppDoOrcamento(quoteId, ehAlteracao) {
      const q = contaState.quotes.find((x) => x.id === quoteId);
      if (!q) return;
      const url = await window.SJ_SUPABASE.whatsapp.gerarUrlOrcamento({
        quoteNumber: q.quote_number,
        clienteNome: contaState.perfil?.nome || q.cliente_nome,
        items: q.quote_items || [],
        notes: q.notes || "",
        ehAlteracao
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

  function preencherFormularioDados(perfil) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    setVal("profile-email", perfil.email || "");
    setVal("profile-nome", perfil.nome || "");
    setVal("profile-telefone", perfil.telefone || "");
    setVal("profile-endereco", perfil.endereco || "");
  }

  async function carregarTodosOsDadosCliente() {
    await carregarCatalogoProdutos();
    await Promise.all([
      carregarMeusFavoritos(),
      carregarMeuCarrinho(),
      carregarMeusOrcamentos()
    ]);
  }

  function assinarRealtimeCliente() {
    if (contaState.realtimeAssinado) return;
    contaState.realtimeAssinado = true;

    window.SJ_SUPABASE?.favorites?.assinarRealtime(() => carregarMeusFavoritos());
    window.SJ_SUPABASE?.cart?.assinarRealtime(() => carregarMeuCarrinho());
    window.SJ_SUPABASE?.quotes?.assinarRealtime(() => carregarMeusOrcamentos());
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
  }

  function inicializarEventos() {
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

    // Login Google
    document.getElementById("btn-conta-google")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-conta-google");
      if (btn) btn.disabled = true;
      const res = await window.SJ_SUPABASE.auth.loginGoogle();
      if (!res.sucesso) {
        if (btn) btn.disabled = false;
        mostrarFeedback("conta-login-feedback", "error", res.mensagem || "Erro ao iniciar login com Google.");
      }
    });

    // Cadastro de Cliente (accountType: 'customer')
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

    // Logout
    async function fazerLogout() {
      await window.SJ_SUPABASE?.auth?.logout();
      contaState.perfil = null;
      exibirGateLogin();
      mostrarToast("Você saiu da sua conta.", "info");
    }
    document.getElementById("btn-conta-logout")?.addEventListener("click", fazerLogout);
    document.getElementById("btn-conta-status-logout")?.addEventListener("click", fazerLogout);

    // Adicionar item rápido no carrinho
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

    // Esvaziar carrinho
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

    // SOLICITAR ORÇAMENTO (atômico: cria orçamento 'solicitado' no banco + abre WhatsApp + esvazia carrinho + vai para aba Orçamentos)
    document.getElementById("btn-cart-request-quote")?.addEventListener("click", async () => {
      if (contaState.cartItems.length === 0) {
        mostrarToast("Adicione pelo menos 1 produto ao carrinho antes de solicitar orçamento.", "warning");
        return;
      }

      const btn = document.getElementById("btn-cart-request-quote");
      const notesEl = document.getElementById("cart-quote-notes");
      const notes = notesEl ? notesEl.value.trim() : "";

      if (btn) {
        btn.disabled = true;
        btn.textContent = "⏳ Gerando orçamento e abrindo WhatsApp...";
      }

      const res = await window.SJ_SUPABASE.quotes.criarDoCarrinho(notes);

      if (btn) {
        btn.disabled = false;
        btn.textContent = "📲 Solicitar orçamento no WhatsApp";
      }

      if (!res.sucesso || !res.orcamento) {
        mostrarToast(`❌ Erro ao gerar orçamento: ${escaparHtml(res.mensagem || "verifique se executou a Migration 006")}`, "error");
        return;
      }

      const orc = res.orcamento;
      if (notesEl) notesEl.value = "";

      // Gera link oficial do WhatsApp com número do orçamento, nome do cliente e itens
      const urlWhatsApp = await window.SJ_SUPABASE.whatsapp.gerarUrlOrcamento({
        quoteNumber: orc.quote_number,
        clienteNome: contaState.perfil?.nome || orc.cliente_nome,
        items: orc.items || [],
        notes: orc.notes || "",
        ehAlteracao: false
      });

      window.open(urlWhatsApp, "_blank", "noopener");

      mostrarToast(`✅ Orçamento nº ${escaparHtml(orc.quote_number)} registrado! Abrindo WhatsApp...`, "success");
      await Promise.all([carregarMeuCarrinho(), carregarMeusOrcamentos()]);
      ativarAbaConta("orcamentos");
    });

    // Salvar Meus Dados
    document.getElementById("form-conta-profile")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-profile-save");
      if (btn) { btn.disabled = true; btn.textContent = "⏳ Salvando..."; }

      const res = await window.SJ_SUPABASE.profiles.atualizarMeuPerfil({
        nome: document.getElementById("profile-nome")?.value.trim(),
        telefone: document.getElementById("profile-telefone")?.value.trim(),
        endereco: document.getElementById("profile-endereco")?.value.trim(),
        cidade_uf: contaState.perfil?.cidade_uf || ""
      });

      if (btn) { btn.disabled = false; btn.textContent = "💾 Salvar Meus Dados"; }

      if (!res.sucesso) {
        mostrarToast(`❌ Erro ao salvar dados: ${escaparHtml(res.mensagem)}`, "error");
        return;
      }

      if (res.perfil) {
        contaState.perfil = res.perfil;
        const nameEl = document.getElementById("conta-header-user-name");
        if (nameEl) nameEl.textContent = res.perfil.nome || res.perfil.email;
      }
      mostrarToast("✅ Seus dados foram salvos com sucesso!", "success");
    });

    document.getElementById("btn-refresh-favorites")?.addEventListener("click", carregarMeusFavoritos);
    document.getElementById("btn-refresh-quotes")?.addEventListener("click", carregarMeusOrcamentos);
  }

  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    verificarSessaoCliente();
  });
})();

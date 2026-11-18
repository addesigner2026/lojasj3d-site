/**
 * PAINEL DO CLIENTE (/conta) — LOJA SJ 3D
 * =====================================================================
 * Porta de entrada exclusiva de CLIENTES:
 * - Cadastro cria automaticamente conta 'customer' com status 'approved' (entra na hora).
 * - Funcionário ('staff') ou 'admin' aprovado que entra aqui é redirecionado para /admin.
 * - Funcionário pendente ou bloqueado vê tela de status e não acessa o painel.
 * - Todas as leituras/escritas passam pelo RLS do Supabase (isolamento por user_id).
 * - Nunca utiliza service_role key no front-end.
 */
(function () {
  "use strict";

  const contaState = {
    perfil: null,
    produtos: [],
    quotes: [],
    savedItems: [],
    orders: [],
    realtimeAssinado: false
  };

  // Sanitização obrigatória contra XSS em qualquer dado dinâmico inserido no DOM
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
    }, 4000);
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
      enviado: "📨 Enviado",
      em_analise: "🔍 Em análise",
      respondido: "💬 Respondido",
      aprovado: "✅ Aprovado",
      recusado: "✖️ Recusado"
    };
    return map[status] || status;
  }

  function labelStatusOrder(status) {
    const map = {
      recebido: "📥 Recebido",
      em_producao: "⚙️ Em produção",
      pronto: "✨ Pronto",
      enviado_retirado: "🚚 Enviado / Retirado",
      concluido: "🎉 Concluído",
      cancelado: "🚫 Cancelado"
    };
    return map[status] || status;
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

  function exibirDashboardCliente(perfil) {
    contaState.perfil = perfil;
    const gate = document.getElementById("conta-auth-gate");
    const dash = document.getElementById("conta-dashboard-shell");
    if (gate) gate.style.display = "none";
    if (dash) dash.style.display = "block";

    const nameEl = document.getElementById("conta-header-user-name");
    if (nameEl) nameEl.textContent = perfil.nome || perfil.email || "Cliente";

    preencherFormularioDados(perfil);
    carregarTodosOsDadosCliente();
    assinarRealtimeCliente();
  }

  // Valida sessão real + papel/status em public.profiles
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
    if (!res.sucesso) {
      if (res.tabelaAusente) {
        exibirTelaStatus({
          icon: "🛠️",
          titulo: "Banco em atualização",
          desc: "As tabelas de perfil ainda precisam ser ativadas no Supabase. Tente novamente em instantes.",
          email: sessao.user.email
        });
        return;
      }
      exibirGateLogin();
      return;
    }

    const perfil = res.perfil;
    if (!perfil) {
      exibirTelaStatus({
        icon: "⏳",
        titulo: "Finalizando seu cadastro...",
        desc: "Seu perfil está sendo sincronizado. Clique em sair e entre novamente.",
        email: sessao.user.email
      });
      return;
    }

    const role = String(perfil.role || "customer").toLowerCase();
    const status = String(perfil.status || "approved").toLowerCase();

    // Conta bloqueada não acessa nada
    if (status === "blocked") {
      exibirTelaStatus({
        icon: "🚫",
        titulo: "Conta bloqueada",
        desc: "O acesso desta conta foi suspenso pela administração da Loja SJ 3D.",
        email: perfil.email
      });
      return;
    }

    // Funcionário ou Admin aprovado que entra por /conta -> redireciona para /admin
    if ((role === "admin" || role === "staff") && status === "approved") {
      exibirTelaStatus({
        icon: "⚙️",
        titulo: "Redirecionando para o Painel de Gestão...",
        desc: "Identificamos sua conta de equipe/administrador. Levando você para o painel /admin.",
        email: perfil.email,
        mostrarLinkAdmin: true
      });
      setTimeout(() => {
        window.location.replace("/admin");
      }, 900);
      return;
    }

    // Funcionário ainda pendente tentando entrar por /conta -> barrado com aviso claro
    if (role === "staff" && status === "pending") {
      exibirTelaStatus({
        icon: "⏳",
        titulo: "Aguardando aprovação do administrador",
        desc: "Sua solicitação de acesso como funcionário está pendente. Assim que o administrador aprovar, entre pelo endereço /admin.",
        email: perfil.email
      });
      return;
    }

    // Cliente aprovado -> entra direto no painel /conta!
    exibirDashboardCliente(perfil);
  }

  // =========================================================================
  // CARREGAMENTO DE DADOS DO CLIENTE (CATÁLOGO + QUOTES + SAVED + ORDERS)
  // =========================================================================
  async function carregarCatalogoParaSeletores() {
    if (!window.SJ_SUPABASE?.products) return;
    const res = await window.SJ_SUPABASE.products.listarTodos();
    if (!res.sucesso) return;
    contaState.produtos = res.dados || [];

    // 1. Preenche seletor de Material/Cor no formulário de Orçamento
    const selMat = document.getElementById("quote-material-cor");
    if (selMat) {
      const cores = contaState.produtos.filter((p) => p.item_type === "filament_color" && p.stock_status !== "esgotado");
      const opcoesPadrao = [
        `<option value="A definir com a equipe">A definir com a equipe</option>`,
        `<option value="PLA (cor a combinar)">PLA — cor a combinar</option>`,
        `<option value="PETG (cor a combinar)">PETG — cor a combinar</option>`,
        `<option value="ABS / TPU (a combinar)">ABS / TPU — a combinar</option>`
      ];
      const opcoesCores = cores.map((c) => {
        const label = `${c.marca || "Filamento"} — ${c.nome}${c.cod ? " (" + c.cod + ")" : ""}`;
        return `<option value="${escaparHtml(label)}">${escaparHtml(label)}</option>`;
      });
      selMat.innerHTML = opcoesPadrao.concat(opcoesCores).join("");
    }

    // 2. Preenche seletor de Favoritos
    const selFav = document.getElementById("fav-product-select");
    if (selFav) {
      const opts = [`<option value="">-- Item personalizado / projeto livre --</option>`];
      contaState.produtos.forEach((p) => {
        const prefixo = p.item_type === "filament_color" ? "🎨 Filamento: " : "📦 Produto: ";
        const statusTag = p.stock_status === "esgotado" ? " [ESGOTADO]" : "";
        opts.push(`<option value="${escaparHtml(p.id)}">${escaparHtml(prefixo + p.nome + " — " + (p.preco || "") + statusTag)}</option>`);
      });
      selFav.innerHTML = opts.join("");
    }

    // 3. Preenche seletor de Pedido de Produto (desabilita itens esgotados!)
    const selOrder = document.getElementById("order-product-select");
    if (selOrder) {
      const disponiveis = contaState.produtos.filter((p) => p.stock_status !== "esgotado");
      const esgotados = contaState.produtos.filter((p) => p.stock_status === "esgotado");
      const opts = [`<option value="">Selecione um produto ou filamento...</option>`];
      disponiveis.forEach((p) => {
        const prefixo = p.item_type === "filament_color" ? "🎨 " : "📦 ";
        const aviso = p.stock_status === "poucas_unidades" ? " (Poucas unidades)" : "";
        opts.push(`<option value="${escaparHtml(p.id)}">${escaparHtml(prefixo + p.nome + " — " + (p.preco || formatarMoeda(p.preco_valor)) + aviso)}</option>`);
      });
      esgotados.forEach((p) => {
        opts.push(`<option value="${escaparHtml(p.id)}" disabled>🔴 [ESGOTADO] ${escaparHtml(p.nome)}</option>`);
      });
      selOrder.innerHTML = opts.join("");
    }
  }

  async function carregarMeusOrcamentos() {
    const listEl = document.getElementById("conta-quotes-list");
    const badgeEl = document.getElementById("badge-conta-quotes");
    if (!window.SJ_SUPABASE?.quotes) return;

    const res = await window.SJ_SUPABASE.quotes.listarMeus();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no Supabase para ativar Orçamentos." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.quotes = res.dados || [];
    if (badgeEl) badgeEl.textContent = contaState.quotes.length;
    renderizarMeusOrcamentos();
  }

  function renderizarMeusOrcamentos() {
    const listEl = document.getElementById("conta-quotes-list");
    if (!listEl) return;

    if (contaState.quotes.length === 0) {
      listEl.innerHTML = `<div class="conta-empty">📋 Você ainda não solicitou nenhum orçamento.<br/>Use o formulário ao lado para enviar seu primeiro projeto 3D!</div>`;
      return;
    }

    listEl.innerHTML = contaState.quotes
      .map((q) => {
        const temValor = q.valor_estimado != null && Number(q.valor_estimado) > 0;
        const acoesCliente =
          q.status === "respondido"
            ? `
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
                <button type="button" class="btn-sj-success" data-quote-approve="${escaparHtml(q.id)}">✅ Aprovar Orçamento</button>
                <button type="button" class="btn-sj-danger" data-quote-reject="${escaparHtml(q.id)}">✖️ Recusar</button>
              </div>
            `
            : q.status === "aprovado"
              ? `
                <div style="margin-top:12px;">
                  <button type="button" class="btn-sj-primary" style="padding:9px 14px; font-size:0.82rem;" data-quote-to-order="${escaparHtml(q.id)}">🛒 Transformar em Pedido Agora</button>
                </div>
              `
              : q.status === "enviado"
                ? `
                  <div style="margin-top:10px;">
                    <button type="button" class="btn-sj-danger" style="padding:6px 11px; font-size:0.75rem;" data-quote-del="${escaparHtml(q.id)}">🗑️ Cancelar solicitação</button>
                  </div>
                `
                : "";

        return `
          <div class="conta-item-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
              <div>
                <div style="font-size:0.72rem; font-weight:800; color:#64748b;">${escaparHtml(q.codigo || "")} • ${escaparHtml(formatarData(q.created_at))}</div>
                <div style="font-size:0.96rem; font-weight:800; color:#0f172a; margin-top:2px;">${escaparHtml(q.titulo || "Orçamento 3D")}</div>
              </div>
              <span class="conta-status-badge status-${escaparHtml(q.status)}">${escaparHtml(labelStatusQuote(q.status))}</span>
            </div>

            <p style="margin:0 0 8px; font-size:0.84rem; color:#334155; line-height:1.5;">${escaparHtml(q.descricao)}</p>

            <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.78rem; color:#64748b; margin-bottom:8px;">
              <span>🔢 Qtd: <strong>${escaparHtml(q.quantidade)}</strong></span>
              ${q.material_cor ? `<span>🎨 Material/Cor: <strong>${escaparHtml(q.material_cor)}</strong></span>` : ""}
              ${q.arquivo_medidas ? `<span>📐 Arquivo/Medidas: <strong>${escaparHtml(q.arquivo_medidas)}</strong></span>` : ""}
            </div>

            ${q.observacoes ? `<div style="font-size:0.78rem; color:#64748b; margin-bottom:8px;">📝 Obs.: ${escaparHtml(q.observacoes)}</div>` : ""}

            ${temValor || q.resposta_equipe ? `
              <div style="margin-top:10px; padding:12px 14px; border-radius:10px; background:#f0fdf4; border:1px solid #bbf7d0;">
                <div style="font-size:0.74rem; font-weight:800; color:#15803d; text-transform:uppercase; margin-bottom:4px;">Retorno da Equipe Loja SJ 3D</div>
                ${temValor ? `<div style="font-size:1.15rem; font-weight:900; color:#14532d; margin-bottom:4px;">${escaparHtml(formatarMoeda(q.valor_estimado))}</div>` : ""}
                ${q.resposta_equipe ? `<div style="font-size:0.83rem; color:#166534; line-height:1.45;">${escaparHtml(q.resposta_equipe)}</div>` : ""}
              </div>
            ` : ""}

            ${acoesCliente}
          </div>
        `;
      })
      .join("");

    // Bind ações dos cards
    listEl.querySelectorAll("[data-quote-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.quoteApprove;
        btn.disabled = true;
        const res = await window.SJ_SUPABASE.quotes.responderCliente(id, "aprovado");
        btn.disabled = false;
        if (res.sucesso) {
          mostrarToast("✅ Orçamento aprovado! Agora você já pode transformar em pedido.", "success");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ Erro: ${escaparHtml(res.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.quoteReject;
        if (!confirm("Deseja recusar este orçamento?")) return;
        btn.disabled = true;
        const res = await window.SJ_SUPABASE.quotes.responderCliente(id, "recusado");
        btn.disabled = false;
        if (res.sucesso) {
          mostrarToast("Orçamento marcado como recusado.", "info");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ Erro: ${escaparHtml(res.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-to-order]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.quoteToOrder;
        const quote = contaState.quotes.find((x) => x.id === id);
        if (!quote) return;
        if (!confirm(`Confirmar criação de pedido para "${quote.titulo}" (${formatarMoeda(quote.valor_estimado || 0)})?`)) return;
        btn.disabled = true;
        const perfil = contaState.perfil || {};
        const total = Number(quote.valor_estimado || 0);
        const qtd = Math.max(1, Number(quote.quantidade || 1));
        const res = await window.SJ_SUPABASE.orders.criarComItens(
          {
            quote_id: quote.id,
            cliente_nome: perfil.nome || quote.cliente_nome,
            cliente_email: perfil.email || quote.cliente_email,
            cliente_telefone: perfil.telefone || quote.cliente_telefone,
            endereco_entrega: [perfil.endereco, perfil.cidade_uf].filter(Boolean).join(" — "),
            forma_entrega: perfil.endereco ? "entrega" : "retirada",
            observacoes: `Originado do orçamento ${quote.codigo || ""}`,
            total
          },
          [
            {
              nome: quote.titulo || "Impressão 3D Sob Encomenda",
              detalhes: [quote.material_cor, quote.arquivo_medidas].filter(Boolean).join(" • "),
              quantidade: qtd,
              preco_unitario: qtd > 0 ? Number((total / qtd).toFixed(2)) : total
            }
          ]
        );
        btn.disabled = false;
        if (res.sucesso) {
          mostrarToast("🛒 Pedido criado com sucesso! Acompanhe na aba Meus Pedidos.", "success");
          await carregarMeusPedidos();
          ativarAbaConta("pedidos");
        } else {
          mostrarToast(`❌ Erro ao criar pedido: ${escaparHtml(res.mensagem)}`, "error");
        }
      });
    });

    listEl.querySelectorAll("[data-quote-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.quoteDel;
        if (!confirm("Remover esta solicitação de orçamento?")) return;
        btn.disabled = true;
        const res = await window.SJ_SUPABASE.quotes.excluir(id);
        btn.disabled = false;
        if (res.sucesso) {
          mostrarToast("🗑️ Solicitação removida.", "info");
          await carregarMeusOrcamentos();
        } else {
          mostrarToast(`❌ Erro: ${escaparHtml(res.mensagem)}`, "error");
        }
      });
    });
  }

  async function carregarMeusSalvos() {
    const listEl = document.getElementById("conta-saved-list");
    const badgeEl = document.getElementById("badge-conta-saved");
    if (!window.SJ_SUPABASE?.savedItems) return;

    const res = await window.SJ_SUPABASE.savedItems.listarMeus();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no Supabase para ativar Salvos." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.savedItems = res.dados || [];
    if (badgeEl) badgeEl.textContent = contaState.savedItems.length;
    renderizarMeusSalvos();
  }

  function renderizarMeusSalvos() {
    const listEl = document.getElementById("conta-saved-list");
    if (!listEl) return;

    if (contaState.savedItems.length === 0) {
      listEl.innerHTML = `<div class="conta-empty">🔖 Nenhum item salvo ou rascunho ainda.<br/>Guarde produtos favoritos ao lado ou salve um rascunho de orçamento.</div>`;
      return;
    }

    listEl.innerHTML = contaState.savedItems
      .map((item) => {
        const ehRascunho = item.item_kind === "rascunho";
        const tag = ehRascunho
          ? `<span class="conta-status-badge status-em_analise">📝 Rascunho de Orçamento</span>`
          : `<span class="conta-status-badge status-enviado">🔖 Item Favorito</span>`;

        return `
          <div class="conta-item-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
              <div>
                <div style="font-size:0.94rem; font-weight:800; color:#0f172a;">${escaparHtml(item.titulo)}</div>
                <div style="font-size:0.74rem; color:#64748b;">Salvo em ${escaparHtml(formatarData(item.created_at))}</div>
              </div>
              ${tag}
            </div>
            ${item.descricao ? `<p style="margin:6px 0; font-size:0.83rem; color:#334155;">${escaparHtml(item.descricao)}</p>` : ""}
            <div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.78rem; color:#64748b; margin-bottom:10px;">
              ${item.material_cor ? `<span>🎨 ${escaparHtml(item.material_cor)}</span>` : ""}
              ${item.quantidade ? `<span>🔢 Qtd: ${escaparHtml(item.quantidade)}</span>` : ""}
              ${item.preco_referencia ? `<span>💰 Ref.: <strong>${escaparHtml(formatarMoeda(item.preco_referencia))}</strong></span>` : ""}
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              ${ehRascunho ? `<button type="button" class="btn-sj-primary" style="padding:7px 12px; font-size:0.78rem;" data-saved-load-draft="${escaparHtml(item.id)}">✏️ Continuar Orçamento</button>` : ""}
              ${!ehRascunho && item.product_id ? `<button type="button" class="btn-sj-primary" style="padding:7px 12px; font-size:0.78rem;" data-saved-to-order="${escaparHtml(item.id)}">🛒 Fazer Pedido</button>` : ""}
              <button type="button" class="btn-sj-danger" style="padding:7px 12px; font-size:0.78rem;" data-saved-del="${escaparHtml(item.id)}">🗑️ Remover</button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-saved-load-draft]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = contaState.savedItems.find((x) => x.id === btn.dataset.savedLoadDraft);
        if (!item) return;
        const d = item.dados || {};
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
        setVal("quote-titulo", item.titulo);
        setVal("quote-descricao", item.descricao);
        setVal("quote-arquivo-medidas", d.arquivo_medidas || "");
        setVal("quote-quantidade", item.quantidade || 1);
        setVal("quote-material-cor", item.material_cor || "A definir com a equipe");
        setVal("quote-observacoes", d.observacoes || "");
        ativarAbaConta("orcamentos");
        mostrarToast("📝 Rascunho carregado no formulário de orçamento!", "info");
      });
    });

    listEl.querySelectorAll("[data-saved-to-order]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = contaState.savedItems.find((x) => x.id === btn.dataset.savedToOrder);
        if (!item) return;
        const sel = document.getElementById("order-product-select");
        if (sel && item.product_id) sel.value = item.product_id;
        ativarAbaConta("pedidos");
        mostrarToast("📦 Produto pré-selecionado! Confira a quantidade e confirme seu pedido.", "info");
      });
    });

    listEl.querySelectorAll("[data-saved-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.savedDel;
        btn.disabled = true;
        const res = await window.SJ_SUPABASE.savedItems.excluir(id);
        btn.disabled = false;
        if (res.sucesso) {
          mostrarToast("Item removido dos salvos.", "info");
          await carregarMeusSalvos();
        } else {
          mostrarToast(`❌ Erro: ${escaparHtml(res.mensagem)}`, "error");
        }
      });
    });
  }

  async function carregarMeusPedidos() {
    const listEl = document.getElementById("conta-orders-list");
    const badgeEl = document.getElementById("badge-conta-orders");
    if (!window.SJ_SUPABASE?.orders) return;

    const res = await window.SJ_SUPABASE.orders.listarMeus();
    if (!res.sucesso) {
      if (listEl) {
        listEl.innerHTML = `<div class="conta-empty">⚠️ ${escaparHtml(res.tabelaAusente ? "Execute a Migration 006 no Supabase para ativar Pedidos." : res.mensagem)}</div>`;
      }
      return;
    }

    contaState.orders = res.dados || [];
    if (badgeEl) badgeEl.textContent = contaState.orders.length;
    renderizarMeusPedidos();
  }

  function renderizarMeusPedidos() {
    const listEl = document.getElementById("conta-orders-list");
    if (!listEl) return;

    if (contaState.orders.length === 0) {
      listEl.innerHTML = `<div class="conta-empty">📦 Você ainda não fez nenhum pedido.<br/>Escolha um produto ao lado ou aprove um orçamento para começar!</div>`;
      return;
    }

    const etapas = [
      { key: "recebido", label: "1. Recebido" },
      { key: "em_producao", label: "2. Produção" },
      { key: "pronto", label: "3. Pronto" },
      { key: "enviado_retirado", label: "4. Enviado" },
      { key: "concluido", label: "5. Concluído" }
    ];

    listEl.innerHTML = contaState.orders
      .map((ord) => {
        const idxAtual = etapas.findIndex((e) => e.key === ord.status);
        const itens = Array.isArray(ord.order_items) ? ord.order_items : [];
        const itensHtml = itens
          .map(
            (it) => `
              <li style="display:flex; justify-content:space-between; gap:8px; padding:4px 0; font-size:0.82rem; border-bottom:1px dashed #e2e8f0;">
                <span><strong>${escaparHtml(it.quantidade)}x</strong> ${escaparHtml(it.nome)}${it.detalhes ? ` <span style="color:#64748b;">(${escaparHtml(it.detalhes)})</span>` : ""}</span>
                <span style="font-weight:700; white-space:nowrap;">${escaparHtml(formatarMoeda(it.subtotal))}</span>
              </li>
            `
          )
          .join("");

        const stepsHtml =
          ord.status === "cancelado"
            ? `<div style="margin:10px 0; padding:8px 12px; border-radius:8px; background:#fee2e2; color:#b91c1c; font-size:0.8rem; font-weight:700;">🚫 Este pedido foi cancelado.</div>`
            : `
              <div class="conta-progress-steps">
                ${etapas
                  .map((et, idx) => {
                    const cls = idx < idxAtual ? "done" : idx === idxAtual ? "current" : "";
                    return `<div class="conta-step ${cls}">${escaparHtml(et.label)}</div>`;
                  })
                  .join("")}
              </div>
            `;

        return `
          <div class="conta-item-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
              <div>
                <div style="font-size:0.74rem; font-weight:800; color:#64748b;">${escaparHtml(ord.codigo || "")} • ${escaparHtml(formatarData(ord.created_at))}</div>
                <div style="font-size:1rem; font-weight:900; color:#0f172a; margin-top:2px;">Total: ${escaparHtml(formatarMoeda(ord.total))}</div>
              </div>
              <span class="conta-status-badge status-${escaparHtml(ord.status)}">${escaparHtml(labelStatusOrder(ord.status))}</span>
            </div>

            ${stepsHtml}

            ${itensHtml ? `<ul style="list-style:none; margin:8px 0; padding:0;">${itensHtml}</ul>` : ""}

            <div style="font-size:0.78rem; color:#64748b; display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;">
              <span>🚚 ${ord.forma_entrega === "entrega" ? "Entrega" : "Retirada na loja"}</span>
              ${ord.endereco_entrega ? `<span>📍 ${escaparHtml(ord.endereco_entrega)}</span>` : ""}
              ${ord.observacoes ? `<span>📝 ${escaparHtml(ord.observacoes)}</span>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function preencherFormularioDados(perfil) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    setVal("profile-email", perfil.email || "");
    setVal("profile-nome", perfil.nome || "");
    setVal("profile-telefone", perfil.telefone || "");
    setVal("profile-endereco", perfil.endereco || "");
    setVal("profile-cidade", perfil.cidade_uf || "");

    // Pré-preenche endereço no formulário de pedido se estiver vazio
    const ordEnd = document.getElementById("order-endereco");
    if (ordEnd && !ordEnd.value && (perfil.endereco || perfil.cidade_uf)) {
      ordEnd.value = [perfil.endereco, perfil.cidade_uf].filter(Boolean).join(" — ");
    }
  }

  async function carregarTodosOsDadosCliente() {
    await Promise.all([
      carregarCatalogoParaSeletores(),
      carregarMeusOrcamentos(),
      carregarMeusSalvos(),
      carregarMeusPedidos()
    ]);
  }

  function assinarRealtimeCliente() {
    if (contaState.realtimeAssinado) return;
    contaState.realtimeAssinado = true;

    window.SJ_SUPABASE?.quotes?.assinarRealtime(() => {
      carregarMeusOrcamentos();
    });
    window.SJ_SUPABASE?.orders?.assinarRealtime(() => {
      carregarMeusPedidos();
    });
    window.SJ_SUPABASE?.products?.assinarRealtime(() => {
      carregarCatalogoParaSeletores();
    });
  }

  // =========================================================================
  // NAVEGAÇÃO DE ABAS E EVENTOS
  // =========================================================================
  function ativarAbaConta(aba) {
    document.querySelectorAll("[data-conta-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.contaTab === aba);
    });
    document.querySelectorAll(".conta-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === `conta-pane-${aba}`);
    });
  }

  function inicializarEventos() {
    // Troca de aba Login / Criar Conta no Gate
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

    // Troca de abas do Dashboard
    document.querySelectorAll("[data-conta-tab]").forEach((btn) => {
      btn.addEventListener("click", () => ativarAbaConta(btn.dataset.contaTab));
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
        // Mensagem genérica de segurança para impedir enumeração de usuários
        const msg = String(res.mensagem || "").toLowerCase().includes("confirm")
          ? res.mensagem
          : "E-mail ou senha incorretos.";
        mostrarFeedback("conta-login-feedback", "error", `❌ ${msg}`);
        return;
      }

      await verificarSessaoCliente();
    });

    // Login com Google
    document.getElementById("btn-conta-google")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-conta-google");
      if (btn) btn.disabled = true;
      const res = await window.SJ_SUPABASE.auth.loginGoogle();
      if (!res.sucesso) {
        if (btn) btn.disabled = false;
        mostrarFeedback("conta-login-feedback", "error", res.mensagem || "Erro ao iniciar login com Google.");
      }
    });

    // Cadastro de Cliente (accountType: "customer" -> aprovado automaticamente no banco!)
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
          "✅ Conta criada! Confira sua caixa de entrada para confirmar o e-mail e depois clique em Entrar."
        );
        return;
      }

      mostrarToast("🎉 Conta criada com sucesso! Bem-vindo à Loja SJ 3D.", "success");
      await verificarSessaoCliente();
    });

    // Logout (Header e tela de status)
    async function fazerLogout() {
      await window.SJ_SUPABASE?.auth?.logout();
      contaState.perfil = null;
      exibirGateLogin();
      mostrarToast("Você saiu da sua conta com segurança.", "info");
    }
    document.getElementById("btn-conta-logout")?.addEventListener("click", fazerLogout);
    document.getElementById("btn-conta-status-logout")?.addEventListener("click", fazerLogout);

    // Enviar Novo Orçamento
    document.getElementById("form-conta-new-quote")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-quote-submit");
      const perfil = contaState.perfil || {};
      const dados = {
        cliente_nome: perfil.nome || "",
        cliente_email: perfil.email || "",
        cliente_telefone: perfil.telefone || "",
        titulo: document.getElementById("quote-titulo")?.value.trim(),
        descricao: document.getElementById("quote-descricao")?.value.trim(),
        arquivo_medidas: document.getElementById("quote-arquivo-medidas")?.value.trim(),
        quantidade: Number(document.getElementById("quote-quantidade")?.value) || 1,
        material_cor: document.getElementById("quote-material-cor")?.value || "",
        observacoes: document.getElementById("quote-observacoes")?.value.trim()
      };

      if (btn) { btn.disabled = true; btn.textContent = "⏳ Enviando..."; }
      const res = await window.SJ_SUPABASE.quotes.criar(dados);
      if (btn) { btn.disabled = false; btn.textContent = "📨 Enviar Orçamento"; }

      if (!res.sucesso) {
        mostrarToast(`❌ Erro ao enviar orçamento: ${escaparHtml(res.mensagem)}`, "error");
        return;
      }

      e.target.reset();
      mostrarToast("✅ Orçamento enviado! Nossa equipe responderá por aqui em breve.", "success");
      await carregarMeusOrcamentos();
    });

    // Salvar Rascunho de Orçamento
    document.getElementById("btn-quote-save-draft")?.addEventListener("click", async () => {
      const titulo = document.getElementById("quote-titulo")?.value.trim();
      const descricao = document.getElementById("quote-descricao")?.value.trim();
      if (!titulo && !descricao) {
        mostrarToast("Preencha ao menos o nome ou a descrição antes de salvar o rascunho.", "warning");
        return;
      }
      const btn = document.getElementById("btn-quote-save-draft");
      if (btn) btn.disabled = true;
      const res = await window.SJ_SUPABASE.savedItems.criar({
        item_kind: "rascunho",
        titulo: titulo || "Rascunho de orçamento",
        descricao: descricao || "",
        material_cor: document.getElementById("quote-material-cor")?.value || "",
        quantidade: Number(document.getElementById("quote-quantidade")?.value) || 1,
        dados: {
          arquivo_medidas: document.getElementById("quote-arquivo-medidas")?.value.trim() || "",
          observacoes: document.getElementById("quote-observacoes")?.value.trim() || ""
        }
      });
      if (btn) btn.disabled = false;

      if (!res.sucesso) {
        mostrarToast(`❌ Erro ao salvar rascunho: ${escaparHtml(res.mensagem)}`, "error");
        return;
      }
      mostrarToast("💾 Rascunho salvo! Você pode retomá-lo na aba Salvos & Rascunhos.", "success");
      await carregarMeusSalvos();
    });

    // Pré-preencher título ao escolher produto no seletor de Favoritos
    document.getElementById("fav-product-select")?.addEventListener("change", (e) => {
      const prod = contaState.produtos.find((p) => p.id === e.target.value);
      const inp = document.getElementById("fav-titulo");
      if (prod && inp) inp.value = prod.nome;
    });

    // Salvar Favorito
    document.getElementById("form-conta-save-favorite")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prodId = document.getElementById("fav-product-select")?.value || null;
      const prod = prodId ? contaState.produtos.find((p) => p.id === prodId) : null;
      const btn = document.getElementById("btn-fav-submit");
      if (btn) { btn.disabled = true; btn.textContent = "⏳ Salvando..."; }

      const res = await window.SJ_SUPABASE.savedItems.criar({
        item_kind: "favorito",
        product_id: prodId || null,
        titulo: document.getElementById("fav-titulo")?.value.trim(),
        descricao: document.getElementById("fav-descricao")?.value.trim(),
        material_cor: prod?.marca || "",
        preco_referencia: prod?.preco_valor || null,
        imagem: prod?.imagem || ""
      });

      if (btn) { btn.disabled = false; btn.textContent = "🔖 Salvar na Minha Lista"; }
      if (!res.sucesso) {
        mostrarToast(`❌ Erro ao salvar: ${escaparHtml(res.mensagem)}`, "error");
        return;
      }

      e.target.reset();
      mostrarToast("🔖 Item guardado nos seus Salvos!", "success");
      await carregarMeusSalvos();
    });

    // Criar Novo Pedido de Produto
    document.getElementById("form-conta-new-order")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prodId = document.getElementById("order-product-select")?.value;
      const prod = contaState.produtos.find((p) => p.id === prodId);
      if (!prod) {
        mostrarToast("Escolha um produto ou filamento disponível.", "warning");
        return;
      }
      if (prod.stock_status === "esgotado") {
        mostrarToast("Este item está esgotado no momento.", "error");
        return;
      }

      const btn = document.getElementById("btn-order-submit");
      const qtd = Math.max(1, parseInt(document.getElementById("order-quantidade")?.value, 10) || 1);
      const unit = Number(prod.preco_valor || 0);
      const perfil = contaState.perfil || {};

      if (btn) { btn.disabled = true; btn.textContent = "⏳ Registrando pedido..."; }
      const res = await window.SJ_SUPABASE.orders.criarComItens(
        {
          cliente_nome: perfil.nome || "",
          cliente_email: perfil.email || "",
          cliente_telefone: perfil.telefone || "",
          forma_entrega: document.getElementById("order-forma-entrega")?.value || "retirada",
          endereco_entrega: document.getElementById("order-endereco")?.value.trim() || "",
          observacoes: document.getElementById("order-observacoes")?.value.trim() || "",
          total: Number((unit * qtd).toFixed(2))
        },
        [
          {
            product_id: prod.id,
            nome: prod.nome,
            detalhes: [prod.marca, prod.cod ? `Cód. ${prod.cod}` : ""].filter(Boolean).join(" • "),
            quantidade: qtd,
            preco_unitario: unit
          }
        ]
      );
      if (btn) { btn.disabled = false; btn.textContent = "🛒 Confirmar Pedido"; }

      if (!res.sucesso) {
        mostrarToast(`❌ Erro ao criar pedido: ${escaparHtml(res.mensagem)}`, "error");
        return;
      }

      e.target.reset();
      preencherFormularioDados(perfil);
      mostrarToast("🎉 Pedido registrado com sucesso! Acompanhe o status ao lado.", "success");
      await carregarMeusPedidos();
    });

    // Salvar Meus Dados (public.profiles)
    document.getElementById("form-conta-profile")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-profile-save");
      if (btn) { btn.disabled = true; btn.textContent = "⏳ Salvando..."; }

      const res = await window.SJ_SUPABASE.profiles.atualizarMeuPerfil({
        nome: document.getElementById("profile-nome")?.value.trim(),
        telefone: document.getElementById("profile-telefone")?.value.trim(),
        endereco: document.getElementById("profile-endereco")?.value.trim(),
        cidade_uf: document.getElementById("profile-cidade")?.value.trim()
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
      mostrarToast("✅ Seus dados foram atualizados com sucesso!", "success");
    });

    // Botões de atualizar
    document.getElementById("btn-refresh-quotes")?.addEventListener("click", carregarMeusOrcamentos);
    document.getElementById("btn-refresh-saved")?.addEventListener("click", carregarMeusSalvos);
    document.getElementById("btn-refresh-orders")?.addEventListener("click", carregarMeusPedidos);
  }

  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    verificarSessaoCliente();
  });
})();

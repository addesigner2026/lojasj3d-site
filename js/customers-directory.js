/**
 * DIRETÓRIO DE CLIENTES CADASTRADOS + REGRA CENTRAL DE COMPLETUDE — LOJA SJ 3D
 * ============================================================================
 * Implementa:
 *   1. Regra única centralizada de "Cadastro Completo" (PF / PJ)
 *   2. Sub-aba "Cadastrados" com paginação no banco, ordenação, filtros,
 *      provedores Supabase Auth (Google / E-mail e senha), e-mail confirmado,
 *      contadores e exportação CSV (admin-only com auditoria LGPD)
 *   3. Painel lateral de detalhes: máscara de CPF/CNPJ + "Mostrar" (com log),
 *      checklist campo a campo, botão "Pedir para completar" via WhatsApp,
 *      histórico de orçamentos, edição (admin/staff) e bloqueio (só admin)
 *   4. Atualização em tempo real via Supabase Realtime em public.profiles
 */
(function (root) {
  "use strict";

  const PAGE_SIZE = 25;

  function bridge() {
    return root.SJ_ADMIN_BRIDGE || {};
  }

  function esc(str) {
    if (typeof bridge().escaparHtml === "function") return bridge().escaparHtml(str);
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtBRL(val) {
    if (typeof bridge().formatarMoedaBR === "function") return bridge().formatarMoedaBR(val);
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function toast(msg, type = "success") {
    if (typeof bridge().mostrarToast === "function") bridge().mostrarToast(msg, type);
  }

  function onlyDigits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function normText(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function fmtCpf(v) {
    const d = onlyDigits(v).slice(0, 11);
    return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (v || "");
  }

  function fmtCnpj(v) {
    const d = onlyDigits(v).slice(0, 14);
    return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : (v || "");
  }

  function fmtCep(v) {
    const d = onlyDigits(v).slice(0, 8);
    return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (v || "");
  }

  function maskDoc(docRaw) {
    const d = onlyDigits(docRaw);
    if (!d) return "";
    if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
    if (d.length === 14) return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`;
    return "***";
  }

  // =========================================================================
  // REGRA ÚNICA E CENTRALIZADA DE "CADASTRO COMPLETO" (PF / PJ)
  // Complemento é sempre opcional.
  // =========================================================================
  const CUSTOMER_RULES = {
    evaluateCompleteness: function (c, options = {}) {
      const data = c || {};
      const personType = data.personType === "pj" || data.person_type === "pj" ? "pj" : "pf";
      const valCpf = bridge().validarCpfOficial || ((v) => onlyDigits(v).length === 11);
      const valCnpj = bridge().validarCnpjOficial || ((v) => onlyDigits(v).length === 14);

      const cpfDig = onlyDigits(data.cpf);
      const cnpjDig = onlyDigits(data.cnpj);
      const telDig = onlyDigits(data.telefone);
      const cepDig = onlyDigits(data.cep);
      const uf = String(data.uf || "").trim().toUpperCase();
      const ieTipo = data.ieTipo || data.ie_tipo || "contribuinte";
      const ieVal = String(data.inscricaoEstadual ?? data.inscricao_estadual ?? "").trim();

      const checks = [];
      if (personType === "pj") {
        checks.push({ key: "cnpj", label: "CNPJ", inputId: "iq-cli-cnpj", ok: valCnpj(cnpjDig), value: cnpjDig ? fmtCnpj(cnpjDig) : "" });
        checks.push({ key: "razaoSocial", label: "Razão social", inputId: "iq-cli-razao", ok: Boolean(String(data.razaoSocial ?? data.razao_social ?? "").trim()), value: data.razaoSocial ?? data.razao_social ?? "" });
        const ieOk = ieTipo === "isento" || ieTipo === "nao_contribuinte" || Boolean(ieVal);
        checks.push({ key: "inscricaoEstadual", label: "Inscrição estadual", inputId: "iq-cli-ie", ok: ieOk, value: ieTipo === "contribuinte" ? ieVal : ieTipo });
        checks.push({ key: "contatoNome", label: "Pessoa de contato", inputId: "iq-cli-contato", ok: Boolean(String(data.contatoNome ?? data.contato_nome ?? "").trim()), value: data.contatoNome ?? data.contato_nome ?? "" });
      } else {
        checks.push({ key: "nome", label: "Nome completo", inputId: "iq-cli-nome", ok: Boolean(String(data.nome || "").trim()), value: data.nome || "" });
        checks.push({ key: "cpf", label: "CPF", inputId: "iq-cli-cpf", ok: valCpf(cpfDig), value: cpfDig ? fmtCpf(cpfDig) : "" });
      }

      checks.push({ key: "telefone", label: "Telefone / WhatsApp", inputId: "iq-cli-telefone", ok: telDig.length >= 8, value: data.telefone || "" });
      checks.push({ key: "email", label: "E-mail", inputId: "iq-cli-email", ok: Boolean(String(data.email || "").trim()), value: data.email || "" });
      checks.push({ key: "cep", label: "CEP", inputId: "iq-cli-cep", ok: cepDig.length === 8, value: cepDig ? fmtCep(cepDig) : "" });
      checks.push({ key: "logradouro", label: "Rua / Logradouro", inputId: "iq-cli-logradouro", ok: Boolean(String(data.logradouro || "").trim()), value: data.logradouro || "" });
      checks.push({ key: "numero", label: "Número", inputId: "iq-cli-numero", ok: Boolean(String(data.numero || "").trim()), value: data.numero || "" });
      checks.push({ key: "bairro", label: "Bairro", inputId: "iq-cli-bairro", ok: Boolean(String(data.bairro || "").trim()), value: data.bairro || "" });
      checks.push({ key: "cidade", label: "Cidade", inputId: "iq-cli-cidade", ok: Boolean(String(data.cidade || "").trim()), value: data.cidade || "" });
      checks.push({ key: "uf", label: "UF", inputId: "iq-cli-uf", ok: uf.length === 2, value: uf });

      // Para emissão SEM nota fiscal (opcional quando options.forInvoice === false)
      const activeChecks = options.forNoInvoiceOnly
        ? checks.filter((item) => ["nome", "cpf", "cnpj", "razaoSocial", "telefone"].includes(item.key))
        : checks;

      const missing = activeChecks.filter((item) => !item.ok);
      return {
        isComplete: missing.length === 0,
        missingFields: missing.map((m) => m.label),
        missingInputIds: missing.map((m) => m.inputId),
        missingCount: missing.length,
        totalCount: activeChecks.length,
        completedCount: activeChecks.length - missing.length,
        checklist: checks
      };
    },
    normText,
    maskDoc
  };
  root.SJ_CUSTOMER_RULES = CUSTOMER_RULES;

  const custState = {
    initialized: false,
    subtab: "cadastrados",
    query: "",
    filter: "todos",
    sort: "created_desc",
    page: 0,
    totalFiltered: 0,
    items: [],
    kpis: {},
    searchTimer: null,
    activeDetailId: null,
    loading: false,
    errorMsg: ""
  };

  function isAdminUser() {
    return String(bridge().getUsuarioAtual?.()?.role || "").toLowerCase() === "admin";
  }

  function renderProviderBadges(providers = []) {
    const arr = Array.isArray(providers) && providers.length > 0 ? providers : ["email"];
    return arr.map((p) => {
      const clean = String(p || "").toLowerCase();
      if (clean === "google") {
        return `<span class="cust-badge is-google" title="Cadastro / Login com Google">Google</span>`;
      }
      if (clean === "email") {
        return `<span class="cust-badge is-email" title="Cadastro com E-mail e senha">E-mail e senha</span>`;
      }
      return `<span class="cust-badge is-email">${esc(clean)}</span>`;
    }).join(" ");
  }

  function formatShortDateTime(isoStr, includeTime = false) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    return includeTime ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : d.toLocaleDateString("pt-BR");
  }

  function renderTableSkeleton() {
    const tbody = document.getElementById("cust-dir-tbody");
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: 5 }).map(() => `
      <tr><td colspan="8" style="padding:12px 14px;"><div class="cms-skeleton-row"></div></td></tr>
    `).join("");
  }

  async function loadRegisteredCustomers() {
    if (!root.SJ_SUPABASE?.customers?.listarCadastrados) return;
    custState.loading = true;
    custState.errorMsg = "";
    renderTableSkeleton();

    const res = await root.SJ_SUPABASE.customers.listarCadastrados({
      query: custState.query,
      filter: custState.filter,
      sort: custState.sort,
      limit: PAGE_SIZE,
      offset: custState.page * PAGE_SIZE
    });

    custState.loading = false;
    if (!res.sucesso) {
      custState.errorMsg = res.mensagem || "Erro ao carregar clientes cadastrados.";
      renderDirectoryError();
      return;
    }

    custState.kpis = res.kpis || {};
    custState.totalFiltered = Number(res.totalFiltered) || 0;
    custState.items = Array.isArray(res.items) ? res.items : [];

    updateKpisAndBadges();
    renderDirectoryRows();
    renderPagination();
  }

  function updateKpisAndBadges() {
    const k = custState.kpis || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v ?? 0); };
    set("cust-kpi-total", k.total || 0);
    set("cust-kpi-complete", k.completos || 0);
    set("cust-kpi-incomplete", k.incompletos || 0);
    set("cust-kpi-google", k.google || 0);
    set("cust-kpi-email", k.email || 0);
    set("cust-tab-count-reg", k.total || 0);

    const leadsCount = (root.SJ_DB?.clientes?.listar?.() || []).length;
    set("cust-tab-count-leads", leadsCount);

    const sidebarBadge = document.getElementById("cms-clients-count-badge");
    if (sidebarBadge) sidebarBadge.textContent = String((Number(k.total) || 0) || leadsCount);
  }

  function renderDirectoryError() {
    const tbody = document.getElementById("cust-dir-tbody");
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:28px; text-align:center;">
          <div style="max-width:460px; margin:0 auto; background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:16px; color:#92400e;">
            <strong style="display:block; margin-bottom:6px;">Não foi possível carregar os clientes cadastrados</strong>
            <p style="font-size:0.84rem; margin:0 0 12px;">${esc(custState.errorMsg)}</p>
            <button type="button" id="btn-cust-dir-retry" class="btn-cms-secondary">Tentar de novo</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById("btn-cust-dir-retry")?.addEventListener("click", loadRegisteredCustomers);
  }

  function renderDirectoryRows() {
    const tbody = document.getElementById("cust-dir-tbody");
    if (!tbody) return;

    if (!custState.items || custState.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding:36px 16px; text-align:center; color:#64748b; font-size:0.88rem;">
            Nenhum cliente encontrado para este filtro ou busca.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = custState.items.map((c) => {
      const displayName = c.person_type === "pj" ? (c.razao_social || c.nome_fantasia || c.nome) : c.nome;
      const comp = c.completeness || {};
      const isComplete = Boolean(comp.is_complete);
      const missingArr = Array.isArray(comp.missing_fields) ? comp.missing_fields : [];
      const missingCount = Number(comp.missing_count) || missingArr.length;
      const totalReq = Number(comp.total_required) || 10;
      const doneReq = Math.max(0, totalReq - missingCount);
      const pct = Math.round((doneReq / Math.max(1, totalReq)) * 100);
      const tooltipMissing = missingArr.length > 0 ? `Faltam: ${missingArr.join(", ")}` : "Cadastro completo";

      const telDig = onlyDigits(c.telefone);
      const waHref = telDig ? `https://wa.me/${telDig.startsWith("55") ? telDig : "55" + telDig}` : "";
      const totalQuotes = (Number(c.site_quotes_count) || 0) + (Number(c.issued_quotes_count) || 0);

      return `
        <tr data-cust-row-id="${esc(c.id)}">
          <td data-label="Cliente">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong style="color:#0f172a; font-size:0.88rem;">${esc(displayName || "Sem nome")}</strong>
              <span class="cms-status-pill is-neutral" style="font-size:0.68rem;">${c.person_type === "pj" ? "PJ" : "PF"}</span>
              ${c.status === "blocked" ? `<span class="cust-badge is-blocked">Bloqueado</span>` : ""}
            </div>
            <div style="font-size:0.74rem; color:#64748b; margin-top:2px;">
              ${c.doc_masked ? esc(c.doc_masked) : "Sem CPF/CNPJ"}${c.cidade ? ` • ${esc(c.cidade)}${c.uf ? "/" + esc(c.uf) : ""}` : ""}
            </div>
          </td>
          <td data-label="Contato">
            <div>${waHref ? `<a href="${esc(waHref)}" target="_blank" rel="noopener" data-stop-row="true" style="color:#15803d; font-weight:700; text-decoration:none;">${esc(c.telefone)}</a>` : `<span style="color:#94a3b8;">Sem telefone</span>`}</div>
            <div style="font-size:0.75rem; color:#475569; overflow-wrap:anywhere;">${esc(c.email || "")}</div>
          </td>
          <td data-label="Forma de cadastro">
            <div style="display:flex; gap:4px; flex-wrap:wrap;">${renderProviderBadges(c.providers)}</div>
          </td>
          <td data-label="E-mail confirmado">
            <span class="cms-status-pill ${c.email_confirmed ? "is-green" : "is-amber"}">${c.email_confirmed ? "Sim" : "Não"}</span>
          </td>
          <td data-label="Situação do cadastro">
            <span class="cust-badge ${isComplete ? "is-complete" : "is-incomplete"}" title="${esc(tooltipMissing)}">
              ${isComplete ? "Completo" : `Incompleto (${missingCount} faltando)`}
            </span>
            <div class="cust-progress-track" title="${pct}% preenchido">
              <div class="cust-progress-fill ${isComplete ? "" : "is-warn"}" style="width:${pct}%;"></div>
            </div>
          </td>
          <td data-label="Datas" style="font-size:0.75rem; color:#475569; white-space:nowrap;">
            <div>Cad: <strong>${esc(formatShortDateTime(c.created_at))}</strong></div>
            <div>Acesso: ${esc(formatShortDateTime(c.last_sign_in_at, true))}</div>
          </td>
          <td data-label="Orçamentos" style="font-variant-numeric:tabular-nums;">
            <strong>${totalQuotes}</strong>
            ${c.open_quotes_count > 0 ? `<div style="font-size:0.7rem; color:#c2410c; font-weight:700;">${c.open_quotes_count} aberto(s)</div>` : ""}
          </td>
          <td data-label="Ação" style="text-align:right; white-space:nowrap;">
            <button type="button" class="iq-history-act-btn is-primary" data-cust-emit-quote="${esc(c.id)}" data-stop-row="true">
              Emitir orçamento
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-stop-row='true']").forEach((el) => {
      el.addEventListener("click", (e) => e.stopPropagation());
    });

    tbody.querySelectorAll("[data-cust-emit-quote]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        emitirOrcamentoComClienteBanco(btn.dataset.custEmitQuote);
      });
    });

    tbody.querySelectorAll("tr[data-cust-row-id]").forEach((tr) => {
      tr.addEventListener("click", () => {
        openCustomerDetailDrawer(tr.dataset.custRowId);
      });
    });
  }

  function renderPagination() {
    const el = document.getElementById("cust-dir-pagination");
    if (!el) return;
    const total = custState.totalFiltered;
    const start = total === 0 ? 0 : custState.page * PAGE_SIZE + 1;
    const end = Math.min(total, (custState.page + 1) * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    el.innerHTML = `
      <span>Mostrando <strong>${start}–${end}</strong> de <strong>${total}</strong> clientes (página ${custState.page + 1} de ${totalPages})</span>
      <div style="display:flex; gap:8px;">
        <button type="button" id="btn-cust-prev-page" class="btn-cms-secondary" ${custState.page <= 0 ? "disabled" : ""}>Anterior</button>
        <button type="button" id="btn-cust-next-page" class="btn-cms-secondary" ${(custState.page + 1) >= totalPages ? "disabled" : ""}>Próxima</button>
      </div>
    `;
    document.getElementById("btn-cust-prev-page")?.addEventListener("click", () => {
      if (custState.page > 0) { custState.page--; loadRegisteredCustomers(); }
    });
    document.getElementById("btn-cust-next-page")?.addEventListener("click", () => {
      if ((custState.page + 1) < totalPages) { custState.page++; loadRegisteredCustomers(); }
    });
  }

  // =========================================================================
  // PAINEL LATERAL DE DETALHES DO CLIENTE
  // =========================================================================
  async function openCustomerDetailDrawer(customerId, openEditInitially = false) {
    const dlg = document.getElementById("cms-customer-detail-drawer");
    const titleEl = document.getElementById("cust-drawer-title");
    const subEl = document.getElementById("cust-drawer-sub");
    const bodyEl = document.getElementById("cust-drawer-body");
    if (!dlg || !bodyEl || !customerId) return;

    custState.activeDetailId = customerId;
    if (titleEl) titleEl.textContent = "Carregando cliente...";
    if (subEl) subEl.textContent = "";
    bodyEl.innerHTML = `<div class="cms-skeleton-row"></div><div class="cms-skeleton-row"></div>`;
    if (typeof dlg.showModal === "function" && !dlg.open) dlg.showModal();

    const res = await root.SJ_SUPABASE?.customers?.obterDetalhe?.(customerId);
    if (!res?.sucesso || !res.dados?.profile) {
      bodyEl.innerHTML = `<div style="padding:18px; background:#fef2f2; border-radius:12px; color:#991b1b;">Não foi possível carregar os dados deste cliente.</div>`;
      return;
    }

    const p = res.dados.profile;
    const siteQuotes = Array.isArray(res.dados.site_quotes) ? res.dados.site_quotes : [];
    const issuedQuotes = Array.isArray(res.dados.issued_quotes) ? res.dados.issued_quotes : [];
    const displayName = p.person_type === "pj" ? (p.razao_social || p.nome_fantasia || p.nome) : p.nome;

    const evalObj = CUSTOMER_RULES.evaluateCompleteness({
      personType: p.person_type,
      nome: p.nome,
      razaoSocial: p.razao_social,
      inscricaoEstadual: p.inscricao_estadual,
      ieTipo: p.ie_tipo,
      contatoNome: p.contato_nome,
      cpf: p.has_doc && p.person_type !== "pj" ? "11111111111" : "", // masked check uses server completeness below!
      cnpj: p.has_doc && p.person_type === "pj" ? "11111111111111" : "",
      telefone: p.telefone,
      email: p.email,
      cep: p.cep,
      logradouro: p.logradouro,
      numero: p.numero,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf
    });

    // Usa a avaliação oficial retornada pelo servidor para nunca errar validação de CPF/CNPJ oculto
    const srvComp = p.completeness || {};
    const srvMissing = Array.isArray(srvComp.missing_fields) ? srvComp.missing_fields : [];
    const isComplete = Boolean(srvComp.is_complete);

    if (titleEl) titleEl.textContent = displayName || "Cliente sem nome";
    if (subEl) subEl.textContent = `${p.person_type === "pj" ? "Pessoa Jurídica" : "Pessoa Física"} • ${p.email || ""}`;

    const telDig = onlyDigits(p.telefone);
    const waBase = telDig ? `https://wa.me/${telDig.startsWith("55") ? telDig : "55" + telDig}` : "";
    const msgCompletar = `Olá, ${displayName || "cliente"}! Para emitir seu orçamento/nota fiscal, precisamos completar seu cadastro: ${srvMissing.join(", ")}. Você pode atualizar em lojasj3d.com.br/conta.`;
    const waCompletar = waBase ? `${waBase}?text=${encodeURIComponent(msgCompletar)}` : "";

    const checklistHtml = evalObj.checklist.map((item) => {
      const ok = !srvMissing.includes(item.label);
      return `<div class="cust-check-item ${ok ? "is-ok" : "is-miss"}"><span>${ok ? "✓" : "✗"}</span><span>${esc(item.label)}</span></div>`;
    }).join("");

    const adminOnly = isAdminUser();
    const isBlocked = p.status === "blocked";

    bodyEl.innerHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
        ${renderProviderBadges(p.providers)}
        <span class="cms-status-pill ${p.email_confirmed ? "is-green" : "is-amber"}">${p.email_confirmed ? "E-mail confirmado" : "E-mail não confirmado"}</span>
        <span class="cust-badge ${isComplete ? "is-complete" : "is-incomplete"}">${isComplete ? "Cadastro Completo" : `${srvMissing.length} campo(s) faltando`}</span>
        ${isBlocked ? `<span class="cust-badge is-blocked">Acesso bloqueado</span>` : ""}
      </div>

      <!-- Ações principais do painel -->
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        <button type="button" id="btn-cust-drawer-emit" class="btn-cms-save">Emitir orçamento</button>
        ${waBase ? `<a href="${esc(waBase)}" target="_blank" rel="noopener" class="btn-cms-secondary" style="text-decoration:none; color:#15803d; border-color:#bbf7d0; background:#f0fdf4;">Falar no WhatsApp</a>` : ""}
        <button type="button" id="btn-cust-drawer-toggle-edit" class="btn-cms-secondary">Editar dados</button>
        ${adminOnly ? `<button type="button" id="btn-cust-drawer-block" class="btn-cms-danger">${isBlocked ? "Desbloquear acesso" : "Bloquear acesso"}</button>` : ""}
      </div>

      <!-- Checklist do Cadastro -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
          <strong style="font-size:0.86rem; color:#0f172a;">Situação do cadastro (${esc(srvComp.completed_required ?? 0)}/${esc(srvComp.total_required ?? 10)})</strong>
          ${(!isComplete && waCompletar) ? `<a href="${esc(waCompletar)}" target="_blank" rel="noopener" class="btn-cms-secondary" style="text-decoration:none; font-size:0.76rem; color:#92400e; background:#fffbeb; border-color:#fcd34d;">Pedir para completar (WhatsApp)</a>` : ""}
        </div>
        <div class="cust-checklist-grid">${checklistHtml}</div>
      </div>

      <!-- Dados Cadastrais (leitura + Mostrar CPF/CNPJ auditado) -->
      <div id="cust-drawer-readonly-box" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:14px; font-size:0.83rem; color:#334155;">
        <div style="display:grid; gap:6px;">
          <div><strong>Tipo:</strong> ${p.person_type === "pj" ? "Pessoa Jurídica (PJ)" : "Pessoa Física (PF)"}</div>
          <div><strong>${p.person_type === "pj" ? "Razão Social" : "Nome"}:</strong> ${esc(displayName || "—")}</div>
          ${p.person_type === "pj" && p.nome_fantasia ? `<div><strong>Nome Fantasia:</strong> ${esc(p.nome_fantasia)}</div>` : ""}
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong>${p.person_type === "pj" ? "CNPJ" : "CPF"}:</strong>
            <span id="cust-drawer-doc-val">${esc(p.doc_masked || "Não informado")}</span>
            ${p.has_doc ? `<button type="button" id="btn-cust-reveal-doc" class="btn-cms-secondary" style="padding:3px 9px; font-size:0.74rem; min-height:28px;">Mostrar</button>` : ""}
          </div>
          ${p.person_type === "pj" ? `<div><strong>Inscrição Estadual:</strong> ${esc(p.ie_tipo === "contribuinte" ? (p.inscricao_estadual || "Não informada") : p.ie_tipo)}</div>` : ""}
          ${p.person_type === "pj" && p.contato_nome ? `<div><strong>Pessoa de contato:</strong> ${esc(p.contato_nome)}</div>` : ""}
          <div><strong>Telefone:</strong> ${esc(p.telefone || "—")}</div>
          <div><strong>E-mail:</strong> ${esc(p.email || "—")}</div>
          <div><strong>Endereço:</strong> ${esc([p.logradouro, p.numero, p.complemento, p.bairro].filter(Boolean).join(", ") || "—")}</div>
          <div><strong>Cidade / UF / CEP:</strong> ${esc([p.cidade, p.uf].filter(Boolean).join(" / ") || "—")}${p.cep ? ` • CEP ${esc(fmtCep(p.cep))}` : ""}</div>
          <div style="font-size:0.76rem; color:#64748b; margin-top:4px;">Cadastrado em ${esc(formatShortDateTime(p.created_at, true))} • Último acesso: ${esc(formatShortDateTime(p.last_sign_in_at, true))}</div>
        </div>
      </div>

      <!-- Formulário de Edição Inline (Admin e Staff) -->
      <form id="cust-drawer-edit-form" style="display:${openEditInitially ? "grid" : "none"}; gap:10px; background:#fffaf7; border:1px solid #fed7aa; border-radius:12px; padding:14px; margin-bottom:14px;">
        <strong style="font-size:0.88rem; color:#c2410c;">Editar cadastro do cliente</strong>
        <div class="iq-form-grid">
          <div class="iq-field">
            <label for="cd-edit-type">Tipo</label>
            <select id="cd-edit-type">
              <option value="pf" ${p.person_type !== "pj" ? "selected" : ""}>Pessoa Física</option>
              <option value="pj" ${p.person_type === "pj" ? "selected" : ""}>Pessoa Jurídica</option>
            </select>
          </div>
          <div class="iq-field">
            <label for="cd-edit-nome">Nome completo</label>
            <input type="text" id="cd-edit-nome" value="${esc(p.nome || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-razao">Razão Social (PJ)</label>
            <input type="text" id="cd-edit-razao" value="${esc(p.razao_social || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-fantasia">Nome Fantasia</label>
            <input type="text" id="cd-edit-fantasia" value="${esc(p.nome_fantasia || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-doc">CPF ou CNPJ (digite só se quiser alterar)</label>
            <input type="text" id="cd-edit-doc" inputmode="numeric" placeholder="Deixe vazio para manter atual" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-ie-tipo">Tipo IE (PJ)</label>
            <select id="cd-edit-ie-tipo">
              <option value="contribuinte" ${p.ie_tipo === "contribuinte" ? "selected" : ""}>Contribuinte</option>
              <option value="isento" ${p.ie_tipo === "isento" ? "selected" : ""}>Isento</option>
              <option value="nao_contribuinte" ${p.ie_tipo === "nao_contribuinte" ? "selected" : ""}>Não contribuinte</option>
            </select>
          </div>
          <div class="iq-field">
            <label for="cd-edit-ie">Inscrição Estadual</label>
            <input type="text" id="cd-edit-ie" value="${esc(p.inscricao_estadual || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-contato">Pessoa de contato (PJ)</label>
            <input type="text" id="cd-edit-contato" value="${esc(p.contato_nome || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-tel">Telefone / WhatsApp</label>
            <input type="tel" id="cd-edit-tel" value="${esc(p.telefone || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-cep">CEP</label>
            <input type="text" id="cd-edit-cep" value="${esc(p.cep ? fmtCep(p.cep) : "")}" maxlength="9" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-logradouro">Rua / Logradouro</label>
            <input type="text" id="cd-edit-logradouro" value="${esc(p.logradouro || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-numero">Número</label>
            <input type="text" id="cd-edit-numero" value="${esc(p.numero || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-complemento">Complemento</label>
            <input type="text" id="cd-edit-complemento" value="${esc(p.complemento || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-bairro">Bairro</label>
            <input type="text" id="cd-edit-bairro" value="${esc(p.bairro || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-cidade">Cidade</label>
            <input type="text" id="cd-edit-cidade" value="${esc(p.cidade || "")}" />
          </div>
          <div class="iq-field">
            <label for="cd-edit-uf">UF</label>
            <input type="text" id="cd-edit-uf" value="${esc(p.uf || "")}" maxlength="2" />
          </div>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button type="button" id="btn-cd-edit-cancel" class="btn-cms-cancel">Cancelar</button>
          <button type="submit" class="btn-cms-save">Salvar alterações</button>
        </div>
      </form>

      <!-- Histórico do Cliente -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <strong style="display:block; font-size:0.86rem; color:#0f172a; margin-bottom:8px;">Histórico de Orçamentos &amp; Pedidos</strong>
        ${siteQuotes.length === 0 && issuedQuotes.length === 0
          ? `<div style="font-size:0.82rem; color:#64748b;">Nenhum orçamento registrado para este cliente ainda.</div>`
          : `
            <div style="display:grid; gap:6px;">
              ${issuedQuotes.map((iq) => `
                <div style="display:flex; justify-content:space-between; gap:8px; padding:7px 9px; border-radius:8px; background:#fff7ed; font-size:0.8rem;">
                  <span><strong>Timbrado ${esc(iq.quote_code)}</strong> • ${esc(iq.status)}</span>
                  <strong>${fmtBRL(iq.total_amount)}</strong>
                </div>
              `).join("")}
              ${siteQuotes.map((sq) => `
                <div style="display:flex; justify-content:space-between; gap:8px; padding:7px 9px; border-radius:8px; background:#f8fafc; font-size:0.8rem;">
                  <span><strong>Site #${esc(sq.quote_number)}</strong> • ${esc(sq.status)} (${sq.items_count} itens)</span>
                  <strong>${sq.admin_total != null ? fmtBRL(sq.admin_total) : "Aguardando"}</strong>
                </div>
              `).join("")}
            </div>
          `}
      </div>
    `;

    // Bind Eventos do Drawer
    document.getElementById("btn-cust-drawer-emit")?.addEventListener("click", () => {
      dlg.close?.();
      emitirOrcamentoComClienteBanco(p.id);
    });

    document.getElementById("btn-cust-reveal-doc")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const docEl = document.getElementById("cust-drawer-doc-val");
      if (!docEl) return;
      if (btn.dataset.shown === "1") {
        docEl.textContent = p.doc_masked || "—";
        btn.textContent = "Mostrar";
        btn.dataset.shown = "0";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Registrando...";
      const rv = await root.SJ_SUPABASE?.customers?.revelarDocumento?.(p.id);
      btn.disabled = false;
      if (rv?.sucesso && rv.dados) {
        const val = rv.dados.person_type === "pj" ? fmtCnpj(rv.dados.cnpj) : fmtCpf(rv.dados.cpf);
        docEl.textContent = val || "Não informado";
        btn.textContent = "Ocultar";
        btn.dataset.shown = "1";
        toast("Visualização registrada no log de auditoria LGPD.", "info");
      } else {
        btn.textContent = "Mostrar";
        toast(rv?.mensagem || "Não foi possível revelar o documento.", "warning");
      }
    });

    const editForm = document.getElementById("cust-drawer-edit-form");
    document.getElementById("btn-cust-drawer-toggle-edit")?.addEventListener("click", () => {
      if (editForm) editForm.style.display = editForm.style.display === "none" ? "grid" : "none";
    });
    document.getElementById("btn-cd-edit-cancel")?.addEventListener("click", () => {
      if (editForm) editForm.style.display = "none";
    });

    editForm?.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const docTyped = onlyDigits(document.getElementById("cd-edit-doc")?.value);
      const editType = document.getElementById("cd-edit-type")?.value === "pj" ? "pj" : "pf";
      const payload = {
        person_type: editType,
        nome: document.getElementById("cd-edit-nome")?.value.trim() || "",
        razao_social: document.getElementById("cd-edit-razao")?.value.trim() || "",
        nome_fantasia: document.getElementById("cd-edit-fantasia")?.value.trim() || "",
        ie_tipo: document.getElementById("cd-edit-ie-tipo")?.value || "contribuinte",
        inscricao_estadual: document.getElementById("cd-edit-ie")?.value.trim() || "",
        contato_nome: document.getElementById("cd-edit-contato")?.value.trim() || "",
        telefone: document.getElementById("cd-edit-tel")?.value.trim() || "",
        cep: onlyDigits(document.getElementById("cd-edit-cep")?.value),
        logradouro: document.getElementById("cd-edit-logradouro")?.value.trim() || "",
        numero: document.getElementById("cd-edit-numero")?.value.trim() || "",
        complemento: document.getElementById("cd-edit-complemento")?.value.trim() || "",
        bairro: document.getElementById("cd-edit-bairro")?.value.trim() || "",
        cidade: document.getElementById("cd-edit-cidade")?.value.trim() || "",
        uf: (document.getElementById("cd-edit-uf")?.value || "").trim().toUpperCase().slice(0, 2),
        source: "customer_drawer"
      };
      if (docTyped) {
        if (editType === "pj") payload.cnpj = docTyped;
        else payload.cpf = docTyped;
      }

      const up = await root.SJ_SUPABASE?.customers?.atualizarCadastro?.(p.id, payload);
      if (up?.sucesso) {
        toast("Cadastro do cliente atualizado!", "success");
        await loadRegisteredCustomers();
        await openCustomerDetailDrawer(p.id, false);
      } else {
        toast(up?.mensagem || "Erro ao atualizar cadastro.", "warning");
      }
    });

    document.getElementById("btn-cust-drawer-block")?.addEventListener("click", async () => {
      if (!isAdminUser()) return;
      const bloquear = !isBlocked;
      if (!root.confirm(bloquear ? `Bloquear o acesso deste cliente (${p.email})?` : `Reativar o acesso deste cliente (${p.email})?`)) return;
      const bk = await root.SJ_SUPABASE?.customers?.definirBloqueio?.(p.id, bloquear);
      if (bk?.sucesso) {
        toast(bloquear ? "Acesso do cliente bloqueado." : "Acesso do cliente reativado!", "success");
        await loadRegisteredCustomers();
        await openCustomerDetailDrawer(p.id, false);
      } else {
        toast(bk?.mensagem || "Erro ao alterar bloqueio.", "warning");
      }
    });
  }

  async function emitirOrcamentoComClienteBanco(customerId) {
    if (!customerId) return;
    let picked = null;
    if (root.SJ_SUPABASE?.customers?.buscarParaOrcamento) {
      // Busca pela lista detalhada ou via RPC para trazer todos os campos estruturados
      const detail = await root.SJ_SUPABASE.customers.obterDetalhe(customerId);
      const prof = detail?.dados?.profile;
      if (prof) {
        const res = await root.SJ_SUPABASE.customers.buscarParaOrcamento(prof.email || prof.nome || "", 15);
        picked = (res?.dados || []).find((x) => String(x.id) === String(customerId)) || prof;
      }
    }
    bridge().selecionarAbaCms?.("emitir-orcamento", { subtab: "novo" });
    if (picked && root.SJ_ISSUED_QUOTES?.selecionarClienteDoBanco) {
      root.SJ_ISSUED_QUOTES.selecionarClienteDoBanco(picked);
    }
  }

  async function exportRegisteredCsv() {
    if (!isAdminUser()) {
      toast("Apenas o Administrador pode exportar a lista de clientes.", "warning");
      return;
    }
    if (!root.confirm("Aviso LGPD: este arquivo CSV contém dados pessoais e documentos de clientes. A exportação será gravada no log de auditoria. Deseja continuar?")) {
      return;
    }
    const res = await root.SJ_SUPABASE?.customers?.exportarCsv?.();
    if (!res?.sucesso) {
      toast(res?.mensagem || "Não foi possível exportar clientes.", "warning");
      return;
    }
    const rows = res.dados || [];
    if (rows.length === 0) {
      toast("Nenhum cliente cadastrado para exportar.", "info");
      return;
    }
    const headers = ["Tipo", "Nome/Razao Social", "Nome Fantasia", "CPF/CNPJ", "IE", "Telefone", "E-mail", "CEP", "Logradouro", "Numero", "Complemento", "Bairro", "Cidade", "UF", "Provedores", "Email Confirmado", "Status", "Cadastro", "Ultimo Acesso"];
    const csvSafe = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [
      headers.join(";"),
      ...rows.map((r) => [
        r.person_type === "pj" ? "PJ" : "PF",
        r.nome,
        r.nome_fantasia,
        r.documento,
        r.inscricao_estadual,
        r.telefone,
        r.email,
        r.cep,
        r.logradouro,
        r.numero,
        r.complemento,
        r.bairro,
        r.cidade,
        r.uf,
        r.providers,
        r.email_confirmed ? "Sim" : "Nao",
        r.status,
        r.created_at,
        r.last_sign_in_at
      ].map(csvSafe).join(";"))
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-cadastrados-lojasj3d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV exportado e registrado na auditoria LGPD!", "success");
  }

  function switchSubtab(sub) {
    const tab = sub === "leads" ? "leads" : "cadastrados";
    custState.subtab = tab;
    const bReg = document.getElementById("cust-tab-cadastrados");
    const bLeads = document.getElementById("cust-tab-leads");
    const pReg = document.getElementById("cust-panel-cadastrados");
    const pLeads = document.getElementById("cust-panel-leads");

    if (bReg && bLeads) {
      bReg.setAttribute("aria-selected", tab === "cadastrados" ? "true" : "false");
      bLeads.setAttribute("aria-selected", tab === "leads" ? "true" : "false");
      bReg.toggleAttribute("focusgroupstart", tab === "cadastrados");
      bLeads.toggleAttribute("focusgroupstart", tab === "leads");
    }
    if (pReg) {
      if (tab === "cadastrados") pReg.removeAttribute("hidden");
      else pReg.hidden = "until-found";
    }
    if (pLeads) {
      if (tab === "leads") pLeads.removeAttribute("hidden");
      else pLeads.hidden = "until-found";
    }
    if (tab === "cadastrados") loadRegisteredCustomers();
  }

  function bindOnce() {
    if (custState.initialized) return;
    custState.initialized = true;

    const tabs = [document.getElementById("cust-tab-cadastrados"), document.getElementById("cust-tab-leads")].filter(Boolean);
    tabs.forEach((t, idx) => {
      t.addEventListener("click", () => switchSubtab(t.dataset.custSubtab));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = tabs[(idx + 1) % tabs.length];
          next?.focus();
          switchSubtab(next?.dataset.custSubtab);
        }
      });
    });

    const searchInp = document.getElementById("cust-dir-search");
    searchInp?.addEventListener("input", () => {
      clearTimeout(custState.searchTimer);
      custState.searchTimer = setTimeout(() => {
        custState.query = searchInp.value || "";
        custState.page = 0;
        loadRegisteredCustomers();
      }, 250);
    });

    document.getElementById("cust-dir-sort")?.addEventListener("change", (e) => {
      custState.sort = e.target.value || "created_desc";
      custState.page = 0;
      loadRegisteredCustomers();
    });

    document.querySelectorAll("[data-cust-filter]").forEach((chip) => {
      chip.addEventListener("click", () => {
        custState.filter = chip.dataset.custFilter || "todos";
        custState.page = 0;
        document.querySelectorAll("[data-cust-filter]").forEach((c) => c.classList.toggle("is-active", c === chip));
        loadRegisteredCustomers();
      });
    });

    document.getElementById("btn-cust-dir-refresh")?.addEventListener("click", loadRegisteredCustomers);
    document.getElementById("btn-cust-dir-export")?.addEventListener("click", exportRegisteredCsv);
    document.getElementById("btn-cust-drawer-close")?.addEventListener("click", () => {
      document.getElementById("cms-customer-detail-drawer")?.close?.();
    });
  }

  root.SJ_CUSTOMERS = {
    abrir: function (options = {}) {
      bindOnce();
      switchSubtab(options.subtab === "leads" ? "leads" : "cadastrados");
    },
    abrirDetalhesCliente: function (customerId, openEdit = false) {
      bindOnce();
      bridge().selecionarAbaCms?.("clientes");
      switchSubtab("cadastrados");
      setTimeout(() => openCustomerDetailDrawer(customerId, openEdit), 80);
    },
    onProfilesRealtime: function () {
      if (!custState.initialized) return;
      loadRegisteredCustomers();
      const dlg = document.getElementById("cms-customer-detail-drawer");
      if (dlg?.open && custState.activeDetailId) {
        openCustomerDetailDrawer(custState.activeDetailId, false);
      }
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

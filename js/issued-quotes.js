/**
 * PÁGINA INDEPENDENTE: EMITIR ORÇAMENTO & HISTÓRICO UNIFICADO — LOJA SJ 3D
 * =========================================================================
 * Mantém 100% intacto o modelo oficial da folha timbrada (.quote-official-letterhead).
 * Trabalha com:
 *   - Supabase ERP (public.issued_quotes + issued_quote_items + auditoria + numeração 2026-0001)
 *   - Importação de solicitações dos clientes (public.quotes -> /conta)
 *   - Rascunho automático local (com aviso de alterações não salvas)
 *   - Compatibilidade total no Histórico com orçamentos antigos (SJ_DB.orcamentos / SJ-2026-...)
 */
(function (root) {
  "use strict";

  const LOCAL_DRAFT_KEY = "sj_issued_quote_draft_v1";
  const LOCAL_DEFAULTS_KEY = "sj_issued_quote_defaults_v1";
  const LOCAL_SEQ_KEY = "sj_issued_quote_local_seq_v1";

  const DEFAULT_TEXTS = {
    validadeDiasPadrao: 7,
    garantiaTexto: "Garantia oficial do Grupo SJ em produtos novos lacrados.",
    pixFavorecido: "SJ NOVAIS E CIA LTDA",
    pixChave: "66.275.129/0001-10",
    observacoesPadrao: "Produtos novos lacrados com garantia oficial Grupo SJ. Av. Portugal, 6759 - Umuarama/PR. Chave PIX CNPJ: 66.275.129/0001-10"
  };

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
    if (typeof bridge().mostrarToast === "function") {
      bridge().mostrarToast(msg, type);
    }
  }

  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateBR(isoOrStr) {
    if (!isoOrStr) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrStr)) return isoOrStr;
    const m = String(isoOrStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const dt = new Date(isoOrStr);
    if (isNaN(dt.getTime())) return String(isoOrStr);
    return dt.toLocaleDateString("pt-BR");
  }

  function parseDateISOFromBR(brStr) {
    const m = String(brStr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(String(brStr || ""))) return String(brStr).slice(0, 10);
    return todayISO();
  }

  function addDaysBR(isoDate, days) {
    const base = new Date(`${isoDate || todayISO()}T12:00:00`);
    if (isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + (parseInt(days, 10) || 7));
    return base.toLocaleDateString("pt-BR");
  }

  function onlyDigits(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function formatCpf(v) {
    const d = onlyDigits(v).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
  }

  function formatCnpj(v) {
    const d = onlyDigits(v).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }

  function formatCep(v) {
    const d = onlyDigits(v).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  const iqState = {
    initialized: false,
    subtab: "novo",
    dirty: false,
    saving: false,
    defaults: { ...DEFAULT_TEXTS },
    historyIssued: [],
    catalogSelectedIds: new Set(),
    dragIndex: null,
    autosaveTimer: null,
    customerSearchTimer: null,
    doc: null
  };

  function createEmptyDoc(defaultsObj) {
    const defs = defaultsObj || iqState.defaults || DEFAULT_TEXTS;
    const valDays = Math.max(1, parseInt(defs.validadeDiasPadrao, 10) || 7);
    return {
      id: null,
      quoteCode: "",
      status: "rascunho",
      isLocked: false,
      versionNumber: 1,
      parentQuoteId: null,
      sourceCustomerQuoteId: null,
      sourceCustomerQuoteNumber: null,
      issueDate: todayISO(),
      validityDays: valDays,
      needsInvoice: false,
      customerType: "pf",
      customerProfileId: null,
      customer: {
        nome: "",
        cpf: "",
        cnpj: "",
        razaoSocial: "",
        nomeFantasia: "",
        ieTipo: "contribuinte",
        inscricaoEstadual: "",
        contatoNome: "",
        telefone: "",
        email: "",
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "Umuarama",
        uf: "PR"
      },
      items: [],
      paymentMethod: "PIX à Vista (5% OFF)",
      paymentInstallments: 3,
      deliveryTerm: "Pronta Entrega / Imediato",
      freightAmount: 0,
      generalDiscountType: "fixed",
      generalDiscountValue: 0,
      notes: defs.observacoesPadrao || DEFAULT_TEXTS.observacoesPadrao,
      internalNotes: "",
      garantiaTexto: defs.garantiaTexto || DEFAULT_TEXTS.garantiaTexto,
      legacySource: null
    };
  }

  function createBlankItem(overrides = {}) {
    return {
      localKey: "row-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      productId: overrides.productId || null,
      productCode: overrides.productCode || "",
      title: overrides.title || "",
      description: overrides.description || "",
      quantity: Math.max(0.01, Number(overrides.quantity) || 1),
      unitPrice: Math.max(0, Number(overrides.unitPrice) || 0),
      discountType: overrides.discountType === "percent" ? "percent" : "fixed",
      discountValue: Math.max(0, Number(overrides.discountValue) || 0),
      isCustom: Boolean(overrides.isCustom)
    };
  }

  function computeLineTotals(item) {
    const qty = Math.max(0.01, Number(item.quantity) || 0);
    const unit = Math.max(0, Number(item.unitPrice) || 0);
    const gross = roundMoney(qty * unit);
    const dVal = Math.max(0, Number(item.discountValue) || 0);
    let disc = 0;
    if (item.discountType === "percent") {
      const pct = Math.min(100, dVal);
      disc = roundMoney(gross * (pct / 100));
    } else {
      disc = Math.min(gross, roundMoney(dVal));
    }
    const lineTotal = Math.max(0, roundMoney(gross - disc));
    return { gross, discountAmount: disc, lineTotal };
  }

  function computeDocTotals(doc = iqState.doc) {
    const items = Array.isArray(doc?.items) ? doc.items : [];
    let itemsGross = 0;
    let itemsLineDiscount = 0;
    let itemsSubtotal = 0;
    let totalUnits = 0;

    items.forEach((it) => {
      const t = computeLineTotals(it);
      itemsGross = roundMoney(itemsGross + t.gross);
      itemsLineDiscount = roundMoney(itemsLineDiscount + t.discountAmount);
      itemsSubtotal = roundMoney(itemsSubtotal + t.lineTotal);
      totalUnits += Number(it.quantity) || 0;
    });

    const gVal = Math.max(0, Number(doc?.generalDiscountValue) || 0);
    let genDisc = 0;
    if (doc?.generalDiscountType === "percent") {
      genDisc = roundMoney(itemsSubtotal * (Math.min(100, gVal) / 100));
    } else {
      genDisc = Math.min(itemsSubtotal, roundMoney(gVal));
    }
    const freight = Math.max(0, roundMoney(doc?.freightAmount || 0));
    const total = Math.max(0, roundMoney(itemsSubtotal + freight - genDisc));

    return {
      itemsCount: items.length,
      totalUnits,
      itemsGross,
      itemsLineDiscount,
      itemsSubtotal,
      generalDiscountAmount: genDisc,
      freight,
      total
    };
  }

  function markDirty(textPill = null) {
    iqState.dirty = true;
    updateSaveStatusPill("dirty", textPill || "Alterações não salvas");
    scheduleLocalDraftSave();
  }

  function updateSaveStatusPill(mode, text) {
    const pill = document.getElementById("iq-save-status-pill");
    if (!pill) return;
    pill.classList.remove("is-dirty", "is-saved", "is-locked");
    if (mode === "dirty") pill.classList.add("is-dirty");
    if (mode === "saved") pill.classList.add("is-saved");
    if (mode === "locked") pill.classList.add("is-locked");
    pill.textContent = text;
  }

  function scheduleLocalDraftSave() {
    clearTimeout(iqState.autosaveTimer);
    iqState.autosaveTimer = setTimeout(() => {
      if (!iqState.doc || iqState.doc.isLocked) return;
      try {
        root.localStorage?.setItem(LOCAL_DRAFT_KEY, JSON.stringify({
          savedAt: new Date().toISOString(),
          doc: iqState.doc
        }));
      } catch (_) { }
    }, 550);
  }

  function clearLocalDraftCache() {
    try {
      root.localStorage?.removeItem(LOCAL_DRAFT_KEY);
    } catch (_) { }
  }

  function allocateLocalQuoteCode(yearInput) {
    const yr = parseInt(yearInput, 10) || new Date().getFullYear();
    let maxSeq = 0;
    const legacy = root.SJ_DB?.orcamentos?.listar?.() || [];
    legacy.forEach((o) => {
      const m = String(o.id || "").match(new RegExp(`^(?:SJ-)?${yr}-(\\d{1,5})`));
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n < 9000) maxSeq = Math.max(maxSeq, n);
      }
    });
    (iqState.historyIssued || []).forEach((q) => {
      if (Number(q.quote_year) === yr && Number(q.quote_seq) > maxSeq) {
        maxSeq = Number(q.quote_seq);
      }
    });
    try {
      const stored = JSON.parse(root.localStorage?.getItem(LOCAL_SEQ_KEY) || "{}");
      if (stored[yr] && Number(stored[yr]) > maxSeq) maxSeq = Number(stored[yr]);
      const next = maxSeq + 1;
      stored[yr] = next;
      root.localStorage?.setItem(LOCAL_SEQ_KEY, JSON.stringify(stored));
      return `${yr}-${String(next).padStart(4, "0")}`;
    } catch (_) {
      return `${yr}-${String(maxSeq + 1).padStart(4, "0")}`;
    }
  }

  // =========================================================================
  // CARREGAMENTO DE PADRÕES REUTILIZÁVEIS
  // =========================================================================
  async function loadReusableDefaults() {
    try {
      const localRaw = root.localStorage?.getItem(LOCAL_DEFAULTS_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && typeof parsed === "object") {
          iqState.defaults = { ...DEFAULT_TEXTS, ...parsed };
        }
      }
    } catch (_) { }

    if (root.SJ_SUPABASE?.issuedQuotes?.obterPadroes) {
      const res = await root.SJ_SUPABASE.issuedQuotes.obterPadroes();
      if (res?.sucesso && res.valor) {
        iqState.defaults = { ...DEFAULT_TEXTS, ...res.valor };
        try {
          root.localStorage?.setItem(LOCAL_DEFAULTS_KEY, JSON.stringify(iqState.defaults));
        } catch (_) { }
      }
    }
  }

  // =========================================================================
  // SINCRONIZAÇÃO DE FORMULÁRIO <-> ESTADO
  // =========================================================================
  function syncDomFromDoc() {
    const d = iqState.doc;
    if (!d) return;

    const pillNum = document.getElementById("iq-quote-number-pill");
    if (pillNum) {
      pillNum.textContent = d.quoteCode
        ? `${d.quoteCode}${d.versionNumber > 1 && !String(d.quoteCode).includes("-v") ? ` (v${d.versionNumber})` : ""}`
        : `${(d.issueDate || todayISO()).slice(0, 4)}-XXXX (automático)`;
    }

    const issueInp = document.getElementById("iq-issue-date");
    const valInp = document.getElementById("iq-validity-days");
    if (issueInp) issueInp.value = d.issueDate || todayISO();
    if (valInp) valInp.value = String(d.validityDays || 7);

    updateValidityPreviewLine();

    const lockedBanner = document.getElementById("iq-locked-alert-banner");
    if (lockedBanner) lockedBanner.style.display = d.isLocked ? "flex" : "none";

    if (d.isLocked) {
      updateSaveStatusPill("locked", `Emitido (${d.status}) — somente leitura`);
    } else if (!iqState.dirty) {
      updateSaveStatusPill(d.id ? "saved" : "", d.id ? "Rascunho salvo" : "Rascunho pronto");
    }

    // PF / PJ & Nota Fiscal toggles
    document.querySelectorAll("[data-iq-person-type]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.iqPersonType === d.customerType);
    });
    document.querySelectorAll("[data-iq-invoice]").forEach((b) => {
      b.classList.toggle("is-active", (b.dataset.iqInvoice === "true") === Boolean(d.needsInvoice));
    });

    const pfBox = document.getElementById("iq-pf-fields");
    const pjBox = document.getElementById("iq-pj-fields");
    if (pfBox) pfBox.style.display = d.customerType === "pf" ? "grid" : "none";
    if (pjBox) pjBox.style.display = d.customerType === "pj" ? "grid" : "none";

    const hintEl = document.getElementById("iq-invoice-rule-hint");
    if (hintEl) {
      hintEl.innerHTML = d.needsInvoice
        ? `Regra atual: <strong>COM nota fiscal</strong> — exige dados completos (${d.customerType === "pj" ? "CNPJ + Razão Social" : "CPF + Nome"}, telefone e endereço completo).`
        : `Regra atual: <strong>SEM nota fiscal</strong> — exige nome, telefone e CPF/CNPJ.`;
    }
    document.querySelectorAll("[data-iq-nf-req='true']").forEach((el) => {
      el.style.display = d.needsInvoice ? "inline" : "none";
    });

    const sumNf = document.getElementById("iq-sum-nf-badge");
    if (sumNf) {
      sumNf.textContent = d.needsInvoice ? "Com NF" : "Sem NF";
      sumNf.className = `cms-status-pill ${d.needsInvoice ? "is-green" : "is-neutral"}`;
    }

    const impBanner = document.getElementById("iq-imported-request-banner");
    const impText = document.getElementById("iq-imported-request-text");
    if (impBanner && impText) {
      if (d.sourceCustomerQuoteId) {
        impBanner.style.display = "flex";
        impText.innerHTML = `Vinculado à solicitação do cliente <strong>#${esc(d.sourceCustomerQuoteNumber || "")}</strong> — ao emitir, será marcado como Respondido no painel do cliente.`;
      } else {
        impBanner.style.display = "none";
      }
    }

    const c = d.customer || {};
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v == null ? "" : v;
    };
    setVal("iq-cli-nome", c.nome);
    setVal("iq-cli-cpf", c.cpf ? formatCpf(c.cpf) : "");
    setVal("iq-cli-cnpj", c.cnpj ? formatCnpj(c.cnpj) : "");
    setVal("iq-cli-razao", c.razaoSocial);
    setVal("iq-cli-fantasia", c.nomeFantasia);
    setVal("iq-cli-ie-tipo", c.ieTipo || "contribuinte");
    setVal("iq-cli-ie", c.inscricaoEstadual);
    setVal("iq-cli-contato", c.contatoNome);
    setVal("iq-cli-telefone", c.telefone);
    setVal("iq-cli-email", c.email);
    setVal("iq-cli-cep", c.cep ? formatCep(c.cep) : "");
    setVal("iq-cli-logradouro", c.logradouro);
    setVal("iq-cli-numero", c.numero);
    setVal("iq-cli-complemento", c.complemento);
    setVal("iq-cli-bairro", c.bairro);
    setVal("iq-cli-cidade", c.cidade || "Umuarama");
    setVal("iq-cli-uf", c.uf || "PR");

    const ieWrap = document.getElementById("iq-cli-ie-wrap");
    if (ieWrap) ieWrap.style.display = (c.ieTipo || "contribuinte") === "contribuinte" ? "flex" : "none";

    // Condições
    setVal("iq-payment-method", d.paymentMethod || "PIX à Vista (5% OFF)");
    const instWrap = document.getElementById("iq-payment-installments-wrap");
    if (instWrap) {
      instWrap.style.display = String(d.paymentMethod || "").includes("Crédito") ? "flex" : "none";
    }
    setVal("iq-payment-installments", String(d.paymentInstallments || 3));
    setVal("iq-delivery-term", d.deliveryTerm || "Pronta Entrega / Imediato");
    setVal("iq-freight-amount", Number(d.freightAmount || 0).toFixed(2));
    setVal("iq-general-discount-type", d.generalDiscountType === "percent" ? "percent" : "fixed");
    setVal("iq-general-discount-value", Number(d.generalDiscountValue || 0));
    setVal("iq-notes", d.notes || "");
    setVal("iq-internal-notes", d.internalNotes || "");

    applyLockedStateToControls();
    renderItemsTable();
    updateFinancialSummaryUI();
    updateClientCompletenessHighlight();
  }

  function updateClientCompletenessHighlight() {
    const d = iqState.doc;
    if (!d) return;

    document.querySelectorAll("#iq-panel-novo .iq-field-missing").forEach((el) => {
      el.classList.remove("iq-field-missing");
    });

    const warnBanner = document.getElementById("iq-client-warning-banner");
    const warnText = document.getElementById("iq-client-warning-text");
    const completeLink = document.getElementById("btn-iq-complete-profile-link");
    const openReqBanner = document.getElementById("iq-client-open-req-banner");
    const openReqText = document.getElementById("iq-client-open-req-text");
    const syncBtn = document.getElementById("btn-iq-sync-back-customer");

    if (syncBtn) {
      syncBtn.style.display = (d.customerProfileId && !d.isLocked) ? "inline-flex" : "none";
    }

    if (openReqBanner && openReqText) {
      const openQ = Number(d.selectedCustomerOpenQuotes) || 0;
      if (d.customerProfileId && openQ > 0 && !d.sourceCustomerQuoteId) {
        openReqBanner.style.display = "flex";
        openReqText.innerHTML = `Este cliente possui <strong>${openQ} ${openQ === 1 ? "solicitação em aberto" : "solicitações em aberto"}</strong> no site.`;
      } else {
        openReqBanner.style.display = "none";
      }
    }

    const rules = root.SJ_CUSTOMER_RULES;
    const c = d.customer || {};
    const hasAnyClient = Boolean(c.nome || c.razaoSocial || c.email || c.telefone || c.cpf || c.cnpj || d.customerProfileId);
    if (!rules || !hasAnyClient) {
      if (warnBanner) warnBanner.style.display = "none";
      return;
    }

    const fullEval = rules.evaluateCompleteness({
      personType: d.customerType,
      ...c
    });
    const activeEval = d.needsInvoice
      ? fullEval
      : rules.evaluateCompleteness({ personType: d.customerType, ...c }, { forNoInvoiceOnly: true });

    const missingToHighlight = d.needsInvoice ? fullEval.missingInputIds : activeEval.missingInputIds;
    missingToHighlight.forEach((inputId) => {
      const inp = document.getElementById(inputId);
      if (inp) inp.classList.add("iq-field-missing");
    });

    if (warnBanner && warnText) {
      if (fullEval.missingFields.length > 0) {
        warnBanner.style.display = "flex";
        warnText.innerHTML = d.needsInvoice
          ? `<strong>Para emitir COM nota fiscal, faltam:</strong> ${esc(fullEval.missingFields.join(", "))}.`
          : `<strong>Faltam no cadastro:</strong> ${esc(fullEval.missingFields.join(", "))}.`;
        if (completeLink) {
          completeLink.style.display = d.customerProfileId ? "inline-flex" : "none";
        }
      } else {
        warnBanner.style.display = "none";
      }
    }
  }

  function applyLockedStateToControls() {
    const locked = Boolean(iqState.doc?.isLocked);
    const pane = document.getElementById("iq-panel-novo");
    if (!pane) return;
    pane.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.id === "iq-internal-notes") return;
      el.disabled = locked;
    });
    ["btn-iq-add-catalog", "btn-iq-add-custom", "btn-iq-clear-items", "btn-iq-save-draft", "btn-iq-emit-pdf", "btn-iq-mobile-emit", "btn-iq-quick-5pct", "btn-iq-client-avulso", "btn-iq-import-request"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = locked;
    });
  }

  function updateValidityPreviewLine() {
    const d = iqState.doc;
    const el = document.getElementById("iq-validity-preview-line");
    if (!d || !el) return;
    const until = addDaysBR(d.issueDate || todayISO(), d.validityDays || 7);
    el.innerHTML = `Emissão em <strong>${esc(formatDateBR(d.issueDate || todayISO()))}</strong> • Validade: <strong>${esc(d.validityDays || 7)} dias</strong> (válido até <strong>${esc(until)}</strong>)`;
  }

  function readFormFieldsIntoDoc() {
    const d = iqState.doc;
    if (!d) return;
    const getVal = (id) => (document.getElementById(id)?.value ?? "").trim();

    d.issueDate = getVal("iq-issue-date") || todayISO();
    d.validityDays = Math.max(1, Math.min(365, parseInt(getVal("iq-validity-days"), 10) || 7));

    const c = d.customer;
    c.nome = getVal("iq-cli-nome");
    c.cpf = onlyDigits(getVal("iq-cli-cpf"));
    c.cnpj = onlyDigits(getVal("iq-cli-cnpj"));
    c.razaoSocial = getVal("iq-cli-razao");
    c.nomeFantasia = getVal("iq-cli-fantasia");
    c.ieTipo = getVal("iq-cli-ie-tipo") || "contribuinte";
    c.inscricaoEstadual = c.ieTipo === "contribuinte" ? getVal("iq-cli-ie") : "";
    c.contatoNome = getVal("iq-cli-contato");
    c.telefone = getVal("iq-cli-telefone");
    c.email = getVal("iq-cli-email").toLowerCase();
    c.cep = onlyDigits(getVal("iq-cli-cep"));
    c.logradouro = getVal("iq-cli-logradouro");
    c.numero = getVal("iq-cli-numero");
    c.complemento = getVal("iq-cli-complemento");
    c.bairro = getVal("iq-cli-bairro");
    c.cidade = getVal("iq-cli-cidade");
    c.uf = getVal("iq-cli-uf").toUpperCase().slice(0, 2);

    d.paymentMethod = getVal("iq-payment-method") || "PIX à Vista (5% OFF)";
    d.paymentInstallments = Math.max(1, parseInt(getVal("iq-payment-installments"), 10) || 1);
    d.deliveryTerm = getVal("iq-delivery-term") || "Pronta Entrega / Imediato";
    d.freightAmount = Math.max(0, Number(getVal("iq-freight-amount")) || 0);
    d.generalDiscountType = getVal("iq-general-discount-type") === "percent" ? "percent" : "fixed";
    d.generalDiscountValue = Math.max(0, Number(getVal("iq-general-discount-value")) || 0);
    d.notes = document.getElementById("iq-notes")?.value ?? "";
    d.internalNotes = document.getElementById("iq-internal-notes")?.value ?? "";
  }

  function updateFinancialSummaryUI() {
    const d = iqState.doc;
    if (!d) return;
    const t = computeDocTotals(d);
    const c = d.customer || {};
    const displayName = d.customerType === "pj" ? (c.razaoSocial || c.nomeFantasia || c.nome) : c.nome;
    const docTxt = d.customerType === "pj"
      ? (c.cnpj ? formatCnpj(c.cnpj) : "CNPJ não informado")
      : (c.cpf ? formatCpf(c.cpf) : "CPF não informado");

    const chipEl = document.getElementById("iq-sum-client-chip");
    if (chipEl) {
      chipEl.innerHTML = displayName
        ? `<strong>${esc(displayName)}</strong><span>${d.customerType.toUpperCase()} • ${esc(docTxt)}${c.telefone ? ` • ${esc(c.telefone)}` : ""}</span>`
        : `<strong>Nenhum cliente selecionado</strong><span style="color:#64748b;">Preencha os dados no bloco 1</span>`;
    }

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setTxt("iq-sum-items-count", `${t.itemsCount} ${t.itemsCount === 1 ? "item" : "itens"} (${t.totalUnits} un.)`);
    setTxt("iq-sum-gross", fmtBRL(t.itemsGross));

    const lineRow = document.getElementById("iq-sum-line-disc-row");
    if (lineRow) lineRow.style.display = t.itemsLineDiscount > 0 ? "flex" : "none";
    setTxt("iq-sum-line-disc", `- ${fmtBRL(t.itemsLineDiscount)}`);

    const genRow = document.getElementById("iq-sum-gen-disc-row");
    if (genRow) genRow.style.display = t.generalDiscountAmount > 0 ? "flex" : "none";
    setTxt("iq-sum-gen-disc", `- ${fmtBRL(t.generalDiscountAmount)}`);

    const frRow = document.getElementById("iq-sum-freight-row");
    if (frRow) frRow.style.display = t.freight > 0 ? "flex" : "none";
    setTxt("iq-sum-freight", `+ ${fmtBRL(t.freight)}`);

    setTxt("iq-sum-total", fmtBRL(t.total));
    setTxt("iq-mobile-tot-val", fmtBRL(t.total));
  }

  // =========================================================================
  // TABELA DE PRODUTOS E SERVIÇOS (ITENS)
  // =========================================================================
  function renderItemsTable() {
    const tbody = document.getElementById("iq-items-tbody");
    if (!tbody || !iqState.doc) return;
    const locked = Boolean(iqState.doc.isLocked);
    const items = iqState.doc.items || [];

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:26px 14px; color:#64748b; font-size:0.86rem;">
            Nenhum produto ou serviço adicionado ainda. Clique em <strong>+ Adicionar do catálogo</strong> ou <strong>+ Adicionar item avulso</strong> acima.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map((it, idx) => {
      const calc = computeLineTotals(it);
      return `
        <tr data-item-idx="${idx}" draggable="${locked ? "false" : "true"}">
          <td data-label="Ordem" style="text-align:center;">
            <div class="iq-item-order-col">
              <span class="iq-drag-handle" title="Arrastar para reordenar" aria-hidden="true">⋮⋮</span>
              <span style="font-size:0.74rem; font-weight:700; color:#64748b;">#${idx + 1}</span>
              ${!locked ? `
                <div class="iq-order-btns">
                  <button type="button" class="iq-mini-icon-btn" data-iq-move-up="${idx}" ${idx === 0 ? "disabled" : ""} aria-label="Mover item ${idx + 1} para cima">▲</button>
                  <button type="button" class="iq-mini-icon-btn" data-iq-move-down="${idx}" ${idx === items.length - 1 ? "disabled" : ""} aria-label="Mover item ${idx + 1} para baixo">▼</button>
                </div>
              ` : ""}
            </div>
          </td>
          <td data-label="Produto / Serviço e Descrição">
            <input type="text" class="iq-item-title-input" data-iq-item-field="title" data-idx="${idx}" value="${esc(it.title)}" placeholder="Nome do produto, serviço ou mão de obra..." ${locked ? "disabled" : ""} />
            <input type="text" class="iq-item-desc-input" data-iq-item-field="description" data-idx="${idx}" value="${esc(it.description || "")}" placeholder="Descrição opcional (cor, observação técnica, medidas...)" ${locked ? "disabled" : ""} />
            ${it.productCode ? `<div style="font-size:0.72rem; color:#64748b; margin-top:4px;">Código: <strong>${esc(it.productCode)}</strong></div>` : ""}
          </td>
          <td data-label="Quantidade">
            <input type="number" class="iq-num-input" data-iq-item-field="quantity" data-idx="${idx}" min="0.01" step="1" value="${esc(it.quantity)}" ${locked ? "disabled" : ""} />
          </td>
          <td data-label="Valor unitário (R$)">
            <input type="number" class="iq-num-input" data-iq-item-field="unitPrice" data-idx="${idx}" min="0" step="0.01" value="${Number(it.unitPrice || 0).toFixed(2)}" ${locked ? "disabled" : ""} />
          </td>
          <td data-label="Desconto na linha">
            <div class="iq-line-disc-wrap">
              <select class="iq-line-disc-type" data-iq-item-field="discountType" data-idx="${idx}" aria-label="Tipo desconto linha ${idx + 1}" ${locked ? "disabled" : ""}>
                <option value="fixed" ${it.discountType !== "percent" ? "selected" : ""}>R$</option>
                <option value="percent" ${it.discountType === "percent" ? "selected" : ""}>%</option>
              </select>
              <input type="number" class="iq-num-input" data-iq-item-field="discountValue" data-idx="${idx}" min="0" step="0.01" value="${Number(it.discountValue || 0)}" ${locked ? "disabled" : ""} />
            </div>
          </td>
          <td data-label="Total da linha" style="text-align:right; white-space:nowrap;">
            <strong id="iq-row-total-${idx}" style="font-size:0.9rem; color:#0f172a; font-variant-numeric:tabular-nums;">${fmtBRL(calc.lineTotal)}</strong>
            ${calc.discountAmount > 0 ? `<div style="font-size:0.71rem; color:#15803d;">-${fmtBRL(calc.discountAmount)}</div>` : ""}
          </td>
          <td data-label="Remover" style="text-align:center;">
            ${!locked ? `<button type="button" class="iq-mini-icon-btn is-danger" data-iq-remove-item="${idx}" title="Remover item" aria-label="Remover item ${idx + 1}">✕</button>` : "—"}
          </td>
        </tr>
      `;
    }).join("");

    // Input listeners sem re-renderizar toda a tabela enquanto digita
    tbody.querySelectorAll("[data-iq-item-field]").forEach((el) => {
      const handler = () => {
        const idx = parseInt(el.dataset.idx, 10);
        const field = el.dataset.iqItemField;
        const item = iqState.doc.items[idx];
        if (!item) return;
        if (field === "quantity") item.quantity = Math.max(0.01, Number(el.value) || 0.01);
        else if (field === "unitPrice") item.unitPrice = Math.max(0, Number(el.value) || 0);
        else if (field === "discountValue") item.discountValue = Math.max(0, Number(el.value) || 0);
        else if (field === "discountType") item.discountType = el.value === "percent" ? "percent" : "fixed";
        else item[field] = el.value;

        const rowTot = computeLineTotals(item);
        const totEl = document.getElementById(`iq-row-total-${idx}`);
        if (totEl) totEl.textContent = fmtBRL(rowTot.lineTotal);
        updateFinancialSummaryUI();
        markDirty();
      };
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", handler);
    });

    tbody.querySelectorAll("[data-iq-move-up]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.iqMoveUp, 10);
        if (idx > 0) {
          const arr = iqState.doc.items;
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          renderItemsTable();
          updateFinancialSummaryUI();
          markDirty();
        }
      });
    });

    tbody.querySelectorAll("[data-iq-move-down]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.iqMoveDown, 10);
        const arr = iqState.doc.items;
        if (idx >= 0 && idx < arr.length - 1) {
          [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
          renderItemsTable();
          updateFinancialSummaryUI();
          markDirty();
        }
      });
    });

    tbody.querySelectorAll("[data-iq-remove-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.iqRemoveItem, 10);
        iqState.doc.items.splice(idx, 1);
        renderItemsTable();
        updateFinancialSummaryUI();
        markDirty();
      });
    });

    // Drag-and-drop reorder
    if (!locked) {
      tbody.querySelectorAll("tr[data-item-idx]").forEach((tr) => {
        tr.addEventListener("dragstart", () => {
          iqState.dragIndex = parseInt(tr.dataset.itemIdx, 10);
          tr.classList.add("is-dragging");
        });
        tr.addEventListener("dragend", () => {
          tr.classList.remove("is-dragging");
          iqState.dragIndex = null;
        });
        tr.addEventListener("dragover", (e) => {
          e.preventDefault();
        });
        tr.addEventListener("drop", (e) => {
          e.preventDefault();
          const targetIdx = parseInt(tr.dataset.itemIdx, 10);
          const fromIdx = iqState.dragIndex;
          if (fromIdx === null || isNaN(targetIdx) || fromIdx === targetIdx) return;
          const arr = iqState.doc.items;
          const [moved] = arr.splice(fromIdx, 1);
          arr.splice(targetIdx, 0, moved);
          iqState.dragIndex = null;
          renderItemsTable();
          updateFinancialSummaryUI();
          markDirty();
        });
      });
    }
  }

  // =========================================================================
  // FOLHA TIMBRADA OFICIAL (.quote-official-letterhead INALTERADA)
  // =========================================================================
  function buildTimbradoParamsFromDoc(doc = iqState.doc) {
    readFormFieldsIntoDoc();
    const totals = computeDocTotals(doc);
    const c = doc.customer || {};
    const nomeCliente = doc.customerType === "pj"
      ? (c.razaoSocial || c.nomeFantasia || c.nome || "Cliente Balcão")
      : (c.nome || "Cliente Balcão");
    const docStr = doc.customerType === "pj"
      ? (c.cnpj ? formatCnpj(c.cnpj) : (c.cpf ? formatCpf(c.cpf) : ""))
      : (c.cpf ? formatCpf(c.cpf) : (c.cnpj ? formatCnpj(c.cnpj) : ""));
    const enderecoStr = [
      [c.logradouro, c.numero].filter(Boolean).join(", "),
      c.complemento || "",
      c.bairro || ""
    ].filter(Boolean).join(" — ");
    const cidadeUfStr = [c.cidade, c.uf].filter(Boolean).join(" / ") || "Umuarama / PR";
    const cepFmt = c.cep ? formatCep(c.cep) : "";
    const telCepStr = [c.telefone, cepFmt ? `CEP ${cepFmt}` : ""].filter(Boolean).join(" • ");

    let paymentStr = doc.paymentMethod || "PIX à Vista (5% OFF)";
    if (String(paymentStr).includes("Crédito") && !String(paymentStr).includes("x")) {
      paymentStr = `${paymentStr} em ${doc.paymentInstallments > 1 ? `até ${doc.paymentInstallments}x` : "1x"}`;
    }

    const numeroExibicao = doc.quoteCode || allocatePreviewCodeLabel(doc);
    const validadeStr = `${doc.validityDays || 7} ${(doc.validityDays || 7) === 1 ? "dia" : "dias"}`;

    const meta = {
      numero: numeroExibicao,
      data: formatDateBR(doc.issueDate || todayISO()),
      validade: validadeStr,
      frete: totals.freight,
      desconto: totals.generalDiscountAmount,
      formaPagamento: paymentStr,
      prazoEntrega: doc.deliveryTerm || "Pronta Entrega / Imediato",
      observacoes: doc.notes || iqState.defaults.observacoesPadrao,
      garantiaTexto: doc.garantiaTexto || iqState.defaults.garantiaTexto,
      cliente: {
        nome: nomeCliente,
        cnpjCpf: docStr || "Não informado",
        endereco: enderecoStr || "Umuarama e Região",
        bairroCidadeUf: cidadeUfStr,
        cepTelefone: telCepStr || "Não informado",
        email: c.email || "Não informado"
      }
    };

    const itens = (doc.items || []).map((it) => {
      const calc = computeLineTotals(it);
      return {
        descricao: it.title || "Item",
        codigo: it.productCode || "",
        observacaoLinha: it.description || "",
        descontoLinhaValor: calc.discountAmount,
        qtd: Number(it.quantity) || 1,
        precoUnitario: Number(it.unitPrice) || 0
      };
    });

    const user = bridge().getUsuarioAtual?.();
    const vendedorNome = user?.nome || "Equipe Loja SJ 3D";
    return { meta, itens, vendedorNome, totals };
  }

  function allocatePreviewCodeLabel(doc) {
    const yr = (doc?.issueDate || todayISO()).slice(0, 4);
    return `${yr}-0001`;
  }

  function renderTimbradoPreviewModal() {
    const dlg = document.getElementById("iq-preview-dialog");
    const mount = document.getElementById("iq-timbrado-preview-mount");
    if (!dlg || !mount || typeof bridge().montarHtmlFolhaTimbradaOficial !== "function") return;
    const params = buildTimbradoParamsFromDoc(iqState.doc);
    mount.innerHTML = bridge().montarHtmlFolhaTimbradaOficial(params);
    if (typeof dlg.showModal === "function" && !dlg.open) {
      dlg.showModal();
    }
  }

  // =========================================================================
  // VALIDAÇÃO, RASCUNHO & EMISSÃO OFICIAL
  // =========================================================================
  function clearInvalidMarks() {
    document.querySelectorAll("#iq-panel-novo [aria-invalid='true']").forEach((el) => {
      el.removeAttribute("aria-invalid");
    });
  }

  function validateForEmit() {
    clearInvalidMarks();
    readFormFieldsIntoDoc();
    const d = iqState.doc;
    const c = d.customer;

    const fail = (inputId, msg) => {
      const el = inputId ? document.getElementById(inputId) : null;
      if (el) {
        el.setAttribute("aria-invalid", "true");
        el.focus();
      }
      toast(msg, "warning");
      return false;
    };

    if (!d.items || d.items.length === 0) {
      return fail("btn-iq-add-catalog", "Adicione pelo menos 1 produto ou serviço antes de emitir.");
    }
    const emptyTitleIdx = d.items.findIndex((it) => !String(it.title || "").trim());
    if (emptyTitleIdx >= 0) {
      return fail(null, `Informe o nome do item #${emptyTitleIdx + 1}.`);
    }

    if (d.customerType === "pf") {
      if (!c.nome) return fail("iq-cli-nome", "Informe o nome completo do cliente.");
      if (!c.cpf) return fail("iq-cli-cpf", "Informe o CPF do cliente.");
      if (!bridge().validarCpfOficial(c.cpf)) {
        return fail("iq-cli-cpf", "CPF inválido. Confira os 11 dígitos.");
      }
    } else {
      if (!c.cnpj) return fail("iq-cli-cnpj", "Informe o CNPJ da empresa.");
      if (!bridge().validarCnpjOficial(c.cnpj)) {
        return fail("iq-cli-cnpj", "CNPJ inválido. Confira os 14 dígitos.");
      }
      if (!c.razaoSocial && !c.nomeFantasia) {
        return fail("iq-cli-razao", "Informe a Razão Social da empresa.");
      }
    }

    if (onlyDigits(c.telefone).length < 8) {
      return fail("iq-cli-telefone", "Informe o telefone / WhatsApp do cliente.");
    }

    if (d.needsInvoice && root.SJ_CUSTOMER_RULES?.evaluateCompleteness) {
      const comp = root.SJ_CUSTOMER_RULES.evaluateCompleteness({
        personType: d.customerType,
        ...c
      });
      if (!comp.isComplete) {
        updateClientCompletenessHighlight();
        return fail(comp.missingInputIds[0] || "iq-cli-logradouro", `Para emitir COM nota fiscal, faltam: ${comp.missingFields.join(", ")}.`);
      }
    } else if (d.needsInvoice) {
      if (!c.logradouro) return fail("iq-cli-logradouro", "Orçamento COM nota fiscal exige logradouro / endereço.");
      if (!c.cidade || !c.uf) return fail("iq-cli-cidade", "Orçamento COM nota fiscal exige cidade e UF.");
    }

    return true;
  }

  function buildServerPayload(createVersion = false) {
    readFormFieldsIntoDoc();
    const d = iqState.doc;
    const c = d.customer;
    const user = bridge().getUsuarioAtual?.();
    const docNum = d.customerType === "pj" ? c.cnpj : c.cpf;
    const displayName = d.customerType === "pj" ? (c.razaoSocial || c.nomeFantasia || c.nome) : c.nome;
    let paymentStr = d.paymentMethod || "PIX à Vista (5% OFF)";
    if (String(paymentStr).includes("Crédito") && !String(paymentStr).includes("x")) {
      paymentStr = `${paymentStr} em ${d.paymentInstallments > 1 ? `até ${d.paymentInstallments}x` : "1x"}`;
    }

    return {
      id: d.id || null,
      create_version: Boolean(createVersion),
      source_customer_quote_id: d.sourceCustomerQuoteId || null,
      status: d.status || "rascunho",
      issue_date: d.issueDate || todayISO(),
      validity_days: d.validityDays || 7,
      validity_label: `${d.validityDays || 7} ${(d.validityDays || 7) === 1 ? "dia" : "dias"}`,
      needs_invoice: Boolean(d.needsInvoice),
      customer_type: d.customerType === "pj" ? "pj" : "pf",
      customer_profile_id: d.customerProfileId || null,
      seller_name: user?.nome || "Equipe Loja SJ 3D",
      payment_method: paymentStr,
      payment_installments: d.paymentInstallments || 1,
      delivery_term: d.deliveryTerm || "Pronta Entrega / Imediato",
      freight_amount: roundMoney(d.freightAmount),
      general_discount_type: d.generalDiscountType === "percent" ? "percent" : "fixed",
      general_discount_value: roundMoney(d.generalDiscountValue),
      notes: d.notes || "",
      internal_notes: d.internalNotes || "",
      customer_snapshot: {
        person_type: d.customerType === "pj" ? "pj" : "pf",
        display_name: displayName,
        nome: c.nome,
        razao_social: c.razaoSocial,
        nome_fantasia: c.nomeFantasia,
        ie_tipo: c.ieTipo,
        inscricao_estadual: c.inscricaoEstadual,
        contato_nome: c.contatoNome,
        cpf: c.cpf,
        cnpj: c.cnpj,
        documento: docNum,
        telefone: c.telefone,
        email: c.email,
        cep: c.cep,
        logradouro: c.logradouro,
        numero: c.numero,
        complemento: c.complemento,
        bairro: c.bairro,
        cidade: c.cidade,
        uf: c.uf
      },
      items: (d.items || []).map((it) => ({
        product_id: it.productId || null,
        product_code: it.productCode || "",
        title: String(it.title || "").trim(),
        description: String(it.description || "").trim(),
        quantity: Math.max(0.01, Number(it.quantity) || 1),
        unit_price: Math.max(0, roundMoney(it.unitPrice)),
        discount_type: it.discountType === "percent" ? "percent" : "fixed",
        discount_value: Math.max(0, roundMoney(it.discountValue)),
        is_custom: Boolean(it.isCustom)
      }))
    };
  }

  function applySavedResponseToDoc(resData) {
    const q = resData?.quote;
    const items = Array.isArray(resData?.items) ? resData.items : [];
    if (!q) return;
    const snap = q.customer_snapshot || {};
    iqState.doc = {
      id: q.id,
      quoteCode: q.quote_code,
      status: q.status,
      isLocked: Boolean(q.is_locked),
      versionNumber: Number(q.version_number) || 1,
      parentQuoteId: q.parent_quote_id || null,
      sourceCustomerQuoteId: q.source_customer_quote_id || null,
      sourceCustomerQuoteNumber: iqState.doc?.sourceCustomerQuoteNumber || null,
      issueDate: q.issue_date || todayISO(),
      validityDays: Number(q.validity_days) || 7,
      needsInvoice: Boolean(q.needs_invoice),
      customerType: q.customer_type === "pj" ? "pj" : "pf",
      customerProfileId: q.customer_profile_id || null,
      customer: {
        nome: snap.nome || "",
        cpf: snap.cpf || "",
        cnpj: snap.cnpj || "",
        razaoSocial: snap.razao_social || "",
        nomeFantasia: snap.nome_fantasia || "",
        ieTipo: snap.ie_tipo || "contribuinte",
        inscricaoEstadual: snap.inscricao_estadual || "",
        contatoNome: snap.contato_nome || "",
        telefone: snap.telefone || "",
        email: snap.email || "",
        cep: snap.cep || "",
        logradouro: snap.logradouro || "",
        numero: snap.numero || "",
        complemento: snap.complemento || "",
        bairro: snap.bairro || "",
        cidade: snap.cidade || "Umuarama",
        uf: snap.uf || "PR"
      },
      items: items.map((it) => createBlankItem({
        productId: it.product_id,
        productCode: it.product_code,
        title: it.title,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unit_price,
        discountType: it.discount_type,
        discountValue: it.discount_value,
        isCustom: it.is_custom
      })),
      paymentMethod: q.payment_method || "PIX à Vista (5% OFF)",
      paymentInstallments: Number(q.payment_installments) || 1,
      deliveryTerm: q.delivery_term || "Pronta Entrega / Imediato",
      freightAmount: Number(q.freight_amount) || 0,
      generalDiscountType: q.general_discount_type === "percent" ? "percent" : "fixed",
      generalDiscountValue: Number(q.general_discount_value) || 0,
      notes: q.notes || "",
      internalNotes: q.internal_notes || "",
      garantiaTexto: iqState.defaults.garantiaTexto,
      legacySource: null
    };
    iqState.dirty = false;
    clearLocalDraftCache();
    syncDomFromDoc();
  }

  async function saveDraftOrEmit(emit = false, createVersion = false) {
    if (iqState.saving) return false;
    if (emit && !validateForEmit()) return false;

    readFormFieldsIntoDoc();
    iqState.saving = true;
    updateSaveStatusPill("dirty", emit ? "Emitindo..." : "Salvando rascunho...");

    try {
      const payload = buildServerPayload(createVersion);
      let savedViaSupabase = false;

      if (root.SJ_SUPABASE?.issuedQuotes?.salvar && !iqState.doc.legacySource) {
        const res = await root.SJ_SUPABASE.issuedQuotes.salvar(payload, emit);
        if (res.sucesso && res.dados) {
          applySavedResponseToDoc(res.dados);
          savedViaSupabase = true;
        } else if (!res.tabelaAusente && !res.fallbackLocal) {
          toast(res.mensagem || "Não foi possível salvar no servidor.", "warning");
          updateSaveStatusPill("dirty", "Erro ao salvar");
          return false;
        }
      }

      if (!savedViaSupabase) {
        // Fallback seguro para banco local (SJ_DB.orcamentos) quando offline / migration 010 pendente
        const numero = iqState.doc.quoteCode || allocateLocalQuoteCode(iqState.doc.issueDate?.slice(0, 4));
        iqState.doc.quoteCode = numero;
        iqState.doc.status = emit ? "emitido" : "rascunho";
        iqState.doc.isLocked = Boolean(emit);
        const params = buildTimbradoParamsFromDoc(iqState.doc);
        if (root.SJ_DB?.orcamentos?.salvar) {
          root.SJ_DB.orcamentos.salvar({
            vendedor: params.vendedorNome,
            status: emit ? "pendente" : "pendente",
            metadados: {
              ...params.meta,
              numero,
              erpStatus: iqState.doc.status,
              customerSnapshot: payload.customer_snapshot,
              internalNotes: payload.internal_notes
            },
            itens: params.itens
          });
        }
        iqState.dirty = false;
        clearLocalDraftCache();
        syncDomFromDoc();
      }

      if (emit && iqState.doc.sourceCustomerQuoteId && root.SJ_SUPABASE?.quotes?.responderEquipe) {
        const totals = computeDocTotals(iqState.doc);
        await root.SJ_SUPABASE.quotes.responderEquipe(iqState.doc.sourceCustomerQuoteId, {
          status: "respondido",
          admin_total: totals.total,
          admin_response: `Orçamento oficial nº ${iqState.doc.quoteCode} emitido pela equipe Loja SJ 3D.`,
          limparAlterado: true
        });
        bridge().renderizarOrcamentosPortalCms?.();
      }

      await refreshHistoryData();
      toast(
        emit
          ? `Orçamento ${iqState.doc.quoteCode} emitido com sucesso!`
          : `Rascunho ${iqState.doc.quoteCode || ""} salvo!`,
        "success"
      );
      return true;
    } finally {
      iqState.saving = false;
    }
  }

  async function downloadTimbradoPdf(docOverride = null) {
    const targetDoc = docOverride || iqState.doc;
    if (!targetDoc) return;
    const dlg = document.getElementById("iq-preview-dialog");
    const mount = document.getElementById("iq-timbrado-preview-mount");
    if (!dlg || !mount || typeof bridge().montarHtmlFolhaTimbradaOficial !== "function") return;

    const params = buildTimbradoParamsFromDoc(targetDoc);
    mount.innerHTML = bridge().montarHtmlFolhaTimbradaOficial(params);

    const wasOpen = dlg.open;
    if (!wasOpen && typeof dlg.showModal === "function") {
      dlg.showModal();
    }

    const sheet = mount.querySelector(".quote-official-letterhead");
    if (!sheet || !root.html2pdf || typeof bridge().obterConfiguracaoHtml2Pdf !== "function") {
      root.print();
      return;
    }

    const nomeArquivo = `Orcamento-${params.meta.numero || "2026-0001"}.pdf`;
    const opt = bridge().obterConfiguracaoHtml2Pdf(nomeArquivo);
    toast("Gerando PDF oficial timbrado...", "info");
    try {
      await root.html2pdf().set(opt).from(sheet).save();
      toast(`PDF ${nomeArquivo} baixado com sucesso!`, "success");
    } catch (err) {
      toast("Não foi possível gerar o PDF automaticamente. Use Imprimir -> Salvar como PDF.", "warning");
    }
  }

  async function sendTimbradoWhatsApp() {
    readFormFieldsIntoDoc();
    const ok = iqState.doc.isLocked ? true : await saveDraftOrEmit(true, false);
    if (!ok) return;

    const params = buildTimbradoParamsFromDoc(iqState.doc);
    const { meta, itens, totals } = params;
    const c = iqState.doc.customer || {};
    const fone = onlyDigits(c.telefone);
    const foneDestino = fone.length >= 10 ? (fone.startsWith("55") ? fone : `55${fone}`) : "5544991351318";

    const itensTexto = itens.map((it, idx) => {
      const totLinha = Math.max(0, (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0) - (Number(it.descontoLinhaValor) || 0));
      return `*${idx + 1}.* ${it.descricao} (${it.qtd}x) — ${fmtBRL(totLinha)}`;
    }).join("\n");

    const msg = `*ORÇAMENTO COMERCIAL — GRUPO SJ 3D*\n`
      + `*Nº Proposta:* ${meta.numero}\n`
      + `*Data:* ${meta.data} | *Validade:* ${meta.validade}\n`
      + `*Cliente:* ${meta.cliente.nome}\n\n`
      + `*ITENS:*\n${itensTexto}\n\n`
      + `*TOTAL:* ${fmtBRL(totals.total)}\n`
      + `*Pagamento:* ${meta.formaPagamento}\n`
      + `*Entrega:* ${meta.prazoEntrega}`;

    const waUrl = `https://wa.me/${foneDestino}?text=${encodeURIComponent(msg)}`;

    const dlg = document.getElementById("iq-preview-dialog");
    const mount = document.getElementById("iq-timbrado-preview-mount");
    let blobObj = null;
    if (dlg && mount && root.html2pdf && typeof bridge().montarHtmlFolhaTimbradaOficial === "function") {
      mount.innerHTML = bridge().montarHtmlFolhaTimbradaOficial(params);
      if (!dlg.open && typeof dlg.showModal === "function") dlg.showModal();
      const sheet = mount.querySelector(".quote-official-letterhead");
      if (sheet) {
        const nomeArquivo = `Orcamento-${meta.numero}.pdf`;
        const opt = bridge().obterConfiguracaoHtml2Pdf(nomeArquivo);
        try {
          const blob = await root.html2pdf().set(opt).from(sheet).output("blob");
          blobObj = { blob, nomeArquivo };
        } catch (_) { }
      }
    }

    if (blobObj && typeof bridge().abrirModalOrientacaoPdfWhatsApp === "function") {
      bridge().abrirModalOrientacaoPdfWhatsApp({
        numero: meta.numero,
        nomeArquivo: blobObj.nomeArquivo,
        waUrl,
        blob: blobObj.blob
      });
    } else {
      root.open(waUrl, "_blank", "noopener");
    }
  }

  // =========================================================================
  // BUSCA DE CLIENTES, CNPJ/CEP SERVER-SIDE E IMPORTAÇÃO DE SOLICITAÇÃO
  // =========================================================================
  function normSearchStr(s) {
    return root.SJ_CUSTOMER_RULES?.normText
      ? root.SJ_CUSTOMER_RULES.normText(s)
      : String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function mapProfileRowToCandidate(p) {
    const pType = p.person_type === "pj" ? "pj" : "pf";
    const cnpjDig = onlyDigits(p.cnpj);
    const cpfDig = onlyDigits(p.cpf);
    const comp = p.completeness || root.SJ_CUSTOMER_RULES?.evaluateCompleteness?.({
      personType: pType,
      nome: p.nome,
      razaoSocial: p.razao_social,
      inscricaoEstadual: p.inscricao_estadual,
      ieTipo: p.ie_tipo,
      contatoNome: p.contato_nome,
      cpf: cpfDig,
      cnpj: cnpjDig,
      telefone: p.telefone,
      email: p.email,
      cep: p.cep,
      logradouro: p.logradouro,
      numero: p.numero,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf
    }) || { isComplete: false, missingFields: [] };

    const missingArr = comp.missing_fields || comp.missingFields || [];
    const isComplete = Boolean(comp.is_complete !== undefined ? comp.is_complete : comp.isComplete);
    const docMasked = p.doc_masked || root.SJ_CUSTOMER_RULES?.maskDoc?.(pType === "pj" ? cnpjDig : cpfDig) || "";

    return {
      source: "Cadastro do Site",
      customerProfileId: p.id,
      customerType: pType,
      nome: p.nome || "",
      razaoSocial: p.razao_social || "",
      nomeFantasia: p.nome_fantasia || "",
      ieTipo: p.ie_tipo || "contribuinte",
      inscricaoEstadual: p.inscricao_estadual || "",
      contatoNome: p.contato_nome || "",
      cpf: cpfDig,
      cnpj: cnpjDig,
      docMasked,
      telefone: p.telefone || "",
      email: p.email || "",
      cep: onlyDigits(p.cep || ""),
      logradouro: p.logradouro || "",
      numero: p.numero || "",
      complemento: p.complemento || "",
      bairro: p.bairro || "",
      cidade: p.cidade || "Umuarama",
      uf: p.uf || "PR",
      isComplete,
      missingFields: Array.isArray(missingArr) ? missingArr : [],
      openQuotesCount: Number(p.open_quotes_count) || 0
    };
  }

  async function searchClientsCombined(query) {
    const q = normSearchStr(query);
    const digits = onlyDigits(query);
    const results = [];
    const seenKeys = new Set();

    const pushCandidate = (cand) => {
      const key = cand.customerProfileId
        ? `prof:${cand.customerProfileId}`
        : `${onlyDigits(cand.cnpj || cand.cpf)}|${normSearchStr(cand.nome || cand.razaoSocial)}|${onlyDigits(cand.telefone)}`;
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      results.push(cand);
    };

    // 1) Busca oficial completa no banco (admin_search_customers_for_quote -> profiles + completude + quotes abertos)
    let fetchedFromCustomersRpc = false;
    if (root.SJ_SUPABASE?.customers?.buscarParaOrcamento) {
      const res = await root.SJ_SUPABASE.customers.buscarParaOrcamento(query, 15);
      if (res?.sucesso && Array.isArray(res.dados)) {
        fetchedFromCustomersRpc = true;
        res.dados.forEach((p) => pushCandidate(mapProfileRowToCandidate(p)));
      }
    }

    // Fallback para RPC 010 caso 011 ainda não tenha sido aplicada
    if (!fetchedFromCustomersRpc && root.SJ_SUPABASE?.issuedQuotes?.buscarClientes) {
      const res = await root.SJ_SUPABASE.issuedQuotes.buscarClientes(query);
      if (res?.sucesso && Array.isArray(res.dados)) {
        res.dados.forEach((p) => pushCandidate(mapProfileRowToCandidate(p)));
      }
    }

    // 2) Complementa com leads locais (SJ_DB.clientes)
    const localClients = root.SJ_DB?.clientes?.listar?.() || [];
    localClients.forEach((cli) => {
      const docDig = onlyDigits(cli.cnpjCpf || cli.cpf || "");
      const phoneDig = onlyDigits(cli.whatsapp || cli.cepTelefone || "");
      const hay = normSearchStr(`${cli.nome || ""} ${cli.razaoSocial || ""} ${cli.nomeFantasia || ""} ${cli.email || ""}`);
      const match = !q
        || hay.includes(q)
        || (digits.length >= 2 && (docDig.includes(digits) || phoneDig.includes(digits)));
      if (match) {
        const emailLow = String(cli.email || "").trim().toLowerCase();
        if (emailLow && results.some((r) => String(r.email || "").trim().toLowerCase() === emailLow)) {
          return;
        }
        const isPj = docDig.length === 14;
        const comp = root.SJ_CUSTOMER_RULES?.evaluateCompleteness?.({
          personType: isPj ? "pj" : "pf",
          nome: isPj ? "" : (cli.nome || ""),
          razaoSocial: isPj ? (cli.nome || "") : "",
          cpf: isPj ? "" : docDig,
          cnpj: isPj ? docDig : "",
          telefone: cli.whatsapp || cli.cepTelefone || "",
          email: cli.email || "",
          cep: cli.cep || "",
          logradouro: cli.logradouro || cli.endereco || "",
          numero: cli.numero || "",
          bairro: cli.bairro || "",
          cidade: String(cli.cidade || cli.bairroCidadeUf || "").split("/")[0]?.trim() || "",
          uf: cli.uf || ""
        }) || { isComplete: false, missingFields: [] };

        pushCandidate({
          source: "Lead local",
          customerProfileId: null,
          customerType: isPj ? "pj" : "pf",
          nome: isPj ? "" : (cli.nome || ""),
          razaoSocial: isPj ? (cli.nome || "") : "",
          nomeFantasia: cli.nomeFantasia || "",
          ieTipo: "contribuinte",
          inscricaoEstadual: cli.inscricaoEstadual || "",
          contatoNome: cli.contatoNome || "",
          cpf: isPj ? "" : docDig,
          cnpj: isPj ? docDig : "",
          docMasked: root.SJ_CUSTOMER_RULES?.maskDoc?.(docDig) || "",
          telefone: cli.whatsapp || cli.cepTelefone || "",
          email: cli.email || "",
          cep: onlyDigits(cli.cep || ""),
          logradouro: cli.logradouro || cli.endereco || "",
          numero: cli.numero || "",
          complemento: cli.complemento || "",
          bairro: cli.bairro || "",
          cidade: String(cli.cidade || cli.bairroCidadeUf || "Umuarama / PR").split("/")[0]?.trim() || "Umuarama",
          uf: cli.uf || String(cli.bairroCidadeUf || "Umuarama / PR").split("/")[1]?.trim() || "PR",
          isComplete: comp.isComplete,
          missingFields: comp.missingFields || [],
          openQuotesCount: 0
        });
      }
    });

    return results.slice(0, 15);
  }

  function applySelectedClientToDoc(cand) {
    if (!iqState.doc || !cand) return;
    iqState.doc.customerType = cand.customerType === "pj" ? "pj" : "pf";
    iqState.doc.customerProfileId = cand.customerProfileId || null;
    iqState.doc.selectedCustomerOpenQuotes = Number(cand.openQuotesCount) || 0;
    iqState.doc.customer = {
      nome: cand.nome || (cand.customerType === "pj" ? (cand.razaoSocial || "") : ""),
      cpf: onlyDigits(cand.cpf),
      cnpj: onlyDigits(cand.cnpj),
      razaoSocial: cand.razaoSocial || cand.nome || "",
      nomeFantasia: cand.nomeFantasia || "",
      ieTipo: cand.ieTipo || "contribuinte",
      inscricaoEstadual: cand.inscricaoEstadual || "",
      contatoNome: cand.contatoNome || "",
      telefone: cand.telefone || "",
      email: cand.email || "",
      cep: onlyDigits(cand.cep),
      logradouro: cand.logradouro || "",
      numero: cand.numero || "",
      complemento: cand.complemento || "",
      bairro: cand.bairro || "",
      cidade: cand.cidade || "Umuarama",
      uf: cand.uf || "PR"
    };
    markDirty();
    syncDomFromDoc();
  }

  async function lookupCnpjServer() {
    const cnpjInp = document.getElementById("iq-cli-cnpj");
    const fb = document.getElementById("iq-cnpj-feedback");
    const digits = onlyDigits(cnpjInp?.value);
    if (!digits) return;
    if (!bridge().validarCnpjOficial(digits)) {
      if (fb) {
        fb.textContent = "CNPJ inválido";
        fb.className = "iq-field-feedback is-error";
      }
      cnpjInp?.setAttribute("aria-invalid", "true");
      return;
    }
    if (fb) {
      fb.textContent = "Consultando Receita...";
      fb.className = "iq-field-feedback";
    }
    const res = await root.SJ_SUPABASE?.fiscal?.consultarCnpj?.(digits);
    if (res?.sucesso && res.dados) {
      const x = res.dados;
      const setIf = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setIf("iq-cli-razao", x.razao_social);
      setIf("iq-cli-fantasia", x.nome_fantasia);
      if (x.telefone && !document.getElementById("iq-cli-telefone")?.value.trim()) setIf("iq-cli-telefone", x.telefone);
      if (x.email && !document.getElementById("iq-cli-email")?.value.trim()) setIf("iq-cli-email", x.email);
      setIf("iq-cli-cep", x.cep ? formatCep(x.cep) : "");
      setIf("iq-cli-logradouro", x.logradouro);
      setIf("iq-cli-numero", x.numero);
      setIf("iq-cli-complemento", x.complemento);
      setIf("iq-cli-bairro", x.bairro);
      setIf("iq-cli-cidade", x.cidade);
      setIf("iq-cli-uf", x.uf);
      if (fb) {
        fb.textContent = x.ativa ? "CNPJ ativo ✓" : (x.situacao_cadastral || "Consultado");
        fb.className = "iq-field-feedback is-ok";
      }
      cnpjInp?.removeAttribute("aria-invalid");
      readFormFieldsIntoDoc();
      updateFinancialSummaryUI();
      markDirty();
      toast("Dados do CNPJ preenchidos!", "success");
    } else {
      if (fb) {
        fb.textContent = res?.mensagem || "Não encontrado automaticamente";
        fb.className = "iq-field-feedback is-error";
      }
    }
  }

  async function lookupCepServer() {
    const cepInp = document.getElementById("iq-cli-cep");
    const fb = document.getElementById("iq-cep-feedback");
    const digits = onlyDigits(cepInp?.value);
    if (digits.length !== 8) return;
    if (fb) {
      fb.textContent = "Buscando...";
      fb.className = "iq-field-feedback";
    }
    const res = await root.SJ_SUPABASE?.fiscal?.consultarCep?.(digits);
    if (res?.sucesso && res.dados) {
      const x = res.dados;
      const setIf = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setIf("iq-cli-logradouro", x.logradouro);
      if (x.complemento) setIf("iq-cli-complemento", x.complemento);
      setIf("iq-cli-bairro", x.bairro);
      setIf("iq-cli-cidade", x.cidade);
      setIf("iq-cli-uf", x.uf);
      if (fb) {
        fb.textContent = "CEP localizado ✓";
        fb.className = "iq-field-feedback is-ok";
      }
      readFormFieldsIntoDoc();
      markDirty();
    } else if (fb) {
      fb.textContent = "CEP não localizado";
      fb.className = "iq-field-feedback is-error";
    }
  }

  async function openImportCustomerQuoteModal() {
    const dlg = document.getElementById("iq-import-dialog");
    const listEl = document.getElementById("iq-import-list");
    const searchInp = document.getElementById("iq-import-search");
    if (!dlg || !listEl) return;

    listEl.innerHTML = `<div style="padding:18px; text-align:center; color:#64748b;">Carregando solicitações dos clientes...</div>`;
    if (typeof dlg.showModal === "function") dlg.showModal();

    let lista = bridge().getQuotesCache?.() || [];
    if (root.SJ_SUPABASE?.quotes?.listarTodos) {
      const r = await root.SJ_SUPABASE.quotes.listarTodos();
      if (r?.sucesso) lista = r.dados || [];
    }

    const renderList = () => {
      const q = (searchInp?.value || "").trim().toLowerCase();
      const filtered = lista.filter((item) => {
        if (!q) return true;
        const snap = item.customer_snapshot || {};
        const txt = `${item.quote_number || ""} ${item.cliente_nome || ""} ${snap.display_name || ""} ${snap.razao_social || ""}`.toLowerCase();
        return txt.includes(q);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="padding:20px; text-align:center; color:#64748b;">Nenhuma solicitação encontrada.</div>`;
        return;
      }

      listEl.innerHTML = filtered.slice(0, 40).map((item) => {
        const snap = item.customer_snapshot || {};
        const nome = snap.display_name || item.cliente_nome || "Cliente";
        const itens = Array.isArray(item.quote_items) ? item.quote_items : [];
        const refTot = itens.reduce((a, it) => a + Number(it.unit_price || 0) * Number(it.quantity || 1), 0);
        return `
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="min-width:0; flex:1;">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <strong>#${esc(item.quote_number)}</strong>
                <span class="cms-status-pill is-neutral">${esc(item.status)}</span>
                <span class="cms-status-pill ${item.precisa_nota_fiscal ? "is-green" : "is-neutral"}">${item.precisa_nota_fiscal ? "Com NF" : "Sem NF"}</span>
              </div>
              <div style="font-size:0.86rem; font-weight:700; color:#0f172a; margin-top:4px;">${esc(nome)}</div>
              <div style="font-size:0.76rem; color:#64748b;">${itens.length} ${itens.length === 1 ? "item" : "itens"} • Ref. catálogo: ${fmtBRL(refTot)}</div>
            </div>
            <button type="button" class="btn-cms-save" data-import-quote-id="${esc(item.id)}">Importar para orçamento</button>
          </div>
        `;
      }).join("");

      listEl.querySelectorAll("[data-import-quote-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const picked = lista.find((x) => String(x.id) === String(btn.dataset.importQuoteId));
          if (!picked) return;
          const snap = picked.customer_snapshot || {};
          const items = Array.isArray(picked.quote_items) ? picked.quote_items : [];
          iqState.doc = createEmptyDoc();
          iqState.doc.sourceCustomerQuoteId = picked.id;
          iqState.doc.sourceCustomerQuoteNumber = picked.quote_number;
          iqState.doc.needsInvoice = Boolean(picked.precisa_nota_fiscal);
          iqState.doc.customerType = snap.person_type === "pj" ? "pj" : "pf";
          iqState.doc.customerProfileId = picked.user_id || null;
          iqState.doc.customer = {
            nome: snap.nome || picked.cliente_nome || "",
            cpf: onlyDigits(snap.cpf || (snap.person_type !== "pj" ? snap.documento : "")),
            cnpj: onlyDigits(snap.cnpj || (snap.person_type === "pj" ? snap.documento : "")),
            razaoSocial: snap.razao_social || snap.display_name || "",
            nomeFantasia: snap.nome_fantasia || "",
            ieTipo: snap.ie_tipo || "contribuinte",
            inscricaoEstadual: snap.inscricao_estadual || "",
            contatoNome: snap.contato_nome || "",
            telefone: snap.telefone || picked.cliente_telefone || "",
            email: snap.email || picked.cliente_email || "",
            cep: onlyDigits(snap.cep || ""),
            logradouro: snap.logradouro || "",
            numero: snap.numero || "",
            complemento: snap.complemento || "",
            bairro: snap.bairro || "",
            cidade: snap.cidade || "Umuarama",
            uf: snap.uf || "PR"
          };
          iqState.doc.items = items.map((it) => createBlankItem({
            productId: it.product_id || null,
            title: it.product_name || "Produto",
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unit_price) || 0,
            isCustom: !it.product_id
          }));
          if (picked.notes) {
            iqState.doc.notes = `${iqState.defaults.observacoesPadrao}\nSolicitação do cliente: ${picked.notes}`;
          }
          dlg.close?.();
          markDirty("Importado do cliente — não salvo");
          syncDomFromDoc();
          toast(`Solicitação #${picked.quote_number} importada!`, "success");
        });
      });
    };

    if (searchInp) {
      searchInp.value = "";
      searchInp.oninput = renderList;
    }
    renderList();
  }

  // =========================================================================
  // PICKER DE CATÁLOGO (MULTI-SELEÇÃO)
  // =========================================================================
  function openCatalogPickerModal() {
    const dlg = document.getElementById("iq-catalog-dialog");
    const grid = document.getElementById("iq-catalog-grid");
    const searchInp = document.getElementById("iq-catalog-search");
    const catSel = document.getElementById("iq-catalog-cat");
    const countEl = document.getElementById("iq-catalog-selected-count");
    if (!dlg || !grid) return;

    iqState.catalogSelectedIds.clear();
    const skus = bridge().gerarListaSkusCms?.() || [];

    const updateSelectedCount = () => {
      if (countEl) {
        const n = iqState.catalogSelectedIds.size;
        countEl.textContent = `${n} ${n === 1 ? "item selecionado" : "itens selecionados"}`;
      }
    };

    const renderGrid = () => {
      const q = (searchInp?.value || "").trim().toLowerCase();
      const cat = catSel?.value || "todos";
      const filtered = skus.filter((s) => {
        if (cat !== "todos" && s.categoria !== cat) return false;
        if (!q) return true;
        const txt = `${s.nome || ""} ${s.subtitulo || ""} ${s.marca || ""} ${s.codigo || ""} ${s.corNome || ""}`.toLowerCase();
        return txt.includes(q);
      });

      if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1 / -1; text-align:center; padding:24px; color:#64748b;">Nenhum produto encontrado no catálogo.</div>`;
        return;
      }

      grid.innerHTML = filtered.slice(0, 80).map((s) => {
        const sel = iqState.catalogSelectedIds.has(s.key);
        const stock = s.estoqueStatus || "disponivel";
        const stockLabel = stock === "esgotado" ? "Esgotado" : stock === "poucas_unidades" ? "Poucas un." : "Disponível";
        const stockClass = stock === "esgotado" ? "is-red" : stock === "poucas_unidades" ? "is-amber" : "is-green";
        return `
          <label class="iq-catalog-pick-card ${sel ? "is-selected" : ""}" data-pick-key="${esc(s.key)}">
            <input type="checkbox" ${sel ? "checked" : ""} style="width:18px; height:18px; accent-color:#f04e23;" />
            <img src="${esc(s.imagem || "assets/img/icone-laranja.png")}" alt="" loading="lazy" />
            <div style="min-width:0; flex:1;">
              <div style="font-size:0.82rem; font-weight:700; color:#0f172a; line-height:1.25;">${esc(s.nome)}</div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px;">
                <strong style="font-size:0.82rem; color:#c2410c;">${fmtBRL(s.precoNum)}</strong>
                ${s.codigo ? `<span style="font-size:0.7rem; color:#64748b;">${esc(s.codigo)}</span>` : ""}
                <span class="cms-status-pill ${stockClass}" style="font-size:0.66rem; padding:1px 6px;">${stockLabel}</span>
              </div>
            </div>
          </label>
        `;
      }).join("");

      grid.querySelectorAll("[data-pick-key]").forEach((card) => {
        const chk = card.querySelector("input[type='checkbox']");
        chk?.addEventListener("change", () => {
          const k = card.dataset.pickKey;
          if (chk.checked) iqState.catalogSelectedIds.add(k);
          else iqState.catalogSelectedIds.delete(k);
          card.classList.toggle("is-selected", chk.checked);
          updateSelectedCount();
        });
      });
    };

    if (searchInp) {
      searchInp.value = "";
      searchInp.oninput = renderGrid;
    }
    if (catSel) {
      catSel.value = "todos";
      catSel.onchange = renderGrid;
    }

    const btnConfirm = document.getElementById("btn-iq-catalog-confirm");
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        const chosen = skus.filter((s) => iqState.catalogSelectedIds.has(s.key));
        if (chosen.length === 0) {
          toast("Selecione pelo menos 1 item do catálogo.", "warning");
          return;
        }
        chosen.forEach((s) => {
          iqState.doc.items.push(createBlankItem({
            productId: s.id || null,
            productCode: s.codigo ? String(s.codigo).replace(/^C[ÓO]D\.\s*/i, "") : "",
            title: s.nome,
            description: s.subtitulo || "",
            quantity: 1,
            unitPrice: Number(s.precoNum) || 0,
            isCustom: false
          }));
        });
        dlg.close?.();
        renderItemsTable();
        updateFinancialSummaryUI();
        markDirty();
        toast(`${chosen.length} ${chosen.length === 1 ? "item adicionado" : "itens adicionados"}!`, "success");
      };
    }

    updateSelectedCount();
    renderGrid();
    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  // =========================================================================
  // ABA HISTÓRICO UNIFICADO (NOVOS SUPABASE + LEGADOS SJ-2026-...)
  // =========================================================================
  async function refreshHistoryData() {
    let cloudList = [];
    if (root.SJ_SUPABASE?.issuedQuotes?.listarTodos) {
      const res = await root.SJ_SUPABASE.issuedQuotes.listarTodos();
      if (res?.sucesso && Array.isArray(res.dados)) {
        cloudList = res.dados;
      }
    }
    iqState.historyIssued = cloudList;
    renderHistoryList();
  }

  function buildUnifiedHistoryList() {
    const unified = [];
    const seenCodes = new Set();

    (iqState.historyIssued || []).forEach((q) => {
      const snap = q.customer_snapshot || {};
      const nomeCli = snap.display_name || snap.razao_social || snap.nome || "Cliente";
      seenCodes.add(String(q.quote_code || ""));
      unified.push({
        kind: "erp",
        uid: q.id,
        code: q.quote_code,
        dateIso: q.issue_date || (q.created_at ? String(q.created_at).slice(0, 10) : todayISO()),
        createdAt: q.created_at || "",
        clientName: nomeCli,
        clientType: q.customer_type === "pj" ? "PJ" : "PF",
        clientDoc: snap.documento || snap.cnpj || snap.cpf || "",
        clientPhone: snap.telefone || "",
        needsInvoice: Boolean(q.needs_invoice),
        seller: q.seller_name || "Equipe",
        status: q.status || "emitido",
        total: Number(q.total_amount) || 0,
        itemsCount: Array.isArray(q.issued_quote_items) ? q.issued_quote_items.length : 0,
        raw: q
      });
    });

    const legacy = root.SJ_DB?.orcamentos?.listar?.() || [];
    legacy.forEach((o) => {
      if (seenCodes.has(String(o.id || ""))) return;
      const meta = o.metadados || {};
      const cli = meta.cliente || {};
      unified.push({
        kind: "legacy",
        uid: o.id,
        code: o.id || meta.numero || "SJ-LEGADO",
        dateIso: parseDateISOFromBR(meta.data) || (o.dataHoraSalvo ? String(o.dataHoraSalvo).slice(0, 10) : todayISO()),
        createdAt: o.dataHoraSalvo || "",
        clientName: cli.nome || o.clienteNome || "Cliente",
        clientType: onlyDigits(cli.cnpjCpf).length === 14 ? "PJ" : "PF",
        clientDoc: cli.cnpjCpf || "",
        clientPhone: cli.cepTelefone || "",
        needsInvoice: false,
        seller: o.vendedor || "Equipe",
        status: o.status || "pendente",
        total: Number(o.total) || 0,
        itemsCount: Array.isArray(o.itens) ? o.itens.length : (Number(o.itensQtd) || 0),
        raw: o
      });
    });

    unified.sort((a, b) => String(b.createdAt || b.dateIso).localeCompare(String(a.createdAt || a.dateIso)));
    return unified;
  }

  function convertUnifiedToEditableDoc(entry, asDuplicate = false, asNewVersion = false) {
    if (entry.kind === "erp") {
      const q = entry.raw;
      const snap = q.customer_snapshot || {};
      const items = (q.issued_quote_items || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return {
        id: asDuplicate ? null : q.id,
        quoteCode: asDuplicate ? "" : q.quote_code,
        status: asDuplicate ? "rascunho" : (asNewVersion ? "rascunho" : q.status),
        isLocked: (asDuplicate || asNewVersion) ? false : Boolean(q.is_locked),
        versionNumber: Number(q.version_number) || 1,
        parentQuoteId: q.parent_quote_id || null,
        sourceCustomerQuoteId: asDuplicate ? null : (q.source_customer_quote_id || null),
        sourceCustomerQuoteNumber: null,
        issueDate: asDuplicate ? todayISO() : (q.issue_date || todayISO()),
        validityDays: Number(q.validity_days) || 7,
        needsInvoice: Boolean(q.needs_invoice),
        customerType: q.customer_type === "pj" ? "pj" : "pf",
        customerProfileId: q.customer_profile_id || null,
        customer: {
          nome: snap.nome || "",
          cpf: snap.cpf || "",
          cnpj: snap.cnpj || "",
          razaoSocial: snap.razao_social || "",
          nomeFantasia: snap.nome_fantasia || "",
          ieTipo: snap.ie_tipo || "contribuinte",
          inscricaoEstadual: snap.inscricao_estadual || "",
          contatoNome: snap.contato_nome || "",
          telefone: snap.telefone || "",
          email: snap.email || "",
          cep: snap.cep || "",
          logradouro: snap.logradouro || "",
          numero: snap.numero || "",
          complemento: snap.complemento || "",
          bairro: snap.bairro || "",
          cidade: snap.cidade || "Umuarama",
          uf: snap.uf || "PR"
        },
        items: items.map((it) => createBlankItem({
          productId: it.product_id,
          productCode: it.product_code,
          title: it.title,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discountType: it.discount_type,
          discountValue: it.discount_value,
          isCustom: it.is_custom
        })),
        paymentMethod: q.payment_method || "PIX à Vista (5% OFF)",
        paymentInstallments: Number(q.payment_installments) || 1,
        deliveryTerm: q.delivery_term || "Pronta Entrega / Imediato",
        freightAmount: Number(q.freight_amount) || 0,
        generalDiscountType: q.general_discount_type === "percent" ? "percent" : "fixed",
        generalDiscountValue: Number(q.general_discount_value) || 0,
        notes: q.notes || "",
        internalNotes: asDuplicate ? "" : (q.internal_notes || ""),
        garantiaTexto: iqState.defaults.garantiaTexto,
        legacySource: null
      };
    }

    // Legacy SJ_DB.orcamentos entry (e.g. SJ-2026-1685)
    const o = entry.raw;
    const meta = o.metadados || {};
    const cli = meta.cliente || {};
    const docDig = onlyDigits(cli.cnpjCpf || "");
    const isPj = docDig.length === 14;
    const cityParts = String(cli.bairroCidadeUf || "Umuarama / PR").split("/");
    return {
      id: null,
      quoteCode: asDuplicate ? "" : (o.id || meta.numero || ""),
      status: asDuplicate ? "rascunho" : (o.status || "pendente"),
      isLocked: false,
      versionNumber: 1,
      parentQuoteId: null,
      sourceCustomerQuoteId: null,
      sourceCustomerQuoteNumber: null,
      issueDate: asDuplicate ? todayISO() : parseDateISOFromBR(meta.data),
      validityDays: parseInt(meta.validade, 10) || 15,
      needsInvoice: false,
      customerType: isPj ? "pj" : "pf",
      customerProfileId: null,
      customer: {
        nome: isPj ? "" : (cli.nome || ""),
        cpf: isPj ? "" : docDig,
        cnpj: isPj ? docDig : "",
        razaoSocial: isPj ? (cli.nome || "") : "",
        nomeFantasia: "",
        ieTipo: "contribuinte",
        inscricaoEstadual: "",
        contatoNome: "",
        telefone: cli.cepTelefone || "",
        email: cli.email || "",
        cep: "",
        logradouro: cli.endereco || "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: (cityParts[0] || "Umuarama").replace(/^.*-\s*/, "").trim(),
        uf: (cityParts[1] || "PR").trim().slice(0, 2)
      },
      items: (o.itens || []).map((it) => createBlankItem({
        productCode: it.codigo || "",
        title: it.descricao || "Item",
        quantity: Number(it.qtd) || 1,
        unitPrice: Number(it.precoUnitario) || 0,
        isCustom: false
      })),
      paymentMethod: meta.formaPagamento || "PIX à Vista (5% OFF)",
      paymentInstallments: 1,
      deliveryTerm: meta.prazoEntrega || "Pronta Entrega / Imediato",
      freightAmount: Number(meta.frete) || 0,
      generalDiscountType: "fixed",
      generalDiscountValue: Number(meta.desconto) || 0,
      notes: meta.observacoes || iqState.defaults.observacoesPadrao,
      internalNotes: meta.internalNotes || "",
      garantiaTexto: iqState.defaults.garantiaTexto,
      legacySource: asDuplicate ? null : o
    };
  }

  function renderHistoryList() {
    const listEl = document.getElementById("iq-hist-list");
    const badgeEl = document.getElementById("iq-history-count-badge");
    const all = buildUnifiedHistoryList();
    if (badgeEl) badgeEl.textContent = String(all.length);
    if (!listEl) return;

    const q = (document.getElementById("iq-hist-search")?.value || "").trim().toLowerCase();
    const qDig = onlyDigits(q);
    const statusFilter = document.getElementById("iq-hist-status")?.value || "todos";
    const periodFilter = document.getElementById("iq-hist-period")?.value || "todos";
    const todayStr = todayISO();
    const nowMs = Date.now();

    const filtered = all.filter((entry) => {
      if (statusFilter !== "todos" && entry.status !== statusFilter) return false;
      if (periodFilter === "hoje" && entry.dateIso !== todayStr) return false;
      if (periodFilter === "7d") {
        const dt = new Date(`${entry.dateIso}T12:00:00`).getTime();
        if (isNaN(dt) || (nowMs - dt) > 7 * 86400000) return false;
      }
      if (periodFilter === "mes") {
        if (!String(entry.dateIso).startsWith(todayStr.slice(0, 7))) return false;
      }
      if (q) {
        const text = `${entry.code} ${entry.clientName} ${entry.seller}`.toLowerCase();
        const docMatch = qDig.length >= 3 && (onlyDigits(entry.clientDoc).includes(qDig) || onlyDigits(entry.clientPhone).includes(qDig));
        if (!text.includes(q) && !docMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding:32px; text-align:center; color:#64748b; font-size:0.86rem;">Nenhum orçamento encontrado neste filtro.</div>`;
      return;
    }

    const erpStatusOpts = ["rascunho", "emitido", "enviado", "aprovado", "recusado", "vencido", "cancelado"];
    const legacyStatusOpts = ["pendente", "aprovado", "faturado", "cancelado"];

    listEl.innerHTML = filtered.map((entry, idx) => {
      const opts = entry.kind === "erp" ? erpStatusOpts : legacyStatusOpts;
      return `
        <div class="iq-history-row" data-hist-idx="${idx}">
          <div>
            <strong style="font-size:0.9rem; color:#0f172a; font-variant-numeric:tabular-nums;">${esc(entry.code)}</strong>
            <div style="margin-top:3px; display:flex; gap:4px; flex-wrap:wrap;">
              ${entry.kind === "legacy" ? `<span class="cms-status-pill is-neutral" style="font-size:0.66rem;">Legado</span>` : ""}
              <span class="cms-status-pill ${entry.needsInvoice ? "is-green" : "is-neutral"}" style="font-size:0.66rem;">${entry.needsInvoice ? "Com NF" : "Sem NF"}</span>
            </div>
          </div>

          <div style="min-width:0;">
            <div style="font-weight:700; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(entry.clientName)}</div>
            <div style="font-size:0.75rem; color:#64748b;">${esc(entry.clientType)} • ${entry.itemsCount} ${entry.itemsCount === 1 ? "item" : "itens"} • ${esc(entry.seller)}</div>
          </div>

          <div style="font-size:0.8rem; color:#475569;">${esc(formatDateBR(entry.dateIso))}</div>

          <div>
            <select class="cms-select-clean" data-hist-status-change="${idx}" style="width:100%; height:34px; font-size:0.78rem; padding:0 8px;">
              ${opts.map((st) => `<option value="${st}" ${entry.status === st ? "selected" : ""}>${esc(st.charAt(0).toUpperCase() + st.slice(1))}</option>`).join("")}
            </select>
          </div>

          <div style="font-weight:800; font-size:0.9rem; color:#0f172a; text-align:right; font-variant-numeric:tabular-nums;">
            ${fmtBRL(entry.total)}
          </div>

          <div class="iq-history-actions">
            <button type="button" class="iq-history-act-btn is-primary" data-hist-act="open" data-idx="${idx}">Abrir</button>
            <button type="button" class="iq-history-act-btn" data-hist-act="pdf" data-idx="${idx}">PDF</button>
            <button type="button" class="iq-history-act-btn" data-hist-act="dup" data-idx="${idx}">Duplicar</button>
            ${entry.kind === "erp" ? `<button type="button" class="iq-history-act-btn" data-hist-act="audit" data-idx="${idx}">Log</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-hist-status-change]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        const entry = filtered[parseInt(sel.dataset.histStatusChange, 10)];
        if (!entry) return;
        const novoSt = sel.value;
        if (entry.kind === "erp") {
          const r = await root.SJ_SUPABASE?.issuedQuotes?.atualizarStatus?.(entry.uid, novoSt);
          if (r?.sucesso) {
            toast(`Status do orçamento ${entry.code} atualizado para ${novoSt}.`, "success");
            await refreshHistoryData();
          } else {
            toast(r?.mensagem || "Erro ao alterar status.", "warning");
          }
        } else {
          root.SJ_DB?.orcamentos?.atualizarStatus?.(entry.uid, novoSt);
          toast(`Status do orçamento ${entry.code} atualizado.`, "success");
          renderHistoryList();
        }
      });
    });

    listEl.querySelectorAll("[data-hist-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const entry = filtered[parseInt(btn.dataset.idx, 10)];
        if (!entry) return;
        const act = btn.dataset.histAct;

        if (act === "open") {
          if (iqState.dirty && !confirm("Há alterações não salvas no orçamento atual. Deseja carregar este orçamento?")) return;
          iqState.doc = convertUnifiedToEditableDoc(entry, false, false);
          iqState.dirty = false;
          switchSubtab("novo");
          syncDomFromDoc();
        } else if (act === "dup") {
          if (iqState.dirty && !confirm("Há alterações não salvas no orçamento atual. Deseja duplicar este orçamento?")) return;
          iqState.doc = convertUnifiedToEditableDoc(entry, true, false);
          iqState.dirty = true;
          switchSubtab("novo");
          syncDomFromDoc();
          toast(`Cópia criada a partir de ${entry.code}!`, "info");
        } else if (act === "pdf") {
          if (entry.kind === "legacy" && typeof bridge().montarHtmlFolhaTimbradaOficial === "function") {
            const o = entry.raw;
            const dlg = document.getElementById("iq-preview-dialog");
            const mount = document.getElementById("iq-timbrado-preview-mount");
            if (dlg && mount) {
              mount.innerHTML = bridge().montarHtmlFolhaTimbradaOficial({
                meta: o.metadados || {},
                itens: o.itens || [],
                vendedorNome: o.vendedor || "Loja SJ 3D"
              });
              if (typeof dlg.showModal === "function") dlg.showModal();
              const sheet = mount.querySelector(".quote-official-letterhead");
              if (sheet && root.html2pdf) {
                const fn = `Orcamento-${entry.code}.pdf`;
                await root.html2pdf().set(bridge().obterConfiguracaoHtml2Pdf(fn)).from(sheet).save();
              }
            }
          } else {
            const tmpDoc = convertUnifiedToEditableDoc(entry, false, false);
            await downloadTimbradoPdf(tmpDoc);
          }
        } else if (act === "audit" && entry.kind === "erp") {
          openAuditModal(entry);
        }
      });
    });
  }

  async function openAuditModal(entry) {
    const dlg = document.getElementById("iq-audit-dialog");
    const sub = document.getElementById("iq-audit-dlg-sub");
    const list = document.getElementById("iq-audit-list");
    if (!dlg || !list) return;
    if (sub) sub.textContent = `Orçamento ${entry.code}`;
    list.innerHTML = `<div style="padding:14px; color:#64748b;">Carregando registro de auditoria...</div>`;
    if (typeof dlg.showModal === "function") dlg.showModal();

    const r = await root.SJ_SUPABASE?.issuedQuotes?.obterAuditoria?.(entry.uid);
    const logs = r?.dados || [];
    if (logs.length === 0) {
      list.innerHTML = `<div style="padding:14px; color:#64748b;">Nenhum registro encontrado.</div>`;
      return;
    }
    list.innerHTML = logs.map((l) => `
      <div style="border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; font-size:0.82rem;">
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <strong>${esc(l.action)}</strong>
          <span style="color:#64748b;">${esc(new Date(l.created_at).toLocaleString("pt-BR"))}</span>
        </div>
        <div style="color:#475569; margin-top:2px;">Por: ${esc(l.actor_name || l.actor_email || "Equipe")}</div>
      </div>
    `).join("");
  }

  // =========================================================================
  // ABAS (NOVO ORÇAMENTO | HISTÓRICO) COM FOCUSGROUP & FALLBACK TECLADO
  // =========================================================================
  function switchSubtab(subtab, skipHistory = false) {
    const tab = subtab === "historico" ? "historico" : "novo";
    iqState.subtab = tab;

    const btnNovo = document.getElementById("iq-tab-novo");
    const btnHist = document.getElementById("iq-tab-historico");
    const panelNovo = document.getElementById("iq-panel-novo");
    const panelHist = document.getElementById("iq-panel-historico");
    const mobileBar = document.getElementById("iq-mobile-sticky-bar");

    if (btnNovo && btnHist) {
      const novoAtivo = tab === "novo";
      btnNovo.setAttribute("aria-selected", novoAtivo ? "true" : "false");
      btnHist.setAttribute("aria-selected", novoAtivo ? "false" : "true");
      btnNovo.toggleAttribute("focusgroupstart", novoAtivo);
      btnHist.toggleAttribute("focusgroupstart", !novoAtivo);
    }

    if (panelNovo) {
      if (tab === "novo") {
        panelNovo.removeAttribute("hidden");
      } else {
        panelNovo.hidden = "until-found";
      }
    }
    if (panelHist) {
      if (tab === "historico") {
        panelHist.removeAttribute("hidden");
        refreshHistoryData();
      } else {
        panelHist.hidden = "until-found";
      }
    }
    if (mobileBar) {
      mobileBar.style.display = tab === "novo" ? "" : "none";
    }

    if (!skipHistory && root.location.pathname.includes("admin")) {
      const targetUrl = tab === "historico" ? "/admin/orcamentos/historico" : "/admin/orcamentos/novo";
      if (root.location.pathname !== targetUrl) {
        try {
          root.history.pushState({ aba: "emitir-orcamento", subtab: tab }, "", targetUrl);
        } catch (_) { }
      }
    }
  }

  // =========================================================================
  // INICIALIZAÇÃO ÚNICA E EVENTOS
  // =========================================================================
  function bindEventsOnce() {
    if (iqState.initialized) return;
    iqState.initialized = true;

    // Aviso ao sair da aba/janela do navegador com alterações não salvas
    root.addEventListener("beforeunload", (e) => {
      if (iqState.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    // Sub-tabs + suporte a Ctrl+F beforematch e fallback setas
    const tabs = [document.getElementById("iq-tab-novo"), document.getElementById("iq-tab-historico")].filter(Boolean);
    tabs.forEach((tabEl, idx) => {
      tabEl.addEventListener("click", () => switchSubtab(tabEl.dataset.iqSubtab));
      tabEl.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const next = tabs[(idx + 1) % tabs.length];
          next?.focus();
          switchSubtab(next?.dataset.iqSubtab);
        }
      });
    });
    document.getElementById("iq-panel-historico")?.addEventListener("beforematch", () => switchSubtab("historico"));
    document.getElementById("iq-panel-novo")?.addEventListener("beforematch", () => switchSubtab("novo"));

    // Cabeçalho: data, validade, novo em branco, padrões
    document.getElementById("iq-issue-date")?.addEventListener("change", (e) => {
      iqState.doc.issueDate = e.target.value || todayISO();
      updateValidityPreviewLine();
      markDirty();
    });
    document.getElementById("iq-validity-days")?.addEventListener("input", (e) => {
      iqState.doc.validityDays = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 7));
      updateValidityPreviewLine();
      markDirty();
    });
    document.getElementById("btn-iq-new-blank")?.addEventListener("click", () => {
      if (iqState.dirty && !confirm("Descartar as alterações atuais e iniciar um novo orçamento em branco?")) return;
      iqState.doc = createEmptyDoc();
      iqState.dirty = false;
      clearLocalDraftCache();
      switchSubtab("novo");
      syncDomFromDoc();
    });

    // Botão criar nova versão (-v2) / duplicar quando orçamento já emitido está aberto
    document.getElementById("btn-iq-create-version")?.addEventListener("click", () => {
      iqState.doc.isLocked = false;
      iqState.doc.status = "rascunho";
      iqState.doc.createVersionOnSave = true;
      iqState.dirty = true;
      syncDomFromDoc();
      toast("Modo de nova versão ativado! Edite os dados e clique em Emitir para gerar a versão -v2.", "info");
    });
    document.getElementById("btn-iq-duplicate-current")?.addEventListener("click", () => {
      const cloned = JSON.parse(JSON.stringify(iqState.doc));
      cloned.id = null;
      cloned.quoteCode = "";
      cloned.status = "rascunho";
      cloned.isLocked = false;
      cloned.versionNumber = 1;
      cloned.parentQuoteId = null;
      cloned.sourceCustomerQuoteId = null;
      cloned.issueDate = todayISO();
      cloned.legacySource = null;
      iqState.doc = cloned;
      iqState.dirty = true;
      syncDomFromDoc();
      toast("Orçamento duplicado como novo!", "info");
    });

    // Toggle PF / PJ & SEM NF / COM NF
    document.querySelectorAll("[data-iq-person-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (iqState.doc.isLocked) return;
        readFormFieldsIntoDoc();
        iqState.doc.customerType = btn.dataset.iqPersonType === "pj" ? "pj" : "pf";
        markDirty();
        syncDomFromDoc();
      });
    });
    document.querySelectorAll("[data-iq-invoice]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (iqState.doc.isLocked) return;
        readFormFieldsIntoDoc();
        iqState.doc.needsInvoice = btn.dataset.iqInvoice === "true";
        markDirty();
        syncDomFromDoc();
      });
    });

    // Busca de cliente cadastrado
    const clientSearchInp = document.getElementById("iq-client-search");
    const clientDropdown = document.getElementById("iq-client-autocomplete");
    if (clientSearchInp && clientDropdown) {
      clientSearchInp.addEventListener("input", () => {
        clearTimeout(iqState.customerSearchTimer);
        const val = clientSearchInp.value.trim();
        if (val.length < 2) {
          clientDropdown.style.display = "none";
          return;
        }
        iqState.customerSearchTimer = setTimeout(async () => {
          const matches = await searchClientsCombined(val);
          if (matches.length === 0) {
            clientDropdown.innerHTML = `
              <div style="padding:12px; font-size:0.82rem; color:#475569; text-align:center;">
                <p style="margin:0 0 8px;">Nenhum cliente encontrado com "<strong>${esc(val)}</strong>".</p>
                <button type="button" id="btn-iq-empty-search-avulso" class="btn-cms-secondary" style="width:100%;">Cliente avulso / novo</button>
              </div>
            `;
            document.getElementById("btn-iq-empty-search-avulso")?.addEventListener("click", () => {
              clientDropdown.style.display = "none";
              document.getElementById("btn-iq-client-avulso")?.click();
            });
          } else {
            clientDropdown.innerHTML = matches.map((m, i) => `
              <button type="button" class="iq-autocomplete-item" data-cand-idx="${i}">
                <div style="min-width:0;">
                  <strong style="display:block; font-size:0.85rem; color:#0f172a;">${esc(m.customerType === "pj" ? (m.razaoSocial || m.nome) : m.nome)}</strong>
                  <span style="font-size:0.74rem; color:#64748b;">
                    ${m.customerType.toUpperCase()} • ${esc(m.docMasked || "Sem doc")} • ${esc(m.telefone || "Sem tel")}
                  </span>
                </div>
                <span class="cust-badge ${m.isComplete ? "is-complete" : "is-incomplete"}" title="${esc(m.isComplete ? "Cadastro completo" : "Faltam: " + (m.missingFields || []).join(", "))}">
                  ${m.isComplete ? "Cadastro completo" : "Incompleto"}
                </span>
              </button>
            `).join("");
            clientDropdown.querySelectorAll("[data-cand-idx]").forEach((b) => {
              b.addEventListener("click", () => {
                applySelectedClientToDoc(matches[parseInt(b.dataset.candIdx, 10)]);
                clientDropdown.style.display = "none";
                clientSearchInp.value = "";
              });
            });
          }
          clientDropdown.style.display = "block";
        }, 220);
      });
      document.addEventListener("click", (e) => {
        if (!clientDropdown.contains(e.target) && e.target !== clientSearchInp) {
          clientDropdown.style.display = "none";
        }
      });
    }

    document.getElementById("btn-iq-client-avulso")?.addEventListener("click", () => {
      if (iqState.doc.isLocked) return;
      iqState.doc.customerProfileId = null;
      iqState.doc.selectedCustomerOpenQuotes = 0;
      iqState.doc.customer = createEmptyDoc().customer;
      syncDomFromDoc();
      markDirty();
      document.getElementById(iqState.doc.customerType === "pj" ? "iq-cli-cnpj" : "iq-cli-nome")?.focus();
    });

    document.getElementById("btn-iq-import-request")?.addEventListener("click", openImportCustomerQuoteModal);
    document.getElementById("btn-iq-open-req-import")?.addEventListener("click", openImportCustomerQuoteModal);
    document.getElementById("btn-iq-import-close")?.addEventListener("click", () => document.getElementById("iq-import-dialog")?.close?.());
    document.getElementById("btn-iq-detach-request")?.addEventListener("click", () => {
      iqState.doc.sourceCustomerQuoteId = null;
      iqState.doc.sourceCustomerQuoteNumber = null;
      syncDomFromDoc();
      markDirty();
    });

    document.getElementById("btn-iq-complete-profile-link")?.addEventListener("click", () => {
      if (iqState.doc?.customerProfileId && root.SJ_CUSTOMERS?.abrirDetalhesCliente) {
        root.SJ_CUSTOMERS.abrirDetalhesCliente(iqState.doc.customerProfileId, true);
      }
    });

    document.getElementById("btn-iq-sync-back-customer")?.addEventListener("click", async () => {
      const pid = iqState.doc?.customerProfileId;
      if (!pid || !root.SJ_SUPABASE?.customers?.atualizarCadastro) return;
      readFormFieldsIntoDoc();
      const c = iqState.doc.customer;
      const nomeExib = iqState.doc.customerType === "pj" ? (c.razaoSocial || c.nome) : c.nome;
      if (!root.confirm(`Deseja atualizar o cadastro do cliente "${nomeExib || "selecionado"}" no banco de dados com estes dados?`)) {
        return;
      }
      const res = await root.SJ_SUPABASE.customers.atualizarCadastro(pid, {
        person_type: iqState.doc.customerType,
        nome: c.nome,
        razao_social: c.razaoSocial,
        nome_fantasia: c.nomeFantasia,
        ie_tipo: c.ieTipo,
        inscricao_estadual: c.inscricaoEstadual,
        contato_nome: c.contatoNome,
        cpf: c.cpf,
        cnpj: c.cnpj,
        telefone: c.telefone,
        cep: c.cep,
        logradouro: c.logradouro,
        numero: c.numero,
        complemento: c.complemento,
        bairro: c.bairro,
        cidade: c.cidade,
        uf: c.uf,
        source: "issued_quote_sync"
      });
      if (res?.sucesso) {
        toast("Cadastro do cliente atualizado no banco!", "success");
        updateClientCompletenessHighlight();
        root.SJ_CUSTOMERS?.onProfilesRealtime?.();
      } else {
        toast(res?.mensagem || "Não foi possível atualizar o cadastro do cliente.", "warning");
      }
    });

    // Máscaras, validação on blur (sem interromper digitação) & CNPJ/CEP lookup
    const cpfInp = document.getElementById("iq-cli-cpf");
    cpfInp?.addEventListener("input", () => {
      cpfInp.value = formatCpf(cpfInp.value);
      cpfInp.removeAttribute("aria-invalid");
      const fb = document.getElementById("iq-cpf-feedback");
      if (fb) fb.textContent = "";
      readFormFieldsIntoDoc();
      updateClientCompletenessHighlight();
      markDirty();
    });
    cpfInp?.addEventListener("blur", () => {
      const dig = onlyDigits(cpfInp.value);
      const fb = document.getElementById("iq-cpf-feedback");
      if (!dig) return;
      const ok = bridge().validarCpfOficial?.(dig);
      if (!ok) {
        cpfInp.setAttribute("aria-invalid", "true");
        if (fb) { fb.textContent = "CPF inválido"; fb.className = "iq-field-feedback is-error"; }
      } else if (fb) {
        fb.textContent = "Válido ✓"; fb.className = "iq-field-feedback is-ok";
      }
      updateClientCompletenessHighlight();
    });

    const cnpjInp = document.getElementById("iq-cli-cnpj");
    cnpjInp?.addEventListener("input", () => {
      cnpjInp.value = formatCnpj(cnpjInp.value);
      cnpjInp.removeAttribute("aria-invalid");
      const fb = document.getElementById("iq-cnpj-feedback");
      if (fb) fb.textContent = "";
      readFormFieldsIntoDoc();
      updateClientCompletenessHighlight();
      markDirty();
    });
    cnpjInp?.addEventListener("blur", () => {
      if (onlyDigits(cnpjInp.value).length === 14) lookupCnpjServer();
    });
    document.getElementById("btn-iq-lookup-cnpj")?.addEventListener("click", lookupCnpjServer);

    const cepInp = document.getElementById("iq-cli-cep");
    cepInp?.addEventListener("input", () => {
      cepInp.value = formatCep(cepInp.value);
      readFormFieldsIntoDoc();
      updateClientCompletenessHighlight();
      markDirty();
    });
    cepInp?.addEventListener("blur", () => {
      if (onlyDigits(cepInp.value).length === 8) lookupCepServer();
    });
    document.getElementById("btn-iq-lookup-cep")?.addEventListener("click", lookupCepServer);

    document.getElementById("iq-cli-ie-tipo")?.addEventListener("change", (e) => {
      const wrap = document.getElementById("iq-cli-ie-wrap");
      if (wrap) wrap.style.display = e.target.value === "contribuinte" ? "flex" : "none";
      readFormFieldsIntoDoc();
      updateClientCompletenessHighlight();
      markDirty();
    });

    // Inputs de cliente & condições sincronizam no input
    ["iq-cli-nome", "iq-cli-razao", "iq-cli-fantasia", "iq-cli-ie", "iq-cli-contato", "iq-cli-telefone", "iq-cli-email", "iq-cli-logradouro", "iq-cli-numero", "iq-cli-complemento", "iq-cli-bairro", "iq-cli-cidade", "iq-cli-uf", "iq-notes", "iq-internal-notes"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        readFormFieldsIntoDoc();
        updateFinancialSummaryUI();
        updateClientCompletenessHighlight();
        markDirty();
      });
    });

    document.getElementById("iq-payment-method")?.addEventListener("change", (e) => {
      const wrap = document.getElementById("iq-payment-installments-wrap");
      if (wrap) wrap.style.display = String(e.target.value || "").includes("Crédito") ? "flex" : "none";
      readFormFieldsIntoDoc();
      markDirty();
    });
    ["iq-payment-installments", "iq-delivery-term", "iq-general-discount-type"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        readFormFieldsIntoDoc();
        updateFinancialSummaryUI();
        markDirty();
      });
    });
    ["iq-freight-amount", "iq-general-discount-value"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", () => {
        readFormFieldsIntoDoc();
        updateFinancialSummaryUI();
        markDirty();
      });
    });
    document.getElementById("btn-iq-quick-5pct")?.addEventListener("click", () => {
      if (iqState.doc.isLocked) return;
      const tSel = document.getElementById("iq-general-discount-type");
      const vInp = document.getElementById("iq-general-discount-value");
      if (tSel) tSel.value = "percent";
      if (vInp) vInp.value = "5";
      readFormFieldsIntoDoc();
      updateFinancialSummaryUI();
      markDirty();
    });

    // Botões de itens
    document.getElementById("btn-iq-add-catalog")?.addEventListener("click", openCatalogPickerModal);
    document.getElementById("btn-iq-catalog-close")?.addEventListener("click", () => document.getElementById("iq-catalog-dialog")?.close?.());
    document.getElementById("btn-iq-catalog-cancel")?.addEventListener("click", () => document.getElementById("iq-catalog-dialog")?.close?.());
    document.getElementById("btn-iq-add-custom")?.addEventListener("click", () => {
      if (iqState.doc.isLocked) return;
      iqState.doc.items.push(createBlankItem({ isCustom: true }));
      renderItemsTable();
      updateFinancialSummaryUI();
      markDirty();
      const rows = document.querySelectorAll("#iq-items-tbody .iq-item-title-input");
      rows[rows.length - 1]?.focus();
    });
    document.getElementById("btn-iq-clear-items")?.addEventListener("click", () => {
      if (iqState.doc.isLocked || iqState.doc.items.length === 0) return;
      if (!confirm("Remover todos os itens deste orçamento?")) return;
      iqState.doc.items = [];
      renderItemsTable();
      updateFinancialSummaryUI();
      markDirty();
    });

    // Ações principais (Resumo lateral & Mobile & Dialog prévia)
    const acaoEmitirEPdf = async () => {
      const ok = iqState.doc.isLocked
        ? true
        : await saveDraftOrEmit(true, Boolean(iqState.doc.createVersionOnSave));
      if (ok) await downloadTimbradoPdf();
    };
    document.getElementById("btn-iq-emit-pdf")?.addEventListener("click", acaoEmitirEPdf);
    document.getElementById("btn-iq-mobile-emit")?.addEventListener("click", acaoEmitirEPdf);
    document.getElementById("btn-iq-save-draft")?.addEventListener("click", () => saveDraftOrEmit(false, Boolean(iqState.doc.createVersionOnSave)));
    document.getElementById("btn-iq-preview")?.addEventListener("click", renderTimbradoPreviewModal);
    document.getElementById("btn-iq-mobile-preview")?.addEventListener("click", renderTimbradoPreviewModal);
    document.getElementById("btn-iq-whatsapp")?.addEventListener("click", sendTimbradoWhatsApp);
    document.getElementById("btn-iq-print")?.addEventListener("click", () => {
      renderTimbradoPreviewModal();
      setTimeout(() => root.print(), 120);
    });

    // Dialog Prévia Timbrada
    document.getElementById("btn-iq-prev-close")?.addEventListener("click", () => document.getElementById("iq-preview-dialog")?.close?.());
    document.getElementById("btn-iq-prev-download-pdf")?.addEventListener("click", acaoEmitirEPdf);
    document.getElementById("btn-iq-prev-whatsapp")?.addEventListener("click", sendTimbradoWhatsApp);
    document.getElementById("btn-iq-prev-print")?.addEventListener("click", () => root.print());

    // Textos padrão reutilizáveis
    document.getElementById("btn-iq-open-defaults")?.addEventListener("click", () => {
      const dlg = document.getElementById("iq-defaults-dialog");
      if (!dlg) return;
      document.getElementById("iq-def-validity").value = String(iqState.defaults.validadeDiasPadrao || 7);
      document.getElementById("iq-def-warranty").value = iqState.defaults.garantiaTexto || "";
      document.getElementById("iq-def-notes").value = iqState.defaults.observacoesPadrao || "";
      if (typeof dlg.showModal === "function") dlg.showModal();
    });
    document.getElementById("btn-iq-defaults-close")?.addEventListener("click", () => document.getElementById("iq-defaults-dialog")?.close?.());
    document.getElementById("btn-iq-defaults-cancel")?.addEventListener("click", () => document.getElementById("iq-defaults-dialog")?.close?.());
    document.getElementById("btn-iq-defaults-save")?.addEventListener("click", async () => {
      const valDias = Math.max(1, Math.min(365, parseInt(document.getElementById("iq-def-validity")?.value, 10) || 7));
      const gar = document.getElementById("iq-def-warranty")?.value.trim() || DEFAULT_TEXTS.garantiaTexto;
      const obs = document.getElementById("iq-def-notes")?.value.trim() || DEFAULT_TEXTS.observacoesPadrao;
      iqState.defaults = { ...iqState.defaults, validadeDiasPadrao: valDias, garantiaTexto: gar, observacoesPadrao: obs };
      try {
        root.localStorage?.setItem(LOCAL_DEFAULTS_KEY, JSON.stringify(iqState.defaults));
      } catch (_) { }
      await root.SJ_SUPABASE?.issuedQuotes?.salvarPadroes?.(iqState.defaults);
      document.getElementById("iq-defaults-dialog")?.close?.();
      toast("Textos padrão atualizados!", "success");
    });

    // Auditoria close
    document.getElementById("btn-iq-audit-close")?.addEventListener("click", () => document.getElementById("iq-audit-dialog")?.close?.());

    // Filtros e Backup do Histórico
    document.getElementById("iq-hist-search")?.addEventListener("input", renderHistoryList);
    document.getElementById("iq-hist-status")?.addEventListener("change", renderHistoryList);
    document.getElementById("iq-hist-period")?.addEventListener("change", renderHistoryList);
    document.getElementById("btn-iq-hist-refresh")?.addEventListener("click", refreshHistoryData);
    document.getElementById("btn-iq-hist-export")?.addEventListener("click", () => {
      if (root.SJ_DB?.backup?.baixarBackupArquivo) {
        root.SJ_DB.backup.baixarBackupArquivo();
        toast("Backup JSON exportado!", "success");
      }
    });
    document.getElementById("iq-hist-import-file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast("Arquivo excede 5 MB.", "warning");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = root.SJ_DB?.backup?.importarJson?.(ev.target.result);
        if (res?.sucesso) {
          toast(`Backup restaurado (${res.totalOrcamentos} orçamentos)!`, "success");
          refreshHistoryData();
        } else {
          toast(res?.mensagem || "Erro ao importar backup.", "warning");
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    // Fallback de light-dismiss para <dialog closedby="any"> no Safari (MWG light-dismiss-a-dialog)
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      document.querySelectorAll("#cms-pane-emitir-orcamento dialog[closedby='any']").forEach((dlg) => {
        dlg.addEventListener("click", (event) => {
          if (event.target !== dlg) return;
          const r = dlg.getBoundingClientRect();
          const inside = r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
          if (!inside) dlg.close();
        });
      });
    }
  }

  root.SJ_ISSUED_QUOTES = {
    abrir: async function (options = {}) {
      bindEventsOnce();
      await loadReusableDefaults();

      if (!iqState.doc) {
        let restored = null;
        try {
          const savedRaw = root.localStorage?.getItem(LOCAL_DRAFT_KEY);
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            if (parsed?.doc && typeof parsed.doc === "object") restored = parsed.doc;
          }
        } catch (_) { }
        iqState.doc = restored || createEmptyDoc();
        iqState.dirty = Boolean(restored);
      }

      syncDomFromDoc();
      switchSubtab(options?.subtab === "historico" ? "historico" : "novo", true);
      refreshHistoryData();
    },

    temAlteracoesNaoSalvas: function () {
      return Boolean(iqState.dirty);
    },

    confirmarSaida: function () {
      if (!iqState.dirty) return true;
      return root.confirm("Você tem alterações não salvas neste orçamento. Deseja sair mesmo assim?");
    },

    selecionarClienteDoBanco: function (picked) {
      if (!picked) return;
      if (!iqState.doc) iqState.doc = createEmptyDoc();
      const cand = mapProfileRowToCandidate(picked);
      applySelectedClientToDoc(cand);
      switchSubtab("novo", true);
    },

    obterParamsTimbradoParaTeste: function (doc) {
      return buildTimbradoParamsFromDoc(doc);
    }
  };
})(typeof window !== "undefined" ? window : globalThis);

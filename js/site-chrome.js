/**
 * COMPONENTE ÚNICO DE CABEÇALHO, MENU MOBILE, BARRA INFERIOR & RODAPÉ — LOJA SJ 3D
 * ==============================================================================
 * Centraliza a barra de avisos, header, drawer mobile, barra inferior mobile,
 * rodapé unificado em 3 colunas (com acordeão no celular) e o link da Comunidade VIP.
 */
(function () {
  const FALLBACK_VIP_URL = "https://chat.whatsapp.com/B5XUuxuVaY59cUdVUvd5ea";
  const VIP_DISMISS_STORAGE_KEY = "sj_vip_internal_dismiss_until_v1";
  const VIP_DISMISS_DAYS = 30;

  function escaparHtmlChrome(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function obterLinkComunidadeVip() {
    const raw =
      (window.SITE_DATA &&
        window.SITE_DATA.loja &&
        window.SITE_DATA.loja.comunidadeVipUrl) ||
      FALLBACK_VIP_URL;
    try {
      const u = new URL(String(raw), window.location.origin);
      if (u.protocol === "https:" || u.protocol === "http:") {
        return u.href;
      }
    } catch (_) {
      // Fallback seguro
    }
    return FALLBACK_VIP_URL;
  }

  function bannerVipInternoDispensado() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(VIP_DISMISS_STORAGE_KEY);
      if (!raw) return false;
      const exp = Number(raw);
      return Number.isFinite(exp) && Date.now() < exp;
    } catch (_) {
      return false;
    }
  }

  function dispensarBannerVipInterno() {
    try {
      if (window.localStorage) {
        const exp = Date.now() + VIP_DISMISS_DAYS * 24 * 60 * 60 * 1000;
        window.localStorage.setItem(VIP_DISMISS_STORAGE_KEY, String(exp));
      }
    } catch (_) {
      // Ignora bloqueio de storage
    }
  }

  function renderHeaderHTML(opts = {}) {
    const isStoreRoot = Boolean(opts.isStoreRoot);
    const vipUrl = escaparHtmlChrome(obterLinkComunidadeVip());
    const homeHref = isStoreRoot ? "/" : "/";
    const catHref = (cat) => `/?categoria=${encodeURIComponent(cat)}`;

    return `
  <header class="site-header">
    <!-- Barra de Avisos Discreta (1 aviso por vez em rotação suave + fechar) -->
    <div class="top-promo-marquee-bar sj-announcement-bar" id="top-promo-marquee-bar" role="region"
      aria-label="Avisos da Loja SJ 3D">
      <div class="container sj-announcement-inner">
        <button type="button" class="sj-announcement-rotator" id="top-promo-rotator-btn" data-nav-cat="filamentos"
          aria-live="polite">
          <span class="sj-announcement-dot" aria-hidden="true"></span>
          <span class="sj-announcement-text" id="top-promo-rotator-text">Filamento PLA a partir de <strong>R$ 79,90</strong></span>
        </button>
        <button type="button" class="sj-announcement-close" id="top-promo-close-btn" aria-label="Fechar aviso"
          title="Fechar aviso">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <div class="container header-inner">
      <button type="button" class="mobile-menu-toggle-btn" id="mobile-menu-toggle-btn"
        aria-label="Abrir Menu de Navegação" aria-expanded="false" aria-controls="mobile-nav-drawer">
        <svg class="hamburger-icon-open" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
        <span class="mobile-menu-toggle-text">Menu</span>
      </button>

      <a href="${homeHref}" class="header-logo" data-nav-cat="home" aria-label="Loja SJ 3D — Ir para o início">
        <img src="assets/img/logo-horizontal.png" alt="Loja SJ 3D" width="128" height="35" class="header-logo-img" />
      </a>

      <nav class="header-nav sj-nav-dock" aria-label="Navegação Principal">
        <a href="${catHref("impressoras")}" class="header-nav-link" data-nav-cat="impressoras">
          <svg class="nav-pill-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span>Impressoras</span>
        </a>

        <a href="${catHref("filamentos")}" class="header-nav-link" data-nav-cat="filamentos">
          <svg class="nav-pill-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="3" x2="12" y2="9"></line>
          </svg>
          <span>Filamentos</span>
        </a>

        <a href="${catHref("pecas")}" class="header-nav-link" data-nav-cat="pecas">
          <svg class="nav-pill-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
          </svg>
          <span>Peças</span>
        </a>

        <a href="${catHref("manutencao")}" class="header-nav-link" data-nav-cat="manutencao">
          <svg class="nav-pill-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
          <span>Serviços</span>
        </a>

        <a href="/calculadora" class="header-nav-link header-nav-calc"
          title="Calculadora de Precificação 3D — Loja SJ 3D">
          <svg class="nav-pill-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="18"></line>
            <path d="M16 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 14h.01"></path>
            <path d="M8 14h.01"></path>
            <path d="M12 18h.01"></path>
            <path d="M8 18h.01"></path>
          </svg>
          <span>Calculadora</span>
          <span class="nav-calc-badge">Novo</span>
        </a>

        <a href="${vipUrl}" target="_blank" rel="noopener" class="header-nav-link sj-nav-community-link"
          title="Entrar na Comunidade VIP no WhatsApp">
          <span class="sj-community-pulse-dot" aria-hidden="true"></span>
          <span>Comunidade</span>
        </a>
      </nav>

      <div class="header-icons">
        <button type="button" class="icon-btn sj-header-circle-btn" id="toggle-search-btn" aria-label="Buscar no catálogo"
          title="Buscar no catálogo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        <button type="button" class="icon-btn sj-header-circle-btn header-fav-btn-wrap" id="header-fav-btn"
          aria-label="Meus Favoritos" title="Ver meus produtos favoritados">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span class="bag-badge" id="fav-count-badge" style="display: none;">0</span>
        </button>

        <div class="sj-acct-anchor" id="store-acct-anchor">
          <button type="button" class="header-account-pill-btn" id="header-account-btn" aria-label="Área do Cliente"
            aria-haspopup="menu" aria-expanded="false" aria-controls="store-user-popover" title="Acessar Minha Conta / Cadastrar">
            <span class="account-pill-avatar" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </span>
            <span id="header-account-btn-text">Entrar</span>
          </button>
          <div id="store-user-popover" class="sj-acct-popover" role="menu" aria-labelledby="header-account-btn">
            <div class="sj-acct-popover-head">
              <div class="sj-acct-popover-title" id="store-popover-user-name">Minha Conta</div>
              <div class="sj-acct-popover-email" id="store-popover-user-email">—</div>
            </div>
            <a href="/conta" class="sj-acct-menu-item" role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              <span>Minha conta</span>
            </a>
            <a href="/calculadora" class="sj-acct-menu-item" role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>
              <span>Calculadora 3D</span>
            </a>
            <a href="/admin" id="store-popover-admin-link" class="sj-acct-menu-item" role="menuitem" style="display: none;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Painel Admin</span>
            </a>
            <hr class="sj-acct-sep" />
            <button type="button" id="btn-store-menu-logout" class="sj-acct-menu-item is-danger" role="menuitem">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span>Sair</span>
            </button>
          </div>
        </div>

        <button type="button" class="icon-btn bag-btn-wrap sj-header-cart-pill" id="header-bag-btn" aria-label="Ver Seu Pedido"
          title="Abrir Carrinho / Seu Pedido">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <span class="bag-badge" id="cart-count-badge">0</span>
        </button>
      </div>
    </div>

    ${isStoreRoot ? `
    <div class="search-bar-Drop" id="search-bar-drop">
      <div class="container">
        <div class="search-bar-inner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#71717a" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="search" id="global-search-input" autocomplete="off"
            placeholder="Buscar por cor, código (ex: CÓD. 103), Bambu Lab, Masterprint, A1 Mini, P2S, Snapmaker U1..." />
          <button type="button" id="global-search-clear-btn" class="inline-search-clear-btn" aria-label="Limpar busca"
            title="Limpar busca" style="display: none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="search-live-dropdown" id="search-live-dropdown" style="display: none;" role="region"
          aria-label="Sugestões rápidas de produtos e cores"></div>
      </div>
    </div>
    ` : ""}
  </header>

  <!-- MENU MOBILE FULLSCREEN / LATERAL (COMUNIDADE VIP NO TOPO + SEM INÍCIO DUPLICADO) -->
  <div class="mobile-nav-overlay" id="mobile-nav-overlay" aria-hidden="true"></div>
  <aside class="mobile-nav-drawer" id="mobile-nav-drawer" role="dialog" aria-modal="true"
    aria-label="Menu de Navegação Principal" aria-hidden="true">
    <div class="mobile-drawer-header">
      <a href="${homeHref}" data-nav-cat="home" class="mobile-drawer-brand" aria-label="Ir para o início">
        <img src="assets/img/logo-horizontal.png" alt="Loja SJ 3D" width="110" height="28" class="mobile-drawer-logo" />
        <span class="mobile-drawer-badge">Umuarama • PR</span>
      </a>
      <button type="button" class="mobile-drawer-close-btn" id="mobile-drawer-close-btn" aria-label="Fechar menu"
        title="Fechar menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <!-- Comunidade VIP no TOPO absoluto do menu mobile (acima de Departamentos) -->
    <a href="${vipUrl}" target="_blank" rel="noopener"
      class="mobile-drawer-comm-banner sj-drawer-vip-top" title="Entrar na Comunidade VIP no WhatsApp">
      <div class="comm-banner-left">
        <span class="sj-community-pulse-dot" aria-hidden="true"></span>
        <div class="comm-banner-text">
          <strong>Comunidade VIP no WhatsApp</strong>
          <small>Ofertas relâmpago, cupons e novidades</small>
        </div>
      </div>
      <span class="comm-banner-btn">Entrar</span>
    </a>

    <div class="mobile-drawer-body">
      <div class="mobile-drawer-section-title">Departamentos</div>
      <nav class="mobile-drawer-nav" aria-label="Categorias Mobile">
        <button type="button" class="mobile-drawer-nav-item" data-nav-cat="impressoras">
          <span class="drawer-nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          </span>
          <span class="drawer-nav-title">Impressoras 3D</span>
          <span class="drawer-nav-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" class="mobile-drawer-nav-item" data-nav-cat="filamentos">
          <span class="drawer-nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="3" x2="12" y2="9"></line></svg>
          </span>
          <span class="drawer-nav-title">Filamentos 3D</span>
          <span class="drawer-nav-badge">130+ cores</span>
          <span class="drawer-nav-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" class="mobile-drawer-nav-item" data-nav-cat="pecas">
          <span class="drawer-nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line></svg>
          </span>
          <span class="drawer-nav-title">Peças e upgrades</span>
          <span class="drawer-nav-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" class="mobile-drawer-nav-item" data-nav-cat="manutencao">
          <span class="drawer-nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </span>
          <span class="drawer-nav-title">Serviços e manutenção</span>
          <span class="drawer-nav-arrow" aria-hidden="true">›</span>
        </button>

        <button type="button" class="mobile-drawer-nav-item" data-nav-cat="todos">
          <span class="drawer-nav-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
          </span>
          <span class="drawer-nav-title">Catálogo completo</span>
          <span class="drawer-nav-arrow" aria-hidden="true">›</span>
        </button>
      </nav>

      <div class="mobile-drawer-section-title">Ferramenta</div>
      <div class="mobile-drawer-tools">
        <a href="/calculadora" class="mobile-drawer-tool-card"
          title="Calculadora de Precificação 3D — Loja SJ 3D">
          <div class="tool-icon-box" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line></svg>
          </div>
          <div class="tool-info-box">
            <div class="tool-title-row">
              <strong>Calculadora 3D</strong>
              <span class="tool-badge-new">Novo</span>
            </div>
            <small>Custos, taxas e margem de impressão 3D</small>
          </div>
          <span class="tool-arrow" aria-hidden="true">→</span>
        </a>
      </div>

      <div class="mobile-drawer-section-title">Atendimento</div>
      <div class="mobile-drawer-contact-list">
        <a href="https://wa.me/5544991351318" target="_blank" rel="noopener" class="drawer-contact-item">
          <span class="contact-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          </span>
          <div class="contact-info">
            <strong>WhatsApp: (44) 99135-1318</strong>
            <small>Atendimento direto e suporte técnico</small>
          </div>
        </a>

        <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="drawer-contact-item">
          <span class="contact-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </span>
          <div class="contact-info">
            <strong>Instagram: @lojasj3d</strong>
            <small>Novidades, impressões e sorteios</small>
          </div>
        </a>

        <a href="https://share.google/0WwPhjFx69b3V9sU1" target="_blank" rel="noopener" class="drawer-contact-item">
          <span class="contact-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </span>
          <div class="contact-info">
            <strong>Showroom em Umuarama</strong>
            <small>Av. Portugal, 6759 — Pronta Entrega</small>
          </div>
        </a>
      </div>
    </div>

    <div class="mobile-drawer-footer">
      <div class="drawer-footer-text">
        <span>© 2026 Loja SJ 3D • CNPJ: 66.275.129/0001-10</span>
        <small>Revenda Autorizada Bambu Lab &amp; Masterprint</small>
      </div>
    </div>
  </aside>
`;
  }

  function renderMobileBottomNavHTML() {
    return `
  <nav class="sj-mobile-bottom-nav" id="sj-mobile-bottom-nav" aria-label="Atalhos mobile">
    <button type="button" class="sj-mbnav-item active" data-mbnav="home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      <span>Início</span>
    </button>
    <button type="button" class="sj-mbnav-item" data-mbnav="search">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <span>Buscar</span>
    </button>
    <a href="/conta?aba=favoritos" class="sj-mbnav-item" data-mbnav="favoritos">
      <span class="sj-mbnav-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span class="sj-mbnav-badge" id="mobile-bottom-fav-badge" style="display: none;">0</span>
      </span>
      <span>Favoritos</span>
    </a>
    <a href="/conta?aba=carrinho" class="sj-mbnav-item" data-mbnav="carrinho" id="mobile-bottom-cart-link">
      <span class="sj-mbnav-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
        <span class="sj-mbnav-badge" id="mobile-bottom-cart-badge" style="display: none;">0</span>
      </span>
      <span>Carrinho</span>
    </a>
    <a href="/conta" class="sj-mbnav-item" data-mbnav="conta">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      <span>Conta</span>
    </a>
  </nav>
`;
  }

  function obterRedesCentralizadas() {
    const loja = (window.SITE_DATA && window.SITE_DATA.loja) || {};
    const limparUrlSegura = (raw, fallback) => {
      try {
        const u = new URL(String(raw || fallback), window.location.origin);
        if (u.protocol === "https:" || u.protocol === "http:") return u.href;
      } catch (_) {}
      return fallback;
    };
    const waNum = String(loja.whatsapp || "5544991351318").replace(/\D/g, "") || "5544991351318";
    const waFmt = loja.whatsappFormatado || "(44) 99135-1318";
    const mapsFallback = "https://share.google/0WwPhjFx69b3V9sU1";
    return {
      instagramUrl: limparUrlSegura(loja.instagramUrl, "https://www.instagram.com/lojasj3d/"),
      whatsappUrl: `https://wa.me/${waNum}`,
      whatsappFormatado: waFmt,
      mapsUrl: limparUrlSegura(loja.googleMeuNegocioUrl, mapsFallback)
    };
  }

  function renderFooterHTML(opts = {}) {
    const isStoreRoot = Boolean(opts.isStoreRoot);
    const redes = obterRedesCentralizadas();
    const catHref = (cat) => `/?categoria=${encodeURIComponent(cat)}`;
    const homeFooterHref = "/";
    const privHref = isStoreRoot ? "#modal-privacy-policy" : "/privacidade";
    const lgpdHref = isStoreRoot ? "#modal-lgpd-titular-request" : "/?lgpd=1";
    const cookieHref = isStoreRoot ? "#modal-cookie-preferences" : "/?cookies=1";

    return `
  <footer class="site-footer sj-unified-footer" id="rodape-ajuda">
    <div class="container footer-container">
      <!-- 4 Colunas alinhadas na mesma linha no desktop (Marca + Loja + Atendimento + Institucional) -->
      <div class="footer-main-grid sj-footer-cols-4">
        <div class="sj-footer-brand-col">
          <a href="${homeFooterHref}" data-nav-cat="home" class="footer-logo-row" aria-label="Loja SJ 3D — Página inicial">
            <img src="assets/img/logo-horizontal.png" alt="Loja SJ 3D" width="120" height="32" class="footer-logo-img" />
          </a>
          <p class="footer-desc-text">
            Revenda autorizada oficial Bambu Lab &amp; Masterprint em Umuarama - PR.
          </p>

          <div class="sj-footer-social-row" aria-label="Redes sociais e localização">
            <a href="${escaparHtmlChrome(redes.instagramUrl)}" target="_blank" rel="noopener noreferrer"
              class="sj-social-circle-btn is-instagram" aria-label="Instagram @lojasj3d" title="Instagram @lojasj3d">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>

            <a href="${escaparHtmlChrome(redes.whatsappUrl)}" target="_blank" rel="noopener noreferrer"
              class="sj-social-circle-btn is-whatsapp" aria-label="WhatsApp ${escaparHtmlChrome(redes.whatsappFormatado)}" title="WhatsApp ${escaparHtmlChrome(redes.whatsappFormatado)}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>

            <a href="${escaparHtmlChrome(redes.mapsUrl)}" target="_blank" rel="noopener noreferrer"
              class="sj-social-circle-btn is-maps" aria-label="Localização da Loja SJ 3D no Google Maps" title="Ver rota no Google Maps">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </a>
          </div>
        </div>

        <details class="sj-footer-accordion" open>
          <summary class="sj-footer-col-summary">
            <span>Loja</span>
          </summary>
          <ul class="footer-nav-links sj-footer-accordion-body">
            <li><a href="${catHref("impressoras")}" data-nav-cat="impressoras">Impressoras 3D</a></li>
            <li><a href="${catHref("filamentos")}" data-nav-cat="filamentos">Filamentos</a></li>
            <li><a href="${catHref("pecas")}" data-nav-cat="pecas">Peças e upgrades</a></li>
            <li><a href="${catHref("manutencao")}" data-nav-cat="manutencao">Serviços e manutenção</a></li>
            <li><a href="${catHref("todos")}" data-nav-cat="todos">Catálogo completo</a></li>
            <li><a href="/calculadora" class="footer-calc-link">Calculadora 3D <span class="footer-mini-tag">Novo</span></a></li>
          </ul>
        </details>

        <details class="sj-footer-accordion" open>
          <summary class="sj-footer-col-summary">
            <span>Atendimento</span>
          </summary>
          <ul class="footer-nav-links sj-footer-accordion-body">
            <li>
              <a href="${escaparHtmlChrome(redes.whatsappUrl)}" target="_blank" rel="noopener noreferrer">
                WhatsApp ${escaparHtmlChrome(redes.whatsappFormatado)}
              </a>
            </li>
            <li>
              <span class="sj-footer-note-text">Av. Portugal, 6759 — Zona I-A, Umuarama - PR</span>
            </li>
            <li>
              <a href="${escaparHtmlChrome(redes.mapsUrl)}" target="_blank" rel="noopener noreferrer">
                Ver rota no Google Maps
              </a>
            </li>
            <li><a href="/conta">Minha conta e pedidos</a></li>
            <li><span class="sj-footer-note-text">Retirada na loja e entrega em Umuarama - PR</span></li>
          </ul>
        </details>

        <details class="sj-footer-accordion" open>
          <summary class="sj-footer-col-summary">
            <span>Institucional</span>
          </summary>
          <ul class="footer-nav-links sj-footer-accordion-body">
            <li>
              <a href="${privHref}" ${isStoreRoot ? 'id="footer-privacy-link"' : ""}
                title="Política de Privacidade e Proteção de Dados LGPD">Privacidade &amp; LGPD</a>
            </li>
            <li>
              <a href="${lgpdHref}" ${isStoreRoot ? 'id="footer-lgpd-request-link"' : ""}
                title="Solicitar ou Apagar Meus Dados (LGPD Art. 18)">Direitos do titular (LGPD)</a>
            </li>
            <li>
              <a href="${cookieHref}" ${isStoreRoot ? 'id="btn-footer-cookie-pref"' : ""}
                title="Gerenciar preferências de cookies e privacidade">Preferências de cookies</a>
            </li>
          </ul>
        </details>
      </div>

      <!-- Linha final única com CNPJ e direitos autorais em alto contraste -->
      <div class="footer-bottom-bar sj-footer-bottom-aa">
        <span class="footer-copy-text">© 2026 Loja SJ 3D • CNPJ 66.275.129/0001-10 • Umuarama / PR • Todos os direitos reservados</span>
      </div>
    </div>
  </footer>
`;
  }

  function renderizarBannerVipInternoHtml() {
    return "";
  }

  function vincularBannerVipInterno() {
    return;
  }

  function sincronizarAcordeaoRodape() {
    const isMobile = window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
    document.querySelectorAll(".sj-footer-accordion").forEach((det) => {
      if (isMobile) {
        if (!det.dataset.userToggled) {
          det.removeAttribute("open");
        }
      } else {
        det.setAttribute("open", "");
      }
    });
  }

  let chromeMontado = false;

  function inicializarChromeStandalone() {
    // Em páginas fora da loja principal (ex.: privacidade.html, conta.html), links de categoria redirecionam para index.html#<cat>
    document
      .querySelectorAll(".site-header [data-nav-cat], #mobile-nav-drawer [data-nav-cat], #rodape-ajuda [data-nav-cat]")
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          if (document.getElementById("home-landing-view")) return; // SPA principal trata via app.js
          e.preventDefault();
          const cat = el.dataset.navCat || "home";
          window.location.href = cat === "home" ? "/" : `/?categoria=${encodeURIComponent(cat)}`;
        });
      });

    if (!document.getElementById("home-landing-view")) {
      document.getElementById("toggle-search-btn")?.addEventListener("click", () => {
        window.location.href = "index.html#todos";
      });
      document.getElementById("header-fav-btn")?.addEventListener("click", () => {
        window.location.href = "/conta?aba=favoritos";
      });
      document.getElementById("header-bag-btn")?.addEventListener("click", () => {
        window.location.href = "/conta?aba=carrinho";
      });
      document.getElementById("header-account-btn")?.addEventListener("click", () => {
        window.location.href = "/conta";
      });
      document.querySelectorAll("#sj-mobile-bottom-nav [data-mbnav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const a = btn.dataset.mbnav;
          if (a === "home") {
            e.preventDefault();
            window.location.href = "index.html#home";
          } else if (a === "search") {
            e.preventDefault();
            window.location.href = "index.html#todos";
          }
        });
      });
      const drawer = document.getElementById("mobile-nav-drawer");
      const overlay = document.getElementById("mobile-nav-overlay");
      const toggleBtn = document.getElementById("mobile-menu-toggle-btn");
      const fechar = () => {
        drawer?.classList.remove("is-open");
        overlay?.classList.remove("is-open");
        drawer?.setAttribute("aria-hidden", "true");
        toggleBtn?.setAttribute("aria-expanded", "false");
      };
      toggleBtn?.addEventListener("click", () => {
        drawer?.classList.add("is-open");
        overlay?.classList.add("is-open");
        drawer?.setAttribute("aria-hidden", "false");
        toggleBtn?.setAttribute("aria-expanded", "true");
      });
      document.getElementById("mobile-drawer-close-btn")?.addEventListener("click", fechar);
      overlay?.addEventListener("click", fechar);
    }
  }

  function montarChrome() {
    if (chromeMontado) return;
    const isStoreRoot = Boolean(document.getElementById("home-landing-view"));
    const headerSlot = document.getElementById("sj-site-header-slot");
    const mobileBottomSlot = document.getElementById("sj-mobile-bottom-slot");
    const footerSlot = document.getElementById("sj-site-footer-slot");
    if (!headerSlot && !mobileBottomSlot && !footerSlot) return;
    chromeMontado = true;

    if (headerSlot) {
      headerSlot.outerHTML = renderHeaderHTML({ isStoreRoot });
    }
    if (mobileBottomSlot) {
      mobileBottomSlot.outerHTML = renderMobileBottomNavHTML();
    }
    if (footerSlot) {
      footerSlot.outerHTML = renderFooterHTML({ isStoreRoot });
    }

    document.querySelectorAll(".sj-footer-accordion > summary").forEach((sum) => {
      sum.addEventListener("click", (e) => {
        const isDesktop = window.matchMedia && window.matchMedia("(min-width: 641px)").matches;
        if (isDesktop) {
          e.preventDefault();
          return;
        }
        const det = sum.parentElement;
        if (det) det.dataset.userToggled = "1";
      });
    });

    sincronizarAcordeaoRodape();
    window.addEventListener("resize", sincronizarAcordeaoRodape);
    inicializarChromeStandalone();
  }

  window.SJ_SITE_CHROME = {
    obterLinkComunidadeVip,
    renderHeaderHTML,
    renderFooterHTML,
    renderMobileBottomNavHTML,
    renderizarBannerVipInternoHtml,
    vincularBannerVipInterno,
    bannerVipInternoDispensado,
    dispensarBannerVipInterno,
    montarChrome
  };

  if (
    document.getElementById("sj-site-header-slot") ||
    document.getElementById("sj-site-footer-slot") ||
    document.getElementById("sj-mobile-bottom-slot")
  ) {
    montarChrome();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montarChrome);
  } else {
    montarChrome();
  }
})();

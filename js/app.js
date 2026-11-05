/**
 * LÓGICA DO CATÁLOGO COMPLETO — LOJA SJ 3D (UMUARAMA - PR)
 * =====================================================================
 * - Aplica o estilo "Monte o Seu Combo / Caixa" para TODO o catálogo:
 *   1. Filamentos (com escolha entre Bambu Lab e MaxPrint no filtro e dentro do card!)
 *   2. Impressoras 3D (A1 Mini, A1 Mini Combo, A1 Normal, A1 Combo, P2S, Snapmaker)
 *   3. Peças & Acessórios (Hotends, Placas PEI, Extrusora/PTFE)
 *   4. Manutenção & Assistência Técnica (Preventiva, Corretiva, Upgrades)
 * - Caixa Lateral ("Seu Carrinho") funcionando ao vivo para todos os produtos.
 */

(function () {
  const state = {
    categoriaMenu: "home", // "home", "filamentos", "impressoras", "pecas", "manutencao", "todos"
    marcaFilamentoFiltro: "todos", // "todos", "Bambu Lab", "MaxPrint"
    busca: "",
    marcaNoCardOverride: {},
    itensCaixa: [],
    heroSlideAtivo: 0,
    heroTimer: null,
    abaImpressoraHome: "todas",
    // Hub Organizado de Filamentos (Separação Clara MaxPrint vs Bambu Lab + Extensão Completa)
    hubFilamentoMarcaAtiva: "MaxPrint", // "MaxPrint" ou "Bambu Lab"
    hubFilamentoMaterialMaxPrint: "fil-pla-maxprint", // "fil-pla-maxprint", "fil-silk-maxprint", "fil-petg-maxprint", "fil-tpu-maxprint", "fil-abs-especiais", "todos"
    hubFilamentoFiltroBambu: "todos", // "todos", "carretel", "refil"
    hubFilamentoAbertoHome: false, // Na Home começa com os 2 grandes portais e abre a extensão ao clicar
    // Sistema de Orçamento Timbrado Oficial Grupo SJ & Login Google
    usuarioGoogle: null,
    itensOrcamento: [],
    orcamentoMetadados: null,
    callbackPosLoginGoogle: null,
    emissorAberto: false,
    historicoFiltroStatus: "todos",
    historicoBusca: ""
  };

  const secoesDefinicao = [
    {
      id: "filamentos",
      titulo: "Filamentos 3D — Catálogo Oficial (Bambu Lab & Masterprint)",
      subtitulo: "Clique nas bolinhas de cor ou use o seletor para ver o acabamento, código e valor"
    },
    {
      id: "impressoras",
      titulo: "Impressoras 3D — Bambu Lab & Snapmaker U1",
      subtitulo: "A1 Mini, A1 Mini Combo, A1, A1 Combo, P2S Combo e Snapmaker U1"
    },
    {
      id: "pecas",
      titulo: "Peças de Reposição & Acessórios Originais",
      subtitulo: "Hotends Quick-Swap, Placas PEI Dupla Face, Engrenagens e Tubos PTFE"
    },
    {
      id: "manutencao",
      titulo: "Manutenção Especializada & Assistência Técnica",
      subtitulo: "Revisão preventiva, corretiva, desentupimento e calibração em Umuarama e Região"
    }
  ];

  const STORAGE_KEY_PEDIDO = "lojasj3d_pedido_v1";

  function carregarPedidoSalvo() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY_PEDIDO);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.itensCaixa = parsed;
        }
      }
    } catch (_) {
      // Ignora caso localStorage esteja indisponível
    }
  }

  function salvarPedidoNoStorage() {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_PEDIDO, JSON.stringify(state.itensCaixa));
      }
    } catch (_) {
      // Ignora caso localStorage esteja indisponível
    }
  }

  // Calcula automaticamente os cupons da campanha "Sorteio A1 Mini (20 de Dezembro)"
  function calcularCuponsSorteio() {
    let cuponsImpressoras = 0;
    let valorFilamentosEPecas = 0;

    state.itensCaixa.forEach((item) => {
      if (String(item.id || "").startsWith("imp-")) {
        cuponsImpressoras += 10 * Number(item.qtd || 1);
      } else if (item.isFilamento || String(item.id || "").startsWith("peca-")) {
        valorFilamentosEPecas += Number(item.precoUnitario || 0) * Number(item.qtd || 1);
      }
    });

    const cuponsFilamentosPecas = Math.min(10, Math.floor(valorFilamentosEPecas / 60));
    const totalCuponsCompra = cuponsImpressoras + cuponsFilamentosPecas;
    const restoParaProximo = 60 - (valorFilamentosEPecas % 60);
    const faltaParaProximo =
      cuponsFilamentosPecas < 10 && restoParaProximo > 0 && restoParaProximo <= 60
        ? restoParaProximo
        : 0;
    const progressoPct =
      cuponsFilamentosPecas >= 10
        ? 100
        : Math.min(100, Math.round(((valorFilamentosEPecas % 60) / 60) * 100));

    return {
      cuponsImpressoras,
      cuponsFilamentosPecas,
      totalCuponsCompra,
      valorFilamentosEPecas,
      faltaParaProximo,
      progressoPct
    };
  }

  function calcularTotalKgFilamentos() {
    return state.itensCaixa
      .filter((i) => i.isFilamento)
      .reduce((acc, item) => acc + item.qtd, 0);
  }

  function calcularTotalItensGeral() {
    return state.itensCaixa.reduce((acc, item) => acc + item.qtd, 0);
  }

  // 1. Controla a barra rápida de marcas e busca (exibe filtro de marca apenas em Filamentos ou Todos)
  function atualizarControlesTopo() {
    const topControls = document.getElementById("filament-top-controls");
    if (!topControls) return;
    topControls.style.display = "flex";
    const brandLeft = topControls.querySelector(".brand-selector-left");
    if (brandLeft) {
      const mostrarFiltroMarca =
        state.categoriaMenu === "filamentos" || state.categoriaMenu === "todos";
      brandLeft.style.display = mostrarFiltroMarca ? "flex" : "none";
      topControls.classList.toggle("only-search", !mostrarFiltroMarca);
    }
  }

  function obterPaletaPorChave(chave, isBambuOverride) {
    if (isBambuOverride) return window.SITE_DATA.coresBambuLab;
    switch (chave) {
      case "bambu":
        return window.SITE_DATA.coresBambuLab;
      case "plasilk":
        return window.SITE_DATA.coresPlaSilk;
      case "petg":
        return window.SITE_DATA.coresPetg;
      case "tpu":
        return window.SITE_DATA.coresTpu;
      case "absespeciais":
        return window.SITE_DATA.coresAbsEspeciais;
      case "maxprint":
      default:
        return window.SITE_DATA.coresMaxPrint;
    }
  }

  function formatarMoedaBR(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  // Sistema de Notificações Visuais (Toasts UI/UX Pro Max)
  function mostrarToast(mensagem, tipo = "success", opcoes = {}) {
    const container = document.getElementById("sj-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `sj-toast toast-${tipo}`;

    const spanTxt = document.createElement("span");
    spanTxt.innerHTML = mensagem;
    toast.appendChild(spanTxt);

    if (opcoes.acaoTexto && typeof opcoes.onClick === "function") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sj-toast-action-btn";
      btn.textContent = opcoes.acaoTexto;
      btn.addEventListener("click", () => {
        toast.remove();
        opcoes.onClick();
      });
      toast.appendChild(btn);
    }

    container.appendChild(toast);

    const duracao = opcoes.duracao || 3600;
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-8px)";
        toast.style.transition = "all 0.2s ease";
        setTimeout(() => toast.remove(), 220);
      }
    }, duracao);
  }

  function abrirGavetaPedido() {
    const overlay = document.getElementById("cart-drawer-overlay");
    if (!overlay) return;
    atualizarCaixaLateral();
    overlay.style.display = "flex";
  }

  function fecharGavetaPedido() {
    const overlay = document.getElementById("cart-drawer-overlay");
    if (overlay) overlay.style.display = "none";
  }

  function enviarPedidoParaWhatsApp() {
    const { whatsapp } = window.SITE_DATA.loja;
    if (state.itensCaixa.length === 0) {
      mostrarToast("Adicione pelo menos 1 item ao seu pedido antes de enviar!", "warning");
      return;
    }

    const totalKgFil = calcularTotalKgFilamentos();
    const valorTotalEstimado = state.itensCaixa.reduce(
      (acc, item) => acc + Number(item.precoUnitario || 0) * item.qtd,
      0
    );
    const temSobConsulta = state.itensCaixa.some((i) => Number(i.precoUnitario || 0) === 0);
    const resumoCupons = calcularCuponsSorteio();

    const linhas = state.itensCaixa.map((i) => {
      const precoStr =
        i.precoUnitario > 0
          ? ` — *${formatarMoedaBR(i.precoUnitario * i.qtd)}*`
          : ` — *(Valor sob consulta)*`;
      return `• ${i.qtd}x *${i.nome}* (${i.detalhe1} | ${i.detalhe2})${precoStr}`;
    });

    const resumoPeso =
      totalKgFil > 0 ? `\n*Total de Filamentos:* ${totalKgFil} kg` : "";
    const resumoValor =
      valorTotalEstimado > 0
        ? `\n*Total Estimado:* ${formatarMoedaBR(valorTotalEstimado)}${temSobConsulta ? " (+ itens sob consulta)" : ""}`
        : "";
    const resumoCuponsStr =
      resumoCupons.totalCuponsCompra > 0
        ? `\n*🎟️ Sorteio A1 Mini:* ${resumoCupons.totalCuponsCompra} ${
            resumoCupons.totalCuponsCompra === 1 ? "cupom gerado" : "cupons gerados"
          } (+3 grátis retirando no balcão!)`
        : "";

    const msg = encodeURIComponent(
      `Olá *Loja SJ 3D*! Montei meu pedido no catálogo do site:\n\n` +
        `${linhas.join("\n")}${resumoPeso}${resumoValor}${resumoCuponsStr}\n\n` +
        `Gostaria de confirmar a disponibilidade e finalizar o pedido!`
    );

    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
  }

  // Retorna a configuração atualizada do Banner Promocional (editável via /admin)
  function obterConfigBannerPromocao() {
    const padrao = {
      ativo: true,
      exibirBannerSecaoImpressoras: true,
      exibirCuponsCarrinho: true,
      estilo: "sorteio",
      badge: "A MAIOR BLACK FRIDAY DA LOJA SJ",
      dataSorteio: "SORTEIO: 20 DE DEZEMBRO (DOMINGO) • LIVE AO VIVO",
      tituloKicker: "GRANDE PRÊMIO DE NATAL LOJA SJ 3D",
      tituloPrincipal: "SORTEIO <em>A1 MINI</em>",
      subtituloPremio: "+ KIT COM 4 KG DE FILAMENTOS",
      precoDestaque: "Ganhe até 10 cupons na compra da sua Impressora 3D!",
      imagemFundo: "assets/produtos/banner-sorteio-natal-wide.jpg",
      btn1Texto: "Garantir Meus Cupons no WhatsApp →",
      btn1Url:
        "https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20o%20banner%20no%20site%20e%20quero%20garantir%20meus%20cupons%20para%20o%20Sorteio%20A1%20Mini%20do%20dia%2020%20de%20Dezembro!",
      btn2Texto: "Seguir @lojasj3d",
      btn2Url: "https://www.instagram.com/lojasj3d/",
      regrasCards: [
        {
          tag: "1️⃣ 3 CUPONS GRÁTIS",
          titulo: "Retirada Presencial (Por CPF)",
          texto:
            'Siga <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="raffle-insta-link">@lojasj3d</a> (1) + visite a loja (2) = <strong>3 cupons grátis</strong> sem compra!'
        },
        {
          tag: "2️⃣ FILAMENTOS E PEÇAS",
          titulo: "1 Cupom a cada R$ 60",
          texto:
            "Compras a partir de R$ 60 garantem <strong>1 cupom a cada R$ 60 gastos</strong> (até 10/compra)."
        },
        {
          tag: "🏆 IMPRESSORA 3D",
          titulo: "10 Cupons Imediatos",
          texto:
            "Na compra de <strong>qualquer Impressora 3D</strong> você ganha <strong>10 cupons na hora</strong> na urna!"
        }
      ]
    };
    const salvo = (window.SITE_DATA && window.SITE_DATA.bannerPromocao) || {};
    return {
      ...padrao,
      ...salvo,
      regrasCards:
        Array.isArray(salvo.regrasCards) && salvo.regrasCards.length > 0
          ? salvo.regrasCards
          : padrao.regrasCards
    };
  }

  function gerarEstiloBgBannerPromocao(imagemFundo) {
    const imgTrim = String(imagemFundo || "").trim();
    if (!imgTrim || imgTrim === "assets/produtos/banner-sorteio-natal-wide.jpg") {
      return "";
    }
    const urlSegura = imgTrim.replace(/'/g, "\\'").replace(/"/g, "%22");
    return `background: linear-gradient(90deg, rgba(10, 8, 8, 0.74) 0%, rgba(10, 8, 8, 0.52) 45%, rgba(10, 8, 8, 0.08) 68%, rgba(10, 8, 8, 0) 100%), url('${urlSegura}') center / cover no-repeat;`;
  }

  function gerarResumoCurtoSorteio(b) {
    if (b.estilo === "promocao" && b.precoDestaque) {
      return b.precoDestaque;
    }
    return "🎟️ 10 cupons na compra de Impressora 3D • 1 cupom a cada R$ 60 • +3 cupons grátis na loja física";
  }

  function abrirModalRegrasSorteio() {
    const modal = document.getElementById("modal-raffle-rules");
    const badgesEl = document.getElementById("raffle-modal-badges");
    const bodyEl = document.getElementById("raffle-modal-dynamic-body");
    if (!modal || !bodyEl) return;

    const b = obterConfigBannerPromocao();
    if (badgesEl) {
      badgesEl.innerHTML = `
        ${b.badge ? `<span class="raffle-pill-orange">${b.badge}</span>` : ""}
        ${b.dataSorteio ? `<span class="raffle-pill-date">📅 ${b.dataSorteio}</span>` : ""}
      `;
    }

    const cards = Array.isArray(b.regrasCards) && b.regrasCards.length > 0 ? b.regrasCards : [];

    bodyEl.innerHTML = `
      <div class="raffle-modal-hero-summary">
        ${b.tituloKicker ? `<span class="raffle-modal-kicker">${b.tituloKicker}</span>` : ""}
        <h2 id="raffle-modal-title" class="raffle-modal-main-title">${b.tituloPrincipal || "SORTEIO A1 MINI"}</h2>
        ${b.subtituloPremio ? `<p class="raffle-modal-subtitle">${b.subtituloPremio}</p>` : ""}
      </div>

      ${
        cards.length > 0
          ? `
        <div class="raffle-modal-section-label">COMO GANHAR CUPONS PARA CONCORRER:</div>
        <div class="raffle-modal-rules-grid">
          ${cards
            .map(
              (rc, i) => `
              <div class="raffle-modal-rule-card">
                <div class="raffle-modal-rule-top">
                  <span class="raffle-modal-step-num">${i + 1}</span>
                  <span class="raffle-modal-rule-tag">${rc.tag || ""}</span>
                </div>
                <strong>${rc.titulo || ""}</strong>
                <p>${rc.texto || ""}</p>
              </div>
            `
            )
            .join("")}
        </div>
      `
          : b.precoDestaque
          ? `<div class="raffle-modal-price-highlight">${b.precoDestaque}</div>`
          : ""
      }

      <div class="raffle-modal-store-box">
        <div class="raffle-modal-store-info">
          <span class="raffle-modal-store-badge">📍 LOJA FÍSICA & BALCÃO DE RETIRADA EM UMUARAMA - PR</span>
          <strong>Av. Portugal, 6759 — Zona I-A • Umuarama / PR</strong>
          <p>Passe em nossa loja física, conheça as impressoras Bambu Lab e Snapmaker ao vivo, veja o mostruário com +80 cores de filamentos e retire seus <strong>+3 cupons grátis</strong> (1 retirada por CPF seguindo <strong>@lojasj3d</strong>).</p>
        </div>
        <div class="raffle-modal-store-links">
          <a href="https://share.google/0WwPhjFx69b3V9sU1" target="_blank" rel="noopener" class="raffle-modal-map-link">
            📍 Ver no Google Maps →
          </a>
          <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="raffle-modal-insta-btn">
            📸 Seguir @lojasj3d
          </a>
        </div>
      </div>

      <div class="raffle-modal-footer-actions">
        ${
          b.btn1Texto
            ? `
          <a href="${b.btn1Url || "https://wa.me/5544991351318"}" target="_blank" rel="noopener" class="btn-raffle-whatsapp">
            ${b.btn1Texto}
          </a>
        `
            : ""
        }
        <button type="button" class="raffle-modal-btn-done" id="btn-raffle-modal-entendi">
          Fechar
        </button>
      </div>
    `;

    bodyEl.querySelector("#btn-raffle-modal-entendi")?.addEventListener("click", fecharModalRegrasSorteio);

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalRegrasSorteio() {
    const modal = document.getElementById("modal-raffle-rules");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.getElementById("btn-close-raffle-modal")?.addEventListener("click", fecharModalRegrasSorteio);
  document.getElementById("modal-raffle-rules")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-raffle-rules") fecharModalRegrasSorteio();
  });
  document.addEventListener("click", (e) => {
    const btnSaibaMais = e.target.closest("[data-open-raffle-modal]");
    if (btnSaibaMais) {
      e.preventDefault();
      abrirModalRegrasSorteio();
    }
  });

  function gerarBannerPromocionalSecaoHtml() {
    const b = obterConfigBannerPromocao();
    if (!b.exibirBannerSecaoImpressoras) return "";

    const styleInline = gerarEstiloBgBannerPromocao(b.imagemFundo);
    const resumoCurto = gerarResumoCurtoSorteio(b);

    return `
      <div class="natal-raffle-banner full-bleed-raffle-banner clean-raffle-banner" style="${styleInline}">
        <button type="button" class="admin-quick-edit-btn admin-banner-edit-btn" data-admin-edit-banner="1" title="Editar este banner promocional">
          ✏️ Editar Banner de Promoção
        </button>
        <div class="natal-raffle-info-col">
          <div class="natal-raffle-badges">
            ${b.badge ? `<span class="raffle-pill-orange">${b.badge}</span>` : ""}
            ${b.dataSorteio ? `<span class="raffle-pill-date">📅 ${b.dataSorteio}</span>` : ""}
          </div>
          <div class="raffle-hero-heading-block">
            ${b.tituloKicker ? `<span class="raffle-kicker-line">${b.tituloKicker}</span>` : ""}
            <h3 class="raffle-big-model">${b.tituloPrincipal || "PROMOÇÃO LOJA SJ"}</h3>
            ${b.subtituloPremio ? `<span class="raffle-sub-prize">${b.subtituloPremio}</span>` : ""}
          </div>

          <div class="raffle-clean-summary-pill">
            <span>${resumoCurto}</span>
          </div>

          <div class="natal-raffle-actions">
            ${b.btn1Texto
        ? `
                <a
                  href="${b.btn1Url || "https://wa.me/5544991351318"}"
                  target="_blank"
                  rel="noopener"
                  class="btn-raffle-whatsapp"
                >
                  ${b.btn1Texto}
                </a>
              `
        : ""
      }
            <button
              type="button"
              class="btn-raffle-saiba-mais"
              data-open-raffle-modal="1"
            >
              ✨ Saiba Mais / Como Participar
            </button>
          </div>

          <div class="raffle-clean-store-footnote">
            📍 Loja Física em Umuarama - PR: Av. Portugal, 6759 — Zona I-A • <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener">@lojasj3d</a>
          </div>
        </div>
        <div class="hero-raffle-art-spacer" aria-hidden="true"></div>
      </div>
    `;
  }

  // Extrai o valor numérico e texto do parcelamento (10x) das impressoras 3D
  function extrairDadosParcelamentoImpressora(item) {
    const vistaStr = item.precoVista || "";
    const vistaVal = Number(item.precoVistaValor || 0);
    const parcRaw = String(item.precoParcelado || "").replace(/^ou\s+/i, "").trim();

    // Ex: "10x de R$ 217,90" -> extrai 10 e 217,90
    const match = parcRaw.match(/(\d+)\s*x\s*(?:de\s*)?R\$\s*([\d.]+,\d{2})/i);
    if (match) {
      const qtdParcelas = Number(match[1]) || 10;
      const valParcela = Number(match[2].replace(/\./g, "").replace(",", ".")) || 0;
      const totalPrazo = Math.round(qtdParcelas * valParcela * 100) / 100;
      return {
        vistaTexto: vistaStr,
        vistaValor: vistaVal,
         vistaSub: item.precoParcelado || "",
        parceladoMain: `${qtdParcelas}x de R$ ${match[2]}`,
        parceladoSub: `Total a prazo: ${formatarMoedaBR(totalPrazo)} (ou ${vistaStr} à vista)`,
        parceladoValorTotal: totalPrazo,
        parceladoTextoCurto: `${qtdParcelas}x de R$ ${match[2]} (${formatarMoedaBR(totalPrazo)})`
      };
    }

    return {
      vistaTexto: vistaStr,
      vistaValor: vistaVal,
      vistaSub: item.precoParcelado || "",
      parceladoMain: parcRaw || vistaStr,
      parceladoSub: vistaStr ? `À vista: ${vistaStr}` : "",
      parceladoValorTotal: vistaVal,
      parceladoTextoCurto: parcRaw || vistaStr
    };
  }

  // Modal Comparador Oficial das Impressoras 3D ("Qual Impressora Escolher?")
  function abrirModalCompararImpressoras() {
    const modal = document.getElementById("modal-printer-compare");
    const bodyEl = document.getElementById("printer-compare-dynamic-body");
    if (!modal || !bodyEl) return;

    const impressoras = (window.SITE_DATA.catalogo || []).filter((i) => i.categoria === "impressoras");

    const metadadosExtras = {
      "imp-bambu-a1-mini": {
        volume: "180 × 180 × 180 mm³",
        multicor: "1 Cor (Expansível c/ AMS Lite)",
        estrutura: "Aberta Compacta",
        perfil: "Iniciantes, Hobbistas & Presente"
      },
      "imp-bambu-a1-mini-combo": {
        volume: "180 × 180 × 180 mm³",
        multicor: "Até 4 Cores (AMS Lite Incluso)",
        estrutura: "Aberta Compacta + AMS Lite",
        perfil: "Miniaturas Coloridas & Chaveiros"
      },
      "imp-bambu-a1-normal": {
        volume: "256 × 256 × 256 mm³",
        multicor: "1 Cor (Expansível c/ AMS Lite)",
        estrutura: "Aberta Grande Volume",
        perfil: "Peças Maiores, Cosplay & Produção"
      },
      "imp-bambu-a1-combo": {
        volume: "256 × 256 × 256 mm³",
        multicor: "Até 4 Cores (AMS Lite Incluso)",
        estrutura: "Aberta Grande Volume + AMS",
        perfil: "Campeã de Vendas • Produção Multicor"
      },
      "imp-bambu-p2s": {
        volume: "256 × 256 × 256 mm³",
        multicor: "Até 4 Cores (AMS Fechado Incluso)",
        estrutura: "CoreXY Fechada (ABS/ASA/Nylon)",
        perfil: "Engenharia & Uso Profissional"
      },
      "imp-snapmaker": {
        volume: "Grande Volume Industrial",
        multicor: "4 Cabeçotes Independentes Reais",
        estrutura: "Multicabeçote Alta Velocidade",
        perfil: "Multicor Zero Desperdício"
      }
    };

    bodyEl.innerHTML = `
      <div class="raffle-modal-hero-summary">
        <span class="raffle-modal-kicker">GUIA RÁPIDO DE ESCOLHA • PRONTA ENTREGA EM UMUARAMA</span>
        <h2 id="printer-compare-title" class="raffle-modal-main-title">Compare nossas Impressoras 3D Lado a Lado</h2>
        <p class="raffle-modal-subtitle">Todas dão direito a 🎟️ 10 cupons imediatos no Sorteio de Natal + suporte técnico Loja SJ 3D</p>
      </div>

      <div class="printer-compare-table-wrap">
        <table class="printer-compare-table">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Volume de Impressão</th>
              <th>Sistema Multicor (AMS)</th>
              <th>Estrutura</th>
              <th>Ideal Para</th>
              <th>Valor (À Vista / 10x)</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${impressoras
              .map((imp) => {
                const extra = metadadosExtras[imp.id] || {};
                const ft = imp.fichaTecnica || {};
                const vol = ft["Volume de Impressão"] || extra.volume || "256 × 256 × 256 mm³";
                const multi = ft["Sistema Multicor"] || extra.multicor || "Multicor";
                const estr = ft["Arquitetura"] || extra.estrutura || "Alta Velocidade";
                const ideal = extra.perfil || imp.subtitulo || "Produção 3D";
                return `
                  <tr>
                    <td>
                      <div class="compare-model-cell" data-compare-open="${imp.id}">
                        <img src="${imp.imagem}" alt="${imp.nome}" />
                        <div>
                          <span class="compare-brand-tag">${imp.marca}</span>
                          <strong>${imp.nome}</strong>
                        </div>
                      </div>
                    </td>
                    <td><strong>${vol}</strong></td>
                    <td>${multi}</td>
                    <td>${estr}</td>
                    <td><span class="compare-ideal-pill">${ideal}</span></td>
                    <td>
                      <strong class="compare-price-vista">${imp.precoVista || "Sob consulta"}</strong>
                      <small class="compare-price-parc">${imp.precoParcelado || ""}</small>
                    </td>
                    <td>
                      <button type="button" class="compare-open-btn" data-compare-open="${imp.id}">
                        Ver Detalhes →
                      </button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="raffle-modal-footer-actions">
        <a href="https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Estou%20comparando%20as%20impressoras%203D%20no%20site%20e%20gostaria%20de%20ajuda%20para%20escolher%20o%20melhor%20modelo!" target="_blank" rel="noopener" class="btn-raffle-whatsapp">
          💬 Tirar Dúvida com Especialista no WhatsApp
        </a>
        <button type="button" class="raffle-modal-btn-done" id="btn-close-compare-footer">
          Fechar Comparativo
        </button>
      </div>
    `;

    bodyEl.querySelector("#btn-close-compare-footer")?.addEventListener("click", fecharModalCompararImpressoras);
    bodyEl.querySelectorAll("[data-compare-open]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.compareOpen;
        fecharModalCompararImpressoras();
        abrirPaginaProduto(id);
      });
    });

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalCompararImpressoras() {
    const modal = document.getElementById("modal-printer-compare");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.getElementById("btn-close-printer-compare")?.addEventListener("click", fecharModalCompararImpressoras);
  document.getElementById("modal-printer-compare")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-printer-compare") fecharModalCompararImpressoras();
  });
  document.addEventListener("click", (e) => {
    const btnComp = e.target.closest("[data-open-printer-compare]");
    if (btnComp) {
      e.preventDefault();
      abrirModalCompararImpressoras();
    }
  });

  // 2. Renderiza um Card Ultra-Clean na Grade Principal (Estilo Referência Anycubic)
  function gerarCardHTML(item) {
    const marcaAtual = state.marcaNoCardOverride[item.id] || item.marca;
    const isBambu = marcaAtual === "Bambu Lab";

    let imagemBase = item.imagem;
    let imagemCard = item.imagem;
    let tituloCard = item.nome;
    let listaCores = null;
    let opcoesSelect1 = item.select1Opcoes || ["Padrão"];

    if (item.tipoFilamento) {
      if (!item.imagemCustomizada) {
        imagemBase = isBambu
          ? "assets/produtos/pla-bambulab.jpg"
          : "assets/produtos/pla-maxprint.jpg";
        imagemCard = imagemBase;
      }
      listaCores = obterPaletaPorChave(item.usaCoresDinamicas, isBambu);

      // Rótulos curtos para o primeiro select não cortar o texto ("1KG" / "Refil")
      opcoesSelect1 =
        Array.isArray(item.select1Opcoes) && item.select1Opcoes.length > 0 && item.opcoesCustomizadas
          ? item.select1Opcoes
          : isBambu
            ? ["1KG", "Refil"]
            : ["1KG"];

      if (!item.nomeCustomizado) {
        if (item.id === "fil-pla-bambulab") {
          tituloCard = "PLA Bambu Lab";
        } else if (item.id === "fil-pla-maxprint") {
          tituloCard = "PLA Masterprint";
        } else if (item.id.includes("silk")) {
          tituloCard = "PLA Silk Masterprint";
        } else if (item.id.includes("petg")) {
          tituloCard = "PETG Masterprint";
        } else if (item.id.includes("tpu")) {
          tituloCard = "TPU Flexível Masterprint";
        } else if (item.id.includes("abs")) {
          tituloCard = "ABS & Especiais Masterprint";
        }
      }
    } else if (item.categoria === "impressoras" && !item.opcoesCustomizadas) {
      opcoesSelect1 = ["À Vista", "10x"];
    }

    const select1Html = opcoesSelect1
      .map((op) => `<option value="${op}">${op}</option>`)
      .join("");

    let select2Html = "";
    let filtroInicial = "none";
    let corInicialObj = null;
    let swatchesHtml = "";

    if (item.tipoFilamento && listaCores && listaCores.length > 0) {
      const idxInicial =
        item.corInicialIndex && listaCores[item.corInicialIndex] ? item.corInicialIndex : 0;
      corInicialObj = listaCores[idxInicial];
      filtroInicial = corInicialObj?.filtroCss || "none";
      if (item.imagemCustomizada) {
        imagemCard = item.imagem;
        filtroInicial = "none";
      } else if (corInicialObj?.usaFotoCatalogoDireta && corInicialObj?.imgCatalogo) {
        imagemCard = corInicialObj.imgCatalogo;
        filtroInicial = "none";
      }

      select2Html = listaCores
        .map((cor, idx) => {
          const nomeLimpo = (cor.nome || "").replace(/\s*1kg$/i, "");
          const codStr = cor.cod ? ` — CÓD. ${cor.cod}` : "";
          return `<option value="${idx}" data-hex="${cor.hex}" data-nome="${cor.nome}" data-cod="${cor.cod || ""
            }" data-preco="${cor.preco || ""}" data-valor="${cor.valor || 0}" data-filtro="${cor.filtroCss
            }" data-img-catalogo="${cor.imgCatalogo || ""}" data-foto-direta="${cor.usaFotoCatalogoDireta ? "1" : "0"
            }" data-img-base="${imagemBase}" ${idx === idxInicial ? "selected" : ""
            }>${nomeLimpo}${codStr} (${cor.preco || ""})</option>`;
        })
        .join("");

      const maxDots = 7;
      const coresVisiveis = listaCores.slice(0, maxDots);
      const restantes = Math.max(0, listaCores.length - maxDots);
      swatchesHtml = `
        <div class="color-swatches-strip" id="swatches-${item.id}" aria-label="Troca rápida de cor">
          ${coresVisiveis
            .map(
              (cor, idx) => `
              <button
                type="button"
                class="color-swatch-dot ${idx === idxInicial ? "active" : ""}"
                style="background-color: ${cor.hex};"
                data-swatch-card="${item.id}"
                data-swatch-index="${idx}"
                title="${cor.nome} — CÓD. ${cor.cod} (${cor.preco})"
                aria-label="Selecionar cor ${cor.nome}"
              ></button>
            `
            )
            .join("")}
          ${
            restantes > 0
              ? `<button type="button" class="color-swatch-more" data-open-modal="${item.id}" title="Ver todas as ${listaCores.length} cores disponíveis">+${restantes} cores</button>`
              : ""
          }
        </div>
      `;
    } else {
      select2Html = (item.select2Opcoes || ["Padrão"])
        .map((op) => `<option value="${op}">${op}</option>`)
        .join("");
    }

    const dadosImp = item.categoria === "impressoras" ? extrairDadosParcelamentoImpressora(item) : null;
    const precoInicialExibicao = corInicialObj?.preco || item.precoVista || "";
    const parcelaCurta =
      !item.tipoFilamento && item.precoParcelado
        ? `<span class="clean-price-sub" id="price-sub-${item.id}">${item.precoParcelado}</span>`
        : "";

    const priceLineHtml = precoInicialExibicao
      ? `
        <div class="combo-card-clean-price">
          <strong id="price-val-${item.id}">${precoInicialExibicao}</strong>
          ${parcelaCurta}
        </div>
      `
      : "";

    const codBadgeHtml =
      item.tipoFilamento && corInicialObj?.cod
        ? `<span class="card-cod-badge" id="cod-badge-${item.id}">CÓD. ${corInicialObj.cod}</span>`
        : "";

    return `
      <article
        class="combo-filament-card"
        data-item-id="${item.id}"
        ${
          dadosImp
            ? `data-vista-txt="${dadosImp.vistaTexto}" data-vista-sub="${dadosImp.vistaSub}" data-parc-main="${dadosImp.parceladoMain}" data-parc-sub="${dadosImp.parceladoSub}"`
            : ""
        }
      >
        <button type="button" class="admin-quick-edit-btn" data-admin-edit-prod="${item.id}" title="Editar foto, preço e descrição deste produto">
          ✏️ Editar
        </button>

        <div class="combo-image-wrap" data-open-modal="${item.id}" title="Clique para ver todas as cores e detalhes">
          ${codBadgeHtml}
          <img
            src="${imagemCard}"
            alt="${tituloCard}"
            id="img-${item.id}"
            class="${item.tipoFilamento ? "cover-img" : ""}"
            style="filter: ${filtroInicial};"
            loading="lazy"
          />
        </div>

        <h3 class="combo-card-title" data-open-modal="${item.id}">${tituloCard}</h3>

        ${priceLineHtml}
        ${swatchesHtml}

        <div class="combo-selects-row">
          <select class="combo-select" id="sel1-${item.id}" data-type-select="${item.id}" aria-label="Primeira opção">
            ${select1Html}
          </select>

          <select
            class="combo-select"
            id="sel2-${item.id}"
            ${item.tipoFilamento ? `data-color-select="${item.id}"` : ""}
            aria-label="Segunda opção ou cor"
          >
            ${select2Html}
          </select>
        </div>

        <button type="button" class="btn-add-to-box" data-add-item="${item.id}">
          ${item.botaoTexto || "Adicionar ao Pedido"}
        </button>
      </article>
    `;
  }

  // 2.5 HUB INTERATIVO DE FILAMENTOS (SEPARAÇÃO DESTACADA MAXPRINT vs BAMBU LAB + EXTENSÃO COMPLETA)
  function gerarHubFilamentosHtml(contexto = "catalogo") {
    const isHome = contexto === "home";
    const extensaoAberta = isHome ? state.hubFilamentoAbertoHome : true;
    const marcaAtiva = state.hubFilamentoMarcaAtiva || "MaxPrint";
    const isBambuAtivo = marcaAtiva === "Bambu Lab";

    const materiaisMaxPrint = [
      {
        id: "fil-pla-maxprint",
        curto: "PLA",
        titulo: "PLA Tradicional & Especiais",
        qtdCores: (window.SITE_DATA.coresMaxPrint || []).length,
        preco: "R$ 79,90"
      },
      {
        id: "fil-silk-maxprint",
        curto: "PLA Silk",
        titulo: "PLA Silk, Dual/Tri & Rainbow",
        qtdCores: (window.SITE_DATA.coresPlaSilk || []).length,
        preco: "R$ 99,90"
      },
      {
        id: "fil-petg-maxprint",
        curto: "PETG",
        titulo: "PETG Alta Resistência",
        qtdCores: (window.SITE_DATA.coresPetg || []).length,
        preco: "A partir de R$ 59,90"
      },
      {
        id: "fil-tpu-maxprint",
        curto: "TPU 95A",
        titulo: "TPU Flexível 95A",
        qtdCores: (window.SITE_DATA.coresTpu || []).length,
        preco: "R$ 109,90"
      },
      {
        id: "fil-abs-especiais",
        curto: "ABS & Glitter",
        titulo: "ABS & Especiais Glitter",
        qtdCores: (window.SITE_DATA.coresAbsEspeciais || []).length,
        preco: "A partir de R$ 69,90"
      }
    ];

    const opcoesBambu = [
      { id: "todos", label: "Todos Bambu Lab (13)" },
      { id: "carretel", label: "Carretel c/ RFID (10)" },
      { id: "refil", label: "Refil s/ Bobina RFID (3)" }
    ];

    // Conteúdo da Extensão Aberta (MaxPrint vs Bambu Lab)
    let extensaoConteudoHtml = "";
    if (extensaoAberta) {
      if (!isBambuAtivo) {
        const matAtivoId = state.hubFilamentoMaterialMaxPrint || "fil-pla-maxprint";
        const mostrarTodosMax = matAtivoId === "todos";
        const itemAtivo =
          window.SITE_DATA.catalogo.find((i) => i.id === matAtivoId) ||
          window.SITE_DATA.catalogo.find((i) => i.id === "fil-pla-maxprint");

        const paletaAtiva = itemAtivo
          ? obterPaletaPorChave(itemAtivo.usaCoresDinamicas, false) || []
          : [];
        const termoBusca = (state.busca || "").trim().toLowerCase();
        const coresFiltradas = paletaAtiva
          .map((cor, originalIdx) => ({ ...cor, originalIdx }))
          .filter((cor) => {
            if (!termoBusca) return true;
            return `${cor.nome} ${cor.cod} cod ${cor.cod} cód ${cor.cod}`
              .toLowerCase()
              .includes(termoBusca);
          });

        const todosCardsMaxPrint = (window.SITE_DATA.catalogo || []).filter(
          (i) => i.tipoFilamento && (i.marca === "MaxPrint" || i.marca === "Masterprint")
        );

        extensaoConteudoHtml = `
          <div class="filament-ext-materials-bar" role="tablist" aria-label="Escolher material Masterprint">
            ${materiaisMaxPrint
              .map(
                (m) => `
              <button
                type="button"
                class="filament-ext-mat-tab ${!mostrarTodosMax && matAtivoId === m.id ? "active" : ""}"
                data-hub-max-mat="${m.id}"
              >
                <strong>${m.curto}</strong>
                <span>${m.qtdCores} cores</span>
              </button>
            `
              )
              .join("")}
            <button
              type="button"
              class="filament-ext-mat-tab ${mostrarTodosMax ? "active" : ""}"
              data-hub-max-mat="todos"
            >
              <strong>Todas as Linhas</strong>
              <span>Ver resumo</span>
            </button>
          </div>

          ${
            mostrarTodosMax
              ? `
            <div class="combo-products-row" data-hub-cards-grid="1">
              ${todosCardsMaxPrint.map((it) => gerarCardHTML(it)).join("")}
            </div>
          `
              : `
            <div class="filament-ext-selected-header">
              <div>
                <span class="filament-ext-eyebrow">PRODUTOS MASTERPRINT</span>
                <h3>${itemAtivo ? itemAtivo.nome : "Filamento Masterprint"}</h3>
                <p>Escolha a cor desejada abaixo para adicionar ao pedido ou clique na foto para ver detalhes.</p>
              </div>
              <button type="button" class="btn-ext-open-pdp" data-hub-open-pdp="${itemAtivo ? itemAtivo.id : "fil-pla-maxprint"}">
                Ver Ficha Técnica & Detalhes →
              </button>
            </div>

            <div class="filament-ext-colors-grid">
              ${coresFiltradas
                .map(
                  (cor) => `
                <article class="filament-color-tile">
                  <div
                    class="filament-color-tile-img"
                    data-hub-open-color-pdp="${itemAtivo.id}"
                    data-hub-color-idx="${cor.originalIdx}"
                    title="Clique para ampliar ${cor.nome} (CÓD. ${cor.cod})"
                  >
                    <span class="tile-cod-badge">CÓD. ${cor.cod}</span>
                    <span class="tile-hex-dot" style="background: ${cor.hex};"></span>
                    <img
                      src="${cor.usaFotoCatalogoDireta && cor.imgCatalogo ? cor.imgCatalogo : itemAtivo.imagem}"
                      alt="${cor.nome}"
                      style="filter: ${cor.usaFotoCatalogoDireta ? "none" : cor.filtroCss || "none"};"
                      loading="lazy"
                    />
                  </div>
                  <div class="filament-color-tile-body">
                    <strong
                      class="tile-color-name"
                      data-hub-open-color-pdp="${itemAtivo.id}"
                      data-hub-color-idx="${cor.originalIdx}"
                    >${(cor.nome || "").replace(/\s*1kg$/i, "")}</strong>
                    <div class="tile-price-row">
                      <span class="tile-weight-tag">1 KG • 1.75mm</span>
                      <strong class="tile-price-val">${cor.preco}</strong>
                    </div>
                    <button
                      type="button"
                      class="tile-add-btn"
                      data-hub-quick-add="${itemAtivo.id}"
                      data-hub-color-idx="${cor.originalIdx}"
                      data-hub-brand="MaxPrint"
                    >
                      + Adicionar ao Pedido
                    </button>
                  </div>
                </article>
              `
                )
                .join("")}
            </div>
          `
          }
        `;
      } else {
        // BAMBU LAB ATIVO: Mostra todas as opções da Bambu Lab!
        const itemBambu =
          window.SITE_DATA.catalogo.find((i) => i.id === "fil-pla-bambulab") ||
          window.SITE_DATA.catalogo[0];
        const paletaBambu = window.SITE_DATA.coresBambuLab || [];
        const filtroBambu = state.hubFilamentoFiltroBambu || "todos";
        const termoBusca = (state.busca || "").trim().toLowerCase();

        const coresBambuFiltradas = paletaBambu
          .map((cor, originalIdx) => ({ ...cor, originalIdx }))
          .filter((cor) => {
            const ehRefil = (cor.nome || "").toLowerCase().includes("refil") || (cor.tipo || "").toLowerCase().includes("refil");
            if (filtroBambu === "carretel" && ehRefil) return false;
            if (filtroBambu === "refil" && !ehRefil) return false;
            if (termoBusca) {
              return `${cor.nome} ${cor.cod} cod ${cor.cod} cód ${cor.cod} bambu`
                .toLowerCase()
                .includes(termoBusca);
            }
            return true;
          });

        extensaoConteudoHtml = `
          <div class="filament-ext-materials-bar bambu-mode" role="tablist" aria-label="Filtrar apresentação Bambu Lab">
            ${opcoesBambu
              .map(
                (op) => `
              <button
                type="button"
                class="filament-ext-mat-tab ${filtroBambu === op.id ? "active" : ""}"
                data-hub-bambu-filter="${op.id}"
              >
                <strong>${op.label}</strong>
              </button>
            `
              )
              .join("")}
          </div>

          <div class="filament-ext-selected-header bambu-header">
            <div>
              <span class="filament-ext-eyebrow">PRODUTOS BAMBU LAB</span>
              <h3>Filamentos Bambu Lab</h3>
              <p>Escolha a cor desejada abaixo para adicionar ao pedido ou clique na foto para ver detalhes.</p>
            </div>
            <button type="button" class="btn-ext-open-pdp" data-hub-open-pdp="fil-pla-bambulab">
              Ver Ficha Técnica Bambu Lab →
            </button>
          </div>

          <div class="filament-ext-colors-grid">
            ${coresBambuFiltradas
              .map((cor) => {
                const ehRefil =
                  (cor.nome || "").toLowerCase().includes("refil") ||
                  (cor.tipo || "").toLowerCase().includes("refil");
                return `
                  <article class="filament-color-tile bambu-tile">
                    <div
                      class="filament-color-tile-img"
                      data-hub-open-color-pdp="fil-pla-bambulab"
                      data-hub-color-idx="${cor.originalIdx}"
                      title="Clique para ampliar ${cor.nome} (CÓD. ${cor.cod})"
                    >
                      <span class="tile-cod-badge">CÓD. ${cor.cod}</span>
                      <span class="tile-rfid-badge ${ehRefil ? "is-refil" : ""}">${
                  ehRefil ? "Refil RFID" : "Carretel RFID"
                }</span>
                      <span class="tile-hex-dot" style="background: ${cor.hex};"></span>
                      <img
                        src="${cor.usaFotoCatalogoDireta && cor.imgCatalogo ? cor.imgCatalogo : itemBambu.imagem}"
                        alt="${cor.nome}"
                        style="filter: ${cor.usaFotoCatalogoDireta ? "none" : cor.filtroCss || "none"};"
                        loading="lazy"
                      />
                    </div>
                    <div class="filament-color-tile-body">
                      <strong
                        class="tile-color-name"
                        data-hub-open-color-pdp="fil-pla-bambulab"
                        data-hub-color-idx="${cor.originalIdx}"
                      >${(cor.nome || "").replace(/\s*1kg$/i, "")}</strong>
                      <div class="tile-price-row">
                        <span class="tile-weight-tag">${ehRefil ? "1 KG Refil RFID" : "1 KG c/ Bobina"}</span>
                        <strong class="tile-price-val">${cor.preco}</strong>
                      </div>
                      <button
                        type="button"
                        class="tile-add-btn"
                        data-hub-quick-add="fil-pla-bambulab"
                        data-hub-color-idx="${cor.originalIdx}"
                        data-hub-brand="Bambu Lab"
                      >
                        + Adicionar ao Pedido
                      </button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        `;
      }
    }

    return `
      <div class="filament-brand-hub-wrapper" data-filament-hub="${contexto}">
        <!-- 1. DOIS CARDS LIMPOS DE ESCOLHA DA MARCA (MASTERPRINT vs BAMBU LAB) -->
        <div class="filament-brand-portals-grid">
          <!-- CARD MARCA 1: MASTERPRINT -->
          <div
            class="filament-brand-portal-card portal-maxprint ${extensaoAberta && !isBambuAtivo ? "active-portal" : ""}"
            data-hub-select-brand="MaxPrint"
          >
            <div class="portal-card-top">
              <div class="portal-img-box">
                <img src="assets/produtos/pla-maxprint.jpg" alt="Produtos Masterprint" loading="lazy" />
              </div>
              <div class="portal-head-info">
                <span class="portal-eyebrow-pill">PRODUTOS MASTERPRINT</span>
                <h3>Masterprint</h3>
                <p>Ver todos os filamentos e cores da marca Masterprint.</p>
              </div>
            </div>

            <div class="portal-card-footer">
              <button type="button" class="portal-cta-btn" data-hub-select-brand="MaxPrint">
                ${
                  extensaoAberta && !isBambuAtivo
                    ? "✓ Visualizando Produtos Masterprint"
                    : "Escolher Masterprint →"
                }
              </button>
            </div>
          </div>

          <!-- CARD MARCA 2: BAMBU LAB -->
          <div
            class="filament-brand-portal-card portal-bambu ${extensaoAberta && isBambuAtivo ? "active-portal" : ""}"
            data-hub-select-brand="Bambu Lab"
          >
            <div class="portal-card-top">
              <div class="portal-img-box">
                <img src="assets/produtos/pla-bambulab.jpg" alt="Produtos Bambu Lab" loading="lazy" />
              </div>
              <div class="portal-head-info">
                <span class="portal-eyebrow-pill bambu-pill">PRODUTOS BAMBU LAB</span>
                <h3>Bambu Lab</h3>
                <p>Ver todos os filamentos e cores originais da marca Bambu Lab.</p>
              </div>
            </div>

            <div class="portal-card-footer">
              <button type="button" class="portal-cta-btn bambu-cta" data-hub-select-brand="Bambu Lab">
                ${
                  extensaoAberta && isBambuAtivo
                    ? "✓ Visualizando Produtos Bambu Lab"
                    : "Escolher Bambu Lab →"
                }
              </button>
            </div>
          </div>
        </div>

        <!-- 2. EXTENSÃO COMPLETA (ABRE AO CLICAR EM MASTERPRINT OU BAMBU LAB) -->
        ${
          extensaoAberta
            ? `
          <div class="filament-brand-extension-box" id="filament-ext-box-${contexto}">
            <div class="filament-ext-top-switcher">
              <div class="filament-ext-brand-tabs">
                <span class="filament-ext-switch-label">Marca selecionada:</span>
                <button
                  type="button"
                  class="ext-brand-switch-btn ${!isBambuAtivo ? "active" : ""}"
                  data-hub-select-brand="MaxPrint"
                >
                  Produtos Masterprint
                </button>
                <button
                  type="button"
                  class="ext-brand-switch-btn ${isBambuAtivo ? "active" : ""}"
                  data-hub-select-brand="Bambu Lab"
                >
                  Produtos Bambu Lab
                </button>
              </div>
              ${
                isHome
                  ? `
                <button type="button" class="ext-collapse-btn" data-hub-collapse-home="1">
                  ✕ Fechar
                </button>
              `
                  : ""
              }
            </div>

            ${extensaoConteudoHtml}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function vincularEventosHubFilamentos(rootEl, contexto = "catalogo") {
    if (!rootEl) return;

    const reRenderizarHub = (focarExtensao = false) => {
      const wrapper = rootEl.querySelector(`[data-filament-hub="${contexto}"]`);
      if (wrapper) {
        wrapper.outerHTML = gerarHubFilamentosHtml(contexto);
        vincularEventosHubFilamentos(rootEl, contexto);
        const cardsGrid = rootEl.querySelector("[data-hub-cards-grid]");
        if (cardsGrid) vincularEventosDosCards(cardsGrid);
        if (focarExtensao) {
          const extBox = document.getElementById(`filament-ext-box-${contexto}`);
          extBox?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    };

    // Clique em um dos 2 grandes cards de marca ou nos botões de trocar marca (MaxPrint <-> Bambu Lab)
    rootEl.querySelectorAll("[data-hub-select-brand]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-hub-jump-max]") || e.target.closest("[data-hub-jump-bambu]")) {
          return;
        }
        const novaMarca = el.getAttribute("data-hub-select-brand");
        state.hubFilamentoMarcaAtiva = novaMarca;
        if (contexto === "home") {
          state.hubFilamentoAbertoHome = true;
        }
        reRenderizarHub(true);
      });
    });

    // Clique direto em uma pílula de material MaxPrint dentro do card (ex: PLA, PLA Silk, PETG, TPU, ABS)
    rootEl.querySelectorAll("[data-hub-jump-max]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.hubFilamentoMarcaAtiva = "MaxPrint";
        state.hubFilamentoMaterialMaxPrint = btn.getAttribute("data-hub-jump-max");
        if (contexto === "home") {
          state.hubFilamentoAbertoHome = true;
        }
        reRenderizarHub(true);
      });
    });

    // Clique direto em uma pílula Bambu Lab dentro do card (Todos, Carretel RFID, Refil RFID)
    rootEl.querySelectorAll("[data-hub-jump-bambu]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.hubFilamentoMarcaAtiva = "Bambu Lab";
        state.hubFilamentoFiltroBambu = btn.getAttribute("data-hub-jump-bambu");
        if (contexto === "home") {
          state.hubFilamentoAbertoHome = true;
        }
        reRenderizarHub(true);
      });
    });

    // Troca de aba de material dentro da extensão MaxPrint (PLA, Silk, PETG, TPU, ABS, Resumo)
    rootEl.querySelectorAll("[data-hub-max-mat]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        state.hubFilamentoMaterialMaxPrint = tabBtn.getAttribute("data-hub-max-mat");
        reRenderizarHub(false);
      });
    });

    // Troca de aba de filtro dentro da extensão Bambu Lab (Todos, Carretel, Refil)
    rootEl.querySelectorAll("[data-hub-bambu-filter]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        state.hubFilamentoFiltroBambu = tabBtn.getAttribute("data-hub-bambu-filter");
        reRenderizarHub(false);
      });
    });

    // Botão recolher extensão na Home
    rootEl.querySelectorAll("[data-hub-collapse-home]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.hubFilamentoAbertoHome = false;
        reRenderizarHub(false);
      });
    });

    // Abrir página completa (PDP) do filamento
    rootEl.querySelectorAll("[data-hub-open-pdp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abrirPaginaProduto(btn.getAttribute("data-hub-open-pdp"));
      });
    });

    // Clicar na foto ou nome de uma cor na grade da extensão -> abre a página daquele filamento já naquela cor!
    rootEl.querySelectorAll("[data-hub-open-color-pdp]").forEach((el) => {
      el.addEventListener("click", () => {
        const itemId = el.getAttribute("data-hub-open-color-pdp");
        const corIdx = Number(el.getAttribute("data-hub-color-idx") || 0);
        abrirPaginaProduto(itemId, { corIdxInicial: corIdx });
      });
    });

    // Botão "+ Adicionar ao Pedido" direto em qualquer cor da extensão!
    rootEl.querySelectorAll("[data-hub-quick-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.getAttribute("data-hub-quick-add");
        const corIdx = Number(btn.getAttribute("data-hub-color-idx") || 0);
        const marca = btn.getAttribute("data-hub-brand") || "MaxPrint";
        const item = window.SITE_DATA.catalogo.find((i) => i.id === itemId);
        if (!item) return;
        const isBambu = marca === "Bambu Lab";
        const paleta = obterPaletaPorChave(item.usaCoresDinamicas, isBambu) || [];
        const corObj = paleta[corIdx] || paleta[0];
        if (!corObj) return;

        const apresentacao = isBambu
          ? (corObj.nome || "").toLowerCase().includes("refil")
            ? "1KG Refil RFID"
            : "1KG Carretel RFID"
          : "1KG";

        adicionarItemNaCaixa(item.id, btn, {
          marca,
          detalhe1: apresentacao,
          corObj,
          qtd: 1
        });
      });
    });
  }

  // 3. Renderiza todas as seções do catálogo
  function renderizarCatalogoCompleto() {
    const container = document.getElementById("catalog-sections-container");
    if (!container) return;

    const secoesParaExibir =
      state.categoriaMenu === "todos"
        ? secoesDefinicao
        : secoesDefinicao.filter((s) => s.id === state.categoriaMenu);

    const htmlSecoes = secoesParaExibir
      .map((sec) => {
        let itensSecao = window.SITE_DATA.catalogo.filter((item) => {
          if (item.categoria !== sec.id) return false;

          // Se for a seção de filamentos e houver filtro de marca ativo (Bambu Lab ou MaxPrint)
          if (
            sec.id === "filamentos" &&
            state.marcaFilamentoFiltro !== "todos" &&
            item.marca !== state.marcaFilamentoFiltro &&
            !(state.marcaFilamentoFiltro === "MaxPrint" && item.marca === "Masterprint")
          ) {
            return false;
          }

          // Filtro de busca (busca no nome, subtítulo, marca e também nas cores/códigos da paleta)
          if (state.busca.trim() !== "") {
            const termo = state.busca.toLowerCase();
            let textoCores = "";
            if (item.tipoFilamento) {
              const paleta = obterPaletaPorChave(item.usaCoresDinamicas, false) || [];
              textoCores = paleta.map((c) => `${c.nome} ${c.cod} cod ${c.cod} cód ${c.cod}`).join(" ");
            }
            const alvo = `${item.nome} ${item.subtitulo} ${item.marca} ${textoCores}`.toLowerCase();
            if (!alvo.includes(termo)) return false;
          }

          return true;
        });

        if (itensSecao.length === 0) return "";

        // Se for a seção de Filamentos, renderiza o Hub Organizado por Marca (Masterprint vs Bambu Lab + Extensão Completa)
        if (sec.id === "filamentos") {
          return `
            <section class="category-section-block" id="sec-filamentos">
              <div class="category-section-header">
                <h2>${sec.titulo}</h2>
                <div class="category-header-right">
                  <span>Escolha a marca: Masterprint ou Bambu Lab</span>
                </div>
              </div>
              ${gerarHubFilamentosHtml("catalogo")}
            </section>
          `;
        }

        const sorteioBannerHtml =
          sec.id === "impressoras" ? gerarBannerPromocionalSecaoHtml() : "";
        const btnCompararHtml =
          sec.id === "impressoras"
            ? `<button type="button" class="btn-compare-printers-pill" data-open-printer-compare="1">⚖️ Comparar Impressoras</button>`
            : "";

        return `
          <section class="category-section-block" id="sec-${sec.id}">
            <div class="category-section-header">
              <h2>${sec.titulo}</h2>
              <div class="category-header-right">
                ${btnCompararHtml}
                <span>${itensSecao.length} ${itensSecao.length === 1 ? "opção" : "opções"}</span>
              </div>
            </div>
            <div class="combo-products-row">
              ${itensSecao.map((item) => gerarCardHTML(item)).join("")}
            </div>
            ${sorteioBannerHtml}
          </section>
        `;
      })
      .join("");

    const termoBuscado = state.busca.trim();
    const waConsultaUrl = `https://wa.me/5544991351318?text=${encodeURIComponent(
      `Olá Loja SJ 3D! Procurei por "${termoBuscado || "um produto"}" no site e gostaria de saber se vocês têm disponível em Umuarama!`
    )}`;

    container.innerHTML =
      htmlSecoes ||
      `
        <div class="catalog-empty-state">
          <div class="catalog-empty-icon">🔍</div>
          <h3>Nenhum produto encontrado${termoBuscado ? ` para "${termoBuscado}"` : ""}</h3>
          <p>Tente buscar por outro nome, código de cor (ex: <strong>CÓD. 34</strong>, <strong>Silk</strong>, <strong>A1 Mini</strong>) ou fale com nossa equipe em Umuarama.</p>
          <div class="catalog-empty-actions">
            <button type="button" class="btn-empty-reset" id="btn-empty-reset-search">
              ↺ Limpar Busca e Ver Todo o Catálogo
            </button>
            <a href="${waConsultaUrl}" target="_blank" rel="noopener" class="btn-empty-whatsapp">
              💬 Consultar no WhatsApp (44) 99135-1318
            </a>
          </div>
        </div>
      `;

    container.querySelector("#btn-empty-reset-search")?.addEventListener("click", () => {
      state.busca = "";
      state.marcaFilamentoFiltro = "todos";
      const s1 = document.getElementById("global-search-input");
      const s2 = document.getElementById("inline-search-input");
      const c1 = document.getElementById("global-search-clear-btn");
      const c2 = document.getElementById("inline-search-clear-btn");
      if (s1) s1.value = "";
      if (s2) s2.value = "";
      if (c1) c1.style.display = "none";
      if (c2) c2.style.display = "none";
      document.querySelectorAll("[data-filament-brand]").forEach((b) => {
        b.classList.toggle("active", b.dataset.filamentBrand === "todos");
      });
      renderizarCatalogoCompleto();
    });

    vincularEventosDosCards(container);
    vincularEventosHubFilamentos(container, "catalogo");
  }

  // 4. Eventos interativos dos cards
  function vincularEventosDosCards(container) {
    // Troca de cor nos filamentos -> atualiza foto, miniatura do catálogo, preço R$, CÓD. e bolinhas de cor
    container.querySelectorAll("select[data-color-select]").forEach((selectEl) => {
      selectEl.addEventListener("change", (e) => {
        const itemId = e.target.dataset.colorSelect;
        const selectedIndex = e.target.selectedIndex;
        const opt = e.target.options[selectedIndex];
        if (!opt) return;

        const filtro = opt.dataset.filtro || "none";
        const fotoDireta = opt.dataset.fotoDireta === "1";
        const imgCatalogo = opt.dataset.imgCatalogo || "";
        const imgBase = opt.dataset.imgBase || "";
        const preco = opt.dataset.preco || "";
        const cod = opt.dataset.cod || "";

        const imgEl = document.getElementById(`img-${itemId}`);
        if (imgEl) {
          if (fotoDireta && imgCatalogo) {
            imgEl.src = imgCatalogo;
            imgEl.style.filter = "none";
          } else {
            if (imgBase && imgEl.src.indexOf(imgBase) === -1) {
              imgEl.src = imgBase;
            }
            imgEl.style.filter = filtro;
          }
        }

        const thumbEl = document.getElementById(`thumb-${itemId}`);
        if (thumbEl && imgCatalogo) {
          thumbEl.src = imgCatalogo;
        }

        const priceValEl = document.getElementById(`price-val-${itemId}`);
        if (priceValEl && preco) {
          priceValEl.textContent = preco;
        }

        const codBadgeEl = document.getElementById(`cod-badge-${itemId}`);
        if (codBadgeEl && cod) {
          codBadgeEl.textContent = `CÓD. ${cod}`;
        }

        const swatchesContainer = document.getElementById(`swatches-${itemId}`);
        if (swatchesContainer) {
          swatchesContainer.querySelectorAll(".color-swatch-dot").forEach((dot) => {
            dot.classList.toggle("active", Number(dot.dataset.swatchIndex) === selectedIndex);
          });
        }
      });
    });

    // Clique direto nas bolinhas de cor (Swatches UX Pro Max)
    container.querySelectorAll("[data-swatch-card]").forEach((dotBtn) => {
      dotBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = dotBtn.dataset.swatchCard;
        const idx = Number(dotBtn.dataset.swatchIndex);
        const sel2El = document.getElementById(`sel2-${itemId}`);
        if (sel2El && sel2El.options[idx]) {
          sel2El.selectedIndex = idx;
          sel2El.dispatchEvent(new Event("change"));
        }
      });
    });

    // Quando mudar no seletor 1 (Carretel vs Refil nos Filamentos OU À Vista vs 10x nas Impressoras)
    container.querySelectorAll("select[data-type-select]").forEach((sel1El) => {
      sel1El.addEventListener("change", (e) => {
        const itemId = e.target.dataset.typeSelect;
        const val = e.target.value;
        const cardEl = sel1El.closest(".combo-filament-card");

        // Se for uma Impressora 3D, atualiza o preço em destaque entre À Vista e 10x!
        if (cardEl && cardEl.hasAttribute("data-vista-txt")) {
          const priceValEl = document.getElementById(`price-val-${itemId}`);
          const priceSubEl = document.getElementById(`price-sub-${itemId}`);
          if (val.includes("10x")) {
            if (priceValEl) priceValEl.textContent = cardEl.getAttribute("data-parc-main") || "";
            if (priceSubEl) priceSubEl.textContent = cardEl.getAttribute("data-parc-sub") || "";
          } else {
            if (priceValEl) priceValEl.textContent = cardEl.getAttribute("data-vista-txt") || "";
            if (priceSubEl) priceSubEl.textContent = cardEl.getAttribute("data-vista-sub") || "";
          }
          return;
        }

        const sel2El = document.getElementById(`sel2-${itemId}`);
        if (!sel2El || !sel2El.hasAttribute("data-color-select")) return;

        if (val.includes("Refil")) {
          const idxRefil = Array.from(sel2El.options).findIndex((o) =>
            (o.dataset.nome || "").toLowerCase().includes("refil")
          );
          if (idxRefil >= 0) {
            sel2El.selectedIndex = idxRefil;
            sel2El.dispatchEvent(new Event("change"));
          }
        } else if (val === "1KG" || val.includes("Carretel")) {
          const optAtual = sel2El.options[sel2El.selectedIndex];
          if (optAtual && (optAtual.dataset.nome || "").toLowerCase().includes("refil")) {
            sel2El.selectedIndex = 0;
            sel2El.dispatchEvent(new Event("change"));
          }
        }
      });
    });

    // Alternar marca Bambu Lab <-> MaxPrint direto dentro do card de filamento
    container.querySelectorAll("[data-switch-card]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.switchCard;
        const novaMarca = btn.dataset.brand;
        state.marcaNoCardOverride[itemId] = novaMarca;
        renderizarCatalogoCompleto();
      });
    });

    // Botão "Adicionar ao Pedido"
    container.querySelectorAll("[data-add-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        adicionarItemNaCaixa(btn.dataset.addItem, btn);
      });
    });

    // Abrir Página Interna do Produto (estilo Anycubic) ao clicar na foto ou título do card
    container.querySelectorAll("[data-open-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        const itemId = el.dataset.openModal;
        const sel1 = document.getElementById(`sel1-${itemId}`);
        const sel2 = document.getElementById(`sel2-${itemId}`);
        abrirPaginaProduto(itemId, {
          corIdxInicial: sel2 ? sel2.selectedIndex : 0,
          opcao1Inicial: sel1 ? sel1.value : null
        });
      });
    });

    // Atalho rápido Admin: Editar Produto direto pelo botão no card
    container.querySelectorAll("[data-admin-edit-prod]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const prodId = btn.dataset.adminEditProd;
        abrirPainelAdminCms("produtos", prodId);
      });
    });

    // Atalho rápido Admin: Editar Banner de Promoção direto pelo banner
    container.querySelectorAll("[data-admin-edit-banner]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirPainelAdminCms("banner");
      });
    });
  }

  // 5. Adiciona qualquer item do catálogo (Filamento, Impressora, Peça ou Manutenção) na Caixa Lateral
  function adicionarItemNaCaixa(itemId, btnEl, customConfig) {
    const item = window.SITE_DATA.catalogo.find((i) => i.id === itemId);
    if (!item) return;

    const marcaEfetiva =
      (customConfig && customConfig.marca) ||
      state.marcaNoCardOverride[item.id] ||
      item.marca;

    const sel1 = document.getElementById(`sel1-${item.id}`);
    const sel2 = document.getElementById(`sel2-${item.id}`);

    const valor1 =
      customConfig && customConfig.detalhe1 !== undefined
        ? customConfig.detalhe1
        : sel1
          ? sel1.value
          : "";
    const qtdAdicionar =
      customConfig && customConfig.qtd ? Number(customConfig.qtd) : 1;

    let valor2 = "";
    let corHex = "#F04E23";
    let precoUnitario = Number(item.precoVistaValor || 0);
    let precoTexto = item.precoVista || "";
    let codItem = "";

    if (customConfig && customConfig.corObj) {
      const c = customConfig.corObj;
      codItem = c.cod || "";
      precoTexto = c.preco || item.precoVista || "";
      precoUnitario = Number(c.valor || 0);
      valor2 = `${c.nome}${codItem ? ` (CÓD. ${codItem})` : ""}`;
      corHex = c.hex || "#F04E23";
    } else if (item.tipoFilamento && sel2) {
      const opt = sel2.options[sel2.selectedIndex];
      codItem = opt?.dataset.cod || "";
      precoTexto = opt?.dataset.preco || item.precoVista || "";
      precoUnitario = Number(opt?.dataset.valor || 0);
      valor2 = `${opt.dataset.nome}${codItem ? ` (CÓD. ${codItem})` : ""}`;
      corHex = opt.dataset.hex || "#F04E23";
    } else if (customConfig && customConfig.detalhe2) {
      valor2 = customConfig.detalhe2;
      corHex = item.categoria === "impressoras" ? "#111111" : "#F04E23";
    } else if (sel2) {
      valor2 = sel2.value;
      corHex = item.categoria === "impressoras" ? "#111111" : "#F04E23";
    }

    // Se for uma Impressora 3D e o cliente escolheu a opção "10x", usa o valor/texto parcelado correspondente
    if (item.categoria === "impressoras" && String(valor1).toLowerCase().includes("10x")) {
      const dadosImp = extrairDadosParcelamentoImpressora(item);
      if (dadosImp.parceladoValorTotal > 0) {
        precoUnitario = dadosImp.parceladoValorTotal;
        precoTexto = dadosImp.parceladoMain;
      }
    }

    let nomeExibicao = item.nome;
    if (item.tipoFilamento && item.permiteTrocarMarcaNoCard) {
      if (item.id.includes("petg")) {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "Filamento Bambu Lab RFID" : "PETG Masterprint";
      } else if (item.id.includes("silk")) {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "PLA Bambu Lab RFID" : "PLA Silk Masterprint";
      } else {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "PLA Bambu Lab RFID" : "PLA Masterprint";
      }
    }

    const chaveUnica = `${item.id}-${marcaEfetiva}-${valor1}-${valor2}`;
    const existente = state.itensCaixa.find((i) => i.chave === chaveUnica);

    if (existente) {
      existente.qtd += qtdAdicionar;
    } else {
      state.itensCaixa.push({
        chave: chaveUnica,
        id: item.id,
        nome: nomeExibicao,
        marca: marcaEfetiva,
        detalhe1: valor1,
        detalhe2: valor2,
        cod: codItem,
        precoUnitario,
        precoTexto,
        corHex,
        isFilamento: Boolean(item.tipoFilamento),
        qtd: qtdAdicionar
      });
    }

    // Feedback rápido no botão clicado
    if (btnEl) {
      const textoOriginal = btnEl.textContent;
      btnEl.textContent = "✓ Adicionado ao Pedido!";
      btnEl.classList.add("added-feedback");
      setTimeout(() => {
        btnEl.textContent = textoOriginal;
        btnEl.classList.remove("added-feedback");
      }, 900);
    }

    atualizarCaixaLateral();
    atualizarMiniResumoNaPaginaProduto();

    mostrarToast(`✓ <strong>${nomeExibicao}</strong> adicionado ao pedido!`, "success", {
      acaoTexto: "Ver Pedido →",
      onClick: () => abrirGavetaPedido()
    });
  }

  // 6. Atualiza a coluna direita ("Seu Pedido Loja SJ"), a Gaveta Deslizante, o rastreador de cupons e a barra flutuante
  function atualizarCaixaLateral() {
    salvarPedidoNoStorage();

    const pillEl = document.getElementById("added-count-pill");
    const listEl = document.getElementById("box-items-list");
    const totalEl = document.getElementById("side-box-total");
    const trackerEl = document.getElementById("raffle-coupons-tracker");
    const topBagBadge = document.getElementById("cart-count-badge");
    const clearBtn = document.getElementById("btn-clear-box");
    const mobileBar = document.getElementById("mobile-floating-cart");
    const mobileCount = document.getElementById("mobile-cart-count");
    const mobileTotal = document.getElementById("mobile-cart-total");

    // Elementos equivalentes na Gaveta Deslizante (Cart Drawer)
    const drawerPillEl = document.getElementById("drawer-added-count-pill");
    const drawerListEl = document.getElementById("drawer-items-list");
    const drawerTotalEl = document.getElementById("drawer-box-total");
    const drawerTrackerEl = document.getElementById("drawer-raffle-coupons-tracker");
    const drawerClearBtn = document.getElementById("drawer-btn-clear-box");

    const totalItens = calcularTotalItensGeral();
    const totalKgFil = calcularTotalKgFilamentos();
    const valorTotalEstimado = state.itensCaixa.reduce(
      (acc, item) => acc + Number(item.precoUnitario || 0) * item.qtd,
      0
    );
    const temItensSobConsulta = state.itensCaixa.some(
      (item) => Number(item.precoUnitario || 0) === 0
    );
    const resumoCupons = calcularCuponsSorteio();

    if (topBagBadge) topBagBadge.textContent = totalItens;

    if (clearBtn) {
      clearBtn.style.display = totalItens > 0 ? "inline-flex" : "none";
    }
    if (drawerClearBtn) {
      drawerClearBtn.style.display = totalItens > 0 ? "inline-flex" : "none";
    }

    const textoPill = `<span>✓ ${totalItens} ${totalItens === 1 ? "Item selecionado" : "Itens selecionados"}</span>`;
    if (pillEl) pillEl.innerHTML = textoPill;
    if (drawerPillEl) drawerPillEl.innerHTML = textoPill;

    const cfgBanner = obterConfigBannerPromocao();
    let trackerHtml = "";
    if (cfgBanner.exibirCuponsCarrinho) {
      if (totalItens === 0) {
        trackerHtml = `
          <div class="coupon-tracker-card empty">
            <strong>🎟️ ${cfgBanner.tituloPrincipal ? cfgBanner.tituloPrincipal.replace(/<[^>]*>/g, "") : "Sorteio A1 Mini"}</strong>
            <span>1 cupom a cada R$ 60 em filamentos/peças ou 10 cupons na compra de uma impressora 3D!</span>
          </div>
        `;
      } else {
        const faltaStr =
          resumoCupons.faltaParaProximo > 0
            ? `Faltam <strong>${formatarMoedaBR(resumoCupons.faltaParaProximo)}</strong> em filamentos/peças para ganhar <strong>+1 cupom</strong>!`
            : `Limite máximo de cupons por compra atingido!`;
        trackerHtml = `
          <div class="coupon-tracker-card active">
            <div class="coupon-tracker-top">
              <strong>🎟️ ${resumoCupons.totalCuponsCompra} ${
          resumoCupons.totalCuponsCompra === 1 ? "Cupom no Pedido" : "Cupons no Pedido"
        }</strong>
              <span class="coupon-bonus-tag">+3 grátis no balcão</span>
            </div>
            <div class="coupon-progress-bar">
              <div class="coupon-progress-fill" style="width: ${resumoCupons.progressoPct}%;"></div>
            </div>
            <p class="coupon-tracker-hint">${faltaStr}</p>
          </div>
        `;
      }
    }

    [trackerEl, drawerTrackerEl].forEach((el) => {
      if (!el) return;
      if (!cfgBanner.exibirCuponsCarrinho) {
        el.style.display = "none";
      } else {
        el.style.display = "block";
        el.innerHTML = trackerHtml;
      }
    });

    let textoTotalCaixa = "";
    if (valorTotalEstimado > 0) {
      textoTotalCaixa = `Total Estimado: ${formatarMoedaBR(valorTotalEstimado)}${
        totalKgFil > 0 ? ` (${totalKgFil} kg)` : ""
      }${temItensSobConsulta ? " + sob consulta" : ""}`;
    } else if (totalItens > 0 && temItensSobConsulta) {
      textoTotalCaixa = `Total: ${totalItens} ${totalItens === 1 ? "item" : "itens"} (Valor sob consulta)`;
    } else {
      textoTotalCaixa = `Total: R$ 0,00`;
    }

    if (totalEl) totalEl.textContent = textoTotalCaixa;
    if (drawerTotalEl) drawerTotalEl.textContent = textoTotalCaixa;

    if (mobileBar && mobileCount && mobileTotal) {
      const estaEmTelaSemColunaLateral =
        (state.categoriaMenu === "home" && state.busca.trim() === "") ||
        Boolean(state.produtoDetalheAtivo);
      mobileBar.classList.toggle("visible", totalItens > 0 && !state.emissorAberto);
      mobileBar.classList.toggle(
        "visible-any-screen",
        totalItens > 0 && estaEmTelaSemColunaLateral && !state.emissorAberto
      );
      mobileBar.style.display =
        totalItens > 0 && (estaEmTelaSemColunaLateral || window.innerWidth <= 1120) && !state.emissorAberto
          ? "flex"
          : "";

      const cupomTxt =
        resumoCupons.totalCuponsCompra > 0
          ? ` • 🎟️ ${resumoCupons.totalCuponsCompra} ${
              resumoCupons.totalCuponsCompra === 1 ? "cupom" : "cupons"
            }`
          : "";
      mobileCount.textContent = `${totalItens} ${
        totalItens === 1 ? "item" : "itens"
      }${cupomTxt}`;
      mobileTotal.textContent =
        valorTotalEstimado > 0
          ? formatarMoedaBR(valorTotalEstimado)
          : temItensSobConsulta
            ? "Sob consulta"
            : "";
    }

    const htmlVazio = `
      <div style="font-size:0.8rem; color:var(--text-muted); padding:24px 0; text-align:center;">
        Selecione seus filamentos Bambu Lab ou Masterprint, impressoras ou peças e clique em <strong>Adicionar ao Pedido</strong>.
      </div>
    `;

    const htmlItens =
      state.itensCaixa.length === 0
        ? htmlVazio
        : state.itensCaixa
            .map(
              (item, idx) => `
        <div class="box-item-row">
          <div class="box-item-left">
            <span class="box-color-dot" style="background:${item.corHex};"></span>
            <div>
              <strong style="display:block;">${item.nome}</strong>
              <span style="color:var(--text-muted); display:block;">${item.detalhe2}</span>
              ${
                item.precoUnitario > 0
                  ? `<span style="color:var(--sj-orange); font-weight:700; font-size:0.75rem;">${formatarMoedaBR(
                      item.precoUnitario * item.qtd
                    )} (${item.qtd}x ${item.precoTexto})</span>`
                  : `<span class="cart-consult-badge">Sob consulta • ${item.detalhe1}</span>`
              }
            </div>
          </div>
          <div class="box-item-controls">
            <button type="button" class="box-qty-btn" data-dec="${idx}" aria-label="Diminuir quantidade">-</button>
            <strong>${item.qtd}</strong>
            <button type="button" class="box-qty-btn" data-inc="${idx}" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
      `
            )
            .join("");

    [listEl, drawerListEl].forEach((container) => {
      if (!container) return;
      container.innerHTML = htmlItens;

      container.querySelectorAll("[data-dec]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.dec);
          if (!state.itensCaixa[i]) return;
          state.itensCaixa[i].qtd -= 1;
          if (state.itensCaixa[i].qtd <= 0) state.itensCaixa.splice(i, 1);
          atualizarCaixaLateral();
          atualizarMiniResumoNaPaginaProduto();
        });
      });

      container.querySelectorAll("[data-inc]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.inc);
          if (!state.itensCaixa[i]) return;
          state.itensCaixa[i].qtd += 1;
          atualizarCaixaLateral();
          atualizarMiniResumoNaPaginaProduto();
        });
      });
    });
  }

  // 7. CAPA DO SITE / HOME (ESTRUTURA ESTILO ANYCUBIC OFFICIAL NA PALETA LOJA SJ)
  function renderizarCapaHome() {
    const homeEl = document.getElementById("home-landing-view");
    if (!homeEl) return;

    const cfgBan = obterConfigBannerPromocao();
    const slidePromocional = {
      fullBleedRaffle: true,
      styleBg: gerarEstiloBgBannerPromocao(cfgBan.imagemFundo),
      badge: cfgBan.badge,
      dataSorteio: cfgBan.dataSorteio,
      tituloRaffleKicker: cfgBan.tituloKicker,
      tituloRaffleMain: cfgBan.tituloPrincipal,
      tituloRaffleSub: cfgBan.subtituloPremio,
      precoDestaque: cfgBan.precoDestaque,
      resumoCurtoSorteio: gerarResumoCurtoSorteio(cfgBan),
      btn1Texto: cfgBan.btn1Texto,
      btn1Whatsapp: cfgBan.btn1Url,
      abrirModalRegras: true
    };

    const slidesFixos = [
      {
        badge: "ALTA PERFORMANCE • 4 CABEÇOTES & COREXY FECHADA",
        titulo: "Snapmaker U1 & Bambu Lab P2S Combo",
        subtitulo:
          "Impressão 3D multicolor de última geração na Loja SJ 3D em Umuarama - PR. Em até 10x ou desconto especial à vista.",
        precoDestaque: "A partir de R$ 8.849,00 à vista",
        btn1Texto: "Ver Snapmaker U1 →",
        btn1Item: "imp-snapmaker",
        btn2Texto: "Ver Todas as Impressoras",
        btn2Cat: "impressoras",
        img1: "assets/produtos/impressora-snapmaker_u1.jpg",
        img1Label: "Snapmaker U1 (4 Cabeçotes)",
        img2: "assets/produtos/impressora-p2s_combo.jpg",
        img2Label: "Bambu Lab P2S Combo"
      },
      {
        badge: "CAMPEÃS DE VENDAS • LINHA BAMBU LAB A1",
        titulo: "Bambu Lab A1 Mini & A1 Combo com AMS Lite",
        subtitulo:
          "Calibração 100% automática, alta velocidade de até 500 mm/s e sistema multicor para 4 cores com leitura RFID.",
        precoDestaque: "A1 Mini a partir de R$ 1.961,00 à vista (ou 10x de R$ 217,90)",
        btn1Texto: "Conhecer A1 Combo →",
        btn1Item: "imp-bambu-a1-combo",
        btn2Texto: "Ver A1 Mini",
        btn2Item: "imp-bambu-a1-mini",
        img1: "assets/produtos/impressora-a1_combo.jpg",
        img1Label: "Bambu Lab A1 Combo",
        img2: "assets/produtos/impressora-a1_mini_combo.jpg",
        img2Label: "Bambu Lab A1 Mini Combo"
      },
      {
        badge: "CATÁLOGO OFICIAL • +80 CORES E ACABAMENTOS",
        titulo: "Os Filamentos Mais Bonitos: Bambu Lab RFID & Masterprint",
        subtitulo:
          "PLA Silk Dual/Tri Color, Rainbow, Madeira, Mármore, Glitter, PETG Carbono e Bobinas/Refis com Chip RFID.",
        precoDestaque: "Filamentos 1 kg a partir de R$ 59,90",
        btn1Texto: "Explorar Filamentos →",
        btn1Cat: "filamentos",
        btn2Texto: "Ver PLA Silk Dual/Rainbow",
        btn2Item: "fil-silk-maxprint",
        img1: "assets/produtos/pla-bambulab.jpg",
        img1Label: "PLA Bambu Lab RFID",
        img2: "assets/produtos/pla-maxprint.jpg",
        img2Label: "PLA & Silk Masterprint"
      }
    ];

    const slidesHero = cfgBan.ativo ? [slidePromocional, ...slidesFixos] : slidesFixos;
    if (state.heroSlideAtivo >= slidesHero.length) {
      state.heroSlideAtivo = 0;
    }

    // Filamentos mais bonitos e diferenciados do catálogo de 55 páginas
    const filamentosDestaqueVisual = [
      {
        itemId: "fil-silk-maxprint",
        corIdx: 15,
        nome: "PLA Silk Preto/Laranja Dual",
        efeito: "Bicolor Metálico",
        cod: "75",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_170.jpg"
      },
      {
        itemId: "fil-silk-maxprint",
        corIdx: 19,
        nome: "PLA Silk Rainbow Happy",
        efeito: "Multicor Sedoso",
        cod: "150",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_203.jpg"
      },
      {
        itemId: "fil-silk-maxprint",
        corIdx: 18,
        nome: "PLA Silk Azul/Preto/Roxo Tri",
        efeito: "Tricolor Metálico",
        cod: "142",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_201.jpg"
      },
      {
        itemId: "fil-pla-maxprint",
        corIdx: 33,
        nome: "PLA Rainbow Florescente",
        efeito: "Gradiente Vibrante",
        cod: "83",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_109.jpg"
      },
      {
        itemId: "fil-pla-maxprint",
        corIdx: 30,
        nome: "PLA Mármore Especial",
        efeito: "Textura Pedra Esculpida",
        cod: "124",
        preco: "R$ 79,90",
        img: "assets/produtos/filamentos/img_143.jpg"
      },
      {
        itemId: "fil-pla-maxprint",
        corIdx: 28,
        nome: "PLA Marrom Madeira",
        efeito: "Acabamento Amadeirado",
        cod: "63",
        preco: "R$ 79,90",
        img: "assets/produtos/filamentos/img_87.jpg"
      },
      {
        itemId: "fil-pla-maxprint",
        corIdx: 35,
        nome: "Dreamy Crystal Preto/Vermelho",
        efeito: "Cristal Bicolor",
        cod: "156",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_151.jpg"
      },
      {
        itemId: "fil-pla-bambulab",
        corIdx: 0,
        nome: "PLA Bambu Lab Laranja RFID",
        efeito: "Com Chip RFID p/ AMS",
        cod: "137",
        preco: "R$ 99,90",
        img: "assets/produtos/filamentos/img_237.jpg"
      }
    ];

    const todasImpressoras = window.SITE_DATA.catalogo.filter(
      (i) => i.categoria === "impressoras"
    );
    const todosFilamentos = window.SITE_DATA.catalogo.filter(
      (i) => i.categoria === "filamentos"
    );

    homeEl.innerHTML = `
      <!-- 1. HERO CAROUSEL DE DESTAQUES (PASSA PARA O LADO) -->
      <div class="hero-slider-container" id="hero-slider-container">
        <button type="button" class="admin-quick-edit-btn admin-banner-edit-btn" data-admin-edit-banner="1" title="Editar Banner de Promoções da Capa">
          ✏️ Editar Banner de Promoção
        </button>
        <div class="hero-slides-track" id="hero-slides-track">
          ${slidesHero
        .map(
          (s, idx) => `
              <div class="hero-slide-item ${s.fullBleedRaffle ? "full-bleed-raffle" : ""} ${idx === state.heroSlideAtivo ? "active" : ""}" data-slide-idx="${idx}" style="${s.styleBg || ""}">
                <div class="hero-slide-content">
                  <div class="hero-badges-row">
                    <span class="hero-slide-badge">${s.badge}</span>
                    ${s.dataSorteio
              ? `<span class="hero-raffle-date-badge">📅 ${s.dataSorteio}</span>`
              : ""
            }
                  </div>
                  ${s.tituloRaffleMain
              ? `
                        <div class="raffle-hero-heading-block">
                          <span class="raffle-kicker-line">${s.tituloRaffleKicker}</span>
                          <h1 class="raffle-big-model">${s.tituloRaffleMain}</h1>
                          <span class="raffle-sub-prize">${s.tituloRaffleSub}</span>
                        </div>
                      `
              : `
                        <h1 class="hero-slide-title">${s.titulo}</h1>
                        <p class="hero-slide-desc">${s.subtitulo}</p>
                      `
            }
                  ${s.resumoCurtoSorteio
              ? `
                        <div class="raffle-clean-summary-pill">
                          <span>${s.resumoCurtoSorteio}</span>
                        </div>
                      `
              : `<div class="hero-slide-price-pill">${s.precoDestaque}</div>`
            }
                  <div class="hero-slide-actions">
                    ${s.btn1Whatsapp
              ? `<a href="${s.btn1Whatsapp}" target="_blank" rel="noopener" class="hero-btn-primary">${s.btn1Texto}</a>`
              : s.btn1Item
                ? `<button type="button" class="hero-btn-primary" data-home-open-item="${s.btn1Item}">${s.btn1Texto}</button>`
                : `<button type="button" class="hero-btn-primary" data-home-go-cat="${s.btn1Cat}">${s.btn1Texto}</button>`
            }
                    ${s.abrirModalRegras
              ? `<button type="button" class="btn-raffle-saiba-mais" data-open-raffle-modal="1">✨ Saiba Mais / Como Participar</button>`
              : s.btn2Url
                ? `<a href="${s.btn2Url}" target="_blank" rel="noopener" class="hero-btn-secondary">${s.btn2Texto}</a>`
                : s.btn2Item
                  ? `<button type="button" class="hero-btn-secondary" data-home-open-item="${s.btn2Item}">${s.btn2Texto}</button>`
                  : `<button type="button" class="hero-btn-secondary" data-home-go-cat="${s.btn2Cat}">${s.btn2Texto}</button>`
            }
                  </div>
                  ${s.fullBleedRaffle
              ? `
                        <div class="raffle-clean-store-footnote">
                          📍 Loja Física em Umuarama - PR: Av. Portugal, 6759 — Zona I-A • <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener">@lojasj3d</a>
                        </div>
                      `
              : ""
            }
                </div>

                ${s.fullBleedRaffle
              ? `<div class="hero-raffle-art-spacer" aria-hidden="true"></div>`
              : `
                      <div class="hero-slide-visuals ${s.imgUnica ? "single-visual" : ""}">
                        ${s.imgUnica
                ? `
                              <div class="hero-visual-card single" data-home-go-cat="impressoras">
                                <img src="${s.imgUnica}" alt="${s.img1Label}" />
                              </div>
                            `
                : `
                              <div class="hero-visual-card" ${s.btn1Item ? `data-home-open-item="${s.btn1Item}"` : `data-home-go-cat="${s.btn1Cat || "impressoras"}"`
                }>
                                <img src="${s.img1}" alt="${s.img1Label}" />
                                <span>${s.img1Label}</span>
                              </div>
                              <div class="hero-visual-card" ${s.btn2Item ? `data-home-open-item="${s.btn2Item}"` : `data-home-go-cat="${s.btn2Cat || "filamentos"}"`
                }>
                                <img src="${s.img2}" alt="${s.img2Label}" />
                                <span>${s.img2Label}</span>
                              </div>
                            `
              }
                      </div>
                    `
            }
              </div>
            `
        )
        .join("")}
        </div>

        <!-- Setas Laterais e Indicadores do Carrossel -->
        <button type="button" class="hero-arrow-btn prev" id="hero-prev-btn" aria-label="Banner anterior">‹</button>
        <button type="button" class="hero-arrow-btn next" id="hero-next-btn" aria-label="Próximo banner">›</button>

        <div class="hero-dots-bar" id="hero-dots-bar">
          ${slidesHero
        .map(
          (_, idx) => `
              <button
                type="button"
                class="hero-dot-btn ${idx === state.heroSlideAtivo ? "active" : ""}"
                data-hero-dot="${idx}"
                aria-label="Ir para o destaque ${idx + 1}"
              ></button>
            `
        )
        .join("")}
        </div>
      </div>

      <!-- 2. FAIXA DE DIFERENCIAIS LOJA SJ 3D (ESTILO ANYCUBIC) -->
      <div class="home-benefits-strip">
        <div class="home-benefit-card">
          <strong>Pronta Entrega em Umuarama</strong>
          <span>Av. Portugal, 6759 — retire na hora ou receba rápido</span>
        </div>
        <div class="home-benefit-card">
          <strong>Até 10x ou Desconto à Vista</strong>
          <span>Condições oficiais em impressoras Bambu Lab & Snapmaker</span>
        </div>
        <div class="home-benefit-card">
          <strong>+80 Cores de Filamentos</strong>
          <span>Bambu Lab RFID e Masterprint 1.75 mm lacrados a vácuo</span>
        </div>
        <div class="home-benefit-card">
          <strong>Assistência Técnica Própria</strong>
          <span>Manutenção preventiva, corretiva e upgrades em Umuarama</span>
        </div>
      </div>

      <!-- 3. NAVEGUE POR CATEGORIA (4 CARDS VISUAIS ESTILO ANYCUBIC) -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">ECOSISTEMA LOJA SJ 3D</span>
            <h2>Explore por Categoria</h2>
          </div>
          <button type="button" class="pdp-back-btn" data-home-go-cat="todos">Ver Catálogo Completo →</button>
        </div>

        <div class="home-categories-grid">
          <div class="home-cat-card" data-home-go-cat="impressoras">
            <div class="home-cat-img-wrap">
              <img src="assets/produtos/impressora-a1_combo.jpg" alt="Impressoras 3D" loading="lazy" />
            </div>
            <div class="home-cat-info">
              <h3>Impressoras 3D</h3>
              <p>Bambu Lab A1 Mini, A1, P2S Combo & Snapmaker U1</p>
              <span class="home-cat-cta">Explorar Impressoras →</span>
            </div>
          </div>

          <div class="home-cat-card" data-home-go-cat="filamentos">
            <div class="home-cat-img-wrap">
              <img src="assets/produtos/pla-bambulab.jpg" alt="Filamentos 3D" loading="lazy" />
            </div>
            <div class="home-cat-info">
              <h3>Filamentos 3D</h3>
              <p>Bambu Lab RFID & Masterprint (PLA, Silk, PETG, TPU, ABS)</p>
              <span class="home-cat-cta">Explorar Filamentos →</span>
            </div>
          </div>

          <div class="home-cat-card" data-home-go-cat="pecas">
            <div class="home-cat-img-wrap">
              <img src="assets/produtos/peca-hotend.jpg" alt="Peças e Acessórios" loading="lazy" />
            </div>
            <div class="home-cat-info">
              <h3>Peças & Acessórios</h3>
              <p>Hotends Quick-Swap, Placas PEI Dupla Face e Tubos PTFE</p>
              <span class="home-cat-cta">Explorar Peças →</span>
            </div>
          </div>

          <div class="home-cat-card" data-home-go-cat="manutencao">
            <div class="home-cat-img-wrap">
              <img src="assets/produtos/impressora-p2s_combo.jpg" alt="Serviços e Manutenção" loading="lazy" />
            </div>
            <div class="home-cat-info">
              <h3>Serviços & Manutenção</h3>
              <p>Revisão preventiva, reparo de AMS, calibração e upgrades</p>
              <span class="home-cat-cta">Ver Serviços →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. IMPRESSORAS EM DESTAQUE (COM ABAS ESTILO ANYCUBIC) -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">CATÁLOGO DE IMPRESSORAS</span>
            <h2>As Melhores Impressoras 3D do Mercado</h2>
          </div>
          <div class="home-tabs-row" id="home-printer-tabs">
            <button type="button" class="home-tab-btn active" data-printer-tab="todas">Todas (6)</button>
            <button type="button" class="home-tab-btn" data-printer-tab="COMECE A CRIAR">Comece a Criar</button>
            <button type="button" class="home-tab-btn" data-printer-tab="EVOLUA SUA PRODUÇÃO">Evolua sua Produção</button>
            <button type="button" class="home-tab-btn" data-printer-tab="ALTA PERFORMANCE">Alta Performance</button>
            <button type="button" class="btn-compare-printers-pill" data-open-printer-compare="1">⚖️ Comparar Modelos</button>
          </div>
        </div>

        <div class="combo-products-row" id="home-printers-grid">
          ${todasImpressoras.map((imp) => gerarCardHTML(imp)).join("")}
        </div>
      </div>

      <!-- 5. VITRINE ORGANIZADA DE FILAMENTOS: SEPARAÇÃO DESTACADA MASTERPRINT vs BAMBU LAB + EXTENSÃO COMPLETA -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">FILAMENTOS 3D</span>
            <h2>Escolha a Marca: Masterprint ou Bambu Lab</h2>
          </div>
          <button type="button" class="pdp-back-btn" data-home-go-cat="filamentos">Abrir Catálogo de Filamentos →</button>
        </div>

        ${gerarHubFilamentosHtml("home")}
      </div>

      <!-- 6. BANNER ÚNICO E CLEAN DO SORTEIO / PROMOÇÃO NO FECHAMENTO DA CAPA -->
      ${gerarBannerPromocionalSecaoHtml()}
    `;

    // Botão Admin Rápido nos banners da Home
    homeEl.querySelectorAll("[data-admin-edit-banner]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        abrirPainelAdminCms("banner");
      });
    });

    // Lógica de troca de slide do Hero Carousel
    function irParaSlideHero(novoIdx) {
      const total = slidesHero.length;
      state.heroSlideAtivo = (novoIdx + total) % total;
      homeEl.querySelectorAll(".hero-slide-item").forEach((el, i) => {
        el.classList.toggle("active", i === state.heroSlideAtivo);
      });
      homeEl.querySelectorAll(".hero-dot-btn").forEach((dot, i) => {
        dot.classList.toggle("active", i === state.heroSlideAtivo);
      });
    }

    function iniciarAutoSlide() {
      if (state.heroTimer) clearInterval(state.heroTimer);
      state.heroTimer = setInterval(() => {
        if (state.categoriaMenu === "home" && !state.produtoDetalheAtivo) {
          irParaSlideHero(state.heroSlideAtivo + 1);
        }
      }, 5500);
    }

    iniciarAutoSlide();

    const sliderBox = document.getElementById("hero-slider-container");
    sliderBox?.addEventListener("mouseenter", () => {
      if (state.heroTimer) clearInterval(state.heroTimer);
    });
    sliderBox?.addEventListener("mouseleave", () => iniciarAutoSlide());

    // Suporte a swipe no celular (arrastar para os lados no carrossel)
    let touchStartX = 0;
    let touchEndX = 0;
    sliderBox?.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        if (state.heroTimer) clearInterval(state.heroTimer);
      },
      { passive: true }
    );
    sliderBox?.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        iniciarAutoSlide();
        if (touchStartX - touchEndX > 45) {
          irParaSlideHero(state.heroSlideAtivo + 1);
        } else if (touchEndX - touchStartX > 45) {
          irParaSlideHero(state.heroSlideAtivo - 1);
        }
      },
      { passive: true }
    );

    document.getElementById("hero-prev-btn")?.addEventListener("click", () => {
      irParaSlideHero(state.heroSlideAtivo - 1);
    });
    document.getElementById("hero-next-btn")?.addEventListener("click", () => {
      irParaSlideHero(state.heroSlideAtivo + 1);
    });
    homeEl.querySelectorAll("[data-hero-dot]").forEach((dot) => {
      dot.addEventListener("click", () => {
        irParaSlideHero(Number(dot.dataset.heroDot));
      });
    });

    // Clique em botões que abrem uma categoria específica do menu
    homeEl.querySelectorAll("[data-home-go-cat]").forEach((el) => {
      el.addEventListener("click", () => {
        navegarParaCategoria(el.dataset.homeGoCat);
      });
    });

    // Clique em botões do banner que abrem direto a página de um produto
    homeEl.querySelectorAll("[data-home-open-item]").forEach((el) => {
      el.addEventListener("click", () => {
        abrirPaginaProduto(el.dataset.homeOpenItem);
      });
    });

    // Clique nos cards visuais dos Filamentos Mais Bonitos -> abre a página já naquela cor!
    homeEl.querySelectorAll("[data-pretty-item]").forEach((card) => {
      card.addEventListener("click", () => {
        const itemId = card.dataset.prettyItem;
        const corIdx = Number(card.dataset.prettyCor);
        abrirPaginaProduto(itemId, { corIdxInicial: corIdx });
      });
    });

    // Abas de filtro das Impressoras na Home
    homeEl.querySelectorAll("[data-printer-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const grupo = tabBtn.dataset.printerTab;
        homeEl.querySelectorAll("[data-printer-tab]").forEach((b) => b.classList.toggle("active", b === tabBtn));
        const filtradas =
          grupo === "todas"
            ? todasImpressoras
            : todasImpressoras.filter((i) => i.grupoCatalogo === grupo);
        const gridImp = document.getElementById("home-printers-grid");
        if (gridImp) {
          gridImp.innerHTML = filtradas.map((imp) => gerarCardHTML(imp)).join("");
          vincularEventosDosCards(gridImp);
        }
      });
    });

    // Vincula eventos dos cards de impressoras e do Hub de Filamentos na Home
    const printersGrid = document.getElementById("home-printers-grid");
    if (printersGrid) vincularEventosDosCards(printersGrid);
    vincularEventosHubFilamentos(homeEl, "home");
  }

  function atualizarVisaoPrincipal() {
    const homeView = document.getElementById("home-landing-view");
    const pdpView = document.getElementById("product-detail-view");
    const gridView = document.getElementById("catalog-grid-view");
    const quoteView = document.getElementById("quote-studio-view");

    if (pdpView) pdpView.style.display = "none";
    state.produtoDetalheAtivo = null;

    if (quoteView) quoteView.style.display = "none";
    state.emissorAberto = false;

    if (state.categoriaMenu === "home" && state.busca.trim() === "") {
      if (homeView) homeView.style.display = "block";
      if (gridView) gridView.style.display = "none";
    } else {
      if (homeView) homeView.style.display = "none";
      if (gridView) gridView.style.display = "grid";
      atualizarControlesTopo();
      renderizarCatalogoCompleto();
    }
    atualizarCaixaLateral();
  }

  function navegarParaCategoria(cat, updateHistory = true) {
    state.categoriaMenu = cat;
    document.querySelectorAll(".header-nav-link[data-nav-cat]").forEach((l) => {
      l.classList.toggle("active", l.dataset.navCat === cat);
    });
    atualizarVisaoPrincipal();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (updateHistory && window.history && window.history.pushState) {
      window.history.pushState({ view: "cat", cat }, "", cat === "home" ? "#home" : `#cat-${cat}`);
    }
  }

  // 8. PÁGINA INTERNA DO PRODUTO / FILAMENTO (ESTILO ANYCUBIC CLEAN)
  function fecharPaginaProduto(irParaCaixa, updateHistory = true) {
    const pdpView = document.getElementById("product-detail-view");
    if (pdpView) pdpView.style.display = "none";
    state.produtoDetalheAtivo = null;

    if (irParaCaixa) {
      if (state.categoriaMenu === "home") {
        state.categoriaMenu = "todos";
        document.querySelectorAll(".header-nav-link[data-nav-cat]").forEach((l) => {
          l.classList.toggle("active", l.dataset.navCat === "todos");
        });
      }
      atualizarVisaoPrincipal();
      document.getElementById("side-cart-box")?.scrollIntoView({ behavior: "smooth" });
    } else {
      atualizarVisaoPrincipal();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (updateHistory && window.history && window.history.pushState) {
      window.history.pushState(
        { view: "cat", cat: state.categoriaMenu },
        "",
        state.categoriaMenu === "home" ? "#home" : `#cat-${state.categoriaMenu}`
      );
    }
  }

  function atualizarMiniResumoNaPaginaProduto() {
    const box = document.getElementById("pdp-order-bar");
    if (!box) return;
    const totalItens = calcularTotalItensGeral();
    const valorTotal = state.itensCaixa.reduce(
      (acc, i) => acc + Number(i.precoUnitario || 0) * i.qtd,
      0
    );
    if (totalItens === 0) {
      box.style.display = "none";
      return;
    }
    box.style.display = "flex";
    const resumoCupons = calcularCuponsSorteio();
    const cupomTxt =
      resumoCupons.totalCuponsCompra > 0
        ? ` • 🎟️ <strong>${resumoCupons.totalCuponsCompra} ${resumoCupons.totalCuponsCompra === 1 ? "cupom" : "cupons"
        } p/ Sorteio A1 Mini</strong>`
        : "";
    const infoEl = document.getElementById("pdp-order-bar-text");
    if (infoEl) {
      infoEl.innerHTML = `<strong>✓ ${totalItens} ${totalItens === 1 ? "item no Seu Pedido" : "itens no Seu Pedido"
        }</strong>${valorTotal > 0 ? ` • Total: <strong>${formatarMoedaBR(valorTotal)}</strong>` : ""}${cupomTxt}`;
    }
  }

  function abrirPaginaProduto(itemId, opcoesIniciais, updateHistory = true) {
    const item = window.SITE_DATA.catalogo.find((i) => i.id === itemId);
    if (!item) return;

    const pdpView = document.getElementById("product-detail-view");
    const gridView = document.getElementById("catalog-grid-view");
    if (!pdpView || !gridView) return;

    if (updateHistory && window.history && window.history.pushState) {
      window.history.pushState({ view: "pdp", itemId }, "", `#produto-${itemId}`);
    }

    state.produtoDetalheAtivo = item.id;
    const marcaAtual = state.marcaNoCardOverride[item.id] || item.marca;
    const isBambu = marcaAtual === "Bambu Lab";

    let imagemBase = item.imagem;
    let listaCores = null;
    let opcoesSelect1 = item.select1Opcoes || ["Padrão"];
    let tituloPagina = item.nome;

    if (item.tipoFilamento) {
      imagemBase = isBambu
        ? "assets/produtos/pla-bambulab.jpg"
        : "assets/produtos/pla-maxprint.jpg";
      listaCores = obterPaletaPorChave(item.usaCoresDinamicas, isBambu);

      if (item.permiteTrocarMarcaNoCard) {
        opcoesSelect1 = isBambu
          ? ["1KG Carretel RFID (R$ 99,90)", "1KG Refil RFID (R$ 79,90)"]
          : item.select1Opcoes || ["1KG Carretel"];

        if (item.id === "fil-pla-bambulab" || item.id === "fil-pla-maxprint") {
          tituloPagina = isBambu
            ? "Filamento PLA Bambu Lab (Carretel & Refil RFID)"
            : "Filamento PLA Masterprint — 1.75mm (1 kg)";
        } else if (item.id.includes("petg")) {
          tituloPagina = isBambu
            ? "Filamento Bambu Lab RFID — 1.75mm"
            : "Filamento PETG Alta Resistência — 1.75mm (1 kg)";
        } else if (item.id.includes("silk")) {
          tituloPagina = isBambu
            ? "Filamento PLA Bambu Lab Basic & Matte RFID"
            : "Filamento PLA Silk Metalizado & Dual/Tri Color (1 kg)";
        }
      }
    }

    let idxCorAtiva =
      opcoesIniciais && typeof opcoesIniciais.corIdxInicial === "number"
        ? opcoesIniciais.corIdxInicial
        : item.corInicialIndex || 0;
    if (listaCores && (!listaCores[idxCorAtiva] || idxCorAtiva < 0)) {
      idxCorAtiva = 0;
    }

    let corAtiva = listaCores ? listaCores[idxCorAtiva] : null;
    let opcao1Ativa =
      (opcoesIniciais && opcoesIniciais.opcao1Inicial) || opcoesSelect1[0] || "";
    let opcao2Ativa = !item.tipoFilamento && item.select2Opcoes ? item.select2Opcoes[0] : "";
    let qtdAtiva = 1;

    // Se for Refil na Bambu Lab, garante que a opção 1 esteja sincronizada
    if (item.tipoFilamento && isBambu && corAtiva) {
      if ((corAtiva.nome || "").toLowerCase().includes("refil")) {
        opcao1Ativa = opcoesSelect1.find((o) => o.includes("Refil")) || opcoesSelect1[0];
      }
    }

    let imgPrincipalSrc = imagemBase;
    let filtroPrincipal = corAtiva?.filtroCss || "none";
    if (corAtiva?.usaFotoCatalogoDireta && corAtiva?.imgCatalogo) {
      imgPrincipalSrc = corAtiva.imgCatalogo;
      filtroPrincipal = "none";
    }

    const precoUnitarioAtual = corAtiva
      ? Number(corAtiva.valor || 0)
      : Number(item.precoVistaValor || 0);
    const precoTextoAtual = corAtiva?.preco || item.precoVista || "Sob consulta";
    const codAtual = corAtiva?.cod ? `CÓD. ${corAtiva.cod}` : "";
    // 1. SELETORES DE MARCA E MATERIAL DE FILAMENTO (Organização Ultra-Clean)
    let seletorLinhasFilamentoHtml = "";
    let seletor1Html = "";

    if (item.tipoFilamento) {
      // Grupo A: Marca (Masterprint vs Bambu Lab)
      const seletorMarcaHtml = `
        <div class="pdp-option-group">
          <div class="pdp-option-header">
            <span>Marca do Filamento:</span>
            <strong>${isBambu ? "Bambu Lab (RFID Original)" : "Masterprint"}</strong>
          </div>
          <div class="pdp-pills-wrap pdp-brand-switch-row">
            <button type="button" class="pdp-pill-btn ${!isBambu ? "active" : ""}" data-pdp-switch-brand="MaxPrint" title="Filamentos Masterprint">
              <span>Masterprint</span>
            </button>
            <button type="button" class="pdp-pill-btn ${isBambu ? "active" : ""}" data-pdp-switch-brand="Bambu Lab" title="Filamentos Bambu Lab com chip RFID">
              <span class="brand-pill-badge">RFID</span>
              <span>Bambu Lab</span>
            </button>
          </div>
        </div>
      `;

      // Grupo B: Material / Tipo (Exibe apenas as opções da marca escolhida)
      let seletorMaterialHtml = "";
      if (!isBambu) {
        seletorMaterialHtml = `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Tipo / Material (Masterprint):</span>
              <strong>${
                item.id === "fil-pla-maxprint"
                  ? "PLA (40 Cores)"
                  : item.id === "fil-silk-maxprint"
                  ? "PLA Silk Metalizado (21 Cores)"
                  : item.id === "fil-petg-maxprint"
                  ? "PETG Alta Resistência (19 Cores)"
                  : item.id === "fil-tpu-maxprint"
                  ? "TPU Flexível 95A (5 Cores)"
                  : "ABS & Especiais Glitter (6 Cores)"
              }</strong>
            </div>
            <div class="pdp-pills-wrap pdp-material-switch-row">
              <button type="button" class="pdp-pill-btn ${item.id === "fil-pla-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-pla-maxprint" title="Filamento PLA 1kg">
                <span>PLA (40 Cores)</span>
              </button>
              <button type="button" class="pdp-pill-btn ${item.id === "fil-silk-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-silk-maxprint" title="Filamento PLA Silk Metalizado 1kg">
                <span>PLA Silk (21 Cores)</span>
              </button>
              <button type="button" class="pdp-pill-btn ${item.id === "fil-petg-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-petg-maxprint" title="Filamento PETG 1kg">
                <span>PETG (19 Cores)</span>
              </button>
              <button type="button" class="pdp-pill-btn ${item.id === "fil-tpu-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-tpu-maxprint" title="Filamento TPU Flexível 95A 1kg">
                <span>TPU 95A (5 Cores)</span>
              </button>
              <button type="button" class="pdp-pill-btn ${item.id === "fil-abs-especiais" ? "active" : ""}" data-pdp-switch-item="fil-abs-especiais" title="Filamento ABS e Glitter 1kg">
                <span>ABS & Glitter (6 Cores)</span>
              </button>
            </div>
          </div>
        `;
      } else {
        seletorMaterialHtml = `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Tipo / Linha (Bambu Lab):</span>
              <strong>PLA Basic & Matte RFID (13 Cores)</strong>
            </div>
            <div class="pdp-pills-wrap pdp-material-switch-row">
              <button type="button" class="pdp-pill-btn active" data-pdp-switch-item="fil-pla-bambulab" title="PLA Bambu Lab Original">
                <span class="brand-pill-badge">RFID</span>
                <span>PLA Bambu Lab (13 Opções)</span>
              </button>
            </div>
          </div>
        `;
      }

      seletorLinhasFilamentoHtml = seletorMarcaHtml + seletorMaterialHtml;

      // Grupo C: Apresentação (Padrão 1KG para MaxPrint, Carretel/Refil para Bambu Lab)
      if (!isBambu) {
        seletor1Html = `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Apresentação / Peso:</span>
              <strong id="pdp-sel1-label">1KG Carretel Padrão (1.75 mm)</strong>
            </div>
            <div class="pdp-pills-wrap">
              <button type="button" class="pdp-pill-btn active pdp-pill-static">
                ✓ 1KG Carretel Padrão (1.75 mm)
              </button>
            </div>
          </div>
        `;
      } else {
        seletor1Html = `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Apresentação RFID:</span>
              <strong id="pdp-sel1-label">${opcao1Ativa}</strong>
            </div>
            <div class="pdp-pills-wrap" id="pdp-sel1-pills">
              <button type="button" class="pdp-pill-btn ${opcao1Ativa.includes("Carretel") ? "active" : ""}" data-pdp-sel1="1KG Carretel RFID">
                1KG Carretel RFID (R$ 99,90)
              </button>
              <button type="button" class="pdp-pill-btn ${opcao1Ativa.includes("Refil") ? "active" : ""}" data-pdp-sel1="1KG Refil RFID">
                1KG Refil RFID (R$ 79,90)
              </button>
            </div>
          </div>
        `;
      }
    } else {
      // Para produtos normais (impressoras, peças, etc.)
      seletor1Html =
        opcoesSelect1 && opcoesSelect1.length > 0
          ? `
            <div class="pdp-option-group">
              <div class="pdp-option-header">
                <span>${item.select1Label || "Condição:"}</span>
                <strong id="pdp-sel1-label">${opcao1Ativa}</strong>
              </div>
              <div class="pdp-pills-wrap" id="pdp-sel1-pills">
                ${opcoesSelect1
            .map(
              (op) => `
                    <button type="button" class="pdp-pill-btn ${op === opcao1Ativa ? "active" : ""}" data-pdp-sel1="${op}">
                      ${op}
                    </button>
                  `
            )
            .join("")}
              </div>
            </div>
          `
          : "";
    }

    // Seletor 2 (Paleta de Cores Circular com Nome Instantâneo no Hover OU Opções do Produto)
    const seletor2Html =
      item.tipoFilamento && listaCores
        ? `
          <div class="pdp-option-group">
            <div class="pdp-option-header pdp-color-option-header">
              <div class="pdp-color-label-left">
                <span>Cores ${item.nome.replace("Filamento ", "").replace(" — 1.75mm (1 kg)", "")} (${listaCores.length} opções):</span>
              </div>
              <div class="pdp-color-name-highlight" id="pdp-color-name-highlight">
                <span class="pdp-color-dot-indicator" id="pdp-color-dot-indicator" style="background-color: ${corAtiva.hex};"></span>
                <strong id="pdp-color-name-label">${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})</strong>
              </div>
            </div>

            <div class="pdp-swatches-grid" id="pdp-swatches-grid" role="radiogroup" aria-label="Escolher cor do filamento">
              ${listaCores
          .map(
            (cor, idx) => `
                  <button
                    type="button"
                    class="pdp-swatch-circle ${idx === idxCorAtiva ? "active" : ""}"
                    style="background-color: ${cor.hex};"
                    data-pdp-color-idx="${idx}"
                    data-tooltip="${cor.nome} • CÓD. ${cor.cod} (${cor.preco})"
                    data-nome="${cor.nome}"
                    data-cod="${cor.cod}"
                    data-preco="${cor.preco}"
                    data-hex="${cor.hex}"
                    title="${cor.nome} — CÓD. ${cor.cod} (${cor.preco})"
                    aria-label="${cor.nome} — CÓD. ${cor.cod}"
                  ></button>
                `
          )
          .join("")}
            </div>

            <select class="pdp-color-dropdown" id="pdp-color-dropdown" aria-label="Lista completa de cores e códigos">
              ${listaCores
          .map(
            (cor, idx) => `
                  <option value="${idx}" ${idx === idxCorAtiva ? "selected" : ""}>
                    ${cor.nome} — CÓD. ${cor.cod} (${cor.preco})
                  </option>
                `
          )
          .join("")}
            </select>
          </div>
        `
        : item.select2Opcoes
          ? `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Opção / Kit:</span>
              <strong id="pdp-sel2-label">${opcao2Ativa}</strong>
            </div>
            <div class="pdp-pills-wrap" id="pdp-sel2-pills">
              ${item.select2Opcoes
            .map(
              (op) => `
                  <button type="button" class="pdp-pill-btn ${op === opcao2Ativa ? "active" : ""}" data-pdp-sel2="${op}">
                    ${op}
                  </button>
                `
            )
            .join("")}
            </div>
          </div>
        `
          : "";

    // Miniaturas abaixo da imagem principal (Rolo + Peça e Foto Oficial do Catálogo)
    const thumbsHtml =
      item.tipoFilamento && corAtiva
        ? `
          <div class="pdp-thumbs-strip" id="pdp-thumbs-strip">
            <button type="button" class="pdp-thumb-btn active" data-pdp-thumb-mode="rolo" title="Ver Rolo + Peça 3D">
              <img src="${imagemBase}" alt="Rolo e Peça" id="pdp-thumb-rolo-img" style="filter: ${corAtiva.usaFotoCatalogoDireta ? "none" : corAtiva.filtroCss
        };" />
              <span>Rolo + Peça</span>
            </button>
            ${corAtiva.imgCatalogo
          ? `
                  <button type="button" class="pdp-thumb-btn" data-pdp-thumb-mode="catalogo" title="Ver Peça Oficial do Catálogo Loja SJ">
                    <img src="${corAtiva.imgCatalogo}" alt="Amostra Oficial do Catálogo" id="pdp-thumb-cat-img" />
                    <span>Peça do Catálogo</span>
                  </button>
                `
          : ""
        }
          </div>
        `
        : "";

    // Blocos limpos de parâmetros abaixo da dobra (estilo Anycubic)
    const fichasEntries = Object.entries(item.fichaTecnica || {});
    const metricasRapidas = item.tipoFilamento
      ? [
        { label: "Diâmetro & Precisão", val: "1.75 mm ± 0.02 mm" },
        {
          label: "Temperatura do Bico",
          val: item.fichaTecnica?.["Temperatura do Bico"] || "190 °C a 225 °C"
        },
        {
          label: "Temperatura da Mesa",
          val: item.fichaTecnica?.["Temperatura da Mesa"] || "50 °C a 65 °C"
        },
        { label: "Peso Líquido", val: "1,0 kg (Lacrado a Vácuo)" }
      ]
      : fichasEntries.slice(0, 4).map(([k, v]) => ({ label: k, val: v }));

    // Outros produtos relacionados para navegação rápida
    const relacionados = window.SITE_DATA.catalogo
      .filter((i) => i.categoria === item.categoria && i.id !== item.id)
      .slice(0, 3);

    pdpView.innerHTML = `
      <!-- Topo: Breadcrumb + Voltar ao Catálogo -->
      <div class="pdp-topbar">
        <nav class="pdp-breadcrumb" aria-label="Navegação estrutural">
          <button type="button" class="pdp-bc-link" id="pdp-bc-home">Catálogo Loja SJ</button>
          <span>/</span>
          <button type="button" class="pdp-bc-link" id="pdp-bc-cat">${item.categoria === "filamentos"
        ? "Filamentos 3D"
        : item.categoria === "impressoras"
          ? "Impressoras 3D"
          : item.categoria === "pecas"
            ? "Peças & Acessórios"
            : "Manutenção 3D"
      }</button>
          <span>/</span>
          <strong class="pdp-bc-current">${tituloPagina}</strong>
        </nav>

        <div style="display:flex; align-items:center; gap:10px;">
          <button type="button" class="admin-quick-edit-btn pdp-admin-edit-btn" id="pdp-admin-edit-btn" title="Editar fotos, preços e descrições deste produto">
            ✏️ Editar Este Produto
          </button>
          <button type="button" class="pdp-back-btn" id="pdp-back-btn">
            ← Voltar ao Catálogo
          </button>
        </div>
      </div>

      <!-- Grade Principal de 2 Colunas (Galeria Esquerda + Configurador Direita) -->
      <div class="pdp-main-grid">

        <!-- COLUNA ESQUERDA: GALERIA CLEAN -->
        <div class="pdp-gallery-col">
          <div class="pdp-main-image-box">
            <span class="pdp-origin-badge">Pronta Entrega • Umuarama PR</span>
            ${codAtual
        ? `<span class="pdp-cod-floating" id="pdp-gallery-cod">${codAtual}</span>`
        : ""
      }
            <img
              src="${imgPrincipalSrc}"
              alt="${tituloPagina}"
              id="pdp-main-img"
              class="${item.tipoFilamento ? "cover-img" : ""}"
              style="filter: ${filtroPrincipal};"
            />
            ${item.tipoFilamento && corAtiva?.imgCatalogo
        ? `<img src="${corAtiva.imgCatalogo}" alt="Amostra do Catálogo" class="pdp-corner-sample" id="pdp-corner-sample" title="Amostra oficial do catálogo Loja SJ" />`
        : ""
      }
          </div>

          ${thumbsHtml}

          <div class="pdp-trust-strip">
            <div class="pdp-trust-item">
              <strong>✓ Alta Precisão</strong>
              <span>Sem bolhas e sem emaranhados</span>
            </div>
            <div class="pdp-trust-item">
              <strong>✓ Estoque Local</strong>
              <span>Av. Portugal, 6759 • Umuarama</span>
            </div>
            <div class="pdp-trust-item">
              <strong>✓ Suporte Loja SJ</strong>
              <span>WhatsApp (44) 99135-1318</span>
            </div>
          </div>
        </div>

        <!-- COLUNA DIREITA: CONFIGURADOR ESTILO ANYCUBIC -->
        <div class="pdp-info-col">
          <div class="pdp-meta-row">
            <span class="pdp-brand-badge">${marcaAtual}</span>
            <span class="pdp-stock-status">● Em estoque para envio / retirada</span>
          </div>

          <h1 class="pdp-title">${tituloPagina}</h1>
          <p class="pdp-subtitle">${item.subtitulo}</p>

          <!-- Bloco de Preço -->
          <div class="pdp-price-card">
            <div class="pdp-price-main-row">
              <span class="pdp-price-label" id="pdp-price-label">${item.tipoFilamento ? "1 KG" : "À VISTA"}</span>
              <strong class="pdp-price-value" id="pdp-price-val">${precoTextoAtual}</strong>
              ${codAtual
        ? `<span class="pdp-cod-pill" id="pdp-info-cod">${codAtual}</span>`
        : ""
      }
            </div>
            ${item.precoParcelado
        ? `<div class="pdp-price-sub-row" id="pdp-price-sub-row">${item.precoParcelado}</div>`
        : ""
      }
          </div>

          <!-- Seletores Interativos -->
          ${seletorLinhasFilamentoHtml}
          ${seletor1Html}
          ${seletor2Html}

          <!-- Quantidade + Botões de Ação -->
          <div class="pdp-actions-block">
            <div class="pdp-qty-and-add">
              <div class="pdp-qty-stepper" aria-label="Quantidade">
                <button type="button" id="pdp-qty-dec" aria-label="Diminuir">−</button>
                <input type="number" id="pdp-qty-input" value="1" min="1" max="99" readonly aria-label="Quantidade selecionada" />
                <button type="button" id="pdp-qty-inc" aria-label="Aumentar">+</button>
              </div>

              <button type="button" class="pdp-btn-add" id="pdp-btn-add">
                Adicionar ao Pedido ${precoUnitarioAtual > 0 ? `— ${formatarMoedaBR(precoUnitarioAtual)}` : ""
      }
              </button>
            </div>

            <div class="pdp-secondary-actions-row">
              <button type="button" class="pdp-btn-whatsapp-now" id="pdp-btn-buy-now">
                Comprar Agora pelo WhatsApp
              </button>
              ${
                item.categoria === "impressoras"
                  ? `<button type="button" class="btn-compare-printers-pill pdp-compare-btn" data-open-printer-compare="1">⚖️ Comparar Impressoras</button>`
                  : ""
              }
            </div>
          </div>

          <!-- Barra de Resumo do Pedido (aparece quando há itens no pedido) -->
          <div class="pdp-order-bar" id="pdp-order-bar" style="display: none;">
            <span id="pdp-order-bar-text"></span>
            <div class="pdp-order-bar-actions">
              <button type="button" class="pdp-order-bar-btn" id="pdp-view-order-btn">Ver Meu Pedido →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- BARRA FIXA DE COMPRA RÁPIDA NO CELULAR DENTRO DA PÁGINA DO PRODUTO -->
      <div class="pdp-mobile-sticky-bar" id="pdp-mobile-sticky-bar">
        <div class="pdp-sticky-left">
          <span class="pdp-sticky-color-dot" id="pdp-sticky-dot" style="background: ${corAtiva ? corAtiva.hex : "#F04E23"};"></span>
          <div class="pdp-sticky-meta">
            <strong id="pdp-sticky-title">${corAtiva ? `${corAtiva.nome} (CÓD. ${corAtiva.cod})` : tituloPagina}</strong>
            <span id="pdp-sticky-price">${precoTextoAtual}</span>
          </div>
        </div>
        <button type="button" class="pdp-sticky-add-btn" id="pdp-sticky-add-btn">
          + Adicionar
        </button>
      </div>

      <!-- ABAIXO DA DOBRA: PARÂMETROS DE IMPRESSÃO & FICHA TÉCNICA CLEAN -->
      <div class="pdp-specs-section">
        <h2 class="pdp-section-heading">Parâmetros Recomendados & Especificações</h2>

        <div class="pdp-metrics-grid">
          ${metricasRapidas
        .map(
          (m) => `
              <div class="pdp-metric-box">
                <span>${m.label}</span>
                <strong>${m.val}</strong>
              </div>
            `
        )
        .join("")}
        </div>

        <div class="pdp-spec-table-wrap">
          <table class="pdp-spec-table">
            <tbody>
              ${fichasEntries
        .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
        .join("")}
            </tbody>
          </table>
        </div>
      </div>

      ${relacionados.length > 0
        ? `
            <div class="pdp-related-section">
              <div class="category-section-header">
                <h2>Outras opções em ${item.categoria === "filamentos" ? "Filamentos 3D" : "nosso Catálogo"
        }</h2>
                <button type="button" class="pdp-back-btn" id="pdp-see-all-btn">Ver todos →</button>
              </div>
              <div class="combo-products-row">
                ${relacionados.map((rel) => gerarCardHTML(rel)).join("")}
              </div>
            </div>
          `
        : ""
      }
    `;

    // Exibe a Página do Produto e oculta a Capa e a Grade Principal
    const homeView = document.getElementById("home-landing-view");
    if (homeView) homeView.style.display = "none";
    gridView.style.display = "none";
    pdpView.style.display = "block";
    atualizarCaixaLateral();
    atualizarMiniResumoNaPaginaProduto();
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Função interna para atualizar preço, foto e textos ao trocar cor, condição ou quantidade na PDP
    function sincronizarEstadoPDP() {
      let precoUnit = corAtiva
        ? Number(corAtiva.valor || 0)
        : Number(item.precoVistaValor || 0);
      let precoTxt = corAtiva?.preco || item.precoVista || "";
      let labelPrecoTopo = item.tipoFilamento ? "1 KG" : "À VISTA";
      let subPrecoTxt = item.precoParcelado || "";

      if (item.categoria === "impressoras") {
        const dadosImp = extrairDadosParcelamentoImpressora(item);
        if (String(opcao1Ativa).toLowerCase().includes("10x")) {
          labelPrecoTopo = "PARCELADO";
          precoTxt = dadosImp.parceladoMain;
          subPrecoTxt = dadosImp.parceladoSub;
          if (dadosImp.parceladoValorTotal > 0) {
            precoUnit = dadosImp.parceladoValorTotal;
          }
        } else {
          labelPrecoTopo = "À VISTA";
          precoTxt = dadosImp.vistaTexto;
          subPrecoTxt = dadosImp.vistaSub;
          precoUnit = dadosImp.vistaValor;
        }
      }

      const codTxt = corAtiva?.cod ? `CÓD. ${corAtiva.cod}` : "";

      const mainImg = document.getElementById("pdp-main-img");
      if (mainImg && corAtiva) {
        if (corAtiva.usaFotoCatalogoDireta && corAtiva.imgCatalogo) {
          mainImg.src = corAtiva.imgCatalogo;
          mainImg.style.filter = "none";
        } else {
          mainImg.src = imagemBase;
          mainImg.style.filter = corAtiva.filtroCss || "none";
        }
      }

      const cornerSample = document.getElementById("pdp-corner-sample");
      if (cornerSample && corAtiva?.imgCatalogo) {
        cornerSample.src = corAtiva.imgCatalogo;
      }

      const thumbRoloImg = document.getElementById("pdp-thumb-rolo-img");
      if (thumbRoloImg && corAtiva) {
        thumbRoloImg.style.filter = corAtiva.usaFotoCatalogoDireta
          ? "none"
          : corAtiva.filtroCss || "none";
      }

      const thumbCatImg = document.getElementById("pdp-thumb-cat-img");
      if (thumbCatImg && corAtiva?.imgCatalogo) {
        thumbCatImg.src = corAtiva.imgCatalogo;
      }

      const priceLblEl = document.getElementById("pdp-price-label");
      if (priceLblEl) priceLblEl.textContent = labelPrecoTopo;

      const priceValEl = document.getElementById("pdp-price-val");
      if (priceValEl && precoTxt) priceValEl.textContent = precoTxt;

      const priceSubEl = document.getElementById("pdp-price-sub-row");
      if (priceSubEl) priceSubEl.textContent = subPrecoTxt;

      const galleryCodEl = document.getElementById("pdp-gallery-cod");
      if (galleryCodEl && codTxt) galleryCodEl.textContent = codTxt;

      const infoCodEl = document.getElementById("pdp-info-cod");
      if (infoCodEl && codTxt) infoCodEl.textContent = codTxt;

      const colorLabelEl = document.getElementById("pdp-color-name-label");
      if (colorLabelEl && corAtiva) {
        colorLabelEl.textContent = `${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})`;
      }

      const dotIndicatorEl = document.getElementById("pdp-color-dot-indicator");
      if (dotIndicatorEl && corAtiva) {
        dotIndicatorEl.style.backgroundColor = corAtiva.hex;
      }

      const addBtnEl = document.getElementById("pdp-btn-add");
      if (addBtnEl) {
        addBtnEl.textContent =
          precoUnit > 0
            ? `Adicionar ao Pedido — ${formatarMoedaBR(precoUnit * qtdAtiva)}`
            : "Adicionar ao Pedido";
      }

      // Sincroniza a Barra Fixa Mobile (Sticky Bar) da PDP
      const stickyDotEl = document.getElementById("pdp-sticky-dot");
      const stickyTitleEl = document.getElementById("pdp-sticky-title");
      const stickyPriceEl = document.getElementById("pdp-sticky-price");
      if (stickyDotEl && corAtiva) {
        stickyDotEl.style.backgroundColor = corAtiva.hex;
      }
      if (stickyTitleEl) {
        stickyTitleEl.textContent = corAtiva
          ? `${corAtiva.nome} (CÓD. ${corAtiva.cod})`
          : `${tituloPagina}${opcao1Ativa ? ` • ${opcao1Ativa}` : ""}`;
      }
      if (stickyPriceEl) {
        stickyPriceEl.textContent =
          precoUnit > 0 && qtdAtiva > 1
            ? `${qtdAtiva}x • ${formatarMoedaBR(precoUnit * qtdAtiva)}`
            : precoTxt;
      }

      // Destaca a bolinha ativa
      pdpView.querySelectorAll(".pdp-swatch-circle").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.pdpColorIdx) === idxCorAtiva);
      });

      const dropEl = document.getElementById("pdp-color-dropdown");
      if (dropEl && Number(dropEl.value) !== idxCorAtiva) {
        dropEl.value = String(idxCorAtiva);
      }
    }

    sincronizarEstadoPDP();

    // Eventos de Voltar ao Catálogo e Ver Pedido na Gaveta
    document.getElementById("pdp-back-btn")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-bc-home")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-bc-cat")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-see-all-btn")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-view-order-btn")?.addEventListener("click", () => abrirGavetaPedido());

    // Alternar entre Marcas (Masterprint vs Bambu Lab) na PDP
    pdpView.querySelectorAll("[data-pdp-switch-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const marca = btn.dataset.pdpSwitchBrand;
        if (marca === "Bambu Lab") {
          abrirPaginaProduto("fil-pla-bambulab");
        } else {
          abrirPaginaProduto("fil-pla-maxprint");
        }
      });
    });

    // Alternar entre materiais/tipos de filamento na PDP
    pdpView.querySelectorAll("[data-pdp-switch-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const novoId = btn.dataset.pdpSwitchItem;
        if (novoId && novoId !== item.id) {
          abrirPaginaProduto(novoId);
        }
      });
    });

    // Alternar entre as miniaturas (Rolo + Peça vs Peça Oficial do Catálogo)
    pdpView.querySelectorAll("[data-pdp-thumb-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pdpView.querySelectorAll("[data-pdp-thumb-mode]").forEach((b) => b.classList.toggle("active", b === btn));
        const mode = btn.dataset.pdpThumbMode;
        const mainImg = document.getElementById("pdp-main-img");
        if (!mainImg || !corAtiva) return;

        if (mode === "catalogo" && corAtiva.imgCatalogo) {
          mainImg.src = corAtiva.imgCatalogo;
          mainImg.style.filter = "none";
        } else {
          sincronizarEstadoPDP();
        }
      });
    });

    // Clique nas pílulas do Seletor 1 (Apresentação / Condição)
    pdpView.querySelectorAll("[data-pdp-sel1]").forEach((btn) => {
      btn.addEventListener("click", () => {
        opcao1Ativa = btn.dataset.pdpSel1;
        const lbl = document.getElementById("pdp-sel1-label");
        if (lbl) lbl.textContent = opcao1Ativa;
        pdpView.querySelectorAll("[data-pdp-sel1]").forEach((b) => b.classList.toggle("active", b === btn));

        // Se for Bambu Lab e clicou em Refil vs Carretel, sincroniza a cor correspondente
        if (item.tipoFilamento && listaCores) {
          if (opcao1Ativa.includes("Refil")) {
            const idxRefil = listaCores.findIndex((c) => (c.nome || "").toLowerCase().includes("refil"));
            if (idxRefil >= 0) {
              idxCorAtiva = idxRefil;
              corAtiva = listaCores[idxCorAtiva];
            }
          } else if (opcao1Ativa.includes("Carretel") && (corAtiva?.nome || "").toLowerCase().includes("refil")) {
            idxCorAtiva = 0;
            corAtiva = listaCores[0];
          }
        }
        sincronizarEstadoPDP();
      });
    });

    // Clique nas pílulas do Seletor 2 (para Impressoras, Peças e Manutenção)
    pdpView.querySelectorAll("[data-pdp-sel2]").forEach((btn) => {
      btn.addEventListener("click", () => {
        opcao2Ativa = btn.dataset.pdpSel2;
        const lbl = document.getElementById("pdp-sel2-label");
        if (lbl) lbl.textContent = opcao2Ativa;
        pdpView.querySelectorAll("[data-pdp-sel2]").forEach((b) => b.classList.toggle("active", b === btn));
        sincronizarEstadoPDP();
      });
    });

    // Interação com as bolinhas circulares de cor: Hover instantâneo e Clique
    const colorLabelEl = document.getElementById("pdp-color-name-label");
    const dotIndicatorEl = document.getElementById("pdp-color-dot-indicator");
    const swatchesGrid = document.getElementById("pdp-swatches-grid");

    pdpView.querySelectorAll("[data-pdp-color-idx]").forEach((swatchBtn) => {
      // Ao passar o mouse em cima da cor -> mostra o nome, CÓD. e preço na hora!
      swatchBtn.addEventListener("mouseenter", () => {
        const nome = swatchBtn.dataset.nome;
        const cod = swatchBtn.dataset.cod;
        const preco = swatchBtn.dataset.preco;
        const hex = swatchBtn.dataset.hex;
        if (colorLabelEl && nome) {
          colorLabelEl.textContent = `${nome} — CÓD. ${cod} (${preco})`;
        }
        if (dotIndicatorEl && hex) {
          dotIndicatorEl.style.backgroundColor = hex;
        }
      });

      // Ao clicar -> seleciona a cor permanentemente
      swatchBtn.addEventListener("click", () => {
        idxCorAtiva = Number(swatchBtn.dataset.pdpColorIdx);
        corAtiva = listaCores[idxCorAtiva];
        sincronizarEstadoPDP();
      });
    });

    // Ao tirar o mouse da grade de cores -> restaura para a cor ativa selecionada
    swatchesGrid?.addEventListener("mouseleave", () => {
      if (corAtiva) {
        if (colorLabelEl) {
          colorLabelEl.textContent = `${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})`;
        }
        if (dotIndicatorEl) {
          dotIndicatorEl.style.backgroundColor = corAtiva.hex;
        }
      }
    });

    // Mudança no dropdown de cor da PDP
    document.getElementById("pdp-color-dropdown")?.addEventListener("change", (e) => {
      idxCorAtiva = Number(e.target.value);
      corAtiva = listaCores[idxCorAtiva];
      sincronizarEstadoPDP();
    });

    // Controle de Quantidade (- 1 +)
    const qtyInput = document.getElementById("pdp-qty-input");
    document.getElementById("pdp-qty-dec")?.addEventListener("click", () => {
      if (qtdAtiva > 1) {
        qtdAtiva -= 1;
        if (qtyInput) qtyInput.value = String(qtdAtiva);
        sincronizarEstadoPDP();
      }
    });
    document.getElementById("pdp-qty-inc")?.addEventListener("click", () => {
      qtdAtiva += 1;
      if (qtyInput) qtyInput.value = String(qtdAtiva);
      sincronizarEstadoPDP();
    });

    // Botão Primário e Botão Sticky Mobile: Adicionar ao Pedido
    const addBtn = document.getElementById("pdp-btn-add");
    const stickyAddBtn = document.getElementById("pdp-sticky-add-btn");
    const dispararAdicaoPDP = (botaoRef) => {
      adicionarItemNaCaixa(item.id, botaoRef, {
        marca: marcaAtual,
        detalhe1: opcao1Ativa,
        detalhe2: opcao2Ativa,
        corObj: corAtiva,
        qtd: qtdAtiva
      });
    };
    addBtn?.addEventListener("click", () => dispararAdicaoPDP(addBtn));
    stickyAddBtn?.addEventListener("click", () => dispararAdicaoPDP(stickyAddBtn));

    // Botão Secundário: Comprar Agora pelo WhatsApp
    document.getElementById("pdp-btn-buy-now")?.addEventListener("click", () => {
      const { whatsapp } = window.SITE_DATA.loja;
      const precoUnit = corAtiva
        ? Number(corAtiva.valor || 0)
        : Number(item.precoVistaValor || 0);
      const detalheCorOuOpcao = corAtiva
        ? `${corAtiva.nome} (CÓD. ${corAtiva.cod} — ${corAtiva.preco})`
        : opcao2Ativa;
      const subtotalStr =
        precoUnit > 0 ? `\n*Valor Total:* ${formatarMoedaBR(precoUnit * qtdAtiva)}` : "";

      const msg = encodeURIComponent(
        `Olá *Loja SJ 3D*! Estou na página do produto e quero pedir:\n\n` +
        `• *${qtdAtiva}x ${tituloPagina}*\n` +
        `• *Opção:* ${opcao1Ativa}\n` +
        `• *Escolha / Cor:* ${detalheCorOuOpcao}${subtotalStr}\n\n` +
        `Pode confirmar a disponibilidade para mim?`
      );
      window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    });

    // Atalho rápido Admin na página de detalhes do produto
    document.getElementById("pdp-admin-edit-btn")?.addEventListener("click", () => {
      abrirPainelAdminCms("produtos", item.id);
    });

    // Vincula também os cards da seção "Outras opções" no rodapé da PDP
    const relatedContainer = pdpView.querySelector(".pdp-related-section");
    if (relatedContainer) {
      vincularEventosDosCards(relatedContainer);
    }
  }

  // =========================================================================
  // 9. SISTEMA DE ORÇAMENTO TIMBRADO OFICIAL GRUPO SJ & LOGIN GOOGLE / DADOS
  // =========================================================================

  const STORAGE_KEY_GOOGLE_USER = "sj_google_user_v1";
  const STORAGE_KEY_ORCAMENTOS = "lojasj3d_orcamentos_salvos_v1";

  // Carrega operador / vendedor salvo localmente ou via Banco de Dados
  function carregarUsuarioGoogle() {
    if (window.SJ_DB && window.SJ_DB.auth) {
      state.usuarioGoogle = window.SJ_DB.auth.getUsuarioAtual();
      window.SJ_DB.auth.onAuthStateChanged((u) => {
        state.usuarioGoogle = u;
        atualizarBadgeUsuarioHeader();
      });
    } else {
      try {
        const raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY_GOOGLE_USER);
        if (raw) {
          state.usuarioGoogle = JSON.parse(raw);
        }
      } catch (_) {}
    }
    atualizarBadgeUsuarioHeader();
  }

  function mostrarFeedbackAuth(tipo, mensagem) {
    const box = document.getElementById("auth-feedback-box");
    if (!box) return;
    box.className = `auth-feedback-box ${tipo}`;
    box.textContent = mensagem;
    box.style.display = "block";
    if (tipo === "error") {
      setTimeout(() => {
        if (box) box.style.display = "none";
      }, 5000);
    }
  }

  async function salvarLoginUsuario(usuario, executarCallback = true) {
    state.usuarioGoogle = usuario;
    if (window.SJ_DB && window.SJ_DB.auth) {
      if (usuario.tipo === "google") {
        await window.SJ_DB.auth.loginGoogle(usuario);
      }
    } else {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(usuario));
        }
      } catch (_) {}
    }

    atualizarBadgeUsuarioHeader();
    fecharModalAuthGoogle();

    if (executarCallback && typeof state.callbackPosLoginGoogle === "function") {
      const cb = state.callbackPosLoginGoogle;
      state.callbackPosLoginGoogle = null;
      cb();
    }
  }

  function fazerLogoutGoogle() {
    state.usuarioGoogle = null;
    if (window.SJ_DB && window.SJ_DB.auth) {
      window.SJ_DB.auth.logout();
    } else {
      try {
        if (window.localStorage) {
          window.localStorage.removeItem(STORAGE_KEY_GOOGLE_USER);
        }
      } catch (_) {}
    }
    atualizarBadgeUsuarioHeader();
    if (state.emissorAberto) {
      fecharEmissorOrcamento();
    }
  }

  function atualizarBadgeUsuarioHeader() {
    const adminTopbar = document.getElementById("admin-vendor-topbar");
    const cartQuoteBtn = document.getElementById("btn-cart-to-quote");
    const drawerQuoteBtn = document.getElementById("drawer-btn-cart-to-quote");
    const nameEl = document.getElementById("admin-topbar-user-name");
    const roleEl = document.getElementById("admin-topbar-user-role");

    document.body.classList.toggle("is-admin-logged-in", Boolean(state.usuarioGoogle));

    if (!state.usuarioGoogle) {
      // Usuário NÃO autenticado -> Site 100% público e limpo (sem barra nem botão de orçamento)
      if (adminTopbar) adminTopbar.style.display = "none";
      if (cartQuoteBtn) cartQuoteBtn.style.display = "none";
      if (drawerQuoteBtn) drawerQuoteBtn.style.display = "none";
    } else {
      // Vendedor AUTENTICADO -> Exibe a Barra Administrativa do Vendedor e o botão no carrinho
      const u = state.usuarioGoogle;
      if (adminTopbar) adminTopbar.style.display = "block";
      if (cartQuoteBtn) cartQuoteBtn.style.display = "flex";
      if (drawerQuoteBtn) drawerQuoteBtn.style.display = "flex";
      if (nameEl) nameEl.textContent = u.nome || "Vendedor";
      if (roleEl) roleEl.textContent = u.cargo || "Vendedor";
    }
  }

  function renderizarChipsVendedoresRapidos() {
    const container = document.getElementById("quick-saved-operators");
    if (!container || !window.SJ_DB || !window.SJ_DB.auth) return;

    const usuarios = window.SJ_DB.auth.listarUsuarios() || [];
    if (usuarios.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = usuarios.slice(0, 4).map((u, idx) => {
      const inicial = (u.nome || "V").charAt(0).toUpperCase();
      const primeiroNome = (u.nome || "Vendedor").split(" ")[0];
      return `
        <button type="button" class="quick-operator-chip" data-quick-user-idx="${idx}" title="Entrar rapidamente como ${u.nome} (${u.email})">
          <span class="quick-operator-chip-avatar">${inicial}</span>
          <span>${primeiroNome}</span>
        </button>
      `;
    }).join("");

    container.querySelectorAll("[data-quick-user-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const u = usuarios[Number(btn.dataset.quickUserIdx)];
        if (!u) return;
        const nameInput = document.getElementById("operator-name-input");
        const emailInput = document.getElementById("operator-email-input");
        if (nameInput) nameInput.value = u.nome;
        if (emailInput) emailInput.value = u.email;
        salvarLoginUsuario({
          id: u.id,
          nome: u.nome,
          email: u.email,
          cargo: u.cargo || "Vendedor",
          foto: u.foto || null,
          tipo: u.tipo || "operador"
        });
      });
    });
  }

  function selecionarAbaModalAuth(tabId) {
    document.querySelectorAll("[data-auth-tab]").forEach((b) => {
      const ativo = b.dataset.authTab === tabId;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-selected", ativo ? "true" : "false");
    });

    const panes = ["pane-auth-google", "pane-auth-email", "pane-auth-register"];
    const paneMap = { google: "pane-auth-google", email: "pane-auth-email", register: "pane-auth-register" };
    panes.forEach((paneId) => {
      const el = document.getElementById(paneId);
      if (el) {
        el.style.display = (paneId === paneMap[tabId]) ? "block" : "none";
      }
    });
  }

  function abrirModalAuthGoogle(callbackApos = null, abaInicial = null) {
    state.callbackPosLoginGoogle = callbackApos;
    const modal = document.getElementById("modal-google-auth");
    if (modal) modal.style.display = "flex";

    const feedbackBox = document.getElementById("auth-feedback-box");
    if (feedbackBox) feedbackBox.style.display = "none";

    if (abaInicial) {
      selecionarAbaModalAuth(abaInicial);
    }

    renderizarChipsVendedoresRapidos();

    try {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.renderButton(
          document.getElementById("google-gis-btn-container"),
          { theme: "outline", size: "large", text: "continue_with", width: 280, shape: "rectangular" }
        );
      }
    } catch (_) {}
  }

  function fecharModalAuthGoogle() {
    const modal = document.getElementById("modal-google-auth");
    if (modal) modal.style.display = "none";
  }

  // Hook global chamado pelo Google Identity Services
  window.onGoogleSignInSuccess = function(response) {
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      salvarLoginUsuario({
        nome: payload.name || "Vendedor Google",
        email: payload.email || "vendedor@lojasj.com.br",
        foto: payload.picture || null,
        tipo: "google"
      });
    } catch (_) {
      salvarLoginUsuario({
        nome: "Thiago Novais (Loja SJ)",
        email: "contato@gruposj.com.br",
        foto: null,
        tipo: "operador"
      });
    }
  };

  // Estado temporário do Assistente de Orçamento (Wizard)
  const wizardState = {
    itens: [],
    metodoPagamento: "pix", // "pix" | "dinheiro" | "debito" | "credito"
    descontoPercentual: 0   // 0 | 5
  };

  function obterItensParaWizard(itensIniciais = null) {
    if (Array.isArray(itensIniciais) && itensIniciais.length > 0) {
      return itensIniciais;
    }
    if (state.itensCaixa && state.itensCaixa.length > 0) {
      return state.itensCaixa.map((item, index) => {
        let desc = item.nome;
        if (item.detalhe1) desc += ` — ${item.detalhe1}`;
        if (item.detalhe2) desc += ` (${item.detalhe2})`;
        return {
          id: "item-" + Date.now() + "-" + index,
          descricao: desc,
          qtd: Number(item.qtd || 1),
          precoUnitario: Number(item.precoUnitario || 0)
        };
      });
    }
    if (state.itensOrcamento && state.itensOrcamento.length > 0) {
      return state.itensOrcamento;
    }
    return [
      {
        id: "item-" + Date.now(),
        descricao: "Filamento PLA Masterprint 1.75mm (1kg)",
        qtd: 1,
        precoUnitario: 79.90
      }
    ];
  }

  function atualizarResumoFinanceiroWizard() {
    const subtotal = (wizardState.itens || []).reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
      0
    );
    const valor5Porcento = Number((subtotal * 0.05).toFixed(2));
    const descontoAplicado = wizardState.descontoPercentual === 5 ? valor5Porcento : 0;
    const totalFinal = Math.max(0, subtotal - descontoAplicado);

    const txt5 = document.getElementById("wiz-disc-5-amount-txt");
    if (txt5) txt5.textContent = `- ${formatarMoedaBR(valor5Porcento)} no total`;

    const elSub = document.getElementById("wiz-sum-subtotal");
    const elDiscRow = document.getElementById("wiz-sum-discount-row");
    const elDiscVal = document.getElementById("wiz-sum-discount");
    const elTot = document.getElementById("wiz-sum-total");

    if (elSub) elSub.textContent = formatarMoedaBR(subtotal);
    if (elDiscRow) elDiscRow.style.display = wizardState.descontoPercentual === 5 ? "flex" : "none";
    if (elDiscVal) elDiscVal.textContent = `- ${formatarMoedaBR(descontoAplicado)}`;
    if (elTot) elTot.textContent = formatarMoedaBR(totalFinal);
  }

  function abrirAssistenteOrcamento(itensIniciais = null) {
    wizardState.itens = obterItensParaWizard(itensIniciais);

    const modal = document.getElementById("modal-quote-wizard");
    if (!modal) {
      abrirEmissorOrcamento(wizardState.itens);
      return;
    }

    // Popula datalist de clientes salvos
    const datalist = document.getElementById("wiz-clients-datalist");
    if (datalist && window.SJ_DB && window.SJ_DB.clientes) {
      const listaCli = window.SJ_DB.clientes.listar() || [];
      datalist.innerHTML = listaCli
        .map((c) => `<option value="${c.nome}">${c.cnpjCpf ? ` (${c.cnpjCpf})` : ""}</option>`)
        .join("");
    }

    // Se já houver metadados de cliente em edição, mantém preenchido
    const cliAtual = (state.orcamentoMetadados && state.orcamentoMetadados.cliente) || {};
    const inpName = document.getElementById("wiz-client-name");
    const inpPhone = document.getElementById("wiz-client-phone");
    const inpCpf = document.getElementById("wiz-client-cpf");
    if (inpName && cliAtual.nome) inpName.value = cliAtual.nome;
    if (inpPhone && cliAtual.cepTelefone) inpPhone.value = cliAtual.cepTelefone;
    if (inpCpf && cliAtual.cnpjCpf) inpCpf.value = cliAtual.cnpjCpf;

    // Resumo de quantidade de itens no subtítulo
    const qtdTotalUnidades = wizardState.itens.reduce((acc, i) => acc + (Number(i.qtd) || 1), 0);
    const summaryEl = document.getElementById("wizard-items-summary-txt");
    if (summaryEl) {
      summaryEl.innerHTML = `<strong>${wizardState.itens.length} ${wizardState.itens.length === 1 ? "item selecionado" : "itens selecionados"} (${qtdTotalUnidades} un.)</strong> — Configure o cliente, desconto à vista e pagamento para gerar o timbrado.`;
    }

    atualizarResumoFinanceiroWizard();
    modal.style.display = "flex";
    setTimeout(() => inpName?.focus(), 80);
  }

  function fecharAssistenteOrcamento() {
    const modal = document.getElementById("modal-quote-wizard");
    if (modal) modal.style.display = "none";
  }

  function abrirEmissorOuPedirLogin(itensIniciais = null) {
    if (!state.usuarioGoogle) {
      abrirModalAuthGoogle(() => {
        abrirAssistenteOrcamento(itensIniciais);
      });
      return;
    }
    abrirAssistenteOrcamento(itensIniciais);
  }

  function importarCarrinhoParaOrcamento() {
    const itensConvertidos = (state.itensCaixa || []).map((item, index) => {
      let desc = item.nome;
      if (item.detalhe1) desc += ` — ${item.detalhe1}`;
      if (item.detalhe2) desc += ` (${item.detalhe2})`;
      return {
        id: "item-" + Date.now() + "-" + index,
        descricao: desc,
        qtd: Number(item.qtd || 1),
        precoUnitario: Number(item.precoUnitario || 0)
      };
    });

    abrirEmissorOuPedirLogin(itensConvertidos);
  }

  function gerarNumeroOrcamento() {
    const ano = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SJ-${ano}-${rand}`;
  }

  function obterDataHojeFormatada() {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2, "0");
    const m = String(hoje.getMonth() + 1).padStart(2, "0");
    const y = hoje.getFullYear();
    return `${d}/${m}/${y}`;
  }

  function fecharEmissorOrcamento() {
    const quoteView = document.getElementById("quote-studio-view");
    if (quoteView) quoteView.style.display = "none";
    state.emissorAberto = false;
    atualizarVisaoPrincipal();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function abrirEmissorOrcamento(dadosIniciais = null) {
    const homeView = document.getElementById("home-landing-view");
    const pdpView = document.getElementById("product-detail-view");
    const gridView = document.getElementById("catalog-grid-view");
    const quoteView = document.getElementById("quote-studio-view");
    const mobileCart = document.getElementById("mobile-floating-cart");

    if (homeView) homeView.style.display = "none";
    if (pdpView) pdpView.style.display = "none";
    if (gridView) gridView.style.display = "none";
    if (mobileCart) mobileCart.style.display = "none";

    state.emissorAberto = true;

    if (Array.isArray(dadosIniciais)) {
      state.itensOrcamento = dadosIniciais;
      state.orcamentoMetadados = {
        numero: gerarNumeroOrcamento(),
        data: obterDataHojeFormatada(),
        validade: "15 dias",
        frete: 0,
        desconto: 0,
        formaPagamento: "PIX à Vista (Chave CNPJ) ou Cartão até 12x",
        prazoEntrega: "Pronta Entrega / Imediato",
        observacoes: "Produtos novos com garantia oficial Grupo SJ. Suporte técnico especializado na Av. Portugal, 6759 - Umuarama/PR.",
        cliente: {
          nome: "",
          cnpjCpf: "",
          endereco: "",
          bairroCidadeUf: "Umuarama / PR",
          cepTelefone: "",
          email: ""
        }
      };
    } else if (dadosIniciais && typeof dadosIniciais === "object" && dadosIniciais.itens) {
      state.itensOrcamento = dadosIniciais.itens;
      state.orcamentoMetadados = { ...dadosIniciais.metadados };
    } else if (!state.orcamentoMetadados) {
      state.orcamentoMetadados = {
        numero: gerarNumeroOrcamento(),
        data: obterDataHojeFormatada(),
        validade: "15 dias",
        frete: 0,
        desconto: 0,
        formaPagamento: "PIX à Vista (Chave CNPJ) ou Cartão até 12x",
        prazoEntrega: "Pronta Entrega / Imediato",
        observacoes: "Produtos novos com garantia oficial Grupo SJ. Suporte técnico especializado na Av. Portugal, 6759 - Umuarama/PR.",
        cliente: {
          nome: "",
          cnpjCpf: "",
          endereco: "",
          bairroCidadeUf: "Umuarama / PR",
          cepTelefone: "",
          email: ""
        }
      };
      if (state.itensOrcamento.length === 0) {
        state.itensOrcamento = [
          {
            id: "item-" + Date.now(),
            descricao: "Filamento PLA Masterprint 1.75mm (1kg)",
            qtd: 1,
            precoUnitario: 79.90
          }
        ];
      }
    }

    if (quoteView) {
      quoteView.style.display = "block";
      renderizarTelaOrcamento();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderizarTelaOrcamento() {
    const quoteView = document.getElementById("quote-studio-view");
    if (!quoteView) return;

    const { loja } = window.SITE_DATA;
    const meta = state.orcamentoMetadados;
    const cliente = meta.cliente || {};
    const vendedorNome = state.usuarioGoogle ? state.usuarioGoogle.nome : "Thiago Novais (Loja SJ)";

    const subtotal = state.itensOrcamento.reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
      0
    );
    const frete = Number(meta.frete) || 0;
    const desconto = Number(meta.desconto) || 0;
    const totalGeral = Math.max(0, subtotal + frete - desconto);

    const linhasTabelaHtml = state.itensOrcamento.map((item, idx) => {
      const totLinha = (Number(item.qtd) || 0) * (Number(item.precoUnitario) || 0);
      return `
        <tr data-row-idx="${idx}">
          <td class="col-center" style="font-weight:700;">${idx + 1}</td>
          <td>
            <input type="text" class="quote-item-desc-input" data-field="descricao" data-idx="${idx}" value="${item.descricao || ''}" placeholder="Nome ou especificação do produto" />
          </td>
          <td class="col-center">
            <input type="number" min="1" step="1" class="quote-item-num-input" data-field="qtd" data-idx="${idx}" value="${item.qtd || 1}" />
          </td>
          <td class="col-right">
            <input type="number" min="0" step="0.01" class="quote-item-val-input" data-field="precoUnitario" data-idx="${idx}" value="${Number(item.precoUnitario || 0).toFixed(2)}" />
          </td>
          <td class="col-right" id="quote-row-total-${idx}">
            ${formatarMoedaBR(totLinha)}
          </td>
          <td class="col-center col-actions">
            <button type="button" class="quote-row-del-btn" data-del-row="${idx}" title="Remover item">&times;</button>
          </td>
        </tr>
      `;
    }).join("");

    quoteView.innerHTML = `
      <!-- BARRA DE CONTROLE SUPERIOR (NÃO IMPRESSA) -->
      <div class="quote-studio-topbar">
        <div class="quote-topbar-left">
          <button type="button" class="quote-btn-back" id="btn-quote-back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Voltar ao Catálogo</span>
          </button>
          <div class="quote-operator-tag">
            <span>Operador:</span>
            <strong>${vendedorNome}</strong>
            <span style="font-size:0.75rem; color:#10b981; font-weight:700;">(Conectado)</span>
            <button type="button" id="btn-quote-switch-user" style="background:#fff5f2; border:1px solid #E84520; color:#E84520; border-radius:6px; padding:2px 8px; font-size:0.74rem; font-weight:700; cursor:pointer; margin-left:6px;" title="Trocar vendedor ou cadastrar novo">👤 Trocar / Cadastrar</button>
          </div>
        </div>

        <div class="quote-topbar-right">
          <button type="button" class="quote-btn-action btn-secondary" id="btn-quote-reopen-wizard" title="Alterar dados do cliente, forma de pagamento ou desconto de 5%">
            <span>⚙️ Cliente / Pagamento / 5%</span>
          </button>
          <button type="button" class="quote-btn-action btn-secondary" id="btn-quote-history">
            <span>📋 Histórico</span>
          </button>
          <button type="button" class="quote-btn-action btn-secondary" id="btn-quote-save">
            <span>💾 Salvar Proposta</span>
          </button>
          <button type="button" class="quote-btn-action btn-whatsapp" id="btn-quote-whatsapp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.697.075-2.222-.553-1.823-.751-2.999-2.596-3.089-2.717-.089-.12-1.325-1.761-1.325-3.359 0-1.597.834-2.384 1.13-2.697.296-.312.646-.39 1.15-.39.146 0 .274.007.388.013.312.015.468.036.674.529.259.619.887 2.164.965 2.323.078.158.13.344.026.551-.104.207-.156.335-.312.516-.156.182-.328.406-.468.545-.156.155-.318.324-.136.636.182.312.81 1.332 1.737 2.158 1.194 1.064 2.203 1.393 2.515 1.549.312.156.494.13.676-.078.182-.208.78-1.012.988-1.359.208-.347.416-.289.697-.182.281.107 1.789.843 2.096.997.307.154.512.231.587.36.075.129.075.748-.069 1.153z"/>
            </svg>
            <span>Enviar no WhatsApp</span>
          </button>
          <button type="button" class="quote-btn-action btn-print" id="btn-quote-print">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      <!-- CONTAINER DO PAPEL TIMBRADO (FORMATO A4) -->
      <div class="quote-paper-container">
        <div class="quote-paper" id="quote-printable-sheet">

          <!-- CABEÇALHO TIMBRADO OFICIAL DO GRUPO SJ -->
          <div class="quote-banner-header">
            <img src="${loja.timbradoCabecalhoImg}" alt="Grupo SJ - Loja SJ 3D - Maximper - Blindamix - Vumora" />
          </div>

          <!-- IDENTIFICAÇÃO DO ORÇAMENTO (LIMPA E ORGANIZADA) -->
          <div class="quote-meta-row">
            <div class="quote-meta-title-wrap">
              <span class="quote-meta-accent-bar" aria-hidden="true"></span>
              <strong>ORÇAMENTO / PROPOSTA COMERCIAL</strong>
            </div>
            <div class="quote-meta-inputs">
              <div class="quote-meta-field">
                <span class="quote-meta-label">Nº Orçamento:</span>
                <input type="text" class="quote-meta-input input-num" id="quote-meta-number" value="${meta.numero}" />
              </div>
              <span class="quote-meta-sep" aria-hidden="true"></span>
              <div class="quote-meta-field">
                <span class="quote-meta-label">Data:</span>
                <input type="text" class="quote-meta-input input-date" id="quote-meta-date" value="${meta.data}" />
              </div>
            </div>
          </div>

          <!-- GRID DUPLO: FORNECEDOR X CLIENTE (CONFORME WORD OFICIAL) -->
          <div class="quote-parties-grid">
            <!-- FORNECEDOR -->
            <div class="quote-party-col">
              <div class="quote-party-title">FORNECEDOR</div>
              <div class="quote-company-name">${loja.razaoSocial}</div>
              <div class="quote-party-info-line"><strong>CNPJ:</strong> ${loja.cnpj}</div>
              <div class="quote-party-info-line"><strong>Inscrição Estadual:</strong> ${loja.inscricaoEstadual}</div>
              <div class="quote-party-info-line"><strong>Endereço:</strong> ${loja.logradouroNumero}</div>
              <div class="quote-party-info-line"><strong>Bairro - Cidade/UF:</strong> ${loja.bairro} - ${loja.cidadeUf}</div>
              <div class="quote-party-info-line"><strong>Telefone:</strong> ${loja.whatsappFormatado}</div>
              <div class="quote-party-info-line" style="color:#E84520; margin-top:4px;">
                <strong>Vendedor:</strong> ${vendedorNome}
              </div>
            </div>

            <!-- CLIENTE -->
            <div class="quote-party-col">
              <div class="quote-party-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>CLIENTE</span>
                <span style="font-size:0.72rem; color:var(--text-muted); font-weight:normal; text-transform:none;">(Sugestão do Banco de Dados)</span>
              </div>
              <div class="quote-client-form">
                <input type="text" class="quote-client-input client-name-input" id="client-name" list="clients-datalist" placeholder="Nome / Razão Social do Cliente" value="${cliente.nome || ''}" autocomplete="off" />
                <datalist id="clients-datalist">
                  ${(window.SJ_DB ? window.SJ_DB.clientes.listar() : []).map(c => `<option value="${c.nome}">${c.cnpjCpf ? ` (${c.cnpjCpf})` : ''}</option>`).join("")}
                </datalist>
                <input type="text" class="quote-client-input" id="client-cnpj-cpf" placeholder="CNPJ / CPF" value="${cliente.cnpjCpf || ''}" />
                <input type="text" class="quote-client-input" id="client-address" placeholder="Endereço (Rua, Número, Complemento)" value="${cliente.endereco || ''}" />
                <input type="text" class="quote-client-input" id="client-bairro-city" placeholder="Bairro - Cidade/UF" value="${cliente.bairroCidadeUf || 'Umuarama / PR'}" />
                <input type="text" class="quote-client-input" id="client-cep-phone" placeholder="CEP | Telefone / WhatsApp" value="${cliente.cepTelefone || ''}" />
                <input type="email" class="quote-client-input" id="client-email" placeholder="E-mail" value="${cliente.email || ''}" />
              </div>
            </div>
          </div>

          <!-- TABELA DE ITENS (CABEÇALHO LARANJA OFICIAL #E84520) -->
          <div class="quote-table-wrapper">
            <table class="quote-items-table">
              <thead>
                <tr>
                  <th class="col-center" style="width: 50px;">Item</th>
                  <th>Descrição do produto / serviço</th>
                  <th class="col-center" style="width: 70px;">Qtd.</th>
                  <th class="col-right" style="width: 130px;">Valor unitário R$</th>
                  <th class="col-right" style="width: 130px;">Valor total R$</th>
                  <th class="col-center col-actions" style="width: 45px;"></th>
                </tr>
              </thead>
              <tbody id="quote-items-tbody">
                ${linhasTabelaHtml}
              </tbody>
            </table>
          </div>

          <!-- BOTÃO ADICIONAR ITEM AVULSO -->
          <div class="quote-add-item-bar">
            <button type="button" class="btn-add-quote-item" id="btn-quote-add-item">
              <span>+ Adicionar Item / Produto Avulso</span>
            </button>
          </div>

          <!-- TOTAIS FINANCEIROS -->
          <div class="quote-totals-wrap">
            <div class="quote-totals-sub-row">
              <div class="quote-totals-sub-item">
                <span>Subtotal:</span>
                <strong id="quote-val-subtotal">${formatarMoedaBR(subtotal)}</strong>
              </div>
              <div class="quote-totals-sub-item">
                <label for="quote-input-frete">Frete (R$):</label>
                <input type="number" step="0.01" min="0" class="quote-totals-num-input" id="quote-input-frete" value="${frete.toFixed(2)}" />
              </div>
              <div class="quote-totals-sub-item">
                <label for="quote-input-desconto">Desconto (R$):</label>
                <input type="number" step="0.01" min="0" class="quote-totals-num-input" id="quote-input-desconto" value="${desconto.toFixed(2)}" />
                <button type="button" id="btn-quote-quick-5pct" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; border-radius:6px; padding:2px 7px; font-size:0.72rem; font-weight:800; cursor:pointer;" title="Aplicar ou remover 5% de desconto à vista">5% OFF</button>
              </div>
            </div>
            <div class="quote-grand-total-row">
              <span>TOTAL DO ORÇAMENTO:</span>
              <span class="quote-grand-total-val" id="quote-val-grand-total">${formatarMoedaBR(totalGeral)}</span>
            </div>
          </div>

          <!-- CONDIÇÕES COMERCIAIS & PRAZOS -->
          <div class="quote-conditions-box">
            <div class="quote-condition-line">
              <span class="quote-condition-label">Pagamento:</span>
              <input type="text" class="quote-condition-input" id="quote-cond-pagamento" value="${meta.formaPagamento}" />
            </div>
            <div class="quote-condition-line">
              <span class="quote-condition-label">Prazo de entrega:</span>
              <input type="text" class="quote-condition-input" id="quote-cond-prazo" value="${meta.prazoEntrega}" style="max-width: 250px;" />
              <span class="quote-condition-label" style="min-width: 80px; margin-left: 12px;">Validade:</span>
              <input type="text" class="quote-condition-input" id="quote-cond-validade" value="${meta.validade}" style="max-width: 150px;" />
            </div>
            <div class="quote-condition-line" style="align-items: flex-start;">
              <span class="quote-condition-label">Observações:</span>
              <textarea class="quote-condition-input" id="quote-cond-obs" rows="2" style="resize: vertical;">${meta.observacoes}</textarea>
            </div>
          </div>

          <!-- FAIXA TEXTUAL DE MARCAS DO GRUPO SJ -->
          <div class="quote-footer-brand-strip">
            LOJA SJ 3D &nbsp;&nbsp;/&nbsp;&nbsp; MAXIMPER &nbsp;&nbsp;/&nbsp;&nbsp; BLINDAMIX &nbsp;&nbsp;/&nbsp;&nbsp; VUMORA
          </div>

          <!-- BANNER TIMBRADO INFERIOR OFICIAL DO GRUPO SJ -->
          <div class="quote-banner-footer">
            <img src="${loja.timbradoRodapeImg}" alt="Grupo SJ" />
          </div>

        </div>
      </div>
    `;

    vincularEventosTelaOrcamento();
  }

  function vincularEventosTelaOrcamento() {
    const quoteView = document.getElementById("quote-studio-view");
    if (!quoteView) return;

    // Voltar
    document.getElementById("btn-quote-back")?.addEventListener("click", () => {
      fecharEmissorOrcamento();
    });

    // Trocar / Cadastrar Vendedor direto da barra do orçamento
    document.getElementById("btn-quote-switch-user")?.addEventListener("click", () => {
      abrirModalAuthGoogle(() => {
        renderizarTelaOrcamento();
      });
    });

    // Reabrir Assistente Rápido (Cliente / Pagamento / 5% Desconto)
    document.getElementById("btn-quote-reopen-wizard")?.addEventListener("click", () => {
      abrirAssistenteOrcamento(state.itensOrcamento);
    });

    // Salvar proposta
    document.getElementById("btn-quote-save")?.addEventListener("click", () => {
      salvarOrcamentoNoHistorico();
    });

    // Histórico
    document.getElementById("btn-quote-history")?.addEventListener("click", () => {
      abrirModalHistoricoOrcamentos();
    });

    // WhatsApp
    document.getElementById("btn-quote-whatsapp")?.addEventListener("click", () => {
      enviarOrcamentoWhatsApp();
    });

    // Imprimir / PDF
    document.getElementById("btn-quote-print")?.addEventListener("click", () => {
      window.print();
    });

    // Adicionar item
    document.getElementById("btn-quote-add-item")?.addEventListener("click", () => {
      state.itensOrcamento.push({
        id: "item-" + Date.now(),
        descricao: "",
        qtd: 1,
        precoUnitario: 0
      });
      renderizarTelaOrcamento();
      const lastInput = quoteView.querySelector(`input[data-idx="${state.itensOrcamento.length - 1}"][data-field="descricao"]`);
      lastInput?.focus();
    });

    // Deleção de linha
    quoteView.querySelectorAll("[data-del-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.delRow);
        state.itensOrcamento.splice(idx, 1);
        if (state.itensOrcamento.length === 0) {
          state.itensOrcamento.push({ id: "item-" + Date.now(), descricao: "", qtd: 1, precoUnitario: 0 });
        }
        renderizarTelaOrcamento();
      });
    });

    // Input de metadados do orçamento
    document.getElementById("quote-meta-number")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.numero = e.target.value;
    });

    document.getElementById("quote-meta-date")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.data = e.target.value;
    });

    document.getElementById("quote-status-select")?.addEventListener("change", (e) => {
      state.orcamentoMetadados.status = e.target.value;
      if (window.SJ_DB && state.orcamentoMetadados.numero) {
        window.SJ_DB.orcamentos.atualizarStatus(state.orcamentoMetadados.numero, e.target.value);
      }
    });

    // Inputs do Cliente & Autocompletar Inteligente do Banco de Dados
    const inputClientName = document.getElementById("client-name");
    if (inputClientName) {
      inputClientName.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (!state.orcamentoMetadados.cliente) state.orcamentoMetadados.cliente = {};
        state.orcamentoMetadados.cliente.nome = val;

        // Se houver correspondência exata ou seleção no datalist, preenche os outros campos
        if (window.SJ_DB && val.length >= 2) {
          const clientesSalvos = window.SJ_DB.clientes.listar();
          const match = clientesSalvos.find(
            (c) => c.nome.toLowerCase() === val.toLowerCase()
          );
          if (match) {
            if (match.cnpjCpf) {
              const el = document.getElementById("client-cnpj-cpf");
              if (el) el.value = match.cnpjCpf;
              state.orcamentoMetadados.cliente.cnpjCpf = match.cnpjCpf;
            }
            if (match.endereco) {
              const el = document.getElementById("client-address");
              if (el) el.value = match.endereco;
              state.orcamentoMetadados.cliente.endereco = match.endereco;
            }
            if (match.bairroCidadeUf) {
              const el = document.getElementById("client-bairro-city");
              if (el) el.value = match.bairroCidadeUf;
              state.orcamentoMetadados.cliente.bairroCidadeUf = match.bairroCidadeUf;
            }
            if (match.cepTelefone) {
              const el = document.getElementById("client-cep-phone");
              if (el) el.value = match.cepTelefone;
              state.orcamentoMetadados.cliente.cepTelefone = match.cepTelefone;
            }
            if (match.email) {
              const el = document.getElementById("client-email");
              if (el) el.value = match.email;
              state.orcamentoMetadados.cliente.email = match.email;
            }
          }
        }
      });
    }

    const outrosCamposCliente = [
      { id: "client-cnpj-cpf", key: "cnpjCpf" },
      { id: "client-address", key: "endereco" },
      { id: "client-bairro-city", key: "bairroCidadeUf" },
      { id: "client-cep-phone", key: "cepTelefone" },
      { id: "client-email", key: "email" }
    ];

    outrosCamposCliente.forEach(({ id, key }) => {
      document.getElementById(id)?.addEventListener("input", (e) => {
        if (!state.orcamentoMetadados.cliente) state.orcamentoMetadados.cliente = {};
        state.orcamentoMetadados.cliente[key] = e.target.value;
      });
    });

    // Condições comerciais
    document.getElementById("quote-cond-pagamento")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.formaPagamento = e.target.value;
    });
    document.getElementById("quote-cond-prazo")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.prazoEntrega = e.target.value;
    });
    document.getElementById("quote-cond-validade")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.validade = e.target.value;
    });
    document.getElementById("quote-cond-obs")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.observacoes = e.target.value;
    });

    // Frete e Desconto
    document.getElementById("quote-input-frete")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.frete = parseFloat(e.target.value) || 0;
      recalcularTotaisOrcamentoAoVivo();
    });

    document.getElementById("quote-input-desconto")?.addEventListener("input", (e) => {
      state.orcamentoMetadados.desconto = parseFloat(e.target.value) || 0;
      recalcularTotaisOrcamentoAoVivo();
    });

    // Botão rápido 5% OFF direto na folha timbrada
    document.getElementById("btn-quote-quick-5pct")?.addEventListener("click", () => {
      const subtotal = state.itensOrcamento.reduce(
        (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
        0
      );
      const val5 = Number((subtotal * 0.05).toFixed(2));
      const inpDesc = document.getElementById("quote-input-desconto");
      if (Math.abs((Number(state.orcamentoMetadados.desconto) || 0) - val5) < 0.05 && val5 > 0) {
        state.orcamentoMetadados.desconto = 0;
        if (inpDesc) inpDesc.value = "0.00";
      } else {
        state.orcamentoMetadados.desconto = val5;
        if (inpDesc) inpDesc.value = val5.toFixed(2);
      }
      recalcularTotaisOrcamentoAoVivo();
    });

    // Edição de itens da tabela (live sync sem perder o foco)
    quoteView.querySelectorAll(".quote-item-desc-input, .quote-item-num-input, .quote-item-val-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const val = e.target.value;

        if (state.itensOrcamento[idx]) {
          if (field === "descricao") {
            state.itensOrcamento[idx].descricao = val;
          } else if (field === "qtd") {
            state.itensOrcamento[idx].qtd = parseFloat(val) || 0;
          } else if (field === "precoUnitario") {
            state.itensOrcamento[idx].precoUnitario = parseFloat(val) || 0;
          }

          // Atualiza o total da linha
          const rowTotEl = document.getElementById(`quote-row-total-${idx}`);
          if (rowTotEl) {
            const tot = (Number(state.itensOrcamento[idx].qtd) || 0) * (Number(state.itensOrcamento[idx].precoUnitario) || 0);
            rowTotEl.textContent = formatarMoedaBR(tot);
          }

          recalcularTotaisOrcamentoAoVivo();
        }
      });
    });
  }

  function recalcularTotaisOrcamentoAoVivo() {
    const subtotal = state.itensOrcamento.reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
      0
    );
    const frete = Number(state.orcamentoMetadados.frete) || 0;
    const desconto = Number(state.orcamentoMetadados.desconto) || 0;
    const totalGeral = Math.max(0, subtotal + frete - desconto);

    const subtotalEl = document.getElementById("quote-val-subtotal");
    const grandTotalEl = document.getElementById("quote-val-grand-total");

    if (subtotalEl) subtotalEl.textContent = formatarMoedaBR(subtotal);
    if (grandTotalEl) grandTotalEl.textContent = formatarMoedaBR(totalGeral);
  }

  function salvarOrcamentoNoHistorico() {
    const meta = state.orcamentoMetadados;
    const clienteNome = (meta.cliente && meta.cliente.nome) ? meta.cliente.nome.trim() : "Cliente Balcão";
    const subtotal = state.itensOrcamento.reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
      0
    );
    const frete = Number(meta.frete) || 0;
    const desconto = Number(meta.desconto) || 0;
    const total = Math.max(0, subtotal + frete - desconto);

    const proposta = {
      id: meta.numero,
      dataHoraSalvo: new Date().toISOString(),
      vendedor: state.usuarioGoogle ? state.usuarioGoogle.nome : "Operador",
      clienteNome: clienteNome,
      status: meta.status || "pendente",
      total: total,
      itensQtd: state.itensOrcamento.length,
      metadados: JSON.parse(JSON.stringify(meta)),
      itens: JSON.parse(JSON.stringify(state.itensOrcamento))
    };

    try {
      if (window.SJ_DB && window.SJ_DB.orcamentos) {
        window.SJ_DB.orcamentos.salvar(proposta);
      } else {
        const raw = localStorage.getItem(STORAGE_KEY_ORCAMENTOS);
        let lista = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(lista)) lista = [];
        const idx = lista.findIndex((p) => p.id === proposta.id);
        if (idx >= 0) lista[idx] = proposta;
        else lista.unshift(proposta);
        localStorage.setItem(STORAGE_KEY_ORCAMENTOS, JSON.stringify(lista));
      }
      mostrarToast(`✅ Orçamento <strong>${meta.numero}</strong> salvo com sucesso!`, "success");
    } catch (_) {
      mostrarToast("Erro ao salvar proposta no banco de dados.", "error");
    }
  }

  function renderizarListaHistorico() {
    const listEl = document.getElementById("quote-history-list");
    if (!listEl) return;

    let lista = [];
    if (window.SJ_DB && window.SJ_DB.orcamentos) {
      lista = window.SJ_DB.orcamentos.listar({
        status: state.historicoFiltroStatus,
        busca: state.historicoBusca
      });
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_ORCAMENTOS);
        lista = raw ? JSON.parse(raw) : [];
      } catch (_) {}
    }

    if (!Array.isArray(lista) || lista.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
          <p style="font-size: 0.95rem; margin-bottom: 6px;">Nenhum orçamento encontrado com os filtros atuais.</p>
          <small>Ao preencher uma proposta, clique em "Salvar Proposta" para gravá-la no banco de dados.</small>
        </div>
      `;
      return;
    }

    const statusLabels = {
      pendente: "Pendente",
      aprovado: "Aprovado",
      faturado: "Faturado",
      cancelado: "Cancelado"
    };

    listEl.innerHTML = lista.map((p, idx) => {
      const statusAtivo = p.status || "pendente";

      return `
        <div class="quote-history-item" data-history-idx="${idx}">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <strong style="color:var(--text-black); font-size:0.95rem;">${p.id}</strong>
              <span class="quote-status-tag status-${statusAtivo}">
                ${statusLabels[statusAtivo] || statusAtivo}
              </span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${p.metadados?.data || ''}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">• Vendedor: <strong>${p.vendedor}</strong></span>
            </div>
            <div style="font-size:0.83rem; color:#4b5563;">
              <strong>Cliente:</strong> ${p.clienteNome || "Não informado"} • <strong>${p.itensQtd} itens</strong>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <strong style="font-size:1.05rem; color:#E84520;">${formatarMoedaBR(p.total)}</strong>
            
            <select class="history-item-status-sel" data-status-id="${p.id}" style="font-size:0.75rem; font-weight:700; border:1px solid #d4d4d8; border-radius:4px; padding:3px 6px; background:#fff;">
              <option value="pendente" ${statusAtivo === 'pendente' ? 'selected' : ''}>Pendente</option>
              <option value="aprovado" ${statusAtivo === 'aprovado' ? 'selected' : ''}>Aprovado</option>
              <option value="faturado" ${statusAtivo === 'faturado' ? 'selected' : ''}>Faturado</option>
              <option value="cancelado" ${statusAtivo === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>

            <button type="button" class="btn-history-load" data-load-id="${p.id}" style="background:#18181b; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.78rem; font-weight:700; cursor:pointer;">
              Abrir
            </button>
            <button type="button" class="btn-history-del" data-del-id="${p.id}" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:4px;" title="Excluir">
              &times;
            </button>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-status-id]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const id = sel.dataset.statusId;
        const novoStatus = e.target.value;
        if (window.SJ_DB && window.SJ_DB.orcamentos) {
          window.SJ_DB.orcamentos.atualizarStatus(id, novoStatus);
        }
        renderizarListaHistorico();
      });
    });

    listEl.querySelectorAll("[data-load-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.loadId;
        const p = (window.SJ_DB && window.SJ_DB.orcamentos) ? window.SJ_DB.orcamentos.obter(id) : lista.find((x) => x.id === id);
        if (p) {
          fecharModalHistoricoOrcamentos();
          abrirEmissorOrcamento(p);
        }
      });
    });

    listEl.querySelectorAll("[data-del-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.delId;
        if (confirm(`Excluir o orçamento ${id} do banco de dados?`)) {
          if (window.SJ_DB && window.SJ_DB.orcamentos) {
            window.SJ_DB.orcamentos.excluir(id);
          }
          renderizarListaHistorico();
        }
      });
    });
  }

  function abrirModalHistoricoOrcamentos() {
    const modal = document.getElementById("modal-quote-history");
    if (!modal) return;

    renderizarListaHistorico();

    // Filtros de status (Todos, Pendentes, Aprovados, Faturados, Cancelados)
    document.querySelectorAll("[data-status-filter]").forEach((pill) => {
      pill.onclick = () => {
        state.historicoFiltroStatus = pill.dataset.statusFilter;
        document.querySelectorAll("[data-status-filter]").forEach((p) => {
          p.classList.toggle("active", p === pill);
        });
        renderizarListaHistorico();
      };
    });

    // Busca rápida no histórico
    const searchInp = document.getElementById("history-search-input");
    if (searchInp) {
      searchInp.value = state.historicoBusca;
      searchInp.oninput = (e) => {
        state.historicoBusca = e.target.value;
        renderizarListaHistorico();
      };
    }

    // Backup: Exportar arquivo .json
    const btnExp = document.getElementById("btn-backup-export");
    if (btnExp) {
      btnExp.onclick = () => {
        if (window.SJ_DB && window.SJ_DB.backup) {
          window.SJ_DB.backup.baixarBackupArquivo();
          mostrarToast("📦 Arquivo de backup (.json) baixado com sucesso!", "success");
        } else {
          mostrarToast("Backup indisponível no momento.", "warning");
        }
      };
    }

    // Backup: Importar arquivo .json
    const fileInp = document.getElementById("input-backup-import");
    if (fileInp) {
      fileInp.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (window.SJ_DB && window.SJ_DB.backup) {
            const res = window.SJ_DB.backup.importarJson(ev.target.result);
            if (res.sucesso) {
              mostrarToast(
                `✅ Banco restaurado: ${res.totalOrcamentos} orçamentos e ${res.totalClientes} clientes!`,
                "success"
              );
              renderizarListaHistorico();
            } else {
              mostrarToast("Erro na importação: " + res.mensagem, "error");
            }
          }
        };
        reader.readAsText(file);
      };
    }

    modal.style.display = "flex";
  }

  function fecharModalHistoricoOrcamentos() {
    const modal = document.getElementById("modal-quote-history");
    if (modal) modal.style.display = "none";
  }

  function enviarOrcamentoWhatsApp() {
    const meta = state.orcamentoMetadados;
    const cliente = meta.cliente || {};
    const { loja } = window.SITE_DATA;
    const vendedor = state.usuarioGoogle ? state.usuarioGoogle.nome : "Loja SJ 3D";

    const subtotal = state.itensOrcamento.reduce(
      (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
      0
    );
    const frete = Number(meta.frete) || 0;
    const desconto = Number(meta.desconto) || 0;
    const total = Math.max(0, subtotal + frete - desconto);

    const linhasItens = state.itensOrcamento.map((it, i) => {
      const totItem = (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0);
      return `${i + 1}. *${it.descricao}*\n   ${it.qtd} un x ${formatarMoedaBR(it.precoUnitario)} = *${formatarMoedaBR(totItem)}*`;
    }).join("\n");

    const freteStr = frete > 0 ? `\n*Frete:* ${formatarMoedaBR(frete)}` : "";
    const descontoStr = desconto > 0 ? `\n*Desconto:* -${formatarMoedaBR(desconto)}` : "";
    const clienteCpfStr = cliente.cnpjCpf ? `\n*CPF/CNPJ:* ${cliente.cnpjCpf}` : "";
    const clienteCidadeStr = cliente.bairroCidadeUf ? `\n*Cidade/UF:* ${cliente.bairroCidadeUf}` : "";
    const obsStr = meta.observacoes ? `\n\n*Observações:* ${meta.observacoes}` : "";

    const msg =
`📄 *PROPOSTA COMERCIAL / ORÇAMENTO*
*Empresa:* ${loja.razaoSocial} — CNPJ: ${loja.cnpj}
*Endereço:* ${loja.logradouroNumero} — ${loja.cidadeUf}
*Telefone:* ${loja.whatsappFormatado}

*Orçamento:* ${meta.numero} | *Data:* ${meta.data}
*Vendedor Responsável:* ${vendedor}

━━━━━━━━━━━━━━━━━━━━━
*DADOS DO CLIENTE:*
*Nome:* ${cliente.nome || "A/C Cliente"}${clienteCpfStr}${clienteCidadeStr}

━━━━━━━━━━━━━━━━━━━━━
*ITENS DO ORÇAMENTO:*
${linhasItens}

━━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ${formatarMoedaBR(subtotal)}${freteStr}${descontoStr}
*TOTAL DO ORÇAMENTO:* ${formatarMoedaBR(total)}

*Condições de Pagamento:* ${meta.formaPagamento}
*Prazo de Entrega:* ${meta.prazoEntrega}
*Validade da Proposta:* ${meta.validade}${obsStr}

Agradecemos a confiança! Ficamos à disposição para esclarecimentos e fechamento do pedido.`;

    let telDestino = loja.whatsapp;
    if (cliente.cepTelefone) {
      const limpo = cliente.cepTelefone.replace(/\D/g, "");
      if (limpo.length >= 10) {
        telDestino = limpo.startsWith("55") ? limpo : ("55" + limpo);
      }
    }

    const url = `https://wa.me/${telDestino}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  // =========================================================================
  // 10. PAINEL ADMINISTRATIVO DE GESTÃO DO SITE (CMS: PRODUTOS, FOTOS, PREÇOS & BANNER)
  // =========================================================================

  const cmsState = {
    abaAtiva: "produtos",
    categoriaFiltro: "todos",
    busca: "",
    produtoEditandoId: null,
    coresTempEditando: [],
    chavePaletaEditando: null
  };

  function mapearChavePaletaSiteData(usaCoresDinamicas) {
    const mapa = {
      bambu: "coresBambuLab",
      maxprint: "coresMaxPrint",
      plasilk: "coresPlaSilk",
      petg: "coresPetg",
      tpu: "coresTpu",
      absespeciais: "coresAbsEspeciais"
    };
    return mapa[usaCoresDinamicas] || null;
  }

  function extrairNumeroDePrecoBR(textoPreco) {
    if (!textoPreco) return 0;
    const str = String(textoPreco).trim();
    const limpo = str.replace(/[^\d.,]/g, "");
    if (!limpo) return 0;
    if (limpo.includes(",")) {
      return Number(limpo.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return Number(limpo) || 0;
  }

  function formatarTextoPrecoPadrao(valorStrOuNum) {
    const str = String(valorStrOuNum || "").trim();
    if (!str) return "";
    if (str.toUpperCase().startsWith("R$")) return str;
    const num = extrairNumeroDePrecoBR(str);
    if (num > 0) {
      return "R$ " + num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return str;
  }

  // Comprime imagem enviada pelo computador/celular via HTML5 Canvas para salvar rápido no banco
  function comprimirImagemUpload(file, maxWidth = 900, quality = 0.84) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Nenhum arquivo selecionado"));
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(ev.target.result);
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function atualizarSiteAposEdicaoCms() {
    renderizarCapaHome();
    renderizarCatalogoCompleto();
    atualizarCaixaLateral();
    if (state.produtoDetalheAtivo) {
      abrirPaginaProduto(state.produtoDetalheAtivo, null, false);
    }
  }

  function selecionarAbaCms(aba) {
    cmsState.abaAtiva = aba;
    document.querySelectorAll("[data-cms-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.cmsTab === aba);
    });
    const mapPanes = {
      produtos: "cms-pane-produtos",
      banner: "cms-pane-banner",
      exportar: "cms-pane-exportar"
    };
    Object.entries(mapPanes).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("active", key === aba);
    });
  }

  function abrirPainelAdminCms(abaInicial = "produtos", produtoIdParaEditar = null) {
    if (!state.usuarioGoogle) {
      abrirModalAuthGoogle(() => {
        abrirPainelAdminCms(abaInicial, produtoIdParaEditar);
      }, "email");
      return;
    }

    const modal = document.getElementById("modal-admin-cms");
    if (!modal) return;
    modal.style.display = "flex";

    selecionarAbaCms(abaInicial || "produtos");
    renderizarListaProdutosCms();
    preencherFormularioBannerCms();

    if (produtoIdParaEditar) {
      abrirEditorProdutoCms(produtoIdParaEditar);
    } else {
      voltarParaListaProdutosCms();
    }
  }

  function fecharPainelAdminCms() {
    const modal = document.getElementById("modal-admin-cms");
    if (modal) modal.style.display = "none";
  }

  function voltarParaListaProdutosCms() {
    const listView = document.getElementById("cms-products-list-view");
    const editorView = document.getElementById("cms-product-editor-view");
    if (listView) listView.style.display = "block";
    if (editorView) editorView.style.display = "none";
    cmsState.produtoEditandoId = null;
    renderizarListaProdutosCms();
  }

  function renderizarListaProdutosCms() {
    const grid = document.getElementById("cms-products-grid");
    if (!grid || !window.SITE_DATA) return;

    const catalogo = window.SITE_DATA.catalogo || [];
    const termo = (cmsState.busca || "").toLowerCase().trim();

    const filtrados = catalogo.filter((item) => {
      if (cmsState.categoriaFiltro !== "todos" && item.categoria !== cmsState.categoriaFiltro) {
        return false;
      }
      if (termo) {
        const texto = `${item.nome || ""} ${item.subtitulo || ""} ${item.marca || ""} ${item.id || ""}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });

    const nomesCat = {
      filamentos: "Filamentos",
      impressoras: "Impressoras 3D",
      pecas: "Peças & Acessórios",
      manutencao: "Serviços & Manutenção"
    };

    if (filtrados.length === 0) {
      grid.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-muted); grid-column:1/-1;">Nenhum produto encontrado para este filtro.</div>`;
      return;
    }

    grid.innerHTML = filtrados
      .map((p) => {
        const chavePaleta = p.tipoFilamento ? mapearChavePaletaSiteData(p.usaCoresDinamicas) : null;
        const qtdCores = chavePaleta && Array.isArray(window.SITE_DATA[chavePaleta])
          ? window.SITE_DATA[chavePaleta].length
          : 0;

        return `
          <div class="cms-product-item-card">
            <div class="cms-prod-card-thumb">
              <img src="${p.imagem || "assets/produtos/impressora-a1_mini.jpg"}" alt="${p.nome}" loading="lazy" />
              <span class="cms-prod-cat-tag">${nomesCat[p.categoria] || p.categoria}</span>
            </div>
            <div class="cms-prod-card-body">
              <strong>${p.nome}</strong>
              <p>${p.subtitulo || ""}</p>
              <div class="cms-prod-card-meta">
                <span class="cms-prod-price-badge">${p.precoVista || "Sob consulta"}</span>
                ${qtdCores > 0 ? `<span class="cms-prod-colors-badge">🎨 ${qtdCores} cores</span>` : ""}
              </div>
            </div>
            <div class="cms-prod-card-actions">
              <button type="button" class="btn-cms-edit-item" data-cms-edit-id="${p.id}">
                ✏️ Editar Produto / Preço / Foto
              </button>
              <button type="button" class="btn-cms-del-item" data-cms-del-id="${p.id}" title="Excluir produto">
                🗑️
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    grid.querySelectorAll("[data-cms-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        abrirEditorProdutoCms(btn.dataset.cmsEditId);
      });
    });

    grid.querySelectorAll("[data-cms-del-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.cmsDelId;
        const prod = (window.SITE_DATA.catalogo || []).find((i) => i.id === id);
        if (!prod) return;
        if (confirm(`Tem certeza que deseja excluir o produto "${prod.nome}" do catálogo?`)) {
          if (window.SJ_DB && window.SJ_DB.catalogo) {
            await window.SJ_DB.catalogo.excluirProduto(id);
          } else {
            window.SITE_DATA.catalogo = window.SITE_DATA.catalogo.filter((i) => i.id !== id);
          }
          renderizarListaProdutosCms();
          atualizarSiteAposEdicaoCms();
        }
      });
    });
  }

  function renderizarLinhasFichaTecnicaCms(fichaObj = {}) {
    const container = document.getElementById("cms-specs-list");
    if (!container) return;
    const entries = Object.entries(fichaObj);
    if (entries.length === 0) {
      entries.push(["Garantia", "Garantia Oficial Loja SJ 3D Umuarama"]);
    }

    container.innerHTML = entries
      .map(
        ([chave, valor], idx) => `
          <div class="cms-spec-row" data-spec-idx="${idx}">
            <input type="text" class="cms-spec-key" placeholder="Característica (ex: Volume de Impressão)" value="${String(chave).replace(/"/g, "&quot;")}" />
            <input type="text" class="cms-spec-val" placeholder="Descrição / Valor (ex: 256 × 256 × 256 mm³)" value="${String(valor).replace(/"/g, "&quot;")}" />
            <button type="button" class="btn-cms-remove-row" data-remove-spec="${idx}" title="Remover linha">&times;</button>
          </div>
        `
      )
      .join("");

    container.querySelectorAll("[data-remove-spec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        btn.closest(".cms-spec-row")?.remove();
      });
    });
  }

  function renderizarListaCoresFilamentoCms() {
    const container = document.getElementById("cms-filament-colors-list");
    if (!container) return;

    if (!cmsState.coresTempEditando || cmsState.coresTempEditando.length === 0) {
      container.innerHTML = `<div style="padding:14px; color:var(--text-muted); font-size:0.82rem;">Nenhuma cor cadastrada nesta paleta.</div>`;
      return;
    }

    container.innerHTML = cmsState.coresTempEditando
      .map(
        (c, idx) => `
          <div class="cms-color-edit-row" data-color-row-idx="${idx}">
            <input type="color" class="cms-color-hex-picker" data-c-field="hex" data-c-idx="${idx}" value="${(c.hex && c.hex.startsWith("#") && c.hex.length === 7) ? c.hex : "#F04E23"}" title="Escolher tom da cor" />
            <div class="cms-color-thumb-mini">
              <img src="${c.imgCatalogo || "assets/produtos/pla-maxprint.jpg"}" alt="${c.nome}" id="cms-c-thumb-${idx}" />
            </div>
            <input type="text" class="cms-c-input-name" data-c-field="nome" data-c-idx="${idx}" value="${String(c.nome || "").replace(/"/g, "&quot;")}" placeholder="Nome da Cor (ex: Preto 1kg)" />
            <input type="text" class="cms-c-input-cod" data-c-field="cod" data-c-idx="${idx}" value="${String(c.cod || "").replace(/"/g, "&quot;")}" placeholder="CÓD." title="Código no Catálogo" />
            <input type="text" class="cms-c-input-price" data-c-field="preco" data-c-idx="${idx}" value="${String(c.preco || "R$ 79,90").replace(/"/g, "&quot;")}" placeholder="Preço (R$)" />
            <input type="text" class="cms-c-input-img" data-c-field="imgCatalogo" data-c-idx="${idx}" value="${String(c.imgCatalogo || "").replace(/"/g, "&quot;")}" placeholder="URL/Caminho da Foto" />
            <label class="btn-cms-color-upload" title="Enviar nova foto para esta cor">
              📷 Foto
              <input type="file" accept="image/*" data-c-upload-idx="${idx}" style="display:none;" />
            </label>
            <button type="button" class="btn-cms-remove-row" data-c-del-idx="${idx}" title="Remover esta cor">&times;</button>
          </div>
        `
      )
      .join("");

    // Sincroniza alterações nos inputs de cada cor
    container.querySelectorAll("[data-c-field]").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const idx = Number(inp.dataset.cIdx);
        const field = inp.dataset.cField;
        if (!cmsState.coresTempEditando[idx]) return;
        cmsState.coresTempEditando[idx][field] = e.target.value;
        if (field === "preco") {
          const valNum = extrairNumeroDePrecoBR(e.target.value);
          if (valNum > 0) cmsState.coresTempEditando[idx].valor = valNum;
        }
        if (field === "imgCatalogo") {
          cmsState.coresTempEditando[idx].usaFotoCatalogoDireta = true;
          const thumb = document.getElementById(`cms-c-thumb-${idx}`);
          if (thumb && e.target.value) thumb.src = e.target.value;
        }
      });
    });

    // Upload de foto para uma cor específica
    container.querySelectorAll("[data-c-upload-idx]").forEach((fileInp) => {
      fileInp.addEventListener("change", async (e) => {
        const idx = Number(fileInp.dataset.cUploadIdx);
        const file = e.target.files && e.target.files[0];
        if (!file || !cmsState.coresTempEditando[idx]) return;
        try {
          const dataUrl = await comprimirImagemUpload(file, 750, 0.82);
          cmsState.coresTempEditando[idx].imgCatalogo = dataUrl;
          cmsState.coresTempEditando[idx].usaFotoCatalogoDireta = true;
          renderizarListaCoresFilamentoCms();
        } catch (_) {}
      });
    });

    // Excluir uma cor específica
    container.querySelectorAll("[data-c-del-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.cDelIdx);
        cmsState.coresTempEditando.splice(idx, 1);
        renderizarListaCoresFilamentoCms();
      });
    });
  }

  function abrirEditorProdutoCms(produtoId = null) {
    const listView = document.getElementById("cms-products-list-view");
    const editorView = document.getElementById("cms-product-editor-view");
    if (listView) listView.style.display = "none";
    if (editorView) editorView.style.display = "block";

    const existente = produtoId
      ? (window.SITE_DATA.catalogo || []).find((p) => p.id === produtoId)
      : null;

    cmsState.produtoEditandoId = existente ? existente.id : null;

    const badgeEl = document.getElementById("cms-editor-mode-badge");
    if (badgeEl) {
      badgeEl.textContent = existente ? `Editando: ${existente.nome}` : "Cadastrando Novo Produto";
    }

    const item = existente || {
      id: "prod-" + Date.now(),
      categoria: cmsState.categoriaFiltro !== "todos" ? cmsState.categoriaFiltro : "impressoras",
      marca: "Loja SJ 3D",
      nome: "",
      subtitulo: "",
      precoVista: "R$ 99,90",
      precoVistaValor: 99.90,
      precoParcelado: "",
      tagDestaque: "",
      imagem: "assets/produtos/impressora-a1_mini.jpg",
      select1Opcoes: ["À Vista", "Parcelado"],
      select2Opcoes: ["Padrão"],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Loja SJ 3D",
        "Disponibilidade": "Pronta Entrega em Umuarama - PR"
      }
    };

    document.getElementById("cms-prod-id").value = item.id;
    document.getElementById("cms-prod-nome").value = item.nome || "";
    document.getElementById("cms-prod-categoria").value = item.categoria || "impressoras";
    document.getElementById("cms-prod-subtitulo").value = item.subtitulo || "";
    document.getElementById("cms-prod-preco-vista").value = item.precoVista || "";
    document.getElementById("cms-prod-preco-valor").value =
      item.precoVistaValor !== undefined ? item.precoVistaValor : extrairNumeroDePrecoBR(item.precoVista);
    document.getElementById("cms-prod-marca").value =
      item.marca === "MaxPrint" ? "Masterprint" : item.marca || "";
    document.getElementById("cms-prod-preco-parcelado").value = item.precoParcelado || "";
    document.getElementById("cms-prod-tag").value = item.tagDestaque || "";
    document.getElementById("cms-prod-imagem").value = item.imagem || "";

    const previewImg = document.getElementById("cms-prod-img-preview");
    if (previewImg) {
      previewImg.src = item.imagem || "assets/produtos/impressora-a1_mini.jpg";
    }

    document.getElementById("cms-prod-select1").value = Array.isArray(item.select1Opcoes)
      ? item.select1Opcoes.join(", ")
      : "";
    document.getElementById("cms-prod-select2").value = Array.isArray(item.select2Opcoes)
      ? item.select2Opcoes.join(", ")
      : "";

    renderizarLinhasFichaTecnicaCms(item.fichaTecnica || {});

    // Se for um produto de filamento com paleta de cores, carrega o editor de cores
    const colorsBlock = document.getElementById("cms-filament-colors-block");
    const select2Wrap = document.getElementById("cms-prod-select2-wrap");
    const chavePaleta = item.tipoFilamento ? mapearChavePaletaSiteData(item.usaCoresDinamicas) : null;

    if (chavePaleta && Array.isArray(window.SITE_DATA[chavePaleta])) {
      cmsState.chavePaletaEditando = chavePaleta;
      cmsState.coresTempEditando = JSON.parse(JSON.stringify(window.SITE_DATA[chavePaleta]));
      if (colorsBlock) colorsBlock.style.display = "block";
      if (select2Wrap) select2Wrap.style.display = "none";
      renderizarListaCoresFilamentoCms();
    } else {
      cmsState.chavePaletaEditando = null;
      cmsState.coresTempEditando = [];
      if (colorsBlock) colorsBlock.style.display = "none";
      if (select2Wrap) select2Wrap.style.display = "flex";
    }
  }

  function preencherFormularioBannerCms() {
    const b = obterConfigBannerPromocao();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : "";
    };
    const setCheck = (id, bool) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(bool);
    };

    setCheck("cms-ban-ativo", b.ativo !== false);
    setCheck("cms-ban-secao-imp", b.exibirBannerSecaoImpressoras !== false);
    setCheck("cms-ban-cupons-carrinho", b.exibirCuponsCarrinho !== false);
    setVal("cms-ban-estilo", b.estilo || "sorteio");
    setVal("cms-ban-imagem", b.imagemFundo || "assets/produtos/banner-sorteio-natal-wide.jpg");

    const preview = document.getElementById("cms-ban-img-preview");
    if (preview) {
      preview.src = b.imagemFundo || "assets/produtos/banner-sorteio-natal-wide.jpg";
    }

    setVal("cms-ban-badge", b.badge);
    setVal("cms-ban-data", b.dataSorteio);
    setVal("cms-ban-kicker", b.tituloKicker);
    setVal("cms-ban-titulo", b.tituloPrincipal);
    setVal("cms-ban-subtitulo", b.subtituloPremio);
    setVal("cms-ban-preco-destaque", b.precoDestaque);
    setVal("cms-ban-btn1-txt", b.btn1Texto);
    setVal("cms-ban-btn1-url", b.btn1Url);
    setVal("cms-ban-btn2-txt", b.btn2Texto);
    setVal("cms-ban-btn2-url", b.btn2Url);

    const cards = Array.isArray(b.regrasCards) ? b.regrasCards : [];
    [0, 1, 2].forEach((i) => {
      const c = cards[i] || { tag: "", titulo: "", texto: "" };
      setVal(`cms-rule${i + 1}-tag`, c.tag);
      setVal(`cms-rule${i + 1}-title`, c.titulo);
      setVal(`cms-rule${i + 1}-text`, c.texto);
    });
  }

  // Inicialização Geral
  document.addEventListener("DOMContentLoaded", () => {
    carregarPedidoSalvo();
    carregarUsuarioGoogle();
    renderizarCapaHome();
    renderizarCatalogoCompleto();
    atualizarCaixaLateral();
    atualizarVisaoPrincipal();

    // Eventos de Autenticação Google & Operador
    document.getElementById("close-google-auth-btn")?.addEventListener("click", () => {
      fecharModalAuthGoogle();
    });

    document.getElementById("modal-google-auth")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal-google-auth") {
        fecharModalAuthGoogle();
      }
    });

    document.getElementById("modal-quote-history")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal-quote-history") {
        fecharModalHistoricoOrcamentos();
      }
    });

    document.getElementById("btn-google-direct-login")?.addEventListener("click", () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.prompt();
          return;
        } catch (_) {}
      }
      salvarLoginUsuario({
        nome: "Thiago Novais (Google Workspace)",
        email: "contato@gruposj.com.br",
        foto: null,
        tipo: "google"
      });
    });

    document.getElementById("form-operator-auth")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("operator-name-input")?.value.trim() || "Thiago Novais (Loja SJ)";
      const email = document.getElementById("operator-email-input")?.value.trim() || "contato@gruposj.com.br";
      salvarLoginUsuario({
        nome,
        email,
        foto: null,
        tipo: "operador"
      });
    });

    // =====================================================================
    // SISTEMA DE ABAS DE AUTENTICAÇÃO (Google | E-mail & Senha | Cadastrar)
    // =====================================================================
    document.querySelectorAll("[data-auth-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const tabId = tabBtn.dataset.authTab; // "google" | "email" | "register"

        // Atualiza botões ativos
        document.querySelectorAll("[data-auth-tab]").forEach((b) => {
          const ativo = b === tabBtn;
          b.classList.toggle("active", ativo);
          b.setAttribute("aria-selected", ativo ? "true" : "false");
        });

        // Mostra/esconde painéis
        const panes = ["pane-auth-google", "pane-auth-email", "pane-auth-register"];
        const paneMap = { google: "pane-auth-google", email: "pane-auth-email", register: "pane-auth-register" };
        panes.forEach((paneId) => {
          const el = document.getElementById(paneId);
          if (el) {
            el.style.display = (paneId === paneMap[tabId]) ? "block" : "none";
          }
        });

        // Limpa feedback ao trocar de aba
        const fb = document.getElementById("auth-feedback-box");
        if (fb) fb.style.display = "none";
      });
    });

    // BOTÃO MOSTRAR / OCULTAR SENHA NOS CAMPOS DE LOGIN E CADASTRO
    document.querySelectorAll("[data-toggle-pwd]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const inputId = btn.dataset.togglePwd;
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        const ehPassword = inputEl.type === "password";
        inputEl.type = ehPassword ? "text" : "password";
        btn.style.color = ehPassword ? "#E84520" : "#8e8e98";
      });
    });

    // LOGIN POR E-MAIL & SENHA
    document.getElementById("form-email-auth")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email-login-input")?.value.trim();
      const senha = document.getElementById("senha-login-input")?.value.trim();

      if (!email || !senha) {
        mostrarFeedbackAuth("error", "Informe o e-mail e a senha de acesso.");
        return;
      }

      if (window.SJ_DB && window.SJ_DB.auth) {
        const result = await window.SJ_DB.auth.loginEmail(email, senha);
        if (result.sucesso) {
          mostrarFeedbackAuth("success", `Bem-vindo(a), ${result.usuario.nome}!`);
          salvarLoginUsuario(result.usuario);
        } else {
          mostrarFeedbackAuth("error", result.mensagem);
        }
      } else {
        // Fallback sem SJ_DB — login direto como operador
        salvarLoginUsuario({
          nome: email.split("@")[0] || "Vendedor",
          email: email,
          foto: null,
          tipo: "operador"
        });
      }
    });

    // CADASTRAR NOVO VENDEDOR
    document.getElementById("form-register-auth")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = document.getElementById("reg-name-input")?.value.trim();
      const email = document.getElementById("reg-email-input")?.value.trim();
      const senha = document.getElementById("reg-senha-input")?.value.trim();
      const cargo = document.getElementById("reg-cargo-input")?.value.trim() || "Vendedor";

      if (!nome || !email || !senha) {
        mostrarFeedbackAuth("error", "Preencha todos os campos obrigatórios.");
        return;
      }

      if (window.SJ_DB && window.SJ_DB.auth) {
        const result = await window.SJ_DB.auth.registrar({ nome, email, senha, cargo });
        if (result.sucesso) {
          mostrarFeedbackAuth("success", `Vendedor "${result.usuario.nome}" cadastrado com sucesso!`);
          renderizarChipsVendedoresRapidos();
          setTimeout(() => {
            salvarLoginUsuario(result.usuario);
          }, 900);
        } else {
          mostrarFeedbackAuth("error", result.mensagem);
        }
      } else {
        mostrarFeedbackAuth("error", "Sistema de dados indisponível. Recarregue a página.");
      }
    });

    // STATUS DE CONEXÃO COM O SERVIDOR (SJ_DB)
    (async () => {
      const statusEl = document.getElementById("auth-sync-status-txt");
      const pillEl = document.getElementById("auth-sync-status-pill");
      if (!statusEl) return;
      if (window.SJ_DB && typeof window.SJ_DB.estaConectadoAoServidor === "function") {
        await new Promise((r) => setTimeout(r, 1200));
        if (window.SJ_DB.estaConectadoAoServidor()) {
          pillEl?.classList.remove("local-mode");
          statusEl.textContent = "Conectado ao Servidor Local — Sincronização Ativa";
        } else {
          pillEl?.classList.add("local-mode");
          statusEl.textContent = "Modo Nuvem / Local — Dados Salvos no Navegador";
        }
      }
    })();

    // Eventos do Histórico de Orçamentos
    document.getElementById("close-quote-history-btn")?.addEventListener("click", () => {
      fecharModalHistoricoOrcamentos();
    });

    // =====================================================================
    // EVENTOS DO ASSISTENTE RÁPIDO DE ORÇAMENTO (CLIENTE, 5% E PAGAMENTO)
    // =====================================================================
    document.getElementById("close-quote-wizard-btn")?.addEventListener("click", () => {
      fecharAssistenteOrcamento();
    });

    document.getElementById("modal-quote-wizard")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal-quote-wizard") {
        fecharAssistenteOrcamento();
      }
    });

    document.getElementById("btn-wizard-open-history")?.addEventListener("click", () => {
      fecharAssistenteOrcamento();
      abrirModalHistoricoOrcamentos();
    });

    // Autocompletar cliente no Assistente ao digitar/escolher o nome
    document.getElementById("wiz-client-name")?.addEventListener("input", (e) => {
      const val = (e.target.value || "").trim().toLowerCase();
      if (!val || !window.SJ_DB || !window.SJ_DB.clientes) return;
      const match = (window.SJ_DB.clientes.listar() || []).find(
        (c) => (c.nome || "").toLowerCase() === val
      );
      if (match) {
        const phoneEl = document.getElementById("wiz-client-phone");
        const cpfEl = document.getElementById("wiz-client-cpf");
        if (phoneEl && match.cepTelefone) phoneEl.value = match.cepTelefone;
        if (cpfEl && match.cnpjCpf) cpfEl.value = match.cnpjCpf;
      }
    });

    // Seleção de Forma de Pagamento (PIX | Dinheiro | Débito | Crédito)
    document.querySelectorAll("[data-pay-method]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const method = btn.dataset.payMethod;
        wizardState.metodoPagamento = method;

        document.querySelectorAll("[data-pay-method]").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });

        const wrapCred = document.getElementById("wiz-credit-installments-wrap");
        if (wrapCred) {
          wrapCred.style.display = method === "credito" ? "flex" : "none";
        }
      });
    });

    // Seleção de Desconto à Vista (0% ou 5% OFF)
    document.querySelectorAll("[data-wiz-discount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pct = Number(btn.dataset.wizDiscount) || 0;
        wizardState.descontoPercentual = pct;

        document.querySelectorAll("[data-wiz-discount]").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });

        atualizarResumoFinanceiroWizard();
      });
    });

    // Submissão do Assistente -> Gera o Orçamento Timbrado Completo
    document.getElementById("form-quote-wizard")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const nomeCliente = document.getElementById("wiz-client-name")?.value.trim() || "Cliente Balcão";
      const telefoneCliente = document.getElementById("wiz-client-phone")?.value.trim() || "";
      const cpfCliente = document.getElementById("wiz-client-cpf")?.value.trim() || "";

      // Procura dados adicionais se o cliente já existir no banco
      let clienteExistente = null;
      if (window.SJ_DB && window.SJ_DB.clientes) {
        clienteExistente = (window.SJ_DB.clientes.listar() || []).find(
          (c) => (c.nome || "").toLowerCase() === nomeCliente.toLowerCase()
        );
      }

      const subtotal = (wizardState.itens || []).reduce(
        (acc, it) => acc + (Number(it.qtd) || 0) * (Number(it.precoUnitario) || 0),
        0
      );
      const descontoReais = wizardState.descontoPercentual === 5
        ? Number((subtotal * 0.05).toFixed(2))
        : 0;

      // Monta texto da Forma de Pagamento
      const mapPagamento = {
        pix: "PIX à Vista (Chave CNPJ: 66.275.129/0001-10)",
        dinheiro: "Dinheiro à Vista",
        debito: "Cartão de Débito",
        credito: document.getElementById("wiz-credit-installments")?.value || "Cartão de Crédito"
      };
      let textoPagamento = mapPagamento[wizardState.metodoPagamento] || mapPagamento.pix;
      if (wizardState.descontoPercentual === 5) {
        textoPagamento += " — Com 5% de Desconto à Vista aplicado";
      }

      const numeroOrcamento = (state.orcamentoMetadados && state.orcamentoMetadados.numero)
        ? state.orcamentoMetadados.numero
        : gerarNumeroOrcamento();

      const novosMetadados = {
        numero: numeroOrcamento,
        data: obterDataHojeFormatada(),
        status: "pendente",
        validade: "15 dias",
        frete: 0,
        desconto: descontoReais,
        formaPagamento: textoPagamento,
        prazoEntrega: "Pronta Entrega / Imediato",
        observacoes: "Produtos novos com garantia oficial Grupo SJ. Suporte técnico especializado na Av. Portugal, 6759 - Umuarama/PR.",
        cliente: {
          nome: nomeCliente,
          cnpjCpf: cpfCliente,
          endereco: (clienteExistente && clienteExistente.endereco) || "",
          bairroCidadeUf: (clienteExistente && clienteExistente.bairroCidadeUf) || "Umuarama / PR",
          cepTelefone: telefoneCliente,
          email: (clienteExistente && clienteExistente.email) || ""
        }
      };

      fecharAssistenteOrcamento();

      abrirEmissorOrcamento({
        itens: wizardState.itens,
        metadados: novosMetadados
      });

      // Salva automaticamente no histórico e cadastra o cliente no banco
      if (window.SJ_DB && window.SJ_DB.orcamentos) {
        try {
          window.SJ_DB.orcamentos.salvar({
            vendedor: state.usuarioGoogle ? state.usuarioGoogle.nome : "Thiago Novais (Loja SJ)",
            status: "pendente",
            metadados: state.orcamentoMetadados,
            itens: state.itensOrcamento
          });
        } catch (_) {}
      }
    });

    // Botões da Barra Exclusiva do Vendedor Autenticado (#admin-vendor-topbar)
    document.getElementById("admin-bar-btn-cms")?.addEventListener("click", () => {
      abrirPainelAdminCms("produtos");
    });

    document.getElementById("header-btn-quote")?.addEventListener("click", () => {
      abrirEmissorOuPedirLogin();
    });

    document.getElementById("admin-bar-btn-history")?.addEventListener("click", () => {
      abrirModalHistoricoOrcamentos();
    });

    document.getElementById("admin-bar-btn-users")?.addEventListener("click", () => {
      abrirModalAuthGoogle(() => {
        if (state.emissorAberto) renderizarTelaOrcamento();
      });
    });

    document.getElementById("admin-bar-btn-logout")?.addEventListener("click", () => {
      const nome = state.usuarioGoogle ? state.usuarioGoogle.nome : "vendedor";
      if (confirm(`Deseja encerrar a sessão de ${nome} e voltar ao site público?`)) {
        fazerLogoutGoogle();
        fecharPainelAdminCms();
        if (window.location.hash === "#admin" || window.location.hash === "#orcamento") {
          history.replaceState(null, "", window.location.pathname);
        }
      }
    });

    // =====================================================================
    // EVENTOS DO PAINEL DE GESTÃO DO SITE (/ADMIN CMS: PRODUTOS & BANNER)
    // =====================================================================
    window.addEventListener("sj-catalogo-sincronizado", () => {
      atualizarSiteAposEdicaoCms();
    });

    document.getElementById("close-admin-cms-btn")?.addEventListener("click", () => {
      fecharPainelAdminCms();
    });

    document.getElementById("modal-admin-cms")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "modal-admin-cms") {
        fecharPainelAdminCms();
      }
    });

    document.querySelectorAll("[data-cms-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selecionarAbaCms(btn.dataset.cmsTab);
      });
    });

    // Filtros de categoria e busca dentro do CMS
    document.querySelectorAll("[data-cms-cat]").forEach((pill) => {
      pill.addEventListener("click", () => {
        cmsState.categoriaFiltro = pill.dataset.cmsCat;
        document.querySelectorAll("[data-cms-cat]").forEach((b) => {
          b.classList.toggle("active", b === pill);
        });
        renderizarListaProdutosCms();
      });
    });

    document.getElementById("cms-product-search")?.addEventListener("input", (e) => {
      cmsState.busca = e.target.value || "";
      renderizarListaProdutosCms();
    });

    document.getElementById("btn-cms-new-product")?.addEventListener("click", () => {
      abrirEditorProdutoCms(null);
    });

    document.getElementById("btn-cms-back-to-list")?.addEventListener("click", () => {
      voltarParaListaProdutosCms();
    });

    document.getElementById("btn-cms-cancel-product")?.addEventListener("click", () => {
      voltarParaListaProdutosCms();
    });

    // Sincronizar preço texto -> valor numérico automaticamente no editor de produto
    document.getElementById("cms-prod-preco-vista")?.addEventListener("input", (e) => {
      const num = extrairNumeroDePrecoBR(e.target.value);
      const valInput = document.getElementById("cms-prod-preco-valor");
      if (valInput && num > 0) {
        valInput.value = num.toFixed(2);
      }
    });

    // Upload de foto principal do produto
    document.getElementById("input-cms-prod-file")?.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await comprimirImagemUpload(file, 900, 0.85);
        const inpUrl = document.getElementById("cms-prod-imagem");
        const prev = document.getElementById("cms-prod-img-preview");
        if (inpUrl) inpUrl.value = dataUrl;
        if (prev) prev.src = dataUrl;
      } catch (_) {}
    });

    document.getElementById("cms-prod-imagem")?.addEventListener("input", (e) => {
      const prev = document.getElementById("cms-prod-img-preview");
      if (prev && e.target.value.trim()) {
        prev.src = e.target.value.trim();
      }
    });

    // Adicionar nova linha na Ficha Técnica do Produto
    document.getElementById("btn-cms-add-spec")?.addEventListener("click", () => {
      const container = document.getElementById("cms-specs-list");
      if (!container) return;
      const idx = container.querySelectorAll(".cms-spec-row").length;
      const row = document.createElement("div");
      row.className = "cms-spec-row";
      row.innerHTML = `
        <input type="text" class="cms-spec-key" placeholder="Característica (ex: Garantia)" />
        <input type="text" class="cms-spec-val" placeholder="Descrição / Valor" />
        <button type="button" class="btn-cms-remove-row" title="Remover linha">&times;</button>
      `;
      row.querySelector(".btn-cms-remove-row")?.addEventListener("click", () => row.remove());
      container.appendChild(row);
    });

    // Aplicar Preço em Massa para todas as cores da linha de filamento
    document.getElementById("btn-cms-apply-bulk-price")?.addEventListener("click", () => {
      const raw = document.getElementById("cms-bulk-color-price")?.value.trim();
      if (!raw) {
        mostrarToast("Digite o novo preço (ex: R$ 84,90) para aplicar nas cores desta linha.", "warning");
        return;
      }
      const precoFormatado = formatarTextoPrecoPadrao(raw);
      const valorNumerico = extrairNumeroDePrecoBR(precoFormatado);
      cmsState.coresTempEditando.forEach((cor) => {
        cor.preco = precoFormatado;
        if (valorNumerico > 0) cor.valor = valorNumerico;
      });
      renderizarListaCoresFilamentoCms();
      const precoVistaInput = document.getElementById("cms-prod-preco-vista");
      const precoValorInput = document.getElementById("cms-prod-preco-valor");
      if (precoVistaInput) precoVistaInput.value = precoFormatado;
      if (precoValorInput && valorNumerico > 0) precoValorInput.value = valorNumerico.toFixed(2);
      mostrarToast(`Preço ${precoFormatado} aplicado em todas as cores! Clique em Salvar Produto para confirmar.`, "success");
    });

    // Adicionar nova cor na linha de filamento
    document.getElementById("btn-cms-add-color")?.addEventListener("click", () => {
      cmsState.coresTempEditando.push({
        nome: "Nova Cor 1kg",
        cod: String(Math.floor(200 + Math.random() * 700)),
        preco: document.getElementById("cms-prod-preco-vista")?.value || "R$ 79,90",
        valor: Number(document.getElementById("cms-prod-preco-valor")?.value) || 79.9,
        hex: "#F04E23",
        filtroCss: "none",
        usaFotoCatalogoDireta: true,
        imgCatalogo: document.getElementById("cms-prod-imagem")?.value || "assets/produtos/pla-maxprint.jpg"
      });
      renderizarListaCoresFilamentoCms();
    });

    // Salvar Produto Editado ou Novo
    document.getElementById("form-cms-product")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("cms-prod-id")?.value.trim() || ("prod-" + Date.now());
      const existente = (window.SITE_DATA.catalogo || []).find((p) => p.id === id) || {};

      const nome = document.getElementById("cms-prod-nome")?.value.trim() || "Produto Loja SJ";
      const categoria = document.getElementById("cms-prod-categoria")?.value || "impressoras";
      const subtitulo = document.getElementById("cms-prod-subtitulo")?.value.trim() || "";
      const precoVista = formatarTextoPrecoPadrao(document.getElementById("cms-prod-preco-vista")?.value.trim() || "");
      const precoValorRaw = Number(document.getElementById("cms-prod-preco-valor")?.value);
      const precoVistaValor = !isNaN(precoValorRaw) && precoValorRaw > 0
        ? precoValorRaw
        : extrairNumeroDePrecoBR(precoVista);
      const marca = document.getElementById("cms-prod-marca")?.value.trim() || "Loja SJ 3D";
      const precoParcelado = document.getElementById("cms-prod-preco-parcelado")?.value.trim() || "";
      const tagDestaque = document.getElementById("cms-prod-tag")?.value.trim() || "";
      const imagem = document.getElementById("cms-prod-imagem")?.value.trim() || "assets/produtos/impressora-a1_mini.jpg";

      const sel1Raw = document.getElementById("cms-prod-select1")?.value || "";
      const sel2Raw = document.getElementById("cms-prod-select2")?.value || "";
      const select1Opcoes = sel1Raw.split(",").map((s) => s.trim()).filter(Boolean);
      const select2Opcoes = sel2Raw.split(",").map((s) => s.trim()).filter(Boolean);

      // Coleta Ficha Técnica
      const fichaTecnica = {};
      document.querySelectorAll("#cms-specs-list .cms-spec-row").forEach((row) => {
        const k = row.querySelector(".cms-spec-key")?.value.trim();
        const v = row.querySelector(".cms-spec-val")?.value.trim();
        if (k && v) fichaTecnica[k] = v;
      });

      const produtoAtualizado = {
        ...existente,
        id,
        nome,
        nomeCustomizado: true,
        categoria,
        marca,
        subtitulo,
        precoVista,
        precoVistaValor,
        precoParcelado,
        tagDestaque,
        imagem,
        imagemCustomizada: imagem !== existente.imagem ? true : Boolean(existente.imagemCustomizada),
        opcoesCustomizadas: true,
        select1Opcoes: select1Opcoes.length > 0 ? select1Opcoes : (existente.select1Opcoes || ["Padrão"]),
        select2Opcoes: select2Opcoes.length > 0 ? select2Opcoes : (existente.select2Opcoes || ["Padrão"]),
        fichaTecnica
      };

      // Se estava editando uma paleta de cores de filamento, salva também a paleta
      if (cmsState.chavePaletaEditando && Array.isArray(cmsState.coresTempEditando)) {
        window.SITE_DATA[cmsState.chavePaletaEditando] = JSON.parse(JSON.stringify(cmsState.coresTempEditando));
        if (window.SJ_DB && window.SJ_DB.catalogo) {
          await window.SJ_DB.catalogo.salvarPaletaCores(
            cmsState.chavePaletaEditando,
            window.SITE_DATA[cmsState.chavePaletaEditando]
          );
        }
      }

      if (window.SJ_DB && window.SJ_DB.catalogo) {
        await window.SJ_DB.catalogo.salvarProduto(produtoAtualizado);
      } else {
        const idx = window.SITE_DATA.catalogo.findIndex((p) => p.id === id);
        if (idx >= 0) window.SITE_DATA.catalogo[idx] = produtoAtualizado;
        else window.SITE_DATA.catalogo.push(produtoAtualizado);
      }

      atualizarSiteAposEdicaoCms();
      voltarParaListaProdutosCms();
      mostrarToast(`✅ Produto <strong>"${nome}"</strong> atualizado com sucesso no catálogo!`, "success");
    });

    // Upload de imagem de fundo para o Banner de Promoções
    document.getElementById("input-cms-ban-file")?.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await comprimirImagemUpload(file, 1500, 0.84);
        const inp = document.getElementById("cms-ban-imagem");
        const prev = document.getElementById("cms-ban-img-preview");
        if (inp) inp.value = dataUrl;
        if (prev) prev.src = dataUrl;
      } catch (_) {}
    });

    document.getElementById("cms-ban-imagem")?.addEventListener("input", (e) => {
      const prev = document.getElementById("cms-ban-img-preview");
      if (prev && e.target.value.trim()) {
        prev.src = e.target.value.trim();
      }
    });

    document.getElementById("btn-cms-ban-default-img")?.addEventListener("click", () => {
      const padraoUrl = "assets/produtos/banner-sorteio-natal-wide.jpg";
      const inp = document.getElementById("cms-ban-imagem");
      const prev = document.getElementById("cms-ban-img-preview");
      if (inp) inp.value = padraoUrl;
      if (prev) prev.src = padraoUrl;
    });

    // Salvar Banner de Promoções da Capa
    document.getElementById("form-cms-banner")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const getVal = (id) => document.getElementById(id)?.value.trim() || "";
      const getCheck = (id) => Boolean(document.getElementById(id)?.checked);

      const novoBanner = {
        ativo: getCheck("cms-ban-ativo"),
        exibirBannerSecaoImpressoras: getCheck("cms-ban-secao-imp"),
        exibirCuponsCarrinho: getCheck("cms-ban-cupons-carrinho"),
        estilo: getVal("cms-ban-estilo") || "sorteio",
        imagemFundo: getVal("cms-ban-imagem") || "assets/produtos/banner-sorteio-natal-wide.jpg",
        badge: getVal("cms-ban-badge"),
        dataSorteio: getVal("cms-ban-data"),
        tituloKicker: getVal("cms-ban-kicker"),
        tituloPrincipal: getVal("cms-ban-titulo"),
        subtituloPremio: getVal("cms-ban-subtitulo"),
        precoDestaque: getVal("cms-ban-preco-destaque"),
        btn1Texto: getVal("cms-ban-btn1-txt"),
        btn1Url: getVal("cms-ban-btn1-url"),
        btn2Texto: getVal("cms-ban-btn2-txt"),
        btn2Url: getVal("cms-ban-btn2-url"),
        regrasCards: [
          {
            tag: getVal("cms-rule1-tag"),
            titulo: getVal("cms-rule1-title"),
            texto: getVal("cms-rule1-text")
          },
          {
            tag: getVal("cms-rule2-tag"),
            titulo: getVal("cms-rule2-title"),
            texto: getVal("cms-rule2-text")
          },
          {
            tag: getVal("cms-rule3-tag"),
            titulo: getVal("cms-rule3-title"),
            texto: getVal("cms-rule3-text")
          }
        ]
      };

      if (window.SJ_DB && window.SJ_DB.catalogo) {
        await window.SJ_DB.catalogo.salvarBanner(novoBanner);
      } else {
        window.SITE_DATA.bannerPromocao = novoBanner;
      }

      state.heroSlideAtivo = 0;
      atualizarSiteAposEdicaoCms();
      mostrarToast("✅ Banner de Promoções atualizado com sucesso!", "success");
    });

    // Botões de Exportação e Restauração na Aba 3 do CMS
    document.getElementById("btn-cms-download-dados")?.addEventListener("click", () => {
      if (window.SJ_DB && window.SJ_DB.catalogo) {
        window.SJ_DB.catalogo.baixarArquivoDadosJs();
        mostrarToast("📥 Arquivo dados.js atualizado baixado com sucesso!", "success");
      }
    });

    document.getElementById("btn-cms-export-json")?.addEventListener("click", () => {
      if (window.SJ_DB && window.SJ_DB.backup) {
        window.SJ_DB.backup.baixarBackupArquivo();
        mostrarToast("📦 Backup completo (.json) baixado com sucesso!", "success");
      }
    });

    document.getElementById("btn-cms-reset-factory")?.addEventListener("click", async () => {
      if (
        confirm(
          "Deseja restaurar todos os produtos, fotos, preços e o banner para o padrão original de fábrica?"
        )
      ) {
        if (window.SJ_DB && window.SJ_DB.catalogo) {
          await window.SJ_DB.catalogo.restaurarPadraoFabrica();
        }
        renderizarListaProdutosCms();
        preencherFormularioBannerCms();
        atualizarSiteAposEdicaoCms();
        mostrarToast("🔄 Catálogo e Banner restaurados para o padrão original de fábrica!", "success");
      }
    });

    // Link de Acesso Restrito (/admin) no Rodapé
    document.getElementById("footer-admin-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (state.usuarioGoogle) {
        abrirPainelAdminCms("produtos");
      } else {
        abrirModalAuthGoogle(() => {
          abrirPainelAdminCms("produtos");
        }, "email");
      }
    });

    // Botão "Fazer Orçamento Timbrado" na Caixa Lateral
    document.getElementById("btn-cart-to-quote")?.addEventListener("click", () => {
      importarCarrinhoParaOrcamento();
    });

    // Verifica se acessou via /admin, ?admin ou #admin para abrir Login & Senha ou Painel Admin
    function verificarRotaAdminOuHash() {
      const path = (window.location.pathname || "").toLowerCase();
      const search = (window.location.search || "").toLowerCase();
      const hash = (window.location.hash || "").toLowerCase();

      const ehRotaAdmin =
        path.endsWith("/admin") ||
        path.endsWith("/admin/") ||
        search.includes("admin") ||
        hash === "#admin" ||
        hash === "#login";

      if (ehRotaAdmin) {
        if (state.usuarioGoogle) {
          abrirPainelAdminCms("produtos");
        } else {
          abrirModalAuthGoogle(() => {
            abrirPainelAdminCms("produtos");
          }, "email");
        }
        return true;
      }
      return false;
    }

    // Leitura do endereço inicial na URL (ex: /admin, #admin, #orcamento, #produto-...)
    const initialHash = window.location.hash || "";
    if (!verificarRotaAdminOuHash()) {
      if (initialHash === "#orcamento") {
        abrirEmissorOuPedirLogin();
      } else if (initialHash.startsWith("#produto-")) {
        const id = initialHash.replace("#produto-", "");
        abrirPaginaProduto(id, null, false);
      } else if (initialHash.startsWith("#cat-")) {
        const cat = initialHash.replace("#cat-", "");
        navegarParaCategoria(cat, false);
      }
    }

    window.addEventListener("hashchange", () => {
      verificarRotaAdminOuHash();
    });

    // Suporte ao botão "Voltar" do navegador / celular
    window.addEventListener("popstate", (e) => {
      const hash = window.location.hash || "";
      if (hash === "#orcamento") {
        abrirEmissorOuPedirLogin();
        return;
      }
      if (state.emissorAberto) {
        fecharEmissorOrcamento();
        return;
      }

      const stateObj = e.state;
      if (stateObj && stateObj.view === "pdp" && stateObj.itemId) {
        abrirPaginaProduto(stateObj.itemId, null, false);
      } else if (stateObj && stateObj.view === "cat" && stateObj.cat) {
        fecharPaginaProduto(false, false);
        navegarParaCategoria(stateObj.cat, false);
      } else {
        if (hash.startsWith("#produto-")) {
          const id = hash.replace("#produto-", "");
          abrirPaginaProduto(id, null, false);
        } else if (hash.startsWith("#cat-")) {
          const cat = hash.replace("#cat-", "");
          fecharPaginaProduto(false, false);
          navegarParaCategoria(cat, false);
        } else {
          fecharPaginaProduto(false, false);
          navegarParaCategoria("home", false);
        }
      }
    });

    // Navegação do Menu do Topo
    document.querySelectorAll("[data-nav-cat]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const cat = link.dataset.navCat;
        navegarParaCategoria(cat);
      });
    });

    // Botões de escolher Marca de Filamento (Todos | Somente Bambu Lab | Somente MaxPrint)
    document.querySelectorAll("[data-filament-brand]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const marcaClicada = btn.dataset.filamentBrand;
        state.marcaFilamentoFiltro = marcaClicada;
        if (marcaClicada === "Bambu Lab" || marcaClicada === "MaxPrint") {
          state.hubFilamentoMarcaAtiva = marcaClicada;
        }
        document.querySelectorAll("[data-filament-brand]").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderizarCatalogoCompleto();
      });
    });

    // Busca na Lupa com Autocomplete Visual ao Vivo e Busca Rápida Inline na Barra do Catálogo
    const toggleSearchBtn = document.getElementById("toggle-search-btn");
    const searchDrop = document.getElementById("search-bar-drop");
    const searchInput = document.getElementById("global-search-input");
    const globalSearchClearBtn = document.getElementById("global-search-clear-btn");
    const searchLiveDropdown = document.getElementById("search-live-dropdown");
    const inlineSearchInput = document.getElementById("inline-search-input");
    const inlineSearchClearBtn = document.getElementById("inline-search-clear-btn");

    function sincronizarBotaoLimpar() {
      if (inlineSearchClearBtn) {
        const temTextoInline = Boolean(inlineSearchInput && inlineSearchInput.value.trim().length > 0);
        inlineSearchClearBtn.style.display = temTextoInline ? "inline-flex" : "none";
      }
      if (globalSearchClearBtn) {
        const temTextoGlobal = Boolean(searchInput && searchInput.value.trim().length > 0);
        globalSearchClearBtn.style.display = temTextoGlobal ? "inline-flex" : "none";
      }
    }

    function renderizarSugestoesBuscaAoVivo(termoRaw) {
      if (!searchLiveDropdown) return;
      const termo = String(termoRaw || "").trim().toLowerCase();
      if (!termo) {
        searchLiveDropdown.style.display = "none";
        searchLiveDropdown.innerHTML = "";
        return;
      }

      const resultados = [];

      // 1. Procura produtos do catálogo (Impressoras, Filamentos, Peças, Manutenção)
      (window.SITE_DATA.catalogo || []).forEach((item) => {
        const nomeMarcaExibicao = item.marca === "MaxPrint" ? "Masterprint" : item.marca;
        const alvoProd = `${item.nome} ${item.subtitulo} ${nomeMarcaExibicao} ${item.marca}`.toLowerCase();
        if (alvoProd.includes(termo)) {
          resultados.push({
            tipo: "produto",
            itemId: item.id,
            corIdx: null,
            titulo: item.nome,
            sub: `${nomeMarcaExibicao} • ${item.subtitulo}`,
            preco: item.precoVista || "Sob consulta",
            img: item.imagem,
            hex: null,
            cod: ""
          });
        }

        // 2. Se for filamento, procura também nas cores e códigos individuais (ex: "137", "mármore", "laranja")
        if (item.tipoFilamento) {
          const isBambu = item.marca === "Bambu Lab";
          const paleta = obterPaletaPorChave(item.usaCoresDinamicas, isBambu) || [];
          paleta.forEach((cor, idx) => {
            const alvoCor = `${cor.nome} ${cor.cod} cod ${cor.cod} cód ${cor.cod} ${item.nome} ${nomeMarcaExibicao}`.toLowerCase();
            if (alvoCor.includes(termo)) {
              resultados.push({
                tipo: "cor",
                itemId: item.id,
                corIdx: idx,
                corObj: cor,
                marca: item.marca,
                titulo: `${item.nome.replace(" — 1.75mm (1 kg)", "")} — ${cor.nome}`,
                sub: `CÓD. ${cor.cod} • ${nomeMarcaExibicao}`,
                preco: cor.preco || item.precoVista || "",
                img: cor.imgCatalogo || item.imagem,
                hex: cor.hex,
                cod: cor.cod
              });
            }
          });
        }
      });

      const topResultados = resultados.slice(0, 7);

      if (topResultados.length === 0) {
        const waUrl = `https://wa.me/5544991351318?text=${encodeURIComponent(
          `Olá Loja SJ 3D! Procurei por "${termoRaw}" no site e gostaria de saber se vocês têm disponível!`
        )}`;
        searchLiveDropdown.innerHTML = `
          <div class="search-live-empty">
            <span>Nenhum item encontrado para <strong>"${termoRaw}"</strong>.</span>
            <a href="${waUrl}" target="_blank" rel="noopener" class="search-live-wa-link">💬 Consultar no WhatsApp →</a>
          </div>
        `;
        searchLiveDropdown.style.display = "block";
        return;
      }

      searchLiveDropdown.innerHTML = `
        <div class="search-live-header">
          <span>Sugestões rápidas (${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"})</span>
          <button type="button" class="search-live-see-all" id="btn-search-live-all">
            Ver todos no catálogo (Enter) →
          </button>
        </div>
        <div class="search-live-list">
          ${topResultados
            .map(
              (r, i) => `
              <div class="search-live-item" data-live-idx="${i}">
                <div class="search-live-item-main" data-live-open="${i}">
                  <div class="search-live-thumb-wrap">
                    <img src="${r.img}" alt="${r.titulo}" loading="lazy" />
                    ${
                      r.hex
                        ? `<span class="search-live-color-dot" style="background:${r.hex};"></span>`
                        : ""
                    }
                  </div>
                  <div class="search-live-info">
                    <strong>${r.titulo}</strong>
                    <span>${r.sub}</span>
                  </div>
                </div>
                <div class="search-live-right">
                  <strong class="search-live-price">${r.preco}</strong>
                  <button type="button" class="search-live-add-btn" data-live-add="${i}" title="Adicionar direto ao pedido">
                    + Adicionar
                  </button>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      `;

      searchLiveDropdown.style.display = "block";

      searchLiveDropdown.querySelector("#btn-search-live-all")?.addEventListener("click", () => {
        state.busca = termoRaw;
        if (inlineSearchInput) inlineSearchInput.value = termoRaw;
        sincronizarBotaoLimpar();
        searchLiveDropdown.style.display = "none";
        searchDrop?.classList.remove("open");
        if (state.categoriaMenu === "home") {
          state.categoriaMenu = "todos";
        }
        fecharPaginaProduto(false);
        atualizarVisaoPrincipal();
      });

      searchLiveDropdown.querySelectorAll("[data-live-open]").forEach((el) => {
        el.addEventListener("click", () => {
          const r = topResultados[Number(el.dataset.liveOpen)];
          if (!r) return;
          searchLiveDropdown.style.display = "none";
          searchDrop?.classList.remove("open");
          abrirPaginaProduto(r.itemId, r.corIdx !== null ? { corIdxInicial: r.corIdx } : null);
        });
      });

      searchLiveDropdown.querySelectorAll("[data-live-add]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const r = topResultados[Number(btn.dataset.liveAdd)];
          if (!r) return;
          if (r.tipo === "cor" && r.corObj) {
            adicionarItemNaCaixa(r.itemId, btn, {
              marca: r.marca,
              detalhe1: r.corObj.tipo || "1KG",
              corObj: r.corObj,
              qtd: 1
            });
          } else {
            adicionarItemNaCaixa(r.itemId, btn);
          }
        });
      });
    }

    if (toggleSearchBtn && searchDrop) {
      toggleSearchBtn.addEventListener("click", () => {
        searchDrop.classList.toggle("open");
        if (searchDrop.classList.contains("open")) {
          searchInput?.focus();
          if (searchInput && searchInput.value.trim()) {
            renderizarSugestoesBuscaAoVivo(searchInput.value);
          }
        } else if (searchLiveDropdown) {
          searchLiveDropdown.style.display = "none";
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const valor = e.target.value;
        sincronizarBotaoLimpar();
        renderizarSugestoesBuscaAoVivo(valor);

        // Se o usuário já estiver na visão de catálogo, filtra a grade ao vivo também
        if (state.categoriaMenu !== "home" && !state.produtoDetalheAtivo) {
          state.busca = valor;
          if (inlineSearchInput && inlineSearchInput.value !== state.busca) {
            inlineSearchInput.value = state.busca;
          }
          renderizarCatalogoCompleto();
        }
      });

      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          state.busca = searchInput.value;
          if (inlineSearchInput) inlineSearchInput.value = state.busca;
          sincronizarBotaoLimpar();
          if (searchLiveDropdown) searchLiveDropdown.style.display = "none";
          searchDrop?.classList.remove("open");
          if (state.categoriaMenu === "home" && state.busca.trim() !== "") {
            state.categoriaMenu = "todos";
          }
          fecharPaginaProduto(false);
          atualizarVisaoPrincipal();
        }
      });
    }

    if (globalSearchClearBtn) {
      globalSearchClearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (inlineSearchInput) inlineSearchInput.value = "";
        state.busca = "";
        sincronizarBotaoLimpar();
        if (searchLiveDropdown) searchLiveDropdown.style.display = "none";
        if (state.categoriaMenu !== "home") {
          renderizarCatalogoCompleto();
        }
        searchInput?.focus();
      });
    }

    if (inlineSearchInput) {
      inlineSearchInput.addEventListener("input", (e) => {
        state.busca = e.target.value;
        if (searchInput && searchInput.value !== state.busca) {
          searchInput.value = state.busca;
        }
        sincronizarBotaoLimpar();
        renderizarCatalogoCompleto();
      });
    }

    if (inlineSearchClearBtn) {
      inlineSearchClearBtn.addEventListener("click", () => {
        if (inlineSearchInput) inlineSearchInput.value = "";
        if (searchInput) searchInput.value = "";
        state.busca = "";
        sincronizarBotaoLimpar();
        renderizarCatalogoCompleto();
        inlineSearchInput?.focus();
      });
    }

    // Tecla ESC Global para fechar qualquer modal, gaveta ou busca aberta (UX Pro Max)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      fecharModalRegrasSorteio();
      fecharModalCompararImpressoras();
      fecharGavetaPedido();
      if (searchLiveDropdown) searchLiveDropdown.style.display = "none";
      if (searchDrop && searchDrop.classList.contains("open")) {
        searchDrop.classList.remove("open");
      }
    });

    // Limpar pedido (Coluna Lateral e Gaveta Deslizante)
    const limparTodoPedido = () => {
      state.itensCaixa = [];
      atualizarCaixaLateral();
      atualizarMiniResumoNaPaginaProduto();
      mostrarToast("Pedido limpo.", "warning");
    };
    document.getElementById("btn-clear-box")?.addEventListener("click", limparTodoPedido);
    document.getElementById("drawer-btn-clear-box")?.addEventListener("click", limparTodoPedido);

    // Ícone da Sacola no Topo e Barra Flutuante -> abrem a Gaveta Deslizante do Pedido sem sair da página
    document.getElementById("header-bag-btn")?.addEventListener("click", () => {
      abrirGavetaPedido();
    });

    document.getElementById("mobile-cart-jump-btn")?.addEventListener("click", () => {
      abrirGavetaPedido();
    });

    // Fechar Gaveta Deslizante do Pedido
    document.getElementById("close-cart-drawer-btn")?.addEventListener("click", () => {
      fecharGavetaPedido();
    });
    document.getElementById("drawer-btn-continue")?.addEventListener("click", () => {
      fecharGavetaPedido();
    });
    document.getElementById("cart-drawer-overlay")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "cart-drawer-overlay") {
        fecharGavetaPedido();
      }
    });

    // Botão Vendedor "Fazer Orçamento Timbrado" dentro da Gaveta Deslizante
    document.getElementById("drawer-btn-cart-to-quote")?.addEventListener("click", () => {
      fecharGavetaPedido();
      importarCarrinhoParaOrcamento();
    });

    // Finalizar Pedido -> Envia para o WhatsApp da Loja SJ 3D (44) 99135-1318
    document.getElementById("btn-submit-box")?.addEventListener("click", () => {
      enviarPedidoParaWhatsApp();
    });
    document.getElementById("drawer-btn-submit-box")?.addEventListener("click", () => {
      enviarPedidoParaWhatsApp();
    });
  });
})();

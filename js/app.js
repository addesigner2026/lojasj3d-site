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
    // Sistema de Orçamento Timbrado Oficial Grupo SJ & Login Google
    usuarioGoogle: null,
    itensOrcamento: [],
    orcamentoMetadados: null,
    callbackPosLoginGoogle: null,
    emissorAberto: false
  };

  const secoesDefinicao = [
    {
      id: "filamentos",
      titulo: "Filamentos 3D — Catálogo Oficial (Bambu Lab & Masterprint/MaxPrint)",
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
      imagemBase = isBambu
        ? "assets/produtos/pla-bambulab.jpg"
        : "assets/produtos/pla-maxprint.jpg";
      imagemCard = imagemBase;
      listaCores = obterPaletaPorChave(item.usaCoresDinamicas, isBambu);

      // Rótulos curtos para o primeiro select não cortar o texto ("1KG" / "Refil")
      opcoesSelect1 = isBambu ? ["1KG", "Refil"] : ["1KG"];

      if (item.id === "fil-pla-bambulab") {
        tituloCard = "PLA Bambu Lab";
      } else if (item.id === "fil-pla-maxprint") {
        tituloCard = "PLA Masterprint / MaxPrint";
      } else if (item.id.includes("silk")) {
        tituloCard = "PLA Silk Masterprint / MaxPrint";
      } else if (item.id.includes("petg")) {
        tituloCard = "PETG Masterprint / MaxPrint";
      } else if (item.id.includes("tpu")) {
        tituloCard = "TPU Flexível Masterprint / MaxPrint";
      } else if (item.id.includes("abs")) {
        tituloCard = "ABS & Especiais Masterprint";
      }
    } else if (item.categoria === "impressoras") {
      opcoesSelect1 = ["À Vista", "10x"];
    }

    const select1Html = opcoesSelect1
      .map((op) => `<option value="${op}">${op}</option>`)
      .join("");

    let select2Html = "";
    let filtroInicial = "none";
    let corInicialObj = null;

    if (item.tipoFilamento && listaCores && listaCores.length > 0) {
      const idxInicial =
        item.corInicialIndex && listaCores[item.corInicialIndex] ? item.corInicialIndex : 0;
      corInicialObj = listaCores[idxInicial];
      filtroInicial = corInicialObj?.filtroCss || "none";
      if (corInicialObj?.usaFotoCatalogoDireta && corInicialObj?.imgCatalogo) {
        imagemCard = corInicialObj.imgCatalogo;
        filtroInicial = "none";
      }

      select2Html = listaCores
        .map((cor, idx) => {
          const nomeLimpo = (cor.nome || "").replace(/\s*1kg$/i, "");
          return `<option value="${idx}" data-hex="${cor.hex}" data-nome="${cor.nome}" data-cod="${cor.cod || ""
            }" data-preco="${cor.preco || ""}" data-valor="${cor.valor || 0}" data-filtro="${cor.filtroCss
            }" data-img-catalogo="${cor.imgCatalogo || ""}" data-foto-direta="${cor.usaFotoCatalogoDireta ? "1" : "0"
            }" data-img-base="${imagemBase}" ${idx === idxInicial ? "selected" : ""
            }>${nomeLimpo} (${cor.hex.toUpperCase()})</option>`;
        })
        .join("");
    } else {
      select2Html = (item.select2Opcoes || ["Padrão"])
        .map((op) => `<option value="${op}">${op}</option>`)
        .join("");
    }

    const precoInicialExibicao = corInicialObj?.preco || item.precoVista || "";
    const parcelaCurta =
      !item.tipoFilamento && item.precoParcelado
        ? `<span class="clean-price-sub">${item.precoParcelado}</span>`
        : "";

    const priceLineHtml = precoInicialExibicao
      ? `
        <div class="combo-card-clean-price">
          <strong id="price-val-${item.id}">${precoInicialExibicao}</strong>
          ${parcelaCurta}
        </div>
      `
      : "";

    return `
      <article class="combo-filament-card" data-item-id="${item.id}">
        <div class="combo-image-wrap" data-open-modal="${item.id}" title="Clique para ver todas as cores e detalhes">
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
            item.marca !== state.marcaFilamentoFiltro
          ) {
            return false;
          }

          // Filtro de busca (busca no nome, subtítulo, marca e também nas cores/códigos da paleta)
          if (state.busca.trim() !== "") {
            const termo = state.busca.toLowerCase();
            let textoCores = "";
            if (item.tipoFilamento) {
              const paleta = obterPaletaPorChave(item.usaCoresDinamicas, false) || [];
              textoCores = paleta.map((c) => `${c.nome} ${c.cod}`).join(" ");
            }
            const alvo = `${item.nome} ${item.subtitulo} ${item.marca} ${textoCores}`.toLowerCase();
            if (!alvo.includes(termo)) return false;
          }

          return true;
        });

        if (itensSecao.length === 0) return "";

        const sorteioBannerHtml =
          sec.id === "impressoras"
            ? `
              <div class="natal-raffle-banner full-bleed-raffle-banner">
                <div class="natal-raffle-info-col">
                  <div class="natal-raffle-badges">
                    <span class="raffle-pill-orange">A MAIOR BLACK FRIDAY DA LOJA SJ</span>
                    <span class="raffle-pill-date">📅 SORTEIO: 20 DE DEZEMBRO (DOMINGO) • LIVE AO VIVO</span>
                  </div>
                  <div class="raffle-hero-heading-block">
                    <span class="raffle-kicker-line">GRANDE PRÊMIO DE NATAL LOJA SJ 3D</span>
                    <h3 class="raffle-big-model">SORTEIO <em>A1 MINI</em></h3>
                    <span class="raffle-sub-prize">+ KIT COM 4 KG DE FILAMENTOS</span>
                  </div>
                  <div class="hero-rules-grid-3">
                    <div class="hero-rule-card">
                      <span class="rule-card-tag">1️⃣ 3 CUPONS GRÁTIS</span>
                      <strong>Retirada Presencial (Por CPF)</strong>
                      <p>Siga <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="raffle-insta-link">@lojasj3d</a> (1) + visite a loja (2) = <strong>3 cupons grátis</strong> sem compra!</p>
                    </div>
                    <div class="hero-rule-card">
                      <span class="rule-card-tag">2️⃣ FILAMENTOS E PEÇAS</span>
                      <strong>1 Cupom a cada R$ 60</strong>
                      <p>Compras a partir de R$ 60 garantem <strong>1 cupom a cada R$ 60 gastos</strong> (até 10/compra).</p>
                    </div>
                    <div class="hero-rule-card">
                      <span class="rule-card-tag">🏆 IMPRESSORA 3D</span>
                      <strong>10 Cupons Imediatos</strong>
                      <p>Na compra de <strong>qualquer Impressora 3D</strong> você ganha <strong>10 cupons na hora</strong> na urna!</p>
                    </div>
                  </div>
                  <div class="natal-raffle-actions">
                    <a
                      href="https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20a%20campanha%20no%20site%20e%20quero%20garantir%20meus%20cupons%20para%20o%20Sorteio%20A1%20Mini%20do%20dia%2020%20de%20Dezembro!"
                      target="_blank"
                      rel="noopener"
                      class="btn-raffle-whatsapp"
                    >
                      Garantir Meus Cupons no WhatsApp →
                    </a>
                    <a
                      href="https://www.instagram.com/lojasj3d/"
                      target="_blank"
                      rel="noopener"
                      class="hero-btn-secondary"
                    >
                      Seguir @lojasj3d
                    </a>
                  </div>
                </div>
              </div>
            `
            : "";

        return `
          <section class="category-section-block" id="sec-${sec.id}">
            <div class="category-section-header">
              <h2>${sec.titulo}</h2>
              <span>${itensSecao.length} ${itensSecao.length === 1 ? "opção" : "opções"}</span>
            </div>
            <div class="combo-products-row">
              ${itensSecao.map((item) => gerarCardHTML(item)).join("")}
            </div>
            ${sorteioBannerHtml}
          </section>
        `;
      })
      .join("");

    container.innerHTML =
      htmlSecoes ||
      `<div style="padding:48px 20px; text-align:center; border:1px solid var(--border-card);">Nenhum item encontrado para essa busca.</div>`;

    vincularEventosDosCards(container);
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
      dotBtn.addEventListener("click", () => {
        const itemId = dotBtn.dataset.swatchCard;
        const idx = Number(dotBtn.dataset.swatchIndex);
        const sel2El = document.getElementById(`sel2-${itemId}`);
        if (sel2El && sel2El.options[idx]) {
          sel2El.selectedIndex = idx;
          sel2El.dispatchEvent(new Event("change"));
        }
      });
    });

    // Quando mudar entre Carretel RFID e Refil RFID no seletor 1 do Bambu Lab, sincroniza a cor correspondente
    container.querySelectorAll("select[data-type-select]").forEach((sel1El) => {
      sel1El.addEventListener("change", (e) => {
        const itemId = e.target.dataset.typeSelect;
        const val = e.target.value;
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

    let nomeExibicao = item.nome;
    if (item.tipoFilamento && item.permiteTrocarMarcaNoCard) {
      if (item.id.includes("petg")) {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "Filamento Bambu Lab RFID" : "PETG Masterprint / MaxPrint";
      } else if (item.id.includes("silk")) {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "PLA Bambu Lab RFID" : "PLA Silk Masterprint / MaxPrint";
      } else {
        nomeExibicao = marcaEfetiva === "Bambu Lab" ? "PLA Bambu Lab RFID" : "PLA Masterprint / MaxPrint";
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
  }

  // 6. Atualiza a coluna direita ("Seu Pedido Loja SJ"), rastreador de cupons e barra flutuante mobile
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

    const totalItens = calcularTotalItensGeral();
    const totalKgFil = calcularTotalKgFilamentos();
    const valorTotalEstimado = state.itensCaixa.reduce(
      (acc, item) => acc + Number(item.precoUnitario || 0) * item.qtd,
      0
    );
    const resumoCupons = calcularCuponsSorteio();

    if (topBagBadge) topBagBadge.textContent = totalItens;

    if (clearBtn) {
      clearBtn.style.display = totalItens > 0 ? "inline-flex" : "none";
    }

    if (pillEl) {
      pillEl.innerHTML = `<span>✓ ${totalItens} ${totalItens === 1 ? "Item selecionado" : "Itens selecionados"}</span>`;
    }

    if (trackerEl) {
      if (totalItens === 0) {
        trackerEl.innerHTML = `
          <div class="coupon-tracker-card empty">
            <strong>🎟️ Sorteio A1 Mini (20/12)</strong>
            <span>1 cupom a cada R$ 60 em filamentos/peças ou 10 cupons na compra de uma impressora 3D!</span>
          </div>
        `;
      } else {
        const faltaStr =
          resumoCupons.faltaParaProximo > 0
            ? `Faltam <strong>${formatarMoedaBR(resumoCupons.faltaParaProximo)}</strong> em filamentos/peças para ganhar <strong>+1 cupom</strong>!`
            : `Limite máximo de cupons por compra atingido!`;
        trackerEl.innerHTML = `
          <div class="coupon-tracker-card active">
            <div class="coupon-tracker-top">
              <strong>🎟️ ${resumoCupons.totalCuponsCompra} ${resumoCupons.totalCuponsCompra === 1 ? "Cupom no Pedido" : "Cupons no Pedido"
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

    if (totalEl) {
      if (valorTotalEstimado > 0) {
        totalEl.textContent = `Total Estimado: ${formatarMoedaBR(valorTotalEstimado)}${totalKgFil > 0 ? ` (${totalKgFil} kg)` : ""
          }`;
      } else {
        totalEl.textContent = `Total: ${totalItens} ${totalItens === 1 ? "item" : "itens"}`;
      }
    }

    if (mobileBar && mobileCount && mobileTotal) {
      mobileBar.classList.toggle("visible", totalItens > 0);
      const cupomTxt =
        resumoCupons.totalCuponsCompra > 0
          ? ` • 🎟️ ${resumoCupons.totalCuponsCompra} ${resumoCupons.totalCuponsCompra === 1 ? "cupom" : "cupons"
          }`
          : "";
      mobileCount.textContent = `${totalItens} ${totalItens === 1 ? "item" : "itens"
        }${cupomTxt}`;
      mobileTotal.textContent = valorTotalEstimado > 0 ? formatarMoedaBR(valorTotalEstimado) : "";
    }

    if (!listEl) return;

    if (state.itensCaixa.length === 0) {
      listEl.innerHTML = `
        <div style="font-size:0.8rem; color:var(--text-muted); padding:24px 0; text-align:center;">
          Selecione seus filamentos Bambu Lab ou Masterprint/MaxPrint, impressoras ou peças ao lado e clique em <strong>Adicionar ao Pedido</strong>.
        </div>
      `;
      return;
    }

    listEl.innerHTML = state.itensCaixa
      .map(
        (item, idx) => `
        <div class="box-item-row">
          <div class="box-item-left">
            <span class="box-color-dot" style="background:${item.corHex};"></span>
            <div>
              <strong style="display:block;">${item.nome}</strong>
              <span style="color:var(--text-muted); display:block;">${item.detalhe2}</span>
              ${item.precoUnitario > 0
            ? `<span style="color:var(--sj-orange); font-weight:700; font-size:0.75rem;">${formatarMoedaBR(
              item.precoUnitario * item.qtd
            )} (${item.qtd}x ${item.precoTexto})</span>`
            : `<span style="color:var(--text-muted); font-size:0.73rem;">${item.detalhe1}</span>`
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

    listEl.querySelectorAll("[data-dec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.dec);
        state.itensCaixa[i].qtd -= 1;
        if (state.itensCaixa[i].qtd <= 0) state.itensCaixa.splice(i, 1);
        atualizarCaixaLateral();
        atualizarMiniResumoNaPaginaProduto();
      });
    });

    listEl.querySelectorAll("[data-inc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.inc);
        state.itensCaixa[i].qtd += 1;
        atualizarCaixaLateral();
        atualizarMiniResumoNaPaginaProduto();
      });
    });
  }

  // 7. CAPA DO SITE / HOME (ESTRUTURA ESTILO ANYCUBIC OFFICIAL NA PALETA LOJA SJ)
  function renderizarCapaHome() {
    const homeEl = document.getElementById("home-landing-view");
    if (!homeEl) return;

    const slidesHero = [
      {
        fullBleedRaffle: true,
        badge: "A MAIOR BLACK FRIDAY DA LOJA SJ",
        dataSorteio: "SORTEIO: 20 DE DEZEMBRO (DOMINGO) • LIVE AO VIVO",
        tituloRaffleKicker: "GRANDE PRÊMIO DE NATAL LOJA SJ 3D",
        tituloRaffleMain: "SORTEIO <em>A1 MINI</em>",
        tituloRaffleSub: "+ KIT COM 4 KG DE FILAMENTOS",
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
        ],
        btn1Texto: "Garantir Meus Cupons no WhatsApp →",
        btn1Whatsapp:
          "https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20o%20banner%20no%20site%20e%20quero%20garantir%20meus%20cupons%20para%20o%20Sorteio%20A1%20Mini%20do%20dia%2020%20de%20Dezembro!",
        btn2Texto: "Seguir @lojasj3d",
        btn2Url: "https://www.instagram.com/lojasj3d/"
      },
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
        <div class="hero-slides-track" id="hero-slides-track">
          ${slidesHero
        .map(
          (s, idx) => `
              <div class="hero-slide-item ${s.fullBleedRaffle ? "full-bleed-raffle" : ""} ${idx === state.heroSlideAtivo ? "active" : ""}" data-slide-idx="${idx}">
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
                  ${s.regrasCards
              ? `
                        <div class="hero-rules-grid-3">
                          ${s.regrasCards
                .map(
                  (rc) => `
                              <div class="hero-rule-card">
                                <span class="rule-card-tag">${rc.tag}</span>
                                <strong>${rc.titulo}</strong>
                                <p>${rc.texto}</p>
                              </div>
                            `
                )
                .join("")}
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
                    ${s.btn2Url
              ? `<a href="${s.btn2Url}" target="_blank" rel="noopener" class="hero-btn-secondary">${s.btn2Texto}</a>`
              : s.btn2Item
                ? `<button type="button" class="hero-btn-secondary" data-home-open-item="${s.btn2Item}">${s.btn2Texto}</button>`
                : `<button type="button" class="hero-btn-secondary" data-home-go-cat="${s.btn2Cat}">${s.btn2Texto}</button>`
            }
                  </div>
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
          </div>
        </div>

        <div class="combo-products-row" id="home-printers-grid">
          ${todasImpressoras.map((imp) => gerarCardHTML(imp)).join("")}
        </div>
      </div>

      <!-- 5. VITRINE VISUAL: OS FILAMENTOS MAIS BONITOS DO CATÁLOGO -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">ACABAMENTOS ESPECIAIS & RFID</span>
            <h2>Os Filamentos Mais Bonitos para Suas Impressões</h2>
          </div>
          <button type="button" class="pdp-back-btn" data-home-go-cat="filamentos">Ver Todas as 80 Cores →</button>
        </div>

        <div class="home-pretty-filaments-grid">
          ${filamentosDestaqueVisual
        .map(
          (f) => `
              <article
                class="pretty-filament-card"
                data-pretty-item="${f.itemId}"
                data-pretty-cor="${f.corIdx}"
                title="Clique para abrir ${f.nome}"
              >
                <div class="pretty-filament-img">
                  <img src="${f.img}" alt="${f.nome}" loading="lazy" />
                  <span class="pretty-cod-tag">CÓD. ${f.cod}</span>
                </div>
                <div class="pretty-filament-body">
                  <span class="pretty-effect-label">${f.efeito}</span>
                  <h4>${f.nome}</h4>
                  <div class="pretty-price-row">
                    <strong>${f.preco}</strong>
                    <span>Ver detalhes →</span>
                  </div>
                </div>
              </article>
            `
        )
        .join("")}
        </div>

        <!-- Grade das 6 Linhas de Filamentos -->
        <div class="combo-products-row" id="home-filaments-grid" style="margin-top: 24px;">
          ${todosFilamentos.map((fil) => gerarCardHTML(fil)).join("")}
        </div>
      </div>

      <!-- 6. BANNER SORTEIO DE NATAL NO FECHAMENTO DA CAPA -->
      <div class="natal-raffle-banner full-bleed-raffle-banner">
        <div class="natal-raffle-info-col">
          <div class="natal-raffle-badges">
            <span class="raffle-pill-orange">A MAIOR BLACK FRIDAY DA LOJA SJ</span>
            <span class="raffle-pill-date">📅 SORTEIO: 20 DE DEZEMBRO (DOMINGO) • LIVE AO VIVO</span>
          </div>
          <div class="raffle-hero-heading-block">
            <span class="raffle-kicker-line">GRANDE PRÊMIO DE NATAL LOJA SJ 3D</span>
            <h3 class="raffle-big-model">SORTEIO <em>A1 MINI</em></h3>
            <span class="raffle-sub-prize">+ KIT COM 4 KG DE FILAMENTOS</span>
          </div>
          <div class="hero-rules-grid-3">
            <div class="hero-rule-card">
              <span class="rule-card-tag">1️⃣ 3 CUPONS GRÁTIS</span>
              <strong>Retirada Presencial (Por CPF)</strong>
              <p>Siga <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="raffle-insta-link">@lojasj3d</a> (1) + visite a loja (2) = <strong>3 cupons grátis</strong> sem compra!</p>
            </div>
            <div class="hero-rule-card">
              <span class="rule-card-tag">2️⃣ FILAMENTOS E PEÇAS</span>
              <strong>1 Cupom a cada R$ 60</strong>
              <p>Compras a partir de R$ 60 garantem <strong>1 cupom a cada R$ 60 gastos</strong> (até 10/compra).</p>
            </div>
            <div class="hero-rule-card">
              <span class="rule-card-tag">🏆 IMPRESSORA 3D</span>
              <strong>10 Cupons Imediatos</strong>
              <p>Na compra de <strong>qualquer Impressora 3D</strong> você ganha <strong>10 cupons na hora</strong> na urna!</p>
            </div>
          </div>
          <div class="natal-raffle-actions">
            <a
              href="https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20a%20campanha%20no%20site%20e%20quero%20garantir%20meus%20cupons%20para%20o%20Sorteio%20A1%20Mini%20do%20dia%2020%20de%20Dezembro!"
              target="_blank"
              rel="noopener"
              class="btn-raffle-whatsapp"
            >
              Garantir Meus Cupons no WhatsApp →
            </a>
            <a
              href="https://www.instagram.com/lojasj3d/"
              target="_blank"
              rel="noopener"
              class="hero-btn-secondary"
            >
              Seguir @lojasj3d
            </a>
          </div>
        </div>
      </div>
    `;

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

    // Vincula eventos dos cards de impressoras e filamentos renderizados na Home
    const printersGrid = document.getElementById("home-printers-grid");
    const filamentsGrid = document.getElementById("home-filaments-grid");
    if (printersGrid) vincularEventosDosCards(printersGrid);
    if (filamentsGrid) vincularEventosDosCards(filamentsGrid);
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
            : "Filamento PLA Masterprint / MaxPrint — 1.75mm (1 kg)";
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
            <strong>${isBambu ? "Bambu Lab (RFID Original)" : "Masterprint / MaxPrint"}</strong>
          </div>
          <div class="pdp-pills-wrap pdp-brand-switch-row">
            <button type="button" class="pdp-pill-btn ${!isBambu ? "active" : ""}" data-pdp-switch-brand="MaxPrint" title="Filamentos Masterprint / MaxPrint">
              <span>Masterprint / MaxPrint</span>
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
              <span>Tipo / Material (MaxPrint):</span>
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

        <button type="button" class="pdp-back-btn" id="pdp-back-btn">
          ← Voltar ao Catálogo
        </button>
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
              <span class="pdp-price-label">${item.tipoFilamento ? "1 KG" : "À VISTA"}</span>
              <strong class="pdp-price-value" id="pdp-price-val">${precoTextoAtual}</strong>
              ${codAtual
        ? `<span class="pdp-cod-pill" id="pdp-info-cod">${codAtual}</span>`
        : ""
      }
            </div>
            ${item.precoParcelado
        ? `<div class="pdp-price-sub-row">${item.precoParcelado}</div>`
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

            <button type="button" class="pdp-btn-whatsapp-now" id="pdp-btn-buy-now">
              Comprar Agora pelo WhatsApp
            </button>
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
    atualizarMiniResumoNaPaginaProduto();
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Função interna para atualizar preço, foto e textos ao trocar cor ou quantidade na PDP
    function sincronizarEstadoPDP() {
      const precoUnit = corAtiva
        ? Number(corAtiva.valor || 0)
        : Number(item.precoVistaValor || 0);
      const precoTxt = corAtiva?.preco || item.precoVista || "";
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

      const priceValEl = document.getElementById("pdp-price-val");
      if (priceValEl && precoTxt) priceValEl.textContent = precoTxt;

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

      // Destaca a bolinha ativa
      pdpView.querySelectorAll(".pdp-swatch-circle").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.pdpColorIdx) === idxCorAtiva);
      });

      const dropEl = document.getElementById("pdp-color-dropdown");
      if (dropEl && Number(dropEl.value) !== idxCorAtiva) {
        dropEl.value = String(idxCorAtiva);
      }
    }

    // Eventos de Voltar ao Catálogo
    document.getElementById("pdp-back-btn")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-bc-home")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-bc-cat")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-see-all-btn")?.addEventListener("click", () => fecharPaginaProduto(false));
    document.getElementById("pdp-view-order-btn")?.addEventListener("click", () => fecharPaginaProduto(true));

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
              sincronizarEstadoPDP();
            }
          } else if (opcao1Ativa.includes("Carretel") && (corAtiva?.nome || "").toLowerCase().includes("refil")) {
            idxCorAtiva = 0;
            corAtiva = listaCores[0];
            sincronizarEstadoPDP();
          }
        }
      });
    });

    // Clique nas pílulas do Seletor 2 (para Impressoras, Peças e Manutenção)
    pdpView.querySelectorAll("[data-pdp-sel2]").forEach((btn) => {
      btn.addEventListener("click", () => {
        opcao2Ativa = btn.dataset.pdpSel2;
        const lbl = document.getElementById("pdp-sel2-label");
        if (lbl) lbl.textContent = opcao2Ativa;
        pdpView.querySelectorAll("[data-pdp-sel2]").forEach((b) => b.classList.toggle("active", b === btn));
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

    // Botão Primário: Adicionar ao Pedido
    const addBtn = document.getElementById("pdp-btn-add");
    addBtn?.addEventListener("click", () => {
      adicionarItemNaCaixa(item.id, addBtn, {
        marca: marcaAtual,
        detalhe1: opcao1Ativa,
        detalhe2: opcao2Ativa,
        corObj: corAtiva,
        qtd: qtdAtiva
      });
    });

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

    // Vincula também os cards da seção "Outras opções" no rodapé da PDP
    const relatedContainer = pdpView.querySelector(".pdp-related-section");
    if (relatedContainer) {
      vincularEventosDosCards(relatedContainer);
    }
  }

  // =========================================================================
  // 9. SISTEMA DE ORÇAMENTO TIMBRADO OFICIAL GRUPO SJ & LOGIN GOOGLE
  // =========================================================================

  const STORAGE_KEY_GOOGLE_USER = "sj_google_user_v1";
  const STORAGE_KEY_ORCAMENTOS = "lojasj3d_orcamentos_salvos_v1";

  // Carrega operador / vendedor salvo localmente
  function carregarUsuarioGoogle() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY_GOOGLE_USER);
      if (raw) {
        state.usuarioGoogle = JSON.parse(raw);
      }
    } catch (_) {}
    atualizarBadgeUsuarioHeader();
  }

  function salvarLoginUsuario(usuario, executarCallback = true) {
    state.usuarioGoogle = usuario;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(usuario));
      }
    } catch (_) {}
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
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY_GOOGLE_USER);
      }
    } catch (_) {}
    atualizarBadgeUsuarioHeader();
    if (state.emissorAberto) {
      fecharEmissorOrcamento();
    }
  }

  function atualizarBadgeUsuarioHeader() {
    const badgeEl = document.getElementById("header-auth-badge");
    if (!badgeEl) return;

    if (!state.usuarioGoogle) {
      badgeEl.style.display = "none";
      badgeEl.innerHTML = "";
    } else {
      const u = state.usuarioGoogle;
      const avatarHtml = u.foto
        ? `<img src="${u.foto}" alt="${u.nome}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`
        : `<span style="font-weight:700;">${(u.nome || "V").charAt(0).toUpperCase()}</span>`;

      badgeEl.style.display = "inline-flex";
      badgeEl.innerHTML = `
        <div class="header-auth-avatar" title="${u.nome}">${avatarHtml}</div>
        <span>${u.nome.split(" ")[0]} (Vendedor)</span>
        <button type="button" class="header-auth-logout" id="btn-header-logout" title="Desconectar do perfil de vendedor">(Sair)</button>
      `;
      document.getElementById("btn-header-logout")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Deseja desconectar a conta do vendedor ${u.nome}?`)) {
          fazerLogoutGoogle();
        }
      });
    }
  }

  function abrirModalAuthGoogle(callbackApos = null) {
    state.callbackPosLoginGoogle = callbackApos;
    const modal = document.getElementById("modal-google-auth");
    if (modal) modal.style.display = "flex";

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

  function abrirEmissorOuPedirLogin(itensIniciais = null) {
    if (!state.usuarioGoogle) {
      abrirModalAuthGoogle(() => {
        abrirEmissorOrcamento(itensIniciais);
      });
      return;
    }
    abrirEmissorOrcamento(itensIniciais);
  }

  function importarCarrinhoParaOrcamento() {
    if (!state.itensCaixa || state.itensCaixa.length === 0) {
      alert("Seu carrinho está vazio! Adicione itens do catálogo ou você poderá incluir itens avulsos diretamente na proposta.");
    }

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
            descricao: "Filamento PLA Masterprint / MaxPrint 1.75mm (1kg)",
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
          </div>
        </div>

        <div class="quote-topbar-right">
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

          <!-- IDENTIFICAÇÃO DO ORÇAMENTO -->
          <div class="quote-meta-row">
            <div>
              <strong>ORÇAMENTO / PROPOSTA COMERCIAL</strong>
            </div>
            <div class="quote-meta-inputs">
              <div class="quote-meta-field">
                <span>Número:</span>
                <input type="text" class="quote-meta-input" id="quote-meta-number" value="${meta.numero}" />
              </div>
              <div class="quote-meta-field">
                <span>Data:</span>
                <input type="text" class="quote-meta-input" id="quote-meta-date" value="${meta.data}" />
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
              <div class="quote-party-title">CLIENTE</div>
              <div class="quote-client-form">
                <input type="text" class="quote-client-input client-name-input" id="client-name" placeholder="Nome / Razão Social do Cliente" value="${cliente.nome || ''}" />
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

    // Inputs do Cliente
    const camposCliente = [
      { id: "client-name", key: "nome" },
      { id: "client-cnpj-cpf", key: "cnpjCpf" },
      { id: "client-address", key: "endereco" },
      { id: "client-bairro-city", key: "bairroCidadeUf" },
      { id: "client-cep-phone", key: "cepTelefone" },
      { id: "client-email", key: "email" }
    ];

    camposCliente.forEach(({ id, key }) => {
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
      total: total,
      itensQtd: state.itensOrcamento.length,
      metadados: JSON.parse(JSON.stringify(meta)),
      itens: JSON.parse(JSON.stringify(state.itensOrcamento))
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY_ORCAMENTOS);
      let lista = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(lista)) lista = [];

      const idx = lista.findIndex((p) => p.id === proposta.id);
      if (idx >= 0) {
        lista[idx] = proposta;
      } else {
        lista.unshift(proposta);
      }
      if (lista.length > 50) lista = lista.slice(0, 50);

      localStorage.setItem(STORAGE_KEY_ORCAMENTOS, JSON.stringify(lista));
      alert(`Orçamento ${meta.numero} salvo com sucesso no histórico da Loja SJ 3D!`);
    } catch (_) {
      alert("Erro ao salvar proposta no armazenamento local.");
    }
  }

  function abrirModalHistoricoOrcamentos() {
    const modal = document.getElementById("modal-quote-history");
    const listEl = document.getElementById("quote-history-list");
    if (!modal || !listEl) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY_ORCAMENTOS);
      const lista = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(lista) || lista.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
            <p style="font-size: 0.95rem; margin-bottom: 8px;">Nenhum orçamento salvo no histórico ainda.</p>
            <small>Ao preencher uma proposta, clique em "Salvar Proposta" para registrá-la aqui.</small>
          </div>
        `;
      } else {
        listEl.innerHTML = lista.map((p, idx) => `
          <div class="quote-history-item" data-history-idx="${idx}">
            <div style="display:flex; flex-direction:column; gap:3px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <strong style="color:var(--text-black); font-size:0.92rem;">${p.id}</strong>
                <span style="font-size:0.75rem; background:#fee2e2; color:#E84520; font-weight:700; padding:2px 6px; border-radius:4px;">${p.metadados?.data || ''}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">Vendedor: ${p.vendedor}</span>
              </div>
              <div style="font-size:0.83rem; color:#4b5563;">
                <strong>Cliente:</strong> ${p.clienteNome || "Não informado"} • <strong>${p.itensQtd} itens</strong>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <strong style="font-size:1.05rem; color:#E84520;">${formatarMoedaBR(p.total)}</strong>
              <button type="button" class="btn-history-load" data-load-idx="${idx}" style="background:#18181b; color:#fff; border:none; padding:6px 12px; border-radius:6px; font-size:0.78rem; font-weight:700; cursor:pointer;">
                Abrir
              </button>
              <button type="button" class="btn-history-del" data-del-idx="${idx}" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer; padding:4px;" title="Excluir">
                &times;
              </button>
            </div>
          </div>
        `).join("");

        listEl.querySelectorAll("[data-load-idx]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.loadIdx);
            const p = lista[idx];
            if (p) {
              fecharModalHistoricoOrcamentos();
              abrirEmissorOrcamento(p);
            }
          });
        });

        listEl.querySelectorAll("[data-del-idx]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.delIdx);
            if (confirm(`Excluir o orçamento ${lista[idx]?.id}?`)) {
              lista.splice(idx, 1);
              localStorage.setItem(STORAGE_KEY_ORCAMENTOS, JSON.stringify(lista));
              abrirModalHistoricoOrcamentos();
            }
          });
        });
      }
    } catch (_) {
      listEl.innerHTML = `<p style="color:red;">Erro ao ler histórico.</p>`;
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

    // Eventos do Histórico de Orçamentos
    document.getElementById("close-quote-history-btn")?.addEventListener("click", () => {
      fecharModalHistoricoOrcamentos();
    });

    // Botão "Orçamento" no Topo
    document.getElementById("header-btn-quote")?.addEventListener("click", () => {
      abrirEmissorOuPedirLogin();
    });

    // Botão "Gerar Orçamento Timbrado" na Caixa Lateral ("aproveitando a forma do carrinho")
    document.getElementById("btn-cart-to-quote")?.addEventListener("click", () => {
      importarCarrinhoParaOrcamento();
    });

    // Leitura do hash inicial na URL para deep-linking (ex: #orcamento, #produto-fil-pla-bambulab ou #cat-impressoras)
    const initialHash = window.location.hash || "";
    if (initialHash === "#orcamento") {
      abrirEmissorOuPedirLogin();
    } else if (initialHash.startsWith("#produto-")) {
      const id = initialHash.replace("#produto-", "");
      abrirPaginaProduto(id, null, false);
    } else if (initialHash.startsWith("#cat-")) {
      const cat = initialHash.replace("#cat-", "");
      navegarParaCategoria(cat, false);
    }

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
        state.marcaFilamentoFiltro = btn.dataset.filamentBrand;
        document.querySelectorAll("[data-filament-brand]").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderizarCatalogoCompleto();
      });
    });

    // Busca na Lupa e Busca Rápida Inline na Barra do Catálogo (com botão Limpar)
    const toggleSearchBtn = document.getElementById("toggle-search-btn");
    const searchDrop = document.getElementById("search-bar-drop");
    const searchInput = document.getElementById("global-search-input");
    const inlineSearchInput = document.getElementById("inline-search-input");
    const inlineSearchClearBtn = document.getElementById("inline-search-clear-btn");

    function sincronizarBotaoLimpar() {
      if (!inlineSearchClearBtn) return;
      const temTexto = Boolean(inlineSearchInput && inlineSearchInput.value.trim().length > 0);
      inlineSearchClearBtn.style.display = temTexto ? "inline-flex" : "none";
    }

    if (toggleSearchBtn && searchDrop) {
      toggleSearchBtn.addEventListener("click", () => {
        searchDrop.classList.toggle("open");
        if (searchDrop.classList.contains("open")) searchInput?.focus();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.busca = e.target.value;
        if (inlineSearchInput && inlineSearchInput.value !== state.busca) {
          inlineSearchInput.value = state.busca;
        }
        sincronizarBotaoLimpar();
        fecharPaginaProduto(false);
        renderizarCatalogoCompleto();
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

    // Limpar pedido
    document.getElementById("btn-clear-box")?.addEventListener("click", () => {
      state.itensCaixa = [];
      atualizarCaixaLateral();
      atualizarMiniResumoNaPaginaProduto();
    });

    // Ícone da Sacola no Topo e Barra Flutuante Mobile -> rolam para o Pedido
    document.getElementById("header-bag-btn")?.addEventListener("click", () => {
      fecharPaginaProduto(true);
    });

    document.getElementById("mobile-cart-jump-btn")?.addEventListener("click", () => {
      fecharPaginaProduto(true);
    });

    // Finalizar Pedido -> Envia para o WhatsApp da Loja SJ 3D (44) 99135-1318
    document.getElementById("btn-submit-box")?.addEventListener("click", () => {
      const { whatsapp } = window.SITE_DATA.loja;
      if (state.itensCaixa.length === 0) {
        alert("Adicione pelo menos 1 item ao seu pedido antes de enviar!");
        return;
      }

      const totalKgFil = calcularTotalKgFilamentos();
      const valorTotalEstimado = state.itensCaixa.reduce(
        (acc, item) => acc + Number(item.precoUnitario || 0) * item.qtd,
        0
      );
      const resumoCupons = calcularCuponsSorteio();

      const linhas = state.itensCaixa.map((i) => {
        const precoStr =
          i.precoUnitario > 0
            ? ` — *${formatarMoedaBR(i.precoUnitario * i.qtd)}*`
            : "";
        return `• ${i.qtd}x *${i.nome}* (${i.detalhe1} | ${i.detalhe2})${precoStr}`;
      });

      const resumoPeso =
        totalKgFil > 0 ? `\n*Total de Filamentos:* ${totalKgFil} kg` : "";
      const resumoValor =
        valorTotalEstimado > 0
          ? `\n*Total Estimado:* ${formatarMoedaBR(valorTotalEstimado)}`
          : "";
      const resumoCuponsStr =
        resumoCupons.totalCuponsCompra > 0
          ? `\n*🎟️ Sorteio A1 Mini:* ${resumoCupons.totalCuponsCompra} ${resumoCupons.totalCuponsCompra === 1 ? "cupom gerado" : "cupons gerados"
          } (+3 grátis retirando no balcão!)`
          : "";

      const msg = encodeURIComponent(
        `Olá *Loja SJ 3D*! Montei meu pedido no catálogo do site:\n\n` +
        `${linhas.join("\n")}${resumoPeso}${resumoValor}${resumoCuponsStr}\n\n` +
        `Gostaria de confirmar a disponibilidade e finalizar o pedido!`
      );

      window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    });
  });
})();

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
    abaImpressoraHome: "todas"
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

    if (pdpView) pdpView.style.display = "none";
    state.produtoDetalheAtivo = null;

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

    // Linhas de filamento disponíveis para alternar no estilo Anycubic ("Material / Tipo")
    const todosFilamentos = window.SITE_DATA.catalogo.filter((i) => i.categoria === "filamentos");
    const seletorLinhasFilamentoHtml = item.tipoFilamento
      ? `
        <div class="pdp-option-group">
          <div class="pdp-option-header">
            <span>Linha / Material:</span>
            <strong>${marcaAtual}</strong>
          </div>
          <div class="pdp-pills-wrap">
            ${todosFilamentos
        .map((fil) => {
          const labelCurto = fil.id.includes("bambulab")
            ? "PLA Bambu Lab RFID"
            : fil.id.includes("pla-maxprint")
              ? "PLA MaxPrint (40 Cores)"
              : fil.id.includes("silk")
                ? "PLA Silk Metalizado"
                : fil.id.includes("petg")
                  ? "PETG Alta Resistência"
                  : fil.id.includes("tpu")
                    ? "TPU Flexível 95A"
                    : "ABS & Especiais Glitter";
          const ativo = fil.id === item.id;
          return `<button type="button" class="pdp-pill-btn ${ativo ? "active" : ""}" data-pdp-switch-item="${fil.id}">${labelCurto}</button>`;
        })
        .join("")}
          </div>
        </div>
      `
      : "";

    // Seletor 1 (Apresentação / Peso ou Condição de Pagamento)
    const seletor1Html =
      opcoesSelect1 && opcoesSelect1.length > 0
        ? `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>${item.select1Label || (item.tipoFilamento ? "Apresentação / Bobina:" : "Condição:")}</span>
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

    // Seletor 2 (Paleta de Cores Circular Completa estilo Anycubic OU Opções do Produto)
    const seletor2Html =
      item.tipoFilamento && listaCores
        ? `
          <div class="pdp-option-group">
            <div class="pdp-option-header">
              <span>Cor Selecionada (${listaCores.length} opções):</span>
              <strong id="pdp-color-name-label">${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})</strong>
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
                    title="${cor.nome} — CÓD. ${cor.cod} (${cor.preco})"
                    aria-label="${cor.nome}"
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

    // Alternar entre linhas de filamento direto na página do produto
    pdpView.querySelectorAll("[data-pdp-switch-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const novoId = btn.dataset.pdpSwitchItem;
        abrirPaginaProduto(novoId);
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

    // Clique nas bolinhas circulares de cor (estilo Anycubic)
    pdpView.querySelectorAll("[data-pdp-color-idx]").forEach((swatchBtn) => {
      swatchBtn.addEventListener("click", () => {
        idxCorAtiva = Number(swatchBtn.dataset.pdpColorIdx);
        corAtiva = listaCores[idxCorAtiva];
        sincronizarEstadoPDP();
      });
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

  // Inicialização Geral
  document.addEventListener("DOMContentLoaded", () => {
    carregarPedidoSalvo();
    renderizarCapaHome();
    renderizarCatalogoCompleto();
    atualizarCaixaLateral();
    atualizarVisaoPrincipal();

    // Leitura do hash inicial na URL para deep-linking (ex: #produto-fil-pla-bambulab ou #cat-impressoras)
    const initialHash = window.location.hash || "";
    if (initialHash.startsWith("#produto-")) {
      const id = initialHash.replace("#produto-", "");
      abrirPaginaProduto(id, null, false);
    } else if (initialHash.startsWith("#cat-")) {
      const cat = initialHash.replace("#cat-", "");
      navegarParaCategoria(cat, false);
    }

    // Suporte ao botão "Voltar" do navegador / celular
    window.addEventListener("popstate", (e) => {
      const stateObj = e.state;
      if (stateObj && stateObj.view === "pdp" && stateObj.itemId) {
        abrirPaginaProduto(stateObj.itemId, null, false);
      } else if (stateObj && stateObj.view === "cat" && stateObj.cat) {
        fecharPaginaProduto(false, false);
        navegarParaCategoria(stateObj.cat, false);
      } else {
        const hash = window.location.hash || "";
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

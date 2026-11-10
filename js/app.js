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
    historicoBusca: "",
    // Área do Cliente & Minha Conta
    clienteLogado: null,
    favoritos: [],
    abaClienteAtiva: "favoritos"
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

  // 1. Controla a barra de busca do catálogo (mantém limpa, sem repetir filtro de marca)
  function atualizarControlesTopo() {
    const topControls = document.getElementById("filament-top-controls");
    if (!topControls) return;
    topControls.style.display = "flex";
    topControls.classList.add("only-search");
    const brandLeft = topControls.querySelector(".brand-selector-left");
    if (brandLeft) {
      brandLeft.style.display = "none";
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

  // Utilitários de Segurança e Sanitização contra XSS
  function escaparHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizarHtmlBasico(html) {
    if (!html) return "";
    return String(html)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript\s*:/gi, "");
  }

  // Sistema de Notificações Visuais (Toasts UI/UX Pro Max)
  function mostrarToast(mensagem, tipo = "success", opcoes = {}) {
    const container = document.getElementById("sj-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `sj-toast toast-${tipo}`;

    const spanTxt = document.createElement("span");
    if (typeof mensagem === "string" && /<[a-z][\s\S]*>/i.test(mensagem)) {
      spanTxt.innerHTML = sanitizarHtmlBasico(mensagem);
    } else {
      spanTxt.textContent = mensagem || "";
    }
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
  const mostrarToastNotificacao = (msg, tipo = "success") => mostrarToast(msg, tipo === "sucesso" ? "success" : tipo);

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

  function obterPedidosClienteSalvos(clienteId) {
    if (!clienteId) return [];
    try {
      const raw = localStorage.getItem(`sj_pedidos_cliente_${clienteId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  }

  function persistirPedidosClienteSalvos(clienteId, lista) {
    if (!clienteId) return;
    try {
      localStorage.setItem(`sj_pedidos_cliente_${clienteId}`, JSON.stringify(lista));
    } catch (_) {}
  }

  // Validação Oficial Matemática de CPF (Receita Federal - Módulo 11)
  function validarCpfOficial(cpfRaw) {
    const cpf = String(cpfRaw || "").replace(/\D/g, "");
    if (cpf.length !== 11) return false;
    // Rejeita CPFs com todos os dígitos iguais (ex: 000.000.000-00, 111.111.111-11...)
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i), 10) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9), 10)) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i), 10) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10), 10)) return false;

    return true;
  }

  // Validação Oficial Matemática de CNPJ (Receita Federal - Módulo 11)
  function validarCnpjOficial(cnpjRaw) {
    const cnpj = String(cnpjRaw || "").replace(/\D/g, "");
    if (cnpj.length !== 14) return false;
    // Rejeita CNPJs com todos os dígitos iguais (ex: 00.000.000/0000-00, 11.111.111/1111-11...)
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let soma = 0;
    for (let i = 0; i < 12; i++) {
      soma += parseInt(cnpj.charAt(i), 10) * pesos1[i];
    }
    let resto = soma % 11;
    const dv1 = resto < 2 ? 0 : 11 - resto;
    if (dv1 !== parseInt(cnpj.charAt(12), 10)) return false;

    soma = 0;
    for (let i = 0; i < 13; i++) {
      soma += parseInt(cnpj.charAt(i), 10) * pesos2[i];
    }
    resto = soma % 11;
    const dv2 = resto < 2 ? 0 : 11 - resto;
    if (dv2 !== parseInt(cnpj.charAt(13), 10)) return false;

    return true;
  }

  // Valida se o documento digitado é um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos)
  function validarDocumentoCpfOuCnpj(valor) {
    const digitos = String(valor || "").replace(/\D/g, "");
    if (!digitos) {
      return {
        valido: false,
        tipo: null,
        digitos: "",
        mensagem: "Informe um CPF ou CNPJ válido."
      };
    }
    if (digitos.length === 11) {
      const ok = validarCpfOficial(digitos);
      return {
        valido: ok,
        tipo: "CPF",
        digitos,
        mensagem: ok ? "✓ CPF válido" : "❌ CPF inválido! Verifique os números digitados."
      };
    }
    if (digitos.length === 14) {
      const ok = validarCnpjOficial(digitos);
      return {
        valido: ok,
        tipo: "CNPJ",
        digitos,
        mensagem: ok ? "✓ CNPJ válido" : "❌ CNPJ inválido! Verifique os números digitados."
      };
    }
    return {
      valido: false,
      tipo: digitos.length > 11 ? "CNPJ" : "CPF",
      digitos,
      mensagem:
        digitos.length > 11
          ? "❌ CNPJ incompleto ou inválido (digite os 14 números)."
          : "❌ CPF incompleto ou inválido (digite os 11 números do CPF ou 14 do CNPJ)."
    };
  }

  // Mascaramento de Segurança LGPD (Art. 46) para exibição segura de CPF/CNPJ e Telefone
  function mascararCpfCnpj(valor) {
    if (!valor) return "";
    const limpo = String(valor).replace(/\D/g, "");
    if (limpo.length === 11) {
      return `${limpo.slice(0, 3)}.***.***-${limpo.slice(-2)}`;
    }
    if (limpo.length === 14) {
      return `${limpo.slice(0, 2)}.***.***/${limpo.slice(8, 12)}-${limpo.slice(-2)}`;
    }
    if (limpo.length > 4) {
      return `${limpo.slice(0, 2)}***${limpo.slice(-2)}`;
    }
    return "***";
  }

  function mascararTelefone(valor) {
    if (!valor) return "";
    const limpo = String(valor).replace(/\D/g, "");
    if (limpo.length >= 10) {
      const ddd = limpo.slice(0, 2);
      const ultimos = limpo.slice(-2);
      return `(${ddd}) 9****-**${ultimos}`;
    }
    return "(**) *****-****";
  }

  // Valida se o cadastro do cliente (e os dados de Nota Fiscal, quando solicitada) estão 100% preenchidos e aprovados
  function validarDadosCliente(cliente, exigirNotaFiscal = false) {
    if (!cliente) {
      return {
        valido: false,
        faltando: ["Login / Cadastro da Conta"],
        mensagem: "Faça login ou crie sua conta preenchendo seus dados antes de finalizar."
      };
    }

    const faltando = [];
    const nome = String(cliente.nome || "").trim();
    const whatsappDigitos = String(cliente.whatsapp || "").replace(/\D/g, "");
    const email = String(cliente.email || "").trim();

    // Verificação estrita de CPF no bloco superior de identificação
    const cpfDigitos = String(cliente.cpf || cliente.cnpjCpf || "").replace(/\D/g, "");
    if (!cpfDigitos) {
      faltando.push("CPF do Titular");
    } else if (cpfDigitos.length === 11) {
      if (!validarCpfOficial(cpfDigitos)) {
        faltando.push("CPF inválido (verifique os 11 números digitados)");
      }
    } else if (cpfDigitos.length === 14) {
      // Caso legado de registro anterior como CNPJ
      if (!validarCnpjOficial(cpfDigitos)) {
        faltando.push("CNPJ inválido (verifique os 14 números digitados)");
      }
    } else {
      faltando.push("CPF do Titular (digite os 11 números do CPF)");
    }

    if (nome.length < 3) faltando.push("Nome Completo");
    if (whatsappDigitos.length < 10) faltando.push("WhatsApp / Telefone com DDD");
    if (!email || !email.includes("@")) faltando.push("E-mail válido");

    const precisaNf = Boolean(exigirNotaFiscal || cliente.precisaNotaFiscal);
    if (precisaNf) {
      const cnpjDigitos = String(cliente.cnpj || "").replace(/\D/g, "");
      if (cnpjDigitos) {
        if (cnpjDigitos.length !== 14 || !validarCnpjOficial(cnpjDigitos)) {
          faltando.push("CNPJ da Empresa (14 números válidos)");
        }
      }

      const cepDigitos = String(cliente.cep || "").replace(/\D/g, "");
      const logradouro = String(cliente.logradouro || "").trim();
      const numero = String(cliente.numero || "").trim();
      const bairro = String(cliente.bairro || "").trim();
      const cidade = String(cliente.cidade || "").trim();
      const uf = String(cliente.uf || "").trim();

      if (cepDigitos.length !== 8) faltando.push("CEP (8 dígitos)");
      if (!logradouro) faltando.push("Endereço (Rua / Avenida)");
      if (!numero) faltando.push("Número do Endereço");
      if (!bairro) faltando.push("Bairro");
      if (!cidade) faltando.push("Cidade");
      if (uf.length !== 2) faltando.push("UF (Estado)");
    }

    return {
      valido: faltando.length === 0,
      precisaNf,
      faltando,
      mensagem:
        faltando.length > 0
          ? `Corrija ou preencha os seguintes dados para aprovar seu cadastro: ${faltando.join(", ")}.`
          : "Cadastro aprovado e completo."
    };
  }

  function formatarEnderecoCompletoCliente(c) {
    if (!c) return "";
    const partes = [];
    if (c.logradouro) {
      partes.push(`${c.logradouro}${c.numero ? `, nº ${c.numero}` : ""}${c.complemento ? ` (${c.complemento})` : ""}`);
    } else if (c.endereco) {
      partes.push(c.endereco);
    }
    if (c.bairro) partes.push(`Bairro ${c.bairro}`);
    const cidadeUf = [c.cidade, c.uf].filter(Boolean).join("/") || c.cidadeUf || "";
    if (cidadeUf) partes.push(cidadeUf);
    if (c.cep) partes.push(`CEP ${c.cep}`);
    return partes.join(" — ");
  }

  function sincronizarStatusNotaFiscalCarrinho() {
    const chkSide = document.getElementById("chk-cart-precisa-nf");
    const chkDrawer = document.getElementById("chk-drawer-precisa-nf");
    const statusSide = document.getElementById("side-box-nf-status");
    const statusDrawer = document.getElementById("drawer-box-nf-status");
    const clubWrapDrawer = document.getElementById("drawer-client-club-link-wrap");

    const c = state.clienteLogado;
    const precisaNf =
      typeof state.precisaNotaFiscalPedido === "boolean"
        ? state.precisaNotaFiscalPedido
        : Boolean(c?.precisaNotaFiscal);

    if (chkSide) chkSide.checked = precisaNf;
    if (chkDrawer) chkDrawer.checked = precisaNf;

    if (clubWrapDrawer) {
      clubWrapDrawer.style.display = c ? "none" : "block";
    }

    let htmlStatus = "";
    if (!c) {
      htmlStatus = precisaNf
        ? `<span style="color:#B45309; font-weight:600;">⚠️ Ao finalizar, você preencherá seu CPF/CNPJ e endereço completo para emissão da Nota Fiscal (NF-e).</span>`
        : `<span>Ao finalizar no WhatsApp, seus dados cadastrais e itens escolhidos serão enviados completos.</span>`;
    } else {
      const validacao = validarDadosCliente(c, precisaNf);
      if (validacao.valido) {
        const docTxt = c.cpf || c.cnpjCpf || "";
        htmlStatus = precisaNf
          ? `<span style="color:#047857; font-weight:700;">✅ Dados Fiscais Aprovados (${escaparHtml(docTxt)}) — Nota Fiscal será solicitada no WhatsApp!</span>`
          : `<span style="color:#047857; font-weight:600;">✅ Cadastro Aprovado (${escaparHtml(c.nome)}) • Dados prontos para envio.</span>`;
      } else {
        htmlStatus = `<span style="color:#DC2626; font-weight:600;">⚠️ Falta preencher: ${escaparHtml(validacao.faltando.join(", "))}. Clique em Finalizar para completar.</span>`;
      }
    }

    if (statusSide) statusSide.innerHTML = htmlStatus;
    if (statusDrawer) statusDrawer.innerHTML = htmlStatus;
  }

  async function salvarPedidoOuOrcamentoCliente(opcoes = {}) {
    const { enviadoWhatsApp = false, silencioso = false, precisaNotaFiscal = false } = opcoes;

    if (state.itensCaixa.length === 0) {
      mostrarToast("Adicione produtos ao pedido antes de guardar!", "warning");
      return null;
    }

    if (!state.clienteLogado) {
      state.acaoPendenteAposLogin = {
        tipo: "guardar_pedido",
        enviadoWhatsApp
      };
      abrirModalAuthCliente("signup");
      mostrarToastNotificacao(
        "💡 Faça login ou crie sua conta para guardar seu pedido e acompanhar suas propostas!",
        "info"
      );
      return null;
    }

    const c = state.clienteLogado;
    const totalItens = state.itensCaixa.reduce((acc, i) => acc + (Number(i.qtd) || 1), 0);
    const totalValor = state.itensCaixa.reduce(
      (acc, i) => acc + (Number(i.precoUnitario) || 0) * (Number(i.qtd) || 1),
      0
    );
    const totalKgFil = calcularTotalKgFilamentos();
    const solicitaNf = Boolean(precisaNotaFiscal || state.precisaNotaFiscalPedido || c.precisaNotaFiscal);

    const novoPedido = {
      id: "SJ-PED-" + Math.floor(1000 + Math.random() * 9000),
      clienteId: c.id,
      clienteNome: c.nome,
      clienteCpfCnpj: c.cpf || c.cnpjCpf || "",
      clienteInscricaoEstadual: c.inscricaoEstadual || "",
      clienteEmail: c.email || "",
      clienteWhatsapp: c.whatsapp || "",
      clienteEnderecoFiscal: formatarEnderecoCompletoCliente(c),
      precisaNotaFiscal: solicitaNf,
      dataHoraSalvo: new Date().toISOString(),
      status: enviadoWhatsApp ? "enviado_whatsapp" : "guardado",
      statusLabel: enviadoWhatsApp ? "Enviado no WhatsApp" : "Orçamento Guardado",
      total: totalValor,
      itensQtd: totalItens,
      totalKgFilamentos: totalKgFil,
      itens: JSON.parse(JSON.stringify(state.itensCaixa))
    };

    // 1. Salva no localStorage isolado do cliente
    const pedidos = obterPedidosClienteSalvos(c.id);
    pedidos.unshift(novoPedido);
    persistirPedidosClienteSalvos(c.id, pedidos);

    // 2. Salva em window.SJ_DB.orcamentos se disponível (para histórico unificado)
    if (window.SJ_DB?.orcamentos?.salvar) {
      try {
        await window.SJ_DB.orcamentos.salvar({
          id: novoPedido.id,
          clienteNome: c.nome,
          clienteCpfCnpj: c.cpf || c.cnpjCpf || "",
          clienteTelefone: c.whatsapp || "",
          clienteEmail: c.email || "",
          clienteEndereco: formatarEnderecoCompletoCliente(c),
          itens: novoPedido.itens.map((i) => ({
            nome: i.nome,
            detalhe: `${i.detalhe1 || ""} ${i.detalhe2 || ""}`.trim(),
            corHex: i.corHex || "",
            quantidade: i.qtd,
            precoUnitario: i.precoUnitario,
            subtotal: (Number(i.precoUnitario) || 0) * (Number(i.qtd) || 1)
          })),
          total: totalValor,
          totalItens,
          status: novoPedido.status,
          metadados: {
            tipoOrigem: "catalogo_cliente",
            enviadoWhatsApp,
            precisaNotaFiscal: solicitaNf,
            inscricaoEstadual: c.inscricaoEstadual || "",
            enderecoFiscal: formatarEnderecoCompletoCliente(c)
          }
        });
      } catch (_) {}
    }

    // 3. Feedback visual
    if (!silencioso) {
      mostrarToast(
        `💾 Pedido <strong>${novoPedido.id}</strong> guardado com sucesso na sua Área do Cliente!`,
        "success"
      );
    }

    // Se estiver na Área do Cliente na aba pedidos, atualiza a exibição
    if (state.categoriaMenu === "minha-conta" && state.abaClienteAtiva === "pedidos") {
      renderizarAreaCliente("pedidos");
    }

    return novoPedido;
  }

  async function enviarPedidoParaWhatsApp() {
    const { whatsapp } = window.SITE_DATA.loja;
    if (state.itensCaixa.length === 0) {
      mostrarToast("Adicione pelo menos 1 item ao seu pedido antes de enviar!", "warning");
      return;
    }

    const chkSide = document.getElementById("chk-cart-precisa-nf");
    const chkDrawer = document.getElementById("chk-drawer-precisa-nf");
    const precisaNf = Boolean(
      (chkSide && chkSide.checked) ||
      (chkDrawer && chkDrawer.checked) ||
      state.precisaNotaFiscalPedido ||
      state.clienteLogado?.precisaNotaFiscal
    );
    state.precisaNotaFiscalPedido = precisaNf;

    // 1. Verifica se o cliente está logado e se todos os dados obrigatórios (e de Nota Fiscal, se marcada) estão preenchidos
    if (!state.clienteLogado) {
      state.acaoPendenteAposLogin = {
        tipo: "enviar_whatsapp",
        precisaNotaFiscal: precisaNf
      };
      fecharGavetaPedido();
      abrirModalAuthCliente("signup", { preMarcarNf: precisaNf });
      mostrarToastNotificacao(
        "👤 Crie sua conta ou faça login rapidamente para enviar seu pedido com seus dados completos no WhatsApp!",
        "info"
      );
      return;
    }

    const validacao = validarDadosCliente(state.clienteLogado, precisaNf);
    if (!validacao.valido) {
      state.acaoPendenteAposLogin = {
        tipo: "enviar_whatsapp",
        precisaNotaFiscal: precisaNf
      };
      fecharGavetaPedido();
      abrirModalAuthCliente("complete", {
        preMarcarNf: precisaNf,
        mensagemTopo: `⚠️ Para finalizar seu pedido, complete os seguintes dados obrigatórios: ${validacao.faltando.join(", ")}.`
      });
      mostrarToast(validacao.mensagem, "warning");
      return;
    }

    const c = state.clienteLogado;
    // Atualiza flag precisaNotaFiscal no cadastro se marcado
    if (c.precisaNotaFiscal !== precisaNf) {
      c.precisaNotaFiscal = precisaNf;
      salvarClienteLocal(c);
    }

    // Salva automaticamente o pedido no histórico do cliente
    const pedidoSalvo = await salvarPedidoOuOrcamentoCliente({
      enviadoWhatsApp: true,
      silencioso: true,
      precisaNotaFiscal: precisaNf
    });

    const totalKgFil = calcularTotalKgFilamentos();
    const valorTotalEstimado = state.itensCaixa.reduce(
      (acc, item) => acc + Number(item.precoUnitario || 0) * item.qtd,
      0
    );
    const temSobConsulta = state.itensCaixa.some((i) => Number(i.precoUnitario || 0) === 0);

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
    const pedidoTag = pedidoSalvo && pedidoSalvo.id ? `\n*Cód. Pedido:* ${pedidoSalvo.id}` : "";

    // Bloco com os Dados Completos do Cliente & Dados Fiscais Aprovados
    const enderecoStr = formatarEnderecoCompletoCliente(c);
    const linhasCliente = [
      `\n\n📋 *DADOS DO CLIENTE (CADASTRO APROVADO):*`,
      `• *Nome do Titular:* ${c.nome}`,
      c.cpf ? `• *CPF:* ${formatarCpf(c.cpf)}` : (c.cnpjCpf ? `• *CPF:* ${c.cnpjCpf}` : ""),
      c.cnpj ? `• *CNPJ da Empresa:* ${formatarCnpj(c.cnpj)}` : "",
      c.razaoSocial ? `• *Razão Social:* ${c.razaoSocial}` : "",
      c.nomeFantasia ? `• *Nome Fantasia:* ${c.nomeFantasia}` : "",
      c.inscricaoEstadual ? `• *Inscrição Estadual:* ${c.inscricaoEstadual}` : "",
      `• *WhatsApp:* ${c.whatsapp}`,
      `• *E-mail:* ${c.email}`,
      enderecoStr ? `• *Endereço Completo:* ${enderecoStr}` : ""
    ].filter(Boolean);

    const fraseNotaFiscal = precisaNf
      ? `\n\n🧾 *SOLICITAÇÃO DE NOTA FISCAL:* Preciso da emissão de Nota Fiscal (NF-e) para este pedido com os dados informados acima.`
      : "";

    const msg = encodeURIComponent(
      `Olá *Loja SJ 3D*! Montei meu pedido no catálogo do site:\n\n` +
        `🛒 *ITENS ESCOLHIDOS:*\n` +
        `${linhas.join("\n")}${resumoPeso}${resumoValor}${pedidoTag}` +
        `${linhasCliente.join("\n")}` +
        `${fraseNotaFiscal}\n\n` +
        `Gostaria de confirmar a disponibilidade e finalizar a compra!`
    );

    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    fecharGavetaPedido();
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
        <div class="raffle-modal-store-links" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <a href="https://www.instagram.com/lojasj3d/" target="_blank" rel="noopener" class="sj-social-logo-btn instagram" title="Instagram @lojasj3d" aria-label="Instagram Loja SJ 3D">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
          <a href="https://www.facebook.com/lojasj3d" target="_blank" rel="noopener" class="sj-social-logo-btn facebook" title="Facebook /lojasj3d" aria-label="Facebook Loja SJ 3D">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
          </a>
          <a href="https://wa.me/5544991351318" target="_blank" rel="noopener" class="sj-social-logo-btn whatsapp" title="WhatsApp (44) 99135-1318" aria-label="WhatsApp Loja SJ 3D">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          <a href="https://share.google/0WwPhjFx69b3V9sU1" target="_blank" rel="noopener" class="sj-social-logo-btn maps" title="Localização no Google Maps" aria-label="Google Maps Loja SJ 3D">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </a>
        </div>
      </div>

      <div class="raffle-modal-footer-actions">
        <button type="button" class="btn-raffle-whatsapp" style="background:#f04e23;" id="btn-raffle-abrir-cadastro">
          🎁 Fazer Meu Cadastro & Concorrer
        </button>
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

    bodyEl.querySelector("#btn-raffle-abrir-cadastro")?.addEventListener("click", () => {
      fecharModalRegrasSorteio();
      abrirModalCadastroCliente();
    });

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

  // =========================================================================
  // SISTEMA DO CLIENTE & MINHA CONTA — LOJA SJ 3D (PORTAL, FAVORITOS E CUPONS)
  // =========================================================================

  // Inicialização do estado do cliente a partir do LocalStorage
  function carregarClienteSalvo() {
    try {
      const c = localStorage.getItem("sj_cliente_ativo_v1");
      if (c) state.clienteLogado = JSON.parse(c);
      const fav = localStorage.getItem("sj_cliente_favoritos_v1");
      if (fav) state.favoritos = JSON.parse(fav);
      if (!Array.isArray(state.favoritos)) state.favoritos = [];
    } catch (_) {}
  }
  carregarClienteSalvo();

  function salvarClienteLocal(cliente) {
    state.clienteLogado = cliente;
    if (cliente) {
      localStorage.setItem("sj_cliente_ativo_v1", JSON.stringify(cliente));
      if (window.SJ_DB?.clientes?.salvar) {
        try {
          window.SJ_DB.clientes.salvar(cliente);
        } catch (_) {}
      }
      if (typeof cliente.precisaNotaFiscal === "boolean" && typeof state.precisaNotaFiscalPedido !== "boolean") {
        state.precisaNotaFiscalPedido = cliente.precisaNotaFiscal;
      }
      if (state.acaoPendenteAposLogin) {
        const pend = state.acaoPendenteAposLogin;
        const precisaNf = Boolean(pend.precisaNotaFiscal || state.precisaNotaFiscalPedido || cliente.precisaNotaFiscal);
        const validacao = validarDadosCliente(cliente, precisaNf);
        if (validacao.valido) {
          state.acaoPendenteAposLogin = null;
          setTimeout(() => {
            if (pend.tipo === "enviar_whatsapp") {
              enviarPedidoParaWhatsApp();
            } else if (pend.tipo === "guardar_pedido") {
              salvarPedidoOuOrcamentoCliente({ enviadoWhatsApp: pend.enviadoWhatsApp });
            }
          }, 350);
        }
      }
    } else {
      localStorage.removeItem("sj_cliente_ativo_v1");
    }
    atualizarBotaoHeaderConta();
    sincronizarStatusNotaFiscalCarrinho();
  }

  function salvarFavoritosLocal() {
    localStorage.setItem("sj_cliente_favoritos_v1", JSON.stringify(state.favoritos));
    atualizarBadgeFavoritos();
  }

  function isFavorito(itemId) {
    return Array.isArray(state.favoritos) && state.favoritos.includes(itemId);
  }

  function toggleFavorito(itemId) {
    if (!itemId) return;

    // Se cliente não estiver logado, abre o pop-up com mensagem
    if (!state.clienteLogado) {
      abrirModalAuthCliente("signup");
      mostrarToastNotificacao("💡 Crie sua conta para guardar seus favoritos e concorra a prêmios!", "info");
      return;
    }

    if (!Array.isArray(state.favoritos)) state.favoritos = [];
    const idx = state.favoritos.indexOf(itemId);
    let adicionado = false;

    if (idx >= 0) {
      state.favoritos.splice(idx, 1);
      mostrarToastNotificacao("Item removido dos seus Favoritos.", "info");
    } else {
      state.favoritos.unshift(itemId);
      adicionado = true;
      mostrarToastNotificacao("❤️ Produto salvo nos seus Favoritos!", "sucesso");
    }

    salvarFavoritosLocal();

    // Atualiza ícones de coração visíveis na tela
    document.querySelectorAll(`[data-toggle-fav="${itemId}"]`).forEach((btn) => {
      btn.classList.toggle("active", adicionado);
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", adicionado ? "#f04e23" : "none");
        svg.setAttribute("stroke", adicionado ? "#f04e23" : "#71717a");
      }
    });

    // Se estiver na Área do Cliente na aba de favoritos, re-renderiza
    if (state.categoriaMenu === "minha-conta" && state.abaClienteAtiva === "favoritos") {
      renderizarAreaCliente("favoritos");
    }
  }

  function atualizarBadgeFavoritos() {
    const badge = document.getElementById("fav-count-badge");
    if (!badge) return;
    const total = (state.favoritos || []).length;
    badge.textContent = total;
    badge.style.display = total > 0 ? "inline-flex" : "none";
  }

  function atualizarBotaoHeaderConta() {
    const btnText = document.getElementById("header-account-btn-text");
    const btn = document.getElementById("header-account-btn");
    if (!btnText || !btn) return;

    if (state.clienteLogado) {
      const primeiroNome = (state.clienteLogado.nome || "Cliente").split(" ")[0];
      btnText.textContent = `Olá, ${primeiroNome}`;
      btn.classList.add("logged-in");
      btn.title = `Minha Conta (${state.clienteLogado.nome})`;
    } else {
      btnText.textContent = "Entrar / Conta";
      btn.classList.remove("logged-in");
      btn.title = "Acessar Minha Conta / Cadastrar";
    }
  }

  function aplicarMascaraTelefone(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 10) {
        input.value = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else if (v.length > 6) {
        input.value = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
      } else if (v.length > 2) {
        input.value = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      } else if (v.length > 0) {
        input.value = `(${v}`;
      } else {
        input.value = "";
      }
    });
  }

  function atualizarFeedbackVisualCpfCnpj(input, forcarExibicaoIncompleto = false) {
    if (!input) return;
    const containerField = input.closest(".auth-field") || input.parentElement;
    const visualBox = input.closest(".auth-input-wrap") || input;

    let feedbackEl = containerField?.querySelector(".cpf-cnpj-live-feedback");
    if (!feedbackEl && containerField) {
      feedbackEl = document.createElement("small");
      feedbackEl.className = "cpf-cnpj-live-feedback";
      feedbackEl.style.display = "none";
      feedbackEl.style.fontSize = "0.75rem";
      feedbackEl.style.fontWeight = "700";
      feedbackEl.style.marginTop = "5px";
      feedbackEl.style.lineHeight = "1.3";
      containerField.appendChild(feedbackEl);
    }

    const digitos = String(input.value || "").replace(/\D/g, "");
    if (!digitos) {
      visualBox.style.borderColor = "";
      visualBox.style.backgroundColor = "";
      input.setCustomValidity?.("");
      if (feedbackEl) feedbackEl.style.display = "none";
      return;
    }

    // Valida imediatamente a partir de 11 dígitos (CPF ou CNPJ) ou quando o usuário sai do campo (blur/submit)
    if (digitos.length >= 11 || forcarExibicaoIncompleto) {
      const check = validarDocumentoCpfOuCnpj(digitos);
      if (check.valido) {
        visualBox.style.borderColor = "#16a34a";
        visualBox.style.backgroundColor = "#f0fdf4";
        input.setCustomValidity?.("");
        if (feedbackEl) {
          feedbackEl.style.display = "block";
          feedbackEl.style.color = "#15803d";
          feedbackEl.textContent = check.mensagem;
        }
      } else {
        visualBox.style.borderColor = "#dc2626";
        visualBox.style.backgroundColor = "#fef2f2";
        input.setCustomValidity?.(check.mensagem.replace(/^❌\s*/, ""));
        if (feedbackEl) {
          feedbackEl.style.display = "block";
          feedbackEl.style.color = "#dc2626";
          feedbackEl.textContent = check.mensagem;
        }
      }
    } else {
      visualBox.style.borderColor = "";
      visualBox.style.backgroundColor = "";
      input.setCustomValidity?.("");
      if (feedbackEl) feedbackEl.style.display = "none";
    }
  }

  function aplicarMascaraCpfCnpj(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 14) v = v.slice(0, 14);
      if (v.length > 11) {
        // CNPJ
        input.value = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
      } else if (v.length > 9) {
        // CPF
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
      } else if (v.length > 6) {
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      } else if (v.length > 3) {
        input.value = `${v.slice(0, 3)}.${v.slice(3)}`;
      } else {
        input.value = v;
      }
      atualizarFeedbackVisualCpfCnpj(input, false);
    });

    input.addEventListener("blur", () => {
      atualizarFeedbackVisualCpfCnpj(input, true);
    });
  }

  // =========================================================================
  // CONSULTA PÚBLICA DE CNPJ NA RECEITA FEDERAL (BRASILAPI + MINHARECEITA)
  // =========================================================================
  async function consultarCnpjReceita(cnpjRaw) {
    const digitos = String(cnpjRaw || "").replace(/\D/g, "");
    if (digitos.length !== 14) {
      throw new Error("CNPJ incompleto (informe os 14 números).");
    }

    if (!validarCnpjOficial(digitos)) {
      throw new Error("CNPJ inválido (dígitos verificadores incorretos).");
    }

    // Provedor Primário: BrasilAPI (Rápido, dados oficiais da RFB, CORS aberto)
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (resp.ok) {
        const d = await resp.json();
        const cepFmt = d.cep ? (String(d.cep).length === 8 ? `${String(d.cep).slice(0, 5)}-${String(d.cep).slice(5)}` : String(d.cep)) : "";
        const telFmt = d.ddd_telefone_1 ? (d.ddd_telefone_1.length === 10 ? `(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2, 6)}-${d.ddd_telefone_1.slice(6)}` : `(${d.ddd_telefone_1.slice(0, 2)}) ${d.ddd_telefone_1.slice(2, 7)}-${d.ddd_telefone_1.slice(7)}`) : "";
        const tipoLog = d.descricao_tipo_de_logradouro ? `${d.descricao_tipo_de_logradouro} ` : "";
        return {
          sucesso: true,
          cnpj: d.cnpj || digitos,
          razaoSocial: d.razao_social || "",
          nomeFantasia: d.nome_fantasia || d.razao_social || "",
          situacao: d.descricao_situacao_cadastral || "ATIVA",
          cep: cepFmt,
          logradouro: `${tipoLog}${d.logradouro || ""}`.trim(),
          numero: d.numero || "",
          complemento: d.complemento || "",
          bairro: d.bairro || "",
          cidade: d.municipio || "",
          uf: (d.uf || "").toUpperCase(),
          telefone: telFmt,
          email: d.email || ""
        };
      }
    } catch (e) {
      console.warn("BrasilAPI falhou, tentando fallback MinhaReceita...", e);
    }

    // Provedor Secundário: MinhaReceita (Fallback gratuito e aberto)
    try {
      const resp2 = await fetch(`https://minhareceita.org/${digitos}`);
      if (resp2.ok) {
        const d2 = await resp2.json();
        const cepFmt2 = d2.cep ? (String(d2.cep).length === 8 ? `${String(d2.cep).slice(0, 5)}-${String(d2.cep).slice(5)}` : String(d2.cep)) : "";
        const tipoLog2 = d2.descricao_tipo_de_logradouro ? `${d2.descricao_tipo_de_logradouro} ` : "";
        return {
          sucesso: true,
          cnpj: d2.cnpj || digitos,
          razaoSocial: d2.razao_social || "",
          nomeFantasia: d2.nome_fantasia || d2.razao_social || "",
          situacao: d2.descricao_situacao_cadastral || "ATIVA",
          cep: cepFmt2,
          logradouro: `${tipoLog2}${d2.logradouro || ""}`.trim(),
          numero: d2.numero || "",
          complemento: d2.complemento || "",
          bairro: d2.bairro || "",
          cidade: d2.municipio || "",
          uf: (d2.uf || "").toUpperCase(),
          telefone: d2.ddd_telefone_1 || "",
          email: d2.email || ""
        };
      }
    } catch (e2) {
      console.warn("MinhaReceita falhou...", e2);
    }

    throw new Error("Não foi possível localizar os dados deste CNPJ na Receita Federal. Você pode preencher os campos manualmente.");
  }

  function atualizarFeedbackVisualCpf(input, forcarExibicao = false) {
    if (!input) return;
    const containerField = input.closest(".auth-field") || input.parentElement;
    const visualBox = input.closest(".auth-input-wrap") || input;

    let feedbackEl = containerField?.querySelector(".cpf-live-feedback");
    if (!feedbackEl && containerField) {
      feedbackEl = document.createElement("small");
      feedbackEl.className = "cpf-live-feedback";
      feedbackEl.style.display = "none";
      feedbackEl.style.fontSize = "0.75rem";
      feedbackEl.style.fontWeight = "700";
      feedbackEl.style.marginTop = "5px";
      feedbackEl.style.lineHeight = "1.3";
      containerField.appendChild(feedbackEl);
    }

    const digitos = String(input.value || "").replace(/\D/g, "");
    if (!digitos) {
      visualBox.style.borderColor = "";
      visualBox.style.backgroundColor = "";
      input.setCustomValidity?.("");
      if (feedbackEl) feedbackEl.style.display = "none";
      return;
    }

    if (digitos.length === 11 || (forcarExibicao && digitos.length > 0)) {
      const ok = digitos.length === 11 && validarCpfOficial(digitos);
      if (ok) {
        visualBox.style.borderColor = "#16a34a";
        visualBox.style.backgroundColor = "#f0fdf4";
        input.setCustomValidity?.("");
        if (feedbackEl) {
          feedbackEl.style.display = "block";
          feedbackEl.style.color = "#15803d";
          feedbackEl.textContent = "✓ CPF válido";
        }
      } else {
        visualBox.style.borderColor = "#dc2626";
        visualBox.style.backgroundColor = "#fef2f2";
        input.setCustomValidity?.("CPF inválido");
        if (feedbackEl) {
          feedbackEl.style.display = "block";
          feedbackEl.style.color = "#dc2626";
          feedbackEl.textContent = digitos.length === 11 ? "❌ CPF inválido (verifique os números digitados)" : "❌ CPF incompleto (digite os 11 números)";
        }
      }
    } else {
      visualBox.style.borderColor = "";
      visualBox.style.backgroundColor = "";
      input.setCustomValidity?.("");
      if (feedbackEl) feedbackEl.style.display = "none";
    }
  }

  function aplicarMascaraCpfApenas(input) {
    if (!input) return;
    input.addEventListener("input", () => {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9) {
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
      } else if (v.length > 6) {
        input.value = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      } else if (v.length > 3) {
        input.value = `${v.slice(0, 3)}.${v.slice(3)}`;
      } else {
        input.value = v;
      }
      atualizarFeedbackVisualCpf(input, false);
    });

    input.addEventListener("blur", () => {
      atualizarFeedbackVisualCpf(input, true);
    });
  }

  function aplicarMascaraCnpjComAutoBusca(input, aoCompletarCnpj = null, btnBuscaManual = null, statusEl = null, spinnerEl = null) {
    if (!input) return;

    const formatar = () => {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 14) v = v.slice(0, 14);
      if (v.length > 12) {
        input.value = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
      } else if (v.length > 8) {
        input.value = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
      } else if (v.length > 5) {
        input.value = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
      } else if (v.length > 2) {
        input.value = `${v.slice(0, 2)}.${v.slice(2)}`;
      } else {
        input.value = v;
      }
      return v;
    };

    let debounceTimer = null;
    let buscandoCnpj = false;

    const executarBusca = async (forcar = false) => {
      const digitos = input.value.replace(/\D/g, "");
      if (digitos.length !== 14) {
        if (forcar) {
          if (statusEl) {
            statusEl.style.display = "block";
            statusEl.style.background = "#FEF2F2";
            statusEl.style.color = "#991B1B";
            statusEl.style.border = "1px solid #FECACA";
            statusEl.innerHTML = "⚠️ Digite os 14 números do CNPJ para buscar.";
          }
        }
        return;
      }

      if (buscandoCnpj) return;
      buscandoCnpj = true;

      if (spinnerEl) spinnerEl.style.display = "inline-block";
      if (btnBuscaManual) {
        btnBuscaManual.disabled = true;
        btnBuscaManual.textContent = "Buscando...";
      }
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.style.background = "#EFF6FF";
        statusEl.style.color = "#1D4ED8";
        statusEl.style.border = "1px solid #BFDBFE";
        statusEl.innerHTML = "⏳ <strong>Consultando Receita Federal e dados da empresa na internet...</strong>";
      }

      try {
        const dados = await consultarCnpjReceita(digitos);
        if (spinnerEl) spinnerEl.style.display = "none";
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.style.background = "#ECFDF5";
          statusEl.style.color = "#065F46";
          statusEl.style.border = "1px solid #A7F3D0";
          const fantasiaTxt = dados.nomeFantasia && dados.nomeFantasia !== dados.razaoSocial ? ` (${escaparHtml(dados.nomeFantasia)})` : "";
          statusEl.innerHTML = `✅ <strong>${escaparHtml(dados.razaoSocial)}</strong>${fantasiaTxt} • <em>Situação: ${escaparHtml(dados.situacao)}</em><br /><small style="color:#047857;">Endereço, Razão Social e dados fiscais preenchidos automaticamente!</small>`;
        }
        if (typeof aoCompletarCnpj === "function") {
          aoCompletarCnpj(dados);
        }
      } catch (err) {
        if (spinnerEl) spinnerEl.style.display = "none";
        if (statusEl) {
          statusEl.style.display = "block";
          statusEl.style.background = "#FEF2F2";
          statusEl.style.color = "#991B1B";
          statusEl.style.border = "1px solid #FECACA";
          statusEl.innerHTML = `⚠️ ${escaparHtml(err.message)}`;
        }
      } finally {
        buscandoCnpj = false;
        if (btnBuscaManual) {
          btnBuscaManual.disabled = false;
          btnBuscaManual.textContent = "🔍 Buscar CNPJ";
        }
      }
    };

    input.addEventListener("input", () => {
      const digitos = formatar();
      clearTimeout(debounceTimer);
      if (digitos.length === 14) {
        debounceTimer = setTimeout(() => executarBusca(false), 350);
      }
    });

    btnBuscaManual?.addEventListener("click", () => {
      formatar();
      executarBusca(true);
    });
  }

  function aplicarMascaraCep(input, aoCompletarCep = null) {
    if (!input) return;
    input.addEventListener("input", async () => {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 8) v = v.slice(0, 8);
      if (v.length > 5) {
        input.value = `${v.slice(0, 5)}-${v.slice(5)}`;
      } else {
        input.value = v;
      }

      if (v.length === 8 && typeof aoCompletarCep === "function") {
        try {
          const r = await fetch(`https://viacep.com.br/ws/${v}/json/`);
          if (r.ok) {
            const dados = await r.json();
            if (dados && !dados.erro) {
              aoCompletarCep(dados);
            }
          }
        } catch (_) {}
      }
    });
  }

  function buscarDadosClienteSalvoPorEmail(email) {
    if (!email) return null;
    const emailLimpo = String(email).trim().toLowerCase();
    const lista = window.SJ_DB?.clientes?.listar?.() || [];
    return lista.find((c) => String(c.email || "").trim().toLowerCase() === emailLimpo) || null;
  }

  // =========================================================================
  // MODAL POP-UP DE AUTENTICAÇÃO DO CLIENTE (LOGIN / CADASTRO / GOOGLE / NF-E)
  // =========================================================================

  function abrirModalAuthCliente(abaInicial = "login", opcoes = {}) {
    const modal = document.getElementById("modal-client-auth");
    if (!modal) return;

    alternarAbaAuthCliente(abaInicial, opcoes);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalAuthCliente() {
    const modal = document.getElementById("modal-client-auth");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function abrirModalPoliticaPrivacidade() {
    const modal = document.getElementById("modal-privacy-policy");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalPoliticaPrivacidade() {
    const modal = document.getElementById("modal-privacy-policy");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function abrirModalLgpdSolicitacao() {
    const modal = document.getElementById("modal-lgpd-titular-request");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalLgpdSolicitacao() {
    const modal = document.getElementById("modal-lgpd-titular-request");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ==========================================================================
  // GESTÃO DE COOKIES E CONSENTIMENTO LGPD (ART. 8º E 9º)
  // ==========================================================================
  const COOKIE_CONSENT_KEY = "sj_cookies_consent_v1";

  function obterConsentimentoCookies() {
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function aplicarPreferenciasCookies(consent) {
    if (!consent) return;
    window.SJ_COOKIES = {
      preferencias: consent,
      podeExecutar: (categoria) => {
        if (categoria === "essenciais") return true;
        return !!consent[categoria];
      }
    };
    try {
      window.dispatchEvent(new CustomEvent("sj_cookies_updated", { detail: consent }));
    } catch (_) {}
  }

  async function salvarConsentimentoCookies(prefs = {}) {
    const consent = {
      essenciais: true, // Sempre obrigatório para login/carrinho/segurança
      funcionais: Boolean(prefs.funcionais),
      analiticos: Boolean(prefs.analiticos),
      marketing: Boolean(prefs.marketing),
      versao: "2026.1",
      data_hora: new Date().toISOString()
    };

    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    } catch (e) {
      console.warn("Não foi possível salvar cookies no localStorage:", e);
    }

    // Ocultar banner e fechar modal
    const banner = document.getElementById("cookie-consent-banner");
    if (banner) banner.style.display = "none";
    fecharModalPreferenciasCookies();

    // Ativar preferências globais
    aplicarPreferenciasCookies(consent);

    // Registro comprobatório assíncrono no banco de consentimentos (se online)
    try {
      if (window.SJ_SUPABASE?.consentimentos?.registrar) {
        window.SJ_SUPABASE.consentimentos.registrar({
          finalidade: "cookies_preferencias",
          status: "concedido",
          versao_termo: "v1.0-2026",
          canal: "banner_cookies"
        }).catch(() => {});
      }
    } catch (_) {}

    mostrarToast("Preferências de privacidade e cookies salvas com sucesso!", "success");
  }

  function abrirModalPreferenciasCookies() {
    const modal = document.getElementById("modal-cookie-preferences");
    if (!modal) return;
    const consent = obterConsentimentoCookies() || {
      essenciais: true,
      funcionais: true,
      analiticos: false,
      marketing: false
    };

    const chkFunc = document.getElementById("chk-cookie-funcionais");
    const chkAnalit = document.getElementById("chk-cookie-analiticos");
    const chkMkt = document.getElementById("chk-cookie-marketing");

    if (chkFunc) chkFunc.checked = Boolean(consent.funcionais);
    if (chkAnalit) chkAnalit.checked = Boolean(consent.analiticos);
    if (chkMkt) chkMkt.checked = Boolean(consent.marketing);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharModalPreferenciasCookies() {
    const modal = document.getElementById("modal-cookie-preferences");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function alternarAbaAuthCliente(aba, opcoes = {}) {
    const tabLogin = document.getElementById("tab-client-login");
    const tabSignup = document.getElementById("tab-client-signup");
    const formLogin = document.getElementById("form-client-login");
    const formSignup = document.getElementById("form-client-signup");
    const formComplete = document.getElementById("form-client-complete");
    const btnGoogle = document.getElementById("btn-google-client-login");
    const divider = document.getElementById("client-auth-divider");
    const tabsWrap = document.getElementById("client-auth-tabs-wrap");
    const title = document.getElementById("client-auth-title");
    const desc = document.getElementById("client-auth-desc");

    if (aba === "complete") {
      if (btnGoogle) btnGoogle.style.display = "none";
      if (divider) divider.style.display = "none";
      if (tabsWrap) tabsWrap.style.display = "none";
      if (formLogin) formLogin.style.display = "none";
      if (formSignup) formSignup.style.display = "none";
      if (formComplete) formComplete.style.display = "flex";

      const c = state.clienteLogado || {};
      const precisaNf = Boolean(
        opcoes.preMarcarNf ||
        state.precisaNotaFiscalPedido ||
        c.precisaNotaFiscal
      );

      if (title) {
        title.textContent = "Completar Meu Cadastro de Cliente";
      }
      if (desc) {
        desc.textContent = "Preencha seus dados obrigatórios para aprovar seu cadastro e finalizar seus pedidos.";
      }

      const banner = document.getElementById("complete-profile-banner");
      if (banner) {
        banner.innerHTML = opcoes.mensagemTopo
          ? `<strong>${escaparHtml(opcoes.mensagemTopo)}</strong>`
          : `<strong>✅ Conta conectada (${escaparHtml(c.email || c.nome || "Cliente")})!</strong> Complete os campos obrigatórios abaixo para aprovar seu cadastro.`;
      }

      if (formComplete) {
        const setVal = (name, val) => {
          const el = formComplete.querySelector(`input[name="${name}"]`);
          if (el && val != null && val !== "") el.value = val;
        };

        const docLimpo = String(c.cpf || c.cnpjCpf || "").replace(/\D/g, "");
        let cpfVal = "";
        let cnpjVal = String(c.cnpj || "").replace(/\D/g, "");
        if (docLimpo.length === 11) {
          cpfVal = formatarCpf(docLimpo);
        } else if (docLimpo.length === 14 && !cnpjVal) {
          cnpjVal = docLimpo;
        }

        setVal("comp_nome", c.nome || "");
        setVal("comp_whatsapp", c.whatsapp || "");
        setVal("comp_cpf", cpfVal);
        setVal("comp_email", c.email || "");
        setVal("comp_cnpj", cnpjVal ? formatarCnpj(cnpjVal) : "");
        setVal("comp_razao_social", c.razaoSocial || (cnpjVal ? c.nome || "" : ""));
        setVal("comp_nome_fantasia", c.nomeFantasia || "");
        setVal("comp_cep", c.cep || "");
        setVal("comp_ie", c.inscricaoEstadual || "");
        setVal("comp_logradouro", c.logradouro || "");
        setVal("comp_numero", c.numero || "");
        setVal("comp_bairro", c.bairro || "");
        setVal("comp_complemento", c.complemento || "");
        setVal("comp_cidade", c.cidade || "Umuarama");
        setVal("comp_uf", c.uf || "PR");

        const temEmpresa = Boolean(precisaNf || cnpjVal);
        const chkCompNf = document.getElementById("chk-complete-precisa-nf");
        const wrapCompNf = document.getElementById("complete-nf-fields-wrap");
        if (chkCompNf) chkCompNf.checked = temEmpresa;
        if (wrapCompNf) wrapCompNf.style.display = temEmpresa ? "flex" : "none";

        const btnSubComp = document.getElementById("btn-submit-client-complete");
        if (btnSubComp) {
          btnSubComp.innerHTML =
            state.acaoPendenteAposLogin?.tipo === "enviar_whatsapp"
              ? `<span>✅ Aprovar Cadastro & Enviar Pedido no WhatsApp</span>`
              : `<span>✅ Salvar & Aprovar Meu Cadastro</span>`;
        }
      }
      return;
    }

    if (btnGoogle) btnGoogle.style.display = "flex";
    if (divider) divider.style.display = "flex";
    if (tabsWrap) tabsWrap.style.display = "grid";
    if (formComplete) formComplete.style.display = "none";

    if (aba === "signup") {
      tabSignup?.classList.add("active");
      tabLogin?.classList.remove("active");
      if (formSignup) formSignup.style.display = "flex";
      if (formLogin) formLogin.style.display = "none";
      if (title) title.textContent = "Criar Minha Conta no Clube SJ";
      if (desc) desc.textContent = "Preencha seus dados abaixo para criar sua conta e acompanhar seus pedidos.";

      const chkSignupNf = document.getElementById("chk-signup-precisa-nf");
      const wrapSignupNf = document.getElementById("signup-nf-fields-wrap");
      const preMarcar = Boolean(opcoes.preMarcarNf || state.precisaNotaFiscalPedido);
      if (chkSignupNf && preMarcar) {
        chkSignupNf.checked = true;
      }
      if (wrapSignupNf && chkSignupNf) {
        wrapSignupNf.style.display = chkSignupNf.checked ? "flex" : "none";
      }
    } else {
      tabLogin?.classList.add("active");
      tabSignup?.classList.remove("active");
      if (formLogin) formLogin.style.display = "flex";
      if (formSignup) formSignup.style.display = "none";
      if (title) title.textContent = "Entrar na Minha Conta";
      if (desc) desc.textContent = "Acesse seus favoritos, histórico de compras e seus cupons.";
    }
  }

  function configurarModalAuthCliente() {
    const tabLogin = document.getElementById("tab-client-login");
    const tabSignup = document.getElementById("tab-client-signup");
    const formLogin = document.getElementById("form-client-login");
    const formSignup = document.getElementById("form-client-signup");
    const formComplete = document.getElementById("form-client-complete");
    const btnGoogle = document.getElementById("btn-google-client-login");
    const btnClose = document.getElementById("close-client-auth-btn");
    const modal = document.getElementById("modal-client-auth");

    tabLogin?.addEventListener("click", () => alternarAbaAuthCliente("login"));
    tabSignup?.addEventListener("click", () => alternarAbaAuthCliente("signup"));
    btnClose?.addEventListener("click", fecharModalAuthCliente);
    modal?.addEventListener("click", (e) => {
      if (e.target.id === "modal-client-auth") fecharModalAuthCliente();
    });

    // Abertura / Fechamento da Política de Privacidade LGPD
    const btnOpenPrivacySignup = document.getElementById("btn-open-privacy-from-signup");
    const btnOpenPrivacyComp = document.getElementById("btn-open-privacy-from-complete");
    const footerPrivacyLink = document.getElementById("footer-privacy-link");
    const closePrivacyBtn = document.getElementById("close-privacy-policy-btn");
    const closePrivacyConfirm = document.getElementById("btn-close-privacy-policy-confirm");
    const modalPrivacy = document.getElementById("modal-privacy-policy");

    btnOpenPrivacySignup?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPoliticaPrivacidade();
    });
    btnOpenPrivacyComp?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPoliticaPrivacidade();
    });
    footerPrivacyLink?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPoliticaPrivacidade();
    });
    closePrivacyBtn?.addEventListener("click", fecharModalPoliticaPrivacidade);
    closePrivacyConfirm?.addEventListener("click", fecharModalPoliticaPrivacidade);
    modalPrivacy?.addEventListener("click", (e) => {
      if (e.target.id === "modal-privacy-policy") fecharModalPoliticaPrivacidade();
    });

    // Abertura / Fechamento do Canal de Direitos do Titular LGPD
    const footerLgpdLink = document.getElementById("footer-lgpd-request-link");
    const closeLgpdBtn = document.getElementById("close-lgpd-request-btn");
    const modalLgpd = document.getElementById("modal-lgpd-titular-request");
    const tabLgpdNova = document.getElementById("tab-lgpd-nova-solic");
    const tabLgpdConsultar = document.getElementById("tab-lgpd-consultar-solic");
    const formLgpdSolic = document.getElementById("form-lgpd-solicitacao");
    const paneLgpdConsultar = document.getElementById("pane-lgpd-consultar");
    const btnConsultarProt = document.getElementById("btn-consultar-protocolo-exec");
    const inputBuscaProt = document.getElementById("input-lgpd-busca-protocolo");
    const resultadoConsultaProt = document.getElementById("lgpd-consulta-resultado");

    footerLgpdLink?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalLgpdSolicitacao();
    });
    closeLgpdBtn?.addEventListener("click", fecharModalLgpdSolicitacao);
    modalLgpd?.addEventListener("click", (e) => {
      if (e.target.id === "modal-lgpd-titular-request") fecharModalLgpdSolicitacao();
    });

    tabLgpdNova?.addEventListener("click", () => {
      tabLgpdNova.classList.add("active");
      tabLgpdConsultar?.classList.remove("active");
      if (formLgpdSolic) formLgpdSolic.style.display = "flex";
      if (paneLgpdConsultar) paneLgpdConsultar.style.display = "none";
    });

    tabLgpdConsultar?.addEventListener("click", () => {
      tabLgpdConsultar.classList.add("active");
      tabLgpdNova?.classList.remove("active");
      if (formLgpdSolic) formLgpdSolic.style.display = "none";
      if (paneLgpdConsultar) paneLgpdConsultar.style.display = "flex";
    });

    // Envio do formulário de solicitação de direitos
    formLgpdSolic?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById("btn-submit-lgpd-request");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "<span>⏳ Registrando solicitação...</span>";
      }

      const nome = formLgpdSolic.querySelector('input[name="titular_nome"]')?.value;
      const email = formLgpdSolic.querySelector('input[name="titular_email"]')?.value;
      const cpf = formLgpdSolic.querySelector('input[name="titular_cpf"]')?.value;
      const tipo = formLgpdSolic.querySelector('select[name="tipo_solicitacao"]')?.value;
      const detalhes = formLgpdSolic.querySelector('textarea[name="detalhes_solicitacao"]')?.value;

      try {
        let res = null;
        if (window.SJ_SUPABASE?.direitosTitular?.solicitar) {
          res = await window.SJ_SUPABASE.direitosTitular.solicitar({
            nome,
            email,
            cpf,
            tipo,
            detalhes
          });
        }
        const protocolo = res?.protocolo || ("LGPD-2026-" + Math.floor(1000 + Math.random() * 9000));
        alert(`✅ Solicitação registrada com sucesso!\n\nSeu Protocolo: ${protocolo}\nPrazo de Resposta: até 15 dias (Art. 19, II da LGPD).\n\nGuarde este número para consultar o andamento a qualquer momento.`);
        mostrarToast(`Protocolo ${protocolo} gerado com sucesso!`, "success");
        formLgpdSolic.reset();
        fecharModalLgpdSolicitacao();
      } catch (err) {
        alert("Erro ao enviar solicitação: " + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = "<span>📨 Registrar Solicitação &amp; Gerar Protocolo</span>";
        }
      }
    });

    // Consulta de status de protocolo existente
    btnConsultarProt?.addEventListener("click", async () => {
      const prot = String(inputBuscaProt?.value || "").trim().toUpperCase();
      if (!prot) {
        alert("Digite o número do protocolo.");
        return;
      }
      btnConsultarProt.disabled = true;
      btnConsultarProt.textContent = "Buscando...";
      try {
        let solic = null;
        if (window.SJ_SUPABASE?.direitosTitular?.consultarProtocolo) {
          solic = await window.SJ_SUPABASE.direitosTitular.consultarProtocolo(prot);
        }
        if (!solic) {
          alert(`Protocolo "${prot}" não localizado.`);
          if (resultadoConsultaProt) resultadoConsultaProt.style.display = "none";
          return;
        }

        const statusMap = {
          em_analise: "🟡 Em Análise (No Prazo)",
          concluida: "🟢 Concluída",
          rejeitada: "🔴 Rejeitada",
          cancelada: "⚪ Cancelada"
        };
        const statusTexto = statusMap[solic.status] || solic.status;
        const dataAbertura = new Date(solic.criado_em).toLocaleDateString("pt-BR");
        const dataLimite = new Date(solic.prazo_limite).toLocaleDateString("pt-BR");

        if (resultadoConsultaProt) {
          resultadoConsultaProt.style.display = "block";
          resultadoConsultaProt.innerHTML = `
            <div style="font-size:0.82rem; font-weight:800; color:#0F172A; margin-bottom:6px;">
              Protocolo: ${escaparHtml(solic.protocolo)}
            </div>
            <div style="font-size:0.78rem; color:#475569; display:grid; gap:4px; line-height:1.5;">
              <div><strong>Titular:</strong> ${escaparHtml(solic.titular_nome)}</div>
              <div><strong>Status:</strong> ${statusTexto}</div>
              <div><strong>Data de Abertura:</strong> ${dataAbertura}</div>
              <div><strong>Prazo Limite Legal (15 dias):</strong> ${dataLimite}</div>
              ${solic.resposta_texto ? `
                <div style="margin-top:8px; padding:10px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; color:#166534;">
                  <strong>Resposta Oficial da Loja SJ 3D:</strong><br />
                  ${escaparHtml(solic.resposta_texto)}
                </div>
              ` : `
                <div style="margin-top:6px; color:#92400E; font-size:0.75rem;">
                  ⏳ Sua solicitação está em processamento pelo Encarregado de Dados. A resposta será concluída dentro do prazo legal de 15 dias.
                </div>
              `}
            </div>
          `;
        }
      } catch (err) {
        alert("Erro ao consultar protocolo: " + err.message);
      } finally {
        btnConsultarProt.disabled = false;
        btnConsultarProt.textContent = "🔍 Buscar";
      }
    });

    // ========================================================================
    // EVENTOS E INICIALIZAÇÃO DO BANNER E MODAL DE COOKIES LGPD
    // ========================================================================
    const bannerCookie = document.getElementById("cookie-consent-banner");
    const btnCookieAcceptAll = document.getElementById("btn-cookie-accept-all");
    const btnCookieRejectNonEssential = document.getElementById("btn-cookie-reject-nonessential");
    const btnCookieOpenCustomize = document.getElementById("btn-cookie-open-customize");
    const btnFooterCookiePref = document.getElementById("btn-footer-cookie-pref");
    const closeCookiePrefBtn = document.getElementById("close-cookie-pref-btn");
    const btnCookieRejectModal = document.getElementById("btn-cookie-reject-modal");
    const btnCookieSavePreferences = document.getElementById("btn-cookie-save-preferences");
    const modalCookiePref = document.getElementById("modal-cookie-preferences");

    btnCookieAcceptAll?.addEventListener("click", () => {
      salvarConsentimentoCookies({ funcionais: true, analiticos: true, marketing: true });
    });

    btnCookieRejectNonEssential?.addEventListener("click", () => {
      salvarConsentimentoCookies({ funcionais: false, analiticos: false, marketing: false });
    });

    btnCookieOpenCustomize?.addEventListener("click", () => {
      abrirModalPreferenciasCookies();
    });

    btnFooterCookiePref?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPreferenciasCookies();
    });

    closeCookiePrefBtn?.addEventListener("click", fecharModalPreferenciasCookies);

    btnCookieRejectModal?.addEventListener("click", () => {
      salvarConsentimentoCookies({ funcionais: false, analiticos: false, marketing: false });
    });

    btnCookieSavePreferences?.addEventListener("click", () => {
      const func = document.getElementById("chk-cookie-funcionais")?.checked;
      const analit = document.getElementById("chk-cookie-analiticos")?.checked;
      const mkt = document.getElementById("chk-cookie-marketing")?.checked;
      salvarConsentimentoCookies({ funcionais: func, analiticos: analit, marketing: mkt });
    });

    modalCookiePref?.addEventListener("click", (e) => {
      if (e.target.id === "modal-cookie-preferences") fecharModalPreferenciasCookies();
    });

    // Inicialização da verificação de consentimento de cookies
    const consentimentoExistente = obterConsentimentoCookies();
    if (consentimentoExistente) {
      aplicarPreferenciasCookies(consentimentoExistente);
    } else {
      setTimeout(() => {
        if (bannerCookie && !obterConsentimentoCookies()) {
          bannerCookie.style.display = "block";
        }
      }, 1200);
    }

    // Sincronizar checkboxes de Nota Fiscal no Carrinho Lateral e Gaveta
    const chkCartNf = document.getElementById("chk-cart-precisa-nf");
    const chkDrawerNf = document.getElementById("chk-drawer-precisa-nf");
    const aoAlternarNfCarrinho = (checked) => {
      state.precisaNotaFiscalPedido = Boolean(checked);
      if (state.clienteLogado) {
        state.clienteLogado.precisaNotaFiscal = Boolean(checked);
        localStorage.setItem("sj_cliente_ativo_v1", JSON.stringify(state.clienteLogado));
      }
      sincronizarStatusNotaFiscalCarrinho();
    };
    chkCartNf?.addEventListener("change", (e) => aoAlternarNfCarrinho(e.target.checked));
    chkDrawerNf?.addEventListener("change", (e) => aoAlternarNfCarrinho(e.target.checked));

    // Toggle dos campos de Nota Fiscal no Cadastro Local
    const chkSignupNf = document.getElementById("chk-signup-precisa-nf");
    const wrapSignupNf = document.getElementById("signup-nf-fields-wrap");
    chkSignupNf?.addEventListener("change", () => {
      if (wrapSignupNf) wrapSignupNf.style.display = chkSignupNf.checked ? "flex" : "none";
    });

    // Toggle dos campos de Nota Fiscal no Complemento de Cadastro
    const chkCompNf = document.getElementById("chk-complete-precisa-nf");
    const wrapCompNf = document.getElementById("complete-nf-fields-wrap");
    chkCompNf?.addEventListener("change", () => {
      if (wrapCompNf) wrapCompNf.style.display = chkCompNf.checked ? "flex" : "none";
    });

    // Máscaras nos campos de cadastro, busca automática de CEP (ViaCEP) e CNPJ (Receita Federal)
    if (formSignup) {
      aplicarMascaraTelefone(formSignup.querySelector('input[name="signup_whatsapp"]'));
      aplicarMascaraCpfApenas(formSignup.querySelector('input[name="signup_cpf"]'));
      aplicarMascaraCnpjComAutoBusca(
        formSignup.querySelector('input[name="signup_cnpj"]'),
        (dados) => {
          if (!dados) return;
          const razaoInp = formSignup.querySelector('input[name="signup_razao_social"]');
          const fantInp = formSignup.querySelector('input[name="signup_nome_fantasia"]');
          const cepInp = formSignup.querySelector('input[name="signup_cep"]');
          const logInp = formSignup.querySelector('input[name="signup_logradouro"]');
          const numInp = formSignup.querySelector('input[name="signup_numero"]');
          const baiInp = formSignup.querySelector('input[name="signup_bairro"]');
          const compInp = formSignup.querySelector('input[name="signup_complemento"]');
          const cidInp = formSignup.querySelector('input[name="signup_cidade"]');
          const ufInp = formSignup.querySelector('input[name="signup_uf"]');
          const zapInp = formSignup.querySelector('input[name="signup_whatsapp"]');

          if (razaoInp && dados.razao_social) razaoInp.value = dados.razao_social;
          if (fantInp && (dados.nome_fantasia || dados.razao_social)) fantInp.value = dados.nome_fantasia || dados.razao_social;
          if (cepInp && dados.cep) cepInp.value = formatarCep(dados.cep);
          if (logInp && dados.logradouro) {
            logInp.value = dados.descricao_tipo_de_logradouro
              ? `${dados.descricao_tipo_de_logradouro} ${dados.logradouro}`.trim()
              : dados.logradouro;
          }
          if (numInp && dados.numero) numInp.value = dados.numero;
          if (baiInp && dados.bairro) baiInp.value = dados.bairro;
          if (compInp && dados.complemento) compInp.value = dados.complemento;
          if (cidInp && dados.municipio) cidInp.value = dados.municipio;
          if (ufInp && dados.uf) ufInp.value = dados.uf;
          if (zapInp && !zapInp.value && dados.ddd_telefone_1) {
            zapInp.value = dados.ddd_telefone_1;
            aplicarMascaraTelefone(zapInp);
          }
        },
        document.getElementById("btn-buscar-cnpj-signup"),
        document.getElementById("status-cnpj-signup"),
        document.getElementById("spinner-cnpj-signup")
      );
      aplicarMascaraCep(formSignup.querySelector('input[name="signup_cep"]'), (dadosCep) => {
        const logInp = formSignup.querySelector('input[name="signup_logradouro"]');
        const baiInp = formSignup.querySelector('input[name="signup_bairro"]');
        const cidInp = formSignup.querySelector('input[name="signup_cidade"]');
        const ufInp = formSignup.querySelector('input[name="signup_uf"]');
        if (logInp && dadosCep.logradouro) logInp.value = dadosCep.logradouro;
        if (baiInp && dadosCep.bairro) baiInp.value = dadosCep.bairro;
        if (cidInp && dadosCep.localidade) cidInp.value = dadosCep.localidade;
        if (ufInp && dadosCep.uf) ufInp.value = dadosCep.uf;
      });
    }

    if (formComplete) {
      aplicarMascaraTelefone(formComplete.querySelector('input[name="comp_whatsapp"]'));
      aplicarMascaraCpfApenas(formComplete.querySelector('input[name="comp_cpf"]'));
      aplicarMascaraCnpjComAutoBusca(
        formComplete.querySelector('input[name="comp_cnpj"]'),
        (dados) => {
          if (!dados) return;
          const razaoInp = formComplete.querySelector('input[name="comp_razao_social"]');
          const fantInp = formComplete.querySelector('input[name="comp_nome_fantasia"]');
          const cepInp = formComplete.querySelector('input[name="comp_cep"]');
          const logInp = formComplete.querySelector('input[name="comp_logradouro"]');
          const numInp = formComplete.querySelector('input[name="comp_numero"]');
          const baiInp = formComplete.querySelector('input[name="comp_bairro"]');
          const compInp = formComplete.querySelector('input[name="comp_complemento"]');
          const cidInp = formComplete.querySelector('input[name="comp_cidade"]');
          const ufInp = formComplete.querySelector('input[name="comp_uf"]');
          const zapInp = formComplete.querySelector('input[name="comp_whatsapp"]');

          if (razaoInp && dados.razao_social) razaoInp.value = dados.razao_social;
          if (fantInp && (dados.nome_fantasia || dados.razao_social)) fantInp.value = dados.nome_fantasia || dados.razao_social;
          if (cepInp && dados.cep) cepInp.value = formatarCep(dados.cep);
          if (logInp && dados.logradouro) {
            logInp.value = dados.descricao_tipo_de_logradouro
              ? `${dados.descricao_tipo_de_logradouro} ${dados.logradouro}`.trim()
              : dados.logradouro;
          }
          if (numInp && dados.numero) numInp.value = dados.numero;
          if (baiInp && dados.bairro) baiInp.value = dados.bairro;
          if (compInp && dados.complemento) compInp.value = dados.complemento;
          if (cidInp && dados.municipio) cidInp.value = dados.municipio;
          if (ufInp && dados.uf) ufInp.value = dados.uf;
          if (zapInp && !zapInp.value && dados.ddd_telefone_1) {
            zapInp.value = dados.ddd_telefone_1;
            aplicarMascaraTelefone(zapInp);
          }
        },
        document.getElementById("btn-buscar-cnpj-comp"),
        document.getElementById("status-cnpj-comp"),
        document.getElementById("spinner-cnpj-comp")
      );
      aplicarMascaraCep(formComplete.querySelector('input[name="comp_cep"]'), (dadosCep) => {
        const logInp = formComplete.querySelector('input[name="comp_logradouro"]');
        const baiInp = formComplete.querySelector('input[name="comp_bairro"]');
        const cidInp = formComplete.querySelector('input[name="comp_cidade"]');
        const ufInp = formComplete.querySelector('input[name="comp_uf"]');
        if (logInp && dadosCep.logradouro) logInp.value = dadosCep.logradouro;
        if (baiInp && dadosCep.bairro) baiInp.value = dadosCep.bairro;
        if (cidInp && dadosCep.localidade) cidInp.value = dadosCep.localidade;
        if (ufInp && dadosCep.uf) ufInp.value = dadosCep.uf;
      });
    }

    // Login com Google (Oficial Supabase Auth com Fallback caso o provedor ou SDK não esteja ativo)
    btnGoogle?.addEventListener("click", async () => {
      const loginFn = window.SJ_SUPABASE?.auth?.loginGoogle || window.SJ_SUPABASE?.auth?.loginComGoogle;
      if (typeof loginFn === "function") {
        try {
          const res = await loginFn();
          if (res && res.url) {
            window.location.href = res.url;
            return;
          }
          if (res && !res.sucesso) {
            mostrarToast(
              "💡 Dica: Utilize a aba 'Criar Nova Conta' ou seu E-mail e Senha logo abaixo para acessar sua conta rapidamente!",
              "warning"
            );
            alternarAbaAuthCliente("signup");
            return;
          }
        } catch (err) {
          mostrarToast("Utilize seu E-mail e Senha abaixo para acessar sua conta de Cliente.", "warning");
        }
      } else {
        mostrarToast("Utilize seu E-mail e Senha abaixo para acessar sua conta de Cliente.", "warning");
      }
    });

    // Login com E-mail e Senha
    formLogin?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = String(formLogin.querySelector('input[name="login_email"]')?.value || "").trim().toLowerCase();
      const password = String(formLogin.querySelector('input[name="login_password"]')?.value || "").trim();

      if (!email || !password) {
        alert("Preencha seu e-mail e senha.");
        return;
      }

      const btnSubmit = document.getElementById("btn-submit-client-login");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "<span>⏳ Entrando...</span>";
      }

      try {
        let authOk = false;
        let userData = null;
        const salvoDb = buscarDadosClienteSalvoPorEmail(email) || {};

        const loginEmailFn = window.SJ_SUPABASE?.auth?.loginEmail || window.SJ_SUPABASE?.auth?.loginComEmail;
        if (typeof loginEmailFn === "function") {
          const res = await loginEmailFn({ email, password });
          if (res.sucesso && res.usuario) {
            authOk = true;
            userData = {
              ...salvoDb,
              id: res.usuario.id || salvoDb.id || ("cli-" + Date.now()),
              nome: salvoDb.nome || res.usuario.nome || email.split("@")[0],
              email: res.usuario.email || email,
              whatsapp: salvoDb.whatsapp || res.usuario.whatsapp || "",
              cpf: salvoDb.cpf || salvoDb.cnpjCpf || res.usuario.cpf || "",
              cnpjCpf: salvoDb.cnpjCpf || salvoDb.cpf || res.usuario.cpf || "",
              tipo: "cliente"
            };
          } else if (res.fallback) {
            authOk = true;
            userData = {
              ...salvoDb,
              id: salvoDb.id || ("cli-" + Date.now()),
              nome: salvoDb.nome || email.split("@")[0],
              email,
              whatsapp: salvoDb.whatsapp || salvoDb.cepTelefone || "",
              cpf: salvoDb.cpf || salvoDb.cnpjCpf || "",
              cnpjCpf: salvoDb.cnpjCpf || salvoDb.cpf || "",
              tipo: "cliente"
            };
          } else {
            alert(res.mensagem || "E-mail ou senha incorretos.");
          }
        } else {
          authOk = true;
          userData = {
            ...salvoDb,
            id: salvoDb.id || ("cli-" + Date.now()),
            nome: salvoDb.nome || email.split("@")[0],
            email,
            tipo: "cliente"
          };
        }

        if (authOk && userData) {
          const precisaNf = Boolean(state.precisaNotaFiscalPedido || userData.precisaNotaFiscal);
          const validacao = validarDadosCliente(userData, precisaNf);
          userData.cadastroAprovado = validacao.valido;
          salvarClienteLocal(userData);

          if (!validacao.valido) {
            alternarAbaAuthCliente("complete", {
              preMarcarNf: precisaNf,
              mensagemTopo: `⚠️ Complete seus dados obrigatórios (${validacao.faltando.join(", ")}) para aprovar seu cadastro!`
            });
            return;
          }

          fecharModalAuthCliente();
          mostrarToastNotificacao(`🎉 Bem-vindo(a) de volta, ${userData.nome}!`, "sucesso");
          if (!state.acaoPendenteAposLogin) {
            navegarParaCategoria("minha-conta");
          }
        }
      } catch (err) {
        alert("Erro ao entrar: " + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = "<span>Entrar na Minha Conta</span>";
        }
      }
    });

    // Cadastro de Nova Conta (Com validação completa e Nota Fiscal opcional/obrigatória)
    formSignup?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = String(formSignup.querySelector('input[name="signup_nome"]')?.value || "").trim();
      const whatsapp = String(formSignup.querySelector('input[name="signup_whatsapp"]')?.value || "").trim();
      const cpf = String(formSignup.querySelector('input[name="signup_cpf"]')?.value || "").trim();
      const email = String(formSignup.querySelector('input[name="signup_email"]')?.value || "").trim().toLowerCase();
      const password = String(formSignup.querySelector('input[name="signup_password"]')?.value || "").trim();
      const precisaNotaFiscal = Boolean(formSignup.querySelector('input[name="signup_precisa_nf"]')?.checked);
      const cnpj = String(formSignup.querySelector('input[name="signup_cnpj"]')?.value || "").trim();
      const razaoSocial = String(formSignup.querySelector('input[name="signup_razao_social"]')?.value || "").trim();
      const nomeFantasia = String(formSignup.querySelector('input[name="signup_nome_fantasia"]')?.value || "").trim();

      const cep = String(formSignup.querySelector('input[name="signup_cep"]')?.value || "").trim();
      const inscricaoEstadual = String(formSignup.querySelector('input[name="signup_ie"]')?.value || "").trim();
      const logradouro = String(formSignup.querySelector('input[name="signup_logradouro"]')?.value || "").trim();
      const numero = String(formSignup.querySelector('input[name="signup_numero"]')?.value || "").trim();
      const bairro = String(formSignup.querySelector('input[name="signup_bairro"]')?.value || "").trim();
      const complemento = String(formSignup.querySelector('input[name="signup_complemento"]')?.value || "").trim();
      const cidade = String(formSignup.querySelector('input[name="signup_cidade"]')?.value || "Umuarama").trim();
      const uf = String(formSignup.querySelector('input[name="signup_uf"]')?.value || "PR").trim().toUpperCase();

      if (!password || password.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      // Validação estrita do CPF do Titular (11 dígitos)
      const checkCpfSignup = validarCpfOficial(cpf);
      if (!checkCpfSignup) {
        const inpCpf = formSignup.querySelector('input[name="signup_cpf"]');
        atualizarFeedbackVisualCpf(inpCpf, true);
        inpCpf?.focus();
        const msg = "CPF do Titular inválido. Digite um CPF válido com 11 dígitos.";
        mostrarToast(msg, "error");
        alert(msg);
        return;
      }

      // Se informou CNPJ, valida o CNPJ da empresa
      if (precisaNotaFiscal && cnpj) {
        const checkCnpjSignup = validarCnpjOficial(cnpj);
        if (!checkCnpjSignup) {
          const inpCnpj = formSignup.querySelector('input[name="signup_cnpj"]');
          inpCnpj?.focus();
          const msg = "CNPJ informado inválido. Verifique os 14 dígitos da empresa.";
          mostrarToast(msg, "error");
          alert(msg);
          return;
        }
      }

      const candidatoCliente = {
        nome,
        whatsapp,
        cpf,
        cnpjCpf: cpf,
        cnpj,
        razaoSocial,
        nomeFantasia,
        email,
        precisaNotaFiscal,
        cep,
        inscricaoEstadual,
        logradouro,
        numero,
        bairro,
        complemento,
        cidade,
        uf,
        cidadeUf: `${cidade} / ${uf}`
      };

      const validacao = validarDadosCliente(candidatoCliente, precisaNotaFiscal);
      if (!validacao.valido) {
        mostrarToast(validacao.mensagem, "error");
        alert(validacao.mensagem);
        return;
      }

      // Validação obrigatória de aceite da Política de Privacidade (Art. 7º, II e V da LGPD)
      const chkAceite = formSignup.querySelector('input[name="signup_aceite_termos"]');
      if (chkAceite && !chkAceite.checked) {
        mostrarToast("Você precisa ler e aceitar a Política de Privacidade e os Termos para criar sua conta.", "error");
        chkAceite.focus();
        return;
      }
      const aceitouMarketing = Boolean(formSignup.querySelector('input[name="signup_consent_marketing"]')?.checked);

      const btnSubmit = document.getElementById("btn-submit-client-signup");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = "<span>⏳ Criando conta e aprovando cadastro...</span>";
      }

      try {
        let userId = "cli-" + Date.now();

        if (window.SJ_SUPABASE?.auth?.registrar) {
          const resAuth = await window.SJ_SUPABASE.auth.registrar({
            nome,
            email,
            password,
            cargo: "Cliente"
          });
          if (resAuth?.usuario?.id) {
            userId = resAuth.usuario.id;
          }
        }

        const novoCliente = {
          ...candidatoCliente,
          id: userId,
          cadastroAprovado: true,
          tipo: "cliente"
        };

        if (window.SJ_SUPABASE?.clientes?.cadastrar) {
          await window.SJ_SUPABASE.clientes.cadastrar({
            id: userId,
            nome,
            cnpjCpf: cpf,
            whatsapp,
            email,
            endereco: formatarEnderecoCompletoCliente(novoCliente),
            bairroCidadeUf: `${bairro ? bairro + " - " : ""}${cidade}/${uf}`
          });
        }

        // Registro da prova de consentimento e aceite na base de dados LGPD (Art. 7º e 8º)
        if (window.SJ_SUPABASE?.consentimentos?.registrar) {
          try {
            await window.SJ_SUPABASE.consentimentos.registrar({
              titularIdentificador: email,
              titularTipo: "cliente",
              finalidade: "termos_privacidade",
              versaoTermo: "v1.0",
              consentimentoConcedido: true,
              canal: "web"
            });
            if (aceitouMarketing) {
              await window.SJ_SUPABASE.consentimentos.registrar({
                titularIdentificador: email,
                titularTipo: "cliente",
                finalidade: "comunicacoes_marketing",
                versaoTermo: "v1.0",
                consentimentoConcedido: true,
                canal: "web"
              });
            }
          } catch (_) {}
        }

        const tinhaAcaoPendente = Boolean(state.acaoPendenteAposLogin);
        salvarClienteLocal(novoCliente);
        fecharModalAuthCliente();
        mostrarToastNotificacao(
          `✅ Conta criada e cadastro aprovado com sucesso, ${nome}!`,
          "sucesso"
        );
        if (!tinhaAcaoPendente) {
          navegarParaCategoria("minha-conta");
        }
      } catch (err) {
        alert("Erro ao criar conta: " + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = "<span>🚀 Criar Minha Conta & Aprovar Cadastro</span>";
        }
      }
    });

    // Complemento Obrigatório de Cadastro (Pós-Login Google ou Antes de Enviar Pedido com Nota Fiscal no WhatsApp)
    formComplete?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = String(formComplete.querySelector('input[name="comp_nome"]')?.value || "").trim();
      const whatsapp = String(formComplete.querySelector('input[name="comp_whatsapp"]')?.value || "").trim();
      const cpf = String(formComplete.querySelector('input[name="comp_cpf"]')?.value || "").trim();
      const email = String(formComplete.querySelector('input[name="comp_email"]')?.value || "").trim().toLowerCase();
      const precisaNotaFiscal = Boolean(formComplete.querySelector('input[name="comp_precisa_nf"]')?.checked);
      const cnpj = String(formComplete.querySelector('input[name="comp_cnpj"]')?.value || "").trim();
      const razaoSocial = String(formComplete.querySelector('input[name="comp_razao_social"]')?.value || "").trim();
      const nomeFantasia = String(formComplete.querySelector('input[name="comp_nome_fantasia"]')?.value || "").trim();

      const cep = String(formComplete.querySelector('input[name="comp_cep"]')?.value || "").trim();
      const inscricaoEstadual = String(formComplete.querySelector('input[name="comp_ie"]')?.value || "").trim();
      const logradouro = String(formComplete.querySelector('input[name="comp_logradouro"]')?.value || "").trim();
      const numero = String(formComplete.querySelector('input[name="comp_numero"]')?.value || "").trim();
      const bairro = String(formComplete.querySelector('input[name="comp_bairro"]')?.value || "").trim();
      const complemento = String(formComplete.querySelector('input[name="comp_complemento"]')?.value || "").trim();
      const cidade = String(formComplete.querySelector('input[name="comp_cidade"]')?.value || "Umuarama").trim();
      const uf = String(formComplete.querySelector('input[name="comp_uf"]')?.value || "PR").trim().toUpperCase();

      // Validação estrita do CPF do Titular (11 dígitos)
      const checkCpfComp = validarCpfOficial(cpf);
      if (!checkCpfComp) {
        const inpCpf = formComplete.querySelector('input[name="comp_cpf"]');
        atualizarFeedbackVisualCpf(inpCpf, true);
        inpCpf?.focus();
        const msg = "CPF do Titular inválido. Digite um CPF válido com 11 dígitos.";
        mostrarToast(msg, "error");
        alert(msg);
        return;
      }

      // Se informou CNPJ, valida o CNPJ da empresa
      if (precisaNotaFiscal && cnpj) {
        const checkCnpjComp = validarCnpjOficial(cnpj);
        if (!checkCnpjComp) {
          const inpCnpj = formComplete.querySelector('input[name="comp_cnpj"]');
          inpCnpj?.focus();
          const msg = "CNPJ informado inválido. Verifique os 14 dígitos da empresa.";
          mostrarToast(msg, "error");
          alert(msg);
          return;
        }
      }

      const clienteAtualizado = {
        ...(state.clienteLogado || {}),
        id: state.clienteLogado?.id || ("cli-" + Date.now()),
        nome,
        whatsapp,
        cpf,
        cnpjCpf: cpf,
        cnpj,
        razaoSocial,
        nomeFantasia,
        email,
        precisaNotaFiscal,
        cep,
        inscricaoEstadual,
        logradouro,
        numero,
        bairro,
        complemento,
        cidade,
        uf,
        cidadeUf: `${cidade} / ${uf}`,
        tipo: "cliente"
      };

      const validacao = validarDadosCliente(clienteAtualizado, precisaNotaFiscal);
      if (!validacao.valido) {
        mostrarToast(validacao.mensagem, "error");
        alert(validacao.mensagem);
        return;
      }

      // Validação obrigatória de confirmação da Política de Privacidade
      const chkAceiteComp = formComplete.querySelector('input[name="comp_aceite_termos"]');
      if (chkAceiteComp && !chkAceiteComp.checked) {
        mostrarToast("Você precisa confirmar o aceite da Política de Privacidade para continuar.", "error");
        chkAceiteComp.focus();
        return;
      }
      const aceitouMarketingComp = Boolean(formComplete.querySelector('input[name="comp_consent_marketing"]')?.checked);

      clienteAtualizado.cadastroAprovado = true;
      state.precisaNotaFiscalPedido = precisaNotaFiscal;

      if (window.SJ_SUPABASE?.clientes?.cadastrar) {
        try {
          await window.SJ_SUPABASE.clientes.cadastrar({
            id: clienteAtualizado.id,
            nome,
            cnpjCpf: cpf,
            whatsapp,
            email,
            endereco: formatarEnderecoCompletoCliente(clienteAtualizado),
            bairroCidadeUf: `${bairro ? bairro + " - " : ""}${cidade}/${uf}`
          });
        } catch (_) {}
      }

      // Registro da prova de consentimento e aceite na base LGPD
      if (window.SJ_SUPABASE?.consentimentos?.registrar) {
        try {
          await window.SJ_SUPABASE.consentimentos.registrar({
            titularIdentificador: email,
            titularTipo: "cliente",
            finalidade: "termos_privacidade",
            versaoTermo: "v1.0",
            consentimentoConcedido: true,
            canal: "web"
          });
          if (aceitouMarketingComp) {
            await window.SJ_SUPABASE.consentimentos.registrar({
              titularIdentificador: email,
              titularTipo: "cliente",
              finalidade: "comunicacoes_marketing",
              versaoTermo: "v1.0",
              consentimentoConcedido: true,
              canal: "web"
            });
          }
        } catch (_) {}
      }

      const tinhaAcaoPendente = Boolean(state.acaoPendenteAposLogin);
      salvarClienteLocal(clienteAtualizado);
      fecharModalAuthCliente();
      mostrarToastNotificacao(
        "✅ Cadastro completo e aprovado com sucesso!",
        "sucesso"
      );

      if (!tinhaAcaoPendente && state.categoriaMenu === "minha-conta") {
        renderizarAreaCliente("dados");
      }
    });
  }

  // =========================================================================
  // ÁREA DO CLIENTE / MINHA CONTA (PÁGINA DEDICADA: FAVORITOS, COMPRAS, CUPONS)
  // =========================================================================

  function renderizarAreaCliente(abaAtiva = state.abaClienteAtiva || "favoritos") {
    const container = document.getElementById("client-account-view");
    if (!container) return;

    state.abaClienteAtiva = abaAtiva;

    // Se não estiver logado, exibe painel de acesso + lista de favoritos já marcados no navegador
    if (!state.clienteLogado) {
      const favsVisitante = (window.SITE_DATA.catalogo || []).filter((p) =>
        (state.favoritos || []).includes(p.id)
      );
      container.innerHTML = `
        <div class="client-empty-box" style="margin: 24px auto 32px; max-width: 680px;">
          <div class="client-empty-icon">👤</div>
          <h4>Área do Cliente • Clube Loja SJ 3D</h4>
          <p>Faça login ou crie sua conta gratuitamente para salvar seus pedidos, sincronizar seus favoritos e acompanhar seus cupons no Sorteio da Bambu Lab A1 Mini.</p>
          <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
            <button type="button" class="btn-client-explore" id="btn-login-prompt-area">
              🔑 Entrar na Minha Conta
            </button>
            <button type="button" class="btn-client-explore" id="btn-signup-prompt-area" style="background:var(--sj-orange);">
              ✨ Criar Nova Conta
            </button>
            <button type="button" class="btn-client-explore" id="btn-back-home-prompt" style="background:#f4f4f5; color:#18181b; border:1px solid #e4e4e7;">
              ← Voltar para a Loja
            </button>
          </div>
        </div>
        ${
          favsVisitante.length > 0
            ? `
          <div style="margin-bottom: 48px;">
            <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:14px; color:#18181b;">❤️ Seus Produtos Favoritos (${favsVisitante.length})</h3>
            <div class="client-favorites-grid">
              ${favsVisitante
                .map(
                  (item) => `
                <div class="client-fav-item-card" data-fav-card="${item.id}">
                  <button type="button" class="btn-remove-fav" data-del-fav="${item.id}" title="Remover dos favoritos">✕</button>
                  <div class="client-fav-img-wrap" data-open-modal="${item.id}" style="cursor:pointer;">
                    <img src="${item.imagem}" alt="${item.nome}" loading="lazy" />
                  </div>
                  <div class="client-fav-info">
                    <span class="client-fav-brand">${item.marca}</span>
                    <h4 class="client-fav-title" data-open-modal="${item.id}" style="cursor:pointer;">${item.nome}</h4>
                    <div class="client-fav-prices">
                      <strong>${item.precoVista}</strong>
                      ${item.precoParcelado ? `<small>${item.precoParcelado}</small>` : ""}
                    </div>
                    <button type="button" class="btn-fav-add-cart" data-add-item="${item.id}">
                      🛍️ Adicionar ao Pedido
                    </button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
      `;

      container.querySelector("#btn-login-prompt-area")?.addEventListener("click", () => abrirModalAuthCliente("login"));
      container.querySelector("#btn-signup-prompt-area")?.addEventListener("click", () => abrirModalAuthCliente("signup"));
      container.querySelector("#btn-back-home-prompt")?.addEventListener("click", () => navegarParaCategoria("home"));
      container.querySelectorAll("[data-del-fav]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleFavorito(btn.dataset.delFav);
          renderizarAreaCliente("favoritos");
        });
      });
      return;
    }

    const c = state.clienteLogado;
    const nomeSeguro = escaparHtml(c.nome || "Cliente");
    const primeiroNomeSeguro = escaparHtml((c.nome || "Cliente").split(" ")[0]);
    const avatarLetra = (primeiroNomeSeguro[0] || "C").toUpperCase();
    const emailSeguro = escaparHtml(c.email || "");
    const whatsappSeguro = escaparHtml(c.whatsapp || "");
    const cidadeUfSeguro = escaparHtml(c.cidadeUf || "Umuarama / PR");

    const docLimpo = String(c.cpf || c.cnpjCpf || "").replace(/\D/g, "");
    let cpfInicial = "";
    let cnpjInicial = String(c.cnpj || "").replace(/\D/g, "");
    if (docLimpo.length === 11) {
      cpfInicial = docLimpo;
    } else if (docLimpo.length === 14 && !cnpjInicial) {
      cnpjInicial = docLimpo;
    }
    const cpfSeguro = cpfInicial ? escaparHtml(formatarCpf(cpfInicial)) : "";
    const cnpjSeguro = cnpjInicial ? escaparHtml(formatarCnpj(cnpjInicial)) : "";
    const razaoSocialSegura = escaparHtml(c.razaoSocial || (cnpjInicial ? c.nome || "" : ""));
    const nomeFantasiaSeguro = escaparHtml(c.nomeFantasia || "");
    const precisaNfSegura = Boolean(c.precisaNotaFiscal || cnpjInicial || state.precisaNotaFiscalPedido);

    const fotoSegura = (c.foto && /^(https?:\/\/|data:image\/)/i.test(String(c.foto).trim())) ? escaparHtml(String(c.foto).trim()) : null;
    const totalFavoritos = (state.favoritos || []).length;

    // Busca pedidos/orçamentos do cliente (localStorage + SJ_DB.orcamentos)
    let pedidosCliente = [];
    if (c.id) {
      pedidosCliente = obterPedidosClienteSalvos(c.id);
    }
    if (window.SJ_DB?.orcamentos?.listar) {
      const todos = window.SJ_DB.orcamentos.listar();
      const emailCli = (c.email || "").toLowerCase();
      const nomeCli = (c.nome || "").toLowerCase();
      todos.forEach((o) => {
        const cNome = (o.clienteNome || "").toLowerCase();
        const mEmail = (o.metadados?.clienteEmail || o.clienteEmail || "").toLowerCase();
        if ((emailCli && mEmail === emailCli) || (nomeCli && cNome && cNome.includes(nomeCli))) {
          if (!pedidosCliente.some((p) => p.id === o.id)) {
            pedidosCliente.push({
              id: o.id,
              clienteId: c.id,
              clienteNome: o.clienteNome || c.nome,
              clienteEmail: o.clienteEmail || c.email,
              clienteWhatsapp: o.clienteTelefone || c.whatsapp,
              dataHoraSalvo: o.dataHoraSalvo || o.data || new Date().toISOString(),
              status: o.status || "guardado",
              statusLabel: o.status === "enviado_whatsapp" ? "Enviado no WhatsApp" : "Orçamento Guardado",
              total: Number(o.total) || 0,
              itensQtd: o.totalItens || (Array.isArray(o.itens) ? o.itens.length : 1),
              itens: (o.itens || []).map((it) => ({
                id: it.id || "item",
                nome: it.nome,
                detalhe1: it.detalhe || "",
                detalhe2: "",
                qtd: it.quantidade || 1,
                precoUnitario: it.precoUnitario || 0,
                corHex: it.corHex || "#F04E23"
              }))
            });
          }
        }
      });
    }
    pedidosCliente.sort((a, b) => new Date(b.dataHoraSalvo || 0) - new Date(a.dataHoraSalvo || 0));

    // Calcula cupons estimados (1 cupom a cada R$ 60 + 3 cupons do cadastro/CPF)
    let totalGasto = pedidosCliente.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    let cuponsCompras = Math.floor(totalGasto / 60);
    let cuponsCadastro = c.cpf ? 3 : 1;
    let totalCupons = cuponsCompras + cuponsCadastro;

    // Itens Favoritados
    const produtosFavoritos = (window.SITE_DATA.catalogo || []).filter((p) =>
      state.favoritos.includes(p.id)
    );

    container.innerHTML = `
      <!-- 1. HERO DO PERFIL -->
      <div class="client-profile-hero">
        <div class="client-profile-main-col">
          <div class="client-avatar-circle">
            ${fotoSegura ? `<img src="${fotoSegura}" alt="${nomeSeguro}" />` : `<span>${avatarLetra}</span>`}
          </div>
          <div class="client-profile-text">
            <h2>Olá, ${primeiroNomeSeguro}!</h2>
            <div class="client-profile-meta">
              <span>📧 ${emailSeguro}</span>
              ${whatsappSeguro ? `<span>📱 ${whatsappSeguro}</span>` : ""}
              <span>📍 ${cidadeUfSeguro}</span>
              <span style="color:#ff8a65; font-weight:700;">🎟️ ${totalCupons} cupons no Sorteio</span>
            </div>
          </div>
        </div>

        <div class="client-profile-hero-actions">
          <button type="button" class="btn-client-logout" id="btn-cliente-sair">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>

      <!-- 2. ABAS DE NAVEGAÇÃO -->
      <div class="client-tabs-nav">
        <button type="button" class="client-tab-nav-btn ${abaAtiva === "favoritos" ? "active" : ""}" data-target-tab="favoritos">
          <span>❤️ Meus Favoritos</span>
          <span class="tab-badge">${totalFavoritos}</span>
        </button>
        <button type="button" class="client-tab-nav-btn ${abaAtiva === "pedidos" ? "active" : ""}" data-target-tab="pedidos">
          <span>📦 Meus Pedidos & Orçamentos</span>
          <span class="tab-badge">${pedidosCliente.length}</span>
        </button>
        <button type="button" class="client-tab-nav-btn ${abaAtiva === "cupons" ? "active" : ""}" data-target-tab="cupons">
          <span>🎟️ Meus Cupons no Sorteio</span>
          <span class="tab-badge">${totalCupons}</span>
        </button>
        <button type="button" class="client-tab-nav-btn ${abaAtiva === "dados" ? "active" : ""}" data-target-tab="dados">
          <span>👤 Meus Dados</span>
        </button>
      </div>

      <!-- 3. CONTEÚDO DAS ABAS -->

      <!-- ABA A: FAVORITOS -->
      <div class="client-tab-pane ${abaAtiva === "favoritos" ? "active" : ""}" id="pane-client-favoritos">
        ${
          produtosFavoritos.length > 0
            ? `
          <div class="client-favorites-grid">
            ${produtosFavoritos
              .map(
                (item) => `
              <div class="client-fav-item-card" data-fav-card="${item.id}">
                <button type="button" class="btn-remove-fav" data-del-fav="${item.id}" title="Remover dos favoritos">✕</button>
                <div class="client-fav-img-wrap" data-open-modal="${item.id}" style="cursor:pointer;">
                  <img src="${item.imagem}" alt="${item.nome}" loading="lazy" />
                </div>
                <div class="client-fav-info">
                  <span class="client-fav-brand">${item.marca}</span>
                  <h4 class="client-fav-title" data-open-modal="${item.id}" style="cursor:pointer;">${item.nome}</h4>
                  <div class="client-fav-prices">
                    <strong>${item.precoVista}</strong>
                    ${item.precoParcelado ? `<small>${item.precoParcelado}</small>` : ""}
                  </div>
                  <button type="button" class="btn-fav-add-cart" data-add-item="${item.id}">
                    🛍️ Adicionar ao Pedido
                  </button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : `
          <div class="client-empty-box">
            <div class="client-empty-icon">❤️</div>
            <h4>Sua lista de favoritos está vazia</h4>
            <p>Navegue pelo nosso catálogo de impressoras e +80 cores de filamentos e clique no coraçãozinho ❤️ dos produtos que você mais gostou para guardá-los aqui!</p>
            <button type="button" class="btn-client-explore" id="btn-fav-explorar-catalogo">
              Explorar Catálogo Completo →
            </button>
          </div>
        `
        }
      </div>

      <!-- ABA B: PEDIDOS E HISTÓRICO DE COMPRAS -->
      <div class="client-tab-pane ${abaAtiva === "pedidos" ? "active" : ""}" id="pane-client-pedidos">
        ${
          pedidosCliente.length > 0
            ? `
          <div class="client-orders-list">
            ${pedidosCliente
              .map((ped) => {
                const totalFmt = (Number(ped.total) || 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                });
                const dataObj = ped.dataHoraSalvo ? new Date(ped.dataHoraSalvo) : new Date();
                const dataFmt = !isNaN(dataObj.getTime())
                  ? dataObj.toLocaleDateString("pt-BR")
                  : "Recente";
                const horaFmt = !isNaN(dataObj.getTime())
                  ? dataObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "";

                const itensLista = Array.isArray(ped.itens) ? ped.itens : [];
                const itensTabelaHtml = itensLista
                  .map((it) => {
                    const subtotal = (Number(it.precoUnitario) || 0) * (Number(it.qtd) || 1);
                    const subtotalFmt = subtotal > 0
                      ? subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "(Sob consulta)";
                    const dotHtml = it.corHex
                      ? `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${it.corHex}; margin-right:6px; vertical-align:middle;"></span>`
                      : "";
                    const det = [it.detalhe1, it.detalhe2].filter(Boolean).join(" | ");
                    return `
                      <tr>
                        <td>
                          ${dotHtml}<strong>${it.qtd}x</strong> ${it.nome}
                          ${det ? `<small style="color:var(--text-muted); display:block; margin-left:16px;">${det}</small>` : ""}
                        </td>
                        <td>${subtotalFmt}</td>
                      </tr>
                    `;
                  })
                  .join("");

                // Mensagem personalizada para enviar no WhatsApp (com dados completos e solicitação de NF-e)
                const linhasMsg = itensLista.map((it) => {
                  const sub = (Number(it.precoUnitario) || 0) * (Number(it.qtd) || 1);
                  const precoStr = sub > 0 ? ` — *${formatarMoedaBR(sub)}*` : "";
                  const det = [it.detalhe1, it.detalhe2].filter(Boolean).join(" | ");
                  return `• ${it.qtd}x *${it.nome}*${det ? ` (${det})` : ""}${precoStr}`;
                });
                const totalMsg = Number(ped.total) > 0 ? `\n*Total Estimado:* ${totalFmt}` : "";
                const solicitaNfPed = Boolean(ped.precisaNotaFiscal || c.precisaNotaFiscal);
                const endCompletoPed = formatarEnderecoCompletoCliente(c) || ped.clienteEnderecoFiscal || "";
                const blocoCliPed = [
                  `\n\n📋 *DADOS DO CLIENTE:*`,
                  `• *Nome do Titular:* ${c.nome || ped.clienteNome}`,
                  c.cpf ? `• *CPF:* ${formatarCpf(c.cpf)}` : (ped.clienteCpfCnpj ? `• *Documento:* ${ped.clienteCpfCnpj}` : ""),
                  c.cnpj ? `• *CNPJ da Empresa:* ${formatarCnpj(c.cnpj)}` : "",
                  c.razaoSocial ? `• *Razão Social:* ${c.razaoSocial}` : "",
                  c.nomeFantasia ? `• *Nome Fantasia:* ${c.nomeFantasia}` : "",
                  c.inscricaoEstadual ? `• *Inscrição Estadual:* ${c.inscricaoEstadual}` : "",
                  c.whatsapp ? `• *WhatsApp:* ${c.whatsapp}` : "",
                  c.email ? `• *E-mail:* ${c.email}` : "",
                  endCompletoPed ? `• *Endereço Completo:* ${endCompletoPed}` : ""
                ].filter(Boolean).join("\n");
                const fraseNfPed = solicitaNfPed
                  ? `\n\n🧾 *SOLICITAÇÃO DE NOTA FISCAL:* Preciso da emissão de Nota Fiscal (NF-e) para este pedido com os dados fiscais completos informados acima.`
                  : "";
                const msgWhats = encodeURIComponent(
                  `Olá *Loja SJ 3D*! Gostaria de finalizar meu pedido *${ped.id}* salvo no site:\n\n` +
                    `🛒 *ITENS ESCOLHIDOS:*\n` +
                    `${linhasMsg.join("\n")}${totalMsg}` +
                    `${blocoCliPed}${fraseNfPed}\n\n` +
                    `Gostaria de confirmar a disponibilidade e finalizar a compra!`
                );

                const statusClass = ped.status || "guardado";
                const statusTexto =
                  ped.status === "enviado_whatsapp"
                    ? "💬 Enviado no WhatsApp"
                    : ped.status === "guardado"
                      ? "💾 Orçamento Guardado"
                      : (ped.statusLabel || String(ped.status).toUpperCase());

                return `
                <div class="client-order-card" data-order-card="${ped.id}">
                  <div class="client-order-header">
                    <div class="client-order-id-group">
                      <strong>${ped.id}</strong>
                      <span class="client-order-status-badge ${statusClass}">
                        ${statusTexto}
                      </span>
                    </div>
                    <span class="client-order-date">📅 ${dataFmt}${horaFmt ? ` às ${horaFmt}` : ""}</span>
                  </div>

                  <div class="client-order-body">
                    <table class="client-order-items-table">
                      <tbody>
                        ${itensTabelaHtml || `<tr><td colspan="2">${ped.itensQtd || 1} itens</td></tr>`}
                      </tbody>
                    </table>
                  </div>

                  <div class="client-order-footer">
                    <div class="client-order-total">${totalFmt}</div>
                    <div class="client-order-actions">
                      <button type="button" class="btn-order-reload" data-reload-order="${ped.id}" title="Carregar estes itens de volta no carrinho">
                        🛒 Carregar no Carrinho
                      </button>
                      <a href="https://wa.me/5544991351318?text=${msgWhats}" target="_blank" rel="noopener" class="btn-order-whatsapp" title="Enviar ou negociar pelo WhatsApp da Loja SJ">
                        💬 Negociar no WhatsApp
                      </a>
                      <button type="button" class="btn-order-delete" data-del-order="${ped.id}" title="Excluir este pedido guardado">
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <div class="client-empty-box">
            <div class="client-empty-icon">📦</div>
            <h4>Nenhum pedido ou orçamento guardado ainda</h4>
            <p>Monte seu pedido no catálogo de impressoras, filamentos ou peças e use a opção <strong>"Guardar Pedido"</strong> para mantê-lo salvo no seu perfil e ter controle total do que precisa!</p>
            <button type="button" class="btn-client-explore" id="btn-pedidos-explorar">
              Montar Meu Pedido Agora →
            </button>
          </div>
        `
        }
      </div>

      <!-- ABA C: CUPONS DO SORTEIO DA A1 MINI -->
      <div class="client-tab-pane ${abaAtiva === "cupons" ? "active" : ""}" id="pane-client-cupons">
        <div class="client-raffle-card">
          <div class="client-raffle-badge">🎟️ GRANDE PRÊMIO DE NATAL • SORTEIO 20 DE DEZEMBRO</div>
          <h3>Concorra a 1 Impressora Bambu Lab A1 Mini + 4kg de Filamento!</h3>
          <p>
            Seus cupons ficam armazenados e vinculados ao seu cadastro. O sorteio oficial será realizado em live ao vivo no Instagram <strong>@lojasj3d</strong>.
          </p>

          <div class="client-tickets-box">
            <div class="client-ticket-count-col">
              <strong>${totalCupons}</strong>
              <span>Seus cupons ativos para a urna do sorteio</span>
            </div>
            <a href="https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Sou%20o(a)%20${encodeURIComponent(c.nome)}%20e%20gostaria%20de%20garantir%20mais%20cupons%20para%20o%20Sorteio%20A1%20Mini!" target="_blank" rel="noopener" class="btn-success-whatsapp" style="width:auto;">
              🎟️ Garantir Mais Cupons no WhatsApp →
            </a>
          </div>

          <div class="client-tickets-rules-grid">
            <div class="client-ticket-rule">
              <strong>1️⃣ Compras na Loja SJ 3D</strong>
              <p>A cada R$ 60 em filamentos, peças ou serviços você acumula 1 cupom na hora.</p>
            </div>
            <div class="client-ticket-rule">
              <strong>2️⃣ Impressora 3D</strong>
              <p>Compre qualquer Impressora 3D (Bambu Lab ou Snapmaker) e garanta 10 cupons imediatos.</p>
            </div>
            <div class="client-ticket-rule">
              <strong>3️⃣ Visita ao Balcão Físico</strong>
              <p>Visite nossa loja na Av. Portugal, 6759 - Umuarama, siga @lojasj3d e ganhe +3 cupons gratuitos por CPF!</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ABA D: MEUS DADOS CADASTRAIS -->
      <div class="client-tab-pane ${abaAtiva === "dados" ? "active" : ""}" id="pane-client-dados">
        <div class="client-reg-card-wrap" style="max-width: 720px; margin: 0 auto; box-shadow: 0 4px 18px rgba(0,0,0,0.06);">
          <div class="client-reg-card-head">
            <h3>Meus Dados Cadastrais</h3>
            <p>Mantenha seus dados atualizados para envio rápido dos seus pedidos no WhatsApp.</p>
          </div>

          ${(() => {
            const valAtual = validarDadosCliente(c, Boolean(c.precisaNotaFiscal));
            return valAtual.valido
              ? `<div style="margin:0 0 14px; padding:10px 14px; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:10px; color:#065F46; font-size:0.82rem; font-weight:700;">
                   ✅ Cadastro Aprovado! Seus dados completos já vão prontos quando você finalizar no WhatsApp.
                 </div>`
              : `<div style="margin:0 0 14px; padding:10px 14px; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; color:#991B1B; font-size:0.82rem; font-weight:700;">
                   ⚠️ Cadastro Pendente: preencha ${escaparHtml(valAtual.faltando.join(", "))} abaixo para aprovar seu cadastro.
                 </div>`;
          })()}

          <form id="form-client-edit-profile" class="client-auth-form">
            <div class="auth-field">
              <label>Nome Completo do Titular *</label>
              <input type="text" name="edit_nome" value="${nomeSeguro}" placeholder="Nome Completo do Titular" required />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="auth-field">
                <label>WhatsApp / Celular *</label>
                <input type="tel" name="edit_whatsapp" value="${whatsappSeguro}" placeholder="(44) 99999-9999" required />
              </div>

              <div class="auth-field">
                <label>CPF do Titular *</label>
                <input type="text" name="edit_cpf" value="${cpfSeguro}" placeholder="000.000.000-00" required inputmode="numeric" />
              </div>
            </div>

            <div class="auth-field">
              <label>E-mail *</label>
              <input type="email" name="edit_email" value="${emailSeguro}" disabled style="background:#f3f4f6; cursor:not-allowed;" />
            </div>

            <div style="padding:4px 2px; margin:2px 0;">
              <label style="display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-size:0.8rem; font-weight:600; color:#71717a; margin:0;">
                <input type="checkbox" name="edit_precisa_nf" id="chk-edit-precisa-nf" ${precisaNfSegura ? "checked" : ""} style="width:15px; height:15px; accent-color:#F04E23; cursor:pointer;" />
                <span>Preciso de Nota Fiscal / Adicionar Dados da Empresa (CNPJ) ou Endereço</span>
              </label>
            </div>

            <div id="edit-nf-fields-wrap" style="display:${precisaNfSegura ? "grid" : "none"}; gap:12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
              <div style="font-size:0.78rem; font-weight:700; color:#1E293B; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
                🏢 Dados da Empresa (CNPJ) &amp; Endereço para Faturamento
              </div>

              <!-- Busca Automática por CNPJ -->
              <div class="auth-field">
                <label style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:700; color:#0F172A;">CNPJ da Empresa (Preenchimento Automático)</span>
                  <span style="font-size:0.72rem; color:#64748B; font-weight:500;">Receita Federal</span>
                </label>
                <div style="display:flex; gap:8px;">
                  <input type="text" name="edit_cnpj" id="edit-cnpj-input" value="${cnpjSeguro}" placeholder="00.000.000/0000-00" inputmode="numeric" style="flex:1;" />
                  <button type="button" id="btn-buscar-cnpj-edit" style="background:#0F172A; color:#FFFFFF; border:none; border-radius:8px; padding:0 14px; font-size:0.78rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
                    <span id="spinner-cnpj-edit" style="display:none;">⏳</span>
                    <span>🔍 Buscar CNPJ</span>
                  </button>
                </div>
                <div id="status-cnpj-edit" style="display:none; margin-top:6px; font-size:0.76rem; padding:6px 10px; border-radius:6px; font-weight:600;"></div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="auth-field">
                  <label>Razão Social (Nome Oficial) *</label>
                  <input type="text" name="edit_razao_social" value="${razaoSocialSegura}" placeholder="Razão Social da Empresa" />
                </div>
                <div class="auth-field">
                  <label>Nome Fantasia (Nome Comercial)</label>
                  <input type="text" name="edit_nome_fantasia" value="${nomeFantasiaSeguro}" placeholder="Nome Fantasia" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="auth-field">
                  <label>CEP *</label>
                  <input type="text" name="edit_cep" value="${escaparHtml(c.cep || "")}" placeholder="87501-000" inputmode="numeric" />
                </div>
                <div class="auth-field">
                  <label>Inscrição Estadual (se CNPJ)</label>
                  <input type="text" name="edit_ie" value="${escaparHtml(c.inscricaoEstadual || "")}" placeholder="Nº da IE ou ISENTO" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
                <div class="auth-field">
                  <label>Endereço (Rua / Avenida) *</label>
                  <input type="text" name="edit_logradouro" value="${escaparHtml(c.logradouro || "")}" placeholder="Ex: Av. Portugal" />
                </div>
                <div class="auth-field">
                  <label>Número *</label>
                  <input type="text" name="edit_numero" value="${escaparHtml(c.numero || "")}" placeholder="Ex: 6759" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="auth-field">
                  <label>Bairro *</label>
                  <input type="text" name="edit_bairro" value="${escaparHtml(c.bairro || "")}" placeholder="Ex: Zona I-A" />
                </div>
                <div class="auth-field">
                  <label>Complemento (Opcional)</label>
                  <input type="text" name="edit_complemento" value="${escaparHtml(c.complemento || "")}" placeholder="Sala, Apto, Bloco..." />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
                <div class="auth-field">
                  <label>Cidade *</label>
                  <input type="text" name="edit_cidade_nome" value="${escaparHtml(c.cidade || "Umuarama")}" placeholder="Umuarama" />
                </div>
                <div class="auth-field">
                  <label>UF (Estado) *</label>
                  <input type="text" name="edit_uf" value="${escaparHtml(c.uf || "PR")}" placeholder="PR" maxlength="2" style="text-transform:uppercase;" />
                </div>
              </div>
            </div>

            <button type="submit" class="btn-client-submit-auth" style="margin-top:14px;">
              💾 Salvar Meus Dados Cadastrais
            </button>

            <!-- GESTÃO DE PRIVACIDADE E CONSENTIMENTO (LGPD ART. 8º § 5º) -->
            <div style="margin-top:20px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:16px;">
              <div style="font-size:0.82rem; font-weight:700; color:#0F172A; display:flex; align-items:center; gap:6px; margin-bottom:6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F04E23" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Privacidade &amp; Gestão de Consentimentos (LGPD)</span>
              </div>
              <p style="margin:0 0 12px; font-size:0.77rem; color:#64748B; line-height:1.45;">
                Conforme o Art. 8º da Lei 13.709/2018, você pode revogar autorizações opcionais a qualquer momento com a mesma facilidade com que foram concedidas.
                <a href="#modal-privacy-policy" id="link-abrir-privacidade-dados" style="color:#F04E23; text-decoration:underline; font-weight:600;">Ver Política de Privacidade Completa</a>.
              </p>

              <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; padding:12px 14px; flex-wrap:wrap;">
                <div>
                  <strong style="font-size:0.8rem; color:#1E293B; display:block;">Comunicações e Ofertas (WhatsApp / E-mail)</strong>
                  <span style="font-size:0.74rem; color:#64748B;" id="txt-status-consent-mkt">Verificando status de consentimento...</span>
                </div>
                <div style="display:flex; gap:8px;">
                  <button type="button" id="btn-toggle-consent-marketing" class="btn-client-explore" style="padding:6px 14px; font-size:0.75rem; width:auto; margin:0; background:#0F172A; color:#FFFFFF;">
                    Alternar Autorização
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    // Eventos das Abas Internas da Área do Cliente
    container.querySelectorAll("[data-target-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        renderizarAreaCliente(btn.dataset.targetTab);
      });
    });

    // Evento de Logout do Cliente
    container.querySelector("#btn-cliente-sair")?.addEventListener("click", () => {
      salvarClienteLocal(null);
      if (window.SJ_SUPABASE?.auth?.logout) window.SJ_SUPABASE.auth.logout();
      mostrarToastNotificacao("Você saiu da sua conta.", "info");
      navegarParaCategoria("home");
    });

    // Evento de Remoção de Favorito
    container.querySelectorAll("[data-del-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorito(btn.dataset.delFav);
      });
    });

    // Ação: Carregar Pedido Salvo de Volta no Carrinho
    container.querySelectorAll("[data-reload-order]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pedId = btn.dataset.reloadOrder;
        const pedido = pedidosCliente.find((p) => p.id === pedId);
        if (!pedido || !Array.isArray(pedido.itens) || pedido.itens.length === 0) {
          mostrarToast("Não foi possível carregar os itens deste pedido.", "warning");
          return;
        }

        if (state.itensCaixa.length > 0) {
          const confirma = confirm(
            `Seu carrinho já contém ${state.itensCaixa.length} item(ns). Deseja substituir pelo pedido ${pedId}?`
          );
          if (!confirma) return;
        }

        state.itensCaixa = JSON.parse(JSON.stringify(pedido.itens));
        atualizarCaixaLateral();
        abrirGavetaPedido();
        mostrarToast(
          `🛒 Pedido <strong>${pedId}</strong> carregado no seu carrinho! Você pode adicionar mais itens ou finalizar.`,
          "success"
        );
      });
    });

    // Ação: Excluir Pedido do Histórico do Cliente
    container.querySelectorAll("[data-del-order]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const pedId = btn.dataset.delOrder;
        if (!confirm(`Deseja realmente remover o pedido ${pedId} do seu histórico?`)) {
          return;
        }

        // Remove do localStorage do cliente
        if (c.id) {
          const list = obterPedidosClienteSalvos(c.id).filter((p) => p.id !== pedId);
          persistirPedidosClienteSalvos(c.id, list);
        }

        // Remove de window.SJ_DB.orcamentos se existir
        if (window.SJ_DB?.orcamentos?.excluir) {
          try {
            await window.SJ_DB.orcamentos.excluir(pedId);
          } catch (_) {}
        }

        mostrarToast(`🗑️ Pedido ${pedId} removido do histórico.`, "info");
        renderizarAreaCliente("pedidos");
      });
    });

    // Eventos de Explorar Catálogo
    container.querySelector("#btn-fav-explorar-catalogo")?.addEventListener("click", () => {
      navegarParaCategoria("todos");
    });
    container.querySelector("#btn-pedidos-explorar")?.addEventListener("click", () => {
      navegarParaCategoria("todos");
    });

    // Formulário de Edição de Perfil e Dados de Nota Fiscal
    const formEdit = container.querySelector("#form-client-edit-profile");
    if (formEdit) {
      aplicarMascaraTelefone(formEdit.querySelector('input[name="edit_whatsapp"]'));
      aplicarMascaraCpfApenas(formEdit.querySelector('input[name="edit_cpf"]'));

      const chkEditNf = formEdit.querySelector("#chk-edit-precisa-nf");
      const wrapEditNf = formEdit.querySelector("#edit-nf-fields-wrap");
      chkEditNf?.addEventListener("change", () => {
        if (wrapEditNf) wrapEditNf.style.display = chkEditNf.checked ? "grid" : "none";
      });

      aplicarMascaraCnpjComAutoBusca(
        formEdit.querySelector('input[name="edit_cnpj"]'),
        (dados) => {
          if (!dados) return;
          const razaoInp = formEdit.querySelector('input[name="edit_razao_social"]');
          const fantInp = formEdit.querySelector('input[name="edit_nome_fantasia"]');
          const cepInp = formEdit.querySelector('input[name="edit_cep"]');
          const logInp = formEdit.querySelector('input[name="edit_logradouro"]');
          const numInp = formEdit.querySelector('input[name="edit_numero"]');
          const baiInp = formEdit.querySelector('input[name="edit_bairro"]');
          const compInp = formEdit.querySelector('input[name="edit_complemento"]');
          const cidInp = formEdit.querySelector('input[name="edit_cidade_nome"]');
          const ufInp = formEdit.querySelector('input[name="edit_uf"]');
          const zapInp = formEdit.querySelector('input[name="edit_whatsapp"]');

          if (razaoInp && dados.razao_social) razaoInp.value = dados.razao_social;
          if (fantInp && (dados.nome_fantasia || dados.razao_social)) fantInp.value = dados.nome_fantasia || dados.razao_social;
          if (cepInp && dados.cep) cepInp.value = formatarCep(dados.cep);
          if (logInp && dados.logradouro) {
            logInp.value = dados.descricao_tipo_de_logradouro
              ? `${dados.descricao_tipo_de_logradouro} ${dados.logradouro}`.trim()
              : dados.logradouro;
          }
          if (numInp && dados.numero) numInp.value = dados.numero;
          if (baiInp && dados.bairro) baiInp.value = dados.bairro;
          if (compInp && dados.complemento) compInp.value = dados.complemento;
          if (cidInp && dados.municipio) cidInp.value = dados.municipio;
          if (ufInp && dados.uf) ufInp.value = dados.uf;
          if (zapInp && !zapInp.value && dados.ddd_telefone_1) {
            zapInp.value = dados.ddd_telefone_1;
            aplicarMascaraTelefone(zapInp);
          }
        },
        formEdit.querySelector("#btn-buscar-cnpj-edit"),
        formEdit.querySelector("#status-cnpj-edit"),
        formEdit.querySelector("#spinner-cnpj-edit")
      );

      aplicarMascaraCep(formEdit.querySelector('input[name="edit_cep"]'), (dadosCep) => {
        const logInp = formEdit.querySelector('input[name="edit_logradouro"]');
        const baiInp = formEdit.querySelector('input[name="edit_bairro"]');
        const cidInp = formEdit.querySelector('input[name="edit_cidade_nome"]');
        const ufInp = formEdit.querySelector('input[name="edit_uf"]');
        if (logInp && dadosCep.logradouro) logInp.value = dadosCep.logradouro;
        if (baiInp && dadosCep.bairro) baiInp.value = dadosCep.bairro;
        if (cidInp && dadosCep.localidade) cidInp.value = dadosCep.localidade;
        if (ufInp && dadosCep.uf) ufInp.value = dadosCep.uf;
      });

      formEdit.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = String(formEdit.querySelector('input[name="edit_nome"]')?.value || "").trim();
        const whatsapp = String(formEdit.querySelector('input[name="edit_whatsapp"]')?.value || "").trim();
        const cpf = String(formEdit.querySelector('input[name="edit_cpf"]')?.value || "").trim();
        const precisaNotaFiscal = Boolean(formEdit.querySelector('input[name="edit_precisa_nf"]')?.checked);
        const cnpj = String(formEdit.querySelector('input[name="edit_cnpj"]')?.value || "").trim();
        const razaoSocial = String(formEdit.querySelector('input[name="edit_razao_social"]')?.value || "").trim();
        const nomeFantasia = String(formEdit.querySelector('input[name="edit_nome_fantasia"]')?.value || "").trim();
        const cep = String(formEdit.querySelector('input[name="edit_cep"]')?.value || "").trim();
        const inscricaoEstadual = String(formEdit.querySelector('input[name="edit_ie"]')?.value || "").trim();
        const logradouro = String(formEdit.querySelector('input[name="edit_logradouro"]')?.value || "").trim();
        const numero = String(formEdit.querySelector('input[name="edit_numero"]')?.value || "").trim();
        const bairro = String(formEdit.querySelector('input[name="edit_bairro"]')?.value || "").trim();
        const complemento = String(formEdit.querySelector('input[name="edit_complemento"]')?.value || "").trim();
        const cidade = String(formEdit.querySelector('input[name="edit_cidade_nome"]')?.value || "Umuarama").trim();
        const uf = String(formEdit.querySelector('input[name="edit_uf"]')?.value || "PR").trim().toUpperCase();

        const checkCpfEdit = validarCpfOficial(cpf);
        if (!checkCpfEdit) {
          const inpCpf = formEdit.querySelector('input[name="edit_cpf"]');
          atualizarFeedbackVisualCpf(inpCpf, true);
          inpCpf?.focus();
          const msg = "CPF do Titular inválido. Digite um CPF válido com 11 dígitos.";
          mostrarToast(msg, "error");
          alert(msg);
          return;
        }

        if (precisaNotaFiscal && cnpj) {
          const checkCnpjEdit = validarCnpjOficial(cnpj);
          if (!checkCnpjEdit) {
            const inpCnpj = formEdit.querySelector('input[name="edit_cnpj"]');
            inpCnpj?.focus();
            const msg = "CNPJ informado inválido. Verifique os 14 dígitos da empresa.";
            mostrarToast(msg, "error");
            alert(msg);
            return;
          }
        }

        const atualizado = {
          ...state.clienteLogado,
          nome,
          whatsapp,
          cpf,
          cnpjCpf: cpf,
          cnpj,
          razaoSocial,
          nomeFantasia,
          precisaNotaFiscal,
          cep,
          inscricaoEstadual,
          logradouro,
          numero,
          bairro,
          complemento,
          cidade,
          uf,
          cidadeUf: `${cidade} / ${uf}`
        };

        const validacao = validarDadosCliente(atualizado, precisaNotaFiscal);
        if (!validacao.valido) {
          mostrarToast(validacao.mensagem, "error");
          alert(validacao.mensagem);
          return;
        }

        atualizado.cadastroAprovado = true;
        state.precisaNotaFiscalPedido = precisaNotaFiscal;
        salvarClienteLocal(atualizado);

        // Atualiza na nuvem
        if (window.SJ_SUPABASE?.clientes?.cadastrar) {
          try {
            await window.SJ_SUPABASE.clientes.cadastrar({
              id: atualizado.id,
              nome,
              cnpjCpf: cnpj ? `${cpf} | CNPJ: ${cnpj}` : cpf,
              whatsapp,
              email: atualizado.email,
              endereco: formatarEnderecoCompletoCliente(atualizado),
              bairroCidadeUf: `${bairro ? bairro + " - " : ""}${cidade}/${uf}`
            });
          } catch (_) {}
        }

        mostrarToastNotificacao("✅ Dados cadastrais e fiscais aprovados e salvos com sucesso!", "sucesso");
        renderizarAreaCliente("dados");
      });
    }

    // Gestão de Consentimento LGPD (Área do Cliente)
    const linkPrivacidadeDados = container.querySelector("#link-abrir-privacidade-dados");
    linkPrivacidadeDados?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirModalPoliticaPrivacidade();
    });

    const txtStatusConsent = container.querySelector("#txt-status-consent-mkt");
    const btnToggleConsent = container.querySelector("#btn-toggle-consent-marketing");

    if (txtStatusConsent && btnToggleConsent && c.email) {
      let consentimentoAtivo = false;
      const verificarConsentimento = async () => {
        if (window.SJ_SUPABASE?.consentimentos?.listar) {
          try {
            const lista = await window.SJ_SUPABASE.consentimentos.listar(c.email);
            const mkt = lista.find((item) => item.finalidade === "comunicacoes_marketing");
            consentimentoAtivo = Boolean(mkt && mkt.consentimento_concedido && !mkt.revogado_em);
          } catch (_) {
            consentimentoAtivo = false;
          }
        }
        if (consentimentoAtivo) {
          txtStatusConsent.innerHTML = '<span style="color:#059669; font-weight:700;">🟢 Ativo</span> — Você autorizou o recebimento de promoções e novidades.';
          btnToggleConsent.textContent = "Revogar Consentimento";
          btnToggleConsent.style.background = "#DC2626";
        } else {
          txtStatusConsent.innerHTML = '<span style="color:#64748B; font-weight:700;">⚪ Desativado</span> — Nenhuma mensagem comercial não solicitada será enviada.';
          btnToggleConsent.textContent = "Autorizar Recebimento";
          btnToggleConsent.style.background = "#0F172A";
        }
      };

      verificarConsentimento();

      btnToggleConsent.addEventListener("click", async () => {
        btnToggleConsent.disabled = true;
        btnToggleConsent.textContent = "Aguarde...";
        try {
          if (consentimentoAtivo) {
            await window.SJ_SUPABASE.consentimentos.revogar(c.email, "comunicacoes_marketing", "Revogado pelo cliente na aba Meus Dados");
            mostrarToast("Consentimento revogado com sucesso. Você não receberá mais ofertas.", "info");
          } else {
            await window.SJ_SUPABASE.consentimentos.registrar({
              titularIdentificador: c.email,
              titularTipo: "cliente",
              finalidade: "comunicacoes_marketing",
              versaoTermo: "v1.0",
              consentimentoConcedido: true,
              canal: "web"
            });
            mostrarToast("Consentimento concedido com sucesso!", "success");
          }
        } catch (err) {
          mostrarToast("Erro ao atualizar consentimento: " + err.message, "error");
        } finally {
          btnToggleConsent.disabled = false;
          await verificarConsentimento();
        }
      });
    }
  }

  // Handler Global para Cliques de Favoritar e Minha Conta
  document.addEventListener("click", (e) => {
    // Clique no coração de favoritar
    const btnFav = e.target.closest("[data-toggle-fav]");
    if (btnFav) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorito(btnFav.dataset.toggleFav);
      return;
    }

    // Clique no botão Favoritos do Header
    const btnHeaderFav = e.target.closest("#header-fav-btn");
    if (btnHeaderFav) {
      e.preventDefault();
      navegarParaCategoria("minha-conta");
      renderizarAreaCliente("favoritos");
      return;
    }

    // Clique no botão Minha Conta / Entrar do Header
    const btnHeaderAcc = e.target.closest("#header-account-btn");
    if (btnHeaderAcc) {
      e.preventDefault();
      if (state.clienteLogado) {
        navegarParaCategoria("minha-conta");
      } else {
        abrirModalAuthCliente("login");
      }
      return;
    }

    // Botões no carrinho ou banner que convidam ao cadastro
    const btnOpenCad = e.target.closest("[data-open-cadastro]");
    if (btnOpenCad) {
      e.preventDefault();
      abrirModalAuthCliente("signup");
      return;
    }
  });

  function gerarBannerPromocionalSecaoHtml() {
    const b = obterConfigBannerPromocao();
    if (!b.exibirBannerSecaoImpressoras) return "";

    const styleInline = gerarEstiloBgBannerPromocao(b.imagemFundo);

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
            <h3 class="raffle-big-model">${b.tituloPrincipal || "SORTEIO BAMBU LAB A1 MINI"}</h3>
            ${b.subtituloPremio ? `<span class="raffle-sub-prize">${b.subtituloPremio}</span>` : ""}
          </div>

          <div class="natal-raffle-actions">
            <a
              href="${b.btn1Url || "https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20o%20banner%20do%20site%20e%20quero%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Sorteio%20da%20Bambu%20Lab%20A1%20Mini!"}"
              target="_blank"
              rel="noopener"
              class="btn-raffle-whatsapp"
            >
              ${b.btn1Texto || "Mais Informações no WhatsApp →"}
            </a>
          </div>
        </div>
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
          const stCor = cor.estoqueStatus || "disponivel";
          const tagEst = stCor === "esgotado" ? " [ESGOTADO]" : stCor === "poucas_unidades" ? " [POUCAS UNID.]" : "";
          return `<option value="${idx}" data-hex="${cor.hex}" data-nome="${cor.nome}" data-cod="${cor.cod || ""
            }" data-preco="${cor.preco || ""}" data-valor="${cor.valor || 0}" data-filtro="${cor.filtroCss
            }" data-img-catalogo="${cor.imgCatalogo || ""}" data-foto-direta="${cor.usaFotoCatalogoDireta ? "1" : "0"
            }" data-img-base="${imagemBase}" data-estoque="${stCor}" ${idx === idxInicial ? "selected" : ""
            }>${nomeLimpo}${codStr} (${cor.preco || ""})${tagEst}</option>`;
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

    const priceLineHtml = item.categoria === "pecas"
      ? `
        <div class="combo-card-peca-info">
          <div class="peca-card-tags">
            <span class="peca-area-badge">Área: ${escaparHtml(item.area || "Componentes")}</span>
            <span class="peca-compat-badge">${escaparHtml(item.compatibilidade || item.select2Opcoes?.[0] || "Universal")}</span>
          </div>
          <div class="peca-card-funcao">
            <span class="peca-funcao-rotulo">Para que serve:</span>
            <p class="peca-funcao-texto">${escaparHtml(item.paraQueServe || item.subtitulo || "")}</p>
          </div>
        </div>
      `
      : (precoInicialExibicao
        ? `
        <div class="combo-card-clean-price">
          <strong id="price-val-${item.id}">${precoInicialExibicao}</strong>
          ${parcelaCurta}
        </div>
      `
        : "");

    const codBadgeHtml =
      item.tipoFilamento && corInicialObj?.cod
        ? `<span class="card-cod-badge" id="cod-badge-${item.id}">CÓD. ${corInicialObj.cod}</span>`
        : "";

    const statusInicial = (corInicialObj && corInicialObj.estoqueStatus)
      ? corInicialObj.estoqueStatus
      : (item.estoqueStatus || "disponivel");
    const ehEsgotado = statusInicial === "esgotado";
    const ehPoucas = statusInicial === "poucas_unidades";

    const stockBadgeCardHtml = `<span class="card-stock-badge status-${statusInicial}" id="stock-badge-${item.id}" style="${statusInicial === "disponivel" ? "display:none;" : ""}">${ehEsgotado ? "🔴 ESGOTADO" : ehPoucas ? "🟠 POUCAS UNIDADES" : ""}</span>`;

    const opcoesSelect2 = item.select2Opcoes || ["Padrão"];
    const mostrarSel1 =
      item.categoria !== "impressoras" &&
      !item.variantesDiametro &&
      Array.isArray(opcoesSelect1) &&
      opcoesSelect1.length > 1;
    const mostrarSel2 =
      !item.variantesDiametro &&
      (Boolean(item.tipoFilamento) ||
      (Array.isArray(opcoesSelect2) &&
        opcoesSelect2.length > 1 &&
        !(opcoesSelect2.length === 1 && opcoesSelect2[0] === "Padrão")));
    const ocultarLinhaSelects = !mostrarSel1 && !mostrarSel2;

    let diametrosCardHtml = "";
    if (item.variantesDiametro && item.variantesDiametro.length > 0) {
      diametrosCardHtml = `
        <div class="peca-card-diam-section" id="diam-section-${item.id}">
          <span class="peca-card-diam-label">Diâmetro do Bico:</span>
          <div class="peca-card-diam-pills" role="radiogroup" aria-label="Escolher diâmetro">
            ${item.variantesDiametro
              .map(
                (v, idx) => `
                <button
                  type="button"
                  class="peca-card-diam-pill ${idx === 1 ? "active" : ""}"
                  data-card-diam-btn="${item.id}"
                  data-card-diam-val="${v.diametro}"
                  data-card-diam-img="${v.imagem}"
                  title="${v.diametro} (${v.material}) — ${v.destaque}"
                  aria-label="Diâmetro ${v.diametro}"
                >
                  ${v.diametro}
                </button>
              `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return `
      <article
        class="combo-filament-card ${ehEsgotado ? "is-out-of-stock" : ""}"
        data-item-id="${item.id}"
        ${
          dadosImp
            ? `data-vista-txt="${dadosImp.vistaTexto}" data-vista-sub="${dadosImp.vistaSub}" data-parc-main="${dadosImp.parceladoMain}" data-parc-sub="${dadosImp.parceladoSub}"`
            : ""
        }
      >
        <button type="button" class="admin-quick-edit-btn" data-admin-edit-prod="${item.id}" title="Editar foto, preço, estoque e descrição deste produto">
          ✏️ Editar
        </button>

        <div class="combo-image-wrap" data-open-modal="${item.id}" title="Clique para ver detalhes">
          <button type="button" class="card-fav-btn ${isFavorito(item.id) ? "active" : ""}" data-toggle-fav="${item.id}" aria-label="Favoritar ${tituloCard}" title="Guardar nos Favoritos">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="${isFavorito(item.id) ? "#f04e23" : "none"}" stroke="${isFavorito(item.id) ? "#f04e23" : "#71717a"}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          ${codBadgeHtml}
          ${stockBadgeCardHtml}
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
        ${diametrosCardHtml}
        ${swatchesHtml}

        <div class="combo-selects-row ${mostrarSel1 && mostrarSel2 ? "" : "single-select-row"}" style="${ocultarLinhaSelects ? "display:none;" : ""}">
          <select class="combo-select" id="sel1-${item.id}" data-type-select="${item.id}" aria-label="Primeira opção" style="${mostrarSel1 ? "" : "display:none;"}">
            ${select1Html}
          </select>

          <select
            class="combo-select"
            id="sel2-${item.id}"
            ${item.tipoFilamento ? `data-color-select="${item.id}"` : ""}
            aria-label="Segunda opção ou cor"
            style="${mostrarSel2 ? "" : "display:none;"}"
          >
            ${select2Html}
          </select>
        </div>

        <button type="button" class="btn-add-to-box ${ehEsgotado ? "btn-out-of-stock" : ""}" id="btn-add-${item.id}" data-add-item="${item.id}" data-default-txt="${item.botaoTexto || "Adicionar ao Pedido"}" ${ehEsgotado ? "disabled" : ""}>
          ${ehEsgotado ? "🔴 Esgotado no Momento" : (item.botaoTexto || "+ Adicionar ao Pedido")}
        </button>
      </article>
    `;
  }

  // Limpa prefixos redundantes no nome da cor quando o cliente já selecionou a linha/material
  function formatarNomeCorClean(nomeBruto, matId = "") {
    let n = String(nomeBruto || "").replace(/\s*1kg$/i, "").trim();
    if (matId === "fil-petg-maxprint") {
      n = n.replace(/^PETG\s+/i, "");
    } else if (matId === "fil-tpu-maxprint") {
      n = n.replace(/^TPU(\s+Flex[íi]vel)?(\s+95A)?\s+/i, "");
    } else if (matId === "fil-silk-maxprint") {
      n = n.replace(/^PLA\s+Silk\s+/i, "Silk ");
    } else if (matId === "fil-abs-especiais") {
      n = n.replace(/^Filamento\s+/i, "");
    } else if (matId === "bambu") {
      n = n
        .replace(/^Bambu\s+Lab\s+/i, "")
        .replace(/\s*\(Refil\s*s\/?\s*Bobina\)/i, "")
        .replace(/\s*Refil\s*RFID/i, "");
    }
    return n || nomeBruto || "Cor";
  }

  // 2.5 STUDIO CLEAN DE FILAMENTOS (BARRA UNIFICADA + GRADE DIRETA E SEM REPETIÇÕES)
  function gerarHubFilamentosHtml(contexto = "catalogo") {
    const marcaAtiva = state.hubFilamentoMarcaAtiva || "MaxPrint";
    const isBambuAtivo = marcaAtiva === "Bambu Lab";

    const materiaisMaxPrint = [
      {
        id: "fil-pla-maxprint",
        curto: "PLA",
        qtdCores: (window.SITE_DATA.coresMaxPrint || []).length
      },
      {
        id: "fil-silk-maxprint",
        curto: "PLA Silk",
        qtdCores: (window.SITE_DATA.coresPlaSilk || []).length
      },
      {
        id: "fil-petg-maxprint",
        curto: "PETG",
        qtdCores: (window.SITE_DATA.coresPetg || []).length
      },
      {
        id: "fil-tpu-maxprint",
        curto: "TPU Flex",
        qtdCores: (window.SITE_DATA.coresTpu || []).length
      },
      {
        id: "fil-abs-especiais",
        curto: "ABS & Glitter",
        qtdCores: (window.SITE_DATA.coresAbsEspeciais || []).length
      }
    ];

    const totalCoresMaxPrint = materiaisMaxPrint.reduce((acc, m) => acc + m.qtdCores, 0);
    const totalCoresBambu = (window.SITE_DATA.coresBambuLab || []).length;

    const opcoesBambu = [
      { id: "todos", curto: "Todos", qtd: totalCoresBambu },
      { id: "carretel", curto: "Com Bobina RFID", qtd: 10 },
      { id: "refil", curto: "Refil s/ Bobina", qtd: 3 }
    ];

    let barraMateriaisHtml = "";
    let gradeCoresHtml = "";
    let idFichaTecnicaAtiva = "fil-pla-maxprint";

    if (!isBambuAtivo) {
      const matAtivoId =
        state.hubFilamentoMaterialMaxPrint && state.hubFilamentoMaterialMaxPrint !== "todos"
          ? state.hubFilamentoMaterialMaxPrint
          : "fil-pla-maxprint";
      idFichaTecnicaAtiva = matAtivoId;

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

      barraMateriaisHtml = `
        <div class="sj-fil-line-pills" role="tablist" aria-label="Linha de filamento Masterprint">
          ${materiaisMaxPrint
            .map(
              (m) => `
            <button
              type="button"
              class="sj-fil-line-pill ${matAtivoId === m.id ? "active" : ""}"
              data-hub-max-mat="${m.id}"
            >
              <span class="pill-name">${m.curto}</span>
              <span class="pill-count">${m.qtdCores}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `;

      gradeCoresHtml = `
        <div class="sj-fil-clean-grid">
          ${coresFiltradas
            .map((cor) => {
              const stCor =
                cor.estoqueStatus || (itemAtivo && itemAtivo.estoqueStatus) || "disponivel";
              const isEsg = stCor === "esgotado";
              const isPouc = stCor === "poucas_unidades";
              const nomeLimpo = formatarNomeCorClean(cor.nome, matAtivoId);
              return `
                <article class="filament-color-tile sj-fil-card ${isEsg ? "tile-is-esgotado" : ""}">
                  <div
                    class="filament-color-tile-img sj-fil-card-media"
                    data-hub-open-color-pdp="${itemAtivo.id}"
                    data-hub-color-idx="${cor.originalIdx}"
                    title="Ver detalhes de ${cor.nome} (#${cor.cod})"
                  >
                    <span class="sj-fil-code-tag">#${cor.cod}</span>
                    ${
                      isEsg
                        ? `<span class="sj-fil-stock-pill is-esgotado">Esgotado</span>`
                        : isPouc
                          ? `<span class="sj-fil-stock-pill is-poucas">Últimas unid.</span>`
                          : ""
                    }
                    <img
                      src="${cor.usaFotoCatalogoDireta && cor.imgCatalogo ? cor.imgCatalogo : itemAtivo.imagem}"
                      alt="${cor.nome}"
                      style="filter: ${cor.usaFotoCatalogoDireta ? "none" : cor.filtroCss || "none"};"
                      loading="lazy"
                    />
                  </div>
                  <div class="filament-color-tile-body sj-fil-card-body">
                    <div
                      class="sj-fil-name-row"
                      data-hub-open-color-pdp="${itemAtivo.id}"
                      data-hub-color-idx="${cor.originalIdx}"
                    >
                      <span class="sj-fil-dot" style="background: ${cor.hex};"></span>
                      <strong class="tile-color-name sj-fil-name">${nomeLimpo}</strong>
                    </div>
                    <div class="sj-fil-card-footer">
                      <strong class="tile-price-val sj-fil-price">${cor.preco}</strong>
                      <button
                        type="button"
                        class="tile-add-btn sj-fil-add-btn ${isEsg ? "btn-out-of-stock" : ""}"
                        data-hub-quick-add="${itemAtivo.id}"
                        data-hub-color-idx="${cor.originalIdx}"
                        data-hub-brand="MaxPrint"
                        ${isEsg ? "disabled" : ""}
                      >
                        ${isEsg ? "Esgotado" : "+ Adicionar"}
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    } else {
      idFichaTecnicaAtiva = "fil-pla-bambulab";
      const itemBambu =
        window.SITE_DATA.catalogo.find((i) => i.id === "fil-pla-bambulab") ||
        window.SITE_DATA.catalogo[0];
      const paletaBambu = window.SITE_DATA.coresBambuLab || [];
      const filtroBambu = state.hubFilamentoFiltroBambu || "todos";
      const termoBusca = (state.busca || "").trim().toLowerCase();

      const coresBambuFiltradas = paletaBambu
        .map((cor, originalIdx) => ({ ...cor, originalIdx }))
        .filter((cor) => {
          const ehRefil =
            (cor.nome || "").toLowerCase().includes("refil") ||
            (cor.tipo || "").toLowerCase().includes("refil");
          if (filtroBambu === "carretel" && ehRefil) return false;
          if (filtroBambu === "refil" && !ehRefil) return false;
          if (termoBusca) {
            return `${cor.nome} ${cor.cod} cod ${cor.cod} cód ${cor.cod} bambu`
              .toLowerCase()
              .includes(termoBusca);
          }
          return true;
        });

      barraMateriaisHtml = `
        <div class="sj-fil-line-pills" role="tablist" aria-label="Apresentação Bambu Lab">
          ${opcoesBambu
            .map(
              (op) => `
            <button
              type="button"
              class="sj-fil-line-pill ${filtroBambu === op.id ? "active" : ""}"
              data-hub-bambu-filter="${op.id}"
            >
              <span class="pill-name">${op.curto}</span>
              <span class="pill-count">${op.qtd}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `;

      gradeCoresHtml = `
        <div class="sj-fil-clean-grid">
          ${coresBambuFiltradas
            .map((cor) => {
              const ehRefil =
                (cor.nome || "").toLowerCase().includes("refil") ||
                (cor.tipo || "").toLowerCase().includes("refil");
              const stCor =
                cor.estoqueStatus || (itemBambu && itemBambu.estoqueStatus) || "disponivel";
              const isEsg = stCor === "esgotado";
              const isPouc = stCor === "poucas_unidades";
              const nomeLimpo = formatarNomeCorClean(cor.nome, "bambu");
              return `
                <article class="filament-color-tile sj-fil-card bambu-tile ${isEsg ? "tile-is-esgotado" : ""}">
                  <div
                    class="filament-color-tile-img sj-fil-card-media"
                    data-hub-open-color-pdp="fil-pla-bambulab"
                    data-hub-color-idx="${cor.originalIdx}"
                    title="Ver detalhes de ${cor.nome} (#${cor.cod})"
                  >
                    <span class="sj-fil-code-tag">#${cor.cod}</span>
                    <span class="sj-fil-rfid-mini ${ehRefil ? "is-refil" : ""}">${
                      ehRefil ? "Refil" : "Bobina RFID"
                    }</span>
                    ${
                      isEsg
                        ? `<span class="sj-fil-stock-pill is-esgotado">Esgotado</span>`
                        : isPouc
                          ? `<span class="sj-fil-stock-pill is-poucas">Últimas unid.</span>`
                          : ""
                    }
                    <img
                      src="${cor.usaFotoCatalogoDireta && cor.imgCatalogo ? cor.imgCatalogo : itemBambu.imagem}"
                      alt="${cor.nome}"
                      style="filter: ${cor.usaFotoCatalogoDireta ? "none" : cor.filtroCss || "none"};"
                      loading="lazy"
                    />
                  </div>
                  <div class="filament-color-tile-body sj-fil-card-body">
                    <div
                      class="sj-fil-name-row"
                      data-hub-open-color-pdp="fil-pla-bambulab"
                      data-hub-color-idx="${cor.originalIdx}"
                    >
                      <span class="sj-fil-dot" style="background: ${cor.hex};"></span>
                      <strong class="tile-color-name sj-fil-name">${nomeLimpo}</strong>
                    </div>
                    <div class="sj-fil-card-footer">
                      <strong class="tile-price-val sj-fil-price">${cor.preco}</strong>
                      <button
                        type="button"
                        class="tile-add-btn sj-fil-add-btn ${isEsg ? "btn-out-of-stock" : ""}"
                        data-hub-quick-add="fil-pla-bambulab"
                        data-hub-color-idx="${cor.originalIdx}"
                        data-hub-brand="Bambu Lab"
                        ${isEsg ? "disabled" : ""}
                      >
                        ${isEsg ? "Esgotado" : "+ Adicionar"}
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    }

    return `
      <div class="filament-brand-hub-wrapper sj-fil-studio" data-filament-hub="${contexto}" id="filament-ext-box-${contexto}">
        <div class="sj-fil-studio-bar">
          <div class="sj-fil-bar-top">
            <div class="sj-fil-brand-segmented" role="tablist" aria-label="Marca de filamento">
              <button
                type="button"
                class="sj-fil-brand-btn ${!isBambuAtivo ? "active" : ""}"
                data-hub-select-brand="MaxPrint"
              >
                <strong>Masterprint</strong>
                <span>${totalCoresMaxPrint} cores</span>
              </button>
              <button
                type="button"
                class="sj-fil-brand-btn is-bambu ${isBambuAtivo ? "active" : ""}"
                data-hub-select-brand="Bambu Lab"
              >
                <span class="sj-rfid-tag">RFID</span>
                <strong>Bambu Lab</strong>
                <span>${totalCoresBambu} cores</span>
              </button>
            </div>

            <div class="sj-fil-bar-meta">
              <span class="sj-fil-spec-pill">Bobina 1 kg • 1.75 mm</span>
              <button type="button" class="sj-fil-pdp-link" data-hub-open-pdp="${idFichaTecnicaAtiva}">
                📄 Ficha Técnica →
              </button>
            </div>
          </div>

          ${barraMateriaisHtml}
        </div>

        ${gradeCoresHtml}
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

        // Se for a seção de Filamentos, renderiza o Studio Clean de Filamentos
        if (sec.id === "filamentos") {
          return `
            <section class="category-section-block" id="sec-filamentos">
              <div class="category-section-header">
                <h2>${sec.titulo}</h2>
              </div>
              ${gerarHubFilamentosHtml("catalogo")}
            </section>
          `;
        }

        let itensParaRenderizar = itensSecao;
        let rodapeSecaoHtml = "";

        if (sec.id === "pecas" && state.categoriaMenu === "todos" && state.busca.trim() === "") {
          const idsDestaque = [
            "peca-kit-hotend-bambu-a1",
            "peca-extrusora-original-a1",
            "peca-placa-peo-pei-257"
          ];
          const filtradas = idsDestaque.map((id) => itensSecao.find((i) => i.id === id)).filter(Boolean);
          itensParaRenderizar = filtradas.length > 0 ? filtradas : itensSecao.slice(0, 3);
          rodapeSecaoHtml = `
            <div style="text-align: center; width: 100%; margin-top: 24px;">
              <button type="button" class="btn-ver-todas-pecas-home" data-navegar-cat="pecas">
                ⚙️ Ver Todas as ${itensSecao.length} Peças &amp; Acessórios →
              </button>
            </div>
          `;
        }

        const btnCompararHtml =
          sec.id === "impressoras"
            ? `<button type="button" class="btn-compare-printers-pill" data-open-printer-compare="1">⚖️ Comparar Impressoras</button>`
            : sec.id === "pecas" && state.categoriaMenu === "todos" && state.busca.trim() === ""
              ? `<button type="button" class="pdp-back-btn" data-navegar-cat="pecas">Ver Todas (${itensSecao.length}) →</button>`
              : "";

        return `
          <section class="category-section-block" id="sec-${sec.id}">
            <div class="category-section-header">
              <h2>${sec.id === "pecas" && state.categoriaMenu === "todos" && state.busca.trim() === "" ? "Peças de Reposição em Destaque" : sec.titulo}</h2>
              <div class="category-header-right">
                ${btnCompararHtml}
                <span>${itensParaRenderizar.length} ${itensParaRenderizar.length === 1 ? "opção" : "opções"} ${sec.id === "pecas" && state.categoriaMenu === "todos" && state.busca.trim() === "" ? `de ${itensSecao.length}` : ""}</span>
              </div>
            </div>
            <div class="combo-products-row">
              ${itensParaRenderizar.map((item) => gerarCardHTML(item)).join("")}
            </div>
            ${rodapeSecaoHtml}
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

        // Atualiza selo de estoque e botão Adicionar ao trocar a cor do filamento
        const estoqueCor = opt.dataset.estoque || "disponivel";
        const stockBadgeEl = document.getElementById(`stock-badge-${itemId}`);
        if (stockBadgeEl) {
          stockBadgeEl.className = `card-stock-badge status-${estoqueCor}`;
          if (estoqueCor === "esgotado") {
            stockBadgeEl.textContent = "🔴 ESGOTADO";
            stockBadgeEl.style.display = "inline-flex";
          } else if (estoqueCor === "poucas_unidades") {
            stockBadgeEl.textContent = "🟠 POUCAS UNIDADES";
            stockBadgeEl.style.display = "inline-flex";
          } else {
            stockBadgeEl.textContent = "";
            stockBadgeEl.style.display = "none";
          }
        }

        const btnAddCard = document.getElementById(`btn-add-${itemId}`);
        if (btnAddCard) {
          const itemCat = window.SITE_DATA.catalogo.find((i) => i.id === itemId);
          const defaultBtnText = itemCat ? itemCat.textoBotao || "Adicionar ao Pedido" : "Adicionar ao Pedido";
          if (estoqueCor === "esgotado") {
            btnAddCard.disabled = true;
            btnAddCard.classList.add("btn-out-of-stock");
            btnAddCard.textContent = "🔴 Esgotado no Momento";
          } else {
            btnAddCard.disabled = false;
            btnAddCard.classList.remove("btn-out-of-stock");
            btnAddCard.textContent = defaultBtnText;
          }
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

    // Troca rápida de diâmetro direto no card da peça (Hotends Bambu Lab 0.2, 0.4, 0.6, 0.8 mm)
    container.querySelectorAll("[data-card-diam-btn]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.cardDiamBtn;
        const diamVal = btn.dataset.cardDiamVal;
        const diamImg = btn.dataset.cardDiamImg;

        const imgEl = document.getElementById(`img-${itemId}`);
        if (imgEl && diamImg) {
          imgEl.src = diamImg;
        }

        const sel1 = document.getElementById(`sel1-${itemId}`);
        if (sel1) {
          sel1.value = diamVal;
        }

        const cardEl = btn.closest(".combo-filament-card");
        if (cardEl) {
          cardEl.querySelectorAll("[data-card-diam-btn]").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });
        }
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

    // Navegar para categoria direto por botões de seção (ex: Ver Todas as Peças)
    container.querySelectorAll("[data-navegar-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        navegarParaCategoria(btn.dataset.navegarCat);
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

    // Verifica se o produto ou a cor selecionada está esgotado
    let statusEstoque = item.estoqueStatus || "disponivel";
    if (customConfig && customConfig.corObj && customConfig.corObj.estoqueStatus) {
      statusEstoque = customConfig.corObj.estoqueStatus;
    } else if (item.tipoFilamento && sel2 && sel2.options[sel2.selectedIndex]) {
      statusEstoque = sel2.options[sel2.selectedIndex].dataset.estoque || statusEstoque;
    }
    if (statusEstoque === "esgotado") {
      mostrarNotificacaoToast("🔴 Este item está esgotado no momento. Consulte previsão pelo WhatsApp!");
      return;
    }

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

    // Cupons do sorteio são definidos diretamente na loja ao fechar o pedido
    [trackerEl, drawerTrackerEl].forEach((el) => {
      if (el) {
        el.style.display = "none";
        el.innerHTML = "";
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
      const mostrarBarra = !state.emissorAberto;
      mobileBar.classList.toggle("visible", mostrarBarra);
      mobileBar.classList.toggle("visible-any-screen", mostrarBarra);
      mobileBar.style.display = mostrarBarra ? "flex" : "none";

      if (totalItens > 0) {
        mobileCount.textContent = `${totalItens} ${
          totalItens === 1 ? "item no carrinho" : "itens no carrinho"
        }`;
        mobileTotal.textContent =
          valorTotalEstimado > 0
            ? formatarMoedaBR(valorTotalEstimado)
            : temItensSobConsulta
              ? "Sob consulta"
              : "Clique para abrir seu pedido";
      } else {
        mobileCount.textContent = "Seu Carrinho (0 itens)";
        mobileTotal.textContent = "Clique para ver seu pedido";
      }
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
      badge: cfgBan.badge || "🎁 SORTEIO OFICIAL",
      dataSorteio: cfgBan.dataSorteio,
      tituloRaffleKicker: "",
      tituloRaffleMain: cfgBan.tituloPrincipal || "SORTEIO <em>BAMBU LAB A1 MINI</em>",
      tituloRaffleSub: cfgBan.subtituloPremio || "+ KIT COM 4 KG DE FILAMENTOS",
      precoDestaque: "",
      resumoCurtoSorteio: "",
      btn1Texto: cfgBan.btn1Texto || "Mais Informações no WhatsApp →",
      btn1Whatsapp: cfgBan.btn1Url || "https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20o%20banner%20do%20site%20e%20quero%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Sorteio%20da%20Bambu%20Lab%20A1%20Mini!",
      abrirModalRegras: false
    };

    const slidesFixos = [
      {
        badge: "ALTA PERFORMANCE • 4 CABEÇOTES & COREXY",
        titulo: "Snapmaker U1 & Bambu Lab P2S Combo",
        subtitulo:
          "Impressoras 3D fechadas de alta precisão. Até 10x sem juros ou desconto especial à vista.",
        precoDestaque: "A partir de R$ 8.849,00 à vista",
        btn1Texto: "Ver Snapmaker U1 →",
        btn1Item: "imp-snapmaker",
        btn2Texto: "Ver Impressoras",
        btn2Cat: "impressoras",
        img1: "assets/produtos/impressora-snapmaker_u1.jpg",
        img1Label: "Snapmaker U1 (4 Cabeçotes)",
        img2: "assets/produtos/impressora-p2s_combo.jpg",
        img2Label: "Bambu Lab P2S Combo"
      },
      {
        badge: "CAMPEÃS DE VENDAS • LINHA A1",
        titulo: "Bambu Lab A1 Mini & A1 Combo",
        subtitulo:
          "Calibração 100% automática, alta velocidade de até 500 mm/s e sistema multicor com leitura RFID.",
        precoDestaque: "A1 Mini a partir de R$ 1.961,00 à vista (ou 10x de R$ 217,90)",
        btn1Texto: "Conhecer Linha A1 →",
        btn1Item: "imp-bambu-a1-combo",
        btn2Texto: "Ver A1 Mini",
        btn2Item: "imp-bambu-a1-mini",
        img1: "assets/produtos/impressora-a1_combo.jpg",
        img1Label: "Bambu Lab A1 Combo",
        img2: "assets/produtos/impressora-a1_mini_combo.jpg",
        img2Label: "Bambu Lab A1 Mini Combo"
      },
      {
        badge: "CATÁLOGO OFICIAL • +80 CORES",
        titulo: "Filamentos Masterprint & Bambu Lab RFID",
        subtitulo:
          "Mais de 80 cores oficiais à pronta entrega: PLA Silk Dual/Rainbow, PETG, TPU e Bobinas/Refis RFID.",
        precoDestaque: "Filamentos 1 kg a partir de R$ 59,90",
        btn1Texto: "Ver Filamentos →",
        btn1Cat: "filamentos",
        btn2Texto: "Ver PLA Silk",
        btn2Item: "fil-silk-maxprint",
        img1: "assets/produtos/filamentos/cod_137.png?v=20261108_05",
        img1Label: "PLA Bambu Lab RFID",
        img2: "assets/produtos/pla-maxprint.jpg",
        img2Label: "PLA Masterprint"
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
    const todasPecas = window.SITE_DATA.catalogo.filter(
      (i) => i.categoria === "pecas"
    );

    // Destaques de Peças na Capa (Clean & Simétrico — exatamente 3 peças para fechar 1 linha perfeita de 3 colunas)
    const idsPecasDestaque = [
      "peca-kit-hotend-bambu-a1",
      "peca-extrusora-original-a1",
      "peca-placa-peo-pei-257"
    ];
    const pecasDestaqueHome = idsPecasDestaque
      .map((id) => todasPecas.find((p) => p.id === id))
      .filter(Boolean);
    const pecasParaExibirHome =
      pecasDestaqueHome.length > 0 ? pecasDestaqueHome : todasPecas.slice(0, 3);

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
              : s.precoDestaque
                ? `<div class="hero-slide-price-pill">${s.precoDestaque}</div>`
                : ""
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

      <!-- 2. FAIXA DE DIFERENCIAIS LOJA SJ 3D (UI/UX PRO MAX — ÍCONES SVG VETORIAIS) -->
      <div class="home-benefits-strip">
        <div class="home-benefit-card">
          <div class="sj-benefit-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>
          </div>
          <div>
            <strong>Revendedor Autorizado</strong>
            <span>Bambu Lab &amp; Masterprint oficiais</span>
          </div>
        </div>
        <div class="home-benefit-card">
          <div class="sj-benefit-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div>
            <strong>Pronta Entrega em Umuarama</strong>
            <span>Av. Portugal, 6759 — retire na hora</span>
          </div>
        </div>
        <div class="home-benefit-card">
          <div class="sj-benefit-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          </div>
          <div>
            <strong>Até 10x ou Desconto à Vista</strong>
            <span>Condições especiais em impressoras 3D</span>
          </div>
        </div>
        <div class="home-benefit-card">
          <div class="sj-benefit-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <div>
            <strong>Assistência Técnica Própria</strong>
            <span>Manutenção, revisão e peças originais</span>
          </div>
        </div>
      </div>

      <!-- 3. IMPRESSORAS EM DESTAQUE (COM ABAS LIMPAS) -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">IMPRESSORAS 3D EM ESTOQUE</span>
            <h2>Bambu Lab &amp; Snapmaker</h2>
          </div>
          <div class="home-tabs-row" id="home-printer-tabs">
            <button type="button" class="home-tab-btn active" data-printer-tab="todas">Todas (6)</button>
            <button type="button" class="home-tab-btn" data-printer-tab="COMECE A CRIAR">Iniciantes &amp; Multicolor</button>
            <button type="button" class="home-tab-btn" data-printer-tab="EVOLUA SUA PRODUÇÃO">Produção</button>
            <button type="button" class="home-tab-btn" data-printer-tab="ALTA PERFORMANCE">Alta Performance</button>
            <button type="button" class="btn-compare-printers-pill" data-open-printer-compare="1">Comparar Modelos</button>
          </div>
        </div>

        <div class="combo-products-row" id="home-printers-grid">
          ${todasImpressoras.map((imp) => gerarCardHTML(imp)).join("")}
        </div>
      </div>

      <!-- 4. VITRINE CLEAN DE FILAMENTOS (SEM POLUIÇÃO NA CAPA — 2 PORTAIS DE MARCA + ATALHOS RÁPIDOS) -->
      <div class="home-section-block">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">FILAMENTOS 1.75 MM LACRADOS A VÁCUO</span>
            <h2>Filamentos Bambu Lab &amp; Masterprint</h2>
          </div>
          <button type="button" class="pdp-back-btn" data-home-go-cat="filamentos">Explorar Todas as +80 Cores →</button>
        </div>

        <div class="sj-home-fil-showcase-grid">
          <!-- Card 1: Masterprint -->
          <div class="sj-home-fil-brand-card" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-pla-maxprint">
            <div class="sj-home-fil-card-visual">
              <img src="assets/produtos/pla-maxprint.jpg" alt="Filamentos Masterprint" loading="lazy" />
              <span class="sj-home-fil-badge">REVENDEDOR AUTORIZADO • 68 CORES</span>
            </div>
            <div class="sj-home-fil-card-content">
              <div class="sj-home-fil-card-top">
                <h3>Filamentos Masterprint</h3>
                <p>Alta precisão dimensional (±0.02 mm), excelente aderência e zero bolhas para qualquer impressora 3D.</p>
              </div>
              <div class="sj-home-fil-chips" role="group" aria-label="Linhas Masterprint">
                <button type="button" class="sj-home-fil-chip" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-pla-maxprint">PLA (25)</button>
                <button type="button" class="sj-home-fil-chip" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-silk-maxprint">PLA Silk (17)</button>
                <button type="button" class="sj-home-fil-chip" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-petg-maxprint">PETG (9)</button>
                <button type="button" class="sj-home-fil-chip" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-tpu-maxprint">TPU Flex (7)</button>
                <button type="button" class="sj-home-fil-chip" data-home-fil-jump-brand="MaxPrint" data-home-fil-jump-mat="fil-abs-especiais">ABS &amp; Glitter (10)</button>
              </div>
              <div class="sj-home-fil-card-footer">
                <div class="sj-home-fil-price-box">
                  <small>A partir de</small>
                  <strong>R$ 79,90 <span>/ 1 kg</span></strong>
                </div>
                <span class="sj-home-fil-cta">Escolher Cores Masterprint →</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Bambu Lab RFID -->
          <div class="sj-home-fil-brand-card is-bambu" data-home-fil-jump-brand="Bambu Lab" data-home-fil-jump-bambu="todos">
            <div class="sj-home-fil-card-visual">
              <img src="assets/produtos/pla-bambulab.jpg" alt="Filamentos Bambu Lab RFID" loading="lazy" />
              <span class="sj-home-fil-badge bambu">CHIP RFID ORIGINAL • 13 CORES</span>
            </div>
            <div class="sj-home-fil-card-content">
              <div class="sj-home-fil-card-top">
                <h3>Filamentos Bambu Lab RFID</h3>
                <p>Reconhecimento automático de cor e parâmetros no AMS e AMS Lite. Disponível com bobina reutilizável ou Refil.</p>
              </div>
              <div class="sj-home-fil-chips" role="group" aria-label="Opções Bambu Lab">
                <button type="button" class="sj-home-fil-chip bambu" data-home-fil-jump-brand="Bambu Lab" data-home-fil-jump-bambu="carretel">Com Bobina RFID (10)</button>
                <button type="button" class="sj-home-fil-chip bambu" data-home-fil-jump-brand="Bambu Lab" data-home-fil-jump-bambu="refil">Refil s/ Bobina (3)</button>
                <button type="button" class="sj-home-fil-chip bambu" data-home-fil-jump-brand="Bambu Lab" data-home-fil-jump-bambu="todos">Ver Todos (13)</button>
              </div>
              <div class="sj-home-fil-card-footer">
                <div class="sj-home-fil-price-box">
                  <small>A partir de</small>
                  <strong>R$ 79,90 <span>/ 1 kg</span></strong>
                </div>
                <span class="sj-home-fil-cta bambu">Escolher Cores Bambu Lab →</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. PEÇAS DE REPOSIÇÃO & MANUTENÇÃO ESPECIALIZADA (BENTO CLEAN 2 COLUNAS) -->
      <div class="home-section-block">
        <div class="sj-home-bento-2col">
          <div class="sj-home-bento-card" data-home-go-cat="pecas">
            <div class="sj-home-bento-img">
              <img src="assets/produtos/peca-hotend.jpg" alt="Peças de Reposição e Upgrades" loading="lazy" />
            </div>
            <div class="sj-home-bento-body">
              <span class="home-eyebrow">COMPONENTES ORIGINAIS</span>
              <h3>Peças de Reposição &amp; Upgrades</h3>
              <p>Hotends Quick-Swap completos, Placas PEI Texturizadas Dupla Face e Tubos PTFE para linha Bambu Lab.</p>
              <span class="home-cat-cta">Ver Peças &amp; Acessórios →</span>
            </div>
          </div>

          <div class="sj-home-bento-card" data-home-go-cat="manutencao">
            <div class="sj-home-bento-img">
              <img src="assets/produtos/impressora-p2s_combo.jpg" alt="Serviços e Manutenção Especializada" loading="lazy" />
            </div>
            <div class="sj-home-bento-body">
              <span class="home-eyebrow">LABORATÓRIO TÉCNICO EM UMUARAMA</span>
              <h3>Serviços &amp; Manutenção 3D</h3>
              <p>Revisão preventiva, limpeza de extrusora, reparo de AMS/AMS Lite e calibração completa com garantia local.</p>
              <span class="home-cat-cta">Ver Serviços de Manutenção →</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. VITRINE DE PEÇAS DE REPOSIÇÃO & ACESSÓRIOS ORIGINAIS (DESTAQUES NA HOME) -->
      <div class="home-section-block" id="home-pecas-showcase">
        <div class="home-section-head">
          <div>
            <span class="home-eyebrow">COMPONENTES ORIGINAIS &amp; UPGRADES</span>
            <h2>Peças de Reposição em Destaque</h2>
          </div>
          <button type="button" class="pdp-back-btn" data-home-go-cat="pecas">Ver Todas as Peças (${todasPecas.length}) →</button>
        </div>

        <div class="combo-products-row" id="home-pecas-grid">
          ${pecasParaExibirHome.map((peca) => gerarCardHTML(peca)).join("")}
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <button type="button" class="btn-ver-todas-pecas-home" data-home-go-cat="pecas">
            ⚙️ Explorar Catálogo Completo de Peças &amp; Acessórios (${todasPecas.length} itens) →
          </button>
        </div>
      </div>
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

    // Clique nos cards e pílulas da Vitrine Clean de Filamentos na Capa -> abre direto a aba Filamentos naquela marca/material
    homeEl.querySelectorAll("[data-home-fil-jump-brand]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const marca = el.getAttribute("data-home-fil-jump-brand");
        const matMax = el.getAttribute("data-home-fil-jump-mat");
        const filtroBambu = el.getAttribute("data-home-fil-jump-bambu");
        if (marca) state.hubFilamentoMarcaAtiva = marca;
        if (matMax) state.hubFilamentoMaterialMaxPrint = matMax;
        if (filtroBambu) state.hubFilamentoFiltroBambu = filtroBambu;
        navegarParaCategoria("filamentos");
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

    // Vincula eventos dos cards de impressoras e peças na Home
    const printersGrid = document.getElementById("home-printers-grid");
    if (printersGrid) vincularEventosDosCards(printersGrid);

    const pecasGrid = document.getElementById("home-pecas-grid");
    if (pecasGrid) vincularEventosDosCards(pecasGrid);
  }

  function atualizarVisaoPrincipal() {
    const homeView = document.getElementById("home-landing-view");
    const pdpView = document.getElementById("product-detail-view");
    const gridView = document.getElementById("catalog-grid-view");
    const quoteView = document.getElementById("quote-studio-view");
    const clientView = document.getElementById("client-account-view");

    if (pdpView) pdpView.style.display = "none";
    state.produtoDetalheAtivo = null;

    if (quoteView) quoteView.style.display = "none";
    state.emissorAberto = false;

    if (state.categoriaMenu === "minha-conta") {
      if (homeView) homeView.style.display = "none";
      if (gridView) gridView.style.display = "none";
      if (clientView) {
        clientView.style.display = "block";
        renderizarAreaCliente();
      }
      atualizarCaixaLateral();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (clientView) clientView.style.display = "none";

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
      atualizarVisaoPrincipal();
      abrirGavetaPedido();
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
    const infoEl = document.getElementById("pdp-order-bar-text");
    if (infoEl) {
      infoEl.innerHTML = `<strong>✓ ${totalItens} ${totalItens === 1 ? "item no Seu Pedido" : "itens no Seu Pedido"
        }</strong>${valorTotal > 0 ? ` • Total: <strong>${formatarMoedaBR(valorTotal)}</strong>` : ""}`;
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

    let varDiamAtiva = null;
    if (item.variantesDiametro && item.variantesDiametro.length > 0) {
      varDiamAtiva =
        item.variantesDiametro.find((v) => v.diametro === opcao1Ativa) ||
        item.variantesDiametro[1] ||
        item.variantesDiametro[0];
      opcao1Ativa = varDiamAtiva.diametro;
      opcao2Ativa = varDiamAtiva.material;
      imgPrincipalSrc = varDiamAtiva.imagem;
    }

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

    // Tag do material no topo do card esquerdo (ex: PLA PRO, PETG PRO, BAMBU LAB RFID)
    let materialTagTxt = "FILAMENTO 3D";
    if (item.tipoFilamento) {
      if (isBambu) {
        materialTagTxt = "BAMBU LAB RFID";
      } else if (item.id === "fil-pla-maxprint") {
        materialTagTxt = "PLA PRO";
      } else if (item.id === "fil-silk-maxprint") {
        materialTagTxt = "PLA SILK";
      } else if (item.id === "fil-petg-maxprint") {
        materialTagTxt = "PETG PRO";
      } else if (item.id === "fil-tpu-maxprint") {
        materialTagTxt = "TPU FLEX";
      } else if (item.id === "fil-abs-especiais") {
        materialTagTxt = "ABS & GLITTER";
      } else {
        materialTagTxt = (item.nome || "").toUpperCase();
      }
    }

    // 1. BARRA TOPO DE MATERIAIS DE FILAMENTO (Estilo pílulas no topo da referência: PLA Pro | PETG Pro | PLA Silk ...)
    let barraTopoMateriaisHtml = "";
    if (item.tipoFilamento) {
      if (!isBambu) {
        barraTopoMateriaisHtml = `
          <div class="pdp-filament-top-material-bar">
            <div class="pdp-filament-top-pills" role="tablist" aria-label="Selecione o tipo de filamento">
              <button type="button" class="pdp-top-pill ${item.id === "fil-pla-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-pla-maxprint">
                PLA
              </button>
              <button type="button" class="pdp-top-pill ${item.id === "fil-silk-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-silk-maxprint">
                PLA Silk
              </button>
              <button type="button" class="pdp-top-pill ${item.id === "fil-petg-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-petg-maxprint">
                PETG
              </button>
              <button type="button" class="pdp-top-pill ${item.id === "fil-tpu-maxprint" ? "active" : ""}" data-pdp-switch-item="fil-tpu-maxprint">
                TPU Flex
              </button>
              <button type="button" class="pdp-top-pill ${item.id === "fil-abs-especiais" ? "active" : ""}" data-pdp-switch-item="fil-abs-especiais">
                ABS & Glitter
              </button>
            </div>
          </div>
        `;
      } else {
        barraTopoMateriaisHtml = `
          <div class="pdp-filament-top-material-bar">
            <div class="pdp-filament-top-pills" role="tablist" aria-label="Apresentação Bambu Lab">
              <button type="button" class="pdp-top-pill ${opcao1Ativa.includes("Carretel") ? "active" : ""}" data-pdp-sel1="1KG Carretel RFID">
                Com Bobina RFID (R$ 99,90)
              </button>
              <button type="button" class="pdp-top-pill ${opcao1Ativa.includes("Refil") ? "active" : ""}" data-pdp-sel1="1KG Refil RFID">
                Refil s/ Bobina (R$ 79,90)
              </button>
            </div>
          </div>
        `;
      }
    }

    // Seletores para produtos normais (impressoras, peças, etc.)
    let seletor1Html = "";
    if (!item.tipoFilamento) {
      if (item.variantesDiametro && item.variantesDiametro.length > 0) {
        seletor1Html = `
          <div class="pdp-option-group pdp-diam-selection-group">
            <div class="pdp-option-header">
              <span>Diâmetro do Bico:</span>
              <strong id="pdp-diam-active-title" class="pdp-diam-active-highlight">${varDiamAtiva.diametro} — ${varDiamAtiva.material}</strong>
            </div>
            <div class="pdp-diam-cards-grid" role="radiogroup" aria-label="Escolher diâmetro do bico">
              ${item.variantesDiametro
                .map(
                  (v) => `
                  <button
                    type="button"
                    class="pdp-diam-card-btn ${v.diametro === varDiamAtiva.diametro ? "active" : ""}"
                    data-pdp-diam-btn="${v.diametro}"
                    title="${v.diametro} (${v.material}) — ${v.destaque}"
                    aria-label="Bico ${v.diametro}"
                  >
                    <span class="pdp-diam-size">${v.diametro}</span>
                    <span class="pdp-diam-material">${v.material}</span>
                    <span class="pdp-diam-tag">${v.destaque}</span>
                  </button>
                `
                )
                .join("")}
            </div>

            <div class="pdp-diam-instruction-box" id="pdp-diam-instruction-box">
              <div class="pdp-diam-instruction-head">
                <span class="pdp-diam-instruction-badge">💡 Para que serve o bico <strong id="pdp-inst-diam-label">${varDiamAtiva.diametro}</strong>:</span>
                <span class="pdp-diam-mat-pill" id="pdp-inst-mat-label">${varDiamAtiva.material}</span>
              </div>
              <p class="pdp-diam-instruction-text" id="pdp-inst-text">${varDiamAtiva.instrucao}</p>
            </div>
          </div>
        `;
      } else {
        seletor1Html =
          opcoesSelect1 && opcoesSelect1.length > 1
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
    }

    // Seletor 2 (Paleta de Cores Circular Clean sem repetir dropdown abaixo)
    const seletor2Html =
      item.tipoFilamento && listaCores
        ? `
          <div class="pdp-option-group pdp-filament-color-group">
            <div class="pdp-option-header pdp-color-option-header">
              <div class="pdp-color-label-left">
                <span>Escolha a Cor (${listaCores.length}):</span>
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
                    data-tooltip="${cor.nome} • #${cor.cod} (${cor.preco})"
                    data-nome="${cor.nome}"
                    data-cod="${cor.cod}"
                    data-preco="${cor.preco}"
                    data-hex="${cor.hex}"
                    title="${cor.nome} — #${cor.cod} (${cor.preco})"
                    aria-label="${cor.nome} — #${cor.cod}"
                  ></button>
                `
          )
          .join("")}
            </div>

            <select class="pdp-color-dropdown" id="pdp-color-dropdown" aria-label="Lista completa de cores e códigos" style="display: none;">
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
        : item.select2Opcoes && item.select2Opcoes.length > 1 && !item.variantesDiametro
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

    // Sem botões redundantes "Rolo + Peça / Peça do Catálogo" nem miniatura repetida
    const thumbsHtml = "";

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

    // Outros produtos relacionados (apenas para Impressoras/Peças/Manutenção; Filamentos já possuem todas as cores e materiais na própria tela)
    const relacionados = item.tipoFilamento
      ? []
      : window.SITE_DATA.catalogo
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

      ${item.tipoFilamento ? `
        ${barraTopoMateriaisHtml}

        <!-- Grade Principal de 2 Colunas: Card Showcase Esquerdo + Card Configurador Direito -->
        <div class="pdp-main-grid is-filament-pdp">
          <!-- COLUNA ESQUERDA: CARD SHOWCASE DO PRODUTO (Estilo Ref. Usuário) -->
          <div class="pdp-filament-showcase-card">
            <div class="pdp-showcase-header">
              <span class="pdp-showcase-material-tag" id="pdp-showcase-material-tag">${materialTagTxt}</span>
              <span class="pdp-showcase-stock-pill" id="pdp-stock-status-badge">● Alto estoque</span>
            </div>

            <div class="pdp-showcase-img-wrap">
              ${codAtual ? `<span class="pdp-cod-floating" id="pdp-gallery-cod">${codAtual}</span>` : ""}
              <img
                src="${imgPrincipalSrc}"
                alt="${tituloPagina}"
                id="pdp-main-img"
                class="pdp-showcase-img cover-img"
                style="filter: ${filtroPrincipal};"
              />
            </div>

            <div class="pdp-showcase-footer">
              <strong class="pdp-showcase-color-name" id="pdp-showcase-color-name">${corAtiva ? corAtiva.nome : "Padrão"}</strong>
              <span class="pdp-showcase-spec-pill">1,75mm | 1kg</span>
            </div>
          </div>

          <!-- COLUNA DIREITA: CARD CONFIGURADOR ESCURO PREMIUM -->
          <div class="pdp-filament-config-card">
            <div class="pdp-filament-header">
              <h1 class="pdp-filament-title">${tituloPagina}</h1>
              <p class="pdp-filament-subtitle">${item.subtitulo || "O mais fácil de imprimir: alto rendimento, acabamento impecável e alta precisão dimensional para suas peças 3D."}</p>
            </div>

            <!-- SEÇÃO DE CORES -->
            <div class="pdp-filament-color-section">
              <div class="pdp-filament-color-head">
                <span class="pdp-filament-color-lbl">COR</span>
                <span class="pdp-filament-color-val" id="pdp-color-name-label">${corAtiva ? corAtiva.nome : ""}</span>
              </div>
              <div class="pdp-swatches-grid pdp-filament-swatches" id="pdp-swatches-grid" role="radiogroup" aria-label="Escolher cor do filamento">
                ${listaCores ? listaCores.map((cor, idx) => `
                  <button
                    type="button"
                    class="pdp-swatch-circle ${idx === idxCorAtiva ? "active" : ""}"
                    style="background-color: ${cor.hex};"
                    data-pdp-color-idx="${idx}"
                    data-tooltip="${cor.nome} • #${cor.cod} (${cor.preco})"
                    data-nome="${cor.nome}"
                    data-cod="${cor.cod}"
                    data-preco="${cor.preco}"
                    data-hex="${cor.hex}"
                    title="${cor.nome} — #${cor.cod} (${cor.preco})"
                    aria-label="${cor.nome} — #${cor.cod}"
                  ></button>
                `).join("") : ""}
              </div>
              <select class="pdp-color-dropdown" id="pdp-color-dropdown" aria-label="Lista completa de cores e códigos" style="display: none;">
                ${listaCores ? listaCores.map((cor, idx) => `
                  <option value="${idx}" ${idx === idxCorAtiva ? "selected" : ""}>
                    ${cor.nome} — CÓD. ${cor.cod} (${cor.preco})
                  </option>
                `).join("") : ""}
              </select>
            </div>

            <!-- ESPECIFICAÇÕES EM GRID (DIÂMETRO / PESO LÍQUIDO / PREÇO) -->
            <div class="pdp-filament-specs-grid">
              <div class="pdp-spec-box">
                <span class="pdp-spec-lbl">DIÂMETRO</span>
                <strong class="pdp-spec-val">1,75 mm</strong>
              </div>
              <div class="pdp-spec-box">
                <span class="pdp-spec-lbl">PESO LÍQUIDO</span>
                <strong class="pdp-spec-val">1 kg</strong>
              </div>
              <div class="pdp-spec-box pdp-spec-box-price">
                <span class="pdp-spec-lbl" id="pdp-price-label">PREÇO À VISTA</span>
                <strong class="pdp-spec-val pdp-spec-val-price" id="pdp-price-val">${precoTextoAtual}</strong>
                ${item.precoParcelado ? `<span class="pdp-spec-sub-price" id="pdp-price-sub-row">${item.precoParcelado}</span>` : ""}
              </div>
            </div>

            <!-- AÇÕES: STEPPER + BOTÃO ADICIONAR -->
            <div class="pdp-filament-actions-row">
              <div class="pdp-filament-stepper" aria-label="Quantidade">
                <button type="button" id="pdp-qty-dec" aria-label="Diminuir">−</button>
                <input type="number" id="pdp-qty-input" value="1" min="1" max="99" readonly aria-label="Quantidade selecionada" />
                <button type="button" id="pdp-qty-inc" aria-label="Aumentar">+</button>
              </div>

              <button type="button" class="pdp-filament-btn-add" id="pdp-btn-add">
                Adicionar ao pedido — <span id="pdp-btn-add-price">${precoUnitarioAtual > 0 ? formatarMoedaBR(precoUnitarioAtual) : precoTextoAtual}</span>
              </button>
            </div>

            <div class="pdp-filament-footer-note">
              <span>Pedidos em volume para revenda ou atacado: <button type="button" id="pdp-btn-buy-now" class="pdp-filament-wpp-btn">fale conosco no WhatsApp</button></span>
            </div>

            <!-- Barra de Resumo do Pedido -->
            <div class="pdp-order-bar" id="pdp-order-bar" style="display: none;">
              <span id="pdp-order-bar-text"></span>
              <div class="pdp-order-bar-actions">
                <button type="button" class="pdp-order-bar-btn" id="pdp-view-order-btn">Ver Meu Pedido →</button>
              </div>
            </div>
          </div>
        </div>

        <div class="pdp-trust-strip pdp-filament-trust-strip">
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
      ` : `
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
            <span class="pdp-brand-badge">${marcaAtual === "MaxPrint" ? "Masterprint" : marcaAtual}</span>
            <span class="pdp-stock-status" id="pdp-stock-status-badge">● Em estoque para envio / retirada</span>
          </div>

          <h1 class="pdp-title">${tituloPagina}</h1>
          ${item.categoria === "pecas" ? `
            <div class="pdp-peca-meta-box">
              <span class="pdp-peca-area-tag">📍 Área: ${escaparHtml(item.area || "Componente Original")}</span>
              <span class="pdp-peca-compat-tag">⚙️ Compatível com: ${escaparHtml(item.compatibilidade || item.select2Opcoes?.[0] || "Bambu Lab")}</span>
            </div>
            <div class="pdp-peca-funcao-block">
              <span class="pdp-peca-funcao-lbl">Para que serve esta peça:</span>
              <p class="pdp-peca-funcao-desc">${escaparHtml(item.paraQueServe || item.subtitulo || "")}</p>
            </div>
          ` : `
            <p class="pdp-subtitle">${item.subtitulo}</p>
          `}

          <!-- Bloco de Preço -->
          ${item.categoria === "pecas" ? `
            <div class="pdp-price-card pdp-price-card-peca">
              <div class="pdp-price-main-row">
                <span class="pdp-price-label">DISPONIBILIDADE</span>
                <strong class="pdp-price-value" style="font-size:1.22rem; color:var(--sj-orange);">Sob Consulta de Estoque</strong>
              </div>
              <div class="pdp-price-sub-row">Peça para reposição e upgrade • Consulte pronta entrega no WhatsApp</div>
            </div>
          ` : `
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
          `}

          <!-- Seletores Interativos -->
          ${seletor2Html}
          ${seletor1Html}

          <!-- Quantidade + Botões de Ação -->
          <div class="pdp-actions-block">
            <div class="pdp-qty-and-add">
              <div class="pdp-qty-stepper" aria-label="Quantidade">
                <button type="button" id="pdp-qty-dec" aria-label="Diminuir">−</button>
                <input type="number" id="pdp-qty-input" value="1" min="1" max="99" readonly aria-label="Quantidade selecionada" />
                <button type="button" id="pdp-qty-inc" aria-label="Aumentar">+</button>
              </div>

              <button type="button" class="pdp-btn-add" id="pdp-btn-add">
                ${item.categoria === "pecas" ? "Adicionar ao Orçamento" : `Adicionar ao Pedido ${precoUnitarioAtual > 0 ? `— ${formatarMoedaBR(precoUnitarioAtual)}` : ""}`}
              </button>
            </div>

            <div class="pdp-secondary-actions-row">
              <button type="button" class="pdp-btn-whatsapp-now" id="pdp-btn-buy-now" style="display:inline-flex; align-items:center; justify-content:center; gap:7px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>${item.categoria === "pecas" ? "Consultar Peça no WhatsApp" : "Comprar Agora pelo WhatsApp"}</span>
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
      `}

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
        colorLabelEl.textContent = item.tipoFilamento ? corAtiva.nome : `${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})`;
      }

      const showcaseColorEl = document.getElementById("pdp-showcase-color-name");
      if (showcaseColorEl && corAtiva) {
        showcaseColorEl.textContent = corAtiva.nome;
      }

      const dotIndicatorEl = document.getElementById("pdp-color-dot-indicator");
      if (dotIndicatorEl && corAtiva) {
        dotIndicatorEl.style.backgroundColor = corAtiva.hex;
      }

      const addBtnEl = document.getElementById("pdp-btn-add");
      const stickyAddBtnEl = document.getElementById("pdp-sticky-add-btn");
      const pdpStockBadgeEl = document.getElementById("pdp-stock-status-badge");
      const statusEstoquePdp =
        (corAtiva && corAtiva.estoqueStatus) || item.estoqueStatus || "disponivel";

      if (pdpStockBadgeEl) {
        if (item.tipoFilamento) {
          pdpStockBadgeEl.className = `pdp-showcase-stock-pill pdp-stock-status status-${statusEstoquePdp}`;
          if (statusEstoquePdp === "esgotado") {
            pdpStockBadgeEl.textContent = "🔴 Esgotado";
          } else if (statusEstoquePdp === "poucas_unidades") {
            pdpStockBadgeEl.textContent = "🟠 Poucas unidades";
          } else {
            pdpStockBadgeEl.textContent = "● Alto estoque";
          }
        } else {
          pdpStockBadgeEl.className = `pdp-stock-status status-${statusEstoquePdp}`;
          if (statusEstoquePdp === "esgotado") {
            pdpStockBadgeEl.textContent = "🔴 Esgotado no momento — Consulte previsão no WhatsApp";
          } else if (statusEstoquePdp === "poucas_unidades") {
            pdpStockBadgeEl.textContent = "🟠 Poucas unidades — Últimas peças em estoque!";
          } else {
            pdpStockBadgeEl.textContent = "● Em estoque para envio / retirada";
          }
        }
      }

      const addBtnPriceEl = document.getElementById("pdp-btn-add-price");
      if (addBtnEl) {
        if (statusEstoquePdp === "esgotado") {
          addBtnEl.disabled = true;
          addBtnEl.classList.add("btn-out-of-stock");
          addBtnEl.textContent = "🔴 Esgotado no Momento";
        } else {
          addBtnEl.disabled = false;
          addBtnEl.classList.remove("btn-out-of-stock");
          if (addBtnPriceEl) {
            addBtnPriceEl.textContent = precoUnit > 0 ? formatarMoedaBR(precoUnit * qtdAtiva) : precoTxt;
          } else {
            addBtnEl.textContent =
              precoUnit > 0
                ? `Adicionar ao Pedido — ${formatarMoedaBR(precoUnit * qtdAtiva)}`
                : "Adicionar ao Pedido";
          }
        }
      }

      if (stickyAddBtnEl) {
        if (statusEstoquePdp === "esgotado") {
          stickyAddBtnEl.disabled = true;
          stickyAddBtnEl.classList.add("btn-out-of-stock");
          stickyAddBtnEl.textContent = "🔴 Esgotado";
        } else {
          stickyAddBtnEl.disabled = false;
          stickyAddBtnEl.classList.remove("btn-out-of-stock");
          stickyAddBtnEl.textContent = "+ Adicionar";
        }
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

    // Interação com a troca de diâmetro em Peças (Hotends Bambu Lab 0.2, 0.4, 0.6, 0.8 mm)
    if (item.variantesDiametro && item.variantesDiametro.length > 0) {
      pdpView.querySelectorAll("[data-pdp-diam-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const diam = btn.dataset.pdpDiamBtn;
          const v = item.variantesDiametro.find((x) => x.diametro === diam);
          if (!v) return;

          varDiamAtiva = v;
          opcao1Ativa = v.diametro;
          opcao2Ativa = v.material;

          pdpView.querySelectorAll("[data-pdp-diam-btn]").forEach((b) => {
            b.classList.toggle("active", b === btn);
          });

          const mainImg = document.getElementById("pdp-main-img");
          if (mainImg && v.imagem) {
            mainImg.src = v.imagem;
            mainImg.style.filter = "none";
          }

          const activeTitleEl = document.getElementById("pdp-diam-active-title");
          if (activeTitleEl) {
            activeTitleEl.textContent = `${v.diametro} — ${v.material}`;
          }

          const instDiamLbl = document.getElementById("pdp-inst-diam-label");
          if (instDiamLbl) instDiamLbl.textContent = v.diametro;

          const instMatLbl = document.getElementById("pdp-inst-mat-label");
          if (instMatLbl) instMatLbl.textContent = v.material;

          const instTxtEl = document.getElementById("pdp-inst-text");
          if (instTxtEl) instTxtEl.textContent = v.instrucao;

          sincronizarEstadoPDP();
        });
      });
    }

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
          colorLabelEl.textContent = item.tipoFilamento ? nome : `${nome} — CÓD. ${cod} (${preco})`;
        }
        const showcaseColorEl = document.getElementById("pdp-showcase-color-name");
        if (showcaseColorEl && nome) {
          showcaseColorEl.textContent = nome;
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
          colorLabelEl.textContent = item.tipoFilamento ? corAtiva.nome : `${corAtiva.nome} — CÓD. ${corAtiva.cod} (${corAtiva.preco})`;
        }
        const showcaseColorEl = document.getElementById("pdp-showcase-color-name");
        if (showcaseColorEl) {
          showcaseColorEl.textContent = corAtiva.nome;
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

      if (item.categoria === "pecas") {
        const diamMsg = item.variantesDiametro
          ? `\n• *Diâmetro do Bico:* ${opcao1Ativa} (${opcao2Ativa})`
          : `\n• *Opção / Modelo:* ${opcao1Ativa || opcao2Ativa || "Padrão"}`;
        const msgPeca = encodeURIComponent(
          `Olá *Loja SJ 3D*! Gostaria de consultar a disponibilidade e valores da peça:\n\n` +
          `• *Peça:* ${tituloPagina}${diamMsg}\n\n` +
          `Vocês têm a pronta entrega na loja de Umuarama?`
        );
        window.open(`https://wa.me/${whatsapp}?text=${msgPeca}`, "_blank");
        return;
      }

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

  function ehUsuarioEquipe(u) {
    if (!u) return false;
    const cargo = String(u.cargo || "").toLowerCase();
    const tipo = String(u.tipo || "").toLowerCase();
    const email = String(u.email || "").toLowerCase();
    if (tipo === "cliente" || cargo === "cliente") return false;
    if (!email) return false;
    // Só é equipe quem está APROVADO na tabela administrativa (SJ_DB.auth)
    if (u.status && u.status !== "aprovado") return false;
    if (u.ativo === false) return false;
    if (window.SJ_DB && window.SJ_DB.auth && typeof window.SJ_DB.auth.listarUsuarios === "function") {
      const registro = (window.SJ_DB.auth.listarUsuarios() || []).find(
        (r) => String(r.email || "").toLowerCase() === email
      );
      return Boolean(registro && registro.status === "aprovado");
    }
    return email === "jt.designer21@gmail.com";
  }

  // Carrega operador / vendedor salvo localmente ou via Banco de Dados
  function carregarUsuarioGoogle() {
    function filtrarApenasEquipe(u) {
      return (u && ehUsuarioEquipe(u)) ? u : null;
    }

    if (window.SJ_DB && window.SJ_DB.auth) {
      state.usuarioGoogle = filtrarApenasEquipe(window.SJ_DB.auth.getUsuarioAtual());
      window.SJ_DB.auth.onAuthStateChanged((u) => {
        state.usuarioGoogle = filtrarApenasEquipe(u);
        atualizarBadgeUsuarioHeader();
      });
    } else {
      try {
        const raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY_GOOGLE_USER);
        if (raw) {
          state.usuarioGoogle = filtrarApenasEquipe(JSON.parse(raw));
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

    // SÓ ativa modo admin se houver operador administrativo legítimo da equipe
    const ehAdmin = Boolean(state.usuarioGoogle && ehUsuarioEquipe(state.usuarioGoogle));

    document.body.classList.toggle("is-admin-logged-in", ehAdmin);

    if (!ehAdmin) {
      // Usuário NÃO é admin (ou é cliente comum) -> Site 100% público e limpo (sem barra nem botão de orçamento)
      if (adminTopbar) adminTopbar.style.display = "none";
      if (cartQuoteBtn) cartQuoteBtn.style.display = "none";
      if (drawerQuoteBtn) drawerQuoteBtn.style.display = "none";
    } else {
      // Vendedor / Administrador AUTENTICADO -> Exibe a Barra Administrativa
      const u = state.usuarioGoogle;
      if (adminTopbar) adminTopbar.style.display = "block";
      if (cartQuoteBtn) cartQuoteBtn.style.display = "flex";
      if (drawerQuoteBtn) drawerQuoteBtn.style.display = "flex";
      if (nameEl) nameEl.textContent = u.nome || "Administrador";
      if (roleEl) roleEl.textContent = u.cargo || "Administrador";
      // Atualiza aviso de solicitações pendentes (sincroniza com a nuvem)
      if (window.SJ_DB && window.SJ_DB.auth && typeof window.SJ_DB.auth.sincronizarEquipeNuvem === "function") {
        window.SJ_DB.auth.sincronizarEquipeNuvem()
          .then((lista) => atualizarBadgesSolicitacoesPendentes(lista))
          .catch(() => {});
      }
    }
  }

  // Sincronização oficial da sessão Supabase com o portal do Cliente e Área Restrita
  window.addEventListener("sj-auth-state-changed", (evt) => {
    const u = evt.detail?.usuario;
    if (!u) return;

    if (!u.ehEquipe) {
      // 1. USUÁRIO É CLIENTE (Login Google ou Cadastro Normal na Loja)
      const salvoDb = buscarDadosClienteSalvoPorEmail(u.email) || {};
      const atualLocal =
        state.clienteLogado && String(state.clienteLogado.email || "").toLowerCase() === String(u.email || "").toLowerCase()
          ? state.clienteLogado
          : {};

      const clienteData = {
        ...salvoDb,
        ...atualLocal,
        id: u.id || salvoDb.id || atualLocal.id || ("cli-" + Date.now()),
        nome: atualLocal.nome || salvoDb.nome || u.nome,
        email: u.email,
        foto: u.foto || atualLocal.foto || salvoDb.foto || null,
        whatsapp: atualLocal.whatsapp || salvoDb.whatsapp || u.whatsapp || "",
        cpf: atualLocal.cpf || salvoDb.cpf || salvoDb.cnpjCpf || "",
        cnpjCpf: atualLocal.cnpjCpf || salvoDb.cnpjCpf || atualLocal.cpf || "",
        tipo: "cliente"
      };

      const precisaNf = Boolean(state.precisaNotaFiscalPedido || clienteData.precisaNotaFiscal);
      const validacao = validarDadosCliente(clienteData, precisaNf);
      clienteData.cadastroAprovado = validacao.valido;

      salvarClienteLocal(clienteData);

      // Garante que o cliente NÃO tenha nenhum privilégio de administrador
      state.usuarioGoogle = null;
      atualizarBadgeUsuarioHeader();

      if (!validacao.valido) {
        abrirModalAuthCliente("complete", {
          preMarcarNf: precisaNf,
          mensagemTopo: `✅ Conta Google conectada (${u.email})! Complete seu WhatsApp, CPF/CNPJ e dados de Nota Fiscal (se precisar) para aprovar seu cadastro.`
        });
      } else {
        fecharModalAuthCliente();
      }
    } else {
      // 2. USUÁRIO É EQUIPE / ADMINISTRADOR (Entrou pela Área Restrita)
      state.usuarioGoogle = u;
      atualizarBadgeUsuarioHeader();
      fecharModalAuthGoogle();
    }
  });

  function renderizarChipsVendedoresRapidos() {
    // Acesso rápido sem senha foi desativado por segurança (somente login com senha na Área Restrita)
    const container = document.getElementById("quick-saved-operators");
    if (container) container.innerHTML = "";
    return;
    // eslint-disable-next-line no-unreachable
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

  function abrirModalAuthGoogle(callbackApos = null, abaInicial = "email") {
    state.callbackPosLoginGoogle = callbackApos;
    const modal = document.getElementById("modal-google-auth");
    if (modal) modal.style.display = "flex";

    const feedbackBox = document.getElementById("auth-feedback-box");
    if (feedbackBox) feedbackBox.style.display = "none";

    selecionarAbaModalAuth(abaInicial || "email");

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
  // Login Google NUNCA concede acesso administrativo (Área Restrita exige e-mail + senha aprovados)
  window.onGoogleSignInSuccess = function() {
    mostrarFeedbackAuth("error", "A Área Restrita aceita apenas login com e-mail e senha de administrador autorizado.");
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

    // Popula datalist de clientes salvos com documento mascarado (LGPD)
    const datalist = document.getElementById("wiz-clients-datalist");
    if (datalist && window.SJ_DB && window.SJ_DB.clientes) {
      const listaCli = window.SJ_DB.clientes.listar() || [];
      datalist.innerHTML = listaCli
        .map((c) => `<option value="${c.nome}">${c.cnpjCpf ? ` (${mascararCpfCnpj(c.cnpjCpf)})` : ""}</option>`)
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
    const executar = () => abrirAssistenteOrcamento(itensIniciais);
    if (window.SJ_SUPABASE) {
      window.SJ_SUPABASE.guardiao.validarAcessoRota("#orcamento", executar, () => {
        abrirModalAuthGoogle(executar);
      });
      return;
    }
    if (!state.usuarioGoogle) {
      abrirModalAuthGoogle(executar);
      return;
    }
    executar();
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
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

    aplicarMascaraCpfCnpj(document.getElementById("client-cnpj-cpf"));

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

        // Validação de tipo e tamanho
        if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
          mostrarToast("Formato inválido. Selecione um arquivo de backup no formato .json.", "warning");
          fileInp.value = "";
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          mostrarToast("Arquivo muito grande. O tamanho máximo permitido para backup é de 5 MB.", "warning");
          fileInp.value = "";
          return;
        }

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
          fileInp.value = "";
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
    estoqueFiltro: "todos",
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

  // Valida e comprime imagem enviada pelo computador/celular via HTML5 Canvas
  function comprimirImagemUpload(file, maxWidth = 900, quality = 0.84) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error("Nenhum arquivo selecionado"));
      }

      // Validação estrita de tipo MIME seguro (proíbe SVGs executáveis, scripts e binários)
      const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
      const fileType = (file.type || "").toLowerCase();
      if (!TIPOS_PERMITIDOS.includes(fileType)) {
        return reject(new Error("Formato inválido. Apenas imagens JPG, PNG ou WEBP são permitidas."));
      }

      // Limite de tamanho máximo: 8 MB
      const TAMANHO_MAX = 8 * 1024 * 1024;
      if (file.size > TAMANHO_MAX) {
        return reject(new Error("Imagem muito pesada. O tamanho máximo permitido é de 8 MB."));
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
        img.onerror = () => reject(new Error("Arquivo corrompido ou formato de imagem não renderizável."));
        img.src = ev.target.result;
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
      reader.readAsDataURL(file);
    });
  }

  // =========================================================================
  // MÓDULO 1: GERADOR E IMPRESSÃO DE QR CODE (ETIQUETAS DO PRODUTO & CARTELA)
  // =========================================================================

  function gerarQrSvgOuCanvas(texto, tamanho = 120) {
    if (typeof qrcode === "function") {
      try {
        const qr = qrcode(0, "M");
        qr.addData(String(texto));
        qr.make();
        return qr.createSvgTag({ scalable: true, margin: 1 });
      } catch (err) {
        console.warn("[QR Code] Falha no qrcode-generator, gerando fallback SVG:", err);
      }
    }
    // Fallback visual limpo
    return `
      <svg viewBox="0 0 100 100" width="${tamanho}" height="${tamanho}" style="display:block; max-width:100%;">
        <rect width="100" height="100" fill="#fff" />
        <rect x="8" y="8" width="28" height="28" fill="#18181b" />
        <rect x="14" y="14" width="16" height="16" fill="#fff" />
        <rect x="18" y="18" width="8" height="8" fill="#F04E23" />
        <rect x="64" y="8" width="28" height="28" fill="#18181b" />
        <rect x="70" y="14" width="16" height="16" fill="#fff" />
        <rect x="74" y="18" width="8" height="8" fill="#F04E23" />
        <rect x="8" y="64" width="28" height="28" fill="#18181b" />
        <rect x="14" y="70" width="16" height="16" fill="#fff" />
        <rect x="18" y="74" width="8" height="8" fill="#F04E23" />
        <rect x="44" y="44" width="12" height="12" fill="#18181b" />
        <rect x="64" y="64" width="10" height="10" fill="#18181b" />
        <rect x="78" y="78" width="14" height="14" fill="#18181b" />
      </svg>
    `;
  }

  function renderizarQrCodeHtml(container, texto, tamanho = 120) {
    if (!container) return;
    const svgTag = gerarQrSvgOuCanvas(texto, tamanho);
    container.innerHTML = svgTag;
    const svgEl = container.querySelector("svg");
    if (svgEl) {
      svgEl.style.width = "100%";
      svgEl.style.height = "100%";
      svgEl.style.display = "block";
    }
  }

  function imprimirEtiquetaQrIndividual(item) {
    if (!item) return;
    const incluirPreco = document.getElementById("chk-cms-qr-print-price")?.checked !== false;
    const payload = item.qrPayload || (item.tipo === "cor" ? `SJ3D:FIL:${item.produtoId}:${item.codigo}` : `SJ3D:PROD:${item.id}`);
    const qrSvg = gerarQrSvgOuCanvas(payload, 150);

    const win = window.open("", "_blank", "width=600,height=650");
    if (!win) {
      alert("Por favor, permita pop-ups no navegador para imprimir a etiqueta.");
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Etiqueta QR Code - ${item.nome || "Produto Loja SJ"}</title>
        <style>
          @page { size: auto; margin: 8mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0; padding: 12px; display: flex; justify-content: center;
          }
          .etiqueta-box {
            width: 72mm; min-height: 48mm; border: 2px dashed #3f3f46; border-radius: 8px;
            padding: 10px; display: flex; flex-direction: column; align-items: center;
            text-align: center; box-sizing: border-box; background: #fff;
          }
          .header-loja { font-size: 11px; font-weight: 900; letter-spacing: 0.5px; color: #F04E23; text-transform: uppercase; }
          .nome-item { font-size: 13px; font-weight: 800; color: #111827; margin: 4px 0 2px; line-height: 1.25; }
          .codigo-item { font-size: 11px; font-weight: 800; color: #6b7280; font-family: monospace; }
          .qr-wrap { width: 34mm; height: 34mm; margin: 6px auto; display: flex; align-items: center; justify-content: center; }
          .qr-wrap svg { width: 100%; height: 100%; }
          .preco-box { font-size: 16px; font-weight: 900; color: #111827; }
          .pix-tag { font-size: 9px; font-weight: 700; color: #16a34a; }
          .footer-info { font-size: 8px; color: #71717a; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="etiqueta-box">
          <div class="header-loja">LOJA SJ 3D • UMUARAMA PR</div>
          <div class="nome-item">${item.nome || "Produto"}</div>
          <div class="codigo-item">${item.codigo ? String(item.codigo).toUpperCase() : `CÓD. ${item.id}`}</div>
          <div class="qr-wrap">${qrSvg}</div>
          ${incluirPreco && item.preco ? `
            <div class="preco-box">${item.preco}</div>
            <div class="pix-tag">5% OFF NO PIX • GARANTIA OFICIAL</div>
          ` : ""}
          <div class="footer-info">Bipe com o Leitor QR da Loja SJ 3D</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  function imprimirCartelaQrCodes(listaItens) {
    if (!Array.isArray(listaItens) || listaItens.length === 0) {
      alert("Nenhum item selecionado para imprimir cartela.");
      return;
    }
    const incluirPreco = document.getElementById("chk-cms-qr-print-price")?.checked !== false;

    const win = window.open("", "_blank", "width=900,height=900");
    if (!win) {
      alert("Por favor, permita pop-ups no navegador para imprimir a cartela.");
      return;
    }

    const htmlCards = listaItens.map((item) => {
      const payload = item.qrPayload || (item.tipo === "cor" ? `SJ3D:FIL:${item.produtoId}:${item.codigo}` : `SJ3D:PROD:${item.id}`);
      const qrSvg = gerarQrSvgOuCanvas(payload, 100);
      return `
        <div class="cartela-card">
          <div class="card-loja">LOJA SJ 3D</div>
          <div class="card-nome">${item.nome || "Produto"}</div>
          <div class="card-cod">${item.codigo ? String(item.codigo).toUpperCase() : `CÓD. ${item.id}`}</div>
          <div class="card-qr">${qrSvg}</div>
          ${incluirPreco && item.preco ? `
            <div class="card-preco">${item.preco}</div>
          ` : ""}
        </div>
      `;
    }).join("");

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Cartela de Etiquetas QR Code - Loja SJ 3D</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0; padding: 0; background: #fff;
          }
          .cartela-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6mm;
          }
          .cartela-card {
            border: 1.5px dashed #71717a; border-radius: 6px; padding: 8px;
            display: flex; flex-direction: column; align-items: center; text-align: center;
            page-break-inside: avoid;
          }
          .card-loja { font-size: 9px; font-weight: 900; color: #F04E23; letter-spacing: 0.5px; }
          .card-nome { font-size: 11px; font-weight: 800; color: #111827; margin: 3px 0 1px; max-height: 28px; overflow: hidden; line-height: 1.2; }
          .card-cod { font-size: 10px; font-weight: 800; color: #6b7280; font-family: monospace; }
          .card-qr { width: 28mm; height: 28mm; margin: 4px auto; display: flex; align-items: center; justify-content: center; }
          .card-qr svg { width: 100%; height: 100%; }
          .card-preco { font-size: 13px; font-weight: 900; color: #111827; }
        </style>
      </head>
      <body>
        <div class="cartela-grid">
          ${htmlCards}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  // =========================================================================
  // MÓDULO 2: CÂMERA AO VIVO LEITOR DE QR CODE (ANDROID & IOS SAFARI COMPATÍVEL)
  // =========================================================================

  let cameraQrStream = null;
  let cameraQrAnimationId = null;
  let cameraFacingMode = "environment";

  async function iniciarCameraLeitorQr() {
    const box = document.getElementById("cms-qr-camera-box");
    const video = document.getElementById("cms-qr-video");
    const statusText = document.getElementById("cms-qr-camera-status");
    if (!box || !video) return;

    box.style.display = "block";
    if (statusText) statusText.textContent = "Conectando à câmera do dispositivo...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (statusText) statusText.textContent = "Câmera não suportada neste navegador. Utilize a busca por código logo abaixo.";
      return;
    }

    try {
      pararCameraLeitorQr(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      cameraQrStream = stream;
      video.srcObject = stream;
      await video.play();
      if (statusText) statusText.textContent = "Aponte para o QR Code do produto. A leitura é instantânea!";
      iniciarLoopLeituraQr();
    } catch (err) {
      console.warn("[Câmera QR] Erro ao abrir câmera:", err);
      if (statusText) {
        statusText.innerHTML = `⚠️ Não foi possível abrir a câmera (${err.name || "Acesso negado"}). Digite o código na barra de busca abaixo.`;
      }
    }
  }

  function pararCameraLeitorQr(esconderBox = true) {
    if (cameraQrAnimationId) {
      cancelAnimationFrame(cameraQrAnimationId);
      cameraQrAnimationId = null;
    }
    if (cameraQrStream) {
      cameraQrStream.getTracks().forEach((t) => t.stop());
      cameraQrStream = null;
    }
    const video = document.getElementById("cms-qr-video");
    if (video) video.srcObject = null;
    if (esconderBox) {
      const box = document.getElementById("cms-qr-camera-box");
      if (box) box.style.display = "none";
    }
  }

  function iniciarLoopLeituraQr() {
    const video = document.getElementById("cms-qr-video");
    const canvas = document.getElementById("cms-qr-canvas");
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let detectorNativo = null;
    if ("BarcodeDetector" in window) {
      try {
        detectorNativo = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch (_) {}
    }

    let ultimoProcessamento = 0;

    async function tick(tempoAtual) {
      if (!cameraQrStream) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA && (tempoAtual - ultimoProcessamento > 140)) {
        ultimoProcessamento = tempoAtual;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let payloadLido = null;

        if (detectorNativo) {
          try {
            const barcodes = await detectorNativo.detect(canvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              payloadLido = barcodes[0].rawValue;
            }
          } catch (_) {}
        }

        if (!payloadLido && typeof jsQR === "function") {
          try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert"
            });
            if (code && code.data) {
              payloadLido = code.data;
            }
          } catch (_) {}
        }

        if (payloadLido) {
          processarLeituraQrCode(payloadLido);
          pararCameraLeitorQr(true);
          return;
        }
      }

      cameraQrAnimationId = requestAnimationFrame(tick);
    }

    cameraQrAnimationId = requestAnimationFrame(tick);
  }

  function processarLeituraQrCode(rawPayload) {
    const limpo = String(rawPayload || "").trim();
    if (!limpo) return;

    // Beep sonoro amigável do leitor
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (_) {}

    // Vibração háptica no celular
    if (navigator.vibrate) {
      try { navigator.vibrate(80); } catch (_) {}
    }

    mostrarToast(`📷 QR Code lido com sucesso: <strong>${limpo}</strong>`, "success");

    // Identifica se é do tipo SJ3D:PROD:xxx ou SJ3D:FIL:xxx:cod ou busca livre
    let buscaTexto = limpo;
    if (limpo.startsWith("SJ3D:PROD:")) {
      buscaTexto = limpo.replace("SJ3D:PROD:", "");
    } else if (limpo.startsWith("SJ3D:FIL:")) {
      const partes = limpo.split(":");
      buscaTexto = partes[3] || partes[2] || limpo;
    }

    const input = document.getElementById("cms-price-lookup-input");
    if (input) input.value = buscaTexto;

    executarConsultaPreco(buscaTexto, true);
  }

  // =========================================================================
  // MÓDULO 3: CONSULTA DE PREÇO INSTANTÂNEA & GRADE DO VENDEDOR
  // =========================================================================

  let consultaQrState = {
    categoria: "todos",
    busca: "",
    itemSelecionado: null
  };

  function obterListaTodosItensCatalogoParaConsulta() {
    const catalogo = (window.SITE_DATA && window.SITE_DATA.catalogo) || [];
    const listaCompleta = [];

    catalogo.forEach((p) => {
      listaCompleta.push({
        tipo: "produto",
        id: p.id,
        produtoId: p.id,
        nome: p.nome,
        subtitulo: p.subtitulo || "",
        categoria: p.categoria || "outros",
        marca: p.marca || "Loja SJ 3D",
        codigo: p.id,
        preco: p.precoVista,
        precoValor: p.precoVistaValor || extrairNumeroDePrecoBR(p.precoVista),
        precoParcelado: p.precoParcelado || "",
        estoqueStatus: p.estoqueStatus || "disponivel",
        imagem: p.imagem || "assets/produtos/impressora-a1_mini.jpg",
        qrPayload: `SJ3D:PROD:${p.id}`
      });

      // Se tiver paleta de filamento, adiciona cada cor individualmente com seu código exclusivo
      const chavePaleta = p.tipoFilamento ? mapearChavePaletaSiteData(p.usaCoresDinamicas) : null;
      if (chavePaleta && Array.isArray(window.SITE_DATA[chavePaleta])) {
        window.SITE_DATA[chavePaleta].forEach((c, cIdx) => {
          listaCompleta.push({
            tipo: "cor",
            id: `${p.id}-${c.cod || cIdx}`,
            produtoId: p.id,
            nome: `${p.nome} — ${c.nome}`,
            subtitulo: `Linha ${p.nome} • Cor ${c.nome}`,
            categoria: "cores",
            marca: p.marca || "Loja SJ 3D",
            codigo: c.cod ? `CÓD. ${c.cod}` : `COR ${cIdx + 1}`,
            codNumero: String(c.cod || ""),
            corNome: c.nome,
            corHex: c.hex || "#F04E23",
            preco: c.preco || p.precoVista,
            precoValor: c.valor || extrairNumeroDePrecoBR(c.preco || p.precoVista),
            precoParcelado: p.precoParcelado || "",
            estoqueStatus: c.estoqueStatus || p.estoqueStatus || "disponivel",
            imagem: c.imgCatalogo || p.imagem || "assets/produtos/pla-maxprint.jpg",
            qrPayload: `SJ3D:FIL:${p.id}:${c.cod || c.nome}`
          });
        });
      }
    });

    return listaCompleta;
  }

  function renderizarSpotlightPreco(item) {
    const card = document.getElementById("cms-price-lookup-spotlight");
    if (!card) return;
    if (!item) {
      card.style.display = "none";
      card.innerHTML = "";
      return;
    }

    const valorNum = item.precoValor || extrairNumeroDePrecoBR(item.preco);
    const precoPix = valorNum > 0 ? (valorNum * 0.95).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : item.preco;
    const st = item.estoqueStatus || "disponivel";
    const statusMap = {
      disponivel: { label: "🟢 EM ESTOQUE (PRONTA ENTREGA)", bg: "#166534" },
      poucas_unidades: { label: "🟠 POUCAS UNIDADES (ÚLTIMAS PEÇAS)", bg: "#b45309" },
      esgotado: { label: "🔴 ESGOTADO (INDISPONÍVEL)", bg: "#b91c1c" }
    };
    const stBadge = statusMap[st] || statusMap.disponivel;

    card.style.display = "block";
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:${stBadge.bg}; color:#fff; font-size:0.72rem; font-weight:800; padding:3px 10px; border-radius:999px;">
            ${stBadge.label}
          </span>
          <span style="font-family:monospace; background:rgba(255,255,255,0.14); padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">
            ${item.codigo ? String(item.codigo).toUpperCase() : item.id}
          </span>
        </div>
        <button type="button" id="btn-cms-close-spotlight" style="background:transparent; border:none; color:#a1a1aa; font-size:1.1rem; cursor:pointer;" title="Fechar consulta">&times;</button>
      </div>

      <div style="display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center;" class="spotlight-body-grid">
        <div style="width:110px; height:110px; border-radius:12px; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <img src="${item.imagem}" alt="${item.nome}" style="width:100%; height:100%; object-fit:contain; padding:4px;" />
        </div>

        <div>
          <div style="font-size:0.78rem; color:#F04E23; font-weight:800; text-transform:uppercase;">${item.marca || "Loja SJ 3D"}</div>
          <h3 style="margin:2px 0 4px; font-size:1.35rem; font-weight:900; color:#fff; line-height:1.2;">${item.nome}</h3>
          <p style="margin:0 0 10px; font-size:0.84rem; color:#d4d4d8;">${item.subtitulo}</p>

          <div style="display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;">
            <div style="font-size:1.75rem; font-weight:900; color:#fff;">${item.preco || "R$ 0,00"}</div>
            <div style="font-size:0.95rem; font-weight:800; color:#4ade80;">À Vista no PIX: ${precoPix} (5% OFF)</div>
          </div>
          ${item.precoParcelado ? `<div style="font-size:0.8rem; color:#a1a1aa; margin-top:2px;">${item.precoParcelado}</div>` : ""}
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
          <button type="button" class="btn-cms-primary" id="btn-spotlight-print-qr" style="width:100%; justify-content:center;">
            🖨️ Imprimir Etiqueta QR
          </button>
          <button type="button" class="btn-cms-secondary" id="btn-spotlight-add-cart" style="width:100%; background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.22); justify-content:center;">
            🛒 + Adicionar ao Orçamento
          </button>
          <button type="button" class="btn-cms-secondary" id="btn-spotlight-edit-prod" style="width:100%; background:transparent; color:#d4d4d8; border-color:rgba(255,255,255,0.18); font-size:0.76rem; justify-content:center;">
            ✏️ Editar Produto no Catálogo
          </button>
        </div>
      </div>
    `;

    card.querySelector("#btn-cms-close-spotlight")?.addEventListener("click", () => {
      renderizarSpotlightPreco(null);
    });

    card.querySelector("#btn-spotlight-print-qr")?.addEventListener("click", () => {
      imprimirEtiquetaQrIndividual(item);
    });

    card.querySelector("#btn-spotlight-add-cart")?.addEventListener("click", () => {
      const prodOriginal = (window.SITE_DATA.catalogo || []).find((p) => p.id === item.produtoId) || item;
      adicionarAoCarrinho({
        id: item.id,
        nome: item.nome,
        precoVista: item.preco,
        imagem: item.imagem
      }, 1, item.corNome || "Padrão", "À Vista");
      mostrarToast(`🛒 <strong>${item.nome}</strong> adicionado ao carrinho de vendas!`, "success");
    });

    card.querySelector("#btn-spotlight-edit-prod")?.addEventListener("click", () => {
      selecionarAbaCms("produtos");
      abrirEditorProdutoCms(item.produtoId);
    });
  }

  function executarConsultaPreco(termoBusca, abrirSpotlightAutomatico = false) {
    const q = (termoBusca || "").toLowerCase().trim();
    const todosItens = obterListaTodosItensCatalogoParaConsulta();

    if (!q) {
      renderizarGradeConsultaQr();
      return;
    }

    // Procura exato por código (ex: 149 ou CÓD. 149 ou SJ3D:PROD:...)
    const itemExato = todosItens.find((it) => {
      const codLimpo = (it.codNumero || "").toLowerCase();
      const codCompleto = (it.codigo || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const qLimpo = q.replace(/[^a-z0-9]/g, "");
      return (
        codLimpo === q ||
        codCompleto === qLimpo ||
        (it.qrPayload && it.qrPayload.toLowerCase() === q) ||
        (it.id && it.id.toLowerCase() === q)
      );
    });

    if (itemExato && abrirSpotlightAutomatico) {
      renderizarSpotlightPreco(itemExato);
    }

    renderizarGradeConsultaQr(q);
  }

  function renderizarGradeConsultaQr(filtroTermo = "") {
    const grid = document.getElementById("cms-price-lookup-grid");
    if (!grid) return;

    const itens = obterListaTodosItensCatalogoParaConsulta();
    const cat = consultaQrState.categoria;
    const termo = (filtroTermo || consultaQrState.busca || "").toLowerCase().trim();

    const filtrados = itens.filter((it) => {
      if (cat !== "todos") {
        if (cat === "cores" && it.tipo !== "cor") return false;
        if (cat !== "cores" && it.categoria !== cat) return false;
      }
      if (termo) {
        const texto = `${it.nome} ${it.subtitulo} ${it.codigo || ""} ${it.codNumero || ""} ${it.marca || ""} ${it.id}`.toLowerCase();
        return texto.includes(termo);
      }
      return true;
    });

    if (filtrados.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:#71717a; background:#fff; border-radius:12px; border:1px solid #e4e4e7;">Nenhum item encontrado com o código ou nome pesquisado.</div>`;
      return;
    }

    grid.innerHTML = filtrados.slice(0, 80).map((it) => {
      const st = it.estoqueStatus || "disponivel";
      const corSt = st === "esgotado" ? "#dc2626" : (st === "poucas_unidades" ? "#d97706" : "#16a34a");
      const qrSvgMini = gerarQrSvgOuCanvas(it.qrPayload, 60);

      return `
        <div class="sj-qr-item-card" data-qr-select-id="${it.id}">
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="width:58px; height:58px; border-radius:8px; overflow:hidden; background:#f4f4f5; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <img src="${it.imagem}" alt="${it.nome}" style="width:100%; height:100%; object-fit:contain;" />
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                <span style="font-family:monospace; font-size:0.72rem; font-weight:800; background:#f4f4f5; padding:2px 6px; border-radius:4px; color:#18181b;">
                  ${it.codigo ? String(it.codigo).toUpperCase() : it.id}
                </span>
                <span style="width:7px; height:7px; border-radius:50%; background:${corSt}; display:inline-block;" title="Status de estoque"></span>
              </div>
              <strong style="font-size:0.86rem; color:#18181b; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${it.nome}</strong>
              <div style="font-size:1.05rem; font-weight:900; color:#F04E23; margin-top:2px;">${it.preco}</div>
            </div>
            <div style="width:48px; height:48px; flex-shrink:0; cursor:pointer;" data-print-single-qr="${it.id}" title="Clique para imprimir etiqueta deste item">
              ${qrSvgMini}
            </div>
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button type="button" class="btn-cms-primary" style="flex:1; padding:6px 10px; font-size:0.74rem;" data-open-spotlight="${it.id}">
              🔍 Consultar Preço
            </button>
            <button type="button" class="btn-cms-secondary" style="padding:6px 10px; font-size:0.74rem;" data-print-single-qr="${it.id}" title="Imprimir etiqueta">
              🖨️ Etiqueta
            </button>
          </div>
        </div>
      `;
    }).join("");

    grid.querySelectorAll("[data-open-spotlight]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.openSpotlight;
        const item = itens.find((it) => it.id === id);
        if (item) renderizarSpotlightPreco(item);
      });
    });

    grid.querySelectorAll("[data-print-single-qr]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.printSingleQr;
        const item = itens.find((it) => it.id === id);
        if (item) imprimirEtiquetaQrIndividual(item);
      });
    });
  }

  // =========================================================================
  // MÓDULO 4: BANCO DE DADOS DE CLIENTES CADASTRADOS & LEADS (CRM)
  // =========================================================================

  let clientesState = {
    busca: "",
    filtro: "todos"
  };

  function renderizarListaClientesCms() {
    const listEl = document.getElementById("cms-clients-list");
    if (!listEl || !window.SJ_DB || !window.SJ_DB.clientes) return;

    const lista = window.SJ_DB.clientes.listar() || [];
    const termo = (clientesState.busca || "").toLowerCase().trim();
    const filtro = clientesState.filtro || "todos";

    // KPIs
    const total = lista.length;
    const whats = lista.filter((c) => Boolean(c.whatsapp || c.cepTelefone)).length;
    const cpfs = lista.filter((c) => Boolean(c.cnpjCpf || c.cpf)).length;
    const site = lista.filter((c) => String(c.origem || "").toLowerCase().includes("site") || c.cadastroAprovado).length;

    const kTotal = document.getElementById("cms-leads-kpi-total");
    const kWhats = document.getElementById("cms-leads-kpi-whats");
    const kCpf = document.getElementById("cms-leads-kpi-cpf");
    const kSite = document.getElementById("cms-leads-kpi-site");
    const badgeSidebar = document.getElementById("cms-clients-count-badge");

    if (kTotal) kTotal.textContent = String(total);
    if (kWhats) kWhats.textContent = String(whats);
    if (kCpf) kCpf.textContent = String(cpfs);
    if (kSite) kSite.textContent = String(site);
    if (badgeSidebar) badgeSidebar.textContent = String(total);

    const filtrados = lista.filter((c) => {
      if (filtro === "whatsapp" && !c.whatsapp && !c.cepTelefone) return false;
      if (filtro === "cpf" && !c.cnpjCpf && !c.cpf) return false;
      if (filtro === "site" && !String(c.origem || "").toLowerCase().includes("site") && !c.cadastroAprovado) return false;

      if (termo) {
        const texto = `${c.nome || ""} ${c.whatsapp || ""} ${c.cepTelefone || ""} ${c.cnpjCpf || ""} ${c.cpf || ""} ${c.email || ""} ${c.bairroCidadeUf || ""} ${c.cidade || ""}`.toLowerCase();
        return texto.includes(termo);
      }
      return true;
    });

    if (filtrados.length === 0) {
      listEl.innerHTML = `<div style="padding:32px; text-align:center; color:#71717a; background:#fff; border-radius:12px; border:1px solid #e4e4e7;">Nenhum cliente ou lead encontrado com este filtro.</div>`;
      return;
    }

    listEl.innerHTML = filtrados.map((c) => {
      const telLimpo = String(c.whatsapp || c.cepTelefone || "").replace(/\D/g, "");
      const linkWhats = telLimpo ? `https://wa.me/55${telLimpo}?text=Ol%C3%A1%20${encodeURIComponent(c.nome || "")}%2C%20tudo%20bem%3F%20Aqui%20%C3%A9%20da%20Loja%20SJ%203D!` : null;
      const dataCadastro = c.criadoEm ? new Date(c.criadoEm).toLocaleDateString("pt-BR") : "Recente";

      return `
        <div class="sj-lead-card" data-lead-id="${c.id}">
          <div style="flex:1; min-width:240px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
              <strong style="font-size:1rem; color:#111827;">${c.nome || "Cliente Sem Nome"}</strong>
              <span style="font-size:0.7rem; font-weight:800; background:#f4f4f5; color:#52525b; padding:2px 8px; border-radius:999px;">
                ${c.origem || "Cadastro Site"}
              </span>
              <span style="font-size:0.7rem; color:#a1a1aa;">Cadastrado em: ${dataCadastro}</span>
            </div>

            <div style="display:flex; gap:14px; flex-wrap:wrap; font-size:0.8rem; color:#4b5563; margin-top:4px;">
              ${c.whatsapp || c.cepTelefone ? `<div>📱 <strong>${c.whatsapp || c.cepTelefone}</strong></div>` : ""}
              ${c.cnpjCpf || c.cpf ? `
                <div style="display:inline-flex; align-items:center; gap:5px;">
                  🪪 CPF/CNPJ: <strong class="crm-doc-display" data-doc-raw="${escaparHtml(c.cnpjCpf || c.cpf)}" data-client-id="${c.id}">${mascararCpfCnpj(c.cnpjCpf || c.cpf)}</strong>
                  <button type="button" class="btn-reveal-doc" data-reveal-client="${c.id}" title="Revelar documento completo (registrado em log de auditoria LGPD)" style="background:none; border:none; cursor:pointer; font-size:0.8rem; color:#F04E23; padding:0 3px;">👁️</button>
                </div>
              ` : ""}
              ${c.email ? `<div>✉️ ${c.email}</div>` : ""}
              ${c.bairroCidadeUf || c.cidade ? `<div>📍 ${c.bairroCidadeUf || c.cidade}</div>` : ""}
            </div>

            ${c.endereco ? `<div style="font-size:0.76rem; color:#6b7280; margin-top:4px;">🏠 ${c.endereco}</div>` : ""}
            ${c.observacoes ? `<div style="font-size:0.76rem; color:#c2410c; margin-top:3px; font-weight:600;">💡 ${c.observacoes}</div>` : ""}
          </div>

          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            ${linkWhats ? `
              <a href="${linkWhats}" target="_blank" rel="noopener" class="btn-cms-save" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; background:#16a34a; font-size:0.78rem; padding:8px 12px;">
                💬 Chamar no WhatsApp
              </a>
            ` : ""}
            <button type="button" class="btn-cms-secondary" data-lead-quote="${c.id}" style="font-size:0.78rem; padding:8px 12px;" title="Iniciar orçamento timbrado com este cliente">
              📄 Orçamento
            </button>
            <button type="button" class="btn-cms-secondary" data-lead-edit="${c.id}" style="font-size:0.78rem; padding:8px 10px;" title="Editar dados">
              ✏️
            </button>
            <button type="button" class="btn-cms-danger" data-lead-del="${c.id}" style="font-size:0.78rem; padding:8px 10px;" title="Excluir cliente">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll("[data-lead-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.leadEdit;
        const c = lista.find((item) => String(item.id) === String(id));
        if (c) abrirFormularioClienteLead(c);
      });
    });

    listEl.querySelectorAll("[data-lead-quote]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.leadQuote;
        const c = lista.find((item) => String(item.id) === String(id));
        if (c) {
          fecharPainelAdminCms();
          abrirEmissorOrcamento({
            metadados: {
              cliente: {
                nome: c.nome,
                cnpjCpf: c.cnpjCpf || c.cpf || "",
                endereco: c.endereco || "",
                bairroCidadeUf: c.bairroCidadeUf || c.cidade || "Umuarama / PR",
                cepTelefone: c.whatsapp || c.cepTelefone || "",
                email: c.email || ""
              }
            }
          });
        }
      });
    });

    listEl.querySelectorAll("[data-lead-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.leadDel;
        const c = lista.find((item) => String(item.id) === String(id));
        if (c && confirm(`Deseja realmente remover o cliente "${c.nome}" do banco de dados?`)) {
          window.SJ_DB.clientes.excluir(id);
          renderizarListaClientesCms();
          mostrarToast(`Cliente <strong>${c.nome}</strong> removido com sucesso.`, "info");
        }
      });
    });

    // Revelar Documento Mascarado sob Demanda (com Log de Auditoria LGPD)
    listEl.querySelectorAll(".btn-reveal-doc").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const clientId = btn.dataset.revealClient;
        const wrap = btn.closest("div");
        const docEl = wrap?.querySelector(".crm-doc-display");
        if (!docEl) return;

        const raw = docEl.dataset.docRaw;
        const jaRevelado = docEl.classList.contains("revelado");

        if (jaRevelado) {
          docEl.textContent = mascararCpfCnpj(raw);
          docEl.classList.remove("revelado");
          btn.textContent = "👁️";
          btn.title = "Revelar documento completo (registrado em log de auditoria LGPD)";
        } else {
          const confirma = confirm("Deseja visualizar o CPF/CNPJ completo deste titular?\n\nEsta visualização de dado pessoal sensível será registrada na trilha de auditoria da LGPD.");
          if (!confirma) return;

          docEl.textContent = raw;
          docEl.classList.add("revelado");
          btn.textContent = "🔒";
          btn.title = "Ocultar documento";

          if (window.SJ_SUPABASE?.getClient) {
            try {
              const client = window.SJ_SUPABASE.getClient();
              if (client) {
                const sessao = (await client.auth.getSession())?.data?.session;
                await client.from("auditoria_logs").insert({
                  tabela: "clientes",
                  operacao: "VISUALIZACAO_DADO_SENSIVEL",
                  registro_id: clientId,
                  usuario_id: sessao?.user?.id || null,
                  usuario_email: sessao?.user?.email || "operador@local",
                  dados_novos: { campo: "cnpj_cpf", motivo: "Consulta visual autorizada no CRM" }
                });
              }
            } catch (_) {}
          }
        }
      });
    });
  }

  function abrirFormularioClienteLead(cliente = null) {
    const box = document.getElementById("cms-client-form-box");
    const title = document.getElementById("cms-client-form-title");
    if (!box) return;

    box.style.display = "block";
    if (title) title.textContent = cliente ? `✏️ Editar Dados de: ${cliente.nome}` : "➕ Cadastrar Novo Cliente / Lead";

    document.getElementById("cms-cli-id").value = cliente ? cliente.id : "";
    document.getElementById("cms-cli-nome").value = cliente ? cliente.nome : "";
    document.getElementById("cms-cli-whatsapp").value = cliente ? (cliente.whatsapp || cliente.cepTelefone || "") : "";
    document.getElementById("cms-cli-cpf").value = cliente ? (cliente.cnpjCpf || cliente.cpf || "") : "";
    document.getElementById("cms-cli-email").value = cliente ? (cliente.email || "") : "";
    document.getElementById("cms-cli-cidade").value = cliente ? (cliente.bairroCidadeUf || cliente.cidade || "Umuarama / PR") : "Umuarama / PR";
    document.getElementById("cms-cli-origem").value = cliente ? (cliente.origem || "Lead WhatsApp / Balcão") : "Lead WhatsApp / Balcão";
    document.getElementById("cms-cli-endereco").value = cliente ? (cliente.endereco || "") : "";
    document.getElementById("cms-cli-obs").value = cliente ? (cliente.observacoes || "") : "";

    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function fecharFormularioClienteLead() {
    const box = document.getElementById("cms-client-form-box");
    if (box) box.style.display = "none";
  }

  function exportarClientesCsv() {
    if (!window.SJ_DB || !window.SJ_DB.clientes) return;
    const lista = window.SJ_DB.clientes.listar() || [];
    if (lista.length === 0) {
      alert("Nenhum cliente cadastrado para exportar.");
      return;
    }

    const confirma = confirm(
      "🔒 EXPORTAÇÃO DE BASE DE DADOS (LGPD Art. 46):\n\n" +
      "A extração de dados cadastrais de clientes é uma operação monitorada que será registrada na trilha de auditoria.\n\n" +
      `Deseja exportar os registros de ${lista.length} cliente(s) em formato CSV?`
    );
    if (!confirma) return;

    // Registra log de auditoria
    if (window.SJ_SUPABASE?.getClient) {
      try {
        const client = window.SJ_SUPABASE.getClient();
        if (client) {
          client.auth.getSession().then(({ data }) => {
            const user = data?.session?.user;
            client.from("auditoria_logs").insert({
              tabela: "clientes",
              operacao: "EXPORTACAO_BASE_CSV",
              usuario_id: user?.id || null,
              usuario_email: user?.email || "operador@local",
              dados_novos: { total_registros: lista.length, motivo: "Exportação manual autorizada via CRM" }
            }).then(() => {});
          });
        }
      } catch (_) {}
    }

    const cabecalho = ["ID", "Nome", "WhatsApp/Telefone", "CPF/CNPJ", "Email", "Cidade/UF", "Endereco", "Origem", "CriadoEm"];
    const linhas = lista.map((c) => [
      `"${c.id || ""}"`,
      `"${(c.nome || "").replace(/"/g, '""')}"`,
      `"${(c.whatsapp || c.cepTelefone || "").replace(/"/g, '""')}"`,
      `"${(c.cnpjCpf || c.cpf || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.bairroCidadeUf || c.cidade || "").replace(/"/g, '""')}"`,
      `"${(c.endereco || "").replace(/"/g, '""')}"`,
      `"${(c.origem || "Site").replace(/"/g, '""')}"`,
      `"${c.criadoEm || ""}"`
    ]);

    const csvContent = "\uFEFF" + [cabecalho.join(";"), ...linhas.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_clientes_lojasj3d_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("📥 Planilha CSV de Clientes e Leads exportada com sucesso!", "success");
  }

  function configurarEventosNovosModulosCms() {
    // Consulta QR Code
    document.getElementById("btn-cms-start-qr-camera")?.addEventListener("click", () => {
      iniciarCameraLeitorQr();
    });

    document.getElementById("btn-cms-stop-qr-camera")?.addEventListener("click", () => {
      pararCameraLeitorQr(true);
    });

    document.getElementById("btn-cms-switch-camera")?.addEventListener("click", () => {
      cameraFacingMode = cameraFacingMode === "environment" ? "user" : "environment";
      iniciarCameraLeitorQr();
    });

    document.getElementById("btn-cms-print-batch-qr")?.addEventListener("click", () => {
      const itens = obterListaTodosItensCatalogoParaConsulta();
      imprimirCartelaQrCodes(itens);
    });

    document.getElementById("cms-price-lookup-input")?.addEventListener("input", (e) => {
      consultaQrState.busca = e.target.value || "";
      executarConsultaPreco(consultaQrState.busca, false);
    });

    document.querySelectorAll("[data-qr-cat]").forEach((pill) => {
      pill.addEventListener("click", () => {
        consultaQrState.categoria = pill.dataset.qrCat;
        document.querySelectorAll("[data-qr-cat]").forEach((b) => {
          b.classList.toggle("active", b === pill);
        });
        renderizarGradeConsultaQr();
      });
    });

    // Clientes & Leads
    document.getElementById("cms-clients-search-input")?.addEventListener("input", (e) => {
      clientesState.busca = e.target.value || "";
      renderizarListaClientesCms();
    });

    document.getElementById("cms-clients-filter-select")?.addEventListener("change", (e) => {
      clientesState.filtro = e.target.value || "todos";
      renderizarListaClientesCms();
    });

    document.getElementById("btn-cms-sync-clients")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-cms-sync-clients");
      if (btn) btn.textContent = "⏳ Sincronizando...";
      if (window.SJ_DB?.clientes?.sincronizarNuvem) {
        await window.SJ_DB.clientes.sincronizarNuvem();
      }
      if (btn) btn.textContent = "🔄 Sincronizar";
      renderizarListaClientesCms();
      mostrarToast("Banco de dados de clientes sincronizado com sucesso!", "success");
    });

    document.getElementById("btn-cms-export-clients-csv")?.addEventListener("click", () => {
      exportarClientesCsv();
    });

    document.getElementById("btn-cms-new-client")?.addEventListener("click", () => {
      abrirFormularioClienteLead(null);
    });

    document.getElementById("btn-cms-close-client-form")?.addEventListener("click", () => {
      fecharFormularioClienteLead();
    });

    document.getElementById("btn-cms-cancel-client-lead")?.addEventListener("click", () => {
      fecharFormularioClienteLead();
    });

    document.getElementById("form-cms-client-lead")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = document.getElementById("cms-cli-id")?.value.trim();
      const nome = document.getElementById("cms-cli-nome")?.value.trim();
      const whatsapp = document.getElementById("cms-cli-whatsapp")?.value.trim();
      const cpf = document.getElementById("cms-cli-cpf")?.value.trim();
      const email = document.getElementById("cms-cli-email")?.value.trim().toLowerCase();
      const cidade = document.getElementById("cms-cli-cidade")?.value.trim();
      const origem = document.getElementById("cms-cli-origem")?.value || "Lead WhatsApp / Balcão";
      const endereco = document.getElementById("cms-cli-endereco")?.value.trim();
      const observacoes = document.getElementById("cms-cli-obs")?.value.trim();

      if (!nome || !whatsapp) {
        alert("Preencha o Nome e o WhatsApp do cliente.");
        return;
      }

      window.SJ_DB.clientes.salvar({
        id: id || ("cli-" + Date.now()),
        nome,
        whatsapp,
        cepTelefone: whatsapp,
        cpf,
        cnpjCpf: cpf,
        email,
        bairroCidadeUf: cidade,
        origem,
        endereco,
        observacoes,
        cadastroAprovado: true
      });

      fecharFormularioClienteLead();
      renderizarListaClientesCms();
      mostrarToast(`✅ Cliente <strong>${nome}</strong> salvo com sucesso no banco de dados!`, "success");
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
      "consulta-qr": "cms-pane-consulta-qr",
      clientes: "cms-pane-clientes",
      banner: "cms-pane-banner",
      exportar: "cms-pane-exportar",
      supabase: "cms-pane-supabase",
      equipe: "cms-pane-equipe",
      lgpd: "cms-pane-lgpd"
    };
    const mapTitles = {
      produtos: "Catálogo, Preços & Controle de Estoque",
      "consulta-qr": "Consulta Rápida de Preço & Leitor QR Code",
      clientes: "Banco de Dados de Clientes Cadastrados & Leads",
      equipe: "Funcionários, Administradores & Acessos",
      banner: "Banner de Promoções & Sorteio",
      supabase: "Conexão Supabase & Nuvem",
      exportar: "Backup & Exportação de Dados",
      lgpd: "Painel de Atendimento a Solicitações de Titulares (LGPD Art. 18)"
    };
    const titleEl = document.getElementById("admin-cms-title");
    if (titleEl && mapTitles[aba]) {
      titleEl.textContent = mapTitles[aba];
    }
    Object.entries(mapPanes).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) {
        const ativo = key === aba;
        el.classList.toggle("active", ativo);
        el.style.display = ativo ? "block" : "none";
      }
    });
    if (aba === "consulta-qr") {
      renderizarGradeConsultaQr();
    }
    if (aba === "clientes") {
      renderizarListaClientesCms();
    }
    if (aba === "supabase") {
      atualizarStatusSupabaseNoCms();
    }
    if (aba === "equipe") {
      renderizarPainelEquipeCms();
    }
    if (aba === "lgpd") {
      renderizarPainelLgpdCms();
    }
  }

  // =====================================================================
  // PAINEL LGPD: ATENDIMENTO A DIREITOS DO TITULAR & SLA DE 15 DIAS
  // =====================================================================
  async function renderizarPainelLgpdCms() {
    const listEl = document.getElementById("cms-lgpd-requests-list");
    if (!listEl) return;

    listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#64748B;">Carregando solicitações de titulares...</div>';

    let solicitacoes = [];
    if (window.SJ_SUPABASE?.direitosTitular?.listarSolicitacoes) {
      try {
        solicitacoes = await window.SJ_SUPABASE.direitosTitular.listarSolicitacoes();
      } catch (e) {
        console.warn("[LGPD] Erro ao carregar solicitações:", e);
      }
    }

    if (!Array.isArray(solicitacoes) || solicitacoes.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding:32px 16px; color:#64748B;">
          <div style="font-size:2rem; margin-bottom:8px;">🛡️</div>
          <strong style="color:#0F172A; display:block; margin-bottom:4px;">Nenhuma solicitação de titular pendente</strong>
          <span style="font-size:0.82rem;">Quando um cliente ou titular preencher o formulário de direitos da LGPD, o pedido aparecerá aqui com contagem regressiva do SLA de 15 dias.</span>
        </div>
      `;
      return;
    }

    const agora = new Date();
    const tipoMap = {
      acesso_dados: "1. Confirmação & Acesso aos Dados",
      portabilidade_dados: "2. Portabilidade (JSON)",
      correcao_dados: "3. Correção de Dados",
      eliminacao_dados: "4. Eliminação / Apagamento",
      revogacao_consentimento: "5. Revogação de Consentimento",
      informacao_compartilhamento: "6. Info sobre Compartilhamento",
      outro: "7. Outro"
    };

    listEl.innerHTML = solicitacoes.map((s) => {
      const dataAbertura = new Date(s.criado_em).toLocaleDateString("pt-BR");
      const prazoLimite = new Date(s.prazo_limite);
      const dataLimiteFmt = prazoLimite.toLocaleDateString("pt-BR");
      const diasRestantes = Math.ceil((prazoLimite - agora) / (1000 * 60 * 60 * 24));

      let badgeSla = "";
      if (s.status === "concluida") {
        badgeSla = '<span style="background:#DCFCE7; color:#166534; font-size:0.73rem; font-weight:800; padding:2px 8px; border-radius:999px;">✅ Concluída</span>';
      } else if (diasRestantes < 0) {
        badgeSla = `<span style="background:#FEE2E2; color:#991B1B; font-size:0.73rem; font-weight:800; padding:2px 8px; border-radius:999px;">🔴 SLA Atrasado (${Math.abs(diasRestantes)}d)</span>`;
      } else if (diasRestantes <= 5) {
        badgeSla = `<span style="background:#FEF3C7; color:#92400E; font-size:0.73rem; font-weight:800; padding:2px 8px; border-radius:999px;">🟡 Atenção (${diasRestantes} dias restantes)</span>`;
      } else {
        badgeSla = `<span style="background:#DCFCE7; color:#166534; font-size:0.73rem; font-weight:800; padding:2px 8px; border-radius:999px;">🟢 No Prazo (${diasRestantes} dias)</span>`;
      }

      const tipoFormatado = tipoMap[s.tipo_solicitacao] || s.tipo_solicitacao;

      return `
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:16px; margin-bottom:12px;" data-solic-card="${s.id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
            <div>
              <span style="font-size:0.85rem; font-weight:900; color:#0F172A; margin-right:8px;">${escaparHtml(s.protocolo)}</span>
              <span style="font-size:0.82rem; font-weight:700; color:#3B82F6;">${tipoFormatado}</span>
            </div>
            <div>${badgeSla}</div>
          </div>

          <div style="font-size:0.8rem; color:#475569; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:6px; margin-bottom:10px;">
            <div><strong>Titular:</strong> ${escaparHtml(s.titular_nome)}</div>
            <div><strong>E-mail:</strong> ${escaparHtml(s.titular_email)}</div>
            ${s.titular_cpf ? `<div><strong>CPF/CNPJ:</strong> ${escaparHtml(s.titular_cpf)}</div>` : ""}
            <div><strong>Data:</strong> ${dataAbertura} (Limite: ${dataLimiteFmt})</div>
          </div>

          ${s.detalhes_solicitacao ? `
            <div style="font-size:0.78rem; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:8px 10px; color:#334155; margin-bottom:10px;">
              <strong>Mensagem do Titular:</strong> ${escaparHtml(s.detalhes_solicitacao)}
            </div>
          ` : ""}

          ${s.resposta_texto ? `
            <div style="font-size:0.78rem; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:8px 10px; color:#166534; margin-bottom:10px;">
              <strong>Resposta Registrada:</strong> ${escaparHtml(s.resposta_texto)}
            </div>
          ` : ""}

          <div style="display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #E2E8F0; padding-top:10px; align-items:center;">
            <button type="button" class="btn-cms-secondary btn-export-portabilidade" data-solic-email="${escaparHtml(s.titular_email)}" data-solic-prot="${escaparHtml(s.protocolo)}" style="padding:5px 12px; font-size:0.75rem; border-color:#CBD5E1;">
              📥 Baixar Portabilidade (JSON)
            </button>

            ${s.tipo_solicitacao === "eliminacao_dados" && s.status !== "concluida" ? `
              <button type="button" class="btn-cms-secondary btn-processar-eliminacao" data-solic-id="${s.id}" data-solic-email="${escaparHtml(s.titular_email)}" style="padding:5px 12px; font-size:0.75rem; background:#FEF2F2; color:#DC2626; border-color:#FECACA;">
                🗑️ Atender Eliminação / Trava Fiscal
              </button>
            ` : ""}

            ${s.status !== "concluida" ? `
              <button type="button" class="btn-cms-save btn-responder-solic" data-solic-id="${s.id}" style="padding:5px 14px; font-size:0.75rem;">
                ✅ Responder &amp; Concluir
              </button>
            ` : ""}
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".btn-export-portabilidade").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.solicEmail;
        const prot = btn.dataset.solicProt;
        btn.disabled = true;
        btn.textContent = "Gerando JSON...";
        try {
          const dados = await window.SJ_SUPABASE.direitosTitular.exportarDadosTitular(email);
          const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `portabilidade_lgpd_${prot}.json`;
          a.click();
          URL.revokeObjectURL(url);
          mostrarToast(`Arquivo de portabilidade do protocolo ${prot} baixado com sucesso!`, "success");
        } catch (err) {
          alert("Erro ao exportar portabilidade: " + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "📥 Baixar Portabilidade (JSON)";
        }
      });
    });

    listEl.querySelectorAll(".btn-processar-eliminacao").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.solicId;
        const email = btn.dataset.solicEmail;
        const confirma = confirm(`Deseja realmente processar a eliminação/bloqueio dos dados de ${email}?\n\nO sistema checará se há notas fiscais obrigatórias de 5 anos antes de apagar.`);
        if (!confirma) return;

        btn.disabled = true;
        btn.textContent = "Processando...";
        try {
          const res = await window.SJ_SUPABASE.direitosTitular.processarEliminacao(id, email);
          if (res?.sucesso) {
            alert(`✅ Solicitação atendida com sucesso!\n\n${res.resposta}`);
            mostrarToast("Eliminação/bloqueio processado com sucesso!", "success");
            renderizarPainelLgpdCms();
          } else {
            alert("Erro: " + (res?.mensagem || "Não foi possível processar."));
          }
        } catch (err) {
          alert("Erro ao processar eliminação: " + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "🗑️ Atender Eliminação / Trava Fiscal";
        }
      });
    });

    listEl.querySelectorAll(".btn-responder-solic").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.solicId;
        const texto = prompt("Digite a resposta oficial a ser registrada no protocolo:");
        if (!texto || !texto.trim()) return;

        btn.disabled = true;
        btn.textContent = "Salvando...";
        try {
          await window.SJ_SUPABASE.direitosTitular.concluirSolicitacao(id, texto.trim());
          mostrarToast("Solicitação concluída com sucesso!", "success");
          renderizarPainelLgpdCms();
        } catch (err) {
          alert("Erro ao concluir: " + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "✅ Responder & Concluir";
        }
      });
    });
  }

  document.getElementById("btn-cms-refresh-lgpd")?.addEventListener("click", renderizarPainelLgpdCms);

  // =====================================================================
  // PAINEL: ADMINISTRADORES & SENHA (aprovação / bloqueio / troca de senha)
  // =====================================================================
  function escaparHtmlEquipe(txt) {
    return String(txt == null ? "" : txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function atualizarBadgesSolicitacoesPendentes(listaOpcional = null) {
    let lista = listaOpcional;
    if (!lista && window.SJ_DB && window.SJ_DB.auth) {
      lista = window.SJ_DB.auth.listarUsuarios() || [];
    }
    const qtd = (lista || []).filter((u) => u.status === "pendente").length;
    ["cms-pending-badge", "topbar-pending-badge", "crm-top-pending-pill"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(qtd);
      el.style.display = qtd > 0 ? "inline-block" : "none";
    });
    const sidebarEmail = document.getElementById("crm-sidebar-admin-email");
    if (sidebarEmail) {
      const u = state.usuarioGoogle || (window.SJ_DB && window.SJ_DB.auth ? window.SJ_DB.auth.getUsuarioAtual() : null);
      if (u && u.email) sidebarEmail.textContent = u.email;
    }
    return qtd;
  }

  function usuarioLogadoEhMaster() {
    const u = state.usuarioGoogle || (window.SJ_DB && window.SJ_DB.auth ? window.SJ_DB.auth.getUsuarioAtual() : null);
    if (!u) return false;
    const email = String(u.email || "").toLowerCase();
    return Boolean(
      u.isMaster ||
      email === "jt.designer21@gmail.com" ||
      email === "jt.design21@gmail.com" ||
      email === "jt.design21@gmail.com.br"
    );
  }

  async function renderizarPainelEquipeCms(pularSyncNuvem = false) {
    if (!window.SJ_DB || !window.SJ_DB.auth) return;
    const auth = window.SJ_DB.auth;
    const lista = auth.listarUsuarios() || [];
    atualizarBadgesSolicitacoesPendentes(lista);

    const uAtual = state.usuarioGoogle || auth.getUsuarioAtual();
    const emailLogado = uAtual ? uAtual.email : "jt.designer21@gmail.com";
    const emailEl = document.getElementById("cms-admin-pwd-email");
    if (emailEl) emailEl.textContent = emailLogado || "jt.designer21@gmail.com";

    const btnStyle = (bg, fg = "#fff") =>
      `style="background:${bg}; color:${fg}; border:none; border-radius:8px; padding:7px 13px; font-size:0.78rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:opacity 0.15s;"`;
    const badge = (status) => {
      const map = {
        aprovado: ["#DCFCE7", "#166534", "✅ Aprovado (Liberado)"],
        pendente: ["#FEF3C7", "#92400E", "⏳ Aguardando Aprovação"],
        bloqueado: ["#FEE2E2", "#991B1B", "🚫 Bloqueado / Negado"]
      };
      const [bg, fg, label] = map[status] || map.pendente;
      return `<span style="background:${bg}; color:${fg}; font-size:0.72rem; font-weight:800; padding:3px 9px; border-radius:999px; display:inline-block;">${label}</span>`;
    };

    // 1) Solicitações pendentes
    const pendentesEl = document.getElementById("cms-pending-requests-list");
    if (pendentesEl) {
      const pendentes = lista.filter((u) => u.status === "pendente");
      if (pendentes.length === 0) {
        pendentesEl.innerHTML = `
          <div style="padding:14px 16px; background:#F9FAFB; border:1px dashed #D1D5DB; border-radius:10px; color:#4B5563; font-size:0.84rem;">
            ✅ Nenhuma solicitação pendente de aprovação neste momento. Quando uma pessoa pedir acesso na aba <strong>"Solicitar Autorização"</strong> da Área Restrita, o e-mail dela aparecerá aqui com os botões para você <strong>Aprovar</strong>, <strong>Negar</strong> ou <strong>Bloquear</strong>.
          </div>
        `;
      } else {
        pendentesEl.innerHTML = pendentes.map((u) => {
          const identificador = u.email || u.id || "";
          const emailExibicao = u.email || `Registro sem e-mail (${u.id || "ID"})`;
          return `
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; border:1.5px solid #F59E0B; background:#FFFBEB; border-radius:12px; margin-bottom:10px; box-shadow:0 2px 8px rgba(245,158,11,0.08);">
            <div style="min-width:240px; flex:1;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                <span style="background:#F59E0B; color:#fff; font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:999px;">NOVO PEDIDO DE ACESSO</span>
                <strong style="font-size:0.95rem; color:#111827;">${escaparHtmlEquipe(u.nome || "Solicitante")}</strong>
              </div>
              <div style="font-size:0.9rem; color:#1F2937; margin-bottom:3px;">
                📧 E-mail solicitante: <strong style="color:#E84520; text-decoration:underline;">${escaparHtmlEquipe(emailExibicao)}</strong>
              </div>
              <div style="font-size:0.78rem; color:#6B7280;">
                ${u.motivo ? `💬 Motivo/Função: <strong>${escaparHtmlEquipe(u.motivo)}</strong> • ` : ""}Solicitado em: ${u.criadoEm ? new Date(u.criadoEm).toLocaleString("pt-BR") : "Recente"}
              </div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" data-equipe-acao="aprovado" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#16A34A")}>
                ✅ Aprovar & Liberar
              </button>
              <button type="button" data-equipe-acao="bloqueado" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#DC2626")}>
                🚫 Negar / Bloquear
              </button>
              <button type="button" data-equipe-acao="remover" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#6B7280")}>
                🗑️ Excluir Pedido
              </button>
            </div>
          </div>
        `;
        }).join("");
      }
    }

    // 2) Todos os administradores e solicitações registradas
    const todosEl = document.getElementById("cms-all-admins-list");
    if (todosEl) {
      todosEl.innerHTML = lista.map((u) => {
        const master = u.isMaster || String(u.email || "").toLowerCase() === "jt.designer21@gmail.com";
        const identificador = u.email || u.id || "";
        const emailExibicao = u.email || u.id || "—";
        let acoes = "";
        if (master) {
          acoes = `<span style="font-size:0.76rem; background:#FEF3C7; color:#92400E; padding:5px 10px; border-radius:8px; font-weight:800;">👑 Administrador Oficial (Vitalício)</span>`;
        } else {
          acoes = `
            ${u.status !== "aprovado" ? `<button type="button" data-equipe-acao="aprovado" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#16A34A")}>✅ Aprovar / Liberar</button>` : ""}
            ${u.status !== "pendente" ? `<button type="button" data-equipe-acao="pendente" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#D97706")}>⏳ Colocar Pendente</button>` : ""}
            ${u.status !== "bloqueado" ? `<button type="button" data-equipe-acao="bloqueado" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#DC2626")}>🚫 Bloquear</button>` : ""}
            <button type="button" data-equipe-acao="remover" data-equipe-email="${escaparHtmlEquipe(identificador)}" ${btnStyle("#4B5563")}>🗑️ Excluir</button>
          `;
        }
        return `
          <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #E5E7EB; background:${master ? "#FAFAFA" : "#FFFFFF"}; border-radius:10px; margin-bottom:8px;">
            <div style="min-width:240px; flex:1;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <strong style="font-size:0.92rem; color:#111827;">${escaparHtmlEquipe(u.nome || "Administrador")}</strong>
                ${badge(u.status)}
              </div>
              <div style="font-size:0.84rem; color:#374151; margin-top:3px;">
                📧 <strong>${escaparHtmlEquipe(emailExibicao)}</strong> • <span style="color:#6B7280;">${escaparHtmlEquipe(u.cargo || "Administrador")}</span>
                ${u.motivo ? ` • <span style="color:#6B7280;">Motivo: ${escaparHtmlEquipe(u.motivo)}</span>` : ""}
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">${acoes}</div>
          </div>`;
      }).join("");
    }

    // Ações nos botões (Aprovar, Bloquear, Pendente, Excluir)
    document.querySelectorAll("#cms-pane-equipe [data-equipe-acao]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const acao = btn.dataset.equipeAcao;
        const email = btn.dataset.equipeEmail;
        let res;
        if (acao === "remover") {
          if (!confirm(`Deseja excluir o registro de ${email}?`)) return;
          res = await auth.removerUsuario(email);
        } else {
          res = await auth.alterarStatusUsuario(email, acao);
        }
        if (res && res.mensagem) {
          mostrarToast(res.mensagem, res.sucesso ? "success" : "warning");
        }
        renderizarPainelEquipeCms(true);
      });
    });

    if (!pularSyncNuvem) {
      try {
        await auth.sincronizarEquipeNuvem();
        renderizarPainelEquipeCms(true);
      } catch (_) {}
    }
  }

  function configurarFormularioSenhaAdmin() {
    // Botão Atualizar Solicitações
    const btnRefresh = document.getElementById("btn-cms-refresh-equipe");
    if (btnRefresh && btnRefresh.dataset.bound !== "1") {
      btnRefresh.dataset.bound = "1";
      btnRefresh.addEventListener("click", async () => {
        btnRefresh.textContent = "⏳ Atualizando...";
        await renderizarPainelEquipeCms();
        btnRefresh.textContent = "🔄 Atualizar Solicitações";
        mostrarToast("Lista de solicitações e administradores atualizada!", "success");
      });
    }

    // Formulário para adicionar/autorizar novo administrador manualmente
    const formAdd = document.getElementById("form-cms-add-admin");
    if (formAdd && formAdd.dataset.bound !== "1") {
      formAdd.dataset.bound = "1";
      formAdd.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("cms-new-admin-nome")?.value.trim();
        const email = document.getElementById("cms-new-admin-email")?.value.trim().toLowerCase();
        const senha = document.getElementById("cms-new-admin-senha")?.value.trim();
        const statusInicial = document.getElementById("cms-new-admin-status")?.value || "aprovado";

        if (!nome || !email || !senha) return;
        const res = await window.SJ_DB.auth.registrar({
          nome,
          email,
          senha,
          cargo: "Administrador Autorizado",
          motivo: "Cadastrado no Painel Admin"
        });

        if (statusInicial === "aprovado") {
          await window.SJ_DB.auth.alterarStatusUsuario(email, "aprovado");
          mostrarToast(`✅ E-mail ${email} cadastrado e já LIBERADO como administrador!`, "success");
        } else {
          mostrarToast(`📩 Solicitação para ${email} criada como Pendente!`, "success");
        }
        formAdd.reset();
        renderizarPainelEquipeCms();
      });
    }

    const form = document.getElementById("form-cms-change-admin-pwd");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fb = document.getElementById("cms-admin-pwd-feedback");
      const mostrar = (ok, msg) => {
        if (!fb) return alert(msg);
        fb.style.display = "block";
        fb.style.background = ok ? "#DCFCE7" : "#FEE2E2";
        fb.style.color = ok ? "#166534" : "#991B1B";
        fb.textContent = msg;
      };
      const atual = document.getElementById("cms-admin-pwd-current")?.value.trim();
      const nova = document.getElementById("cms-admin-pwd-new")?.value.trim();
      const conf = document.getElementById("cms-admin-pwd-confirm")?.value.trim();
      const uAtual = state.usuarioGoogle || (window.SJ_DB && window.SJ_DB.auth ? window.SJ_DB.auth.getUsuarioAtual() : null);
      const emailAlvo = (uAtual && uAtual.email) ? uAtual.email : "jt.designer21@gmail.com";
      if (nova !== conf) {
        mostrar(false, "A confirmação não confere com a nova senha.");
        return;
      }
      const res = await window.SJ_DB.auth.alterarSenhaAdmin(emailAlvo, atual, nova);
      mostrar(res.sucesso, res.mensagem);
      if (res.sucesso) form.reset();
    });
  }

  function abrirPainelAdminCms(abaInicial = "produtos", produtoIdParaEditar = null) {
    const executarAbertura = () => {
      const modal = document.getElementById("modal-admin-cms");
      if (!modal) return;
      modal.style.display = "flex";

      selecionarAbaCms(abaInicial || "produtos");
      configurarFormularioSenhaAdmin();
      atualizarBadgesSolicitacoesPendentes();
      renderizarListaProdutosCms();
      preencherFormularioBannerCms();
      atualizarStatusSupabaseNoCms();

      if (produtoIdParaEditar) {
        abrirEditorProdutoCms(produtoIdParaEditar);
      } else {
        voltarParaListaProdutosCms();
      }
    };

    if (window.SJ_SUPABASE) {
      window.SJ_SUPABASE.guardiao.validarAcessoRota("#admin", executarAbertura, () => {
        abrirModalAuthGoogle(executarAbertura, "email");
      });
      return;
    }

    if (!state.usuarioGoogle) {
      abrirModalAuthGoogle(executarAbertura, "email");
      return;
    }

    executarAbertura();
  }

  function atualizarStatusSupabaseNoCms() {
    const badge = document.getElementById("cms-supabase-status-badge");
    const text = document.getElementById("cms-supabase-status-text");
    const urlInput = document.getElementById("cms-supabase-url");
    const keyInput = document.getElementById("cms-supabase-key");

    if (!window.SJ_SUPABASE) return;
    const cfg = window.SJ_SUPABASE.getConfig();
    if (urlInput && !urlInput.value && cfg.url) urlInput.value = cfg.url;
    if (keyInput && !keyInput.value && cfg.anonKey) keyInput.value = cfg.anonKey;

    const isConnected = window.SJ_SUPABASE.isConfigured();
    if (badge && text) {
      badge.className = `supabase-status-badge ${isConnected ? "connected" : "not-connected"}`;
      text.textContent = isConnected
        ? `Status: Conectado ao Supabase (${cfg.url})`
        : "Status: Supabase não conectado (operando no modo local)";
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

  function atualizarContadoresEstoqueKpiCms() {
    if (!window.SITE_DATA) return;
    const catalogo = window.SITE_DATA.catalogo || [];
    let ok = 0;
    let low = 0;
    let out = 0;
    catalogo.forEach((p) => {
      const st = p.estoqueStatus || "disponivel";
      if (st === "esgotado") out++;
      else if (st === "poucas_unidades") low++;
      else ok++;
    });
    const elTotal = document.getElementById("cms-kpi-total");
    const elOk = document.getElementById("cms-kpi-ok");
    const elLow = document.getElementById("cms-kpi-low");
    const elOut = document.getElementById("cms-kpi-out");
    if (elTotal) elTotal.textContent = String(catalogo.length);
    if (elOk) elOk.textContent = String(ok);
    if (elLow) elLow.textContent = String(low);
    if (elOut) elOut.textContent = String(out);
  }

  function renderizarListaProdutosCms() {
    const grid = document.getElementById("cms-products-grid");
    if (!grid || !window.SITE_DATA) return;

    atualizarContadoresEstoqueKpiCms();

    const catalogo = window.SITE_DATA.catalogo || [];
    const termo = (cmsState.busca || "").toLowerCase().trim();

    const filtrados = catalogo.filter((item) => {
      if (cmsState.categoriaFiltro !== "todos" && item.categoria !== cmsState.categoriaFiltro) {
        return false;
      }
      const st = item.estoqueStatus || "disponivel";
      if (cmsState.estoqueFiltro && cmsState.estoqueFiltro !== "todos" && st !== cmsState.estoqueFiltro) {
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
        const statusEst = p.estoqueStatus || "disponivel";

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
              <div style="margin-top:8px;">
                <select class="cms-quick-stock-select stock-${statusEst}" data-cms-quick-stock="${p.id}" title="Alterar status de estoque deste produto">
                  <option value="disponivel" ${statusEst === "disponivel" ? "selected" : ""}>🟢 Em Estoque</option>
                  <option value="poucas_unidades" ${statusEst === "poucas_unidades" ? "selected" : ""}>🟠 Poucas Unidades</option>
                  <option value="esgotado" ${statusEst === "esgotado" ? "selected" : ""}>🔴 Esgotado</option>
                </select>
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

    // Troca rápida de status de estoque direto na grade do Painel Admin
    grid.querySelectorAll("[data-cms-quick-stock]").forEach((sel) => {
      sel.addEventListener("change", async (e) => {
        const id = sel.dataset.cmsQuickStock;
        const novoStatus = e.target.value;
        const prod = (window.SITE_DATA.catalogo || []).find((i) => i.id === id);
        if (!prod) return;
        prod.estoqueStatus = novoStatus;
        sel.className = `cms-quick-stock-select stock-${novoStatus}`;
        if (window.SJ_DB && window.SJ_DB.catalogo) {
          await window.SJ_DB.catalogo.salvarProduto(prod);
        }
        atualizarContadoresEstoqueKpiCms();
        atualizarSiteAposEdicaoCms();
        const labelMap = {
          disponivel: "🟢 Em Estoque",
          poucas_unidades: "🟠 Poucas Unidades",
          esgotado: "🔴 Esgotado"
        };
        mostrarToast(`📦 Estoque de <strong>"${prod.nome}"</strong> alterado para <strong>${labelMap[novoStatus] || novoStatus}</strong>!`, "success");
      });
    });

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
        (c, idx) => {
          const stCor = c.estoqueStatus || "disponivel";
          return `
          <div class="cms-color-edit-row" data-color-row-idx="${idx}">
            <input type="color" class="cms-color-hex-picker" data-c-field="hex" data-c-idx="${idx}" value="${(c.hex && c.hex.startsWith("#") && c.hex.length === 7) ? c.hex : "#F04E23"}" title="Escolher tom da cor" />
            <div class="cms-color-thumb-mini">
              <img src="${c.imgCatalogo || "assets/produtos/pla-maxprint.jpg"}" alt="${c.nome}" id="cms-c-thumb-${idx}" />
            </div>
            <input type="text" class="cms-c-input-name" data-c-field="nome" data-c-idx="${idx}" value="${String(c.nome || "").replace(/"/g, "&quot;")}" placeholder="Nome da Cor (ex: Preto 1kg)" />
            <input type="text" class="cms-c-input-cod" data-c-field="cod" data-c-idx="${idx}" value="${String(c.cod || "").replace(/"/g, "&quot;")}" placeholder="CÓD." title="Código no Catálogo" />
            <input type="text" class="cms-c-input-price" data-c-field="preco" data-c-idx="${idx}" value="${String(c.preco || "R$ 79,90").replace(/"/g, "&quot;")}" placeholder="Preço (R$)" />
            <select class="cms-c-input-stock stock-${stCor}" data-c-field="estoqueStatus" data-c-idx="${idx}" title="Disponibilidade desta cor">
              <option value="disponivel" ${stCor === "disponivel" ? "selected" : ""}>🟢 Em estoque</option>
              <option value="poucas_unidades" ${stCor === "poucas_unidades" ? "selected" : ""}>🟠 Poucas unid.</option>
              <option value="esgotado" ${stCor === "esgotado" ? "selected" : ""}>🔴 Esgotado</option>
            </select>
            <input type="text" class="cms-c-input-img" data-c-field="imgCatalogo" data-c-idx="${idx}" value="${String(c.imgCatalogo || "").replace(/"/g, "&quot;")}" placeholder="URL/Caminho da Foto" />
            <label class="btn-cms-color-upload" title="Enviar nova foto para esta cor">
              📷 Foto
              <input type="file" accept="image/*" data-c-upload-idx="${idx}" style="display:none;" />
            </label>
            <button type="button" class="btn-cms-remove-row" data-c-del-idx="${idx}" title="Remover esta cor">&times;</button>
          </div>
        `;
        }
      )
      .join("");

    // Sincroniza alterações nos inputs e selects de cada cor
    container.querySelectorAll("[data-c-field]").forEach((inp) => {
      const evtName = inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(evtName, (e) => {
        const idx = Number(inp.dataset.cIdx);
        const field = inp.dataset.cField;
        if (!cmsState.coresTempEditando[idx]) return;
        cmsState.coresTempEditando[idx][field] = e.target.value;
        if (field === "estoqueStatus") {
          inp.className = `cms-c-input-stock stock-${e.target.value}`;
        }
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
    const estoqueSelectEl = document.getElementById("cms-prod-estoque");
    if (estoqueSelectEl) {
      estoqueSelectEl.value = item.estoqueStatus || "disponivel";
    }
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

    // QR Code individual do produto no editor
    const qrWrap = document.getElementById("cms-editor-qr-preview");
    const qrText = document.getElementById("cms-editor-qr-code-text");
    const qrPayload = `SJ3D:PROD:${item.id}`;
    if (qrWrap) {
      renderizarQrCodeHtml(qrWrap, qrPayload, 76);
    }
    if (qrText) {
      qrText.textContent = qrPayload;
    }

    const btnPrintSingleQr = document.getElementById("btn-cms-print-single-qr");
    if (btnPrintSingleQr) {
      btnPrintSingleQr.onclick = () => {
        imprimirEtiquetaQrIndividual({
          id: item.id,
          nome: item.nome,
          codigo: item.id,
          preco: item.precoVista,
          imagem: item.imagem,
          marca: item.marca
        });
      };
    }

    // Se for um produto de filamento com paleta de cores, carrega o editor de cores
    const colorsBlock = document.getElementById("cms-filament-colors-block");
    const select2Wrap = document.getElementById("cms-prod-select2-wrap");
    const btnPrintColorsQr = document.getElementById("btn-cms-print-filament-colors-qr");
    const chavePaleta = item.tipoFilamento ? mapearChavePaletaSiteData(item.usaCoresDinamicas) : null;

    if (chavePaleta && Array.isArray(window.SITE_DATA[chavePaleta])) {
      cmsState.chavePaletaEditando = chavePaleta;
      cmsState.coresTempEditando = JSON.parse(JSON.stringify(window.SITE_DATA[chavePaleta]));
      if (colorsBlock) colorsBlock.style.display = "block";
      if (select2Wrap) select2Wrap.style.display = "none";
      if (btnPrintColorsQr) {
        btnPrintColorsQr.style.display = "inline-flex";
        btnPrintColorsQr.onclick = () => {
          imprimirCartelaQrCodes(cmsState.coresTempEditando.map(c => ({
            id: `${item.id}-${c.cod}`,
            nome: `${item.nome} (${c.nome})`,
            codigo: c.cod ? `CÓD. ${c.cod}` : item.id,
            preco: c.preco || item.precoVista,
            qrPayload: `SJ3D:FIL:${item.id}:${c.cod || c.nome}`
          })));
        };
      }
      renderizarListaCoresFilamentoCms();
    } else {
      cmsState.chavePaletaEditando = null;
      cmsState.coresTempEditando = [];
      if (colorsBlock) colorsBlock.style.display = "none";
      if (select2Wrap) select2Wrap.style.display = "flex";
      if (btnPrintColorsQr) btnPrintColorsQr.style.display = "none";
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
    configurarEventosNovosModulosCms();

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

    // (Removido) Login Google / "Balcão Rápido" sem senha na Área Restrita — apenas e-mail + senha aprovados.

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
        mostrarFeedbackAuth("error", "Sistema de autenticação indisponível. Recarregue a página.");
      }
    });

    // SOLICITAR AUTORIZAÇÃO PARA SER ADMINISTRADOR (fica pendente até o Admin Oficial liberar)
    document.getElementById("form-register-auth")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = document.getElementById("reg-name-input")?.value.trim();
      const email = document.getElementById("reg-email-input")?.value.trim();
      const senha = document.getElementById("reg-senha-input")?.value.trim();
      const motivo = document.getElementById("reg-cargo-input")?.value.trim() || "";

      if (!nome || !email || !senha) {
        mostrarFeedbackAuth("error", "Preencha todos os campos obrigatórios.");
        return;
      }

      if (window.SJ_DB && window.SJ_DB.auth) {
        const result = await window.SJ_DB.auth.registrar({
          nome,
          email,
          senha,
          cargo: "Administrador Autorizado",
          motivo
        });
        if (result.sucesso) {
          mostrarFeedbackAuth("success", result.mensagem || "Solicitação enviada! Aguarde a liberação do Administrador Oficial.");
          e.target.reset();
          atualizarBadgesSolicitacoesPendentes();
          // NÃO faz login: o acesso só é liberado após aprovação
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

    aplicarMascaraCpfCnpj(document.getElementById("wiz-client-cpf"));
    aplicarMascaraTelefone(document.getElementById("wiz-client-phone"));

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

      if (cpfCliente) {
        const checkWizDoc = validarDocumentoCpfOuCnpj(cpfCliente);
        if (!checkWizDoc.valido) {
          const inpWizCpf = document.getElementById("wiz-client-cpf");
          atualizarFeedbackVisualCpfCnpj(inpWizCpf, true);
          inpWizCpf?.focus();
          mostrarToast(checkWizDoc.mensagem, "error");
          alert(checkWizDoc.mensagem);
          return;
        }
      }

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

    document.getElementById("admin-bar-btn-scanner")?.addEventListener("click", () => {
      abrirPainelAdminCms("consulta-qr");
      iniciarCameraLeitorQr();
    });

    document.getElementById("admin-bar-btn-clients")?.addEventListener("click", () => {
      abrirPainelAdminCms("clientes");
    });

    document.getElementById("crm-btn-open-scanner-quick")?.addEventListener("click", () => {
      selecionarAbaCms("consulta-qr");
      iniciarCameraLeitorQr();
    });

    document.getElementById("crm-top-btn-qr-shortcut")?.addEventListener("click", () => {
      selecionarAbaCms("consulta-qr");
      iniciarCameraLeitorQr();
    });

    document.getElementById("crm-top-btn-clients-shortcut")?.addEventListener("click", () => {
      selecionarAbaCms("clientes");
    });

    document.getElementById("header-btn-quote")?.addEventListener("click", () => {
      abrirEmissorOuPedirLogin();
    });

    document.getElementById("admin-bar-btn-history")?.addEventListener("click", () => {
      abrirModalHistoricoOrcamentos();
    });

    document.getElementById("admin-bar-btn-users")?.addEventListener("click", () => {
      abrirPainelAdminCms("equipe");
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

    document.getElementById("crm-top-btn-equipe-shortcut")?.addEventListener("click", () => {
      selecionarAbaCms("equipe");
    });

    document.getElementById("crm-btn-open-quote")?.addEventListener("click", () => {
      fecharPainelAdminCms();
      abrirEmissorOuPedirLogin();
    });

    document.getElementById("crm-btn-open-history")?.addEventListener("click", () => {
      fecharPainelAdminCms();
      abrirModalHistoricoOrcamentos();
    });

    // Filtros de estoque via KPIs clicáveis e select no CRM
    document.querySelectorAll("[data-cms-stock-kpi]").forEach((card) => {
      card.addEventListener("click", () => {
        const val = card.dataset.cmsStockKpi || "todos";
        cmsState.estoqueFiltro = val;
        document.querySelectorAll("[data-cms-stock-kpi]").forEach((c) => {
          c.classList.toggle("active", c === card);
        });
        const sel = document.getElementById("cms-stock-filter-select");
        if (sel) sel.value = val;
        renderizarListaProdutosCms();
      });
    });

    document.getElementById("cms-stock-filter-select")?.addEventListener("change", (e) => {
      const val = e.target.value || "todos";
      cmsState.estoqueFiltro = val;
      document.querySelectorAll("[data-cms-stock-kpi]").forEach((c) => {
        c.classList.toggle("active", c.dataset.cmsStockKpi === val);
      });
      renderizarListaProdutosCms();
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
      } catch (err) {
        mostrarToast(err.message || "Erro ao processar imagem.", "warning");
        e.target.value = "";
      }
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
      const estoqueStatus = document.getElementById("cms-prod-estoque")?.value || "disponivel";
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
        estoqueStatus,
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
      } catch (err) {
        mostrarToast(err.message || "Erro ao processar imagem.", "warning");
        e.target.value = "";
      }
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

    // Configurações do Supabase no CMS (Aba 4)
    document.getElementById("btn-cms-save-supabase")?.addEventListener("click", () => {
      const url = document.getElementById("cms-supabase-url")?.value?.trim();
      const key = document.getElementById("cms-supabase-key")?.value?.trim();
      if (!url || !key) {
        mostrarToast("⚠️ Preencha a URL do Projeto e a Anon Key do Supabase.", "warning");
        return;
      }
      if (window.SJ_SUPABASE) {
        const salvou = window.SJ_SUPABASE.salvarConfig(url, key);
        if (salvou) {
          atualizarStatusSupabaseNoCms();
          mostrarToast("⚡ Credenciais do Supabase salvas com sucesso!", "success");
        } else {
          mostrarToast("❌ Erro ao salvar credenciais.", "error");
        }
      }
    });

    document.getElementById("btn-cms-test-supabase")?.addEventListener("click", async () => {
      if (!window.SJ_SUPABASE || !window.SJ_SUPABASE.isConfigured()) {
        mostrarToast("⚠️ Salve as credenciais primeiro para testar.", "warning");
        return;
      }
      const client = window.SJ_SUPABASE.getClient();
      if (!client) {
        mostrarToast("❌ Falha ao inicializar o cliente Supabase.", "error");
        return;
      }
      try {
        const { error } = await client.from("configuracoes_site").select("chave").limit(1);
        if (error) {
          mostrarToast(`⚠️ Supabase respondeu: ${error.message}`, "warning");
        } else {
          mostrarToast("✅ Conexão com o Supabase testada e funcionando com sucesso!", "success");
        }
      } catch (err) {
        mostrarToast(`❌ Erro ao conectar com o Supabase: ${err.message}`, "error");
      }
    });

    // Link de Acesso Restrito (/admin) no Rodapé
    document.getElementById("footer-admin-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirPainelAdminCms("produtos");
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
        const abrirAdmin = () => abrirPainelAdminCms("produtos");
        if (window.SJ_SUPABASE) {
          window.SJ_SUPABASE.guardiao.validarAcessoRota(hash || path, abrirAdmin, () => {
            abrirModalAuthGoogle(abrirAdmin, "email");
          });
        } else if (state.usuarioGoogle) {
          abrirAdmin();
        } else {
          abrirModalAuthGoogle(abrirAdmin, "email");
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
        const termoEscapado = escaparHtml(termoRaw);
        const waUrl = `https://wa.me/5544991351318?text=${encodeURIComponent(
          `Olá Loja SJ 3D! Procurei por "${termoRaw}" no site e gostaria de saber se vocês têm disponível!`
        )}`;
        searchLiveDropdown.innerHTML = `
          <div class="search-live-empty">
            <span>Nenhum item encontrado para <strong>"${termoEscapado}"</strong>.</span>
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

    // Inicializa o Sistema do Cliente (Minha Conta, Favoritos, Pop-up e Nota Fiscal)
    configurarModalAuthCliente();
    atualizarBotaoHeaderConta();
    atualizarBadgeFavoritos();
    sincronizarStatusNotaFiscalCarrinho();

    // Tecla ESC Global para fechar qualquer modal, gaveta ou busca aberta (UX Pro Max)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      fecharModalRegrasSorteio();
      fecharModalCompararImpressoras();
      fecharModalAuthCliente();
      fecharModalPoliticaPrivacidade();
      fecharModalLgpdSolicitacao();
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

    document.getElementById("mobile-cart-jump-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirGavetaPedido();
    });

    document.getElementById("mobile-floating-cart")?.addEventListener("click", () => {
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

    // Guardar Pedido / Salvar Orçamento na Conta do Cliente
    document.getElementById("btn-save-box-order")?.addEventListener("click", () => {
      salvarPedidoOuOrcamentoCliente();
    });
    document.getElementById("drawer-btn-save-order")?.addEventListener("click", () => {
      salvarPedidoOuOrcamentoCliente();
    });
  });
})();

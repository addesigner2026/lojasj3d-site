/**
 * CATÁLOGO COMPLETO — LOJA SJ 3D (UMUARAMA - PR)
 * ============================================================
 * Estilo unificado em todo o site ("Monte o Seu Combo / Caixa"):
 * - Filamentos (Escolha entre Bambu Lab e MaxPrint, pesos e cores com troca visual)
 * - Impressoras 3D (A1 Mini, A1 Mini Combo, A1 Normal, A1 Combo, P2S e Snapmaker)
 * - Peças de Reposição & Acessórios (Hotends, Placas PEI, Kits de Extrusora/AMS)
 * - Manutenção & Assistência Técnica (Preventiva, Corretiva e Upgrades)
 */

window.SITE_DATA = {
  loja: {
    nome: "LOJA SJ 3D",
    razaoSocial: "SJ NOVAIS E CIA LTDA",
    cnpj: "66.275.129/0001-10",
    inscricaoEstadual: "91222907-67",
    whatsapp: "5544991351318",
    whatsappFormatado: "(44) 99135-1318",
    endereco: "Avenida Portugal, nº 6759 — Zona 1A, Umuarama - PR",
    logradouroNumero: "Avenida Portugal, nº 6759",
    bairro: "Zona 1A",
    cidadeUf: "Umuarama/PR",
    cep: "87.501-000",
    email: "contato@gruposj.com.br",
    horario: "Seg a Sex: 09h às 17h | Sáb: 09h às 13h",
    instagramUrl: "https://www.instagram.com/lojasj3d/",
    facebookUrl: "https://www.facebook.com/lojasj3d",
    googleMeuNegocioUrl: "https://share.google/0WwPhjFx69b3V9sU1",
    comunidadeVipUrl: "https://chat.whatsapp.com/B5XUuxuVaY59cUdVUvd5ea",
    grupoMarcas: ["LOJA SJ 3D", "MAXIMPER", "BLINDAMIX", "VUMORA"],
    timbradoCabecalhoImg: "assets/orcamento/timbrado_cabecalho.png",
    timbradoRodapeImg: "assets/orcamento/timbrado_rodape.png"
  },

  // =========================================================================
  // BANNER DE PROMOÇÕES & CAMPANHAS DA CAPA (EDITÁVEL PELO PAINEL /ADMIN)
  // =========================================================================
  bannerPromocao: {
    ativo: true,
    exibirBannerSecaoImpressoras: true,
    exibirCuponsCarrinho: true,
    estilo: "sorteio", // "sorteio" ou "promocao"
    badge: "🔥 BLACK SJ 3D • GRANDE SORTEIO",
    dataSorteio: "SORTEIO: 20 DE DEZEMBRO",
    tituloKicker: "REVENDA AUTORIZADA OFICIAL",
    tituloPrincipal: "SORTEIO <em>BAMBU LAB A1 MINI</em>",
    subtituloPremio: "+ KIT COM 4 KG DE FILAMENTOS INCLUSO",
    descricaoCurta: "Participe do nosso sorteio oficial e concorra a uma Impressora 3D Bambu Lab A1 Mini completa!",
    precoDestaque: "A CADA FILAMENTO = 1 CUPOM • A CADA IMPRESSORA = 10 CUPONS",
    imagemFundo: "assets/produtos/banner-sorteio-natal-wide.jpg",
    btn1Texto: "Garantir Cupons no WhatsApp →",
    btn1Url: "https://wa.me/5544991351318?text=Ol%C3%A1%20Loja%20SJ%203D!%20Vi%20o%20banner%20do%20site%20e%20quero%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Sorteio%20da%20Bambu%20Lab%20A1%20Mini!",
    btn2Texto: "Regulamento do Sorteio",
    btn2Url: "",
    vipBannerAtivo: true,
    vipBannerDesktopImg: "assets/banners/desktop/comunidade-vip.png",
    vipBannerDesktopWebp: "assets/banners/desktop/comunidade-vip.webp",
    vipBannerMobileImg: "assets/banners/mobile/comunidade-vip.png",
    vipBannerMobileWebp: "assets/banners/mobile/comunidade-vip.webp",
    vipBannerBadge: "Comunidade Loja SJ",
    vipBannerTitulo: "Comunidade Loja SJ — Sua conexão com o universo 3D",
    vipBannerSubtitulo: "Tudo em um só lugar: suporte e dúvidas, promoções da loja, novidades e lançamentos",
    vipBannerBtnTexto: "Entrar na Comunidade",
    regrasCards: [
      {
        tag: "CUPONS GRÁTIS",
        titulo: "Retirada Grátis no Showroom",
        texto: "Visite a loja física da Loja SJ 3D em Umuarama, siga o Instagram @lojasj3d e retire até 3 cupons gratuitos por CPF, sem precisar comprar nada."
      },
      {
        tag: "FILAMENTOS & PEÇAS",
        titulo: "1 Cupom a cada R$ 60 em Compras",
        texto: "A cada R$ 60 gastos em filamentos, peças de reposição ou serviços na Loja SJ 3D você ganha 1 cupom cumulativo na urna."
      },
      {
        tag: "IMPRESSORAS 3D",
        titulo: "10 Cupons Imediatos",
        texto: "Na compra de qualquer impressora 3D Bambu Lab (A1 Mini, A1, P2S) ou Snapmaker U1 você garante 10 cupons na hora para concorrer!"
      }
    ]
  },

  // =========================================================================
  // BANNERS OFICIAIS DO CARROSSEL HERO (LOJA SJ 3D — V2 RESPONSIVO + DATAS)
  // =========================================================================
  // Dica: preencha dataInicio / dataFim no formato "AAAA-MM-DD" para agendar
  // entrada e saída automática de campanhas (deixe "" para manter sempre ativo).
  bannersBlackSJ: [
    {
      id: "banner-sorteio-a1-mini",
      itemId: "sorteio-a1-mini",
      titulo: "Grande Sorteio Bambu Lab A1 Mini + Kit com 4kg de Filamentos — Sorteio 20 de Dezembro",
      desktopWebp: "",
      desktopPng: "assets/banners/desktop/00-sorteio.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/mobile/00-sorteio.jpg",
      dataInicio: "",
      dataFim: "2026-12-20",
      isSorteio: true
    },
    {
      id: "banner-a1-mini",
      itemId: "imp-bambu-a1-mini",
      titulo: "Impressora 3D Bambu Lab A1 Mini — A partir de R$ 1.961,00 à vista ou 10x de R$ 217,90 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-a1-mini-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-a1-mini-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-a1-mini-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-a1-mini-combo",
      itemId: "imp-bambu-a1-mini-combo",
      titulo: "Impressora 3D Bambu Lab A1 Mini Combo com AMS Lite — A partir de R$ 3.199,00 à vista ou 10x de R$ 359,90 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-a1-mini-combo-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-a1-mini-combo-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-a1-mini-combo-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-pla-masterprint",
      itemId: "fil-pla-maxprint",
      titulo: "Filamento PLA Masterprint 1 kg — A partir de R$ 84,90 por unidade na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-pla-masterprint-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-pla-masterprint-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-pla-masterprint-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-pla-bambu-lab",
      itemId: "fil-pla-bambulab",
      titulo: "Filamento PLA Bambu Lab RFID 1 kg — A partir de R$ 104,90 por unidade na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-pla-bambu-lab-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-pla-bambu-lab-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-pla-bambu-lab-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-petg-masterprint",
      itemId: "fil-petg-maxprint",
      titulo: "Filamento PETG Masterprint 1 kg — A partir de R$ 64,90 por unidade na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-petg-masterprint-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-petg-masterprint-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-petg-masterprint-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-a1",
      itemId: "imp-bambu-a1-normal",
      titulo: "Impressora 3D Bambu Lab A1 — A partir de R$ 2.699,00 à vista ou 10x de R$ 303,00 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-a1-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-a1-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-a1-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-a1-combo",
      itemId: "imp-bambu-a1-combo",
      titulo: "Impressora 3D Bambu Lab A1 Combo com AMS Lite — A partir de R$ 4.049,00 à vista ou 10x de R$ 449,90 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-a1-combo-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-a1-combo-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-a1-combo-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-p2s-combo",
      itemId: "imp-bambu-p2s",
      titulo: "Impressora 3D Bambu Lab P2S Combo — A partir de R$ 8.849,00 à vista ou 10x de R$ 949,90 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-p2s-combo-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-p2s-combo-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-p2s-combo-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    },
    {
      id: "banner-snapmaker-u1",
      itemId: "imp-snapmaker",
      titulo: "Impressora 3D Snapmaker U1 — A partir de R$ 9.991,00 à vista ou 10x de R$ 1.099,00 na Loja SJ 3D",
      desktopWebp: "assets/banners/v2/banner-snapmaker-u1-v2-1920.webp",
      desktopPng: "assets/banners/v2/banner-snapmaker-u1-v2-1280.jpg",
      mobileWebp: "",
      mobilePng: "assets/banners/v2/banner-snapmaker-u1-v2-960.jpg",
      somenteHorizontal: true,
      dataInicio: "",
      dataFim: ""
    }
  ],

  // =========================================================================
  // PALETAS OFICIAIS DO CATÁLOGO DE FILAMENTOS LOJA SJ (55 PÁGINAS)
  // =========================================================================

  // 1. BAMBU LAB (Páginas 43 a 49 do PDF — Carretel RFID R$ 99,90/R$ 119,90 | Refil RFID R$ 79,90 — 22 Cores/Opções)
  coresBambuLab: [
    { nome: "Laranja", cod: "137", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#F04E23", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_137.png?v=20261108_08" },
    { nome: "Preto", cod: "110", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_110.png?v=20261108_08" },
    { nome: "Branco", cod: "135", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_135.png?v=20261108_08" },
    { nome: "Cinza", cod: "145", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#71717A", filtroCss: "grayscale(1) brightness(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_145.png?v=20261108_08" },
    { nome: "Azul Ciano", cod: "136", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#0284C7", filtroCss: "hue-rotate(175deg) saturate(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_136.png?v=20261108_08" },
    { nome: "Verde", cod: "115", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#16A34A", filtroCss: "hue-rotate(98deg) saturate(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_115.png?v=20261108_08" },
    { nome: "Vermelho", cod: "167", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#DC2626", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_167.png" },
    { nome: "Amarelo Sol", cod: "113", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#FACC15", filtroCss: "hue-rotate(32deg) saturate(1.15) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_113.png?v=20261108_08" },
    { nome: "Amarelo Girassol", cod: "116", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#F59E0B", filtroCss: "hue-rotate(22deg) saturate(1.12)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_116.png?v=20261108_08" },
    { nome: "Matte Bege (Fosco)", cod: "112", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#E5D3B3", filtroCss: "hue-rotate(25deg) saturate(0.45) brightness(1.12)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_112.png?v=20261108_08" },
    { nome: "Matte Azul Marinho", cod: "186", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#1E3A8A", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_186.png" },
    { nome: "Matte Azul Escuro", cod: "187", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#1E40AF", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_187.png" },
    { nome: "Marrom Brownie", cod: "166", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, tipo: "1KG Carretel RFID", hex: "#5C4033", filtroCss: "hue-rotate(-8deg) saturate(0.55) brightness(0.82)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_166.png?v=20261108_08" },
    { nome: "Dourado (Silk / Especial)", cod: "185", peso: "1 kg", preco: "R$ 124,90", valor: 124.90, tipo: "1KG Carretel RFID", hex: "#D4AF37", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_185.png" },
    { nome: "Rose (Silk / Especial)", cod: "191", peso: "1 kg", preco: "R$ 124,90", valor: 124.90, tipo: "1KG Carretel RFID", hex: "#F43F5E", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_191.png" },
    { nome: "Purple (Silk / Especial)", cod: "192", peso: "1 kg", preco: "R$ 124,90", valor: 124.90, tipo: "1KG Carretel RFID", hex: "#7E22CE", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_192.png" },
    { nome: "Refil Branco", cod: "146", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_146.png?v=20261108_08" },
    { nome: "Refil Cinza", cod: "147", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#71717A", filtroCss: "grayscale(1) brightness(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_147.png?v=20261108_08" },
    { nome: "Refil Cinza Escuro", cod: "184", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#4B5563", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_184.png" },
    { nome: "Refil Verde", cod: "151", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#16A34A", filtroCss: "hue-rotate(98deg) saturate(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_151.png?v=20261108_08" },
    { nome: "Refil Amarelo", cod: "114", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#FACC15", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_114.png" },
    { nome: "Refil Amarelo Girassol", cod: "117", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#F59E0B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/img_117.jpg" },
    { nome: "Refil Azul", cod: "183", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, tipo: "1KG Refil RFID", hex: "#1D4ED8", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_183.png" }
  ],

  // 2. PLA MASTERPRINT / MAXPRINT (Páginas 2 a 21 do PDF — 51 Cores Oficiais)
  coresMaxPrint: [
    { nome: "Preto", cod: "178", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#18181B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_178.png" },
    { nome: "Preto", cod: "34", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_34.jpg" },
    { nome: "Branco", cod: "36", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_36.jpg" },
    { nome: "Laranja", cod: "95", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F04E23", filtroCss: "hue-rotate(115deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_95.jpg" },
    { nome: "Laranja Nascer do Sol", cod: "94", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#FB7185", filtroCss: "hue-rotate(105deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_94.jpg" },
    { nome: "Vermelho", cod: "86", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#DC2626", filtroCss: "hue-rotate(92deg) saturate(1.25)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_86.jpg" },
    { nome: "Vermelho/Dourado Dual", cod: "190", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#DC2626", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_190.png" },
    { nome: "Azul Escuro", cod: "87", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#1D4ED8", filtroCss: "hue-rotate(-45deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_87.jpg" },
    { nome: "Azul Ártico", cod: "81", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#7DD3FC", filtroCss: "hue-rotate(-75deg) saturate(0.85) brightness(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_81.jpg" },
    { nome: "Azul Claro", cod: "177", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#38BDF8", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_177.png" },
    { nome: "Peacock Blue (Azul Pavão)", cod: "193", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#0891B2", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_193.png" },
    { nome: "Fosco Azul", cod: "189", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#2563EB", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_189.png" },
    { nome: "Fosforescente Azul", cod: "195", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#67E8F9", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_195.png" },
    { nome: "Fosforescente Azul", cod: "198", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#38BDF8", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/img_198.jpg" },
    { nome: "Verde", cod: "199", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#16A34A", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_173.png" },
    { nome: "Verde Bambu", cod: "91", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#22C55E", filtroCss: "hue-rotate(-135deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_91.jpg" },
    { nome: "Verde Claro", cod: "82", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#86EFAC", filtroCss: "hue-rotate(-135deg) saturate(0.75) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_82.jpg" },
    { nome: "Verde Claro", cod: "200", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#86EFAC", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_82.jpg" },
    { nome: "Verde Escuro", cod: "121", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#14532D", filtroCss: "hue-rotate(-135deg) saturate(0.9) brightness(0.8)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_121.jpg" },
    { nome: "Fosco Verde", cod: "159", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#16A34A", filtroCss: "hue-rotate(-135deg) saturate(1.05)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_159.jpg" },
    { nome: "Fosco Verde Militar", cod: "158", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#4D5D3B", filtroCss: "hue-rotate(-125deg) saturate(0.55) brightness(0.85)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_158.jpg" },
    { nome: "Fosco Preto Carbono", cod: "157", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#27272A", filtroCss: "grayscale(1) brightness(0.78)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_157.jpg" },
    { nome: "Fosco White Jade", cod: "171", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F3F4F6", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_171.png" },
    { nome: "Fosco Bleached Apricot", cod: "169", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#FDBA74", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_169.png" },
    { nome: "Fosco Winsome Orchid", cod: "170", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#C084FC", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_170.png" },
    { nome: "Fosco Sakura Rosa", cod: "201", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F9A8D4", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/img_201.jpg" },
    { nome: "Cinza", cod: "37", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#71717A", filtroCss: "grayscale(1) brightness(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_37.jpg" },
    { nome: "Cinza Fosco", cod: "66", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#71717A", filtroCss: "grayscale(1) brightness(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_66.jpg" },
    { nome: "Cinza Claro", cod: "67", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#6B7280", filtroCss: "grayscale(1) brightness(0.92)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_67.jpg" },
    { nome: "Prata Fosco", cod: "68", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#9CA3AF", filtroCss: "grayscale(1) brightness(1.02)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_68.jpg" },
    { nome: "Matter Gray", cod: "89", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#78716C", filtroCss: "grayscale(1) brightness(0.94)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_89.jpg" },
    { nome: "Lemon (Amarelo)", cod: "84", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#FDE047", filtroCss: "hue-rotate(148deg) saturate(1.2) brightness(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_84.jpg" },
    { nome: "Dourado", cod: "72", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#CA8A04", filtroCss: "hue-rotate(135deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_72.jpg" },
    { nome: "Deserto", cod: "85", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#D97706", filtroCss: "hue-rotate(130deg) saturate(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_85.jpg" },
    { nome: "Skin Cor de Pele", cod: "155", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#E0AC8B", filtroCss: "hue-rotate(118deg) saturate(0.6) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_155.jpg" },
    { nome: "Rosa", cod: "71", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F472B6", filtroCss: "hue-rotate(55deg) saturate(0.95) brightness(1.06)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_71.jpg" },
    { nome: "Rosa", cod: "197", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F472B6", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_71.jpg" },
    { nome: "Dragon Fruit", cod: "70", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#DB2777", filtroCss: "hue-rotate(65deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_70.jpg" },
    { nome: "Winsome Orchid", cod: "79", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#C084FC", filtroCss: "saturate(0.75) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_79.jpg" },
    { nome: "Roxo Claro", cod: "78", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#A855F7", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_78.jpg" },
    { nome: "Cobre", cod: "106", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#B45309", filtroCss: "hue-rotate(112deg) saturate(0.95) brightness(0.92)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_106.jpg" },
    { nome: "Marrom", cod: "108", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#654321", filtroCss: "hue-rotate(110deg) saturate(0.65) brightness(0.8)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_108.jpg" },
    { nome: "Café", cod: "180", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#451A03", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_180.png" },
    { nome: "Marrom Madeira", cod: "63", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#C19A6B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_63.jpg" },
    { nome: "Madeira", cod: "164", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#C19A6B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_164.jpg" },
    { nome: "Mármore", cod: "124", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#E5E7EB", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_124.jpg" },
    { nome: "Ice Cream (Multicor Pastel)", cod: "103", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#F472B6", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_103.jpg" },
    { nome: "Rainbow Florescente", cod: "83", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#EC4899", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_83.jpg" },
    { nome: "Fosco Rainbow", cod: "179", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#FB7185", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_179.png" },
    { nome: "Fosco Rainbow Dreamy", cod: "153", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#A78BFA", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_153.jpg" },
    { nome: "Dreamy Crystal Preto/Vermelho", cod: "156", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#991B1B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_156.jpg" },
    { nome: "Purple Glitter", cod: "80", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#581C87", filtroCss: "brightness(0.85) contrast(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_80.jpg" },
    { nome: "Verde Glitter", cod: "90", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#15803D", filtroCss: "hue-rotate(-135deg) brightness(0.88)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_90.jpg" },
    { nome: "Marrom Glitter", cod: "107", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#5C4033", filtroCss: "hue-rotate(110deg) saturate(0.6) brightness(0.82)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_107.jpg" },
    { nome: "Amarelo Glitter", cod: "149", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#EAB308", filtroCss: "hue-rotate(142deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_149.jpg" },
    { nome: "Transparente Preto/Azul Glitter", cod: "172", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#1E3A8A", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_172.png" }
  ],

  // 3. PLA SILK MASTERPRINT / MAXPRINT (Páginas 22 a 32 do PDF — 23 Cores Oficiais)
  coresPlaSilk: [
    { nome: "Dourado", cod: "69", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#D4AF37", filtroCss: "hue-rotate(138deg) saturate(1.25) brightness(1.05)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_69.jpg" },
    { nome: "Prata", cod: "38", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#C0C0C0", filtroCss: "grayscale(1) brightness(1.06) contrast(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_38.jpg" },
    { nome: "Preto", cod: "65", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_65.jpg" },
    { nome: "Branco", cod: "125", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_125.jpg" },
    { nome: "Bronze", cod: "105", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#8C6239", filtroCss: "hue-rotate(118deg) saturate(0.85) brightness(0.92)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_105.jpg" },
    { nome: "Cobre", cod: "194", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#B45309", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_194.png" },
    { nome: "Azul", cod: "88", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#1D4ED8", filtroCss: "hue-rotate(-45deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_88.jpg" },
    { nome: "Azul Azure", cod: "154", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#2563EB", filtroCss: "hue-rotate(-45deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_154.jpg" },
    { nome: "Azul Lago", cod: "168", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#0284C7", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_168.png" },
    { nome: "Azul Tiffany", cod: "126", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#14B8A6", filtroCss: "hue-rotate(-95deg) saturate(1.1)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_126.jpg" },
    { nome: "Verde", cod: "92", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#15803D", filtroCss: "hue-rotate(-135deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_92.jpg" },
    { nome: "Vermelho", cod: "139", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#DC2626", filtroCss: "hue-rotate(92deg) saturate(1.25)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_139.jpg" },
    { nome: "Vermelho Purpure", cod: "109", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#B91C1C", filtroCss: "hue-rotate(88deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_109.jpg" },
    { nome: "Rosa", cod: "120", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#EC4899", filtroCss: "hue-rotate(58deg) saturate(1.05)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_120.jpg" },
    { nome: "Fuchsia", cod: "134", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#C026D3", filtroCss: "hue-rotate(42deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_134.jpg" },
    { nome: "Roxo", cod: "93", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#7C3AED", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_93.jpg" },
    { nome: "Lavanda", cod: "76", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#C4B5FD", filtroCss: "saturate(0.65) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_76.jpg" },
    { nome: "Preto/Laranja Dual", cod: "75", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#F04E23", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_75.jpg" },
    { nome: "Azul/Vermelho Dual", cod: "74", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#2563EB", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_74.jpg" },
    { nome: "Azul/Roxo Dual", cod: "141", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#4F46E5", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_141.jpg" },
    { nome: "Azul/Preto/Roxo Tri", cod: "142", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#312E81", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_142.jpg" },
    { nome: "Rainbow", cod: "143", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#EC4899", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_143.jpg" },
    { nome: "Rainbow Happy", cod: "150", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#F59E0B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_150.jpg" },
    { nome: "Preto Glitter", cod: "123", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#27272A", filtroCss: "grayscale(1) brightness(0.78)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_123.jpg" }
  ],

  // 4. PETG MASTERPRINT / MAXPRINT (Páginas 33 a 42 do PDF — 24 Cores Oficiais)
  coresPetg: [
    { nome: "Preto", cod: "40", peso: "1 kg", preco: "R$ 64,90", valor: 64.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_40.jpg" },
    { nome: "Branco", cod: "64", peso: "1 kg", preco: "R$ 64,90", valor: 64.90, hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_64.jpg" },
    { nome: "Fosco Preto", cod: "152", peso: "1 kg", preco: "R$ 64,90", valor: 64.90, hex: "#27272A", filtroCss: "grayscale(1) brightness(0.78)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_152.jpg" },
    { nome: "Cinza", cod: "98", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#71717A", filtroCss: "grayscale(1) brightness(0.95)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_98.jpg" },
    { nome: "Prata", cod: "77", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#9CA3AF", filtroCss: "grayscale(1) brightness(1.0)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_77.jpg" },
    { nome: "Laranja", cod: "99", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#F04E23", filtroCss: "hue-rotate(115deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_99.jpg" },
    { nome: "Vermelho", cod: "176", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#DC2626", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_176.png" },
    { nome: "Azul", cod: "100", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#1D4ED8", filtroCss: "hue-rotate(-45deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_100.jpg" },
    { nome: "Verde", cod: "173", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#15803D", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_173.png" },
    { nome: "Verde Oliva", cod: "97", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, estoqueStatus: "esgotado", hex: "#4D5D3B", filtroCss: "hue-rotate(-125deg) saturate(0.55) brightness(0.85)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_97.jpg" },
    { nome: "Green Olive", cod: "175", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#4D5D3B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_175.png" },
    { nome: "Amarelo", cod: "131", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#EAB308", filtroCss: "hue-rotate(140deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_131.jpg" },
    { nome: "Dourado", cod: "73", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#CA8A04", filtroCss: "hue-rotate(135deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_73.jpg" },
    { nome: "Rosa", cod: "132", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#F472B6", filtroCss: "hue-rotate(55deg) saturate(0.95) brightness(1.06)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_132.jpg" },
    { nome: "Lavanda", cod: "133", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#C084FC", filtroCss: "saturate(0.75) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_133.jpg" },
    { nome: "Roxo", cod: "196", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#7C3AED", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_93.jpg" },
    { nome: "Skin", cod: "140", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#E0AC8B", filtroCss: "hue-rotate(118deg) saturate(0.6) brightness(1.08)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_140.jpg" },
    { nome: "Marrom", cod: "102", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#654321", filtroCss: "hue-rotate(110deg) saturate(0.65) brightness(0.8)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_102.jpg" },
    { nome: "Bronze", cod: "104", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#8C6239", filtroCss: "hue-rotate(118deg) saturate(0.85) brightness(0.92)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_104.jpg" },
    { nome: "Madeira", cod: "101", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#C19A6B", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_101.jpg" },
    { nome: "Translúcido Branco", cod: "144", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#E5E7EB", filtroCss: "grayscale(1) brightness(1.14)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_144.jpg" },
    { nome: "Transparente", cod: "181", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#E0F2FE", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_181.png" },
    { nome: "Branco PCV Outdoor", cod: "148", peso: "1 kg", preco: "R$ 74,90", valor: 74.90, hex: "#F8FAFC", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_148.jpg" },
    { nome: "Fosforescente Rainbow", cod: "174", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#34D399", filtroCss: "none", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_174.png" },
    { nome: "Carbono", cod: "39", peso: "1 kg", preco: "R$ 124,90", valor: 124.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.72) contrast(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_39.jpg" }
  ],

  // 5. TPU FLEXÍVEL 95A (Páginas 51 a 53 do PDF — 5 Cores Oficiais)
  coresTpu: [
    { nome: "Azul", cod: "122", peso: "1 kg", preco: "R$ 94,90", valor: 94.90, hex: "#1D4ED8", filtroCss: "hue-rotate(-45deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_122.jpg" },
    { nome: "Preto", cod: "160", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_160.jpg" },
    { nome: "Branco", cod: "161", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#F4F4F5", filtroCss: "grayscale(1) brightness(1.18)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_161.jpg" },
    { nome: "Verde", cod: "162", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#22C55E", filtroCss: "hue-rotate(-135deg) saturate(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_162.jpg" },
    { nome: "Laranja", cod: "163", peso: "1 kg", preco: "R$ 104,90", valor: 104.90, hex: "#F04E23", filtroCss: "hue-rotate(115deg) saturate(1.2)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_163.jpg" }
  ],

  // 6. ABS ENGENHARIA (Cód. 96 — duplicados 80, 90, 107, 149 movidos para PLA e Cód. 55 genérico removido)
  coresAbsEspeciais: [
    { nome: "Preto", cod: "96", peso: "1 kg", preco: "R$ 84,90", valor: 84.90, hex: "#18181B", filtroCss: "grayscale(1) brightness(0.75) contrast(1.15)", usaFotoCatalogoDireta: true, imgCatalogo: "assets/produtos/filamentos/cod_96.jpg" }
  ],

  // =========================================================================
  // CATÁLOGO COMPLETO UNIFICADO
  // =========================================================================
  catalogo: [
    // -------------------- 1. FILAMENTOS (CATÁLOGO OFICIAL LOJA SJ — 55 PÁGINAS) --------------------
    {
      id: "fil-pla-bambulab",
      categoria: "filamentos",
      marca: "Bambu Lab",
      permiteTrocarMarcaNoCard: true,
      nome: "PLA Bambu Lab (Carretel & Refil RFID)",
      subtitulo: "Chip RFID para leitura automática no AMS • Bico 190–230°C • 22 Opções (Carretel & Refil)",
      precoVista: "R$ 104,90",
      precoParcelado: "Refil RFID: R$ 84,90 • Carretel RFID: R$ 104,90 • Especiais: R$ 124,90",
      imagem: "assets/produtos/filamentos/cod_137.png?v=20261108_08",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel RFID", "1KG Refil RFID"],
      usaCoresDinamicas: "bambu",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Bambu Lab Original (Com Chip RFID Integrado)",
        "Material": "PLA Basic & PLA Matte High-Speed (1.75 mm ± 0.02 mm)",
        "Temperatura do Bico": "190 °C a 230 °C",
        "Temperatura da Mesa": "35 °C a 65 °C",
        "Velocidade de Impressão": "Até 300 mm/s (Compatível com AMS e AMS Lite)",
        "Opções no Catálogo Loja SJ": "Carretel 1kg (R$ 99,90 / R$ 119,90) e Refil 1kg (R$ 79,90) — 22 Opções Oficiais"
      }
    },
    {
      id: "fil-pla-maxprint",
      categoria: "filamentos",
      marca: "MaxPrint",
      permiteTrocarMarcaNoCard: true,
      nome: "PLA Masterprint — 51 Cores",
      subtitulo: "Clássico, Fosco, Madeira, Mármore, Rainbow e Glitter • Bico 190–220°C",
      precoVista: "R$ 84,90",
      precoParcelado: "Cores Padrão: R$ 84,90 • Mármore/Glitter: R$ 94,90 a R$ 104,90",
      imagem: "assets/produtos/filamentos/cod_34.jpg",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel Padrão"],
      usaCoresDinamicas: "maxprint",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Masterprint (Catálogo Oficial Loja SJ)",
        "Material": "PLA 1.75 mm (Tolerância ± 0.02 mm)",
        "Temperatura do Bico": "190 °C a 220 °C",
        "Temperatura da Mesa": "Desligada a 60 °C (recomendado 50–60 °C)",
        "Acabamentos Disponíveis": "Clássico, Fosco (Matte), Madeira, Mármore, Rainbow, Crystal e Glitter",
        "Peso Líquido": "1 kg"
      }
    },
    {
      id: "fil-silk-maxprint",
      categoria: "filamentos",
      marca: "MaxPrint",
      permiteTrocarMarcaNoCard: true,
      nome: "PLA Silk Metalizado & Dual/Tri Color — 23 Cores",
      subtitulo: "Brilho sedoso metálico, Dual Color, Tri Color e Rainbow • 23 Cores",
      precoVista: "R$ 94,90",
      precoParcelado: "Silk Sólido: R$ 94,90 • Dual/Tri/Rainbow: R$ 104,90",
      imagem: "assets/produtos/filamentos/cod_69.jpg",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel Padrão"],
      usaCoresDinamicas: "plasilk",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Masterprint",
        "Material": "PLA Silk (Efeito Metálico de Alto Brilho)",
        "Temperatura do Bico": "200 °C a 225 °C",
        "Temperatura da Mesa": "50 °C a 60 °C",
        "Cores Especiais": "Dourado, Prata, Bronze, Tiffany, Fuchsia, Dual (Preto/Laranja, Azul/Vermelho, Azul/Roxo), Tri Color e Rainbow Happy"
      }
    },
    {
      id: "fil-petg-maxprint",
      categoria: "filamentos",
      marca: "MaxPrint",
      permiteTrocarMarcaNoCard: true,
      nome: "PETG Alta Resistência — 24 Cores",
      subtitulo: "Resistência mecânica, térmica e Outdoor • Bico 220–240°C • Mesa 70–90°C",
      precoVista: "R$ 64,90",
      precoParcelado: "Preto/Branco: R$ 64,90 • Cores & Outdoor: R$ 74,90 • Rainbow Fosfor.: R$ 94,90 • Carbono: R$ 124,90",
      imagem: "assets/produtos/filamentos/cod_40.jpg",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel Padrão"],
      usaCoresDinamicas: "petg",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Masterprint",
        "Material": "PETG 1.75 mm (Alta Resistência Mecânica e Térmica)",
        "Temperatura do Bico": "220 °C a 240 °C",
        "Temperatura da Mesa": "70 °C a 90 °C",
        "Indicação": "Peças funcionais, suportes mecânicos, uso externo (PCV Outdoor) e PETG Carbono"
      }
    },
    {
      id: "fil-tpu-maxprint",
      categoria: "filamentos",
      marca: "MaxPrint",
      permiteTrocarMarcaNoCard: false,
      nome: "TPU Flexível Shore 95A — 1 kg",
      subtitulo: "Elástico e ultra resistente a impactos • Bico 210–225°C • 5 Cores",
      precoVista: "R$ 94,90",
      precoParcelado: "Azul (CÓD. 122): R$ 94,90 • Preto/Branco/Verde/Laranja: R$ 104,90",
      imagem: "assets/produtos/filamentos/cod_122.jpg",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel Padrão"],
      usaCoresDinamicas: "tpu",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Masterprint",
        "Material": "TPU Flexível (Poliuretano Termoplástico)",
        "Dureza Shore": "95A",
        "Temperatura do Bico": "190 °C a 230 °C (recomendado 210–225 °C)",
        "Temperatura da Mesa": "Desligada a 60 °C",
        "Velocidade Recomendada": "20 a 40 mm/s (Ideal para gaxetas, capas, pneus e amortecedores)"
      }
    },
    {
      id: "fil-abs-especiais",
      categoria: "filamentos",
      marca: "MaxPrint",
      permiteTrocarMarcaNoCard: false,
      nome: "ABS Engenharia & Especiais Glitter",
      subtitulo: "ABS Técnico para peças térmicas + Linha Especial com Glitter • 1.75mm",
      precoVista: "R$ 84,90",
      precoParcelado: "ABS Preto: R$ 84,90 • Especiais Glitter: R$ 84,90 a R$ 114,90",
      imagem: "assets/produtos/filamentos/cod_96.jpg",
      tipoFilamento: true,
      kgPorUnidade: 1,
      select1Label: "Apresentação",
      select1Opcoes: ["1KG Carretel Padrão"],
      usaCoresDinamicas: "absespeciais",
      corInicialIndex: 0,
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Marca": "Masterprint",
        "Materiais": "ABS Preto (CÓD. 96) e Linha Especial com Glitter (CÓD. 55, 80, 90, 107, 149)",
        "Temperatura Bico ABS": "230 °C a 250 °C (Mesa 90 °C a 110 °C em impressora fechada como P2S)",
        "Temperatura Bico Glitter": "200 °C a 225 °C (Recomendado bico >= 0.4 mm)"
      }
    },

    // -------------------- 2. IMPRESSORAS 3D (CATÁLOGO OFICIAL LOJA SJ: BAMBU LAB & SNAPMAKER U1) --------------------
    {
      id: "imp-bambu-a1-mini",
      categoria: "impressoras",
      marca: "Bambu Lab",
      grupoCatalogo: "COMECE A CRIAR",
      tagDestaque: "ESCOLHA INTELIGENTE",
      nome: "Bambu Lab A1 MINI",
      subtitulo: "CUSTO-BENEFÍCIO • COMPACTA",
      precoVista: "R$ 1.961,00",
      precoVistaValor: 1961.00,
      precoParcelado: "ou 10x de R$ 217,90",
      imagem: "assets/produtos/impressora-a1_mini.jpg",
      select1Opcoes: [
        "À Vista (R$ 1.961,00)",
        "10x de R$ 217,90"
      ],
      select2Opcoes: [
        "Somente Impressora A1 Mini",
        "Incluir Filamento PLA a escolher",
        "Participar Sorteio de Natal"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Bambu Lab A1 Mini",
        "Categoria Loja SJ": "Comece a Criar • Custo-Benefício • Compacta",
        "Condição à Vista": "R$ 1.961,00",
        "Parcelamento": "10x de R$ 217,90",
        "Volume de Impressão": "180 × 180 × 180 mm³",
        "Velocidade e Calibração": "Até 500 mm/s • Nivelamento e Fluxo 100% Automáticos"
      }
    },
    {
      id: "imp-bambu-a1-mini-combo",
      categoria: "impressoras",
      marca: "Bambu Lab",
      grupoCatalogo: "COMECE A CRIAR",
      tagDestaque: "SUBA DE NÍVEL",
      nome: "Bambu Lab A1 MINI COMBO",
      subtitulo: "MULTICOR • MAIS CRIATIVIDADE",
      precoVista: "R$ 3.199,00",
      precoVistaValor: 3199.00,
      precoParcelado: "ou 10x de R$ 359,90",
      imagem: "assets/produtos/impressora-a1_mini_combo.jpg",
      select1Opcoes: [
        "À Vista (R$ 3.199,00)",
        "10x de R$ 359,90"
      ],
      select2Opcoes: [
        "A1 Mini + AMS Lite (4 Cores)",
        "Incluir Filamentos Masterprint",
        "Incluir Filamentos Bambu Lab RFID"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Bambu Lab A1 Mini Combo (com AMS Lite)",
        "Categoria Loja SJ": "Comece a Criar • Multicor • Mais Criatividade",
        "Condição à Vista": "R$ 3.199,00",
        "Parcelamento": "10x de R$ 359,90",
        "Volume de Impressão": "180 × 180 × 180 mm³",
        "Sistema Multicor": "AMS Lite para 4 cores incluso com leitor RFID"
      }
    },
    {
      id: "imp-bambu-a1-normal",
      categoria: "impressoras",
      marca: "Bambu Lab",
      grupoCatalogo: "EVOLUA SUA PRODUÇÃO",
      tagDestaque: "ESCOLHA INTELIGENTE",
      nome: "Bambu Lab A1",
      subtitulo: "MAIS ÁREA • MAIS PRODUTIVIDADE",
      precoVista: "R$ 2.699,00",
      precoVistaValor: 2699.00,
      precoParcelado: "ou 10x de R$ 303,00",
      imagem: "assets/produtos/impressora-a1.jpg",
      select1Opcoes: [
        "À Vista (R$ 2.699,00)",
        "10x de R$ 303,00"
      ],
      select2Opcoes: [
        "Somente Impressora A1 (256³ mm)",
        "Incluir Filamentos Masterprint",
        "Incluir Filamentos Bambu Lab RFID"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Bambu Lab A1",
        "Categoria Loja SJ": "Evolua sua Produção • Mais Área • Mais Produtividade",
        "Condição à Vista": "R$ 2.699,00",
        "Parcelamento": "10x de R$ 303,00",
        "Volume de Impressão": "256 × 256 × 256 mm³",
        "Mesa Aquecida": "Até 100 °C com Placa PEI Texturizada inclusa"
      }
    },
    {
      id: "imp-bambu-a1-combo",
      categoria: "impressoras",
      marca: "Bambu Lab",
      grupoCatalogo: "EVOLUA SUA PRODUÇÃO",
      tagDestaque: "SUBA DE NÍVEL",
      nome: "Bambu Lab A1 COMBO",
      subtitulo: "MULTICOR • FLUXO EFICIENTE",
      precoVista: "R$ 4.049,00",
      precoVistaValor: 4049.00,
      precoParcelado: "ou 10x de R$ 449,90",
      imagem: "assets/produtos/impressora-a1_combo.jpg",
      select1Opcoes: [
        "À Vista (R$ 4.049,00)",
        "10x de R$ 449,90"
      ],
      select2Opcoes: [
        "A1 + AMS Lite (4 Cores)",
        "Incluir Filamentos Masterprint",
        "Incluir Filamentos Bambu Lab RFID"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Bambu Lab A1 Combo (com AMS Lite)",
        "Categoria Loja SJ": "Evolua sua Produção • Multicor • Fluxo Eficiente",
        "Condição à Vista": "R$ 4.049,00",
        "Parcelamento": "10x de R$ 449,90",
        "Volume de Impressão": "256 × 256 × 256 mm³",
        "Sistema Multicor": "AMS Lite de 4 cores incluso"
      }
    },
    {
      id: "imp-bambu-p2s",
      categoria: "impressoras",
      marca: "Bambu Lab",
      grupoCatalogo: "ALTA PERFORMANCE",
      tagDestaque: "ESCOLHA INTELIGENTE",
      nome: "Bambu Lab P2S COMBO",
      subtitulo: "DESEMPENHO PREMIUM • FECHADA",
      precoVista: "R$ 8.849,00",
      precoVistaValor: 8849.00,
      precoParcelado: "ou 10x de R$ 949,90",
      imagem: "assets/produtos/impressora-p2s_combo.jpg",
      select1Opcoes: [
        "À Vista (R$ 8.849,00)",
        "10x de R$ 949,90"
      ],
      select2Opcoes: [
        "P2S Combo (Fechada + AMS)",
        "Incluir Filamentos PLA / PETG / ABS",
        "Retirada / Envio Loja SJ Umuarama"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Bambu Lab P2S Combo",
        "Categoria Loja SJ": "Alta Performance • Desempenho Premium • Fechada",
        "Condição à Vista": "R$ 8.849,00",
        "Parcelamento": "10x de R$ 949,90",
        "Arquitetura": "CoreXY Fechada de Alta Velocidade com AMS incluso",
        "Materiais": "PLA, PETG, ABS, ASA, Nylon, TPU e Compostos"
      }
    },
    {
      id: "imp-snapmaker",
      categoria: "impressoras",
      marca: "Snapmaker",
      grupoCatalogo: "ALTA PERFORMANCE",
      tagDestaque: "SUBA DE NÍVEL",
      nome: "SNAPMAKER U1",
      subtitulo: "MULTICOLOR AVANÇADO • 4 CABEÇOTES",
      precoVista: "R$ 9.991,00",
      precoVistaValor: 9991.00,
      precoParcelado: "ou 10x de R$ 1.099,00",
      imagem: "assets/produtos/impressora-snapmaker_u1.jpg",
      select1Opcoes: [
        "À Vista (R$ 9.991,00)",
        "10x de R$ 1.099,00"
      ],
      select2Opcoes: [
        "Snapmaker U1 (4 Cabeçotes)",
        "Incluir Filamentos Multicores",
        "Retirada / Envio Loja SJ Umuarama"
      ],
      botaoTexto: "Adicionar ao Pedido",
      fichaTecnica: {
        "Modelo Oficial": "Snapmaker U1 — 4 Cabeçotes Independentes",
        "Categoria Loja SJ": "Alta Performance • Multicolor Avançado • 4 Cabeçotes",
        "Condição à Vista": "R$ 9.991,00",
        "Parcelamento": "10x de R$ 1.099,00",
        "Tecnologia Exclusiva": "Sistema de 4 cabeçotes independentes para impressão multicor real com alta velocidade e mínimo desperdício"
      }
    },

    // -------------------- 3. PEÇAS & ACESSÓRIOS --------------------
    {
      id: "peca-cooler-hotend-20000",
      categoria: "pecas",
      area: "Refrigeração & Hotend",
      paraQueServe: "Resfriamento ativo do dissipador térmico do bico, mantendo a zona fria estável e prevenindo entupimentos por retorno de calor (heat creep).",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Microventilador de Refrigeração do Hotend 20000 RPM (2 Unidades)",
      subtitulo: "Ventilador de alta rotação para resfriamento eficiente do bico hotend, evitando heat creep",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_cooler_hotend_20000.jpg",
      select1Opcoes: ["2 Peças"],
      select2Opcoes: ["Bambu Lab A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Velocidade": "20.000 RPM",
        "Quantidade": "2 Unidades (2PCS)",
        "Aplicação": "Refrigeração do dissipador do hotend para evitar entupimentos"
      }
    },
    {
      id: "peca-kit-ferramentas-40pcs",
      categoria: "pecas",
      area: "Manutenção & Pós-processamento",
      paraQueServe: "Remoção de suportes, nivelamento, desentupimento de bicos, corte rente e calibração fina de componentes mecânicos.",
      compatibilidade: "Universal (FDM & Resina)",
      nome: "Kit de Ferramentas Profissional para Impressão 3D (40 Peças)",
      subtitulo: "Kit completo com raspadores, limas diamantadas, alicates de corte, pinças e desentupidores",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_kit_ferramentas_40pcs.jpg",
      select1Opcoes: ["Kit Completo 40 Peças"],
      select2Opcoes: ["Universal FDM / Resina"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Universal para todas as impressoras 3D FDM e Resina",
        "Composição": "Alicate de corte rente, raspadores com lâminas plásticas/metálicas, pinças de precisão, limas diamantadas, agulhas de limpeza de bico",
        "Quantidade": "40 Itens essenciais de bancada"
      }
    },
    {
      id: "peca-oleo-graxa-lubrificante",
      categoria: "pecas",
      area: "Manutenção Mecânica & Eixos",
      paraQueServe: "Lubrificação preventiva de fusos trapezoidais Z, guias lineares e rolamentos metálicos, reduzindo ruído, atrito e desgaste.",
      compatibilidade: "Universal (Bambu Lab, Creality, Anycubic)",
      nome: "Kit Lubrificante de Precisão: Graxa Sintética & Óleo Mineral",
      subtitulo: "Lubrificação de precisão que reduz atrito, ruído e desgaste em fusos T8 e guias lineares",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_oleo_graxa_lubrificante.jpg",
      select1Opcoes: ["Pote com Pincel Aplicador"],
      select2Opcoes: ["Universal 3D"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab (A1, A1 Mini, P1S, X1C), Creality, Anycubic e eixos lineares",
        "Aplicação": "Fusos de elevação Z, guias lineares metálicas e rolamentos",
        "Acessório": "Acompanha pincel aplicador de alta precisão"
      }
    },
    {
      id: "peca-kit-hotend-bambu-a1",
      categoria: "pecas",
      area: "Cabeçote & Extrusão",
      paraQueServe: "Troca rápida magnética de hotend original com bico integrado. Permite alternar rapidamente entre diferentes diâmetros (0.2, 0.4, 0.6 e 0.8 mm) e materiais (Aço Temperado / Inox) conforme a necessidade de acabamento, velocidade e tipo de filamento.",
      compatibilidade: "Bambu Lab A1 / A1 Mini / A2L",
      nome: "Kit de Hotend com Bico Bambu A1 / A2L",
      subtitulo: "Bico de Aço Temperado & Inox 0.2 / 0.4 / 0.6 / 0.8 mm • Fixação Magnética Quick-Swap",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/hotend_bambu_a1_kit_completo.jpg",
      select1Label: "Diâmetro do Bico",
      select1Opcoes: ["0.2 mm", "0.4 mm", "0.6 mm", "0.8 mm"],
      select2Label: "Material do Bico",
      select2Opcoes: ["Aço Temperado", "Aço Inoxidável"],
      variantesDiametro: [
        {
          diametro: "0.2 mm",
          material: "Aço Inoxidável",
          imagem: "assets/produtos/pecas/hotend_bambu_a1_kit_completo.jpg",
          destaque: "Ultra Precisão",
          instrucao: "Ultra precisão e acabamento impecável. Ideal para miniaturas RPG, action figures, esculturas detalhadas e textos milimétricos com camadas ultrafinas."
        },
        {
          diametro: "0.4 mm",
          material: "Aço Temperado",
          imagem: "assets/produtos/pecas/hotend_bambu_a1_kit_completo.jpg",
          destaque: "Padrão Versátil",
          instrucao: "Diâmetro padrão e mais versátil. Perfeito para 95% das impressões diárias, oferecendo equilíbrio perfeito entre velocidade e acabamento impecável."
        },
        {
          diametro: "0.6 mm",
          material: "Aço Temperado",
          imagem: "assets/produtos/pecas/hotend_bambu_a1_kit_completo.jpg",
          destaque: "Alta Vazão & Abrasivos",
          instrucao: "Alta vazão volumétrica e resistência extrema ao desgaste abrasivo. Recomendado para filamentos com Fibra de Carbono, Madeira, Glow e menor tempo de impressão."
        },
        {
          diametro: "0.8 mm",
          material: "Aço Temperado",
          imagem: "assets/produtos/pecas/hotend_bambu_a1_kit_completo.jpg",
          destaque: "Máximo Fluxo High-Speed",
          instrucao: "Máxima velocidade e fluxo de plástico. Ideal para prototipagem rápida em grande escala, peças mecânicas gigantes e vasos estruturais de parede grossa."
        }
      ],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Nome do Produto": "Kit de hotend com bico Bambu A1/A2L",
        "Modelo Adaptável": "Bambu Lab A1 / A1 Mini / A2L",
        "Modo de Instalação": "Fixação magnética Quick-Swap (troca instantânea sem fios)",
        "Diâmetro do Bico": "0,2 mm / 0,4 mm / 0,6 mm / 0,8 mm",
        "Diâmetro do Filamento": "1,75 mm",
        "Tamanho do Produto": "21 * 16,5 * 49,4 mm",
        "Peso": "30 g",
        "Tipo de Filamento": "PLA, ABS, PETG, TPU, PPC, PC, Nylon, Fibra de Carbono, etc."
      }
    },
    {
      id: "peca-extrusora-original-a1",
      categoria: "pecas",
      area: "Sistema de Extrusão Direta",
      paraQueServe: "Tracionamento mecânico direto do filamento com engrenagens duplas de aço endurecido e motor de passo, garantindo fluxo contínuo sem patinar.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Unidade Extrusora Completa Original Bambu Lab A1 / A1 Mini",
      subtitulo: "Mecanismo de tracionamento direto com engrenagens de aço endurecido e motor integrado",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_extrusora_original_a1.jpg",
      select1Opcoes: ["Original Completa"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Tipo": "Direct Drive com engrenagens duplas de aço endurecido",
        "Condição": "Produto 100% Original Bambu Lab lacrado"
      }
    },
    {
      id: "peca-hub-ams-lite-5way",
      categoria: "pecas",
      area: "Sistema Multicolor AMS Lite",
      paraQueServe: "Conecta e canaliza as 4 vias de alimentação de filamento do AMS Lite em um único bocal de entrada no cabeçote de impressão.",
      compatibilidade: "Bambu Lab AMS Lite (A1 / A1 Mini)",
      nome: "Hub de Filamento 4 Vias AMS Lite (Five-Way Connector)",
      subtitulo: "Conector multiplexador de 4 vias original Bambu Lab para alimentação multicolor do AMS Lite",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_hub_ams_lite_5way.jpg",
      select1Opcoes: ["Five-Way Connector"],
      select2Opcoes: ["AMS Lite"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab AMS Lite (A1 e A1 Mini)",
        "Entradas / Saídas": "4 entradas para bobinas + 1 saída direta para o cabeçote",
        "Condição": "Original Bambu Lab de troca rápida"
      }
    },
    {
      id: "peca-tubo-ptfe-teflon-15m",
      categoria: "pecas",
      area: "Sistema de Alimentação de Filamento",
      paraQueServe: "Condução suave do filamento da bobina/AMS até o cabeçote, com baixíssimo coeficiente de atrito interno e alta flexibilidade.",
      compatibilidade: "Universal (Bambu Lab, Creality, Anycubic)",
      nome: "Tubo Guia de PTFE (Teflon Puro) de Alta Precisão (Rolo 15 Metros)",
      subtitulo: "Tubo capilar de baixo atrito para guia suave de filamento 1.75mm no AMS e cabeçote",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_tubo_ptfe_teflon_15m.jpg",
      select1Opcoes: ["Rolo de 15 Metros"],
      select2Opcoes: ["Filamento 1.75mm"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab X1C, P1P, P1S, A1, A1 Mini e AMS / AMS Lite",
        "Dimensões": "Diâmetro interno 2.0 mm / Diâmetro externo 4.0 mm",
        "Comprimento": "15 Metros contínuos de Teflon virgem de alta tolerância"
      }
    },
    {
      id: "peca-placa-cryogrip-panda-184",
      categoria: "pecas",
      area: "Mesa de Impressão / Plataforma",
      paraQueServe: "Fixação ultra forte de PLA e PETG a frio sem uso de cola bastão ou spray, com liberação espontânea da peça após resfriar.",
      compatibilidade: "Bambu Lab A1 Mini (184×184 mm)",
      nome: "Mesa Magnética CryoGrip Pro Panda (184×184mm)",
      subtitulo: "Superfície de adesão a frio com altíssima fixação de PLA e PETG sem necessidade de cola",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_placa_cryogrip_panda_184.jpg",
      select1Opcoes: ["184×184mm"],
      select2Opcoes: ["CryoGrip Pro"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 Mini (184×184 mm)",
        "Tecnologia": "Revestimento CryoGrip Pro com adesão molecular a frio",
        "Vantagem": "Elimina uso de cola spray/bastão e descola facilmente ao esfriar"
      }
    },
    {
      id: "peca-placa-carbono-pei-257",
      categoria: "pecas",
      area: "Mesa de Impressão / Plataforma",
      paraQueServe: "Aderência superior contra deformações (warping), acabamento texturizado fosco premium na base e fácil descolamento por flexão.",
      compatibilidade: "Bambu Lab A1, P1S, P1P, X1-Carbon (257×257 mm)",
      nome: "Placa de Construção PEI Texturizada Dupla Face (257×257mm)",
      subtitulo: "Chapa de alta aderência com textura jateada em ambos os lados e flexão para soltar a peça",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_placa_carbono_pei_257.jpg",
      select1Opcoes: ["257×257mm"],
      select2Opcoes: ["PEI Dupla Face"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1, P1P, P1S e X1-Carbon (257×257 mm)",
        "Acabamento": "PEI Texturizado em ambas as faces sobre aço mola flexível",
        "Resistência Térmica": "Suporta temperaturas de mesa de até 120 °C"
      }
    },
    {
      id: "peca-placa-pey-pey-257",
      categoria: "pecas",
      area: "Mesa de Impressão / Efeitos Especiais",
      paraQueServe: "Transfere reflexos ópticos iridescentes e padrões holográficos estrelados diretamente para a primeira camada impressa da peça.",
      compatibilidade: "Bambu Lab A1, P1S, P1P, X1-Carbon (257×257 mm)",
      nome: "Placa Holográfica PEY-PEY Dupla Face Efeito Phantom (257×257mm)",
      subtitulo: "Transfere acabamento holográfico e iridescente reflexivo para a primeira camada da peça",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_placa_pey_pey_257.jpg",
      select1Opcoes: ["257×257mm"],
      select2Opcoes: ["Holográfica PEY-PEY"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1, P1P, P1S e X1C (257×257 mm)",
        "Efeito Visual": "Padrão óptico holográfico Phantom Light Column",
        "Faces": "Dupla Face 100% utilizável em aço mola flexível magnético"
      }
    },
    {
      id: "peca-placa-peo-pei-257",
      categoria: "pecas",
      area: "Mesa de Impressão / Plataforma",
      paraQueServe: "Transfere dois acabamentos estéticos premium diretamente para a base da peça: padrão geométrico de diamante facetado de um lado e textura entrelaçada de fibra de carbono do outro.",
      compatibilidade: "Bambu Lab A1, P1S, P1P, X1-Carbon (257×257 mm)",
      nome: "Placa Híbrida Dupla Face: PEO Diamante + Fibra de Carbono (257×257mm)",
      subtitulo: "Acabamento duplo: Face PEO com padrão diamante facetado e Face com textura de fibra de carbono",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_placa_peo_pei_257.jpg",
      select1Opcoes: ["257×257mm"],
      select2Opcoes: ["PEO Diamante + Carbono"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1, P1P, P1S e X1C (257×257 mm)",
        "Face A": "PEO com microtextura geométrica facetada diamante espelhada",
        "Face B": "PET com textura entrelaçada estilo fibra de carbono",
        "Material Base": "Chapa de aço mola magnético de alta flexibilidade"
      }
    },
    {
      id: "peca-conjunto-aquecimento-v2",
      categoria: "pecas",
      area: "Eletrônica & Aquecimento do Cabeçote",
      paraQueServe: "Aquecimento ultrarrápido do bloco hotend até 300°C com controle térmico instantâneo e leitura precisa da temperatura.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Módulo de Aquecimento Cerâmico V2 com Termistor Integrado (5 Peças)",
      subtitulo: "Módulo aquecedor cerâmico e termistor blindado de alta precisão até 300 °C",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_conjunto_aquecimento_v2.jpg",
      select1Opcoes: ["Kit 5 Peças V2.0"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Versão": "V2.0 Atualizada com fiação reforçada e contato banhado a níquel",
        "Quantidade": "5 Peças completas com parafusos de montagem"
      }
    },
    {
      id: "peca-extrusora-fechada-a1",
      categoria: "pecas",
      area: "Sistema de Extrusão Direta",
      paraQueServe: "Conjunto motriz completo com engrenagens de aço endurecido calibradas de fábrica para substituição imediata sem folgas.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Caixa de Engrenagens da Extrusora Original Lacrada Bambu Lab",
      subtitulo: "Conjunto mecânico completo direto da fábrica pronto para substituição rápida",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_extrusora_fechada_a1.jpg",
      select1Opcoes: ["Caixa Lacrada Original"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Estado": "100% Original Bambu Lab, lacrada na embalagem original",
        "Aplicação": "Manutenção preventiva ou substituição imediata sem calibração manual"
      }
    },
    {
      id: "peca-cooler-refrigeracao-20000",
      categoria: "pecas",
      area: "Refrigeração & Hotend",
      paraQueServe: "Dissipação contínua de alta rotação para garantir estabilidade térmica no bloco de refrigeração do cabeçote.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Microventilador de Dissipação do Radiador Hotend 20000 RPM (Par)",
      subtitulo: "Ventoinha compacta de altíssima rotação para prevenir aquecimento do bico hotend",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_cooler_refrigeracao_20000.jpg",
      select1Opcoes: ["Par (2PCS)"],
      select2Opcoes: ["20000 RPM"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Velocidade": "20.000 RPM de rotação contínua",
        "Conector": "Conector original plug-and-play de 2 pinos micro",
        "Quantidade": "Par (2 Unidades)"
      }
    },
    {
      id: "peca-placa-controladora-th",
      categoria: "pecas",
      area: "Eletrônica Central do Cabeçote",
      paraQueServe: "Gerencia e interliga todos os periféricos do cabeçote: ventoinhas, sensores de nivelamento, aquecedor cerâmico e motor da extrusora.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Placa Controladora do Cabeçote Toolhead (TH Board Bambu Lab)",
      subtitulo: "Placa de circuito original que gerencia a eletrônica, sensores e aquecimento do cabeçote",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_placa_controladora_th.jpg",
      select1Opcoes: ["Placa TH Original"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Tipo": "Toolhead Control Board (TH Board)",
        "Aplicação": "Controle central dos sensores de nivelamento, ventoinhas e aquecimento"
      }
    },
    {
      id: "peca-sensor-filamento-hall-fpc",
      categoria: "pecas",
      area: "Sensores & Eletrônica",
      paraQueServe: "Detecção magnética sem atrito do avanço de filamento, pausando a impressão automaticamente em caso de quebra ou término de carretel.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Sensor de Filamento com Efeito Hall e Cabo FPC Flexível",
      subtitulo: "Detecção magnética ultra precisa de presença e esgotamento de filamento no cabeçote",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_sensor_filamento_hall_fpc.jpg",
      select1Opcoes: ["Sensor Hall + Cabo FPC"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Tecnologia": "Sensor Magnético Hall sem atrito mecânico",
        "Itens Inclusos": "Placa do sensor + Cabo FPC flexível original de conexão"
      }
    },
    {
      id: "peca-purge-wiper-limpador",
      categoria: "pecas",
      area: "Mecanismo de Limpeza & Purga",
      paraQueServe: "Raspagem automática do bico e ejeção limpa dos restos de filamento expurgados durante trocas de cores no sistema AMS.",
      compatibilidade: "Bambu Lab A1 / A1 Mini",
      nome: "Limpador e Descartador de Purga (Purge Wiper Assembly)",
      subtitulo: "Mecanismo de descarte e limpeza do bico para transição limpa entre trocas de cores",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_purge_wiper_limpador.jpg",
      select1Opcoes: ["Purge Wiper Completo"],
      select2Opcoes: ["A1 / A1 Mini"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 e Bambu Lab A1 Mini",
        "Função": "Raspador de bico e alavanca mecânica de descarte de purga (poop wiper)",
        "Quantidade": "Conjunto articulado completo pronto para montagem"
      }
    },
    {
      id: "peca-ventilador-blower-5015",
      categoria: "pecas",
      area: "Refrigeração de Camada & Upgrades",
      paraQueServe: "Refrigeração extrema direcionada para pontes (bridges), balanços críticos (overhangs) e impressões em velocidades extremas.",
      compatibilidade: "Bambu Lab A1 / A1 Mini (com dutos mod) & Impressoras 3D FDM",
      nome: "Ventilador Blower 5015 Radial 24V de Alta Pressão Estática (2 Peças)",
      subtitulo: "Ventoinha radial para refrigeração extrema de camada, pontes e balanços agressivos",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_ventilador_blower_5015.jpg",
      select1Opcoes: ["Par (2PCS 5015)"],
      select2Opcoes: ["Universal 3D / Mod"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Compatibilidade": "Bambu Lab A1 / A1 Mini com dutos customizados e impressoras FDM",
        "Dimensões": "50 x 50 x 15 mm (Blower 5015)",
        "Tensão / Conexão": "24V com conector de 2 pinos",
        "Quantidade": "2 Peças de alta durabilidade"
      }
    },
    {
      id: "peca-spray-adesivo-150ml",
      categoria: "pecas",
      marca: "Oficina SJ 3D",
      area: "Mesa de Impressão / Fixação",
      paraQueServe: "Spray adesivo contendo solução ideal para auxiliar suas impressões. De fácil aplicação, sua composição é solúvel em água para tornar mais fácil a limpeza de seu vidro após o uso (quando necessário). Tem boa aderência em até 4 impressões com a mesma aplicação e possui alto rendimento.",
      compatibilidade: "Universal (Vidro, PEI, Espelho, Aço Mola)",
      nome: "Spray Adesivo Fixador para Impressão 3D (110g / 150ml)",
      subtitulo: "Solução de alta aderência solúvel em água que previne o descolamento de peças e dura até 4 impressões",
      precoVista: "Sob Consulta",
      precoVistaValor: 0,
      precoParcelado: "Consulte disponibilidade",
      imagem: "assets/produtos/pecas/peca_spray_adesivo_150ml.jpg",
      select1Opcoes: ["Lata 110g / 150ml"],
      select2Opcoes: ["Solúvel em Água"],
      botaoTexto: "Consultar no WhatsApp",
      fichaTecnica: {
        "Volume / Peso": "150 ml / 110 g",
        "Rendimento": "Boa aderência em até 4 impressões com a mesma aplicação",
        "Limpeza": "100% Solúvel em água para limpeza rápida sem resíduos",
        "Compatibilidade": "Universal para superfícies de vidro, chapas flexíveis e plataformas 3D"
      }
    },
    // -------------------- 4. MANUTENÇÃO & ASSISTÊNCIA TÉCNICA --------------------
    {
      id: "manut-revisao-preventiva",
      categoria: "manutencao",
      marca: "Oficina SJ 3D",
      nome: "Revisão Preventiva & Calibração Completa 3D",
      subtitulo: "Limpeza profunda de extrusora, lubrificação de guias e calibração",
      precoVista: "Orçamento Rápido",
      precoVistaValor: 0,
      precoParcelado: "Atendimento em nossa bancada técnica em Umuarama - PR",
      imagem: "assets/produtos/impressora-a1.jpg",
      select1Opcoes: ["Umuarama", "Região PR"],
      select2Opcoes: [
        "Para Bambu Lab A1 Mini / Combo",
        "Para Bambu Lab A1 Normal / Combo",
        "Para Bambu Lab P2S",
        "Para Snapmaker / Outra"
      ],
      botaoTexto: "Solicitar no Pedido",
      fichaTecnica: {
        "Incluso": "Higienização, lubrificação de eixos X/Y/Z, ajuste de correias e Input Shaper",
        "Garantia": "Serviço com garantia técnica Loja SJ 3D Umuarama"
      }
    },
    {
      id: "manut-reparo-corretivo",
      categoria: "manutencao",
      marca: "Oficina SJ 3D",
      nome: "Manutenção Corretiva, Desentupimento & Reparo AMS",
      subtitulo: "Diagnóstico e conserto rápido na nossa bancada em Umuarama - PR",
      precoVista: "Orçamento Rápido",
      precoVistaValor: 0,
      precoParcelado: "Diagnóstico ágil • Peças de reposição originais em estoque",
      imagem: "assets/produtos/impressora-p2s_combo.jpg",
      select1Opcoes: ["Urgente", "Agendado"],
      select2Opcoes: [
        "Desentupimento / Troca Hotend",
        "Reparo de Alimentação AMS Lite / AMS",
        "Correção de Falha de Camada / Eixos",
        "Diagnóstico Completo na Bancada"
      ],
      botaoTexto: "Solicitar no Pedido",
      fichaTecnica: {
        "Local": "Av. Portugal, 6759 — Zona I-A, Umuarama - PR",
        "Suporte": "Atendimento direto pelo WhatsApp (44) 99135-1318"
      }
    },
    {
      id: "manut-upgrade-instalacao",
      categoria: "manutencao",
      marca: "Oficina SJ 3D",
      nome: "Instalação de Upgrades & Ajuste de Perfis de Filamento",
      subtitulo: "Parametrização fina para filamentos Masterprint e Bambu Lab",
      precoVista: "Orçamento Rápido",
      precoVistaValor: 0,
      precoParcelado: "Perfis calibrados para Bambu Studio e OrcaSlicer",
      imagem: "assets/produtos/pla-bambulab.jpg",
      select1Opcoes: ["Presencial", "Remoto/Loja"],
      select2Opcoes: [
        "Upgrade Kit Aço Endurecido",
        "Calibração de Fluxo Masterprint / Bambu",
        "Configuração para Print Farm"
      ],
      botaoTexto: "Solicitar no Pedido",
      fichaTecnica: {
        "Software": "Bambu Studio / OrcaSlicer",
        "Objetivo": "Máxima velocidade com qualidade de superfície perfeita"
      }
    }
  ]
};

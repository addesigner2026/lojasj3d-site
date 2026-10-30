# 🚀 Loja SJ 3D — Catálogo Oficial & E-commerce

> **Filamentos 3D (Bambu Lab RFID & Masterprint/MaxPrint), Impressoras 3D, Peças & Assistência Técnica Especializada em Umuarama - PR.**

---

## 📌 Sobre o Projeto

Este repositório contém o código-fonte do site e catálogo digital oficial da **Loja SJ 3D** ([@lojasj3d](https://www.instagram.com/lojasj3d/)), localizada em Umuarama - PR.

O projeto foi desenvolvido para oferecer uma experiência de compra ultra rápida, interativa e sem atritos, inspirada no design limpo e funcional das maiores marcas globais de impressão 3D (como Anycubic e Bambu Lab), adaptada para a identidade visual da Loja SJ (Laranja `#F04E23`, Preto `#111111` e Branco `#FFFFFF`).

### ✨ Principais Recursos

- **Catálogo Interativo de Filamentos**:
  - Seletor de cores em tempo real com swatch de cor e código exato.
  - Alternância rápida de marcas com *Segmented Control*: **Todas as Marcas**, **Bambu Lab (RFID)** e **Masterprint / MaxPrint**.
  - Suporte a múltiplos tipos de materiais: PLA Basic, PLA Silk Metalizado, Dual/Tri-Color, PETG Alta Resistência, TPU Flexível e ABS Engenharia.
- **Página de Detalhes do Produto (PDP)**:
  - Visualização em alta definição da peça impressa e do carretel.
  - Indicadores técnicos de temperatura do bico, temperatura da mesa, velocidade de impressão e densidade.
  - Seletor dinâmico de cores com visualização da foto correspondente.
- **Campanha de Sorteio Bambu Lab A1 Mini**:
  - Banner hero imersivo com as regras oficiais do sorteio de Natal.
  - Contador interativo de cupons em tempo real no carrinho (3 cupons grátis no balcão por CPF + 1 cupom a cada R$ 60 em compras + 10 cupons na compra de impressora).
- **Carrinho Lateral Dinâmico & Integração com WhatsApp**:
  - Cálculo instantâneo do valor total estimado e do peso em kg de filamentos.
  - Envio automatizado do pedido formatado diretamente para o WhatsApp oficial da loja com 1 clique.
  - Persistência local do carrinho (`localStorage`) para não perder os itens se o usuário recarregar a página.
- **SEO Local & Performance**:
  - Dados estruturados Schema.org (`LocalBusiness`, `Store`, `OfferCatalog`).
  - Metadados Open Graph para compartilhamento no WhatsApp e redes sociais.
  - CNPJ `66.275.129/0001-10` e localização física no rodapé.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico**: Estrutura acessível com ARIA labels, microdados Schema.org e navegação por teclado.
- **CSS3 Moderno**: Variáveis CSS (Design Tokens), CSS Grid, Flexbox, transições fluidas e responsividade completa para Desktop, Tablet e Mobile.
- **Vanilla JavaScript (ES6+)**: SPA leve e performática, sem dependência de frameworks pesados, garantindo carregamento instantâneo.
- **Node.js**: Servidor HTTP local leve (`server.js`) com roteamento e abertura automática do navegador para desenvolvimento.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js instalado (versão 14 ou superior) ou qualquer servidor web estático (ex: Live Server do VS Code).

### Passos:
1. Clone ou baixe o repositório:
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd Site
   ```

2. Inicie o servidor local:
   ```bash
   npm run dev
   # ou:
   node server.js
   ```

3. O navegador abrirá automaticamente em:
   ```
   http://localhost:3000
   ```

---

## 📂 Estrutura de Diretórios

```
Site/
├── assets/
│   ├── img/            # Logotipos, ícones e símbolos vetoriais da Loja SJ
│   └── produtos/       # Fotos em alta resolução de impressoras, filamentos e peças
├── css/
│   └── styles.css      # Folha de estilo completa com design system e responsividade
├── js/
│   ├── dados.js        # Base de dados dos produtos, especificações técnicas e cores
│   └── app.js          # Lógica da aplicação, navegação, carrinho e cálculo de cupons
├── index.html          # Ponto de entrada da aplicação (Single Page Application)
├── server.js           # Servidor local de desenvolvimento
├── package.json        # Configuração do projeto e scripts npm
├── robots.txt          # Diretrizes para indexadores de busca
└── sitemap.xml         # Mapa do site para indexação de SEO
```

---

## 📍 Contato & Loja Física

- **Razão Social / CNPJ**: 66.275.129/0001-10
- **Instagram Oficial**: [@lojasj3d](https://www.instagram.com/lojasj3d/)
- **WhatsApp**: (44) 99135-1318
- **Cidade**: Umuarama - Paraná


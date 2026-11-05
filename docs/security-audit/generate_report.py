#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador do Relatório de Auditoria de Segurança em PDF — Loja SJ 3D
Executado com o interpretador Python do ambiente venv:
/tmp/audit-venv/bin/python3 docs/security-audit/generate_report.py
"""

import os
import sys
import html

# Define diretório temporário para matplotlib antes de importá-lo
os.environ['MPLCONFIGDIR'] = '/tmp/matplotlib'
os.makedirs('/tmp/matplotlib', exist_ok=True)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# ==============================================================================
# 1. CANVAS COM NUMERAÇÃO DE PÁGINAS "Página X de Y" E CABEÇALHO/RODAPÉ
# ==============================================================================
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        if self._pageNumber == 1:
            # Não desenha cabeçalho nem rodapé na capa
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#71717A"))

        # Cabeçalho
        self.drawString(2 * cm, A4[1] - 1.3 * cm, "Relatório de Auditoria de Segurança — Loja SJ 3D (Umuarama - PR)")
        self.drawRightString(A4[0] - 2 * cm, A4[1] - 1.3 * cm, "CONFIDENCIAL • NOVEMBRO 2026")
        self.setStrokeColor(colors.HexColor("#E4E4E7"))
        self.setLineWidth(0.5)
        self.line(2 * cm, A4[1] - 1.5 * cm, A4[0] - 2 * cm, A4[1] - 1.5 * cm)

        # Rodapé
        self.line(2 * cm, 1.5 * cm, A4[0] - 2 * cm, 1.5 * cm)
        self.drawString(2 * cm, 1.1 * cm, "Auditoria Defensiva de Aplicação • Loja SJ 3D • docs/security-audit")
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(A4[0] - 2 * cm, 1.1 * cm, page_text)
        self.restoreState()


# ==============================================================================
# 2. GERAÇÃO DOS GRÁFICOS (DONUT & BARRAS)
# ==============================================================================
def gerar_graficos(output_dir="/tmp"):
    donut_path = os.path.join(output_dir, "audit_donut.png")
    bar_path = os.path.join(output_dir, "audit_bar.png")

    # Gráfico 1: Rosca por Severidade
    labels = ['Crítica', 'Alta', 'Média', 'Informativa']
    sizes = [4, 6, 2, 1]
    cores = ['#B91C1C', '#EA580C', '#D97706', '#64748B']

    fig, ax = plt.subplots(figsize=(3.4, 2.5), subplot_kw=dict(aspect="equal"))
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, autopct='%1.0f%%', pctdistance=0.75,
        colors=cores, startangle=140,
        textprops=dict(color="#18181B", fontsize=8, weight='bold')
    )
    for at in autotexts:
        at.set_color('white')
        at.set_fontsize(8)
        at.set_weight('bold')

    centre_circle = plt.Circle((0, 0), 0.55, fc='white')
    fig.gca().add_artist(centre_circle)
    ax.set_title("Achados por Severidade", fontsize=9, weight='bold', pad=8, color="#09090B")
    plt.tight_layout()
    plt.savefig(donut_path, dpi=200, bbox_inches='tight')
    plt.close()

    # Gráfico 2: Barras por Categoria
    categorias = [
        "1. Banco Sem Tranca",
        "2. Permissão Navegador",
        "3. IDOR",
        "4. Chaves Expostas",
        "5. Inputs / XSS"
    ]
    totais = [4, 2, 3, 4, 3]
    cores_bar = ['#B91C1C', '#EA580C', '#EA580C', '#B91C1C', '#EA580C']

    fig, ax = plt.subplots(figsize=(4.2, 2.5))
    bars = ax.barh(categorias, totais, color=cores_bar, height=0.55)
    ax.set_xlim(0, 5)
    ax.set_xlabel("Nº de Vulnerabilidades", fontsize=8, color="#52525B")
    ax.set_title("Achados por Categoria Auditada", fontsize=9, weight='bold', pad=8, color="#09090B")
    ax.tick_params(axis='both', which='major', labelsize=7.5)
    ax.invert_yaxis()
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#D4D4D8')
    ax.spines['bottom'].set_color('#D4D4D8')

    for bar in bars:
        w = bar.get_width()
        ax.annotate(f'{w}',
                    xy=(w, bar.get_y() + bar.get_height() / 2),
                    xytext=(4, 0),
                    textcoords="offset points",
                    ha='left', va='center', fontsize=8, weight='bold', color="#18181B")

    plt.tight_layout()
    plt.savefig(bar_path, dpi=200, bbox_inches='tight')
    plt.close()

    return donut_path, bar_path


# ==============================================================================
# 3. CONSTRUÇÃO DO DOCUMENTO PDF
# ==============================================================================
def criar_relatorio(pdf_path):
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
    donut_img, bar_img = gerar_graficos()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()

    # Estilos customizados
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#F04E23'),
        spaceAfter=15
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    issue_block_style = ParagraphStyle(
        'IssueBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.2,
        leading=9.5,
        textColor=colors.HexColor('#1E293B')
    )

    story = []

    # --------------------------------------------------------------------------
    # CAPA
    # --------------------------------------------------------------------------
    story.append(Spacer(1, 1.5 * cm))
    badge_html = (
        '<font color="#F04E23"><b>[AUDITORIA DE SEGURANÇA DEFENSIVA • VERSÃO 1.0]</b></font>'
    )
    story.append(Paragraph(badge_html, body_style))
    story.append(Paragraph("Relatório de Auditoria de Segurança — Loja SJ 3D", title_style))
    story.append(Paragraph("Revisão Exaustiva de Vulnerabilidades, Isolamento de Dados e RLS", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#F04E23"), spaceAfter=20))

    meta_table_data = [
        [Paragraph("<b>Projeto:</b>", body_style), Paragraph("Loja SJ 3D — Catálogo Oficial & Portal de Vendas", body_style)],
        [Paragraph("<b>Organização / Loja:</b>", body_style), Paragraph("SJ Novais e Cia Ltda (Umuarama - PR)", body_style)],
        [Paragraph("<b>Data da Auditoria:</b>", body_style), Paragraph("05 de Novembro de 2026", body_style)],
        [Paragraph("<b>Classificação:</b>", body_style), Paragraph("<font color='#B91C1C'><b>CONFIDENCIAL / RESTRITO</b></font>", body_style)],
        [Paragraph("<b>Escopo Auditado:</b>", body_style), Paragraph("<code>index.html</code>, <code>server.js</code>, <code>supabase/schema.sql</code>, <code>js/app.js</code>, <code>js/database.js</code>, <code>js/supabase-client.js</code>, <code>data/db.json</code>, repositório git.", body_style)],
        [Paragraph("<b>Stack Detectada:</b>", body_style), Paragraph("Node.js nativo (HTTP Server), Supabase Auth / PostgreSQL 15+ (PostgREST), Vanilla JS / HTML5 / CSS3, Base JSON local (<code>data/db.json</code>).", body_style)]
    ]
    t_meta = Table(meta_table_data, colWidths=[4 * cm, 13 * cm])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))

    story.append(Paragraph("<b>Nota Metodológica & Mapeamento para a Stack</b>", h2_style))
    metodologia_p = (
        "A auditoria cobriu cinco dimensões críticas de segurança da informação, mapeadas com exatidão para a arquitetura híbrida do projeto (Node.js nativo + Supabase Cloud + Vanilla JS):<br/>"
        "<b>1. Banco Sem Tranca (Isolamento de Tenant/Dono):</b> Verificação de políticas Row Level Security (RLS) no Supabase (cláusulas <code>USING/WITH CHECK</code> e concessões à role <code>authenticated</code>) e ausência de autenticação/filtro por usuário nas rotas REST do <code>server.js</code>.<br/>"
        "<b>2. Permissão Definida no Navegador:</b> Checagem de operações privilegiadas (cadastro de vendedor, edição de preços/catálogo, importação de base) onde o frontend oculta elementos visualmente via CSS/hash (<code>#admin</code>), mas os endpoints correspondentes não validam o papel de administrador no servidor.<br/>"
        "<b>3. IDOR:</b> Rastreamento sistemático de todos os parâmetros <code>:id</code> de rotas no backend e mutações via PostgREST sem validação de posse.<br/>"
        "<b>4. Chaves Expostas (Hardcode):</b> Varredura de credenciais estáticas, senhas em texto puro, segredos no Git (PAT) e backdoors de bypass de autenticação.<br/>"
        "<b>5. Inputs Sem Tratamento (XSS):</b> Inspeção de inserções diretas em <code>innerHTML</code> sem sanitização prévia."
    )
    story.append(Paragraph(metodologia_p, body_style))
    story.append(PageBreak())

    # --------------------------------------------------------------------------
    # RESUMO EXECUTIVO
    # --------------------------------------------------------------------------
    story.append(Paragraph("1. Resumo Executivo", h1_style))
    story.append(Paragraph(
        "Foram identificadas <b>13 vulnerabilidades</b> na aplicação, com prevalência de falhas críticas de "
        "<b>Isolamento de Dados no Supabase (RLS permissivo demais)</b>, <b>falta de autenticação nas rotas da API Node.js</b>, "
        "<b>backdoor de credenciais no frontend</b> e <b>DOM XSS por concatenação de inputs no dropdown de busca</b>. "
        "Apesar disso, foram identificados pontos fortes relevantes de arquitetura defensiva já presentes no código.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Tabela com métricas em cards
    kpi_data = [
        [
            Paragraph("<font color='#B91C1C' size=14><b>4</b></font><br/><font color='#7F1D1D' size=8><b>CRÍTICA</b></font>", body_style),
            Paragraph("<font color='#EA580C' size=14><b>6</b></font><br/><font color='#7C2D12' size=8><b>ALTA</b></font>", body_style),
            Paragraph("<font color='#D97706' size=14><b>2</b></font><br/><font color='#78350F' size=8><b>MÉDIA</b></font>", body_style),
            Paragraph("<font color='#64748B' size=14><b>1</b></font><br/><font color='#334155' size=8><b>INFORMATIVA</b></font>", body_style),
            Paragraph("<font color='#059669' size=14><b>6</b></font><br/><font color='#064E3B' size=8><b>PONTOS FORTES</b></font>", body_style),
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[3.4 * cm] * 5)
    t_kpi.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#FEE2E2')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#FFEDD5')),
        ('BACKGROUND', (2, 0), (2, 0), colors.HexColor('#FEF3C7')),
        ('BACKGROUND', (3, 0), (3, 0), colors.HexColor('#F1F5F9')),
        ('BACKGROUND', (4, 0), (4, 0), colors.HexColor('#D1FAE5')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 12))

    # Gráficos Lado a Lado
    charts_data = [
        [Image(donut_img, width=7.8 * cm, height=5.5 * cm),
         Image(bar_img, width=9.2 * cm, height=5.5 * cm)]
    ]
    t_charts = Table(charts_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_charts.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(t_charts)
    story.append(Spacer(1, 10))

    # --------------------------------------------------------------------------
    # PONTOS FORTES E PONTOS FRACOS
    # --------------------------------------------------------------------------
    story.append(Paragraph("2. Pontos Fortes e Pontos Fracos", h1_style))

    story.append(Paragraph("<b>Pontos Fortes Identificados (Proteções Ativas Verificadas):</b>", h2_style))
    pf_text = (
        "• <b>Prevenção Contra Path Traversal no Servidor (<code>server.js:444-448</code>):</b> Validação estrita via <code>filePath.startsWith(ROOT)</code>, bloqueando tentativas de navegação de diretório maliciosa (ex: <code>../../etc/passwd</code>).<br/>"
        "• <b>Proteção Contra DoS por Payload Gigante (<code>server.js:106-110</code>):</b> Limitação rígida de corpo de requisição em 10 MB (<code>body.length > 1e7</code>) com destruição imediata do socket.<br/>"
        "• <b>Isolamento Estrito em Atualização de Perfil Supabase (<code>schema.sql:239-245</code>):</b> A política de atualização de <code>perfis_usuarios</code> valida explicitamente <code>(select auth.uid()) = id</code>, impedindo edição de perfis de terceiros.<br/>"
        "• <b>Filtro de Catálogo Inativo para Usuários Anônimos (<code>schema.sql:187-192</code>):</b> Apenas produtos com <code>ativo = true</code> são visíveis publicamente na API.<br/>"
        "• <b>Tratamento Completo de CORS Preflight (<code>server.js:123-132</code>):</b> Suporte a requisições HTTP <code>OPTIONS</code> com resposta 204 e cabeçalhos apropriados.<br/>"
        "• <b>Gestão Segura de Sessão Supabase no Navegador (<code>js/supabase-client.js:64-70</code>):</b> Configuração nativa com <code>persistSession: true</code> e <code>autoRefreshToken: true</code> via SDK oficial."
    )
    story.append(Paragraph(pf_text, body_style))
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>Pontos Fracos Centrais (Riscos Sistêmicos):</b>", h2_style))
    pweak_text = (
        "• <b>Concessão RLS Irrestrita para 'authenticated' no Supabase:</b> Clientes cadastrados possuem o papel <code>authenticated</code> e, pelas regras atuais, herdam permissão para ler todos os clientes, alterar produtos e apagar orçamentos alheios.<br/>"
        "• <b>Ausência Total de Autenticação nas Rotas REST Locais (<code>server.js</code>):</b> As rotas de dump (<code>/api/db/export</code>), restauração (<code>/api/db/import</code>) e mutação de catálogo operam sem checagem de token ou sessão.<br/>"
        "• <b>Backdoor de Autenticação em Código-Fonte (<code>js/database.js:273-279</code>):</b> Verificação de credencial fixa (<code>contato@gruposj.com.br / 123456</code>) que promove qualquer usuário a Administrador no frontend.<br/>"
        "• <b>DOM XSS em Busca ao Vivo (<code>js/app.js:7057</code>):</b> Interpolação direta de <code>termoRaw</code> em <code>searchLiveDropdown.innerHTML</code> sem escape de entidades."
    )
    story.append(Paragraph(pweak_text, body_style))
    story.append(PageBreak())

    # --------------------------------------------------------------------------
    # TABELA DE ACHADOS DETALHADOS POR CATEGORIA
    # --------------------------------------------------------------------------
    story.append(Paragraph("3. Tabela de Achados Detalhados por Categoria", h1_style))
    story.append(Paragraph(
        "Abaixo estão todas as 13 vulnerabilidades verificadas diretamente no código real, com arquivo, "
        "linha(s), trecho explorável e justificativa técnica.",
        body_style
    ))
    story.append(Spacer(1, 6))

    achados_tabela = [
        [
            Paragraph("<b>Sev.</b>", body_style),
            Paragraph("<b>Arquivo:Linha</b>", body_style),
            Paragraph("<b>Categoria & Descrição Técnica do Achado</b>", body_style),
            Paragraph("<b>Impacto & Condição</b>", body_style)
        ],
        # 1. Banco Sem Tranca
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_style),
            Paragraph("<code>supabase/schema.sql</code><br/>L273-298", code_style),
            Paragraph("<b>RLS em <code>public.orcamentos</code> sem filtro de inquilino/dono.</b> Concede <code>SELECT, INSERT, UPDATE, DELETE</code> para <code>authenticated</code> com <code>USING (true)</code>. Clientes cadastrados têm role <code>authenticated</code> e conseguem ler/modificar orçamentos de todos.", body_style),
            Paragraph("Vazamento massivo e adulteração de propostas comerciais por qualquer cliente logado.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>supabase/schema.sql</code><br/>L246-271", code_style),
            Paragraph("<b>RLS em <code>public.clientes</code> expõe dados pessoais a clientes.</b> Concede <code>SELECT, UPDATE, DELETE</code> para <code>authenticated</code> com <code>USING (true)</code>.", body_style),
            Paragraph("Exposição de CPF/CNPJ, WhatsApp e endereços de toda a carteira de clientes da loja.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>server.js</code><br/>L280-285, L359-364", code_style),
            Paragraph("<b>Endpoints <code>GET /api/orcamentos</code> e <code>/api/clientes</code> sem autenticação.</b> Retornam todo o conteúdo de <code>db.orcamentos</code> e <code>db.clientes</code> para qualquer visitante.", body_style),
            Paragraph("Acesso irrestrito a dados comerciais sem exigir login ou chave de API.", body_style)
        ],
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_style),
            Paragraph("<code>server.js</code><br/>L415-429", code_style),
            Paragraph("<b>Exportação e Importação irrestrita do banco (<code>/api/db/export</code> e <code>/api/db/import</code>).</b> Permite download completo do <code>db.json</code> e substituição arbitrária da base inteira.", body_style),
            Paragraph("Comprometimento total da integridade e confidencialidade da base de dados.", body_style)
        ],
        # 2. Permissão no Navegador
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_style),
            Paragraph("<code>server.js</code><br/>L388-412", code_style),
            Paragraph("<b>Edição e exclusão de catálogo (<code>POST /api/catalogo</code> e <code>DELETE /api/catalogo</code>) sem checagem de role.</b> O frontend esconde a UI em <code>#admin</code>, mas o backend aceita mutações abertas.", body_style),
            Paragraph("Qualquer visitante pode alterar preços, produtos ou apagar o catálogo da loja.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>supabase/schema.sql</code><br/>L179-185, 199-217", code_style),
            Paragraph("<b>Escrita de configurações e produtos no Supabase aberta a qualquer cliente.</b> Políticas usam <code>to authenticated using (true)</code> sem validar se <code>perfis_usuarios.tipo = 'admin'</code>.", body_style),
            Paragraph("Cliente comum pode executar inserts e updates em <code>produtos</code> e <code>configuracoes_site</code>.", body_style)
        ],
        # 3. IDOR
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>server.js</code><br/>L331-356", code_style),
            Paragraph("<b>IDOR em <code>DELETE /api/orcamentos/:id</code> e <code>PATCH /status</code>.</b> Parâmetro <code>:id</code> obtido da URL sem checar se o orçamento pertence ao chamador.", body_style),
            Paragraph("Exclusão e troca de status arbitrária de qualquer orçamento conhecendo seu ID.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>server.js</code><br/>L286-327", code_style),
            Paragraph("<b>IDOR em <code>POST /api/orcamentos</code> via body.</b> Sobrescreve propostas comerciais existentes passando o <code>id</code> de terceiros no JSON.", body_style),
            Paragraph("Adulteração de valores e itens de pedidos criados por outros clientes ou vendedores.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>supabase/schema.sql</code><br/>L287-297", code_style),
            Paragraph("<b>IDOR direto em <code>public.orcamentos</code> via SDK Supabase.</b> Atualização e exclusão de qualquer registro via PostgREST por cliente autenticado sem checagem de <code>auth.uid() = cliente_id</code>.", body_style),
            Paragraph("Exclusão e adulteração de orçamentos diretamente pelo cliente HTTP.", body_style)
        ],
        # 4. Chaves Expostas
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_style),
            Paragraph("<code>.git/config</code><br/>L7 (remoto origin)", code_style),
            Paragraph("<b>GitHub Personal Access Token (PAT) gravado na URL remota.</b> Token clássico com permissão de escrita no repositório exposto em arquivo de configuração local.", body_style),
            Paragraph("Sequestro do repositório remoto caso a pasta <code>.git</code> seja exposta ou compartilhada.", body_style)
        ],
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_style),
            Paragraph("<code>js/database.js</code><br/>L273-279", code_style),
            Paragraph("<b>Backdoor de login hardcoded no frontend.</b> Condição <code>emailLimpo === 'contato@gruposj.com.br' && senhaLimpa === '123456'</code> concede sessão de Admin imediatamente.", body_style),
            Paragraph("Bypass de autenticação universal diretamente no JavaScript do cliente.", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>server.js</code> L48-58<br/><code>data/db.json</code> L48-58", code_style),
            Paragraph("<b>Senha de administrador em texto puro (<code>senhaHash: '123456'</code>).</b> Ausência de algoritmo de derivação segura de chave (bcrypt, Argon2 ou scrypt).", body_style),
            Paragraph("Comprometimento imediato da senha caso o arquivo <code>db.json</code> seja lido.", body_style)
        ],
        [
            Paragraph("<font color='#64748B'><b>INFO</b></font>", body_style),
            Paragraph("<code>js/supabase-client.js</code><br/>L28-30", code_style),
            Paragraph("<b>Chave anônima pública do Supabase embutida no frontend.</b> A chave é pública por desenho, porém amplia os achados 1.1 e 1.2 caso o RLS permaneça furado.", body_style),
            Paragraph("Vetor de exploração direto contra as tabelas sem RLS restritivo.", body_style)
        ],
        # 5. Inputs Sem Tratamento
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_style),
            Paragraph("<code>js/app.js</code><br/>L7057", code_style),
            Paragraph("<b>DOM XSS direto via busca rápida:</b> <code>searchLiveDropdown.innerHTML = ... &lt;strong&gt;\"${termoRaw}\"&lt;/strong&gt;</code>. Input do usuário injetado diretamente no DOM.", body_style),
            Paragraph("Execução de scripts arbitrários no contexto da sessão do cliente/vendedor.", body_style)
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_style),
            Paragraph("<code>js/app.js</code><br/>L184", code_style),
            Paragraph("<b>Injeção HTML em notificações toast:</b> <code>spanTxt.innerHTML = mensagem;</code>. Parâmetros dinâmicos (nome de produtos e mensagens) injetados sem escape.", body_style),
            Paragraph("XSS induzido através de nomes maliciosos de produtos cadastrados.", body_style)
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_style),
            Paragraph("<code>js/app.js</code><br/>L1007-1015, L1149-1175", code_style),
            Paragraph("<b>Ausência de sanitizador HTML (DOMPurify) na renderização de templates.</b> Dados de usuário (nome, telefone, foto) injetados via template strings diretamente no DOM.", body_style),
            Paragraph("Risco de Stored XSS persistente na visualização de perfil e pedidos.", body_style)
        ]
    ]

    t_achados = Table(achados_tabela, colWidths=[2.2 * cm, 3.5 * cm, 7.3 * cm, 4.0 * cm])
    t_achados.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
    ]))
    story.append(t_achados)
    story.append(PageBreak())

    # --------------------------------------------------------------------------
    # RECOMENDAÇÕES PRIORIZADAS
    # --------------------------------------------------------------------------
    story.append(Paragraph("4. Recomendações Priorizadas de Correção", h1_style))
    story.append(Paragraph(
        "As recomendações a seguir devem ser executadas em ondas estruturadas por prioridade de risco.",
        body_style
    ))

    recs_data = [
        [
            Paragraph("<b>Prioridade</b>", body_style),
            Paragraph("<b>Ação Recomendada</b>", body_style),
            Paragraph("<b>Complexidade</b>", body_style)
        ],
        [
            Paragraph("<font color='#B91C1C'><b>P1 (Imediata)</b></font>", body_style),
            Paragraph("<b>Blindar RLS em <code>orcamentos</code> e <code>clientes</code> no Supabase:</b> Criar função <code>auth.is_admin()</code> verificando <code>perfis_usuarios.tipo = 'admin'</code>. Clientes comuns só podem ler e criar orçamentos onde <code>cliente_id = auth.uid()</code>.<br/>"
                      "<b>Revogar e rotacionar o GitHub PAT</b> embutido no <code>.git/config</code>.<br/>"
                      "<b>Remover o backdoor</b> em <code>js/database.js:273-279</code>.", body_style),
            Paragraph("Média<br/>(1-2 dias)", body_style)
        ],
        [
            Paragraph("<font color='#EA580C'><b>P2 (Curto Prazo)</b></font>", body_style),
            Paragraph("<b>Autenticar rotas de escrita e dump no <code>server.js</code>:</b> Adicionar middleware de token de autorização (Bearer token) ou remover <code>/api/db/export</code> e <code>/api/db/import</code> em ambiente produtivo.<br/>"
                      "<b>Corrigir DOM XSS em <code>js/app.js:7057</code>:</b> Escapar <code>termoRaw</code> antes de injetar no <code>innerHTML</code> ou utilizar <code>textContent</code>.<br/>"
                      "<b>Criptografar senhas locais</b> no <code>db.json</code> usando <code>bcryptjs</code>.", body_style),
            Paragraph("Baixa<br/>(1 dia)", body_style)
        ],
        [
            Paragraph("<font color='#D97706'><b>P3 (Médio Prazo)</b></font>", body_style),
            Paragraph("<b>Integrar DOMPurify globalmente:</b> Importar <code>DOMPurify</code> para higienizar qualquer template dinâmico renderizado via <code>innerHTML</code>.<br/>"
                      "<b>Configurar Content Security Policy (CSP):</b> Definir cabeçalho <code>Content-Security-Policy</code> restritivo bloqueando scripts inline e fontes não autorizadas.", body_style),
            Paragraph("Média<br/>(2 dias)", body_style)
        ]
    ]
    t_recs = Table(recs_data, colWidths=[2.6 * cm, 11.4 * cm, 3.0 * cm])
    t_recs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
    ]))
    story.append(t_recs)
    story.append(PageBreak())

    # --------------------------------------------------------------------------
    # SEÇÃO DE ISSUES PARA O GITHUB (TEXTO COMPLETO PRONTO PARA COPIAR E COLAR)
    # --------------------------------------------------------------------------
    story.append(Paragraph("5. Issues Acionáveis para o GitHub", h1_style))
    story.append(Paragraph(
        "Copie e cole o conteúdo de cada bloco delimitado diretamente como uma nova issue no repositório GitHub do projeto.",
        body_style
    ))
    story.append(Spacer(1, 8))

    issues_text = [
        # Issue 1
        """--- ISSUE 1 ---
# [Segurança] Blindar RLS em orçamentos e clientes no Supabase para isolar dados de clientes

**Labels:** `security`, `critical`, `supabase`, `database`

### Descrição do Problema
As tabelas `public.orcamentos` e `public.clientes` no Supabase possuem políticas de Row Level Security (RLS) permissivas demais. Clientes que se cadastram no site recebem a role `authenticated`. Pelas políticas atuais, qualquer usuário `authenticated` possui permissão irrestrita (`USING (true)`) para ler, criar, editar e excluir registros de todos os clientes e orçamentos da loja.

### Evidência no Código
Arquivo: `supabase/schema.sql` (Linhas 246-271 e 273-298):
```sql
create policy "Apenas vendedores autenticados podem ler orçamentos"
  on public.orcamentos for select to authenticated using (true);

create policy "Apenas vendedores autenticados podem ler clientes"
  on public.clientes for select to authenticated using (true);
```

### Impacto
Vazamento em massa de dados protegidos pela LGPD (nomes, CPFs/CNPJs, WhatsApp, histórico de compras) e possibilidade de exclusão/alteração arbitrária de pedidos da loja inteira por qualquer cliente cadastrado.

### Sugestão de Correção
1. Criar uma função auxiliar no Supabase:
```sql
create or replace function public.is_admin_ou_vendedor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.perfis_usuarios
    where id = auth.uid() and tipo in ('operador', 'admin') and ativo = true
  );
$$;
```
2. Restringir orçamentos: vendedores lêem tudo; clientes lêem apenas onde `cliente_id = auth.uid()::text`.

### Critérios de Aceite
- [ ] Cliente autenticado comum só consegue listar seus próprios orçamentos via `supabase.from('orcamentos').select()`.
- [ ] Tentativa de ler orçamentos de outros clientes retorna zero linhas.
- [ ] Vendedores autenticados continuam acessando todos os orçamentos no painel `/admin`.
--- FIM ISSUE 1 ---""",

        # Issue 2
        """--- ISSUE 2 ---
# [Segurança] Autenticar rotas administrativas e desativar export/import público no server.js

**Labels:** `security`, `critical`, `backend`, `node`

### Descrição do Problema
O backend local em `server.js` expõe endpoints administrativos sem qualquer verificação de autenticação ou token:
- `GET /api/db/export`: Faz o dump de todo o banco JSON (incluindo usuários e senhas).
- `POST /api/db/import`: Substitui a base de dados inteira.
- `POST /api/catalogo` e `DELETE /api/catalogo`: Modificam ou resetam produtos e preços do catálogo.
- `GET /api/clientes` e `GET /api/orcamentos`: Listam todos os dados cadastrais.

### Evidência no Código
Arquivo: `server.js` (Linhas 388-429):
```javascript
if (pathname === "/api/catalogo") {
  if (req.method === "POST") { ... salvarBanco(db); }
}
if (pathname === "/api/db/export") { responderJson(res, 200, db); }
```

### Impacto
Qualquer visitante na mesma rede ou com acesso à URL da API pode apagar o catálogo, baixar todos os dados pessoais e substituir a base da loja.

### Sugestão de Correção
1. Criar um middleware de validação de cabeçalho `Authorization: Bearer <ADMIN_SECRET_KEY>`.
2. Em ambiente produtivo, desabilitar totalmente os endpoints `/api/db/export` e `/api/db/import`.

### Critérios de Aceite
- [ ] Requisições para `/api/catalogo` sem token retornam HTTP 401 Unauthorized.
- [ ] Endpoint `/api/db/export` bloqueia chamadas não autorizadas.
--- FIM ISSUE 2 ---""",

        # Issue 3
        """--- ISSUE 3 ---
# [Segurança] Remover backdoor de credenciais hardcoded e aplicar hash em senhas

**Labels:** `security`, `critical`, `auth`

### Descrição do Problema
O arquivo `js/database.js` possui um bypass de autenticação hardcoded no frontend que autentica como Administrador qualquer tentativa de login com o e-mail `contato@gruposj.com.br` e senha `123456`, mesmo se o usuário tiver alterado sua senha. Além disso, as senhas no `server.js` e `data/db.json` estão salvas em texto puro (`senhaHash: "123456"`).

### Evidência no Código
Arquivo: `js/database.js` (Linhas 273-279):
```javascript
if (emailLimpo === "contato@gruposj.com.br" && senhaLimpa === "123456") {
  state.usuarioAtual = { ...USUARIO_PADRAO, ultimoLogin: new Date().toISOString() };
  return { sucesso: true, usuario: state.usuarioAtual };
}
```

### Impacto
Acesso não autorizado ao painel administrativo por qualquer pessoa inspecionando o código do frontend.

### Sugestão de Correção
1. Remover completamente o bloco de bypass condicional em `js/database.js`.
2. No `server.js`, utilizar biblioteca `bcryptjs` para comparar senhas com hash salt.

### Critérios de Aceite
- [ ] O código-fonte não possui credenciais ou e-mails embutidos em condições `if`.
- [ ] Tentativa de login com senha não cadastrada é rejeitada.
- [ ] `senhaHash` no `db.json` contém hash bcrypt e não texto puro.
--- FIM ISSUE 3 ---""",

        # Issue 4
        """--- ISSUE 4 ---
# [Segurança] Rotacionar GitHub Personal Access Token (PAT) exposto no .git/config

**Labels:** `security`, `high`, `git`, `devops`

### Descrição do Problema
A URL remota do repositório Git contém um token de acesso pessoal (PAT) clássico do GitHub em texto puro no arquivo `.git/config`. Se este arquivo ou o ambiente for compartilhado, o token confere acesso direto de leitura e escrita ao repositório no GitHub.

### Evidência no Código
Arquivo: `.git/config`:
```text
url = https://ghp_REDACTED_SECRET_TOKEN@github.com/addesigner2026/lojasj3d-site.git
```

### Impacto
Possibilidade de sequestro do repositório, commit de código malicioso e vazamento de histórico.

### Sugestão de Correção
1. No painel do GitHub, revogar imediatamente o token exposto.
2. Atualizar a URL remota local para usar SSH ou Git Credential Manager:
```bash
git remote set-url origin https://github.com/addesigner2026/lojasj3d-site.git
```

### Critérios de Aceite
- [ ] O token anterior foi revogado no painel do GitHub.
- [ ] `.git/config` não contém tokens na URL remota.
--- FIM ISSUE 4 ---""",

        # Issue 5
        """--- ISSUE 5 ---
# [Segurança] Corrigir DOM XSS em dropdown de busca e sanitizar interpolações HTML

**Labels:** `security`, `high`, `xss`, `frontend`

### Descrição do Problema
No arquivo `js/app.js`, a função `renderizarSugestoesBuscaAoVivo` concatena diretamente o parâmetro `termoRaw` dentro de `searchLiveDropdown.innerHTML` quando nenhum resultado é encontrado. Além disso, as mensagens de notificação toast e templates de perfil utilizam `innerHTML` sem biblioteca de higienização.

### Evidência no Código
Arquivo: `js/app.js` (Linhas 7055-7058):
```javascript
searchLiveDropdown.innerHTML = `
  <div class="search-live-empty">
    <span>Nenhum item encontrado para <strong>"${termoRaw}"</strong>.</span>
```

### Impacto
Execução de scripts maliciosos (XSS) no navegador do usuário, possibilitando roubo de tokens de sessão do Supabase no `localStorage`.

### Sugestão de Correção
1. Criar uma função utilitária de escape de HTML:
```javascript
function escaparHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}
```
2. Aplicar `escaparHtml(termoRaw)` em todas as interpolações de template string.
3. Importar a biblioteca `DOMPurify` para sanitizar conteúdos dinâmicos complexos.

### Critérios de Aceite
- [ ] Digitar `<img src=x onerror=alert(1)>` no campo de busca renderiza o texto puro sem executar JavaScript.
- [ ] Toasts e nomes de perfil não interpretam tags HTML maliciosas.
--- FIM ISSUE 5 ---"""
    ]

    for issue_content in issues_text:
        escaped_content = html.escape(issue_content).replace('\n', '<br/>')
        issue_table = [
            [Paragraph(escaped_content, issue_block_style)]
        ]
        t_issue = Table(issue_table, colWidths=[17.0 * cm])
        t_issue.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(t_issue)
        story.append(Spacer(1, 10))

    # Constrói o PDF usando o NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"✅ Relatório PDF gerado com sucesso em: {pdf_path}")


if __name__ == "__main__":
    pdf_destino = "docs/security-audit/relatorio-auditoria-seguranca.pdf"
    criar_relatorio(pdf_destino)

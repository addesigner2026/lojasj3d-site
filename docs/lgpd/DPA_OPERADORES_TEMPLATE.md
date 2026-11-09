# Acordo de Processamento de Dados Pessoais (Data Processing Agreement - DPA)
### Aditivo Contratual de Conformidade com a LGPD (Lei nº 13.709/2018, Art. 39)

> ⚠️ **Aviso Legal Obrigatório:** Modelo gerado por IA; revisar com advogado antes de formalizar ou assinar com qualquer prestador de serviços.

---

## 1. Identificação das Partes

**CONTROLADOR:**  
**Razão Social:** [PREENCHER: Razão Social da Empresa Contratante] ("Loja SJ 3D")  
**CNPJ:** [PREENCHER: 66.275.129/0001-10]  
**Endereço:** [PREENCHER: Av. Portugal, 6759 — Zona 1A, Umuarama / PR, CEP 87501-000]  
**Representante Legal:** [PREENCHER: Nome do Administrador / Sócio]  
**Encarregado pelo Tratamento de Dados (DPO):** [PREENCHER: Nome do DPO — dpo@lojasj3d.com.br]  

**OPERADOR:**  
**Razão Social:** [PREENCHER: Razão Social do Prestador / Escritório Contábil / Parceiro de Tecnologia]  
**CNPJ:** [PREENCHER: 00.000.000/0001-00]  
**Endereço:** [PREENCHER: Endereço Completo do Operador]  
**Representante Legal:** [PREENCHER: Nome do Representante do Operador]  
**Canal de Contato de Privacidade:** [PREENCHER: privacidade@operador.com.br]  

---

## 2. Cláusulas Padronizadas de Proteção de Dados

### Cláusula 1ª — Do Objeto e Escopo do Tratamento
1.1. O presente Aditivo regula as operações de tratamento de dados pessoais realizadas pelo **OPERADOR** em nome e sob as instruções estritas do **CONTROLADOR**, em virtude do contrato principal de prestação de serviços [PREENCHER: indicar o contrato principal, ex.: Contrato de Prestação de Serviços Contábeis / TI / Suporte].  
1.2. O **OPERADOR** compromete-se a tratar os dados pessoais unicamente para as finalidades necessárias à execução do contrato principal, sendo terminantemente vedado o uso dos dados para fins próprios, comerciais, analíticos não autorizados ou repasse a terceiros (Art. 39 da LGPD).

### Cláusula 2ª — Da Natureza e Categorias de Dados
2.1. O tratamento abrange exclusivamente as seguintes categorias de dados pessoais transmitidas pelo CONTROLADOR:
- Dados cadastrais de clientes: Nome, CPF/CNPJ, Inscrição Estadual, Telefone/WhatsApp, Endereço de entrega;
- Dados de faturamento: Valores de vendas, itens faturados, número de nota fiscal e histórico de transações.  
2.2. O OPERADOR não terá acesso nem tratará dados pessoais sensíveis (Art. 5º, II da LGPD) ou dados de menores sem prévia e expressa autorização formal do CONTROLADOR.

### Cláusula 3ª — Dos Deveres de Segurança e Confidencialidade
3.1. O **OPERADOR** declara e garante que implementa e manterá durante toda a vigência do contrato salvaguardas técnicas, administrativas e físicas adequadas (Art. 46 da LGPD), incluindo, no mínimo:
- Controle de acesso baseado na necessidade estrita de conhecimento (*need-to-know*);
- Criptografia de dados em trânsito (HTTPS/TLS) e em repouso;
- Políticas de senhas fortes com obrigatoriedade de autenticação em dois fatores (2FA);
- Trilhas de auditoria registrando quem acessou ou exportou os dados;
- Compromisso formal de sigilo e confidencialidade assinado por todos os colaboradores que têm contato com os dados.

### Cláusula 4ª — Da Notificação de Incidentes de Segurança
4.1. Em caso de ocorrência ou suspeita fundamentada de qualquer incidente de segurança envolvendo os dados do CONTROLADOR (vazamento, acesso indevido, perda ou alteração), o **OPERADOR deve notificar o CONTROLADOR por escrito em prazo não superior a 24 (vinte e quatro) horas** após a ciência do evento.  
4.2. A notificação deve conter relatório preliminar com: descrição do evento, categorias de dados afetadas, quantidade estimada de titulares envolvidos, medidas de contenção já aplicadas e canal de contato do responsável técnico.  
4.3. O OPERADOR prestará todo o suporte necessário para que o CONTROLADOR cumpra o dever legal de notificação à ANPD em até 3 dias úteis.

### Cláusula 5ª — Do Atendimento aos Direitos dos Titulares (Art. 18)
5.1. Caso o OPERADOR receba diretamente solicitação de qualquer titular (pedido de acesso, correção ou eliminação), deverá encaminhá-la ao DPO do CONTROLADOR em até 2 (dois) dias úteis.  
5.2. O OPERADOR obriga-se a operacionalizar, no prazo máximo de 5 (cinco) dias corridos, as ordens do CONTROLADOR relativas a retificação, bloqueio, anonimização ou exclusão de dados em suas bases.

### Cláusula 6ª — Suboperadores
6.1. O OPERADOR não poderá subcontratar o tratamento de dados pessoais (suboperador) sem a prévia e expressa anuência por escrito do CONTROLADOR.  
6.2. Em caso de contratação de suboperadores autorizados, o OPERADOR repassará a estes as mesmas obrigações de segurança e conformidade aqui estipuladas, permanecendo integral e solidariamente responsável perante o CONTROLADOR pelos atos do suboperador.

### Cláusula 7ª — Término do Contrato e Eliminação dos Dados
7.1. Encerrada a vigência do contrato principal ou mediante solicitação expressa do CONTROLADOR, o OPERADOR deverá:
- Interromper imediatamente qualquer operação de tratamento;
- Devolver ao CONTROLADOR todos os dados e cópias em formato estruturado (JSON, CSV ou banco de dados);
- Eliminar de forma segura e irreversível todas as cópias existentes em seus servidores, computadores e mídias físicas, emitindo **Termo de Destruição e Descarte Seguro** em até 15 (quinze) dias úteis, ressalvada a retenção estritamente obrigatória por dever legal expressamente comprovado.

---

## 3. Guia de Conformidade com Fornecedores Globais de Nuvem

Os provedores de computação em nuvem utilizados pelo sistema possuem Termos de Processamento de Dados (DPA) próprios e globais com cláusulas padrão contratuais (SCC):

1. **Supabase Inc. (Banco de Dados, Autenticação e Storage):**
   - **Localização:** Delaware / EUA (Servidores AWS São Paulo `sa-east-1` ou US).
   - **DPA Oficial:** Disponível para aceite no dashboard administrativo em `Settings > Data Processing Addendum`.
   - **Status:** Coberto por criptografia AES-256 em repouso e TLS 1.3 em trânsito.
2. **Vercel Inc. (Hospedagem Frontend, CDN e Edge Network):**
   - **Localização:** San Francisco / EUA.
   - **DPA Oficial:** Disponível publicamente em `https://vercel.com/legal/dpa`.
   - **Status:** Certificação SOC 2 Tipo II, ISO 27001 e conformidade GDPR/LGPD.
3. **Meta Platforms, Inc. (WhatsApp Business API / Atendimento):**
   - **Termos de Processamento:** Coberto pelos Termos de Negócios do WhatsApp (`WhatsApp Business Data Processing Terms`).
   - **Regra da Loja:** Mensagens trafegam criptografadas de ponta a ponta; nenhum dado fiscal sensível além do resumo do pedido é trafegado sem consentimento do cliente.

---

## 4. Assinaturas Formais

[PREENCHER: Umuarama / PR], ______ de ________________ de 2026.

___________________________________________________  
**CONTROLADOR:** [PREENCHER: Razão Social da Empresa]  
Representante Legal: [PREENCHER: Nome e CPF]  

___________________________________________________  
**OPERADOR:** [PREENCHER: Razão Social do Prestador / Escritório Contábil]  
Representante Legal: [PREENCHER: Nome e CPF]  

**Testemunhas:**

1. ___________________________ Nome / CPF: [PREENCHER]  
2. ___________________________ Nome / CPF: [PREENCHER]  

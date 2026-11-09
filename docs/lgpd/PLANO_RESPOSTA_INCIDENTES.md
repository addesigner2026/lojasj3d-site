# Plano de Resposta a Incidentes de Segurança com Dados Pessoais (PRISDP)

> ⚠️ **Aviso Legal Obrigatório:** Modelo gerado por IA; revisar com advogado e com o encarregado de dados (DPO) antes de formalizar ou publicar.

**Controlador:** [PREENCHER: Razão Social da Empresa] ("Loja SJ 3D")  
**CNPJ:** [PREENCHER: 66.275.129/0001-10]  
**Endereço:** [PREENCHER: Avenida Portugal, nº 6759 — Zona 1A, Umuarama / PR, CEP 87501-000]  
**Encarregado pelo Tratamento de Dados (DPO):** [PREENCHER: Nome do DPO / Thiago Novais]  
**Canal de Contato de Incidentes:** [PREENCHER: dpo@lojasj3d.com.br / privacidade@lojasj3d.com.br]  
**Data de Vigência:** 09 de Novembro de 2026 | **Versão:** 1.0  

---

## 1. Objetivo e Escopo

Este plano estabelece os procedimentos operacionais, papéis de resposta e prazos regulamentares a serem adotados pela **Loja SJ 3D** diante de qualquer evento adverso confirmado ou suspeito de violação de segurança que resulte em destruição, perda, alteração, acesso não autorizado ou vazamento de dados pessoais tratados na plataforma digital e no ambiente comercial físico (Art. 48 da Lei nº 13.709/2018 — LGPD c/c Resolução CD/ANPD nº 15/2024).

---

## 2. Comitê de Resposta a Incidentes de Segurança (CRIS)

Em caso de suspeita ou confirmação de incidente, o comitê é convocado imediatamente:

| Função no Comitê | Responsável Designado | Atribuição Principal |
| :--- | :--- | :--- |
| **Líder do Comitê / DPO** | [PREENCHER: Thiago Novais / Nome do DPO] | Coordenação geral, avaliação do risco, interlocução com a ANPD e titulares. |
| **Engenharia & Infraestrutura** | [PREENCHER: Responsável Técnico / DevOps] | Contenção técnica, isolamento de acessos, análise forense de logs e rotação de credenciais. |
| **Assessoria Jurídica** | [PREENCHER: Escritório de Advocacia / Advogado] | Validação da gravidade regulatória, redação de notificações formais e defesa jurídica. |
| **Comunicação & Atendimento** | [PREENCHER: Responsável Comercial / Suporte] | Atendimento padronizado aos titulares através dos canais oficiais sem gerar pânico. |

---

## 3. Matriz de Classificação de Gravidade do Incidente

| Nível de Gravidade | Critérios Técnicos | Ações Imediatas | Prazo de Notificação ANPD |
| :--- | :--- | :--- | :--- |
| **Baixo (Verde)** | Tentativa frustrada de intrusão, incidente contido sem exposição de dados pessoais ou perda de integridade. | Registro interno no livro de ocorrências, reforço de regras de firewall/WAF. | Não exige notificação à ANPD. |
| **Médio (Amarelo)** | Acesso indevido a dados não sensíveis de número limitado de clientes (ex.: apenas nome e e-mail), sem impacto financeiro direto. | Isolamento imediato, análise técnica e avaliação com assessoria jurídica. | Notificar ANPD se houver risco de constrangimento ou dano relevante. |
| **Alto / Crítico (Vermelho)** | Exposição de documentos fiscais, CPFs, credenciais de acesso, relatórios completos de vendas ou vazamento massivo de clientes. | Bloqueio imediato de contas, rotação de chaves do Supabase/Vercel, contenção forense. | **Obrigatória em até 3 dias úteis** à ANPD e aos titulares afetados. |

---

## 4. Fluxo Operacional de Resposta (5 Etapas)

```
[1. DETECÇÃO & TRIAGEM] ➔ [2. CONTENÇÃO IMEDIATA] ➔ [3. ANÁLISE FORENSE] ➔ [4. NOTIFICAÇÃO (3 DIAS)] ➔ [5. PÓS-INCIDENTE]
```

### Etapa 1: Detecção e Triagem (0 a 4 horas)
- Identificação da anomalia por alertas do Supabase, Vercel, auditoria de pedidos (`auditoria_pedidos`) ou relato de cliente.
- Confirmação preliminar se dados pessoais foram acessados ou exfiltrados.
- Acionamento imediato do Líder do Comitê / DPO.

### Etapa 2: Contenção Imediata e Erradicação (4 a 12 horas)
1. **Revogação de Credenciais:** Se houver suspeita de vazamento de credenciais administrativas, rotacionar imediatamente as chaves do Supabase (`anon key`, `service_role key`), banco de dados (`postgres password`) e tokens da Vercel.
2. **Isolamento de Contas:** Suspender temporariamente as contas de usuários ou operadores comprometidos.
3. **Bloqueio de IP / Tráfego Malicioso:** Inserir regras restritivas no firewall/WAF da Vercel/Cloudflare.
4. **Preservação de Evidências:** Exportar cópia forense inalterada dos logs do Supabase, Vercel e da tabela `auditoria_pedidos` antes de reiniciar serviços.

### Etapa 3: Avaliação de Risco e Relevância (12 a 24 horas)
- Levantamento quantitativo: quantos titulares foram afetados?
- Levantamento qualitativo: quais categorias de dados foram expostas? (ex.: apenas nome e telefone, ou CPF e notas fiscais?)
- Parecer do DPO e do Jurídico sobre a caracterização de "risco ou dano relevante" conforme o Art. 48 da LGPD.

### Etapa 4: Notificação Regulatória à ANPD e Titulares (Em até 3 dias úteis)
Conforme a Resolução CD/ANPD nº 15/2024, o prazo para comunicação de incidentes de segurança com risco relevante é de **3 (três) dias úteis**, contados a partir da ciência da confirmação de que o incidente afetou dados pessoais.

#### A. Notificação à ANPD:
- Realizada pelo peticionamento eletrônico no sistema Super/ANPD (`https://www.gov.br/anpd`).
- Conteúdo obrigatório: natureza dos dados, titulares afetados, medidas de segurança adotadas, riscos identificados e plano de remediação.

#### B. Notificação aos Titulares Afetados:
- Envio direto para os e-mails e/ou WhatsApp dos clientes atingidos em linguagem clara e acessível (ver Modelo no Item 5).

### Etapa 5: Recuperação, Auditoria e Lições Aprendidas (Após 72 horas)
- Restauração de serviços a partir de backups verificados e íntegros.
- Elaboração do Relatório Conclusivo de Incidente (guardar por 5 anos para comprovação de accountability).
- Atualização das políticas de segurança, revisão de RLS e treinamento da equipe interna.

---

## 5. Modelos Formais de Notificação

### Modelo 1: Comunicação Oficial à Autoridade Nacional de Proteção de Dados (ANPD)

```text
COMUNICAÇÃO DE INCIDENTE DE SEGURANÇA COM DADOS PESSOAIS
(Em conformidade com o Art. 48 da Lei nº 13.709/2018 e Resolução CD/ANPD nº 15/2024)

1. IDENTIFICAÇÃO DO CONTROLADOR
Razão Social: [PREENCHER: Razão Social da Empresa]
Nome Fantasia: Loja SJ 3D
CNPJ: [PREENCHER: 66.275.129/0001-10]
Endereço: [PREENCHER: Av. Portugal, 6759 — Umuarama / PR]
Encarregado pelo Tratamento de Dados (DPO): [PREENCHER: Nome do DPO]
E-mail do DPO: [PREENCHER: dpo@lojasj3d.com.br]
Telefone de Contato: [PREENCHER: (44) 99135-1318]

2. DETALHES DO INCIDENTE
Data e hora da ciência: [PREENCHER: DD/MM/AAAA às HH:MM]
Data e hora estimadas do evento: [PREENCHER: DD/MM/AAAA às HH:MM]
Localização do incidente: [PREENCHER: Banco de dados Supabase / Aplicação Web Vercel / Dispositivo local]
Descrição fática: [PREENCHER: Descrever objetivamente o que aconteceu, sem especulações]

3. DADOS PESSOAIS E TITULARES AFETADOS
Número aproximado de titulares envolvidos: [PREENCHER: Ex.: 42 clientes]
Categorias de dados afetadas: [PREENCHER: Ex.: Nome, telefone e endereço de entrega; nenhum dado bancário ou senha foi afetado]
Houve envolvimento de dados de crianças, adolescentes ou dados sensíveis (Art. 5º, II)?: [PREENCHER: Não / Sim]

4. RISCOS IDENTIFICADOS E MEDIDAS TÉCNICAS ADOTADAS
Riscos aos titulares: [PREENCHER: Ex.: Risco potencial de recebimento de mensagens de spam/phishing]
Medidas imediatas de contenção: [PREENCHER: Ex.: Revogação e rotação de credenciais, ativação de bloqueio de IP, revisão das políticas de RLS do PostgreSQL]
Medidas de mitigação aos titulares: [PREENCHER: Ex.: Notificação individual dos clientes com orientações de segurança e canal exclusivo de dúvidas com o DPO]

5. CONTATOS PARA ESCLARECIMENTOS COMPLEMENTARES
O Encarregado de Dados permanece à disposição técnica da ANPD pelo canal dpo@lojasj3d.com.br.
```

---

### Modelo 2: Notificação Direta ao Cliente / Titular de Dados

```text
Assunto: Comunicado Importante de Segurança e Proteção de Dados — Loja SJ 3D

Prezado(a) [Nome do Cliente],

A Loja SJ 3D, em estrito compromisso com a transparência e com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), vem informar que identificamos, no dia [PREENCHER: DD/MM/AAAA], um incidente de segurança em nosso ambiente [PREENCHER: indicar ambiente, ex.: de infraestrutura digital].

1. Quais dados foram potencialmente afetados?
Nossa equipe técnica apurou que as informações envolvidas incluem: [PREENCHER: Ex.: Nome cadastral, telefone e histórico de orçamentos].
Ressaltamos categoricamente que senhas de acesso NÃO foram expostas (são armazenadas de forma criptografada irreversível) e dados de cartão de crédito NÃO são armazenados em nossa base.

2. Quais providências já foram adotadas pela Loja SJ 3D?
Imediatamente após a detecção, nosso Comitê de Segurança conteve o acesso não autorizado, rotacionou todas as chaves de conexão aos servidores, reforçou as barreiras de firewall e notificou a Autoridade Nacional de Proteção de Dados (ANPD).

3. O que recomendamos a você?
Recomendamos cautela diante de eventuais contatos suspeitos via mensagem ou e-mail que solicitem confirmação de senhas ou códigos bancários em nome da Loja SJ 3D. Nossa equipe NUNCA solicitará senhas ou códigos de validação por WhatsApp ou telefone.

4. Canal de Atendimento e Dúvidas com o Encarregado de Dados (DPO)
Caso tenha qualquer dúvida ou deseje mais esclarecimentos, nosso Encarregado de Dados está à sua disposição direta pelo canal oficial:
E-mail: [PREENCHER: dpo@lojasj3d.com.br]
WhatsApp: [PREENCHER: (44) 99135-1318]
Canal de Direitos do Titular: https://lojasj3d.com.br/privacidade.html

Atenciosamente,

[PREENCHER: Razão Social da Empresa]
Loja SJ 3D — Umuarama / PR
```

---

## 6. Registro de Auditoria e Comprovação (Accountability)

Todas as ocorrências de segurança, contenções e notificações devem ser registradas no **Livro de Registro de Incidentes**, contendo:
1. Protocolo interno gerado.
2. Responsável que atendeu o chamado.
3. Evidências técnicas coletadas (hashes de arquivos, logs do servidor).
4. Cópia dos comunicados emitidos e comprovante de envio à ANPD.
5. Prazo de guarda obrigatória do dossiê: **5 (cinco) anos**.

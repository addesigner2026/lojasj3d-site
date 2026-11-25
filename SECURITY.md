# Política de Segurança — Loja SJ 3D

## Reportando Vulnerabilidades
Se você identificar qualquer falha de segurança no site `www.lojasj3d.com.br` ou em suas APIs, **não abra uma issue pública**. Envie um e-mail detalhado diretamente para:

- **E-mail de Segurança / DPO:** `contato@gruposj.com.br`

Inclua na mensagem:
- Descrição clara do problema e impacto potencial;
- Passos para reproduzir (URL, método HTTP, comportamento observado);
- Sugestão de correção, se houver.

## Compromisso de Resposta
- Confirmação de recebimento em até 48 horas úteis;
- Correção prioritária para vulnerabilidades críticas ou de exposição de dados pessoais (LGPD).

## Diretrizes Internas Obrigatórias
- Nenhuma chave `service_role`, token GitHub ou senha em texto puro no código ou histórico Git;
- RLS obrigatório em todas as tabelas do schema `public` no Supabase;
- Validação obrigatória com `npm run check:security` antes de qualquer commit ou deploy.

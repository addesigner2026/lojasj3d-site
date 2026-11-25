-- ============================================================================
-- MIGRATION 013: LIMPEZA DE DUPLICADOS (80, 90, 107, 149), GENÉRICO (55)
--                E PADRONIZAÇÃO DOS NOMES E PREÇOS DE FILAMENTOS
-- ============================================================================
-- Seguro para rodar mais de uma vez (idempotente).
-- Referências em public.quote_items usam ON DELETE SET NULL e preservam o
-- snapshot de nome e preço dos orçamentos antigos.
-- ============================================================================

-- 1. Remove os 4 duplicados da lista coresAbsEspeciais (mantidos na família PLA coresMaxPrint)
--    e o item genérico Cód. 55 ("Especial Cores com Glitter").
delete from public.products
where item_type = 'filament_color'
  and paleta_chave = 'coresAbsEspeciais'
  and cod in ('55', '80', '90', '107', '149');

-- 2. Atualiza os 3 preços ajustados conforme o catálogo oficial em PDF
update public.products
set preco = 'R$ 89,90', preco_valor = 89.90
where item_type = 'filament_color'
  and paleta_chave = 'coresMaxPrint'
  and cod in ('63', '164');

update public.products
set preco = 'R$ 99,90', preco_valor = 99.90
where item_type = 'filament_color'
  and paleta_chave = 'coresMaxPrint'
  and cod = '107';

-- 3. Padroniza nomes de filamentos (remove "1kg", "(Cód. XX)", prefixos redundantes
--    PLA/PETG/Silk/TPU/ABS e normaliza "c/ Glitter" -> "Glitter")
update public.products
set nome = trim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(nome, '\s*\m1\s*kg\M', '', 'gi'),
          '\s*\(c[oó]d\.?\s*\d+\)', '', 'gi'
        ),
        '\mc/\s*glitter\M|\mcom\s+glitter\M', 'Glitter', 'gi'
      ),
      '^(PETG|Silk|TPU|ABS|PLA)\s+', '', 'i'
    ),
    '^Refil\s+PLA\s+', 'Refil ', 'i'
  )
),
metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('peso', '1 kg')
where item_type = 'filament_color';

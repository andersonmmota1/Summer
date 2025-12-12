-- Renomeando a tabela sold_daily_hourly_data para sold_items.

-- Primeiro, excluímos a View sold_items antiga, que está causando conflito.
-- Como ela tem dependências, precisamos excluí-las primeiro também.

-- 1. Excluir views dependentes
DROP VIEW IF EXISTS products_without_recipes_summary;
DROP VIEW IF EXISTS current_stock_summary;

-- 2. Excluir a View sold_items problemática
DROP VIEW IF EXISTS sold_items;

-- 3. Renomear a tabela
ALTER TABLE sold_daily_hourly_data RENAME TO sold_items;
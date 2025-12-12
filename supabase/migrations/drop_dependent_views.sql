-- Script para excluir Views dependentes de sold_items.

-- 1. Excluir a view que depende de sold_items
DROP VIEW IF EXISTS products_without_recipes_summary;

-- 2. Excluir a view que depende de sold_items
DROP VIEW IF EXISTS current_stock_summary;

-- 3. Excluir a view sold_items (agora sem dependências)
-- Se ainda houver erro, use CASCADE, mas vamos tentar sem primeiro.
DROP VIEW IF EXISTS sold_items;
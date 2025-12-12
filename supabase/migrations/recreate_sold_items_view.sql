-- Recriando a View sold_items para ser um espelho direto da tabela sold_items.
-- Esta view é um espelho da tabela sold_items, garantindo compatibilidade com o frontend.

DROP VIEW IF EXISTS sold_items;

CREATE VIEW sold_items AS
SELECT 
  si.id,
  si.user_id,
  si.sale_date,
  si.group_name,
  si.subgroup_name,
  si.additional_code,
  si.product_name,
  si.product_name AS base_product_name, -- Alias conforme solicitado
  si.total_quantity_sold AS quantity_sold, -- Alias conforme solicitado
  CASE 
    WHEN si.total_quantity_sold > 0 THEN si.total_value_sold / si.total_quantity_sold 
    ELSE 0 
  END AS unit_price, -- Calcula o preço unitário se necessário
  si.total_value_sold,
  si.created_at
FROM public.sold_items si; -- Referencia a tabela real sold_items
-- Recriando a View sold_items para ser um espelho da nova tabela sold_items.

DROP VIEW IF EXISTS sold_items;

CREATE VIEW sold_items AS
SELECT 
  id,
  user_id,
  sale_date,
  group_name,
  subgroup_name,
  additional_code,
  product_name,
  base_product_name,
  quantity_sold,
  unit_price,
  total_value_sold,
  created_at
FROM public.sold_items; -- Referencia a nova tabela
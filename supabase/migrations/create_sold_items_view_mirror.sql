-- Criando uma View sold_items que é um espelho da tabela sold_items (redundante, mas para compatibilidade).

-- Esta view é um espelho da tabela sold_items.
-- NOTA: Isso é redundante. O ideal é que o código acesse a tabela diretamente.
-- Mantendo apenas para garantir compatibilidade total.

CREATE OR REPLACE VIEW sold_items AS
SELECT 
  si.id,
  si.user_id,
  si.sale_date,
  si.group_name,
  si.subgroup_name,
  si.additional_code,
  si.product_name,
  si.product_name AS base_product_name,
  si.total_quantity_sold AS quantity_sold,
  CASE 
    WHEN si.total_quantity_sold > 0 THEN si.total_value_sold / si.total_quantity_sold 
    ELSE 0 
  END AS unit_price,
  si.total_value_sold,
  si.created_at
FROM public.sold_items si; -- Referencia a tabela real (agora renomeada)
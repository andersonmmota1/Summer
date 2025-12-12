-- Recriando a View sold_items para ser um espelho da tabela sold_items.

DROP VIEW IF EXISTS sold_items;

-- Verifica se a tabela tem um campo 'id'. Se não tiver, cria um.
-- Assume-se que a tabela tenha os campos conforme descrito.
-- Se não tiver 'id', o SELECT precisa gerar um.

CREATE VIEW sold_items AS
SELECT 
  -- Se a tabela NÃO tem um campo 'id', descomente a linha abaixo e comente a seguinte
  -- gen_random_uuid() AS id, 
  -- Se a tabela TEM um campo 'id', use-o diretamente
  id, -- <<<--- AJUSTAR CONFORME A ESTRUTURA REAL DA TABELA
  user_id,
  sale_date,
  group_name,
  subgroup_name,
  additional_code,
  product_name,
  product_name AS base_product_name, -- Alias conforme solicitado
  total_quantity_sold AS quantity_sold, -- Alias conforme solicitado
  -- Calcular unit_price aqui se a tabela não a tiver
  CASE 
    WHEN total_quantity_sold > 0 THEN total_value_sold / total_quantity_sold 
    ELSE 0 
  END AS unit_price,
  total_value_sold,
  created_at -- Se a tabela não tem 'created_at', use now() ou remova
  -- now() AS created_at -- <<<--- AJUSTAR CONFORME A ESTRUTURA REAL DA TABELA
FROM public.sold_items; -- Certifique-se de que o nome da tabela está correto
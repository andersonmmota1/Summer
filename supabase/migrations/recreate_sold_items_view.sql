-- Recriando a View sold_items para agregar dados da sold_daily_hourly_data e evitar duplicatas.
-- Esta view transforma os dados horários agregados da sold_daily_hourly_data em registros individuais por venda.

DROP VIEW IF EXISTS sold_items;

CREATE VIEW sold_items AS
SELECT 
  gen_random_uuid() AS id,
  sdhd.user_id,
  sdhd.sale_date,
  MAX(sdhd.group_name) AS group_name, -- Assume que o grupo é o mesmo para o produto naquele dia
  MAX(sdhd.subgroup_name) AS subgroup_name, -- Assume que o subgrupo é o mesmo para o produto naquele dia
  MAX(sdhd.additional_code) AS additional_code, -- Assume que o código é o mesmo para o produto naquele dia
  sdhd.product_name,
  sdhd.product_name AS base_product_name,
  SUM(sdhd.total_quantity_sold) AS quantity_sold, -- AGREGA A QUANTIDADE
  CASE 
    WHEN SUM(sdhd.total_quantity_sold) > 0::numeric 
    THEN SUM(sdhd.total_value_sold) / SUM(sdhd.total_quantity_sold) -- Preço médio ponderado pela quantidade
    ELSE 0::numeric 
  END AS unit_price,
  SUM(sdhd.total_value_sold) AS total_value_sold, -- AGREGA O VALOR TOTAL
  MAX(now()) AS created_at -- Usa o máximo de now(), embora seja irrelevante
FROM sold_daily_hourly_data sdhd
GROUP BY 
  sdhd.user_id, 
  sdhd.sale_date, 
  sdhd.product_name;
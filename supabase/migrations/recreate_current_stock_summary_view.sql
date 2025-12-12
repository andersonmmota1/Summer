-- Recriando a View current_stock_summary com base na nova tabela sold_items.

DROP VIEW IF EXISTS current_stock_summary;

CREATE VIEW current_stock_summary AS
WITH purchased_converted AS (
  -- CTE que prepara os dados de compra com nome e unidade convertidos
  SELECT
    pi.user_id,
    COALESCE(pnc.internal_product_name, pi.internal_product_name, pi.descricao_do_produto) AS internal_product_name,
    COALESCE(uc.internal_unit, pi.u_com) AS internal_unit,
    pi.q_com * COALESCE(uc.conversion_factor, 1::numeric) AS converted_quantity,
    pi.v_un_com * pi.q_com AS purchased_value
  FROM purchased_items pi
  LEFT JOIN product_name_conversions pnc ON pi.user_id = pnc.user_id AND pi.c_prod = pnc.supplier_product_code AND pi.x_fant = pnc.supplier_name
  LEFT JOIN unit_conversions uc ON pi.user_id = uc.user_id AND pi.c_prod = uc.supplier_product_code AND pi.x_fant = uc.supplier_name AND pi.u_com = uc.supplier_unit
  WHERE COALESCE(pnc.internal_product_name, pi.internal_product_name, pi.descricao_do_produto) IS NOT NULL
),
consumed_from_sales AS (
  -- CTE que calcula a quantidade consumida com base nas vendas e receitas
  SELECT
    si.user_id,
    pr.internal_product_name,
    -- Agrega aqui para garantir que cada produto interno tenha uma única linha de consumo por venda
    SUM(si.total_quantity_sold * pr.quantity_needed) AS consumed_quantity
  FROM sold_items si -- Usando a tabela real (agora renomeada)
  JOIN product_recipes pr ON si.user_id = pr.user_id AND si.product_name = pr.sold_product_name
  GROUP BY si.user_id, pr.internal_product_name -- Agrupa para evitar repetições
),
-- Agregando os dados de compra por produto (UMA LINHA POR PRODUTO)
aggregated_purchased AS (
  SELECT
    pc.user_id,
    pc.internal_product_name,
    -- Assume que a unidade interna é consistente para um produto
    MAX(pc.internal_unit) AS internal_unit,
    SUM(pc.converted_quantity) AS total_purchased_quantity_converted,
    SUM(pc.purchased_value) AS total_purchased_value
  FROM purchased_converted pc
  GROUP BY pc.user_id, pc.internal_product_name
),
-- Agregando os dados de consumo por produto (UMA LINHA POR PRODUTO)
aggregated_consumed AS (
  SELECT
    cs.user_id,
    cs.internal_product_name,
    SUM(cs.consumed_quantity) AS total_consumed_quantity_from_sales
  FROM consumed_from_sales cs
  GROUP BY cs.user_id, cs.internal_product_name
)
-- SELECT FINAL: JOIN entre agregados
SELECT
  COALESCE(ap.user_id, ac.user_id) AS user_id,
  COALESCE(ap.internal_product_name, ac.internal_product_name) AS internal_product_name,
  COALESCE(ap.internal_unit, 'unidade'::text) AS internal_unit,
  COALESCE(ap.total_purchased_quantity_converted, 0) - COALESCE(ac.total_consumed_quantity_from_sales, 0) AS current_stock_quantity,
  COALESCE(ap.total_purchased_value, 0) AS total_purchased_value,
  COALESCE(ap.total_purchased_quantity_converted, 0) AS total_purchased_quantity_converted,
  COALESCE(ac.total_consumed_quantity_from_sales, 0) AS total_consumed_quantity_from_sales
FROM aggregated_purchased ap
FULL JOIN aggregated_consumed ac
  ON ap.user_id = ac.user_id AND ap.internal_product_name = ac.internal_product_name;
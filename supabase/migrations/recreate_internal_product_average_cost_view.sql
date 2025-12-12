-- Recriando a View internal_product_average_cost com base na nova estrutura.

DROP VIEW IF EXISTS internal_product_average_cost;

CREATE VIEW internal_product_average_cost AS
SELECT
  pi.user_id,
  -- Determina o nome interno: primeiro o da purchased_items (se mapeado manualmente), depois o da conversão
  COALESCE(pi.internal_product_name, pnc.internal_product_name, pi.descricao_do_produto) AS internal_product_name,
  -- Determina a unidade interna: primeiro a da conversão, senão usa a original
  -- MAX para garantir um único valor por grupo, assumindo consistência
  COALESCE(MAX(uc.internal_unit), MAX(pi.u_com)) AS internal_unit,
  -- Calcula o valor total comprado
  SUM(pi.q_com * pi.v_un_com) AS total_value_purchased,
  -- Calcula a quantidade total comprada (convertida)
  SUM(pi.q_com * COALESCE(uc.conversion_factor, 1::numeric)) AS total_quantity_converted,
  -- Calcula o custo médio
  CASE
    WHEN SUM(pi.q_com * COALESCE(uc.conversion_factor, 1::numeric)) > 0::numeric THEN
      SUM(pi.q_com * pi.v_un_com) / SUM(pi.q_com * COALESCE(uc.conversion_factor, 1::numeric))
    ELSE 0::numeric
  END AS average_unit_cost
FROM purchased_items pi
LEFT JOIN product_name_conversions pnc
  ON pi.user_id = pnc.user_id
  AND pi.c_prod = pnc.supplier_product_code
  AND pi.x_fant = pnc.supplier_name
LEFT JOIN unit_conversions uc
  ON pi.user_id = uc.user_id
  AND pi.c_prod = uc.supplier_product_code
  AND pi.x_fant = uc.supplier_name
  AND pi.u_com = uc.supplier_unit
WHERE COALESCE(pi.internal_product_name, pnc.internal_product_name, pi.descricao_do_produto) IS NOT NULL
GROUP BY
  pi.user_id,
  COALESCE(pi.internal_product_name, pnc.internal_product_name, pi.descricao_do_produto);
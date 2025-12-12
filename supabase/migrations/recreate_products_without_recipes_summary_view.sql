-- Recriando a View products_without_recipes_summary com base na tabela sold_items.

DROP VIEW IF EXISTS products_without_recipes_summary;

CREATE VIEW products_without_recipes_summary AS
SELECT
    si.user_id,
    si.product_name AS sold_product_name,
    si.additional_code,
    COUNT(si.product_name) AS total_sales_count,
    SUM(si.total_quantity_sold) AS total_quantity_sold,
    SUM(si.total_value_sold) AS total_revenue
    -- MAX(si.sale_date) AS last_sale_date -- Se quiser manter
FROM sold_items si
LEFT JOIN product_recipes pr ON si.user_id = pr.user_id AND si.product_name = pr.sold_product_name
WHERE pr.sold_product_name IS NULL
GROUP BY si.user_id, si.product_name, si.additional_code
ORDER BY total_quantity_sold DESC;
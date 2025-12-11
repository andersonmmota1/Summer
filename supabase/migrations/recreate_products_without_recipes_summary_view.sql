CREATE OR REPLACE VIEW public.products_without_recipes_summary AS
SELECT
    si.user_id,
    si.product_name AS sold_product_name,
    si.additional_code,
    COUNT(DISTINCT si.sale_date) AS total_sales_count,
    SUM(si.quantity_sold) AS total_quantity_sold,
    SUM(si.total_value_sold) AS total_revenue
FROM
    public.sold_items si
LEFT JOIN
    public.product_recipes pr ON si.user_id = pr.user_id
    AND si.product_name = pr.sold_product_name
WHERE
    pr.sold_product_name IS NULL
GROUP BY
    si.user_id,
    si.product_name,
    si.additional_code;

ALTER VIEW public.products_without_recipes_summary OWNER TO postgres;

GRANT ALL ON TABLE public.products_without_recipes_summary TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products_without_recipes_summary TO postgres;
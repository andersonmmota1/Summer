CREATE OR REPLACE VIEW public.current_stock_summary AS
WITH purchased_converted AS (
    SELECT
        pi.user_id,
        COALESCE(pnc.internal_product_name, pi.internal_product_name, pi.descricao_do_produto) AS internal_product_name,
        COALESCE(uc.internal_unit, pi.u_com) AS internal_unit,
        pi.q_com * COALESCE(uc.conversion_factor, 1) AS converted_quantity,
        pi.v_un_com * pi.q_com AS purchased_value
    FROM
        public.purchased_items pi
    LEFT JOIN
        public.product_name_conversions pnc ON pi.user_id = pnc.user_id
        AND pi.c_prod = pnc.supplier_product_code
        AND pi.x_fant = pnc.supplier_name
    LEFT JOIN
        public.unit_conversions uc ON pi.user_id = uc.user_id
        AND pi.c_prod = uc.supplier_product_code
        AND pi.x_fant = uc.supplier_name
        AND pi.u_com = uc.supplier_unit
),
consumed_from_sales AS (
    SELECT
        si.user_id,
        pr.internal_product_name,
        si.quantity_sold * pr.quantity_needed AS consumed_quantity
    FROM
        public.sold_items si
    JOIN
        public.product_recipes pr ON si.user_id = pr.user_id
        AND si.product_name = pr.sold_product_name
)
SELECT
    COALESCE(pc.user_id, cs.user_id) AS user_id,
    COALESCE(pc.internal_product_name, cs.internal_product_name) AS internal_product_name,
    COALESCE(pc.internal_unit, 'unidade') AS internal_unit, -- Unidade padrão se não encontrada
    SUM(COALESCE(pc.converted_quantity, 0)) - SUM(COALESCE(cs.consumed_quantity, 0)) AS current_stock_quantity,
    SUM(COALESCE(pc.purchased_value, 0)) AS total_purchased_value,
    SUM(COALESCE(pc.converted_quantity, 0)) AS total_purchased_quantity_converted,
    SUM(COALESCE(cs.consumed_quantity, 0)) AS total_consumed_quantity_from_sales
FROM
    purchased_converted pc
FULL OUTER JOIN
    consumed_from_sales cs ON pc.user_id = cs.user_id AND pc.internal_product_name = cs.internal_product_name
GROUP BY
    COALESCE(pc.user_id, cs.user_id),
    COALESCE(pc.internal_product_name, cs.internal_product_name),
    COALESCE(pc.internal_unit, 'unidade');

ALTER VIEW public.current_stock_summary OWNER TO postgres;

GRANT ALL ON TABLE public.current_stock_summary TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.current_stock_summary TO postgres;
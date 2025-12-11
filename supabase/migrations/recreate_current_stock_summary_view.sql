-- Esta view calcula o estoque atual de cada produto interno, considerando as compras (com conversão de unidades) e o consumo a partir das vendas (com base nas fichas técnicas).
-- Corrigido para agregar corretamente as quantidades compradas por internal_product_name, evitando contagem múltipla devido a múltiplas linhas em purchased_items.

CREATE OR REPLACE VIEW public.current_stock_summary AS
WITH purchased_converted AS (
    -- 1. Seleciona e converte os itens comprados
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
-- 2. AGREGA os itens comprados por internal_product_name e internal_unit
--    Isso resolve o problema de contar a mesma quantidade múltiplas vezes
purchased_aggregated AS (
    SELECT
        user_id,
        internal_product_name,
        internal_unit,
        SUM(converted_quantity) AS total_purchased_quantity_converted,
        SUM(purchased_value) AS total_purchased_value
    FROM purchased_converted
    GROUP BY user_id, internal_product_name, internal_unit
),
consumed_from_sales AS (
    -- 3. Calcula o consumo de produtos internos pelas vendas
    SELECT
        si.user_id,
        pr.internal_product_name,
        SUM(si.quantity_sold * pr.quantity_needed) AS total_consumed_quantity
    FROM
        public.sold_items si
    JOIN
        public.product_recipes pr ON si.user_id = pr.user_id
        AND si.product_name = pr.sold_product_name
    GROUP BY si.user_id, pr.internal_product_name
)
-- 4. Junta os dados agregados de compras e consumo para calcular o estoque final
SELECT
    COALESCE(pa.user_id, cs.user_id) AS user_id,
    COALESCE(pa.internal_product_name, cs.internal_product_name) AS internal_product_name,
    COALESCE(pa.internal_unit, 'unidade') AS internal_unit, -- Unidade padrão se não encontrada
    COALESCE(pa.total_purchased_quantity_converted, 0) - COALESCE(cs.total_consumed_quantity, 0) AS current_stock_quantity,
    COALESCE(pa.total_purchased_value, 0) AS total_purchased_value,
    COALESCE(pa.total_purchased_quantity_converted, 0) AS total_purchased_quantity_converted,
    COALESCE(cs.total_consumed_quantity, 0) AS total_consumed_quantity_from_sales
FROM
    purchased_aggregated pa
FULL OUTER JOIN
    consumed_from_sales cs ON pa.user_id = cs.user_id AND pa.internal_product_name = cs.internal_product_name;

-- Configurações de permissões
ALTER VIEW public.current_stock_summary OWNER TO postgres;
GRANT ALL ON TABLE public.current_stock_summary TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.current_stock_summary TO postgres;
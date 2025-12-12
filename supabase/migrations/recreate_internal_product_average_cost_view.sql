-- Recriando a View internal_product_average_cost com a lógica correta.
-- Esta view calcula o custo total e quantidade total comprada de cada produto interno.
-- Ela NÃO deve envolver product_recipes nesta etapa.

-- 1. Primeiro, criamos uma CTE para ter os itens comprados com nome interno preenchido e quantidade convertida
WITH enriched_purchased_items AS (
    SELECT
        pi.user_id,
        -- Determina o nome interno: primeiro o da purchased_items, depois o da conversão
        COALESCE(pi.internal_product_name, pnc.internal_product_name) AS final_internal_product_name,
        pi.u_com AS original_u_com,
        pi.q_com AS original_q_com,
        pi.v_un_com,
        -- Determina a unidade interna: primeiro a da conversão, senão usa a original
        COALESCE(uc.internal_unit, pi.u_com) AS final_internal_unit,
        -- Determina o fator de conversão: 1 se não houver conversão
        COALESCE(uc.conversion_factor, 1.0) AS conversion_factor
    FROM purchased_items pi
    LEFT JOIN product_name_conversions pnc
        ON pi.c_prod = pnc.supplier_product_code
        AND pi.x_fant = pnc.supplier_name
        AND pi.user_id = pnc.user_id
    LEFT JOIN unit_conversions uc
        ON pi.c_prod = uc.supplier_product_code
        AND pi.x_fant = uc.supplier_name
        AND pi.u_com = uc.supplier_unit
        AND pi.user_id = uc.user_id
    WHERE COALESCE(pi.internal_product_name, pnc.internal_product_name) IS NOT NULL
),
-- 2. Agora, agregamos os dados
aggregated_costs AS (
    SELECT
        epi.user_id,
        epi.final_internal_product_name AS internal_product_name,
        MAX(epi.final_internal_unit) AS internal_unit, -- Assume que a unidade é consistente para um produto
        SUM(epi.original_q_com * epi.conversion_factor) AS total_quantity_converted,
        SUM(epi.original_q_com * epi.conversion_factor * epi.v_un_com) AS total_value_purchased
    FROM enriched_purchased_items epi
    GROUP BY epi.user_id, epi.final_internal_product_name
)
-- 3. Seleciona o resultado final
SELECT
    ac.user_id,
    ac.internal_product_name,
    ac.internal_unit,
    ac.total_quantity_converted,
    ac.total_value_purchased,
    CASE
        WHEN ac.total_quantity_converted > 0 THEN ac.total_value_purchased / ac.total_quantity_converted
        ELSE 0
    END AS average_unit_cost
FROM aggregated_costs ac;
CREATE OR REPLACE VIEW public.sold_items AS
SELECT
    sdhd.id,
    sdhd.user_id,
    sdhd.sale_date,
    sdhd.group_name,
    sdhd.subgroup_name,
    sdhd.additional_code,
    sdhd.product_name,
    -- Summing all 24 hourly quantities
    (sdhd.quantity_0 + sdhd.quantity_1 + sdhd.quantity_2 + sdhd.quantity_3 + sdhd.quantity_4 + sdhd.quantity_5 + sdhd.quantity_6 + sdhd.quantity_7 + sdhd.quantity_8 + sdhd.quantity_9 + sdhd.quantity_10 + sdhd.quantity_11 + sdhd.quantity_12 + sdhd.quantity_13 + sdhd.quantity_14 + sdhd.quantity_15 + sdhd.quantity_16 + sdhd.quantity_17 + sdhd.quantity_18 + sdhd.quantity_19 + sdhd.quantity_20 + sdhd.quantity_21 + sdhd.quantity_22 + sdhd.quantity_23) AS quantity_sold,
    -- Summing all 24 hourly values
    (sdhd.value_0 + sdhd.value_1 + sdhd.value_2 + sdhd.value_3 + sdhd.value_4 + sdhd.value_5 + sdhd.value_6 + sdhd.value_7 + sdhd.value_8 + sdhd.value_9 + sdhd.value_10 + sdhd.value_11 + sdhd.value_12 + sdhd.value_13 + sdhd.value_14 + sdhd.value_15 + sdhd.value_16 + sdhd.value_17 + sdhd.value_18 + sdhd.value_19 + sdhd.value_20 + sdhd.value_21 + sdhd.value_22 + sdhd.value_23) AS total_value_sold,
    -- Calculating unit_price (handle division by zero)
    CASE
        WHEN (sdhd.quantity_0 + sdhd.quantity_1 + sdhd.quantity_2 + sdhd.quantity_3 + sdhd.quantity_4 + sdhd.quantity_5 + sdhd.quantity_6 + sdhd.quantity_7 + sdhd.quantity_8 + sdhd.quantity_9 + sdhd.quantity_10 + sdhd.quantity_11 + sdhd.quantity_12 + sdhd.quantity_13 + sdhd.quantity_14 + sdhd.quantity_15 + sdhd.quantity_16 + sdhd.quantity_17 + sdhd.quantity_18 + sdhd.quantity_19 + sdhd.quantity_20 + sdhd.quantity_21 + sdhd.quantity_22 + sdhd.quantity_23) > 0
        THEN (sdhd.value_0 + sdhd.value_1 + sdhd.value_2 + sdhd.value_3 + sdhd.value_4 + sdhd.value_5 + sdhd.value_6 + sdhd.value_7 + sdhd.value_8 + sdhd.value_9 + sdhd.value_10 + sdhd.value_11 + sdhd.value_12 + sdhd.value_13 + sdhd.value_14 + sdhd.value_15 + sdhd.value_16 + sdhd.value_17 + sdhd.value_18 + sdhd.value_19 + sdhd.value_20 + sdhd.value_21 + sdhd.value_22 + sdhd.value_23) / (sdhd.quantity_0 + sdhd.quantity_1 + sdhd.quantity_2 + sdhd.quantity_3 + sdhd.quantity_4 + sdhd.quantity_5 + sdhd.quantity_6 + sdhd.quantity_7 + sdhd.quantity_8 + sdhd.quantity_9 + sdhd.quantity_10 + sdhd.quantity_11 + sdhd.quantity_12 + sdhd.quantity_13 + sdhd.quantity_14 + sdhd.quantity_15 + sdhd.quantity_16 + sdhd.quantity_17 + sdhd.quantity_18 + sdhd.quantity_19 + sdhd.quantity_20 + sdhd.quantity_21 + sdhd.quantity_22 + sdhd.quantity_23)
        ELSE 0
    END AS unit_price,
    sdhd.created_at,
    COALESCE(sc.new_category_name, 'Sem Categoria') AS new_category_name -- Join for the new category
FROM
    public.sold_daily_hourly_data sdhd
LEFT JOIN
    public.subgroup_categories sc ON sdhd.user_id = sc.user_id AND sdhd.subgroup_name = sc.subgroup_name;
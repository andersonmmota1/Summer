CREATE OR REPLACE VIEW public.sold_items AS
SELECT
    gen_random_uuid() AS id, -- Gera um ID único para cada linha agregada
    sdhd.user_id,
    sdhd.sale_date,
    sdhd.group_name,
    sdhd.subgroup_name,
    sdhd.additional_code,
    sdhd.product_name,
    sdhd.total_quantity_sold AS quantity_sold,
    CASE
        WHEN sdhd.total_quantity_sold > 0 THEN sdhd.total_value_sold / sdhd.total_quantity_sold
        ELSE 0
    END AS unit_price,
    sdhd.total_value_sold,
    now() AS created_at -- Usa o timestamp atual
FROM
    public.sold_daily_hourly_data sdhd;

ALTER VIEW public.sold_items OWNER TO postgres;

GRANT ALL ON TABLE public.sold_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sold_items TO postgres;
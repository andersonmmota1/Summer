-- Criando a nova tabela sold_items para armazenar dados agregados de vendas.

CREATE TABLE IF NOT EXISTS sold_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sale_date DATE NOT NULL,
    group_name TEXT,
    subgroup_name TEXT,
    additional_code TEXT,
    product_name TEXT NOT NULL,
    base_product_name TEXT, -- Pode ser igual a product_name se não houver ajuste
    quantity_sold NUMERIC NOT NULL DEFAULT 0,
    unit_price NUMERIC NOT NULL DEFAULT 0, -- Preço unitário médio
    total_value_sold NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para melhorar a performance das queries
CREATE INDEX IF NOT EXISTS idx_sold_items_user_id ON sold_items(user_id);
CREATE INDEX IF NOT EXISTS idx_sold_items_sale_date ON sold_items(sale_date);
CREATE INDEX IF NOT EXISTS idx_sold_items_product_name ON sold_items(product_name);
CREATE INDEX IF NOT EXISTS idx_sold_items_user_date_product ON sold_items(user_id, sale_date, product_name);
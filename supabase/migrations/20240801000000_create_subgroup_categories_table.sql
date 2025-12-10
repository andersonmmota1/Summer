CREATE TABLE public.subgroup_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subgroup_name text NOT NULL,
  new_category_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT subgroup_categories_pkey PRIMARY KEY (id),
  CONSTRAINT subgroup_categories_user_id_subgroup_name_key UNIQUE (user_id, subgroup_name),
  CONSTRAINT subgroup_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.subgroup_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.subgroup_categories FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.subgroup_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for users based on user_id" ON public.subgroup_categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable delete for users based on user_id" ON public.subgroup_categories FOR DELETE USING (auth.uid() = user_id);

-- Function to update 'updated_at' timestamp
CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subgroup_categories_updated_at
BEFORE UPDATE ON public.subgroup_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Adicionando logs para depuração
console.log('Supabase URL carregada:', supabaseUrl);
console.log('Supabase Anon Key carregada:', supabaseAnonKey ? 'Sim (tamanho: ' + supabaseAnonKey.length + ')' : 'Não');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL e Anon Key devem ser fornecidas como variáveis de ambiente.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
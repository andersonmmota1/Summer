import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is not defined in environment variables.');
  // Optionally, throw an error or handle this more gracefully in a production app
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase URL carregada:', supabaseUrl);
console.log('Supabase Anon Key carregada:', supabaseAnonKey ? 'Sim (tamanho: ' + supabaseAnonKey.length + ')' : 'Não');
if (supabaseAnonKey) {
  console.log('Valor completo da Supabase Anon Key (para depuração):', supabaseAnonKey);
}
console.log('Supabase client initialized.');
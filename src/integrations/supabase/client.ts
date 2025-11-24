import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL ou Anon Key não está definida nas variáveis de ambiente. Por favor, verifique seu arquivo .env e a configuração do Vite.');
  // Lança um erro para impedir que o aplicativo continue com um cliente Supabase inválido
  throw new Error('Variáveis de ambiente do Supabase estão faltando.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase URL carregada:', supabaseUrl);
console.log('Supabase Anon Key carregada:', supabaseAnonKey ? 'Sim (tamanho: ' + supabaseAnonKey.length + ')' : 'Não');
if (supabaseAnonKey) {
  console.log('Valor completo da Supabase Anon Key (para depuração):', supabaseAnonKey);
}
console.log('Supabase client initialized.');
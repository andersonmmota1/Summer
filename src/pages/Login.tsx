import React from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { showSuccess, showError } from '@/utils/toast';

const Login: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        showSuccess('Login realizado com sucesso!');
        navigate('/inicio'); // Redireciona para a página inicial após o login
      } else if (event === 'SIGNED_OUT') {
        showSuccess('Logout realizado com sucesso!');
        navigate('/login'); // Redireciona para a página de login após o logout
      } else if (event === 'USER_UPDATED') {
        showSuccess('Perfil atualizado com sucesso!');
      } else if (event === 'PASSWORD_RECOVERY') {
        showSuccess('Verifique seu e-mail para redefinir a senha.');
      } else if (event === 'INITIAL_SESSION' && session) {
        // Se já houver uma sessão inicial, redireciona para a página inicial
        navigate('/inicio');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
          Bem-vindo!
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Removendo provedores de terceiros para simplificar
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light" // Usando tema claro, pode ser ajustado para 'dark' ou dinâmico
          redirectTo={window.location.origin + '/inicio'} // Redireciona para a página inicial após o login
          localization={{
            variables: {
              sign_in: {
                email_label: 'Seu e-mail',
                password_label: 'Sua senha',
                email_input_placeholder: 'email@exemplo.com',
                password_input_placeholder: '••••••••',
                button_label: 'Entrar',
                social_provider_text: 'Entrar com {{provider}}',
                link_text: 'Já tem uma conta? Entrar',
              },
              sign_up: {
                email_label: 'Seu e-mail',
                password_label: 'Crie uma senha',
                email_input_placeholder: 'email@exemplo.com',
                password_input_placeholder: '••••••••',
                button_label: 'Cadastrar',
                social_provider_text: 'Cadastrar com {{provider}}',
                link_text: 'Não tem uma conta? Cadastrar',
              },
              forgotten_password: {
                email_label: 'Seu e-mail',
                email_input_placeholder: 'email@exemplo.com',
                button_label: 'Enviar instruções de redefinição',
                link_text: 'Esqueceu sua senha?',
              },
              update_password: {
                password_label: 'Nova senha',
                password_input_placeholder: '••••••••',
                button_label: 'Atualizar senha',
              },
              magic_link: {
                email_input_placeholder: 'email@exemplo.com',
                button_label: 'Enviar link mágico',
                link_text: 'Enviar um link mágico por e-mail',
              },
              verify_otp: {
                email_input_placeholder: 'email@exemplo.com',
                phone_input_placeholder: 'Número de telefone',
                token_input_placeholder: 'Código OTP',
                email_label: 'Endereço de e-mail',
                phone_label: 'Número de telefone',
                token_label: 'Código OTP',
                button_label: 'Verificar OTP',
                link_text: 'Já tem um código OTP? Verifique',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;
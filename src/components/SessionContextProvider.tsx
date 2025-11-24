import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showWarning } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        // Redireciona para a página de login se o usuário sair
        if (location.pathname !== '/login') {
          showWarning('Você foi desconectado. Por favor, faça login novamente.');
          navigate('/login');
        }
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Redireciona para a página inicial se o usuário estiver logado e tentando acessar /login
        if (currentSession && location.pathname === '/login') {
          navigate('/inicio');
        }
      }
    });

    // Fetch initial session
    const getInitialSession = async () => {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Erro ao obter sessão inicial:', error);
      }
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);

      // Handle initial redirect
      if (initialSession && location.pathname === '/login') {
        navigate('/inicio');
      } else if (!initialSession && location.pathname !== '/login') {
        navigate('/login');
      }
    };

    getInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};
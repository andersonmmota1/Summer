import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showLoading, dismissToast, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react'; // Importando Loader2

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
    const handleAuthStateChange = async () => {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        showError(`Erro ao carregar sessão: ${error.message}`);
        setLoading(false);
        return;
      }
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setLoading(false);

        // Redirecionamento baseado no estado de autenticação
        if (currentSession && location.pathname === '/login') {
          navigate('/'); // Redireciona para a página inicial se já estiver logado e na página de login
        } else if (!currentSession && location.pathname !== '/login') {
          navigate('/login'); // Redireciona para login se não estiver logado e não estiver na página de login
        }
      });

      return () => subscription.unsubscribe();
    };

    handleAuthStateChange();
  }, [navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

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
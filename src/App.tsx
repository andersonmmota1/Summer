import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardShell from "./components/DashboardShell";
import Inicio from "./pages/Inicio";
import Estoque from "./pages/Estoque";
import FluxoDeCaixa from "./pages/FluxoDeCaixa";
import CargaDeDados from "./pages/CargaDeDados";
import MapeamentoDeProdutos from "./pages/MapeamentoDeProdutos";
import Login from "./pages/Login"; // Importar a página de Login
import NotFound from "./pages/NotFound";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider"; // Importar SessionContextProvider e useSession

const queryClient = new QueryClient();

// Componente para proteger rotas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Carregando autenticação...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider> {/* Envolve o aplicativo com o provedor de sessão */}
          <Routes>
            <Route path="/login" element={<Login />} /> {/* Rota pública para login */}
            <Route path="/" element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
              <Route index element={<Navigate to="/inicio" replace />} />
              <Route path="inicio" element={<Inicio />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="fluxo-de-caixa" element={<FluxoDeCaixa />} />
              <Route path="carga-de-dados" element={<CargaDeDados />} />
              <Route path="mapeamento-de-produtos" element={<MapeamentoDeProdutos />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
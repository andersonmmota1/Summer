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
// Removido: import AnaliseDeFornecedor from "./pages/AnaliseDeFornecedor";
import AnaliseDeProdutosVendidos from "./pages/AnaliseDeProdutosVendidos";
import ProdutosNaoMapeados from "./pages/ProdutosNaoMapeados";
import VisaoDeConversoes from "./pages/VisaoDeConversoes";
import VisaoDeNotasFiscais from "./pages/VisaoDeNotasFiscais";
import CustoProdutos from "./pages/CustoProdutos";
import VendasPorData from "./pages/VendasPorData"; 
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
// Removido: import { FilterProvider } from "./contexts/FilterContext";

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
        <SessionContextProvider>
          {/* Removido: <FilterProvider> */}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><DashboardShell /></ProtectedRoute>}>
                <Route index element={<Navigate to="/inicio" replace />} />
                <Route path="inicio" element={<Inicio />} />
                <Route path="estoque" element={<Estoque />} />
                <Route path="fluxo-de-caixa" element={<FluxoDeCaixa />} />
                <Route path="carga-de-dados" element={<CargaDeDados />} />
                {/* Removido: <Route path="analise-de-fornecedor" element={<AnaliseDeFornecedor />} /> */}
                <Route path="analise-de-produtos-vendidos" element={<AnaliseDeProdutosVendidos />} />
                <Route path="produtos-nao-mapeados" element={<ProdutosNaoMapeados />} />
                <Route path="visao-de-conversoes" element={<VisaoDeConversoes />} />
                <Route path="visao-de-notas-fiscais" element={<VisaoDeNotasFiscais />} />
                <Route path="custo-produtos" element={<CustoProdutos />} />
                <Route path="vendas-por-data" element={<VendasPorData />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          {/* Removido: </FilterProvider> */}
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
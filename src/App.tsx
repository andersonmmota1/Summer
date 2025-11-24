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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardShell />}>
            <Route index element={<Navigate to="/inicio" replace />} /> {/* Redireciona / para /inicio */}
            <Route path="inicio" element={<Inicio />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="fluxo-de-caixa" element={<FluxoDeCaixa />} />
            <Route path="carga-de-dados" element={<CargaDeDados />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
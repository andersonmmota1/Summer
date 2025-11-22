import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProcessXml from "./pages/ProcessXml";
import Login from "./pages/Login"; // Importando a nova página de Login
import { SessionContextProvider } from "./components/SessionContextProvider"; // Importando o provedor de sessão

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider> {/* Envolvendo as rotas com o provedor de sessão */}
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/process-xml" element={<ProcessXml />} />
            <Route path="/login" element={<Login />} /> {/* Nova rota para a página de login */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
"use client";

import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import Sidebar from './Sidebar';

const DashboardShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Início', path: '/inicio' },
    { name: 'Estoque', path: '/estoque' },
    { name: 'Fluxo de Caixa', path: '/fluxo-de-caixa' },
    { name: 'Carga de Dados', path: '/carga-de-dados' },
    { name: 'Visão de Notas Fiscais', path: '/visao-de-notas-fiscais' },
    { name: 'Análise de Fornecedor', path: '/analise-de-fornecedor' },
    { name: 'Análise de Produtos Vendidos', path: '/analise-de-produtos-vendidos' },
    { name: 'Vendas por Data', path: '/vendas-por-data' }, 
    { name: 'Produtos Não Mapeados', path: '/produtos-nao-mapeados' },
    { name: 'Visão de Conversões', path: '/visao-de-conversoes' },
    { name: 'Custo de Produtos', path: '/custo-produtos' },
    { name: 'Produtos Sem Ficha Técnica', path: '/produtos-sem-ficha-tecnica' },
    { name: 'Produtos Internos Não Utilizados', path: '/produtos-internos-nao-utilizados' },
    { name: 'Previsão de Compras', path: '/previsao-de-compras' },
    { name: 'Web Scraper (Experimental)', path: '/web-scraper' }, // Novo item de navegação
  ];

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erro ao fazer logout:', error);
      showError(`Erro ao fazer logout: ${error.message}`);
    } else {
      // O redirecionamento é tratado pelo SessionContextProvider
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Barra Lateral */}
      <Sidebar navItems={navItems} currentPath={location.pathname} onLogout={handleLogout} />

      {/* Área de Conteúdo Principal */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Cabeçalho */}
        <header className="bg-white dark:bg-gray-800 shadow-sm p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Gestão de Restaurante
            </h1>
            <div className="flex items-center gap-4">
            </div>
          </div>
        </header>

        {/* Área de Conteúdo das Páginas com rolagem independente */}
        <main className="flex-grow overflow-y-auto p-6">
          <Outlet /> {/* Aqui as páginas específicas serão renderizadas */}
        </main>
      </div>
    </div>
  );
};

export default DashboardShell;
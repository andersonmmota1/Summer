import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

const DashboardShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Início', path: '/inicio' },
    { name: 'Estoque', path: '/estoque' },
    { name: 'Fluxo de Caixa', path: '/fluxo-de-caixa' },
    { name: 'Carga de Dados', path: '/carga-de-dados' },
    { name: 'Mapeamento de Produtos', path: '/mapeamento-de-produtos' },
    { name: 'Análise de Fornecedor', path: '/analise-de-fornecedor' },
    { name: 'Análise de Produtos Vendidos', path: '/analise-de-produtos-vendidos' },
    { name: 'Produtos Não Mapeados', path: '/produtos-nao-mapeados' },
    { name: 'Visão de Conversões', path: '/visao-de-conversoes' }, // Novo item de navegação
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
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Cabeçalho de Navegação */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Gestão de Restaurante
          </h1>
          <div className="flex items-center space-x-4">
            <NavigationMenu>
              <NavigationMenuList>
                {navItems.map((item) => (
                  <NavigationMenuItem key={item.path}>
                    <NavigationMenuLink asChild
                      className={cn(
                        navigationMenuTriggerStyle(),
                        location.pathname === item.path
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Link to={item.path}>
                        {item.name}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
            <Button onClick={handleLogout} variant="destructive">
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Área de Conteúdo das Páginas */}
      <main className="flex-grow container mx-auto p-6">
        <Outlet /> {/* Aqui as páginas específicas serão renderizadas */}
      </main>
    </div>
  );
};

export default DashboardShell;
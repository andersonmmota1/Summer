import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

const DashboardShell: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Início', path: '/inicio' },
    { name: 'Estoque', path: '/estoque' },
    { name: 'Fluxo de Caixa', path: '/fluxo-de-caixa' },
    { name: 'Carga de Dados', path: '/carga-de-dados' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Cabeçalho de Navegação */}
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Gestão de Restaurante
          </h1>
          <NavigationMenu>
            <NavigationMenuList>
              {navItems.map((item) => (
                <NavigationMenuItem key={item.path}>
                  <Link to={item.path} legacyBehavior passHref>
                    <NavigationMenuLink
                      className={cn(
                        navigationMenuTriggerStyle(),
                        location.pathname === item.path
                          ? 'bg-primary text-primary-foreground'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {item.name}
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
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
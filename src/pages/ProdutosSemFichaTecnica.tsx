import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, ArrowUpDown } from 'lucide-react'; // Importar ArrowUpDown
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { createExcelFile } from '@/utils/excel';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais
import { Input } from '@/components/ui/input'; // Importar Input

interface ProductWithoutRecipeSummary {
  user_id: string;
  sold_product_name: string;
  additional_code: string | null; // Adicionado: Código adicional do produto
  total_sales_count: number;
  total_quantity_sold: number;
  total_revenue: number;
  // last_sale_date: string; // Removido
}

// Nova interface para configuração de ordenação
interface SortConfig {
  key: keyof ProductWithoutRecipeSummary | null;
  direction: 'asc' | 'desc' | null;
}

const ProdutosSemFichaTecnica: React.FC = () => {
  const { user } = useSession();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'sold_product_name', direction: 'asc' }); // Estado de ordenação
  const [searchTerm, setSearchTerm] = useState<string>(''); // Novo estado para o termo de busca

  const { data: productsWithoutRecipes, isLoading, isError, error } = useQuery<ProductWithoutRecipeSummary[], Error>({
    queryKey: ['products_without_recipes_summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('products_without_recipes_summary')
        .select('*, additional_code') // Selecionar o novo campo
        .eq('user_id', user.id)
        .order('sold_product_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar produtos sem ficha técnica:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  // Função para lidar com a ordenação
  const handleSort = (key: keyof ProductWithoutRecipeSummary) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Dados filtrados e ordenados
  const filteredAndSortedProductsWithoutRecipes = useMemo(() => {
    if (!productsWithoutRecipes) return [];
    let itemsToProcess = [...productsWithoutRecipes];

    // 1. Filtragem pelo termo de busca
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      itemsToProcess = itemsToProcess.filter(item =>
        (item.sold_product_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.additional_code?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        String(item.total_sales_count).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.total_quantity_sold).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.total_revenue).toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // 2. Ordenação
    if (sortConfig.key) {
      itemsToProcess.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }
    return itemsToProcess;
  }, [productsWithoutRecipes, sortConfig, searchTerm]); // Adicionar searchTerm como dependência

  const handleExportToExcel = () => {
    if (!filteredAndSortedProductsWithoutRecipes || filteredAndSortedProductsWithoutRecipes.length === 0) {
      showWarning('Não há produtos sem ficha técnica para exportar.');
      return;
    }

    const headers = [
      'Codigo Produto', // Movido para o início
      'Nome do Produto Vendido',
      'Total de Vendas',
      'Quantidade Total Vendida',
      'Receita Total',
      // 'Última Data de Venda', // Removido
    ];

    const formattedData = filteredAndSortedProductsWithoutRecipes.map(item => ({
      'Codigo Produto': item.additional_code || 'N/A', // Movido para o início
      'Nome do Produto Vendido': item.sold_product_name,
      'Total de Vendas': item.total_sales_count,
      'Quantidade Total Vendida': item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Receita Total': item.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      // 'Última Data de Venda': format(parseISO(item.last_sale_date), 'dd/MM/yyyy', { locale: ptBR }), // Removido
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosSemFichaTecnica');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_sem_ficha_tecnica.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos sem ficha técnica exportados com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos sem ficha técnica...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os produtos sem ficha técnica: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos Vendidos Sem Ficha Técnica
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página lista todos os produtos que foram vendidos, mas que ainda não possuem uma ficha técnica cadastrada.
        É importante cadastrar as fichas técnicas na página "Carga de Dados" para que o custo dos produtos vendidos e o estoque sejam calculados corretamente.
      </p>

      {filteredAndSortedProductsWithoutRecipes && filteredAndSortedProductsWithoutRecipes.length === 0 && productsWithoutRecipes && productsWithoutRecipes.length > 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum resultado encontrado para o filtro atual.</p>
          <p className="text-sm mt-2">Tente ajustar o termo de busca.</p>
        </div>
      ) : filteredAndSortedProductsWithoutRecipes && filteredAndSortedProductsWithoutRecipes.length === 0 && productsWithoutRecipes && productsWithoutRecipes.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos vendidos já possuem ficha técnica cadastrada!</p>
          <p className="text-sm mt-2">Não há produtos pendentes de ficha técnica.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Produtos Pendentes de Ficha Técnica</CardTitle>
                <CardDescription>
                  Lista de produtos vendidos que precisam de uma ficha técnica.
                </CardDescription>
              </div>
              <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Exportar para Excel
              </Button>
            </div>
            <Input
              placeholder="Filtrar por código, nome do produto, vendas, quantidade ou receita..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mt-4"
            />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('additional_code')}
                        className="px-0 py-0 h-auto"
                      >
                        Codigo Produto
                        {sortConfig.key === 'additional_code' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('sold_product_name')}
                        className="px-0 py-0 h-auto"
                      >
                        Nome do Produto Vendido
                        {sortConfig.key === 'sold_product_name' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('total_sales_count')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Total de Vendas
                        {sortConfig.key === 'total_sales_count' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('total_quantity_sold')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Qtd. Total Vendida
                        {sortConfig.key === 'total_quantity_sold' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('total_revenue')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Receita Total
                        {sortConfig.key === 'total_revenue' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                    {/* <TableHead>Última Venda</TableHead> */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProductsWithoutRecipes?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.additional_code || 'N/A'}</TableCell> {/* Movido para o início */}
                      <TableCell className="font-medium">{item.sold_product_name}</TableCell>
                      <TableCell className="text-right">{item.total_sales_count}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{item.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      {/* <TableCell>{format(parseISO(item.last_sale_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProdutosSemFichaTecnica;
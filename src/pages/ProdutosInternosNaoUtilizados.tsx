import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, ArrowUpDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { createExcelFile } from '@/utils/excel';
import { cn } from '@/lib/utils';

interface InternalProductAverageCost {
  user_id: string;
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

interface ProductRecipe {
  user_id: string;
  internal_product_name: string;
}

interface UnusedInternalProduct {
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

interface SortConfig {
  key: keyof UnusedInternalProduct | null;
  direction: 'asc' | 'desc' | null;
}

const ProdutosInternosNaoUtilizados: React.FC = () => {
  const { user } = useSession();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'internal_product_name', direction: 'asc' });

  const { data: allInternalProducts, isLoading: isLoadingAll, isError: isErrorAll, error: errorAll } = useQuery<InternalProductAverageCost[], Error>({
    queryKey: ['internal_product_average_cost', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('internal_product_average_cost')
        .select('*')
        .eq('user_id', user.id)
        .order('internal_product_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: usedInternalProductsInRecipes, isLoading: isLoadingUsed, isError: isErrorUsed, error: errorUsed } = useQuery<ProductRecipe[], Error>({
    queryKey: ['product_recipes_internal_products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('product_recipes')
        .select('internal_product_name')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isLoadingAll || isLoadingUsed;
  const isError = isErrorAll || isErrorUsed;
  const error = errorAll || errorUsed;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar dados de produtos internos não utilizados:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const handleSort = (key: keyof UnusedInternalProduct) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const unusedInternalProducts = useMemo(() => {
    if (!allInternalProducts) return []; // Se não há produtos internos comprados, não há o que filtrar

    // Se não há fichas técnicas, todos os produtos comprados são considerados "não utilizados"
    if (!usedInternalProductsInRecipes || usedInternalProductsInRecipes.length === 0) {
      return allInternalProducts;
    }

    const usedProductNames = new Set(usedInternalProductsInRecipes.map(p => p.internal_product_name.trim()));

    let sortableItems = allInternalProducts.filter(product => {
      // Filtra produtos que NÃO estão na lista de produtos utilizados em receitas
      return !usedProductNames.has(product.internal_product_name.trim());
    });

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (aValue.localeCompare(bValue) < 0) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue.localeCompare(bValue) > 0) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [allInternalProducts, usedInternalProductsInRecipes, sortConfig]);

  const totalValuePurchasedSum = useMemo(() => {
    return unusedInternalProducts.reduce((sum, item) => sum + item.total_value_purchased, 0);
  }, [unusedInternalProducts]);

  const totalQuantityConvertedSum = useMemo(() => {
    return unusedInternalProducts.reduce((sum, item) => sum + item.total_quantity_converted, 0);
  }, [unusedInternalProducts]);

  const handleExportToExcel = () => {
    if (!unusedInternalProducts || unusedInternalProducts.length === 0) {
      showWarning('Não há produtos internos não utilizados para exportar.');
      return;
    }

    const headers = [
      'Nome Interno do Produto',
      'Unidade Interna',
      'Valor Total Comprado',
      'Quantidade Total Convertida',
      'Custo Unitário Médio',
    ];

    const formattedData = unusedInternalProducts.map(item => ({
      'Nome Interno do Produto': item.internal_product_name,
      'Unidade Interna': item.internal_unit,
      'Valor Total Comprado': item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Quantidade Total Convertida': item.total_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Custo Unitário Médio': item.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosInternosNaoUtilizados');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_internos_nao_utilizados.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos internos não utilizados exportados com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos internos não utilizados...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os produtos internos não utilizados: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  const hasInternalProducts = allInternalProducts && allInternalProducts.length > 0;
  const hasRecipes = usedInternalProductsInRecipes && usedInternalProductsInRecipes.length > 0;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos Internos Não Utilizados em Fichas Técnicas
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página lista os produtos internos que foram comprados e registrados no sistema,
        mas que não aparecem como componentes em nenhuma ficha técnica de produtos vendidos.
        Isso pode indicar produtos que não estão sendo utilizados ou que precisam ter suas fichas técnicas atualizadas.
      </p>

      {hasInternalProducts && !hasRecipes && (
        <div className="text-center text-yellow-600 dark:text-yellow-400 py-4 mb-6 border border-yellow-300 dark:border-yellow-700 rounded-md bg-yellow-50 dark:bg-yellow-950">
          <p className="text-lg font-semibold">Atenção: Nenhuma ficha técnica de produto foi cadastrada.</p>
          <p className="text-sm mt-1">Para ver os produtos internos *não utilizados*, por favor, carregue as fichas técnicas na página "Carga de Dados" (aba "Ficha Técnica"). Atualmente, todos os produtos comprados são exibidos aqui.</p>
        </div>
      )}

      {unusedInternalProducts && unusedInternalProducts.length === 0 && hasInternalProducts && hasRecipes ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos internos estão sendo utilizados em fichas técnicas!</p>
          <p className="text-sm mt-2">Não há produtos internos sem utilização.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Valor Total Comprado (Não Utilizado)</CardTitle>
                <CardDescription>
                  Somatório do valor de compra de todos os produtos internos não utilizados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {totalValuePurchasedSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantidade Total Convertida (Não Utilizada)</CardTitle>
                <CardDescription>
                  Somatório da quantidade convertida de todos os produtos internos não utilizados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {totalQuantityConvertedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unidades
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Produtos Internos Sem Utilização</CardTitle>
                  <CardDescription>
                    Lista de produtos internos que não são componentes de nenhuma ficha técnica.
                  </CardDescription>
                </div>
                <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Exportar para Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('internal_product_name')}
                          className="px-0 py-0 h-auto"
                        >
                          Nome Interno do Produto
                          {sortConfig.key === 'internal_product_name' && (
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
                          onClick={() => handleSort('internal_unit')}
                          className="px-0 py-0 h-auto"
                        >
                          Unidade Interna
                          {sortConfig.key === 'internal_unit' && (
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
                        onClick={() => handleSort('total_value_purchased')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Valor Total Comprado
                        {sortConfig.key === 'total_value_purchased' && (
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
                        onClick={() => handleSort('total_quantity_converted')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Qtd. Total Convertida
                        {sortConfig.key === 'total_quantity_converted' && (
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
                        onClick={() => handleSort('average_unit_cost')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Custo Unitário Médio
                        {sortConfig.key === 'average_unit_cost' && (
                          <ArrowUpDown
                            className={cn(
                              "ml-2 h-4 w-4 transition-transform",
                              sortConfig.direction === 'desc' && "rotate-180"
                            )}
                          />
                        )}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unusedInternalProducts?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                      <TableCell>{item.internal_unit}</TableCell>
                      <TableCell className="text-right">{item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{item.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProdutosInternosNaoUtilizados;
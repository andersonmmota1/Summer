import React, { useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SoldItemRaw {
  sale_date: string;
  product_name: string;
  quantity_sold: number;
  total_value_sold: number | null;
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
}

interface SoldProductCost {
  sold_product_name: string;
  estimated_cost_of_sold_product: number;
}

interface ProductCostAnalysis {
  sold_product_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  estimated_unit_cost: number;
  total_estimated_cost: number;
  margin: number;
  margin_percentage: number;
}

interface SortConfig {
  key: keyof ProductCostAnalysis | null;
  direction: 'asc' | 'desc' | null;
}

const Inicio: React.FC = () => {
  const { user } = useSession();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'total_revenue', direction: 'desc' });

  const fetchAllSoldItemsRaw = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id) {
      return [];
    }
    let allData: SoldItemRaw[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('sold_items')
        .select('sale_date, product_name, quantity_sold, total_value_sold, group_name, subgroup_name, additional_code')
        .eq('user_id', user.id);

      const { data, error } = await query
        .order('sale_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Inicio: Erro ao carregar todos os itens vendidos (paginação):', error);
        showError(`Erro ao carregar dados: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += data.length;
        hasMore = data.length === limit;
      } else {
        hasMore = false;
      }
    }
    console.log('Inicio: Raw data from Supabase (all items for user, paginated):', allData);
    return allData;
  };

  const { data: rawSoldItems, isLoading: isLoadingSoldItems, isError: isErrorSoldItems, error: errorSoldItems } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_raw', user?.id],
    queryFn: fetchAllSoldItemsRaw,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onSuccess: () => {
      // showSuccess('Dados brutos de vendas carregados com sucesso!');
    },
    onError: (err) => {
      console.error('Inicio: Erro no React Query ao carregar dados brutos de vendas:', err);
      showError(`Erro ao carregar dados brutos de vendas: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const { data: soldProductCosts, isLoading: isLoadingProductCosts, isError: isErrorProductCosts, error: errorProductCosts } = useQuery<SoldProductCost[], Error>({
    queryKey: ['sold_product_cost_inicio', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('sold_product_cost')
        .select('sold_product_name, estimated_cost_of_sold_product')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      console.error('Inicio: Erro no React Query ao carregar custos de produtos:', err);
      showError(`Erro ao carregar custos de produtos: ${err instanceof Error ? err.message : String(err)}`);
    },
  });

  const isLoading = isLoadingSoldItems || isLoadingProductCosts;
  const isError = isErrorSoldItems || isErrorProductCosts;
  const error = errorSoldItems || errorProductCosts;

  const salesByGroup = useMemo(() => {
    if (!rawSoldItems) return [];
    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number; itemCount: number }> = {};
    rawSoldItems.forEach(item => {
      const groupName = item.group_name || 'Sem Grupo';
      const itemTotalValue = item.total_value_sold ?? 0;
      const itemQuantity = item.quantity_sold ?? 0;
      if (!aggregatedData[groupName]) {
        aggregatedData[groupName] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      if (itemTotalValue > 0) {
        aggregatedData[groupName].total_quantity_sold += itemQuantity;
        aggregatedData[groupName].total_value_sold += itemTotalValue;
        aggregatedData[groupName].itemCount++;
      }
    });
    return Object.keys(aggregatedData).map(groupName => {
      const total_quantity_sold = aggregatedData[groupName].total_quantity_sold;
      const total_value_sold = aggregatedData[groupName].total_value_sold;
      const itemCount = aggregatedData[groupName].itemCount;
      const average_ticket = total_quantity_sold > 0 ? total_value_sold / total_quantity_sold : 0;
      return {
        name: groupName,
        total_quantity_sold,
        total_value_sold,
        average_ticket,
      };
    })
    .filter(group => group.total_quantity_sold > 0 || group.total_value_sold > 0)
    .sort((a, b) => b.total_value_sold - a.total_value_sold);
  }, [rawSoldItems]);

  const salesBySubgroup = useMemo(() => {
    if (!rawSoldItems) return [];
    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number; itemCount: number }> = {};
    rawSoldItems.forEach(item => {
      const subgroupName = item.subgroup_name || 'Sem Subgrupo';
      const itemTotalValue = item.total_value_sold ?? 0;
      const itemQuantity = item.quantity_sold ?? 0;
      if (!aggregatedData[subgroupName]) {
        aggregatedData[subgroupName] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      if (itemTotalValue > 0) {
        aggregatedData[subgroupName].total_quantity_sold += itemQuantity;
        aggregatedData[subgroupName].total_value_sold += itemTotalValue;
        aggregatedData[subgroupName].itemCount++;
      }
    });
    return Object.keys(aggregatedData).map(subgroupName => {
      const total_quantity_sold = aggregatedData[subgroupName].total_quantity_sold;
      const total_value_sold = aggregatedData[subgroupName].total_value_sold;
      const itemCount = aggregatedData[subgroupName].itemCount;
      const average_ticket = total_quantity_sold > 0 ? total_value_sold / total_quantity_sold : 0;
      return {
        name: subgroupName,
        total_quantity_sold,
        total_value_sold,
        average_ticket,
      };
    })
    .filter(subgroup => subgroup.total_quantity_sold > 0 || subgroup.total_value_sold > 0)
    .sort((a, b) => b.total_value_sold - a.total_value_sold);
  }, [rawSoldItems]);

  const totalQuantitySoldSum = useMemo(() => {
    return salesByGroup.reduce((sum, group) => sum + group.total_quantity_sold, 0);
  }, [salesByGroup]);

  const totalValueSoldSum = useMemo(() => {
    return salesByGroup.reduce((sum, group) => sum + group.total_value_sold, 0);
  }, [salesByGroup]);

  const productCostAnalysis = useMemo(() => {
    if (!rawSoldItems || !soldProductCosts) return [];
    const costsMap = new Map<string, number>();
    soldProductCosts.forEach(cost => {
      costsMap.set(cost.sold_product_name, cost.estimated_cost_of_sold_product);
    });

    const aggregatedSales = new Map<string, { total_quantity_sold: number; total_value_sold: number }>();
    rawSoldItems.forEach(item => {
      const current = aggregatedSales.get(item.product_name) || { total_quantity_sold: 0, total_value_sold: 0 };
      current.total_quantity_sold += item.quantity_sold;
      current.total_value_sold += (item.total_value_sold ?? 0);
      aggregatedSales.set(item.product_name, current);
    });

    const analysis: ProductCostAnalysis[] = [];
    aggregatedSales.forEach((sales, productName) => {
      const estimatedUnitCost = costsMap.get(productName);
      if (estimatedUnitCost !== undefined) {
        const totalEstimatedCost = sales.total_quantity_sold * estimatedUnitCost;
        const margin = sales.total_value_sold - totalEstimatedCost;
        const margin_percentage = sales.total_value_sold > 0 ? (margin / sales.total_value_sold) * 100 : 0;
        analysis.push({
          sold_product_name: productName,
          total_quantity_sold: sales.total_quantity_sold,
          total_revenue: sales.total_value_sold,
          estimated_unit_cost: estimatedUnitCost,
          total_estimated_cost: totalEstimatedCost,
          margin: margin,
          margin_percentage: margin_percentage,
        });
      }
    });
    return analysis;
  }, [rawSoldItems, soldProductCosts]);

  const handleSort = (key: keyof ProductCostAnalysis) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedCostAnalysis = useMemo(() => {
    let sortableItems = [...productCostAnalysis];
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(item =>
        item.sold_product_name.toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.total_quantity_sold).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.total_revenue).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.estimated_unit_cost).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.total_estimated_cost).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.margin).toLowerCase().includes(lowerCaseSearchTerm) ||
        String(item.margin_percentage).toLowerCase().includes(lowerCaseSearchTerm)
      );
    }
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
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
    return sortableItems;
  }, [productCostAnalysis, searchTerm, sortConfig]);

  // Função auxiliar para formatar valores com segurança
  const formatCurrency = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função auxiliar para formatar quantidades com segurança
  const formatQuantity = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '0,00';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Função auxiliar para formatar porcentagem com segurança
  const formatPercentage = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '0,00%';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Bem-vindo ao Dashboard de Gestão do Restaurante!
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Use a navegação acima para explorar as diferentes seções da gestão do seu restaurante.
      </p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total de Produtos Vendidos</CardTitle>
            <CardDescription>
              Somatório da quantidade total de todos os produtos vendidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando total de produtos vendidos...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar total de produtos vendidos: {error instanceof Error ? error.message : String(error)}
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalQuantitySoldSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unidades
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valor Total Vendido</CardTitle>
            <CardDescription>
              Somatório do valor total de todos os produtos vendidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando valor total vendido...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar valor total vendido: {error instanceof Error ? error.message : String(error)}
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalValueSoldSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Grupo</CardTitle>
            <CardDescription>
              Valor total vendido, quantidade de itens e ticket médio por grupo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando vendas por grupo...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar vendas por grupo: {error instanceof Error ? error.message : String(error)}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Grupo</TableHead>
                      <TableHead className="text-right text-xs">Valor Total Vendido</TableHead>
                      <TableHead className="text-right text-xs">Qtd. Itens</TableHead>
                      <TableHead className="text-right text-xs">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesByGroup.length > 0 ? (
                      salesByGroup.map((group, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-xs">{group.name}</TableCell>
                          <TableCell className="text-right text-xs">
                            {group.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {group.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {group.average_ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-12 text-center text-xs text-gray-600 dark:text-gray-400">
                          Nenhum dado de grupo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Subgrupo</CardTitle>
            <CardDescription>
              Valor total vendido, quantidade de itens e ticket médio por subgrupo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando vendas por subgrupo...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar vendas por subgrupo: {error instanceof Error ? error.message : String(error)}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Subgrupo</TableHead>
                      <TableHead className="text-right text-xs">Valor Total Vendido</TableHead>
                      <TableHead className="text-right text-xs">Qtd. Itens</TableHead>
                      <TableHead className="text-right text-xs">Ticket Médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesBySubgroup.length > 0 ? (
                      salesBySubgroup.map((subgroup, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-xs">{subgroup.name}</TableCell>
                          <TableCell className="text-right text-xs">
                            {subgroup.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {subgroup.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {subgroup.average_ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-12 text-center text-xs text-gray-600 dark:text-gray-400">
                          Nenhum dado de subgrupo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Análise de Custo e Margem por Produto Vendido</CardTitle>
                <CardDescription>
                  Custo, receita e margem para produtos com ficha técnica e custo médio de matéria-prima.
                </CardDescription>
              </div>
            </div>
            <Input
              placeholder="Filtrar por nome do produto, custo, receita ou margem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mt-4"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando análise de custo e margem...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar análise de custo e margem: {error instanceof Error ? error.message : String(error)}
              </div>
            ) : filteredAndSortedCostAnalysis.length === 0 ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                <p className="text-lg">Nenhum produto com custo cadastrado e vendas encontradas.</p>
                <p className="text-sm mt-2">
                  Certifique-se de ter carregado dados de vendas e fichas técnicas, e que os produtos internos tenham um custo médio calculado (visível na página de Estoque).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('sold_product_name')}
                          className="px-0 py-0 h-auto"
                        >
                          Produto Vendido
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
                          onClick={() => handleSort('estimated_unit_cost')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Custo Unitário Estimado
                          {sortConfig.key === 'estimated_unit_cost' && (
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
                          onClick={() => handleSort('total_estimated_cost')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Custo Total Estimado
                          {sortConfig.key === 'total_estimated_cost' && (
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
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('margin')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Margem (R$)
                          {sortConfig.key === 'margin' && (
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
                          onClick={() => handleSort('margin_percentage')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Margem (%)
                          {sortConfig.key === 'margin_percentage' && (
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
                    {filteredAndSortedCostAnalysis.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.sold_product_name}</TableCell>
                        <TableCell className="text-right">{formatQuantity(item.total_quantity_sold)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.estimated_unit_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_estimated_cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.margin)}</TableCell>
                        <TableCell className="text-right">{formatPercentage(item.margin_percentage)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inicio;
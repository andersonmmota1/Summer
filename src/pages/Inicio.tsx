import React, { useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'; // Importar componentes de tabela
// Removido: import { useFilter } from '@/contexts/FilterContext';

interface SoldItemRaw {
  sale_date: string;
  product_name: string;
  quantity_sold: number;
  total_value_sold: number | null;
  group_name: string | null; // Adicionado
  subgroup_name: string | null; // Adicionado
  additional_code: string | null; // Adicionado
}

interface SalesByDate {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
  itemCount: number;
}

interface AggregatedSales {
  name: string;
  total_quantity_sold: number;
  total_value_sold: number;
  average_ticket: number; // Adicionado para o ticket médio
  itemCount: number; // Adicionado para a quantidade de itens
}

const Inicio: React.FC = () => {
  const { user } = useSession();
  // Removido: const { filters = {} } = useFilter(); // Default para objeto vazio
  // Removido: const { selectedProduct } = filters;

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
        .select('sale_date, product_name, quantity_sold, total_value_sold, group_name, subgroup_name, additional_code') // Selecionar novos campos
        .eq('user_id', user.id);

      // Removido: if (selectedProduct) {
      // Removido:   query = query.eq('product_name', selectedProduct); // Filtrar por product_name
      // Removido: }

      const { data, error } = await query
        .order('sale_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Inicio: Erro ao carregar todos os itens vendidos (paginação):', error);
        showError(`Erro ao carregar dados: ${error.message}`);
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

  const { data: rawSoldItems, isLoading, isError, error } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_raw', user?.id], // Removido selectedProduct da chave
    queryFn: fetchAllSoldItemsRaw,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onSuccess: () => {
      // showSuccess('Dados brutos de vendas carregados com sucesso!');
    },
    onError: (err) => {
      console.error('Inicio: Erro no React Query ao carregar dados brutos de vendas:', err);
      showError(`Erro ao carregar dados brutos de vendas: ${err.message}`);
    },
  });

  const salesByDate = useMemo(() => {
    if (!rawSoldItems) return [];

    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number; itemCount: number }> = {};
    
    rawSoldItems.forEach(item => {
      const dateKey = item.sale_date;
      const itemTotalValue = item.total_value_sold ?? 0;
      
      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += item.quantity_sold;
      aggregatedData[dateKey].total_value_sold += itemTotalValue;
      aggregatedData[dateKey].itemCount++;
    });

    return Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
      itemCount: aggregatedData[dateKey].itemCount,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [rawSoldItems]);

  const totalQuantitySoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_quantity_sold, 0) || 0;
  }, [salesByDate]);

  const totalValueSoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_value_sold, 0) || 0;
  }, [salesByDate]);

  // NOVO: Agregação de vendas por Grupo
  const salesByGroup = useMemo(() => {
    if (!rawSoldItems) return [];

    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number; itemCount: number }> = {};

    rawSoldItems.forEach(item => {
      const groupName = item.group_name || 'Sem Grupo';
      const itemTotalValue = item.total_value_sold ?? 0;

      if (!aggregatedData[groupName]) {
        aggregatedData[groupName] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      aggregatedData[groupName].total_quantity_sold += item.quantity_sold;
      aggregatedData[groupName].total_value_sold += itemTotalValue;
      aggregatedData[groupName].itemCount++; // Incrementa a contagem de itens
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
        itemCount,
      };
    })
    .filter(group => group.total_quantity_sold > 0 || group.total_value_sold > 0) // Filtra grupos com quantidade e valor zero
    .sort((a, b) => b.total_value_sold - a.total_value_sold); // Ordena por valor total vendido
  }, [rawSoldItems]);

  // NOVO: Agregação de vendas por Subgrupo
  const salesBySubgroup = useMemo(() => {
    if (!rawSoldItems) return [];

    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number; itemCount: number }> = {};

    rawSoldItems.forEach(item => {
      const subgroupName = item.subgroup_name || 'Sem Subgrupo';
      const itemTotalValue = item.total_value_sold ?? 0;

      if (!aggregatedData[subgroupName]) {
        aggregatedData[subgroupName] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      aggregatedData[subgroupName].total_quantity_sold += item.quantity_sold;
      aggregatedData[subgroupName].total_value_sold += itemTotalValue;
      aggregatedData[subgroupName].itemCount++; // Incrementa a contagem de itens
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
        itemCount,
      };
    })
    .filter(subgroup => subgroup.total_quantity_sold > 0 || subgroup.total_value_sold > 0) // Filtra subgrupos com quantidade e valor zero
    .sort((a, b) => b.total_value_sold - a.total_value_sold); // Ordena por valor total vendido
  }, [rawSoldItems]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Bem-vindo ao Dashboard de Gestão do Restaurante!
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Use a navegação acima para explorar as diferentes seções da gestão do seu restaurante.
      </p>

      {/* Removido: {selectedProduct && (
        <div className="mb-4">
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filtrando por Produto: <span className="font-bold text-primary">{selectedProduct}</span>
          </span>
        </div>
      )} */}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Layout ajustado para 2 colunas em telas grandes */}
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
                Erro ao carregar total de produtos vendidos: {error?.message}
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
                Erro ao carregar valor total vendido: {error?.message}
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalValueSoldSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* NOVO CARD: Vendas por Grupo (agora como tabela) */}
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
                Erro ao carregar vendas por grupo: {error?.message}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60"> {/* Adicionado max-h e overflow para rolagem */}
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
                            {group.itemCount.toLocaleString('pt-BR')}
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

        {/* NOVO CARD: Vendas por Subgrupo (agora como tabela) */}
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
                Erro ao carregar vendas por subgrupo: {error?.message}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60"> {/* Adicionado max-h e overflow para rolagem */}
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
                            {subgroup.itemCount.toLocaleString('pt-BR')}
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
      </div>
    </div>
  );
};

export default Inicio;
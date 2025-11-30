import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SoldItemRaw {
  id: string;
  sale_date: string;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  total_value_sold: number | null;
  group_name: string | null; // Adicionado
  subgroup_name: string | null;
  additional_code: string | null; // Adicionado
}

interface SalesByDateAggregated {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
  itemCount: number;
}

const VendasPorData: React.FC = () => {
  const { user } = useSession();

  const fetchAllSoldItems = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id) {
      return [];
    }

    let allData: SoldItemRaw[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('sold_items')
        .select('id, sale_date, product_name, quantity_sold, unit_price, total_value_sold, group_name, subgroup_name, additional_code') // Selecionar novos campos
        .eq('user_id', user.id)
        .order('sale_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('VendasPorData: Erro ao carregar todos os itens vendidos (paginação):', error);
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
    return allData;
  };

  const { data: rawSoldItems, isLoading, isError, error } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_vendas_por_data', user?.id],
    queryFn: fetchAllSoldItems,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      console.error('VendasPorData: Erro no React Query ao carregar dados brutos de vendas:', err);
      showError(`Erro ao carregar dados brutos de vendas: ${err.message}`);
    },
  });

  const aggregatedSalesByDate = useMemo(() => {
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

  const individualSoldItems = useMemo(() => {
    if (!rawSoldItems) return [];

    let filteredItems = rawSoldItems;

    return filteredItems.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [rawSoldItems]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dados de vendas...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os dados de vendas: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Vendas por Data e Produto
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize o resumo das vendas por data e os produtos vendidos individualmente.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Vendas Agregadas por Data */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Data</CardTitle>
            <CardDescription>
              Resumo das vendas diárias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aggregatedSalesByDate.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Nenhuma venda encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Qtd. Total Vendida</TableHead>
                      <TableHead className="text-right">Valor Total Vendido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregatedSalesByDate.map((sale) => (
                      <TableRow
                        key={sale.sale_date}
                      >
                        <TableCell className="font-medium">
                          {format(parseISO(sale.sale_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          {sale.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {sale.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card: Produtos Vendidos Detalhados */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos Vendidos Detalhados</CardTitle>
            <CardDescription>
              Lista de cada item vendido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {individualSoldItems.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Nenhum produto vendido encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Adicional (Grupo)</TableHead> {/* Novo cabeçalho */}
                      <TableHead>Cód. Produto</TableHead> {/* Novo cabeçalho */}
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {individualSoldItems.map((item) => (
                      <TableRow
                        key={item.id}
                      >
                        <TableCell>{format(parseISO(item.sale_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell>{item.group_name || 'N/A'}</TableCell> {/* Novo campo */}
                        <TableCell>{item.additional_code || 'N/A'}</TableCell> {/* Novo campo */}
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{(item.total_value_sold ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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

export default VendasPorData;
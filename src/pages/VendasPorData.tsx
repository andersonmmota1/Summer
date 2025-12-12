import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { CalendarIcon, XCircle, ArrowUpDown } from 'lucide-react'; // Importar ArrowUpDown
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface SoldItemRaw {
  id: string;
  sale_date: string;
  product_name: string;
  total_quantity_sold: number; // Alterado de quantity_sold
  // unit_price: number; // Removido
  total_value_sold: number | null;
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
}

interface SalesByDateAggregated {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
  itemCount: number;
}

interface AggregatedSoldProduct {
  product_name: string;
  total_quantity_sold: number;
  total_value_sold: number;
}

// NOVO: Interface para configuração de ordenação
interface SortConfig {
  key: keyof AggregatedSoldProduct | null;
  direction: 'asc' | 'desc' | null;
}

const VendasPorData: React.FC = () => {
  const { user } = useSession();
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'total_value_sold', direction: 'desc' }); // Estado de ordenação padrão

  const formattedSelectedDates = useMemo(() => {
    if (!selectedDates || selectedDates.length === 0) return [];
    return selectedDates.map(date => format(date, 'yyyy-MM-dd'));
  }, [selectedDates]);

  const fetchAllSoldItems = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id || formattedSelectedDates.length === 0) {
      return [];
    }

    let query = supabase
      .from('sold_items')
      .select('id, sale_date, product_name, total_quantity_sold, total_value_sold, group_name, subgroup_name, additional_code') // Alterado para total_quantity_sold e removido unit_price
      .eq('user_id', user.id)
      .in('sale_date', formattedSelectedDates);

    query = query.order('sale_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('VendasPorData: Erro ao carregar todos os itens vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
      throw error;
    }
    return data || [];
  };

  const { data: rawSoldItems, isLoading, isError, error } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_vendas_por_data', user?.id, formattedSelectedDates],
    queryFn: fetchAllSoldItems,
    enabled: !!user?.id && formattedSelectedDates.length > 0,
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
      const itemQuantity = item.total_quantity_sold ?? 0; // Alterado para total_quantity_sold

      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += itemQuantity;
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

  const handleSort = (key: keyof AggregatedSoldProduct) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const aggregatedSoldProducts = useMemo(() => {
    if (!rawSoldItems) return [];

    const productMap = new Map<string, AggregatedSoldProduct>();

    rawSoldItems.forEach(item => {
      const productName = item.product_name;
      const current = productMap.get(productName) || { product_name: productName, total_quantity_sold: 0, total_value_sold: 0 };
      current.total_quantity_sold += item.total_quantity_sold; // Alterado para total_quantity_sold
      current.total_value_sold += (item.total_value_sold ?? 0);
      productMap.set(productName, current);
    });

    let sortableProducts = Array.from(productMap.values());

    // Aplicar ordenação
    if (sortConfig.key) {
      sortableProducts.sort((a, b) => {
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

    return sortableProducts;
  }, [rawSoldItems, sortConfig]); // Adicionar sortConfig como dependência

  const grandTotalValueSold = useMemo(() => {
    return rawSoldItems?.reduce((sum, item) => sum + (item.total_value_sold ?? 0), 0) || 0;
  }, [rawSoldItems]);

  const handleClearDateFilter = () => {
    setSelectedDates(undefined);
  };

  const defaultCalendarMonth = useMemo(() => addMonths(new Date(), -1), []);

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

      <div className="flex items-center gap-4 mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-[300px] justify-start text-left font-normal",
                !selectedDates || selectedDates.length === 0 && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDates && selectedDates.length > 0 ? (
                `${selectedDates.length} dia(s) selecionado(s)`
              ) : (
                <span>Selecione os dias para análise</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="multiple"
              month={defaultCalendarMonth}
              selected={selectedDates}
              onSelect={setSelectedDates}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        {selectedDates && selectedDates.length > 0 && (
          <Button variant="outline" onClick={handleClearDateFilter} className="gap-2">
            <XCircle className="h-4 w-4" /> Limpar Filtro
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Valor Total Vendido (Período Selecionado)</CardTitle>
          <CardDescription>
            Somatório do valor total de todos os produtos vendidos no período filtrado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {grandTotalValueSold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendas por Data</CardTitle>
            <CardDescription>
              Resumo das vendas diárias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aggregatedSalesByDate.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Nenhuma venda encontrada para o período selecionado.</p>
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

        <Card>
          <CardHeader>
            <CardTitle>Produtos Vendidos Detalhados</CardTitle>
            <CardDescription>
              Somatório de quantidade e valor por produto vendido no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aggregatedSoldProducts.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Nenhum produto vendido encontrado para o período selecionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('product_name')}
                          className="px-0 py-0 h-auto"
                        >
                          Produto
                          {sortConfig.key === 'product_name' && (
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
                          Quantidade Total
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
                          onClick={() => handleSort('total_value_sold')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Valor Total
                          {sortConfig.key === 'total_value_sold' && (
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
                    {aggregatedSoldProducts.map((item, index) => (
                      <TableRow key={item.product_name || index}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
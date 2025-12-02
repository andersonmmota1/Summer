import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { CalendarIcon, XCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface SoldItemRaw {
  id: string;
  sale_date: string;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
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

const VendasPorData: React.FC = () => {
  const { user } = useSession();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const fetchAllSoldItems = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id) {
      return [];
    }

    let query = supabase
      .from('sold_items')
      .select('id, sale_date, product_name, quantity_sold, unit_price, total_value_sold, group_name, subgroup_name, additional_code')
      .eq('user_id', user.id);

    if (dateRange?.from) {
      query = query.gte('sale_date', format(dateRange.from, 'yyyy-MM-dd'));
    }
    if (dateRange?.to) {
      query = query.lte('sale_date', format(dateRange.to, 'yyyy-MM-dd'));
    }

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
    queryKey: ['all_sold_items_vendas_por_data', user?.id, dateRange], // Adicionado dateRange à chave da query
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
    return rawSoldItems.sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [rawSoldItems]);

  const handleClearDateFilter = () => {
    setDateRange(undefined);
  };

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
                !dateRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                )
              ) : (
                <span>Selecione um intervalo de datas</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
        {dateRange?.from && (
          <Button variant="outline" onClick={handleClearDateFilter} className="gap-2">
            <XCircle className="h-4 w-4" /> Limpar Filtro
          </Button>
        )}
      </div>

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
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">Nenhum produto vendido encontrado para o período selecionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Adicional (Grupo)</TableHead>
                      <TableHead>Cód. Produto</TableHead>
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
                        <TableCell>{item.group_name || 'N/A'}</TableCell>
                        <TableCell>{item.additional_code || 'N/A'}</TableCell>
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
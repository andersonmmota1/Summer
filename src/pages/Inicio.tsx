import React, { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// Removendo imports não utilizados para manter o código limpo
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { format, parseISO } from 'date-fns';
// import { ptBR } from 'date-fns/locale';
// import { Button } from '@/components/ui/button';
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { ScrollArea } from '@/components/ui/scroll-area';

interface SoldItemRaw { // Nova interface para dados brutos do Supabase
  sale_date: string;
  quantity_sold: number;
  total_value_sold: number | null;
}

interface SalesByDate {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
}

const Inicio: React.FC = () => {
  const { user } = useSession();

  const fetchAllSoldItemsRaw = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id) {
      return [];
    }
    const { data, error } = await supabase
      .from('sold_items')
      .select('sale_date, quantity_sold, total_value_sold')
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false }); // Ainda ordena para consistência, mas a agregação é no cliente

    if (error) {
      console.error('Erro ao carregar todos os itens vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
      throw error;
    }
    return data || [];
  };

  const { data: rawSoldItems, isLoading, isError, error } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_raw', user?.id], // Nova chave de query para dados brutos
    queryFn: fetchAllSoldItemsRaw,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onSuccess: () => {
      // showSuccess('Dados brutos de vendas carregados com sucesso!');
    },
    onError: (err) => {
      console.error('Erro no React Query ao carregar dados brutos de vendas:', err);
      showError(`Erro ao carregar dados brutos de vendas: ${err.message}`);
    },
  });

  const salesByDate = useMemo(() => {
    if (!rawSoldItems) return [];

    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number }> = {};

    rawSoldItems.forEach(item => {
      const dateKey = item.sale_date;
      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += item.quantity_sold;
      aggregatedData[dateKey].total_value_sold += (item.total_value_sold ?? 0);
    });

    return Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [rawSoldItems]);

  // Calcula o somatório total da quantidade e valor vendidos
  const totalQuantitySoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_quantity_sold, 0) || 0;
  }, [salesByDate]);

  const totalValueSoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_value_sold, 0) || 0;
  }, [salesByDate]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Bem-vindo ao Dashboard de Gestão do Restaurante!
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Use a navegação acima para explorar as diferentes seções da gestão do seu restaurante.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"> {/* Adicionado grid para os cards */}
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
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {totalQuantitySoldSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unidades
              </p>
            )}
          </CardContent>
        </Card>

        {/* Novo Card para o Valor Total Vendido */}
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
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {totalValueSoldSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inicio;
import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

interface SalesByDate {
  sale_date: string; // Agora será uma string 'YYYY-MM-DD'
  total_quantity_sold: number;
  total_value_sold: number;
}

interface SoldItemDetailed {
  id: string;
  sale_date: string;
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  total_value_sold: number | null;
  created_at: string;
}

const Inicio: React.FC = () => {
  const { user } = useSession();

  const fetchSalesByDate = async (): Promise<SalesByDate[]> => {
    if (!user?.id) {
      return [];
    }
    const { data, error } = await supabase
      .from('sold_items')
      .select('sale_date, quantity_sold, total_value_sold')
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Erro ao carregar vendas por data:', error);
      showError(`Erro ao carregar vendas por data: ${error.message}`);
      throw error;
    }

    // Agregação manual dos dados por data
    const aggregatedData: Record<string, { total_quantity_sold: number; total_value_sold: number }> = {};

    data?.forEach(item => {
      const dateKey = item.sale_date; // A data já vem como 'YYYY-MM-DD'
      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += item.quantity_sold;
      aggregatedData[dateKey].total_value_sold += (item.total_value_sold ?? 0); // Garante que null seja tratado como 0
    });

    // Converte o objeto agregado de volta para um array e ordena por data
    const finalAggregatedArray = Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()); // Ordena do mais recente para o mais antigo

    return finalAggregatedArray;
  };

  const { data: salesByDate, isLoading, isError, error } = useQuery<SalesByDate[], Error>({
    queryKey: ['sales_by_date', user?.id], // A chave da query inclui o ID do usuário
    queryFn: fetchSalesByDate,
    enabled: !!user?.id, // A query só será executada se houver um user.id
    staleTime: 1000 * 60 * 5, // Os dados são considerados "frescos" por 5 minutos
    onSuccess: () => {
      // showSuccess('Vendas por data carregadas com sucesso!'); // Comentado para evitar muitos toasts
    },
    onError: (err) => {
      console.error('Erro no React Query ao carregar vendas por data:', err);
      showError(`Erro ao carregar vendas por data: ${err.message}`);
    },
  });

  // Calcula o somatório total da quantidade e valor vendidos
  const totalQuantitySoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_quantity_sold, 0) || 0;
  }, [salesByDate]);

  // Mantém o cálculo do valor total, mas não será exibido diretamente
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

      <div className="mt-8">
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
      </div>
    </div>
  );
};

export default Inicio;
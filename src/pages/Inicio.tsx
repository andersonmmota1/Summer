import React, { useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SoldItemRaw {
  sale_date: string;
  quantity_sold: number;
  total_value_sold: number | null;
}

interface SalesByDate {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
  itemCount: number; // Adicionado para armazenar a contagem de itens por data
}

const Inicio: React.FC = () => {
  const { user } = useSession();
  const problematicDate = '2025-11-01'; // Data problemática para depuração

  const fetchAllSoldItemsRaw = async (): Promise<SoldItemRaw[]> => {
    if (!user?.id) {
      return [];
    }
    // A consulta agora será simples, confiando no limite de linhas configurado no Supabase
    const { data, error } = await supabase
      .from('sold_items')
      .select('sale_date, quantity_sold, total_value_sold')
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Inicio: Erro ao carregar todos os itens vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
      throw error;
    }
    console.log('Inicio: Raw data from Supabase (all items for user):', data);
    return data || [];
  };

  const { data: rawSoldItems, isLoading, isError, error } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['all_sold_items_raw', user?.id],
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
    let debugSumProblematicDate = 0;
    let debugCountProblematicDate = 0;

    rawSoldItems.forEach(item => {
      const dateKey = item.sale_date;
      const itemTotalValue = item.total_value_sold ?? 0;
      
      if (dateKey === problematicDate) {
        console.log(`Inicio: Item for ${problematicDate} - received number: ${itemTotalValue}`);
        debugSumProblematicDate += itemTotalValue;
        debugCountProblematicDate++;
        console.log(`Inicio: Running sum for ${problematicDate}: ${debugSumProblematicDate}, Running count: ${debugCountProblematicDate}`);
      }

      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0, itemCount: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += item.quantity_sold;
      aggregatedData[dateKey].total_value_sold += itemTotalValue;
      aggregatedData[dateKey].itemCount++;
    });

    if (aggregatedData[problematicDate]) {
      console.log(`Inicio: Final aggregated total_value_sold for ${problematicDate} (client-side): ${aggregatedData[problematicDate].total_value_sold}`);
      console.log(`Inicio: Final aggregated item count for ${problematicDate} (client-side): ${aggregatedData[problematicDate].itemCount}`);
    } else {
      console.log(`Inicio: No aggregated data found for ${problematicDate}.`);
    }

    return Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
      itemCount: aggregatedData[dateKey].itemCount,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
  }, [rawSoldItems]);

  // Novo useEffect para buscar a contagem diretamente do Supabase para a data problemática
  useEffect(() => {
    const checkSupabaseCount = async () => {
      if (!user?.id) return;
      
      const { count, error } = await supabase
        .from('sold_items')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('sale_date', problematicDate);

      if (error) {
        console.error(`Inicio: Erro ao buscar contagem de itens para ${problematicDate} no Supabase:`, error);
      } else {
        console.log(`Inicio: Total items for ${problematicDate} directly from Supabase (count query): ${count}`);
      }
    };
    checkSupabaseCount();
  }, [user?.id, problematicDate]); // Dependência de user.id e problematicDate

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
                Erro ao carregar total de produtos vendidos: {error?.message}
              </div>
            ) : (
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
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
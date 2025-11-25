import React, { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SalesByDate {
  sale_date: string;
  total_quantity_sold: number;
  total_value_sold: number;
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
      const dateFromSupabase = new Date(item.sale_date);
      // Extrai os componentes da data UTC para criar uma data local sem deslocamento de fuso horário
      const year = dateFromSupabase.getUTCFullYear();
      const month = dateFromSupabase.getUTCMonth(); // 0-indexed
      const day = dateFromSupabase.getUTCDate();

      // Cria um novo objeto Date no fuso horário local usando os componentes UTC
      // Isso garante que o dia do calendário seja preservado, independentemente do fuso horário local
      const localDateForDisplay = new Date(year, month, day);
      
      const dateKey = format(localDateForDisplay, 'yyyy-MM-dd'); 
      if (!aggregatedData[dateKey]) {
        aggregatedData[dateKey] = { total_quantity_sold: 0, total_value_sold: 0 };
      }
      aggregatedData[dateKey].total_quantity_sold += item.quantity_sold;
      aggregatedData[dateKey].total_value_sold += (item.total_value_sold ?? 0); // Garante que null seja tratado como 0
    });

    // Converte o objeto agregado de volta para um array e ordena por data
    return Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()); // Ordena do mais recente para o mais antigo
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
            <CardTitle>Vendas por Data</CardTitle>
            <CardDescription>
              Somatório de produtos vendidos e valor total por data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Carregando vendas por data...
              </div>
            ) : isError ? (
              <div className="text-center text-red-600 dark:text-red-400 py-4">
                Erro ao carregar vendas por data: {error?.message}
              </div>
            ) : (salesByDate && salesByDate.length > 0) ? (
              <>
                <div className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">
                  <p>Total Geral Vendido: {totalQuantitySoldSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unidades</p>
                  <p>Valor Total Geral: {totalValueSoldSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data da Venda</TableHead>
                        <TableHead className="text-right">Qtd. Total Vendida</TableHead>
                        <TableHead className="text-right">Valor Total Vendido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByDate.map((sale, index) => {
                        const dateFromSupabase = new Date(sale.sale_date);
                        // Extrai os componentes da data UTC para criar uma data local sem deslocamento de fuso horário
                        const year = dateFromSupabase.getUTCFullYear();
                        const month = dateFromSupabase.getUTCMonth(); // 0-indexed
                        const day = dateFromSupabase.getUTCDate();

                        // Cria um novo objeto Date no fuso horário local usando os componentes UTC
                        const localDateForDisplay = new Date(year, month, day);

                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{format(localDateForDisplay, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                            <TableCell className="text-right">{sale.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{sale.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                Nenhum dado de venda encontrado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inicio;
import React, { useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
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
  const [selectedDateForDetails, setSelectedDateForDetails] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [detailedSoldItems, setDetailedSoldItems] = useState<SoldItemDetailed[]>([]);
  const [loadingDetailedItems, setLoadingDetailedItems] = useState(false);

  const fetchSalesByDate = async (): Promise<SalesByDate[]> => {
    if (!user?.id) {
      console.log('Inicio: Usuário não autenticado, retornando dados vazios.');
      return [];
    }
    console.log('Inicio: Fetching sold_items for user:', user.id);
    const { data, error } = await supabase
      .from('sold_items')
      .select('sale_date, quantity_sold, total_value_sold')
      .eq('user_id', user.id)
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Inicio: Erro ao carregar vendas por data:', error);
      showError(`Erro ao carregar vendas por data: ${error.message}`);
      throw error;
    }

    console.log('Inicio: Raw data from sold_items (before aggregation):', JSON.stringify(data, null, 2));
    // Filter for the problematic date to inspect
    const problematicDateItems = data?.filter(item => item.sale_date === '2025-11-01');
    console.log('Inicio: Items for 2025-11-01 (before aggregation):', JSON.stringify(problematicDateItems, null, 2));


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

    console.log('Inicio: Aggregated data before final array conversion:', JSON.stringify(aggregatedData, null, 2));
    console.log('Inicio: Aggregated total for 2025-11-01:', aggregatedData['2025-11-01'] ? `Qtd: ${aggregatedData['2025-11-01'].total_quantity_sold}, Valor: ${aggregatedData['2025-11-01'].total_value_sold}` : 'N/A');


    // Converte o objeto agregado de volta para um array e ordena por data
    const finalAggregatedArray = Object.keys(aggregatedData).map(dateKey => ({
      sale_date: dateKey,
      total_quantity_sold: aggregatedData[dateKey].total_quantity_sold,
      total_value_sold: aggregatedData[dateKey].total_value_sold,
    })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime()); // Ordena do mais recente para o mais antigo

    console.log('Inicio: Final aggregated and sorted data:', JSON.stringify(finalAggregatedArray, null, 2));
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

  const totalValueSoldSum = useMemo(() => {
    return salesByDate?.reduce((sum, sale) => sum + sale.total_value_sold, 0) || 0;
  }, [salesByDate]);

  const fetchDetailedSoldItems = async (date: string) => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar detalhes de vendas.');
      return;
    }
    setLoadingDetailedItems(true);
    const loadingToastId = showLoading(`Carregando detalhes de vendas para ${format(parseISO(date), 'dd/MM/yyyy')}...`);
    try {
      const { data, error } = await supabase
        .from('sold_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('sale_date', date)
        .order('product_name', { ascending: true });

      if (error) throw error;
      setDetailedSoldItems(data || []);
      showSuccess('Detalhes de vendas carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar detalhes de vendas:', error);
      showError(`Erro ao carregar detalhes: ${error.message}`);
    } finally {
      setLoadingDetailedItems(false);
      dismissToast(loadingToastId);
    }
  };

  const handleViewDetails = async (date: string) => {
    setSelectedDateForDetails(date);
    await fetchDetailedSoldItems(date);
    setIsDetailsDialogOpen(true);
  };

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
              Somatório de produtos vendidos e valor total por data. Clique em "Detalhes" para ver os itens individuais.
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
                        <TableHead className="text-right">Valor Total Vendida</TableHead>
                        <TableHead className className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByDate.map((sale, index) => {
                        const displayDate = parseISO(sale.sale_date);
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{format(displayDate, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                            <TableCell className="text-right">{sale.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{sale.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(sale.sale_date)}>
                                Detalhes
                              </Button>
                            </TableCell>
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

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes de Vendas para {selectedDateForDetails ? format(parseISO(selectedDateForDetails), 'dd/MM/yyyy', { locale: ptBR }) : ''}</DialogTitle>
            <DialogDescription>
              Lista de todos os produtos vendidos individualmente nesta data.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-grow pr-4">
            {loadingDetailedItems ? (
              <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                Carregando detalhes...
              </div>
            ) : detailedSoldItems.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                Nenhum item vendido encontrado para esta data.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Subgrupo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Unitário</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedSoldItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell>{item.group_name || 'N/A'}</TableCell>
                        <TableCell>{item.subgroup_name || 'N/A'}</TableCell>
                        <TableCell>{item.additional_code || 'N/A'}</TableCell>
                        <TableCell className="text-right">{item.quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell className="text-right">{(item.total_value_sold ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inicio;
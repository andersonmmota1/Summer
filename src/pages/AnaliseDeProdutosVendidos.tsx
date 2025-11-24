import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AggregatedSoldProduct {
  product_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  average_unit_price: number;
  last_sale_date: string;
}

const AnaliseDeProdutosVendidos: React.FC = () => {
  const [aggregatedSoldData, setAggregatedSoldData] = useState<AggregatedSoldProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAggregatedSoldData();
  }, []);

  const fetchAggregatedSoldData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de análise de produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('aggregated_sold_products')
        .select('*')
        .order('total_revenue', { ascending: false });

      if (error) throw error;

      setAggregatedSoldData(data || []);
      showSuccess('Dados de análise de produtos vendidos carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de análise de produtos vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dados de análise...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Análise de Produtos Vendidos
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize informações agregadas sobre os produtos que foram vendidos.
      </p>

      {aggregatedSoldData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de venda encontrado para análise.</p>
          <p className="text-sm mt-2">Você precisará adicionar dados à tabela `sold_items` para ver a análise aqui.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Vendas por Produto</CardTitle>
            <CardDescription>
              Dados agregados de todos os produtos vendidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Produto</TableHead>
                    <TableHead className="text-right">Qtd. Total Vendida</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                    <TableHead className="text-right">Preço Unitário Médio</TableHead>
                    <TableHead>Última Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedSoldData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_sold.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.total_revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.average_unit_price.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(item.last_sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnaliseDeProdutosVendidos;
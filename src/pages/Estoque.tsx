import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface CurrentStockSummary {
  internal_product_name: string;
  internal_unit: string;
  current_stock_quantity: number;
  total_purchased_value: number;
  total_consumed_quantity_from_sales: number;
}

const Estoque: React.FC = () => {
  const [stockData, setStockData] = useState<CurrentStockSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de estoque...');
    try {
      const { data, error } = await supabase
        .from('current_stock_summary')
        .select('*')
        .order('internal_product_name', { ascending: true });

      if (error) throw error;

      setStockData(data || []);
      showSuccess('Dados de estoque carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de estoque:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando gestão de estoque...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Gestão de Estoque
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Aqui você pode visualizar o estoque atual dos seus produtos internos,
        calculado a partir das compras (com unidades convertidas) e do consumo via vendas (com base nas fichas técnicas).
      </p>

      {stockData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de estoque encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades
            nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Estoque Atual de Produtos Internos</CardTitle>
            <CardDescription>
              Visão geral do estoque de cada produto interno, considerando compras e consumo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome Interno do Produto</TableHead>
                    <TableHead>Unidade Interna</TableHead>
                    <TableHead className="text-right">Estoque Atual</TableHead>
                    <TableHead className="text-right">Qtd. Comprada (Convertida)</TableHead>
                    <TableHead className="text-right">Qtd. Consumida (Vendas)</TableHead>
                    <TableHead className="text-right">Valor Total Comprado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                      <TableCell>{item.internal_unit}</TableCell>
                      <TableCell className="text-right">{item.current_stock_quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{(item.total_purchased_value / (item.current_stock_quantity + item.total_consumed_quantity_from_sales > 0 ? (item.current_stock_quantity + item.total_consumed_quantity_from_sales) : 1)).toFixed(2)}</TableCell> {/* Placeholder for total purchased quantity, needs actual value from converted_units_summary */}
                      <TableCell className="text-right">{item.total_consumed_quantity_from_sales.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.total_purchased_value.toFixed(2)}</TableCell>
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

export default Estoque;
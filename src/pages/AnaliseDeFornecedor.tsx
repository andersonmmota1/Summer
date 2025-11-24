import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AggregatedSupplierProduct {
  supplier_name: string;
  supplier_product_code: string;
  supplier_product_description: string;
  supplier_unit: string;
  total_quantity_purchased: number;
  total_value_purchased: number;
  average_unit_value: number;
  last_purchase_date: string;
}

const AnaliseDeFornecedor: React.FC = () => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedSupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAggregatedData();
  }, []);

  const fetchAggregatedData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de análise de fornecedor...');
    try {
      const { data, error } = await supabase
        .from('aggregated_supplier_products')
        .select('*')
        .order('supplier_name', { ascending: true })
        .order('supplier_product_description', { ascending: true });

      if (error) throw error;

      setAggregatedData(data || []);
      showSuccess('Dados de análise de fornecedor carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de análise de fornecedor:', error);
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
        Análise de Fornecedor
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize informações agregadas sobre os produtos comprados de cada fornecedor.
      </p>

      {aggregatedData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de compra encontrado para análise.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado arquivos XML ou Excel na página "Carga de Dados".</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Compras por Fornecedor e Produto</CardTitle>
            <CardDescription>
              Dados agregados de todos os itens comprados, agrupados por fornecedor e descrição do produto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Cód. Produto Fornecedor</TableHead>
                    <TableHead>Descrição do Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Qtd. Total Comprada</TableHead>
                    <TableHead className="text-right">Valor Total Gasto</TableHead>
                    <TableHead className="text-right">Valor Unitário Médio</TableHead>
                    <TableHead>Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregatedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.supplier_name}</TableCell>
                      <TableCell>{item.supplier_product_code}</TableCell>
                      <TableCell>{item.supplier_product_description}</TableCell>
                      <TableCell>{item.supplier_unit}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_purchased.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.total_value_purchased.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.average_unit_value.toFixed(2)}</TableCell>
                      <TableCell>{format(new Date(item.last_purchase_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
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

export default AnaliseDeFornecedor;
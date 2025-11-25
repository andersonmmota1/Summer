import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConvertedUnitSummary {
  supplier_name: string;
  supplier_product_code: string;
  supplier_product_description: string;
  supplier_unit: string;
  internal_unit: string;
  conversion_factor: number;
  product_display_name: string;
  total_original_quantity_purchased: number;
  total_converted_quantity: number;
  total_value_purchased: number;
  average_original_unit_value: number;
  last_purchase_date: string;
}

const VisaoDeConversoes: React.FC = () => {
  const [convertedData, setConvertedData] = useState<ConvertedUnitSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConvertedData();
  }, []);

  const fetchConvertedData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando visão de conversões...');
    try {
      const { data, error } = await supabase
        .from('converted_units_summary')
        .select('*');

      if (error) throw error;

      setConvertedData(data || []);
      showSuccess('Visão de conversões carregada com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar visão de conversões:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const totalConvertedQuantity = useMemo(() => {
    return convertedData.reduce((sum, item) => sum + item.total_converted_quantity, 0);
  }, [convertedData]);

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando visão de conversões...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Visão de Conversões de Unidades
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Aqui você pode verificar os produtos comprados que possuem conversão de unidade registrada,
        visualizando as quantidades originais e as quantidades convertidas para suas unidades internas.
      </p>

      {convertedData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum item com conversão de unidade encontrada.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado dados de compras e conversões de unidades na página "Carga de Dados".</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Total de Unidades Convertidas</CardTitle>
              <CardDescription>
                Somatório de todas as quantidades convertidas para unidades internas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Total Convertido: {totalConvertedQuantity.toFixed(2)} unidades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes das Conversões de Unidades</CardTitle>
              <CardDescription>
                Lista detalhada de cada produto com sua conversão de unidade aplicada.
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
                      <TableHead>Nome Interno</TableHead>
                      <TableHead>Unidade Fornecedor</TableHead>
                      <TableHead>Unidade Interna</TableHead>
                      <TableHead className="text-right">Fator Conversão</TableHead>
                      <TableHead className="text-right">Qtd. Original</TableHead>
                      <TableHead className="text-right">Qtd. Convertida</TableHead>
                      <TableHead className="text-right">Valor Total Gasto</TableHead>
                      <TableHead>Última Compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convertedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.supplier_name}</TableCell>
                        <TableCell>{item.supplier_product_code}</TableCell>
                        <TableCell>{item.supplier_product_description}</TableCell>
                        <TableCell>{item.product_display_name}</TableCell>
                        <TableCell>{item.supplier_unit}</TableCell>
                        <TableCell>{item.internal_unit}</TableCell>
                        <TableCell className="text-right">{item.conversion_factor.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.total_original_quantity_purchased.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.total_converted_quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {item.total_value_purchased.toFixed(2)}</TableCell>
                        <TableCell>{format(new Date(item.last_purchase_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VisaoDeConversoes;
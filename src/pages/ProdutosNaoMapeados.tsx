import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UnmappedProductSummary {
  c_prod: string;
  descricao_do_produto: string;
  supplier_name: string;
  u_com: string;
  total_quantity_purchased: number;
  total_value_purchased: number;
  average_unit_value: number;
  last_purchase_date: string;
}

const ProdutosNaoMapeados: React.FC = () => {
  const [unmappedProducts, setUnmappedProducts] = useState<UnmappedProductSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnmappedProducts();
  }, []);

  const fetchUnmappedProducts = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando produtos não mapeados...');
    try {
      const { data, error } = await supabase
        .from('unmapped_purchased_products_summary')
        .select('*');

      if (error) throw error;

      setUnmappedProducts(data || []);
      showSuccess('Produtos não mapeados carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar produtos não mapeados:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos não mapeados...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos de Fornecedores Não Mapeados
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta lista exibe produtos comprados de fornecedores que ainda não possuem um mapeamento para um nome interno.
        Considere mapeá-los na página "Mapeamento de Produtos" para uma análise mais consistente.
      </p>

      {unmappedProducts.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos de fornecedores já estão mapeados!</p>
          <p className="text-sm mt-2">Não há produtos pendentes de mapeamento.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Produtos Não Mapeados</CardTitle>
            <CardDescription>
              Itens comprados que ainda não foram associados a um nome de produto interno.
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
                  {unmappedProducts.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.supplier_name}</TableCell>
                      <TableCell>{item.c_prod}</TableCell>
                      <TableCell>{item.descricao_do_produto}</TableCell>
                      <TableCell>{item.u_com}</TableCell>
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

export default ProdutosNaoMapeados;
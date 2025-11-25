import * as React from 'react'; // Alterado de 'import React from 'react';'
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSession } from '@/components/SessionContextProvider';

interface AggregatedSupplierProduct {
  user_id: string;
  supplier_name: string;
  supplier_product_code: string;
  supplier_product_description: string;
  supplier_unit: string;
  total_quantity_purchased: number;
  total_value_purchased: number;
  average_unit_value: number;
  last_purchase_date: string;
}

interface TotalBySupplier {
  user_id: string;
  supplier_name: string;
  total_value_spent: number;
}

interface InternalProductAverageCost {
  user_id: string;
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

const AnaliseDeFornecedor: React.FC = () => {
  const { user } = useSession();

  const [aggregatedData, setAggregatedData] = useState<AggregatedSupplierProduct[]>([]);
  const [totalBySupplier, setTotalBySupplier] = useState<TotalBySupplier[]>([]);
  const [internalProductCosts, setInternalProductCosts] = useState<InternalProductAverageCost[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => { // Usando React.useEffect explicitamente
    if (user?.id) {
      fetchAnalysisData();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchAnalysisData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de análise de fornecedor...');
    try {
      // 1. Busca de custos médios de produtos internos
      const { data: internalProductCostsResult, error: internalProductCostsError } = await supabase
        .from('internal_product_average_cost')
        .select('*')
        .eq('user_id', user?.id)
        .order('internal_product_name', { ascending: true });

      if (internalProductCostsError) throw internalProductCostsError;
      setInternalProductCosts(internalProductCostsResult || []);

      // 2. Busca de produtos agregados por fornecedor
      const { data: aggregatedDataResult, error: aggregatedError } = await supabase
        .from('aggregated_supplier_products')
        .select('*')
        .eq('user_id', user?.id)
        .order('supplier_name', { ascending: true })
        .order('supplier_product_description', { ascending: true });

      if (aggregatedError) throw aggregatedError;
      setAggregatedData(aggregatedDataResult || []);

      // 3. Busca total comprado por fornecedor
      const { data: totalBySupplierResult, error: totalBySupplierError } = await supabase
        .from('total_purchased_by_supplier')
        .select('*')
        .eq('user_id', user?.id)
        .order('total_value_spent', { ascending: false });

      if (totalBySupplierError) throw totalBySupplierError;
      setTotalBySupplier(totalBySupplierResult || []);

      showSuccess('Dados de análise de fornecedor carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de análise de fornecedor:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  // Calcula o valor total gasto por fornecedor
  const totalValueSpentBySupplier = React.useMemo(() => { // Usando React.useMemo explicitamente
    return totalBySupplier.reduce((sum, item) => sum + item.total_value_spent, 0);
  }, [totalBySupplier]);

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dados de análise...
      </div>
    );
  }

  const hasData = aggregatedData.length > 0 || totalBySupplier.length > 0 || internalProductCosts.length > 0;

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Análise de Fornecedor
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize informações agregadas sobre os produtos comprados de cada fornecedor.
      </p>

      {!hasData ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de compra encontrado para análise.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado arquivos XML ou Excel na página "Carga de Dados".</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Card: Somatório por Fornecedor */}
            <Card>
              <CardHeader>
                <CardTitle>Total Comprado por Fornecedor</CardTitle>
                <CardDescription>
                  Valor total gasto com cada fornecedor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Total Geral: {totalValueSpentBySupplier.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Valor Total Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalBySupplier.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {item.supplier_name}
                          </TableCell>
                          <TableCell className="text-right">{item.total_value_spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Card: Custo Médio por Produto Interno */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Custo Médio por Produto Interno</CardTitle>
                    <CardDescription>
                      Quantidade total comprada e custo médio por unidade de cada produto interno.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {internalProductCosts.length === 0 ? (
                  <p className="text-center text-gray-600 dark:text-gray-400 py-4">
                    Nenhum produto interno encontrado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome Interno do Produto</TableHead>
                          <TableHead>Unidade Interna</TableHead>
                          <TableHead className="text-right">Qtd. Total Comprada</TableHead>
                          <TableHead className="text-right">Custo Médio Unitário</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {internalProductCosts.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {item.internal_product_name}
                            </TableCell>
                            <TableCell>{item.internal_unit}</TableCell>
                            <TableCell className="text-right">{item.total_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{item.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Card: Resumo de Compras por Fornecedor e Produto (existente) */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo de Compras por Fornecedor e Produto</CardTitle>
              <CardDescription>
                Dados agregados de todos os itens comprados, agrupados por fornecedor e descrição do produto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aggregatedData.length === 0 ? (
                <p className="text-center text-gray-600 dark:text-gray-400 py-4">
                  Nenhum dado de compra agregado encontrado.
                </p>
              ) : (
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
                          <TableCell className="text-right">{item.total_quantity_purchased.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell className="text-right">{item.average_unit_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell>{format(new Date(item.last_purchase_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </Card>
        </>
      )}
    </div>
  );
};

export default AnaliseDeFornecedor;
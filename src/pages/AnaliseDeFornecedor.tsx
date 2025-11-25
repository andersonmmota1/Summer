import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFilter } from '@/contexts/FilterContext';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react'; // Importar XCircle para o botão de limpar filtro de produto
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

// Nova interface para o card "Total Comprado por Produto"
interface InternalProductAverageCost {
  user_id: string;
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

// Interface para mapeamento de nomes de produtos (para filtrar aggregatedData)
interface ProductNameConversion {
  supplier_product_name: string;
  internal_product_name: string;
}

const AnaliseDeFornecedor: React.FC = () => {
  const { filters, setFilter, clearFilters } = useFilter();
  const { selectedSupplier, selectedProduct } = filters; // Desestruturado selectedProduct
  const { user } = useSession();

  const [aggregatedData, setAggregatedData] = useState<AggregatedSupplierProduct[]>([]);
  const [totalBySupplier, setTotalBySupplier] = useState<TotalBySupplier[]>([]);
  const [internalProductCosts, setInternalProductCosts] = useState<InternalProductAverageCost[]>([]); // Novo estado
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchAnalysisData();
    } else {
      setLoading(false);
    }
  }, [selectedSupplier, selectedProduct, user?.id]); // Adicionado selectedProduct às dependências

  const fetchAnalysisData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de análise de fornecedor...');
    try {
      // 1. Busca de custos médios de produtos internos (para o card "Total Comprado por Produto")
      let internalProductCostsQuery = supabase
        .from('internal_product_average_cost')
        .select('*')
        .eq('user_id', user?.id);

      if (selectedSupplier) {
        // Se um fornecedor está selecionado, precisamos filtrar os produtos internos que foram comprados desse fornecedor
        // Isso é mais complexo e pode exigir uma view específica ou uma subquery.
        // Por simplicidade, se um fornecedor estiver selecionado, vamos buscar os produtos internos que foram mapeados para produtos desse fornecedor.
        const { data: mappedProducts, error: mapError } = await supabase
          .from('product_name_conversions')
          .select('internal_product_name')
          .eq('user_id', user?.id)
          .eq('supplier_name', selectedSupplier);

        if (mapError) throw mapError;
        const internalProductNamesFromSupplier = mappedProducts.map(p => p.internal_product_name);

        if (internalProductNamesFromSupplier.length > 0) {
          internalProductCostsQuery = internalProductCostsQuery.in('internal_product_name', internalProductNamesFromSupplier);
        } else {
          // Se não houver produtos mapeados para este fornecedor, não há custos a mostrar
          setInternalProductCosts([]);
          // Continuar para as outras queries, mas sem dados para este card
        }
      }

      if (selectedProduct) {
        internalProductCostsQuery = internalProductCostsQuery.eq('internal_product_name', selectedProduct);
      }

      const { data: internalProductCostsResult, error: internalProductCostsError } = await internalProductCostsQuery.order('internal_product_name', { ascending: true });
      if (internalProductCostsError) throw internalProductCostsError;
      setInternalProductCosts(internalProductCostsResult || []);

      // 2. Busca de produtos agregados por fornecedor (para o card "Resumo de Compras...")
      let aggregatedQuery = supabase
        .from('aggregated_supplier_products')
        .select('*')
        .eq('user_id', user?.id);

      if (selectedSupplier) {
        aggregatedQuery = aggregatedQuery.eq('supplier_name', selectedSupplier);
      }

      if (selectedProduct) {
        // Se um produto interno está selecionado, precisamos encontrar os nomes de produtos do fornecedor que mapeiam para ele
        const { data: productNameConversions, error: conversionError } = await supabase
          .from('product_name_conversions')
          .select('supplier_product_name')
          .eq('user_id', user?.id)
          .eq('internal_product_name', selectedProduct);

        if (conversionError) throw conversionError;
        const supplierProductNames = productNameConversions.map(c => c.supplier_product_name);

        if (supplierProductNames.length > 0) {
          aggregatedQuery = aggregatedQuery.in('supplier_product_description', supplierProductNames);
        } else {
          // Se não houver mapeamentos, não há dados agregados para mostrar
          setAggregatedData([]);
          // Continuar para as outras queries, mas sem dados para este card
        }
      }

      aggregatedQuery = aggregatedQuery
        .order('supplier_name', { ascending: true })
        .order('supplier_product_description', { ascending: true });

      const { data: aggregatedDataResult, error: aggregatedError } = await aggregatedQuery;
      if (aggregatedError) throw aggregatedError;
      setAggregatedData(aggregatedDataResult || []);

      // 3. Busca total comprado por fornecedor (para o card "Total Comprado por Fornecedor")
      let totalBySupplierQuery = supabase
        .from('total_purchased_by_supplier')
        .select('*')
        .eq('user_id', user?.id);

      let finalSupplierNamesFilter: string[] | null = null;

      if (selectedProduct) {
        const { data: mappedSuppliers, error: mapSupplierError } = await supabase
          .from('product_name_conversions')
          .select('supplier_name')
          .eq('user_id', user?.id)
          .eq('internal_product_name', selectedProduct);

        if (mapSupplierError) throw mapSupplierError;
        finalSupplierNamesFilter = mappedSuppliers.map(s => s.supplier_name);

        if (finalSupplierNamesFilter.length === 0) {
          setTotalBySupplier([]);
          dismissToast(loadingToastId);
          setLoading(false);
          return; // Exit early as no data will be found
        }
      }

      if (selectedSupplier) {
        if (finalSupplierNamesFilter) {
          // If both selectedSupplier and selectedProduct are active,
          // we need suppliers that match selectedSupplier AND are in finalSupplierNamesFilter
          finalSupplierNamesFilter = finalSupplierNamesFilter.filter(name => name === selectedSupplier);
          if (finalSupplierNamesFilter.length === 0) {
            setTotalBySupplier([]);
            dismissToast(loadingToastId);
            setLoading(false);
            return;
          }
        } else {
          // Only selectedSupplier is active
          finalSupplierNamesFilter = [selectedSupplier];
        }
      }

      if (finalSupplierNamesFilter) {
        totalBySupplierQuery = totalBySupplierQuery.in('supplier_name', finalSupplierNamesFilter);
      }

      totalBySupplierQuery = totalBySupplierQuery.order('total_value_spent', { ascending: false });

      const { data: totalBySupplierResult, error: totalBySupplierError } = await totalBySupplierQuery;
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

  // Handler para clicar no nome de um fornecedor
  const handleSupplierClick = (supplierName: string) => {
    setFilter({ selectedSupplier: supplierName, selectedProduct: null }); // Limpa o filtro de produto ao selecionar fornecedor
  };

  // Handler para clicar no nome de um produto interno
  const handleProductClick = (productName: string) => {
    setFilter({ selectedProduct: productName });
  };

  const handleClearProductFilter = () => {
    setFilter({ selectedProduct: null });
  };

  // Calcula o valor total gasto por fornecedor
  const totalValueSpentBySupplier = useMemo(() => {
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
    <React.Fragment>
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Análise de Fornecedor
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Visualize informações agregadas sobre os produtos comprados de cada fornecedor.
          Clique no nome de um fornecedor na tabela "Total Comprado por Fornecedor" para filtrar os dados.
          Clique no nome de um produto na tabela "Custo Médio por Produto Interno" para filtrar os dados.
        </p>

        {(selectedSupplier || selectedProduct) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Filtros Ativos:
              {selectedSupplier && <span className="ml-2 font-bold text-primary">Fornecedor: {selectedSupplier}</span>}
              {selectedProduct && <span className="ml-2 font-bold text-primary">Produto: {selectedProduct}</span>}
            </span>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XCircle className="h-4 w-4 mr-1" /> Limpar Todos os Filtros
            </Button>
          </div>
        )}

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
                              <Button variant="link" onClick={() => handleSupplierClick(item.supplier_name)} className="p-0 h-auto text-left">
                                {item.supplier_name}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">{item.total_value_spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Novo Card: Custo Médio por Produto Interno */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Custo Médio por Produto Interno</CardTitle>
                      <CardDescription>
                        Quantidade total comprada e custo médio por unidade de cada produto interno.
                      </CardDescription>
                    </div>
                    {selectedProduct && (
                      <Button variant="outline" size="sm" onClick={handleClearProductFilter} className="gap-1">
                        <XCircle className="h-4 w-4" /> Limpar Produto
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {internalProductCosts.length === 0 ? (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-4">
                      Nenhum produto interno encontrado para os filtros aplicados.
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
                                <Button variant="link" onClick={() => handleProductClick(item.internal_product_name)} className="p-0 h-auto text-left">
                                  {item.internal_product_name}
                                </Button>
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
                    Nenhum dado de compra agregado encontrado para os filtros aplicados.
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
                )}
              </CardContent>
            </Card>
          </Card>
          </>
        )}
      </div>
    </React.Fragment>
  );
};

export default AnaliseDeFornecedor;
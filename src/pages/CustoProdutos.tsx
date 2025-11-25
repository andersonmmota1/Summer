import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
// Removido: import { useFilter } from '@/contexts/FilterContext';

interface SoldProductCost {
  sold_product_name: string;
  estimated_cost_of_sold_product: number;
}

interface SoldProductRecipeDetail {
  sold_product_name: string;
  internal_product_name: string;
  quantity_needed: number;
  internal_unit: string;
  average_unit_cost: number;
  component_cost: number;
}

const CustoProdutos: React.FC = () => {
  const { user } = useSession();
  // Removido: const { filters } = useFilter();
  // Removido: const { selectedProduct } = filters;
  const [soldProductCosts, setSoldProductCosts] = useState<SoldProductCost[]>([]);
  const [recipeDetails, setRecipeDetails] = useState<SoldProductRecipeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user?.id) {
      fetchProductCostsAndRecipes();
    } else {
      setLoading(false);
    }
  }, [user?.id]); // Removido selectedProduct das dependências

  const fetchProductCostsAndRecipes = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Calculando custo dos produtos vendidos e carregando fichas técnicas...');
    try {
      // Fetch aggregated sold product costs
      // Este card agrega por sold_product_name, então filtrar por internal_product_name é complexo aqui.
      // Por enquanto, vamos manter este card sem filtro direto por selectedProduct.
      const { data: costsData, error: costsError } = await supabase
        .from('sold_product_cost')
        .select('*')
        .eq('user_id', user?.id)
        .order('sold_product_name', { ascending: true });

      if (costsError) throw costsError;
      setSoldProductCosts(costsData || []);

      // Fetch detailed recipe components with costs
      let detailsQuery = supabase
        .from('sold_product_recipe_details')
        .select('*')
        .eq('user_id', user?.id)
        .order('sold_product_name', { ascending: true })
        .order('internal_product_name', { ascending: true });

      // Removido: if (selectedProduct) {
      // Removido:   detailsQuery = detailsQuery.eq('internal_product_name', selectedProduct); // Filtrar por nome interno do produto
      // Removido: }

      const { data: detailsData, error: detailsError } = await detailsQuery;

      if (detailsError) throw detailsError;
      setRecipeDetails(detailsData || []);

      showSuccess('Custo dos produtos vendidos e fichas técnicas carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de custo e fichas técnicas:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const groupedRecipeDetails = useMemo(() => {
    return recipeDetails.reduce((acc, detail) => {
      if (!acc[detail.sold_product_name]) {
        acc[detail.sold_product_name] = [];
      }
      acc[detail.sold_product_name].push(detail);
      return acc;
    }, {} as Record<string, SoldProductRecipeDetail[]>);
  }, [recipeDetails]);

  const handleToggleRow = (productName: string) => {
    setOpenRows(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Calculando custo dos produtos e carregando fichas técnicas...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Custo de Produtos Vendidos
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página exibe o custo estimado de cada produto vendido, calculado com base nas fichas técnicas cadastradas e no custo médio das matérias-primas (produtos internos).
        Expanda cada produto para ver os detalhes da sua ficha técnica e o custo individual de cada componente.
      </p>

      {/* Removido: {selectedProduct && (
        <div className="mb-4">
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filtrando por Produto Interno: <span className="font-bold text-primary">{selectedProduct}</span>
          </span>
        </div>
      )} */}

      {soldProductCosts.length === 0 && recipeDetails.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum custo de produto vendido ou detalhe de ficha técnica encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Custo Estimado por Produto Vendido</CardTitle>
            <CardDescription>
              Lista de produtos vendidos com seu custo estimado e detalhes da ficha técnica.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto Vendido</TableHead>
                    <TableHead className="text-right">Custo Unitário Estimado</TableHead>
                    <TableHead className="text-right">Detalhes da Ficha Técnica</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soldProductCosts.map((item, index) => (
                    <React.Fragment key={index}>
                      <TableRow>
                        <TableCell className="font-medium">{item.sold_product_name}</TableCell>
                        <TableCell className="text-right">{item.estimated_cost_of_sold_product.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-9 p-0"
                            onClick={() => handleToggleRow(item.sold_product_name)}
                          >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", openRows[item.sold_product_name] && "rotate-180")} />
                            <span className="sr-only">Toggle detalhes da ficha técnica</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {openRows[item.sold_product_name] && (
                        <TableRow>
                          <TableCell colSpan={3} className="py-0 pl-12 pr-4">
                            <div className="py-2 text-sm text-gray-600 dark:text-gray-400">
                              <p className="font-semibold mb-1">Componentes da Ficha Técnica:</p>
                              {(groupedRecipeDetails[item.sold_product_name] || []).length > 0 ? (
                                <ul className="list-disc list-inside space-y-0.5">
                                  {(groupedRecipeDetails[item.sold_product_name] || []).map((detail, i) => (
                                    <li key={i}>
                                      {detail.internal_product_name} ({detail.quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {detail.internal_unit}) - Custo por unidade: {detail.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} - Custo na receita: {detail.component_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>Nenhum componente encontrado para esta ficha técnica.</p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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

export default CustoProdutos;
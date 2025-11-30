import React, { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { createExcelFile } from '@/utils/excel';

interface InternalProductAverageCost {
  user_id: string;
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

interface ProductRecipe {
  user_id: string;
  internal_product_name: string;
}

interface UnusedInternalProduct {
  internal_product_name: string;
  internal_unit: string;
  total_value_purchased: number;
  total_quantity_converted: number;
  average_unit_cost: number;
}

const ProdutosInternosNaoUtilizados: React.FC = () => {
  const { user } = useSession();

  // Fetch all internal products that have an average cost (meaning they've been purchased and converted)
  const { data: allInternalProducts, isLoading: isLoadingAll, isError: isErrorAll, error: errorAll } = useQuery<InternalProductAverageCost[], Error>({
    queryKey: ['internal_product_average_cost', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('internal_product_average_cost')
        .select('*')
        .eq('user_id', user.id)
        .order('internal_product_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch all internal products that are used in any recipe
  const { data: usedInternalProductsInRecipes, isLoading: isLoadingUsed, isError: isErrorUsed, error: errorUsed } = useQuery<ProductRecipe[], Error>({
    queryKey: ['product_recipes_internal_products', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('product_recipes')
        .select('internal_product_name')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isLoadingAll || isLoadingUsed;
  const isError = isErrorAll || isErrorUsed;
  const error = errorAll || errorUsed;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar dados de produtos internos não utilizados:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const unusedInternalProducts = useMemo(() => {
    if (!allInternalProducts || !usedInternalProductsInRecipes) return [];

    const usedProductNames = new Set(usedInternalProductsInRecipes.map(p => p.internal_product_name));

    return allInternalProducts.filter(product => !usedProductNames.has(product.internal_product_name));
  }, [allInternalProducts, usedInternalProductsInRecipes]);

  const handleExportToExcel = () => {
    if (!unusedInternalProducts || unusedInternalProducts.length === 0) {
      showWarning('Não há produtos internos não utilizados para exportar.');
      return;
    }

    const headers = [
      'Nome Interno do Produto',
      'Unidade Interna',
      'Valor Total Comprado',
      'Quantidade Total Convertida',
      'Custo Unitário Médio',
    ];

    const formattedData = unusedInternalProducts.map(item => ({
      'Nome Interno do Produto': item.internal_product_name,
      'Unidade Interna': item.internal_unit,
      'Valor Total Comprado': item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Quantidade Total Convertida': item.total_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Custo Unitário Médio': item.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosInternosNaoUtilizados');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_internos_nao_utilizados.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos internos não utilizados exportados com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos internos não utilizados...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os produtos internos não utilizados: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos Internos Não Utilizados em Fichas Técnicas
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página lista os produtos internos que foram comprados e registrados no sistema,
        mas que não aparecem como componentes em nenhuma ficha técnica de produtos vendidos.
        Isso pode indicar produtos que não estão sendo utilizados ou que precisam ter suas fichas técnicas atualizadas.
      </p>

      {unusedInternalProducts && unusedInternalProducts.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos internos estão sendo utilizados em fichas técnicas!</p>
          <p className="text-sm mt-2">Não há produtos internos sem utilização.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Produtos Internos Sem Utilização</CardTitle>
                <CardDescription>
                  Lista de produtos internos que não são componentes de nenhuma ficha técnica.
                </CardDescription>
              </div>
              <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Exportar para Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome Interno do Produto</TableHead>
                    <TableHead>Unidade Interna</TableHead>
                    <TableHead className="text-right">Valor Total Comprado</TableHead>
                    <TableHead className="text-right">Qtd. Total Convertida</TableHead>
                    <TableHead className="text-right">Custo Unitário Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unusedInternalProducts?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                      <TableCell>{item.internal_unit}</TableCell>
                      <TableCell className="text-right">{item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{item.average_unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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

export default ProdutosInternosNaoUtilizados;
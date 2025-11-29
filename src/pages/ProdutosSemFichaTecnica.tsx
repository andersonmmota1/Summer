import React, { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { createExcelFile } from '@/utils/excel';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProductWithoutRecipeSummary {
  user_id: string;
  sold_product_name: string;
  total_sales_count: number;
  total_quantity_sold: number;
  total_revenue: number;
  last_sale_date: string;
}

const ProdutosSemFichaTecnica: React.FC = () => {
  const { user } = useSession();

  const { data: productsWithoutRecipes, isLoading, isError, error } = useQuery<ProductWithoutRecipeSummary[], Error>({
    queryKey: ['products_without_recipes_summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('products_without_recipes_summary')
        .select('*')
        .eq('user_id', user.id)
        .order('sold_product_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar produtos sem ficha técnica:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const handleExportToExcel = () => {
    if (!productsWithoutRecipes || productsWithoutRecipes.length === 0) {
      showWarning('Não há produtos sem ficha técnica para exportar.');
      return;
    }

    const headers = [
      'Nome do Produto Vendido',
      'Total de Vendas',
      'Quantidade Total Vendida',
      'Receita Total',
      'Última Data de Venda',
    ];

    const formattedData = productsWithoutRecipes.map(item => ({
      'Nome do Produto Vendido': item.sold_product_name,
      'Total de Vendas': item.total_sales_count,
      'Quantidade Total Vendida': item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Receita Total': item.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      'Última Data de Venda': format(parseISO(item.last_sale_date), 'dd/MM/yyyy', { locale: ptBR }),
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosSemFichaTecnica');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_sem_ficha_tecnica.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos sem ficha técnica exportados com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos sem ficha técnica...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os produtos sem ficha técnica: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos Vendidos Sem Ficha Técnica
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página lista todos os produtos que foram vendidos, mas que ainda não possuem uma ficha técnica cadastrada.
        É importante cadastrar as fichas técnicas na página "Carga de Dados" para que o custo dos produtos vendidos e o estoque sejam calculados corretamente.
      </p>

      {productsWithoutRecipes && productsWithoutRecipes.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos vendidos já possuem ficha técnica cadastrada!</p>
          <p className="text-sm mt-2">Não há produtos pendentes de ficha técnica.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Produtos Pendentes de Ficha Técnica</CardTitle>
                <CardDescription>
                  Lista de produtos vendidos que precisam de uma ficha técnica.
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
                    <TableHead>Nome do Produto Vendido</TableHead>
                    <TableHead className="text-right">Total de Vendas</TableHead>
                    <TableHead className="text-right">Qtd. Total Vendida</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                    <TableHead>Última Venda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsWithoutRecipes?.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.sold_product_name}</TableCell>
                      <TableCell className="text-right">{item.total_sales_count}</TableCell>
                      <TableCell className="text-right">{item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{item.total_revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell>{format(parseISO(item.last_sale_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
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

export default ProdutosSemFichaTecnica;
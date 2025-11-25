import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSession } from '@/components/SessionContextProvider';

interface ProductRecipe {
  id: string;
  sold_product_name: string;
  internal_product_name: string;
  quantity_needed: number;
}

const CustoProdutos: React.FC = () => {
  const { user } = useSession();
  const [productRecipes, setProductRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchProductRecipes();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchProductRecipes = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando fichas técnicas de produtos...');
    try {
      const { data, error } = await supabase
        .from('product_recipes')
        .select('*')
        .eq('user_id', user?.id)
        .order('sold_product_name', { ascending: true });

      if (error) throw error;

      setProductRecipes(data || []);
      showSuccess('Fichas técnicas carregadas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar fichas técnicas:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando fichas técnicas...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Custo de Produtos
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página exibe os produtos vendidos que possuem uma ficha técnica cadastrada, detalhando seus componentes internos e as quantidades necessárias.
        Para calcular o custo real de cada produto, seria necessário integrar os custos médios das matérias-primas.
      </p>

      {productRecipes.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhuma ficha técnica de produto encontrada.</p>
          <p className="text-sm mt-2">
            Você pode carregar fichas técnicas na página "Carga de Dados" (aba Ficha Técnica).
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Fichas Técnicas Cadastradas</CardTitle>
            <CardDescription>
              Lista de produtos vendidos e seus componentes internos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto Vendido</TableHead>
                    <TableHead>Nome Interno do Componente</TableHead>
                    <TableHead className="text-right">Quantidade Necessária</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRecipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-medium">{recipe.sold_product_name}</TableCell>
                      <TableCell>{recipe.internal_product_name}</TableCell>
                      <TableCell className="text-right">{recipe.quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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

export default CustoProdutos;
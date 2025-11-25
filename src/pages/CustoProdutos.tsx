import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSession } from '@/components/SessionContextProvider';

interface SoldProductCost {
  sold_product_name: string;
  estimated_cost_of_sold_product: number;
}

const CustoProdutos: React.FC = () => {
  const { user } = useSession();
  const [soldProductCosts, setSoldProductCosts] = useState<SoldProductCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSoldProductCosts();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchSoldProductCosts = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Calculando custo dos produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('sold_product_cost')
        .select('*')
        .eq('user_id', user?.id)
        .order('sold_product_name', { ascending: true });

      if (error) throw error;

      setSoldProductCosts(data || []);
      showSuccess('Custo dos produtos vendidos calculado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao calcular custo dos produtos vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Calculando custo dos produtos...
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
      </p>

      {soldProductCosts.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum custo de produto vendido encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Custo Estimado por Produto Vendido</CardTitle>
            <CardDescription>
              Lista de produtos vendidos com seu custo estimado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto Vendido</TableHead>
                    <TableHead className="text-right">Custo Unitário Estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soldProductCosts.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.sold_product_name}</TableCell>
                      <TableCell className="text-right">{item.estimated_cost_of_sold_product.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
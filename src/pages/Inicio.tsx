import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/components/SessionContextProvider';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface TotalBySupplier {
  supplier_name: string;
  total_value_spent: number;
}

interface AggregatedSoldProduct {
  product_name: string;
  total_revenue: number;
  total_quantity_sold: number;
}

interface SoldProductCost {
  sold_product_name: string;
  estimated_cost_of_sold_product: number;
}

interface CurrentStockSummary {
  internal_product_name: string;
  current_stock_quantity: number;
  internal_unit: string;
}

const Inicio: React.FC = () => {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [totalPurchased, setTotalPurchased] = useState<number>(0);
  const [totalSoldRevenue, setTotalSoldRevenue] = useState<number>(0);
  const [totalSoldCost, setTotalSoldCost] = useState<number>(0);
  const [topSuppliers, setTopSuppliers] = useState<TotalBySupplier[]>([]);
  const [topSoldProducts, setTopSoldProducts] = useState<AggregatedSoldProduct[]>([]);
  const [topStockProducts, setTopStockProducts] = useState<CurrentStockSummary[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados do dashboard...');
    try {
      // Fetch Total Purchased
      const { data: purchasedData, error: purchasedError } = await supabase
        .from('total_purchased_by_supplier')
        .select('total_value_spent')
        .eq('user_id', user?.id); // Ensure filtering by user_id

      if (purchasedError) throw purchasedError;
      const totalP = purchasedData?.reduce((sum, item) => sum + item.total_value_spent, 0) || 0;
      setTotalPurchased(totalP);

      // Fetch Total Sold Revenue
      const { data: soldRevenueData, error: soldRevenueError } = await supabase
        .from('aggregated_sold_products')
        .select('total_revenue')
        .eq('user_id', user?.id); // Ensure filtering by user_id

      if (soldRevenueError) throw soldRevenueError;
      const totalSR = soldRevenueData?.reduce((sum, item) => sum + item.total_revenue, 0) || 0;
      setTotalSoldRevenue(totalSR);

      // Fetch Total Sold Cost
      const { data: soldCostData, error: soldCostError } = await supabase
        .from('sold_product_cost')
        .select('estimated_cost_of_sold_product')
        .eq('user_id', user?.id); // Ensure filtering by user_id

      if (soldCostError) throw soldCostError;
      const totalSC = soldCostData?.reduce((sum, item) => sum + item.estimated_cost_of_sold_product, 0) || 0;
      setTotalSoldCost(totalSC);

      // Fetch Top 5 Suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('total_purchased_by_supplier')
        .select('*')
        .eq('user_id', user?.id) // Ensure filtering by user_id
        .order('total_value_spent', { ascending: false })
        .limit(5);

      if (suppliersError) throw suppliersError;
      setTopSuppliers(suppliersData || []);

      // Fetch Top 5 Sold Products by Revenue
      const { data: soldProductsData, error: soldProductsError } = await supabase
        .from('aggregated_sold_products')
        .select('*')
        .eq('user_id', user?.id) // Ensure filtering by user_id
        .order('total_revenue', { ascending: false })
        .limit(5);

      if (soldProductsError) throw soldProductsError;
      setTopSoldProducts(soldProductsData || []);

      // Fetch Top 5 Stock Products
      const { data: stockData, error: stockError } = await supabase
        .from('current_stock_summary')
        .select('*')
        .eq('user_id', user?.id) // Ensure filtering by user_id
        .order('current_stock_quantity', { ascending: false })
        .limit(5);

      if (stockError) throw stockError;
      setTopStockProducts(stockData || []);

      showSuccess('Dados do dashboard carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados do dashboard:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const estimatedGrossProfit = totalSoldRevenue - totalSoldCost;

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dashboard...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Visão Geral do Negócio
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Um resumo rápido das principais métricas financeiras e de estoque do seu restaurante.
      </p>

      {/* Cards de Métricas Financeiras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comprado</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPurchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total gasto com fornecedores.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total de Vendas</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSoldRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total das vendas realizadas.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo dos Produtos Vendidos</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSoldCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Custo estimado das matérias-primas dos produtos vendidos.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Bruto Estimado</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estimatedGrossProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita total menos o custo dos produtos vendidos.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Fornecedores por Valor Comprado</CardTitle>
            <CardDescription>Os fornecedores de onde você mais comprou.</CardDescription>
          </CardHeader>
          <CardContent>
            {topSuppliers.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSuppliers} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <YAxis type="category" dataKey="supplier_name" width={100} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Legend />
                  <Bar dataKey="total_value_spent" fill="#8884d8" name="Valor Gasto" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                Nenhum dado de fornecedor para exibir.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produtos Vendidos por Receita</CardTitle>
            <CardDescription>Os produtos que geraram mais receita.</CardDescription>
          </CardHeader>
          <CardContent>
            {topSoldProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topSoldProducts} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <YAxis type="category" dataKey="product_name" width={100} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Legend />
                  <Bar dataKey="total_revenue" fill="#82ca9d" name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                Nenhum dado de produtos vendidos para exibir.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 5 Produtos Internos em Estoque por Quantidade</CardTitle>
            <CardDescription>Os produtos internos com maior quantidade em estoque.</CardDescription>
          </CardHeader>
          <CardContent>
            {topStockProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topStockProducts} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="internal_product_name" />
                  <YAxis tickFormatter={(value) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                  <Tooltip formatter={(value: number, name: string, props: any) => [`${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${props.payload.internal_unit}`, name]} />
                  <Legend />
                  <Bar dataKey="current_stock_quantity" fill="#ffc658" name="Qtd. em Estoque" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                Nenhum dado de estoque para exibir.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Inicio;
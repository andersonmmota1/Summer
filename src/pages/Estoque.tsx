import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais

interface CurrentStockSummary {
  internal_product_name: string;
  internal_unit: string;
  current_stock_quantity: number;
  total_purchased_value: number;
  total_purchased_quantity_converted: number;
  total_consumed_quantity_from_sales: number;
}

interface InternalProductUsage {
  internal_product_name: string;
  sold_product_name: string;
  quantity_needed: number;
}

const Estoque: React.FC = () => {
  const [stockData, setStockData] = useState<CurrentStockSummary[]>([]);
  const [internalProductUsage, setInternalProductUsage] = useState<InternalProductUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({}); // Novo estado para controlar linhas abertas

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de estoque...');
    try {
      const { data: stockResult, error: stockError } = await supabase
        .from('current_stock_summary')
        .select('*')
        .order('internal_product_name', { ascending: true });

      if (stockError) throw stockError;
      setStockData(stockResult || []);

      const { data: usageResult, error: usageError } = await supabase
        .from('internal_product_usage')
        .select('*')
        .order('internal_product_name', { ascending: true });

      if (usageError) throw usageError;
      setInternalProductUsage(usageResult || []);

      showSuccess('Dados de estoque carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de estoque:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const groupedUsage = useMemo(() => {
    return internalProductUsage.reduce((acc, usage) => {
      if (!acc[usage.internal_product_name]) {
        acc[usage.internal_product_name] = [];
      }
      acc[usage.internal_product_name].push(usage);
      return acc;
    }, {} as Record<string, InternalProductUsage[]>);
  }, [internalProductUsage]);

  // Função para alternar o estado de abertura de uma linha
  const handleToggleRow = (productName: string) => {
    setOpenRows(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  // Calcular o valor total do estoque
  const totalStockValue = useMemo(() => {
    return stockData.reduce((sum, item) => sum + item.total_purchased_value, 0);
  }, [stockData]);

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando gestão de estoque...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Gestão de Estoque
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Aqui você pode visualizar o estoque atual dos seus produtos internos,
        calculado a partir das compras (com unidades convertidas) e do consumo via vendas (com base nas fichas técnicas).
        Expanda cada linha para ver em quais produtos vendidos a matéria-prima é utilizada.
      </p>

      {stockData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de estoque encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades
            nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Novo Card para o Somatório do Valor Total de Estoque */}
          <Card>
            <CardHeader>
              <CardTitle>Valor Total do Estoque</CardTitle>
              <CardDescription>
                Somatório do valor de compra de todos os produtos atualmente em estoque.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                R$ {totalStockValue.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estoque Atual de Produtos Internos</CardTitle>
              <CardDescription>
                Visão geral do estoque de cada produto interno, considerando compras e consumo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome Interno do Produto</TableHead>
                      <TableHead>Unidade Interna</TableHead>
                      <TableHead className="text-right">Estoque Atual</TableHead>
                      <TableHead className="text-right">Qtd. Comprada (Convertida)</TableHead>
                      <TableHead className="text-right">Qtd. Consumida (Vendas)</TableHead>
                      <TableHead className="text-right">Valor Total Comprado</TableHead>
                      <TableHead className="text-right">Detalhes de Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockData.map((item, index) => (
                      <React.Fragment key={index}>
                        <TableRow>
                          <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                          <TableCell>{item.internal_unit}</TableCell>
                          <TableCell className="text-right">{item.current_stock_quantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.total_purchased_quantity_converted.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{item.total_consumed_quantity_from_sales.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {item.total_purchased_value.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-9 p-0"
                              onClick={() => handleToggleRow(item.internal_product_name)}
                            >
                              <ChevronDown className={cn("h-4 w-4 transition-transform", openRows[item.internal_product_name] && "rotate-180")} />
                              <span className="sr-only">Toggle detalhes de uso</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                        {openRows[item.internal_product_name] && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-0 pl-12 pr-4">
                              <div className="py-2 text-sm text-gray-600 dark:text-gray-400">
                                <p className="font-semibold mb-1">Utilizado em:</p>
                                {(groupedUsage[item.internal_product_name] || []).length > 0 ? (
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {(groupedUsage[item.internal_product_name] || []).map((usage, i) => (
                                      <li key={i}>
                                        {usage.sold_product_name} (Qtd. Necessária: {usage.quantity_needed.toFixed(2)})
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p>Nenhum produto vendido utiliza esta matéria-prima diretamente.</p>
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
        </div>
      )}
    </div>
  );
};

export default Estoque;
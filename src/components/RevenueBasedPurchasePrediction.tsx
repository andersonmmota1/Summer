import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, parseBrazilianFloat } from '@/lib/utils';
import { createExcelFile } from '@/utils/excel';

// Interfaces para os dados necessários (replicadas para auto-suficiência do componente)
interface SoldItemRaw {
  sale_date: string;
  product_name: string;
  quantity_sold: number;
  total_value_sold: number | null;
}

interface ProductRecipe {
  sold_product_name: string;
  internal_product_name: string;
  quantity_needed: number;
}

interface CurrentStockSummary {
  internal_product_name: string;
  internal_unit: string;
  current_stock_quantity: number;
}

// Interface para o resultado final da previsão de compras
interface PurchasePredictionItem {
  internal_product_name: string;
  internal_unit: string;
  projected_demand_quantity: number;
  current_stock_quantity: number;
  purchase_quantity_needed: number;
}

interface SortConfig {
  key: keyof PurchasePredictionItem | null;
  direction: 'asc' | 'desc' | null;
}

interface RevenueBasedPurchasePredictionProps {
  rawSoldItems: SoldItemRaw[] | undefined;
  productRecipes: ProductRecipe[] | undefined;
  currentStock: CurrentStockSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  historicalDaysCount: number; // Número de dias selecionados na visão principal
}

const RevenueBasedPurchasePrediction: React.FC<RevenueBasedPurchasePredictionProps> = ({
  rawSoldItems,
  productRecipes,
  currentStock,
  isLoading,
  isError,
  error,
  historicalDaysCount,
}) => {
  const [projectedRevenueInput, setProjectedRevenueInput] = useState<string>('');
  const [totalHistoricalRevenue, setTotalHistoricalRevenue] = useState<number>(0); // NOVO: Total de faturamento histórico
  const [calculatedRevenueMultiplier, setCalculatedRevenueMultiplier] = useState<number>(1);
  const [purchasePrediction, setPurchasePrediction] = useState<PurchasePredictionItem[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'internal_product_name', direction: 'asc' });
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  // Recalcular o total de faturamento histórico sempre que rawSoldItems ou historicalDaysCount mudar
  useEffect(() => {
    if (rawSoldItems && rawSoldItems.length > 0) {
      const totalRev = rawSoldItems.reduce((sum, item) => sum + (item.total_value_sold ?? 0), 0);
      setTotalHistoricalRevenue(totalRev);
    } else {
      setTotalHistoricalRevenue(0);
    }
    // Resetar a previsão quando os dados históricos mudam
    setPurchasePrediction([]);
    setProjectedRevenueInput('');
    setCalculatedRevenueMultiplier(1);
  }, [rawSoldItems, historicalDaysCount]);

  const handleGeneratePrediction = async () => {
    if (historicalDaysCount <= 0) {
      showError('Por favor, selecione pelo menos um dia histórico na seção acima para a análise.');
      return;
    }
    if (!rawSoldItems || rawSoldItems.length === 0) {
      showWarning('Nenhum dado de venda encontrado para os dias históricos selecionados. Não é possível gerar a previsão.');
      return;
    }
    if (!productRecipes || productRecipes.length === 0) {
      showWarning('Nenhuma ficha técnica de produto encontrada. Não é possível desmembrar produtos vendidos em matérias-primas.');
      return;
    }

    setLoadingPrediction(true);
    const loadingToastId = showLoading('Gerando previsão de compras baseada em faturamento...');

    try {
      // --- Lógica de Quantidade Total Vendida por Produto no Período Histórico ---
      const totalHistoricalQuantitySoldPerProduct: Record<string, number> = {};
      rawSoldItems.forEach(item => {
        totalHistoricalQuantitySoldPerProduct[item.product_name] = (totalHistoricalQuantitySoldPerProduct[item.product_name] || 0) + item.quantity_sold;
      });

      // --- Cálculo do Multiplicador de Faturamento ---
      let revenueMultiplier = 1;
      const parsedProjectedRevenue = parseBrazilianFloat(projectedRevenueInput);

      if (parsedProjectedRevenue > 0 && totalHistoricalRevenue > 0) {
        revenueMultiplier = parsedProjectedRevenue / totalHistoricalRevenue;
      } else if (parsedProjectedRevenue === 0 && projectedRevenueInput !== '') {
        revenueMultiplier = 0;
      }
      setCalculatedRevenueMultiplier(revenueMultiplier);

      // --- Demanda Projetada de Produtos Vendidos (COM MULTIPLICADOR) ---
      const projectedSoldProductDemand: Record<string, number> = {};
      Object.keys(totalHistoricalQuantitySoldPerProduct).forEach(productName => {
        // A demanda projetada é a quantidade histórica total multiplicada pelo fator de faturamento
        projectedSoldProductDemand[productName] = totalHistoricalQuantitySoldPerProduct[productName] * revenueMultiplier;
      });

      // --- Demanda Projetada de Produtos Internos ---
      const projectedInternalProductDemand: Record<string, number> = {};

      Object.keys(projectedSoldProductDemand).forEach(soldProductName => {
        const projectedQuantity = projectedSoldProductDemand[soldProductName];
        const relevantRecipes = productRecipes.filter(recipe => recipe.sold_product_name === soldProductName);

        if (relevantRecipes.length === 0) {
          console.warn(`Produto vendido "${soldProductName}" não possui ficha técnica. Ignorando na previsão de matéria-prima.`);
          return;
        }

        relevantRecipes.forEach(recipe => {
          const internalProductName = recipe.internal_product_name;
          const quantityNeeded = recipe.quantity_needed;
          projectedInternalProductDemand[internalProductName] = (projectedInternalProductDemand[internalProductName] || 0) + (projectedQuantity * quantityNeeded);
        });
      });

      const finalPrediction: PurchasePredictionItem[] = [];
      const stockMap = new Map(currentStock?.map(s => [s.internal_product_name, s]) || []);

      Object.keys(projectedInternalProductDemand).forEach(internalProductName => {
        const projectedDemand = projectedInternalProductDemand[internalProductName];
        const stockInfo = stockMap.get(internalProductName);

        const currentStockQuantity = stockInfo?.current_stock_quantity || 0;
        const internalUnit = stockInfo?.internal_unit || 'unidade';

        const purchaseQuantityNeeded = Math.max(0, projectedDemand - currentStockQuantity);

        finalPrediction.push({
          internal_product_name: internalProductName,
          internal_unit: internalUnit,
          projected_demand_quantity: projectedDemand,
          current_stock_quantity: currentStockQuantity,
          purchase_quantity_needed: purchaseQuantityNeeded,
        });
      });

      finalPrediction.sort((a, b) => b.purchase_quantity_needed - a.purchase_quantity_needed);

      setPurchasePrediction(finalPrediction);
      showSuccess('Previsão de compras baseada em faturamento gerada com sucesso!');

    } catch (err: any) {
      console.error('Erro ao gerar previsão de compras baseada em faturamento:', err);
      showError(`Erro ao gerar previsão: ${err.message}`);
    } finally {
      dismissToast(loadingToastId);
      setLoadingPrediction(false);
    }
  };

  const handleSort = (key: keyof PurchasePredictionItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedPurchasePrediction = useMemo(() => {
    if (!purchasePrediction) return [];
    let sortableItems = [...purchasePrediction];

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [purchasePrediction, sortConfig]);

  const handleExportToExcel = () => {
    if (!purchasePrediction || purchasePrediction.length === 0) {
      showWarning('Não há dados de previsão de compras para exportar.');
      return;
    }

    const headers = [
      'Nome Interno do Produto',
      'Unidade Interna',
      'Demanda Projetada',
      'Estoque Atual',
      'Quantidade Necessária para Compra',
    ];

    const formattedData = purchasePrediction.map(item => ({
      'Nome Interno do Produto': item.internal_product_name,
      'Unidade Interna': item.internal_unit,
      'Demanda Projetada': item.projected_demand_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Estoque Atual': item.current_stock_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Quantidade Necessária para Compra': item.purchase_quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    }));

    const blob = createExcelFile(formattedData, headers, 'PrevisaoDeComprasFaturamento');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'previsao_de_compras_faturamento.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Previsão de compras baseada em faturamento exportada para Excel com sucesso!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Previsão de Compras por Faturamento Projetado</CardTitle>
        <CardDescription>
          Projete a demanda de matérias-primas com base em um faturamento total desejado para o período de projeção.
          Os "Dias Históricos de Vendas" devem ser selecionados na seção acima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="total-historical-revenue-calc" className="mb-2 block">Faturamento Total Histórico</Label>
            <Input
              id="total-historical-revenue-calc"
              type="text"
              value={totalHistoricalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              readOnly
              className="w-full bg-gray-50 dark:bg-gray-700"
            />
          </div>
          <div>
            <Label htmlFor="projected-revenue-input" className="mb-2 block">Faturamento Projetado (Total para o período)</Label>
            <Input
              id="projected-revenue-input"
              type="text"
              value={projectedRevenueInput}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[0-9.,]*$/.test(value)) {
                  setProjectedRevenueInput(value);
                }
              }}
              onBlur={(e) => {
                const parsed = parseBrazilianFloat(e.target.value);
                setProjectedRevenueInput(parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ','));
              }}
              placeholder="0,00"
              className="w-full"
            />
          </div>
          <div className="md:col-span-2"> {/* Ocupa duas colunas para centralizar */}
            <Label htmlFor="revenue-multiplier-calc" className="mb-2 block">Multiplicador de Faturamento</Label>
            <Input
              id="revenue-multiplier-calc"
              type="text"
              value={calculatedRevenueMultiplier.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              readOnly
              className="w-full bg-gray-50 dark:bg-gray-700"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Calculado como: Faturamento Projetado / Faturamento Total Histórico.
              Este multiplicador é aplicado às quantidades totais vendidas historicamente de cada produto.
            </p>
          </div>
        </div>
        <Button onClick={handleGeneratePrediction} disabled={isLoading || loadingPrediction}>
          {loadingPrediction ? 'Gerando...' : 'Gerar Previsão de Compras por Faturamento'}
        </Button>

        {isLoading && (
          <div className="text-center text-gray-600 dark:text-gray-400 py-8">
            Carregando dados para a previsão...
          </div>
        )}

        {isError && (
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
            <p>Ocorreu um erro ao carregar os dados para a previsão: {error?.message}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
          </div>
        )}

        {!isLoading && !isError && purchasePrediction.length === 0 && (
          <div className="text-center text-gray-600 dark:text-gray-400 py-8">
            <p className="text-lg">Nenhuma previsão de compras por faturamento gerada ainda.</p>
            <p className="text-sm mt-2">Preencha os campos e clique em "Gerar Previsão de Compras por Faturamento".</p>
          </div>
        )}

        {purchasePrediction.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Lista de Compras Sugerida (Baseada em Faturamento)</CardTitle>
                  <CardDescription>
                    Matérias-primas que precisam ser compradas para atender ao faturamento projetado.
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
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('internal_product_name')}
                          className="px-0 py-0 h-auto"
                        >
                          Nome Interno do Produto
                          {sortConfig.key === 'internal_product_name' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfig.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('internal_unit')}
                          className="px-0 py-0 h-auto"
                        >
                          Unidade Interna
                          {sortConfig.key === 'internal_unit' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfig.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('projected_demand_quantity')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Demanda Projetada
                          {sortConfig.key === 'projected_demand_quantity' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfig.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('current_stock_quantity')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Estoque Atual
                          {sortConfig.key === 'current_stock_quantity' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfig.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSort('purchase_quantity_needed')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Qtd. Necessária para Compra
                          {sortConfig.key === 'purchase_quantity_needed' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfig.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPurchasePrediction.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                        <TableCell>{item.internal_unit}</TableCell>
                        <TableCell className="text-right">{item.projected_demand_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{item.current_stock_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{item.purchase_quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default RevenueBasedPurchasePrediction;
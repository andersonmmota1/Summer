import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Download, ArrowUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker'; // Manter DateRange para tipagem, mas usaremos Date[]
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, parseISO, differenceInDays, addMonths } from 'date-fns'; // Importar addMonths
import { ptBR } from 'date-fns/locale';
import { createExcelFile } from '@/utils/excel';

// Interfaces para os dados necessários
interface SoldItemRaw {
  sale_date: string;
  product_name: string;
  quantity_sold: number;
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

const PrevisaoDeCompras: React.FC = () => {
  const { user } = useSession();
  // ATUALIZADO: Agora armazena um array de Dates para seleção múltipla
  const [historicalSelectedDates, setHistoricalSelectedDates] = useState<Date[] | undefined>(undefined);
  const [projectionDays, setProjectionDays] = useState<number>(7); // Padrão: projetar para os próximos 7 dias
  const [purchasePrediction, setPurchasePrediction] = useState<PurchasePredictionItem[]>([]);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'internal_product_name', direction: 'asc' });

  // Formata as datas selecionadas para o formato 'yyyy-MM-dd' para a query do Supabase
  const formattedHistoricalDates = useMemo(() => {
    if (!historicalSelectedDates || historicalSelectedDates.length === 0) return [];
    return historicalSelectedDates.map(date => format(date, 'yyyy-MM-dd'));
  }, [historicalSelectedDates]);

  // 1. Fetch Historical Sold Items
  const { data: rawSoldItems, isLoading: isLoadingSoldItems, isError: isErrorSoldItems, error: errorSoldItems } = useQuery<SoldItemRaw[], Error>({
    queryKey: ['historical_sold_items', user?.id, formattedHistoricalDates], // Chave da query depende das datas formatadas
    queryFn: async () => {
      if (!user?.id || formattedHistoricalDates.length === 0) return [];

      const { data, error } = await supabase
        .from('sold_items')
        .select('sale_date, product_name, quantity_sold')
        .eq('user_id', user.id)
        .in('sale_date', formattedHistoricalDates); // ATUALIZADO: Usar 'in' para múltiplas datas

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && formattedHistoricalDates.length > 0, // Habilitar apenas se houver datas selecionadas
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch Product Recipes
  const { data: productRecipes, isLoading: isLoadingRecipes, isError: isErrorRecipes, error: errorRecipes } = useQuery<ProductRecipe[], Error>({
    queryKey: ['product_recipes_prediction', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('product_recipes')
        .select('sold_product_name, internal_product_name, quantity_needed')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch Current Stock Summary
  const { data: currentStock, isLoading: isLoadingStock, isError: isErrorStock, error: errorStock } = useQuery<CurrentStockSummary[], Error>({
    queryKey: ['current_stock_summary_prediction', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('current_stock_summary')
        .select('internal_product_name, internal_unit, current_stock_quantity')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 1, // Estoque pode mudar mais frequentemente, 1 minuto
  });

  const isLoading = isLoadingSoldItems || isLoadingRecipes || isLoadingStock || loadingPrediction;
  const isError = isErrorSoldItems || isErrorRecipes || isErrorStock;
  const error = errorSoldItems || errorRecipes || errorStock;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar dados para previsão de compras:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const handleGeneratePrediction = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível gerar previsão de compras.');
      return;
    }
    // ATUALIZADO: Verificar se há datas selecionadas
    if (!historicalSelectedDates || historicalSelectedDates.length === 0) {
      showError('Por favor, selecione pelo menos um dia histórico para a análise.');
      return;
    }
    if (projectionDays <= 0) {
      showError('O número de dias para projeção deve ser maior que zero.');
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
    const loadingToastId = showLoading('Gerando previsão de compras...');

    try {
      // 1. Calcular vendas diárias médias por produto vendido no período histórico
      // ATUALIZADO: historicalDays é o número de dias selecionados
      const historicalDays = historicalSelectedDates.length;
      if (historicalDays <= 0) {
        throw new Error('O número de dias históricos selecionados deve ser maior que zero.');
      }

      const dailySales: Record<string, number> = {}; // { "Produto X": total_quantity_sold }
      rawSoldItems.forEach(item => {
        dailySales[item.product_name] = (dailySales[item.product_name] || 0) + item.quantity_sold;
      });

      const averageDailySales: Record<string, number> = {}; // { "Produto X": avg_daily_quantity_sold }
      Object.keys(dailySales).forEach(productName => {
        averageDailySales[productName] = dailySales[productName] / historicalDays;
      });

      // 2. Projetar demanda futura de produtos vendidos
      const projectedSoldProductDemand: Record<string, number> = {}; // { "Produto X": projected_quantity }
      Object.keys(averageDailySales).forEach(productName => {
        projectedSoldProductDemand[productName] = averageDailySales[productName] * projectionDays;
      });

      // 3. Desmembrar em matérias-primas (produtos internos)
      const projectedInternalProductDemand: Record<string, number> = {}; // { "Materia Prima Y": total_projected_quantity_needed }

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

      // 4. Comparar com estoque atual e calcular necessidade de compra
      const finalPrediction: PurchasePredictionItem[] = [];
      const stockMap = new Map(currentStock?.map(s => [s.internal_product_name, s]) || []);

      Object.keys(projectedInternalProductDemand).forEach(internalProductName => {
        const projectedDemand = projectedInternalProductDemand[internalProductName];
        const stockInfo = stockMap.get(internalProductName);

        const currentStockQuantity = stockInfo?.current_stock_quantity || 0;
        const internalUnit = stockInfo?.internal_unit || 'unidade'; // Fallback unit

        const purchaseQuantityNeeded = Math.max(0, projectedDemand - currentStockQuantity); // Não pode ser negativo

        finalPrediction.push({
          internal_product_name: internalProductName,
          internal_unit: internalUnit,
          projected_demand_quantity: projectedDemand,
          current_stock_quantity: currentStockQuantity,
          purchase_quantity_needed: purchaseQuantityNeeded,
        });
      });

      // Ordenar a previsão final (ex: por quantidade de compra necessária, decrescente)
      finalPrediction.sort((a, b) => b.purchase_quantity_needed - a.purchase_quantity_needed);

      setPurchasePrediction(finalPrediction);
      showSuccess('Previsão de compras gerada com sucesso!');

    } catch (err: any) {
      console.error('Erro ao gerar previsão de compras:', err);
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

    const blob = createExcelFile(formattedData, headers, 'PrevisaoDeCompras');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'previsao_de_compras.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Previsão de compras exportada para Excel com sucesso!');
  };

  // Definir o mês padrão para o calendário: mês anterior ao atual
  const defaultCalendarMonth = useMemo(() => addMonths(new Date(), -1), []);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Previsão de Compras
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Gere uma previsão de compras de matérias-primas com base nas vendas históricas e no estoque atual,
        para garantir que você sempre tenha os produtos necessários para atender à demanda.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurações da Previsão</CardTitle>
          <CardDescription>
            Defina os dias históricos para análise e quantos dias futuros você deseja projetar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="historical-date-selection" className="mb-2 block">Dias Históricos de Vendas</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="historical-date-selection"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !historicalSelectedDates || historicalSelectedDates.length === 0 && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {historicalSelectedDates && historicalSelectedDates.length > 0 ? (
                      `${historicalSelectedDates.length} dia(s) selecionado(s)`
                    ) : (
                      <span>Selecione os dias para análise</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="multiple" // ATUALIZADO: Modo de seleção múltipla
                    month={defaultCalendarMonth} {/* ATUALIZADO: Define o mês inicial para o mês anterior */}
                    selected={historicalSelectedDates}
                    onSelect={setHistoricalSelectedDates}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-full md:w-auto">
              <Label htmlFor="projection-days" className="mb-2 block">Dias para Projetar</Label>
              <Input
                id="projection-days"
                type="number"
                value={projectionDays}
                onChange={(e) => setProjectionDays(Math.max(1, Number(e.target.value)))}
                min="1"
                className="w-full md:w-32"
              />
            </div>
          </div>
          <Button onClick={handleGeneratePrediction} disabled={isLoading}>
            {isLoading ? 'Gerando...' : 'Gerar Previsão de Compras'}
          </Button>
        </CardContent>
      </Card>

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
          <p className="text-lg">Nenhuma previsão de compras gerada ainda.</p>
          <p className="text-sm mt-2">Selecione os dias históricos e o número de dias para projetar, e clique em "Gerar Previsão de Compras".</p>
        </div>
      )}

      {purchasePrediction.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lista de Compras Sugerida</CardTitle>
                <CardDescription>
                  Matérias-primas que precisam ser compradas para atender à demanda projetada.
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
    </div>
  );
};

export default PrevisaoDeCompras;
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ArrowUpDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { createExcelFile } from '@/utils/excel';

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

// Nova interface para os novos dados de entrada de estoque
interface PurchasedItem {
  id: string;
  user_id: string;
  c_prod: string;
  descricao_do_produto: string;
  u_com: string;
  q_com: number;
  v_un_com: number;
  created_at: string;
  internal_product_name: string | null;
  invoice_id: string | null;
  item_sequence_number: number | null;
  x_fant: string | null;
  invoice_number: string | null;
  invoice_emission_date: string | null;
}

interface ProductNameConversion {
  id: string;
  user_id: string;
  supplier_product_code: string;
  supplier_product_name: string | null;
  supplier_name: string;
  internal_product_name: string;
  created_at: string;
  updated_at: string;
}

// Nova interface para as conversões de unidades
interface UnitConversion {
  id: string;
  user_id: string;
  supplier_product_code: string;
  supplier_name: string;
  supplier_unit: string;
  internal_unit: string;
  conversion_factor: number;
  created_at: string;
  updated_at: string;
  supplier_product_description: string | null;
}

// Interface para o item comprado AGREGADO e enriquecido
interface AggregatedAndEnrichedPurchasedItem {
  // Chave de agregação
  user_id: string;
  c_prod: string;
  x_fant: string | null;
  descricao_do_produto: string;
  u_com: string;
  invoice_id: string | null;
  item_sequence_number: number | null;
  // Campos agregados
  ids: string[]; // IDs das linhas originais
  total_q_com: number; // Soma das quantidades
  average_v_un_com: number; // Média dos valores unitários
  earliest_invoice_emission_date: string | null; // Data mais antiga
  latest_created_at: string; // Data de criação mais recente
  // Campos enriquecidos
  display_internal_product_name: string;
  converted_quantity: number;
  internal_unit_display: string;
}

interface SortConfigPurchasedItems {
  key: keyof AggregatedAndEnrichedPurchasedItem | null;
  direction: 'asc' | 'desc' | null;
}

interface SortConfigStock {
  key: keyof CurrentStockSummary | 'stock_value' | null; // Adicionado 'stock_value'
  direction: 'asc' | 'desc' | null;
}

const Estoque: React.FC = () => {
  const { user } = useSession();
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfigPurchasedItems, setSortConfigPurchasedItems] = useState<SortConfigPurchasedItems>({ key: 'earliest_invoice_emission_date', direction: 'desc' });
  const [sortConfigStock, setSortConfigStock] = useState<SortConfigStock>({ key: 'internal_product_name', direction: 'asc' });

  // Query para buscar o resumo do estoque atual
  const { data: stockData, isLoading: isLoadingStock, isError: isErrorStock, error: errorStock } = useQuery<CurrentStockSummary[], Error>({
    queryKey: ['current_stock_summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('current_stock_summary')
        .select('*')
        .eq('user_id', user.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar resumo de estoque: ${err.message}`);
    },
  });

  // Query para buscar o uso de produtos internos em receitas
  const { data: internalProductUsage, isLoading: isLoadingUsage, isError: isErrorUsage, error: errorUsage } = useQuery<InternalProductUsage[], Error>({
    queryKey: ['internal_product_usage', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('internal_product_usage')
        .select('*')
        .eq('user_id', user.id)
        .order('internal_product_name', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar uso de produtos internos: ${err.message}`);
    },
  });

  // Query para buscar as quantidades totais vendidas de cada produto final
  const { data: soldProductTotals, isLoading: isLoadingSoldProductTotals, isError: isErrorSoldProductTotals, error: errorSoldProductTotals } = useQuery<{ product_name: string; total_quantity_sold: number }[], Error>({
    queryKey: ['sold_product_total_quantities', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // A tabela 'sold_items' agora contém as quantidades totais vendidas por produto por dia.
      // Precisamos agregar por 'product_name' para obter o total geral.
      const { data, error } = await supabase
        .from('sold_items')
        .select('product_name, total_quantity_sold'); // Corrected column name
      if (error) throw error;
      // Agrega as quantidades vendidas por product_name
      const aggregated = data.reduce((acc, item) => {
        acc[item.product_name] = (acc[item.product_name] || 0) + item.total_quantity_sold; // Corrected column name
        return acc;
      }, {} as Record<string, number>);
      return Object.keys(aggregated).map(product_name => ({
        product_name,
        total_quantity_sold: aggregated[product_name],
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar totais de produtos vendidos: ${err.message}`);
    },
  });

  // Query para buscar todos os itens comprados detalhados
  const { data: purchasedItems, isLoading: isLoadingPurchasedItems, isError: isErrorPurchasedItems, error: errorPurchasedItems } = useQuery<PurchasedItem[], Error>({
    queryKey: ['all_purchased_items_stock', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('purchased_items')
        .select('id, user_id, c_prod, descricao_do_produto, u_com, q_com, v_un_com, created_at, internal_product_name, invoice_id, item_sequence_number, x_fant, invoice_number, invoice_emission_date')
        .eq('user_id', user.id)
        .order('invoice_emission_date', { ascending: false })
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar itens comprados: ${err.message}`);
    },
  });

  // Query para buscar a contagem de itens comprados individualmente
  const { data: purchasedItemsCount, isLoading: isLoadingPurchasedItemsCount, isError: isErrorPurchasedItemsCount, error: errorPurchasedItemsCount } = useQuery<number, Error>({
    queryKey: ['purchased_items_count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('purchased_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar contagem de itens comprados: ${err.message}`);
    },
  });

  // Query para buscar todas as conversões de nomes de produtos
  const { data: productNameConversions, isLoading: isLoadingConversions, isError: isErrorConversions, error: errorConversions } = useQuery<ProductNameConversion[], Error>({
    queryKey: ['product_name_conversions_stock', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('product_name_conversions')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar conversões de nomes de produtos: ${err.message}`);
    },
  });

  // NOVO: Query para buscar todas as conversões de unidades
  const { data: unitConversions, isLoading: isLoadingUnitConversions, isError: isErrorUnitConversions, error: errorUnitConversions } = useQuery<UnitConversion[], Error>({
    queryKey: ['unit_conversions_stock', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('unit_conversions')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar conversões de unidades: ${err.message}`);
    },
  });

  const isLoading = isLoadingStock || isLoadingUsage || isLoadingPurchasedItems || isLoadingConversions || isLoadingPurchasedItemsCount || isLoadingSoldProductTotals || isLoadingUnitConversions;
  const isError = isErrorStock || isErrorUsage || isErrorPurchasedItems || isErrorConversions || errorPurchasedItemsCount || isErrorSoldProductTotals || isErrorUnitConversions;
  const error = errorStock || errorUsage || errorPurchasedItems || errorConversions || errorPurchasedItemsCount || errorSoldProductTotals || errorUnitConversions;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar dados de estoque:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  // Memo para agrupar o uso de produtos internos e incluir as quantidades totais vendidas
  const groupedUsageWithSoldQuantities = useMemo(() => {
    if (!internalProductUsage || !soldProductTotals) return {};

    const soldTotalsMap = soldProductTotals.reduce((acc, item) => {
      acc[item.product_name] = item.total_quantity_sold;
      return acc;
    }, {} as Record<string, number>);

    return internalProductUsage.reduce((acc, usage) => {
      if (!acc[usage.internal_product_name]) {
        acc[usage.internal_product_name] = [];
      }
      const totalSold = soldTotalsMap[usage.sold_product_name] || 0;
      acc[usage.internal_product_name].push({
        ...usage,
        total_sold_product_quantity: totalSold
      });
      return acc;
    }, {} as Record<string, (InternalProductUsage & { total_sold_product_quantity: number })[]>);
  }, [internalProductUsage, soldProductTotals]);


  const handleToggleRow = (productName: string) => {
    setOpenRows(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  // Lógica atualizada para o cálculo do Valor Total do Estoque
  const totalStockValue = useMemo(() => {
    return stockData?.reduce((sum, item) => {
      let itemStockValue = 0;
      // Verifica se a quantidade comprada convertida é maior que zero para evitar divisão por zero
      // E se o estoque atual não é negativo
      if (item.current_stock_quantity >= 0 && item.total_purchased_quantity_converted > 0) {
        const averageUnitCost = item.total_purchased_value / item.total_purchased_quantity_converted;
        itemStockValue = averageUnitCost * item.current_stock_quantity;
      }
      return sum + itemStockValue;
    }, 0) || 0;
  }, [stockData]);

  // Lógica CORRIGIDA para agregar e enriquecer itens comprados
  const aggregatedAndEnrichedPurchasedItems = useMemo(() => {
    if (!purchasedItems || !productNameConversions || !unitConversions) return [];

    // 1. Agregar itens comprados
    const aggregationMap = new Map<string, AggregatedAndEnrichedPurchasedItem>();

    purchasedItems.forEach(item => {
      // Criar uma chave única para agregação
      // Inclui invoice_id e item_sequence_number para diferenciar itens da mesma nota
      const key = `${item.user_id}|${item.c_prod}|${item.x_fant}|${item.descricao_do_produto}|${item.u_com}|${item.invoice_id}|${item.item_sequence_number}`;

      if (!aggregationMap.has(key)) {
        // Inicializa o item agregado
        aggregationMap.set(key, {
          // Chave de agregação
          user_id: item.user_id,
          c_prod: item.c_prod,
          x_fant: item.x_fant,
          descricao_do_produto: item.descricao_do_produto,
          u_com: item.u_com,
          invoice_id: item.invoice_id,
          item_sequence_number: item.item_sequence_number,
          // Campos agregados
          ids: [item.id],
          total_q_com: item.q_com,
          // Inicializa com o primeiro valor
          average_v_un_com: item.v_un_com,
          count_v_un_com: 1,
          earliest_invoice_emission_date: item.invoice_emission_date,
          latest_created_at: item.created_at,
          // Campos enriquecidos (serão preenchidos depois)
          display_internal_product_name: item.descricao_do_produto || 'Não Mapeado',
          converted_quantity: item.q_com,
          internal_unit_display: item.u_com,
        });
      } else {
        // Atualiza o item agregado existente
        const aggregatedItem = aggregationMap.get(key)!;
        aggregatedItem.ids.push(item.id);
        aggregatedItem.total_q_com += item.q_com;
        // Atualiza média incremental
        aggregatedItem.count_v_un_com += 1;
        aggregatedItem.average_v_un_com += (item.v_un_com - aggregatedItem.average_v_un_com) / aggregatedItem.count_v_un_com;
        // Atualiza datas
        if (item.invoice_emission_date && (!aggregatedItem.earliest_invoice_emission_date || item.invoice_emission_date < aggregatedItem.earliest_invoice_emission_date)) {
          aggregatedItem.earliest_invoice_emission_date = item.invoice_emission_date;
        }
        if (item.created_at > aggregatedItem.latest_created_at) {
          aggregatedItem.latest_created_at = item.created_at;
        }
      }
    });

    // Converter Map para Array
    const aggregatedItemsArray = Array.from(aggregationMap.values());

    // 2. Enriquecer itens agregados com nomes e unidades internas
    const enrichedItems = aggregatedItemsArray.map(item => {
      // Determinar o nome interno de exibição
      let displayInternalName = item.descricao_do_produto || 'Não Mapeado';
      // Procurar mapeamento por internal_product_name direto no item (prioridade máxima)
      const directMatch = purchasedItems.find(pi => 
        item.ids.includes(pi.id) && pi.internal_product_name
      );
      if (directMatch?.internal_product_name) {
        displayInternalName = directMatch.internal_product_name;
      } else {
        // Procurar mapeamento na tabela de conversões
        const mappedNameConversion = productNameConversions.find(conversion =>
          conversion.supplier_product_code === item.c_prod &&
          conversion.supplier_name === item.x_fant
        );
        if (mappedNameConversion) {
          displayInternalName = mappedNameConversion.internal_product_name;
        }
      }

      // Determinar a quantidade convertida e a unidade interna de exibição
      let convertedQuantity = item.total_q_com; // Usar a quantidade total agregada
      let internalUnitDisplay = item.u_com;
      const mappedUnitConversion = unitConversions.find(conversion =>
        conversion.supplier_product_code === item.c_prod &&
        conversion.supplier_name === item.x_fant &&
        conversion.supplier_unit === item.u_com
      );
      if (mappedUnitConversion) {
        convertedQuantity = item.total_q_com * mappedUnitConversion.conversion_factor;
        internalUnitDisplay = mappedUnitConversion.internal_unit;
      }

      return {
        ...item,
        display_internal_product_name: displayInternalName,
        converted_quantity: convertedQuantity,
        internal_unit_display: internalUnitDisplay,
      };
    });

    return enrichedItems;
  }, [purchasedItems, productNameConversions, unitConversions]);

  // Função para lidar com a ordenação da tabela de entradas detalhadas
  const handleSortPurchasedItems = (key: keyof AggregatedAndEnrichedPurchasedItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfigPurchasedItems.key === key && sortConfigPurchasedItems.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfigPurchasedItems({ key, direction });
  };

  // Lógica de filtragem e ordenação para as entradas detalhadas de estoque
  const filteredAndSortedEnrichedPurchasedItems = useMemo(() => {
    let itemsToProcess = [...aggregatedAndEnrichedPurchasedItems];

    // 1. Filtragem
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      itemsToProcess = itemsToProcess.filter(item =>
        item.display_internal_product_name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (item.x_fant?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.descricao_do_produto?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.c_prod?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.invoice_number?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.internal_unit_display?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (String(item.converted_quantity).toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // 2. Ordenação
    if (sortConfigPurchasedItems.key) {
      itemsToProcess.sort((a, b) => {
        const aValue = a[sortConfigPurchasedItems.key!];
        const bValue = b[sortConfigPurchasedItems.key!];

        if (aValue === null || aValue === undefined) return sortConfigPurchasedItems.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfigPurchasedItems.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (sortConfigPurchasedItems.key === 'earliest_invoice_emission_date' || sortConfigPurchasedItems.key === 'latest_created_at') {
            const dateA = parseISO(aValue);
            const dateB = parseISO(bValue);
            if (dateA < dateB) return sortConfigPurchasedItems.direction === 'asc' ? -1 : 1;
            if (dateA > dateB) return sortConfigPurchasedItems.direction === 'asc' ? 1 : -1;
            return 0;
          }
          if (aValue < bValue) return sortConfigPurchasedItems.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfigPurchasedItems.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfigPurchasedItems.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfigPurchasedItems.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }

    return itemsToProcess;
  }, [aggregatedAndEnrichedPurchasedItems, searchTerm, sortConfigPurchasedItems]);

  // Função para lidar com a ordenação da tabela de resumo de estoque
  const handleSortStock = (key: keyof CurrentStockSummary | 'stock_value') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfigStock.key === key && sortConfigStock.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfigStock({ key, direction });
  };

  // Dados de resumo de estoque ordenados
  const sortedStockData = useMemo(() => {
    if (!stockData) return [];

    let sortableStockItems = [...stockData];

    if (sortConfigStock.key) {
      sortableStockItems.sort((a, b) => {
        const aValue = a[sortConfigStock.key!];
        const bValue = b[sortConfigStock.key!];

        if (sortConfigStock.key === 'stock_value') {
          const aAvgCost = a.total_purchased_quantity_converted > 0 ? a.total_purchased_value / a.total_purchased_quantity_converted : 0;
          const bAvgCost = b.total_purchased_quantity_converted > 0 ? b.total_purchased_value / b.total_purchased_quantity_converted : 0;
          const aStockValue = aAvgCost * a.current_stock_quantity;
          const bStockValue = bAvgCost * b.current_stock_quantity;

          if (aStockValue < bStockValue) return sortConfigStock.direction === 'asc' ? -1 : 1;
          if (aStockValue > bStockValue) return sortConfigStock.direction === 'asc' ? 1 : -1;
          return 0;
        }

        if (aValue === null || aValue === undefined) return sortConfigStock.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfigStock.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          if (aValue < bValue) return sortConfigStock.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfigStock.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return sortConfigStock.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfigStock.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }

    return sortableStockItems;
  }, [stockData, sortConfigStock]);


  const handleExportStockSummaryToExcel = () => {
    if (!sortedStockData || sortedStockData.length === 0) {
      showWarning('Não há dados de estoque para exportar.');
      return;
    }

    const headers = [
      'Nome Interno do Produto',
      'Unidade Interna',
      'Estoque Atual',
      'Qtd. Comprada (Convertida)',
      'Qtd. Consumida (Vendas)',
      'Valor Total Comprado',
      'Valor em Estoque',
    ];

    const formattedData = sortedStockData.map(item => {
      const averageUnitCost = item.total_purchased_quantity_converted > 0 ? item.total_purchased_value / item.total_purchased_quantity_converted : 0;
      const itemStockValue = averageUnitCost * item.current_stock_quantity;
      return {
        'Nome Interno do Produto': item.internal_product_name,
        'Unidade Interna': item.internal_unit,
        'Estoque Atual': item.current_stock_quantity,
        'Qtd. Comprada (Convertida)': item.total_purchased_quantity_converted,
        'Qtd. Consumida (Vendas)': item.total_consumed_quantity_from_sales,
        'Valor Total Comprado': item.total_purchased_value,
        'Valor em Estoque': itemStockValue,
      };
    });

    const blob = createExcelFile(formattedData, headers, 'ResumoEstoqueAtual');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resumo_estoque_atual.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Resumo do estoque atual exportado para Excel com sucesso!');
  };

  const hasData = (stockData && stockData.length > 0) || (aggregatedAndEnrichedPurchasedItems && aggregatedAndEnrichedPurchasedItems.length > 0);

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando gestão de estoque...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os dados: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
    </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Gestão de Estoque
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Aqui você pode visualizar o estoque atual dos seus produtos internos, calculado a partir das compras (com unidades convertidas) e do consumo via vendas (com base nas fichas técnicas). Expanda cada linha para ver em quais produtos vendidos a matéria-prima é utilizada.
      </p>

      {!hasData ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de estoque ou entrada de produto encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Valor Total do Estoque</CardTitle>
                <CardDescription>
                  Somatório do valor de compra de todos os produtos atualmente em estoque.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {totalStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Itens Comprados Individualmente</CardTitle>
                <CardDescription>
                  Número total de registros de produtos comprados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPurchasedItemsCount ? (
                  <div className="text-center text-gray-600 dark:text-gray-400 py-4">
                    Carregando contagem de itens...
                  </div>
                ) : isErrorPurchasedItemsCount ? (
                  <div className="text-center text-red-600 dark:text-red-400 py-4">
                    Erro ao carregar contagem: {errorPurchasedItemsCount?.message}
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {purchasedItemsCount?.toLocaleString('pt-BR') || 0} itens
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Estoque Atual de Produtos Internos</CardTitle>
                  <CardDescription>
                    Visão geral do estoque de cada produto interno, considerando compras e consumo.
                  </CardDescription>
                </div>
                <Button onClick={handleExportStockSummaryToExcel} variant="outline" className="gap-2">
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
                          onClick={() => handleSortStock('internal_product_name')}
                          className="px-0 py-0 h-auto"
                        >
                          Nome Interno do Produto
                          {sortConfigStock.key === 'internal_product_name' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>Unidade Interna</TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSortStock('current_stock_quantity')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Estoque Atual
                          {sortConfigStock.key === 'current_stock_quantity' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSortStock('total_purchased_quantity_converted')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Qtd. Comprada (Convertida)
                          {sortConfigStock.key === 'total_purchased_quantity_converted' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSortStock('total_consumed_quantity_from_sales')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Qtd. Consumida (Vendas)
                          {sortConfigStock.key === 'total_consumed_quantity_from_sales' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSortStock('total_purchased_value')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Valor Total Comprado
                          {sortConfigStock.key === 'total_purchased_value' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleSortStock('stock_value')}
                          className="px-0 py-0 h-auto justify-end w-full"
                        >
                          Valor em Estoque
                          {sortConfigStock.key === 'stock_value' && (
                            <ArrowUpDown
                              className={cn(
                                "ml-2 h-4 w-4 transition-transform",
                                sortConfigStock.direction === 'desc' && "rotate-180"
                              )}
                            />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Detalhes de Uso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStockData?.map((item, index) => {
                      const averageUnitCost = item.total_purchased_quantity_converted > 0 ? item.total_purchased_value / item.total_purchased_quantity_converted : 0;
                      const itemStockValue = averageUnitCost * item.current_stock_quantity;
                      return (
                        <React.Fragment key={index}>
                          <TableRow>
                            <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                            <TableCell>{item.internal_unit}</TableCell>
                            <TableCell className="text-right">{item.current_stock_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{item.total_purchased_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{item.total_consumed_quantity_from_sales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{item.total_purchased_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            <TableCell className="text-right">{itemStockValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-9 p-0"
                                onClick={() => handleToggleRow(item.internal_product_name)}
                              >
                                <ChevronDown
                                  className={cn("h-4 w-4 transition-transform", openRows[item.internal_product_name] && "rotate-180")}
                                />
                                <span className="sr-only">Toggle detalhes de uso</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                          {openRows[item.internal_product_name] && (
                            <TableRow>
                              <TableCell colSpan={8} className="py-0 pl-12 pr-4">
                                <div className="py-2 text-sm text-gray-600 dark:text-gray-400">
                                  <p className="font-semibold mb-1">Utilizado em:</p>
                                  {(groupedUsageWithSoldQuantities[item.internal_product_name] || []).length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {(groupedUsageWithSoldQuantities[item.internal_product_name] || []).map((usage, i) => (
                                        <li key={i}>
                                          {usage.sold_product_name} (Qtd. Necessária: {usage.quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) - Total Vendido: {usage.total_sold_product_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* CORREÇÃO: Card de Entradas Detalhadas - só aparece se houver itens comprados E enriquecidos */}
          {aggregatedAndEnrichedPurchasedItems && aggregatedAndEnrichedPurchasedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Entradas Detalhadas de Estoque</CardTitle>
                <CardDescription>
                  Lista agregada de todos os itens de produtos comprados, com seus nomes internos e data de emissão da nota fiscal. Cada linha representa um item único comprado, mesmo que tenha vindo de múltiplas notas.
                </CardDescription>
                <Input
                  placeholder="Filtrar por nome interno, fornecedor, descrição, código ou número da nota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm mt-4"
                />
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('earliest_invoice_emission_date')}
                            className="px-0 py-0 h-auto"
                          >
                            Data de Emissão da NF
                            {sortConfigPurchasedItems.key === 'earliest_invoice_emission_date' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('display_internal_product_name')}
                            className="px-0 py-0 h-auto"
                          >
                            Nome Interno do Produto
                            {sortConfigPurchasedItems.key === 'display_internal_product_name' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('x_fant')}
                            className="px-0 py-0 h-auto"
                          >
                            Fornecedor
                            {sortConfigPurchasedItems.key === 'x_fant' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('descricao_do_produto')}
                            className="px-0 py-0 h-auto"
                          >
                            Descrição do Produto (XML)
                            {sortConfigPurchasedItems.key === 'descricao_do_produto' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('internal_unit_display')}
                            className="px-0 py-0 h-auto"
                          >
                            Unidade Interna
                            {sortConfigPurchasedItems.key === 'internal_unit_display' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('converted_quantity')}
                            className="px-0 py-0 h-auto justify-end w-full"
                          >
                            Qtd. Comprada (Convertida)
                            {sortConfigPurchasedItems.key === 'converted_quantity' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">
                          <Button
                            variant="ghost"
                            onClick={() => handleSortPurchasedItems('average_v_un_com')}
                            className="px-0 py-0 h-auto justify-end w-full"
                          >
                            Valor Unitário Médio
                            {sortConfigPurchasedItems.key === 'average_v_un_com' && (
                              <ArrowUpDown
                                className={cn(
                                  "ml-2 h-4 w-4 transition-transform",
                                  sortConfigPurchasedItems.direction === 'desc' && "rotate-180"
                                )}
                              />
                            )}
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedEnrichedPurchasedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">
                            Nenhum resultado encontrado para o filtro.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedEnrichedPurchasedItems.map((item, index) => (
                          <TableRow key={`${item.user_id}-${item.c_prod}-${item.x_fant}-${item.descricao_do_produto}-${item.u_com}-${item.invoice_id}-${item.item_sequence_number}` || index}>
                            <TableCell className="font-medium">
                              {item.earliest_invoice_emission_date ? format(parseISO(item.earliest_invoice_emission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                            </TableCell>
                            <TableCell>{item.display_internal_product_name}</TableCell>
                            <TableCell>{item.x_fant || 'N/A'}</TableCell>
                            <TableCell>{item.descricao_do_produto}</TableCell>
                            <TableCell>{item.internal_unit_display}</TableCell>
                            <TableCell className="text-right">{item.converted_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{item.average_v_un_com.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Estoque;
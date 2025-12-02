import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createExcelFile } from '@/utils/excel';
import { useSession } from '@/components/SessionContextProvider';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SoldItemDetailed {
  id: string;
  user_id: string;
  sale_date: string; 
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
  base_product_name: string | null;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  total_value_sold: number | null;
  created_at: string;
}

// Nova interface para os dados agregados
interface AggregatedSoldProduct {
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
  product_name: string;
  total_quantity_sold: number;
  total_value_sold: number;
}

// Atualiza SortConfig para usar as chaves da nova interface agregada
interface SortConfig {
  key: keyof AggregatedSoldProduct | null;
  direction: 'asc' | 'desc' | null;
}

const AnaliseDeProdutosVendidos: React.FC = () => {
  const { user } = useSession();
  const [allSoldItems, setAllSoldItems] = useState<SoldItemDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'product_name', direction: 'asc' }); // Default sort by product_name

  useEffect(() => {
    if (user?.id) {
      fetchAllSoldItems();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchAllSoldItems = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados detalhados de produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('sold_items')
        .select('id, user_id, sale_date, group_name, subgroup_name, additional_code, base_product_name, product_name, quantity_sold, unit_price, total_value_sold, created_at')
        .eq('user_id', user?.id)
        .order('sale_date', { ascending: false });

      if (error) throw error;

      setAllSoldItems(data || []);
      showSuccess('Dados detalhados de produtos vendidos carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados detalhados de produtos vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      dismissToast(loadingToastId);
      setLoading(false);
    }
  };

  // NOVO: Memo para agregar os dados
  const aggregatedSoldItems = useMemo(() => {
    if (!allSoldItems) return [];

    const aggregationMap = new Map<string, AggregatedSoldProduct>();

    allSoldItems.forEach(item => {
      const key = `${item.group_name || ''}|${item.subgroup_name || ''}|${item.additional_code || ''}|${item.product_name}`;
      
      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, {
          group_name: item.group_name,
          subgroup_name: item.subgroup_name,
          additional_code: item.additional_code,
          product_name: item.product_name,
          total_quantity_sold: 0,
          total_value_sold: 0,
        });
      }
      const aggregatedItem = aggregationMap.get(key)!;
      aggregatedItem.total_quantity_sold += item.quantity_sold;
      aggregatedItem.total_value_sold += (item.total_value_sold ?? 0);
    });

    return Array.from(aggregationMap.values());
  }, [allSoldItems]);


  const handleSort = (key: keyof AggregatedSoldProduct) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let sortableItems = [...aggregatedSoldItems]; // Usa os dados agregados como base

    // 1. Filtragem pelo termo de busca
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(item =>
        item.product_name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (item.group_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.subgroup_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.additional_code?.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }

    // 2. Ordenação
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
  }, [aggregatedSoldItems, searchTerm, sortConfig]);

  // Totalizador para os itens filtrados e ordenados
  const { totalFilteredRevenue, totalFilteredQuantity } = useMemo(() => {
    const revenue = filteredAndSortedData.reduce((sum, item) => sum + (item.total_value_sold ?? 0), 0);
    const quantity = filteredAndSortedData.reduce((sum, item) => sum + item.total_quantity_sold, 0);
    return { totalFilteredRevenue: revenue, totalFilteredQuantity: quantity };
  }, [filteredAndSortedData]);

  const handleExportSoldItemsToExcel = () => {
    if (!filteredAndSortedData || filteredAndSortedData.length === 0) {
      showWarning('Não há produtos vendidos para exportar.');
      return;
    }

    const headers = [
      'Grupo',
      'Subgrupo',
      'Código Adicional', // Novo cabeçalho para additional_code
      'Produtos Ajustados',
      'Quantidade Total Vendida', // Atualizado
      'Valor Total Vendido', // Atualizado
    ];

    const formattedData = filteredAndSortedData.map(item => ({
      'Grupo': item.group_name || '',
      'Subgrupo': item.subgroup_name || '',
      'Código Adicional': item.additional_code || '', // Novo campo
      'Produtos Ajustados': item.product_name,
      'Quantidade Total Vendida': item.total_quantity_sold, // Passa o número puro
      'Valor Total Vendido': item.total_value_sold, // Passa o número puro
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosVendidosDetalhado');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_vendidos_detalhado.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos vendidos exportados com sucesso!');
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dados de análise...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Análise de Produtos Vendidos
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize informações detalhadas sobre os produtos que foram vendidos.
      </p>

      {allSoldItems.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de venda encontrado para análise.</p>
          <p className="text-sm mt-2">Você precisará adicionar dados à tabela `sold_items` para ver a análise aqui.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Detalhes de Vendas por Produto</CardTitle>
                <CardDescription>
                  Dados detalhados de todos os produtos vendidos.
                </CardDescription>
              </div>
              <Button onClick={handleExportSoldItemsToExcel} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Exportar para Excel
              </Button>
            </div>
            <Input
              placeholder="Filtrar por nome do produto, grupo, subgrupo ou código adicional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mt-4"
            />
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-right space-y-1">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Receita Total Filtrada: {totalFilteredRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Quantidade Total Vendida: {totalFilteredQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('group_name')}
                        className="px-0 py-0 h-auto"
                      >
                        Grupo
                        {sortConfig.key === 'group_name' && (
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
                        onClick={() => handleSort('subgroup_name')}
                        className="px-0 py-0 h-auto"
                      >
                        Subgrupo
                        {sortConfig.key === 'subgroup_name' && (
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
                        onClick={() => handleSort('additional_code')}
                        className="px-0 py-0 h-auto"
                      >
                        Cód. Adicional
                        {sortConfig.key === 'additional_code' && (
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
                        onClick={() => handleSort('product_name')}
                        className="px-0 py-0 h-auto"
                      >
                        Produtos Ajustados
                        {sortConfig.key === 'product_name' && (
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
                        onClick={() => handleSort('total_quantity_sold')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Qtd. Total Vendida
                        {sortConfig.key === 'total_quantity_sold' && (
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
                        onClick={() => handleSort('total_value_sold')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Valor Total Vendido
                        {sortConfig.key === 'total_value_sold' && (
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
                  {filteredAndSortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        Nenhum resultado encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedData.map((item, index) => (
                      <TableRow key={`${item.group_name}-${item.subgroup_name}-${item.additional_code}-${item.product_name}-${index}`}>
                        <TableCell>{item.group_name || 'N/A'}</TableCell>
                        <TableCell>{item.subgroup_name || 'N/A'}</TableCell>
                        <TableCell>{item.additional_code || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.total_quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{(item.total_value_sold ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
  );
};

export default AnaliseDeProdutosVendidos;
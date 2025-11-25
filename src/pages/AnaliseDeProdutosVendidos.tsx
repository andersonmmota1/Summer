import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input'; // Importar o componente Input
import { Button } from '@/components/ui/button'; // Importar Button para os cabeçalhos da tabela
import { ArrowUpDown, Download } from 'lucide-react'; // Importar ícone de ordenação e download
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais
import { createExcelFile } from '@/utils/excel'; // Importar createExcelFile
import { useSession } from '@/components/SessionContextProvider'; // Importar useSession

interface SoldItemDetailed {
  id: string;
  user_id: string;
  sale_date: string;
  group_name: string | null;
  subgroup_name: string | null;
  base_product_name: string | null;
  additional_code: string | null;
  product_name: string; // Agora é o 'Adicional'
  quantity_sold: number;
  unit_price: number;
  total_value_sold: number; // Nova coluna
  created_at: string;
}

interface AggregatedSoldProduct {
  product_name: string;
  total_quantity_sold: number | null; // Permitir que seja null
  total_revenue: number | null;      // Permitir que seja null
  average_unit_price: number | null; // Permitir que seja null
  last_sale_date: string | null; // Permitir que last_sale_date seja null
}

interface SortConfig {
  key: keyof SoldItemDetailed | null; // Chaves para ordenação detalhada
  direction: 'asc' | 'desc' | null;
}

const AnaliseDeProdutosVendidos: React.FC = () => {
  const { user } = useSession();
  const [allSoldItems, setAllSoldItems] = useState<SoldItemDetailed[]>([]); // Estado para todos os itens vendidos detalhados
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado para o termo de busca
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'sale_date', direction: 'desc' }); // Estado para a configuração de ordenação, padrão por data

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
        .select('*')
        .eq('user_id', user?.id)
        .order('sale_date', { ascending: false }); // Ordenação inicial para consistência

      if (error) throw error;

      setAllSoldItems(data || []);
      showSuccess('Dados detalhados de produtos vendidos carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados detalhados de produtos vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  // Função para lidar com a ordenação
  const handleSort = (key: keyof SoldItemDetailed) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Dados filtrados e ordenados
  const filteredAndSortedData = useMemo(() => {
    let sortableItems = [...allSoldItems];

    // 1. Filtragem
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(item =>
        item.product_name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (item.group_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.subgroup_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.base_product_name?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        (item.additional_code?.toLowerCase().includes(lowerCaseSearchTerm)) ||
        item.quantity_sold.toString().includes(lowerCaseSearchTerm) ||
        item.total_value_sold.toFixed(2).includes(lowerCaseSearchTerm) ||
        format(new Date(item.sale_date), 'dd/MM/yyyy', { locale: ptBR }).toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // 2. Ordenação
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        // Handle null/undefined values for sorting
        if (aValue === null || aValue === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === null || bValue === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          // Ordenação de datas
          if (sortConfig.key === 'sale_date') {
            const dateA = new Date(aValue).getTime();
            const dateB = new Date(bValue).getTime();
            if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
          }
          // Ordenação de strings
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          // Ordenação de números
          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [allSoldItems, searchTerm, sortConfig]);

  // Calcular o somatório total da receita
  const totalRevenueSum = useMemo(() => {
    return filteredAndSortedData.reduce((sum, item) => sum + (item.total_value_sold ?? 0), 0);
  }, [filteredAndSortedData]);

  const handleExportSoldItemsToExcel = () => {
    if (!filteredAndSortedData || filteredAndSortedData.length === 0) {
      showWarning('Não há produtos vendidos para exportar.');
      return;
    }

    const headers = [
      'Data Caixa',
      'Grupo',
      'Subgrupo',
      'Produto Base',
      'Código Adicional',
      'Adicional (Nome do Produto)',
      'Quantidade Vendida',
      'Valor Total Vendido',
    ];

    const formattedData = filteredAndSortedData.map(item => ({
      'Data Caixa': format(new Date(item.sale_date), 'dd/MM/yyyy', { locale: ptBR }),
      'Grupo': item.group_name || 'N/A',
      'Subgrupo': item.subgroup_name || 'N/A',
      'Produto Base': item.base_product_name || 'N/A',
      'Código Adicional': item.additional_code || 'N/A',
      'Adicional (Nome do Produto)': item.product_name,
      'Quantidade Vendida': item.quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      'Valor Total Vendido': item.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
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
              placeholder="Filtrar por nome do produto, grupo, subgrupo, código adicional, quantidade ou valor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm mt-4"
            />
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-right">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Receita Total Geral: {totalRevenueSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('sale_date')}
                        className="px-0 py-0 h-auto"
                      >
                        Data Caixa
                        {sortConfig.key === 'sale_date' && (
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
                        Adicional (Produto)
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
                        onClick={() => handleSort('quantity_sold')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Qtd. Vendida
                        {sortConfig.key === 'quantity_sold' && (
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
                        Valor Total
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
                      <TableCell colSpan={7} className="h-24 text-center">
                        Nenhum resultado encontrado para "{searchTerm}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedData.map((item, index) => (
                      <TableRow key={item.id || index}>
                        <TableCell className="font-medium">{format(new Date(item.sale_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                        <TableCell>{item.group_name || 'N/A'}</TableCell>
                        <TableCell>{item.subgroup_name || 'N/A'}</TableCell>
                        <TableCell>{item.additional_code || 'N/A'}</TableCell>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity_sold.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{item.total_value_sold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input'; // Importar o componente Input
import { Button } from '@/components/ui/button'; // Importar Button para os cabeçalhos da tabela
import { ArrowUpDown } from 'lucide-react'; // Importar ícone de ordenação
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais

interface AggregatedSoldProduct {
  product_name: string;
  total_quantity_sold: number | null; // Permitir que seja null
  total_revenue: number | null;      // Permitir que seja null
  average_unit_price: number | null; // Permitir que seja null
  last_sale_date: string | null; // Permitir que last_sale_date seja null
}

interface SortConfig {
  key: keyof AggregatedSoldProduct | null;
  direction: 'asc' | 'desc' | null;
}

const AnaliseDeProdutosVendidos: React.FC = () => {
  const [aggregatedSoldData, setAggregatedSoldData] = useState<AggregatedSoldProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>(''); // Estado para o termo de busca
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null }); // Estado para a configuração de ordenação

  useEffect(() => {
    fetchAggregatedSoldData();
  }, []);

  const fetchAggregatedSoldData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando dados de análise de produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('aggregated_sold_products')
        .select('*'); // Removido o order inicial para permitir ordenação client-side

      if (error) throw error;

      setAggregatedSoldData(data || []);
      showSuccess('Dados de análise de produtos vendidos carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados de análise de produtos vendidos:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  // Função para lidar com a ordenação
  const handleSort = (key: keyof AggregatedSoldProduct) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Dados filtrados e ordenados
  const filteredAndSortedData = useMemo(() => {
    let sortableItems = [...aggregatedSoldData];

    // 1. Filtragem
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      sortableItems = sortableItems.filter(item =>
        item.product_name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (item.total_quantity_sold !== null ? item.total_quantity_sold.toString() : '0').includes(lowerCaseSearchTerm) ||
        (item.total_revenue !== null ? item.total_revenue.toFixed(2) : '0.00').includes(lowerCaseSearchTerm) ||
        (item.average_unit_price !== null ? item.average_unit_price.toFixed(2) : '0.00').includes(lowerCaseSearchTerm) ||
        (item.last_sale_date && format(new Date(item.last_sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }).toLowerCase().includes(lowerCaseSearchTerm))
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
          if (sortConfig.key === 'last_sale_date') {
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
  }, [aggregatedSoldData, searchTerm, sortConfig]);

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
        Visualize informações agregadas sobre os produtos que foram vendidos.
      </p>

      {aggregatedSoldData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de venda encontrado para análise.</p>
          <p className="text-sm mt-2">Você precisará adicionar dados à tabela `sold_items` para ver a análise aqui.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Vendas por Produto</CardTitle>
            <CardDescription>
              Dados agregados de todos os produtos vendidos.
            </CardDescription>
            <Input
              placeholder="Filtrar por nome do produto, quantidade, receita ou preço..."
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
                        onClick={() => handleSort('product_name')}
                        className="px-0 py-0 h-auto"
                      >
                        Nome do Produto
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
                        onClick={() => handleSort('total_revenue')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Receita Total
                        {sortConfig.key === 'total_revenue' && (
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
                        onClick={() => handleSort('average_unit_price')}
                        className="px-0 py-0 h-auto justify-end w-full"
                      >
                        Preço Unitário Médio
                        {sortConfig.key === 'average_unit_price' && (
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
                        onClick={() => handleSort('last_sale_date')}
                        className="px-0 py-0 h-auto"
                      >
                        Última Venda
                        {sortConfig.key === 'last_sale_date' && (
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
                      <TableCell colSpan={5} className="h-24 text-center">
                        Nenhum resultado encontrado para "{searchTerm}".
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{(item.total_quantity_sold ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{(item.total_revenue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell className="text-right">{(item.average_unit_price ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell>{item.last_sale_date ? format(new Date(item.last_sale_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</TableCell>
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
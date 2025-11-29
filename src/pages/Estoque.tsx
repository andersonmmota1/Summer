import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

// Interfaces para os novos dados de entrada de estoque
interface PurchasedItem {
  id: string;
  user_id: string;
  c_prod: string;
  descricao_do_produto: string;
  u_com: string;
  q_com: number;
  v_un_com: number;
  created_at: string;
  internal_product_name: string | null; // Este é o campo na tabela purchased_items, que pode ser nulo
  invoice_id: string | null;
  item_sequence_number: number | null;
  x_fant: string | null; // Nome fantasia do fornecedor
  invoice_number: string | null; // Número sequencial da nota
  invoice_emission_date: string | null; // Data de Emissão da NF
}

interface ProductNameConversion {
  id: string;
  user_id: string;
  supplier_product_code: string;
  supplier_product_name: string | null;
  supplier_name: string;
  internal_product_name: string; // Este é o nome interno mapeado que queremos exibir
  created_at: string;
  updated_at: string;
}

// Interface para itens comprados enriquecidos com o nome interno correto para exibição
interface DisplayPurchasedItem extends PurchasedItem {
  display_internal_product_name: string;
}

const Estoque: React.FC = () => {
  const { user } = useSession();
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  // Query para buscar o resumo do estoque atual
  const { data: stockData, isLoading: isLoadingStock, isError: isErrorStock, error: errorStock } = useQuery<CurrentStockSummary[], Error>({
    queryKey: ['current_stock_summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('current_stock_summary')
        .select('*')
        .eq('user_id', user.id)
        .order('internal_product_name', { ascending: true });
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
      const { data, error } = await supabase
        .from('internal_product_usage')
        .select('*')
        .eq('user_id', user.id)
        .order('internal_product_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar uso de produtos internos: ${err.message}`);
    },
  });

  // Query para buscar todos os itens comprados detalhados
  const { data: purchasedItems, isLoading: isLoadingPurchasedItems, isError: isErrorPurchasedItems, error: errorPurchasedItems } = useQuery<PurchasedItem[], Error>({
    queryKey: ['all_purchased_items_stock', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('*, invoice_emission_date')
        .eq('user_id', user.id)
        .order('invoice_emission_date', { ascending: false }) // Ordenar por data de emissão
        .order('created_at', { ascending: false }); // E depois por data de criação
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar itens comprados: ${err.message}`);
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

  const isLoading = isLoadingStock || isLoadingUsage || isLoadingPurchasedItems || isLoadingConversions;
  const isError = isErrorStock || isErrorUsage || isErrorPurchasedItems || isErrorConversions;
  const error = errorStock || errorUsage || errorPurchasedItems || errorConversions;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar dados de estoque:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const groupedUsage = useMemo(() => {
    return internalProductUsage?.reduce((acc, usage) => {
      if (!acc[usage.internal_product_name]) {
        acc[usage.internal_product_name] = [];
      }
      acc[usage.internal_product_name].push(usage);
      return acc;
    }, {} as Record<string, InternalProductUsage[]>) || {};
  }, [internalProductUsage]);

  const handleToggleRow = (productName: string) => {
    setOpenRows(prev => ({
      ...prev,
      [productName]: !prev[productName]
    }));
  };

  const totalStockValue = useMemo(() => {
    return stockData?.reduce((sum, item) => sum + item.total_purchased_value, 0) || 0;
  }, [stockData]);

  // Lógica para enriquecer itens comprados com o nome interno correto para exibição
  const enrichedPurchasedItems = useMemo(() => {
    if (!purchasedItems || !productNameConversions) return [];

    return purchasedItems.map(item => {
      if (item.internal_product_name) {
        return { ...item, display_internal_product_name: item.internal_product_name };
      }

      const mappedConversion = productNameConversions.find(conversion =>
        conversion.supplier_product_code === item.c_prod &&
        conversion.supplier_name === item.x_fant
      );

      return {
        ...item,
        display_internal_product_name: mappedConversion?.internal_product_name || item.descricao_do_produto || 'Não Mapeado'
      };
    });
  }, [purchasedItems, productNameConversions]);

  // Agrupar itens comprados enriquecidos por data de emissão da NF
  const groupedPurchasedEntriesByDate = useMemo(() => {
    if (!enrichedPurchasedItems) return {};

    return enrichedPurchasedItems.reduce((acc, item) => {
      const dateKey = item.invoice_emission_date || 'Data Desconhecida';
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, DisplayPurchasedItem[]>);
  }, [enrichedPurchasedItems]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedPurchasedEntriesByDate).sort((a, b) => {
      if (a === 'Data Desconhecida') return 1;
      if (b === 'Data Desconhecida') return -1;
      return parseISO(b).getTime() - parseISO(a).getTime();
    });
  }, [groupedPurchasedEntriesByDate]);

  if (isLoading) {
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

      {stockData && stockData.length === 0 && Object.keys(groupedPurchasedEntriesByDate).length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de estoque ou entrada de produto encontrado.</p>
          <p className="text-sm mt-2">
            Certifique-se de ter carregado dados de compras, vendas, fichas técnicas e conversões de unidades
            nas páginas "Carga de Dados" e "Mapeamento de Produtos".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
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
                    {stockData?.map((item, index) => (
                      <React.Fragment key={index}>
                        <TableRow>
                          <TableCell className="font-medium">{item.internal_product_name}</TableCell>
                          <TableCell>{item.internal_unit}</TableCell>
                          <TableCell className="text-right">{item.current_stock_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_purchased_quantity_converted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_consumed_quantity_from_sales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_purchased_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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
                                        {usage.sold_product_name} (Qtd. Necessária: {usage.quantity_needed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
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

          {/* NOVO CARD: Visão Detalhada de Entradas de Estoque por Data */}
          {Object.keys(groupedPurchasedEntriesByDate).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Visão Detalhada de Entradas de Estoque por Data</CardTitle>
                <CardDescription>
                  Itens comprados, agrupados pela data de emissão da nota fiscal, com seus nomes internos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sortedDates.map(dateKey => (
                    <div key={dateKey} className="border rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Data: {dateKey === 'Data Desconhecida' ? dateKey : format(parseISO(dateKey), 'dd/MM/yyyy', { locale: ptBR })}
                      </h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome Interno do Produto</TableHead>
                              <TableHead>Fornecedor</TableHead>
                              <TableHead>Unidade</TableHead>
                              <TableHead className="text-right">Quantidade</TableHead>
                              <TableHead className="text-right">Valor Unitário</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedPurchasedEntriesByDate[dateKey]?.map((item, itemIndex) => (
                              <TableRow key={item.id || itemIndex}>
                                <TableCell className="font-medium">{item.display_internal_product_name}</TableCell>
                                <TableCell>{item.x_fant || 'N/A'}</TableCell>
                                <TableCell>{item.u_com}</TableCell>
                                <TableCell className="text-right">{item.q_com.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">{item.v_un_com.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
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
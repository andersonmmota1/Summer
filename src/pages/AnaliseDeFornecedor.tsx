import React, { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { createExcelFile } from '@/utils/excel';
import { Download, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils'; // Importar cn para classes condicionais

// Interface para os itens comprados diretamente do Supabase
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

// Interface para as regras de conversão de nomes de produtos
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

// Nova interface para o resumo de fornecedores
interface TotalPurchasedBySupplier {
  user_id: string;
  supplier_name: string;
  total_value_spent: number;
}

// Nova interface para o resumo de itens comprados por nome interno
interface TotalPurchasedByInternalProduct {
  user_id: string;
  product_display_name: string;
  total_value_spent: number;
}

const AnaliseDeFornecedor: React.FC = () => {
  const { user } = useSession();
  const [selectedInternalProductName, setSelectedInternalProductName] = useState<string | null>(null);

  // Query para buscar o resumo de fornecedores
  const { data: suppliersSummary, isLoading: isLoadingSuppliers, isError: isErrorSuppliers, error: errorSuppliers } = useQuery<TotalPurchasedBySupplier[], Error>({
    queryKey: ['total_purchased_by_supplier', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('total_purchased_by_supplier')
        .select('*')
        .eq('user_id', user.id)
        .order('total_value_spent', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar resumo de fornecedores: ${err.message}`);
    },
  });

  // Query para buscar o resumo de itens comprados por nome interno
  const { data: internalProductsSummary, isLoading: isLoadingInternalProducts, isError: isErrorInternalProducts, error: errorInternalProducts } = useQuery<TotalPurchasedByInternalProduct[], Error>({
    queryKey: ['total_purchased_by_internal_product', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('total_purchased_by_internal_product')
        .select('*')
        .eq('user_id', user.id)
        .order('total_value_spent', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar resumo de produtos internos: ${err.message}`);
    },
  });

  // Query para buscar os itens comprados detalhados
  const { data: purchasedItems, isLoading: isLoadingItems, isError: isErrorItems, error: errorItems } = useQuery<PurchasedItem[], Error>({
    queryKey: ['all_purchased_items', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('*, invoice_emission_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onError: (err) => {
      showError(`Erro ao carregar itens comprados: ${err.message}`);
    },
  });

  // NOVO: Query para buscar todas as conversões de nomes de produtos
  const { data: productNameConversions, isLoading: isLoadingConversions, isError: isErrorConversions, error: errorConversions } = useQuery<ProductNameConversion[], Error>({
    queryKey: ['product_name_conversions_for_analysis', user?.id],
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

  const isLoading = isLoadingSuppliers || isLoadingInternalProducts || isLoadingItems || isLoadingConversions;
  const isError = isErrorSuppliers || isErrorInternalProducts || isErrorItems || isErrorConversions;
  const error = errorSuppliers || errorInternalProducts || errorItems || errorConversions;

  // Função para lidar com o clique no nome interno do produto para filtrar
  const handleProductFilterClick = (productName: string) => {
    setSelectedInternalProductName(prevName => (prevName === productName ? null : productName));
  };

  // Dados de itens comprados enriquecidos com o nome interno correto para exibição
  const enrichedPurchasedItems = useMemo(() => {
    if (!purchasedItems || !productNameConversions) return [];

    return purchasedItems.map(item => {
      // Primeiro, verifica se purchased_items.internal_product_name já está preenchido
      if (item.internal_product_name) {
        return { ...item, display_internal_product_name: item.internal_product_name };
      }

      // Se não, tenta encontrar um mapeamento na tabela product_name_conversions
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

  // Dados filtrados para o card de Itens Comprados Detalhados
  const filteredDisplayPurchasedItems = useMemo(() => {
    let itemsToFilter: DisplayPurchasedItem[] = enrichedPurchasedItems;

    if (!selectedInternalProductName) return itemsToFilter;

    const normalizedSelectedName = selectedInternalProductName.trim().toLowerCase();

    return itemsToFilter.filter(item => {
      const normalizedDisplayInternalName = item.display_internal_product_name.trim().toLowerCase();
      const normalizedDescricao = item.descricao_do_produto?.trim().toLowerCase();

      // Filtra com base no nome de exibição ou na descrição original
      return normalizedDisplayInternalName === normalizedSelectedName || normalizedDescricao === normalizedSelectedName;
    });
  }, [enrichedPurchasedItems, selectedInternalProductName]);

  const handleExportAllPurchasedItemsToExcel = () => {
    if (!filteredDisplayPurchasedItems || filteredDisplayPurchasedItems.length === 0) {
      showWarning('Não há itens comprados para exportar.');
      return;
    }

    const headers = [
      'ID do Item',
      'ID da Nota (Chave de Acesso)',
      'Número da Nota (Sequencial)',
      'Número do Item na Nota',
      'Nome Fantasia Fornecedor',
      'Código Fornecedor',
      'Descrição do Produto (XML)',
      'Nome Interno do Produto',
      'Unidade de Compra',
      'Quantidade Comprada',
      'Valor Unitário de Compra',
      'Data de Emissão da NF',
      'Data de Registro no Sistema',
    ];

    const formattedData = filteredDisplayPurchasedItems.map(item => ({
      'ID do Item': item.id,
      'ID da Nota (Chave de Acesso)': item.invoice_id || 'N/A',
      'Número da Nota (Sequencial)': item.invoice_number || 'N/A',
      'Número do Item na Nota': item.item_sequence_number || 'N/A',
      'Nome Fantasia Fornecedor': item.x_fant || 'N/A',
      'Código Fornecedor': item.c_prod,
      'Descrição do Produto (XML)': item.descricao_do_produto,
      'Nome Interno do Produto': item.display_internal_product_name, // Usa o nome enriquecido
      'Unidade de Compra': item.u_com,
      'Quantidade Comprada': item.q_com,
      'Valor Unitário de Compra': item.v_un_com,
      'Data de Emissão da NF': item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A',
      'Data de Registro no Sistema': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    }));

    const blob = createExcelFile(formattedData, headers, 'ItensCompradosDetalhado');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itens_comprados_detalhado.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Itens comprados exportados para Excel com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando dados de fornecedores...
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

  const hasData = (suppliersSummary && suppliersSummary.length > 0) || (internalProductsSummary && internalProductsSummary.length > 0) || (purchasedItems && purchasedItems.length > 0);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Análise de Fornecedor
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize o resumo de gastos por fornecedor e os detalhes dos itens comprados,
        com o nome interno do produto quando disponível.
      </p>

      {selectedInternalProductName && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filtrando por Produto Interno: <span className="font-bold text-primary">{selectedInternalProductName}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelectedInternalProductName(null)}>
            <XCircle className="h-4 w-4 mr-1" /> Limpar Filtro
          </Button>
        </div>
      )}

      {!hasData ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum dado de fornecedor ou item comprado encontrado.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado arquivos XML na página "Carga de Dados".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Fornecedores com Valor Total de Compra */}
          {suppliersSummary && suppliersSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fornecedores com Valor Total de Compra</CardTitle>
                <CardDescription>
                  Valor total gasto com cada fornecedor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Valor Total Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliersSummary.map((supplier, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{supplier.supplier_name || 'N/A'}</TableCell>
                          <TableCell className="text-right">{supplier.total_value_spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* NOVO Card: Itens Comprados por Nome Interno */}
          {internalProductsSummary && internalProductsSummary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Itens Comprados por Nome Interno</CardTitle>
                <CardDescription>
                  Valor total gasto por cada produto interno. Clique para filtrar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome Interno</TableHead>
                        <TableHead className="text-right">Valor Total Gasto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {internalProductsSummary.map((product, index) => (
                        <TableRow
                          key={index}
                          onClick={() => handleProductFilterClick(product.product_display_name)}
                          className={cn(
                            "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700",
                            selectedInternalProductName === product.product_display_name && "bg-blue-50 dark:bg-blue-900/20"
                          )}
                        >
                          <TableCell className="font-medium">{product.product_display_name || 'N/A'}</TableCell>
                          <TableCell className="text-right">{product.total_value_spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card: Itens Comprados Detalhados (agora ocupa duas colunas) */}
          {filteredDisplayPurchasedItems && filteredDisplayPurchasedItems.length > 0 && (
            <Card className="lg:col-span-2"> {/* Ocupa duas colunas em telas grandes */}
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Itens Comprados Detalhados</CardTitle>
                    <CardDescription>
                      Lista completa de todos os itens de produtos carregados via XML, com nome interno.
                    </CardDescription>
                  </div>
                  <Button onClick={handleExportAllPurchasedItemsToExcel} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Exportar para Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nota Fiscal</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Cód. Produto</TableHead>
                        <TableHead>Descrição do Produto (XML)</TableHead>
                        <TableHead>Nome Interno do Produto</TableHead> {/* Coluna separada */}
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Valor Unitário</TableHead>
                        <TableHead>Data de Emissão da NF</TableHead>
                        <TableHead>Data de Registro no Sistema</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDisplayPurchasedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.invoice_number || 'N/A'}</TableCell>
                          <TableCell>{item.x_fant || 'N/A'}</TableCell>
                          <TableCell>{item.c_prod}</TableCell>
                          <TableCell>{item.descricao_do_produto}</TableCell>
                          <TableCell>{item.display_internal_product_name}</TableCell> {/* Usa o nome enriquecido */}
                          <TableCell>{item.u_com}</TableCell>
                          <TableCell className="text-right">{item.q_com.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.v_un_com.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell>{item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</TableCell>
                          <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        </TableRow>
                      ))}
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

export default AnaliseDeFornecedor;
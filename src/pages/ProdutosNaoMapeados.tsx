import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { createExcelFile } from '@/utils/excel';
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

// Updated interface for unmapped name products
interface UnmappedProductNameSummary {
  user_id: string; // Adicionado user_id
  c_prod: string;
  descricao_do_produto: string;
  supplier_name: string;
  invoice_number: string | null; // NOVO: Adicionado número da nota fiscal
}

// Updated interface for unmapped unit conversion summary
interface UnmappedUnitConversionSummary {
  user_id: string; // Adicionado user_id
  c_prod: string;
  supplier_name: string;
  descricao_do_produto: string;
  supplier_unit: string;
  invoice_number: string | null; // NOVO: Adicionado número da nota fiscal
}

const ProdutosNaoMapeados: React.FC = () => {
  const { user } = useSession(); // Obter o usuário da sessão

  // Fetch unmapped name products
  const { data: unmappedNameProducts, isLoading: isLoadingNames, isError: isErrorNames, error: errorNames } = useQuery<UnmappedProductNameSummary[], Error>({
    queryKey: ['unmapped_purchased_products_summary', user?.id], // Removido selectedSupplier da chave
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('unmapped_purchased_products_summary')
        .select('*, invoice_number') // NOVO: Seleciona invoice_number
        .eq('user_id', user.id); // Filtra por user_id

      // Removido o filtro por selectedSupplier
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch unmapped unit conversion products
  const { data: unmappedUnitProducts, isLoading: isLoadingUnits, isError: isErrorUnits, error: errorUnits } = useQuery<UnmappedUnitConversionSummary[], Error>({
    queryKey: ['unmapped_unit_conversions_summary', user?.id], // Removido selectedSupplier da chave
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('unmapped_unit_conversions_summary')
        .select('*, invoice_number') // NOVO: Seleciona invoice_number
        .eq('user_id', user.id); // Filtra por user_id

      // Removido o filtro por selectedSupplier
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = isLoadingNames || isLoadingUnits;
  const isError = isErrorNames || isErrorUnits;
  const error = errorNames || errorUnits;

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar produtos não mapeados:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const handleExportUnmappedNamesToExcel = () => {
    if (!unmappedNameProducts || unmappedNameProducts.length === 0) {
      showWarning('Não há produtos sem mapeamento de nome interno para exportar.');
      return;
    }

    const headers = ['Número da NF', 'Código do Produto Fornecedor', 'Nome do Fornecedor', 'Descrição do Produto'];
    const formattedData = unmappedNameProducts.map(item => ({
      'Número da NF': item.invoice_number || 'N/A', // NOVO: Inclui o número da NF
      'Código do Produto Fornecedor': item.c_prod,
      'Nome do Fornecedor': item.supplier_name,
      'Descrição do Produto': item.descricao_do_produto,
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosNaoMapeadosNomes');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_nao_mapeados_nomes.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos sem mapeamento de nome interno exportados com sucesso!');
  };

  const handleExportUnmappedUnitsToExcel = () => {
    if (!unmappedUnitProducts || unmappedUnitProducts.length === 0) {
      showWarning('Não há produtos sem mapeamento de unidade interna para exportar.');
      return;
    }

    const headers = ['Número da NF', 'Código Fornecedor', 'Nome Fornecedor', 'Descrição do Produto', 'Unidade Fornecedor'];
    const formattedData = unmappedUnitProducts.map(item => ({
      'Número da NF': item.invoice_number || 'N/A', // NOVO: Inclui o número da NF
      'Código Fornecedor': item.c_prod,
      'Nome Fornecedor': item.supplier_name,
      'Descrição do Produto': item.descricao_do_produto,
      'Unidade Fornecedor': item.supplier_unit,
    }));

    const blob = createExcelFile(formattedData, headers, 'ProdutosNaoMapeadosUnidades');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produtos_nao_mapeados_unidades.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Produtos sem mapeamento de unidade interna exportados com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos não mapeados...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os produtos não mapeados: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  const hasUnmappedData = (unmappedNameProducts && unmappedNameProducts.length > 0) || (unmappedUnitProducts && unmappedUnitProducts.length > 0);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Produtos de Fornecedores Não Mapeados
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página exibe produtos comprados de fornecedores que ainda não possuem um mapeamento para um nome interno ou uma conversão de unidade.
        Considere mapeá-los na página "Carga de Dados" (aba Conversões) para uma análise mais consistente.
      </p>

      {!hasUnmappedData ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos de fornecedores já estão mapeados (nomes e unidades)!</p>
          <p className="text-sm mt-2">Não há produtos pendentes de mapeamento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {unmappedNameProducts && unmappedNameProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produtos sem Mapeamento de Nome Interno</CardTitle>
                <CardDescription>
                  Itens comprados que ainda não foram associados a um nome de produto interno.
                </CardDescription>
                <Button onClick={handleExportUnmappedNamesToExcel} className="mt-4">
                  Exportar para Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número da NF</TableHead> {/* NOVO: Cabeçalho para NF */}
                        <TableHead>Cód. Produto Fornecedor</TableHead>
                        <TableHead>Nome Fornecedor</TableHead>
                        <TableHead>Descrição do Produto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedNameProducts.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.invoice_number || 'N/A'}</TableCell> {/* NOVO: Célula para NF */}
                          <TableCell className="font-medium">{item.c_prod}</TableCell>
                          <TableCell>{item.supplier_name}</TableCell>
                          <TableCell>{item.descricao_do_produto}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {unmappedUnitProducts && unmappedUnitProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produtos sem Mapeamento de Unidade Interna</CardTitle>
                <CardDescription>
                  Itens comprados que ainda não possuem uma conversão para uma unidade interna.
                </CardDescription>
                <Button onClick={handleExportUnmappedUnitsToExcel} className="mt-4">
                  Exportar para Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número da NF</TableHead> {/* NOVO: Cabeçalho para NF */}
                        <TableHead>Cód. Fornecedor</TableHead>
                        <TableHead>Nome Fornecedor</TableHead>
                        <TableHead>Descrição do Produto</TableHead>
                        <TableHead>Unidade Fornecedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedUnitProducts.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.invoice_number || 'N/A'}</TableCell> {/* NOVO: Célula para NF */}
                          <TableCell className="font-medium">{item.c_prod}</TableCell>
                          <TableCell>{item.supplier_name}</TableCell>
                          <TableCell>{item.descricao_do_produto}</TableCell>
                          <TableCell>{item.supplier_unit}</TableCell>
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

export default ProdutosNaoMapeados;
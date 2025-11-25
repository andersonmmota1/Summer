import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button'; // Import Button
import { createExcelFile } from '@/utils/excel'; // Import createExcelFile

// Updated interface for unmapped name products
interface UnmappedProductNameSummary {
  c_prod: string;
  descricao_do_produto: string;
  supplier_name: string;
}

// Interface for unmapped unit conversion summary remains the same
interface UnmappedUnitConversionSummary {
  c_prod: string;
  descricao_do_produto: string;
  supplier_name: string;
  supplier_unit: string;
  total_quantity_purchased: number;
  total_value_purchased: number;
  average_unit_value: number;
  last_purchase_date: string;
}

const ProdutosNaoMapeados: React.FC = () => {
  const [unmappedNameProducts, setUnmappedNameProducts] = useState<UnmappedProductNameSummary[]>([]);
  const [unmappedUnitProducts, setUnmappedUnitProducts] = useState<UnmappedUnitConversionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnmappedProducts();
  }, []);

  const fetchUnmappedProducts = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando produtos não mapeados...');
    try {
      // Fetch unmapped name products from the simplified view
      const { data: nameData, error: nameError } = await supabase
        .from('unmapped_purchased_products_summary') // This view is now simplified
        .select('*');

      if (nameError) throw nameError;
      setUnmappedNameProducts(nameData || []);

      // Fetch unmapped unit products (this remains unchanged)
      const { data: unitData, error: unitError } = await supabase
        .from('unmapped_unit_conversions_summary')
        .select('*');

      if (unitError) throw unitError;
      setUnmappedUnitProducts(unitData || []);

      showSuccess('Produtos não mapeados carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar produtos não mapeados:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const handleExportUnmappedNamesToExcel = () => {
    if (unmappedNameProducts.length === 0) {
      showWarning('Não há produtos sem mapeamento de nome interno para exportar.');
      return;
    }

    const headers = ['Código do Produto Fornecedor', 'Nome do Fornecedor', 'Descrição do Produto'];
    const formattedData = unmappedNameProducts.map(item => ({
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


  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando produtos não mapeados...
      </div>
    );
  }

  const hasUnmappedData = unmappedNameProducts.length > 0 || unmappedUnitProducts.length > 0;

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
          {unmappedNameProducts.length > 0 && (
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
                        <TableHead>Cód. Produto Fornecedor</TableHead>
                        <TableHead>Nome Fornecedor</TableHead>
                        <TableHead>Descrição do Produto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedNameProducts.map((item, index) => (
                        <TableRow key={index}>
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

          {unmappedUnitProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produtos sem Mapeamento de Unidade Interna</CardTitle>
                <CardDescription>
                  Itens comprados que ainda não possuem uma conversão para uma unidade interna.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Cód. Produto Fornecedor</TableHead>
                        <TableHead>Descrição do Produto</TableHead>
                        <TableHead>Unidade Fornecedor</TableHead>
                        <TableHead className="text-right">Qtd. Total Comprada</TableHead>
                        <TableHead className="text-right">Valor Total Gasto</TableHead>
                        <TableHead className="text-right">Valor Unitário Médio</TableHead>
                        <TableHead>Última Compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedUnitProducts.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.supplier_name}</TableCell>
                          <TableCell>{item.c_prod}</TableCell>
                          <TableCell>{item.descricao_do_produto}</TableCell>
                          <TableCell>{item.supplier_unit}</TableCell>
                          <TableCell className="text-right">{item.total_quantity_purchased.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {item.total_value_purchased.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {item.average_unit_value.toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(item.last_purchase_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
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
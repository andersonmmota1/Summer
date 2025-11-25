import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFilter } from '@/contexts/FilterContext';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { Input } from '@/components/ui/input';

interface ConvertedUnitSummary {
  user_id: string;
  supplier_name: string;
  supplier_product_code: string;
  supplier_product_description: string;
  supplier_unit: string;
  internal_unit: string;
  conversion_factor: number;
  product_display_name: string;
  total_original_quantity_purchased: number;
  total_converted_quantity: number;
  total_value_purchased: number;
  average_converted_unit_value: number;
  last_purchase_date: string;
}

const VisaoDeConversoes: React.FC = () => {
  const { filters } = useFilter();
  const { selectedSupplier, selectedProduct } = filters; // Obter selectedProduct
  const { user } = useSession();
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data: convertedData, isLoading, isError, error } = useQuery<ConvertedUnitSummary[], Error>({
    queryKey: ['converted_units_summary', user?.id, selectedSupplier, selectedProduct], // Adicionar selectedProduct à chave
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('converted_units_summary')
        .select('*')
        .eq('user_id', user.id);

      if (selectedSupplier) {
        query = query.eq('supplier_name', selectedSupplier);
      }
      if (selectedProduct) {
        query = query.eq('product_display_name', selectedProduct); // Filtrar por nome interno do produto
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (isError) {
      console.error('Erro ao carregar visão de conversões:', error);
      showError(`Erro ao carregar dados: ${error?.message}`);
    }
  }, [isError, error]);

  const totalConvertedQuantity = useMemo(() => {
    return convertedData?.reduce((sum, item) => sum + item.total_converted_quantity, 0) || 0;
  }, [convertedData]);

  const filteredConvertedData = useMemo(() => {
    if (!convertedData) return [];
    if (!searchTerm) return convertedData;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return convertedData.filter(item =>
      item.supplier_name.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.supplier_product_description.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.product_display_name.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.supplier_unit.toLowerCase().includes(lowerCaseSearchTerm) ||
      item.internal_unit.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [convertedData, searchTerm]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando visão de conversões...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar a visão de conversões: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Visão de Conversões de Unidades
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Aqui você pode verificar os produtos comprados que possuem conversão de unidade registrada,
        visualizando as quantidades originais e as quantidades convertidas para suas unidades internas.
      </p>

      {(selectedSupplier || selectedProduct) && (
        <div className="mb-4">
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filtros Ativos:
            {selectedSupplier && <span className="ml-2 font-bold text-primary">Fornecedor: {selectedSupplier}</span>}
            {selectedProduct && <span className="ml-2 font-bold text-primary">Produto: {selectedProduct}</span>}
          </span>
        </div>
      )}

      {convertedData && convertedData.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum item com conversão de unidade encontrada.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado dados de compras e conversões de unidades na página "Carga de Dados".</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Total de Unidades Convertidas</CardTitle>
              <CardDescription>
                Somatório de todas as quantidades convertidas para unidades internas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Total Convertido: {totalConvertedQuantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unidades
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhes das Conversões de Unidades</CardTitle>
              <CardDescription>
                Lista detalhada de cada produto com sua conversão de unidade aplicada.
              </CardDescription>
              <Input
                placeholder="Filtrar por nome do fornecedor, descrição do produto, nome interno ou unidade..."
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
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição do Produto Fornecedor</TableHead>
                      <TableHead>Nome Interno</TableHead>
                      <TableHead>Unidade Fornecedor</TableHead>
                      <TableHead>Unidade Interna</TableHead>
                      <TableHead className="text-right">Fator Conversão</TableHead>
                      <TableHead className="text-right">Qtd. Original</TableHead>
                      <TableHead className="text-right">Qtd. Convertida</TableHead>
                      <TableHead className="text-right">Valor Total Gasto</TableHead>
                      <TableHead className="text-right">Valor Unitário (Convertido)</TableHead>
                      <TableHead>Última Compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConvertedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="h-24 text-center">
                          Nenhum resultado encontrado para "{searchTerm}".
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConvertedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.supplier_name}</TableCell>
                          <TableCell>{item.supplier_product_description}</TableCell>
                          <TableCell>{item.product_display_name}</TableCell>
                          <TableCell>{item.supplier_unit}</TableCell>
                          <TableCell>{item.internal_unit}</TableCell>
                          <TableCell className="text-right">{item.conversion_factor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_original_quantity_purchased.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_converted_quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{item.total_value_purchased.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell className="text-right">{item.average_converted_unit_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell>{format(new Date(item.last_purchase_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VisaoDeConversoes;
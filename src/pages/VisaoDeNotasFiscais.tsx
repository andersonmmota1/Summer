import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFilter } from '@/contexts/FilterContext';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider'; // Importar useSession

interface InvoiceSummary {
  invoice_id: string;
  invoice_number_display: string;
  supplier_name: string;
  invoice_date: string;
  total_invoice_value: number;
}

const VisaoDeNotasFiscais: React.FC = () => {
  const { filters } = useFilter();
  const { selectedSupplier } = filters;
  const { user } = useSession(); // Obter o usuário da sessão

  const fetchInvoiceSummary = async (): Promise<InvoiceSummary[]> => {
    if (!user?.id) {
      // Se não houver usuário logado, não há dados para buscar
      return [];
    }

    let query = supabase
      .from('invoice_summary')
      .select('*');

    if (selectedSupplier) {
      query = query.eq('supplier_name', selectedSupplier);
    }
    // A view já filtra por user_id, então não precisamos adicionar aqui novamente
    query = query.order('invoice_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao carregar resumo das notas fiscais:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
      throw error;
    }

    return data || [];
  };

  const { data: invoices, isLoading, isError, error } = useQuery<InvoiceSummary[], Error>({
    queryKey: ['invoice_summary', user?.id, selectedSupplier], // Inclui user.id na chave da query
    queryFn: fetchInvoiceSummary,
    enabled: !!user?.id, // A query só será executada se houver um user.id
    staleTime: 1000 * 60 * 5,
    onSuccess: () => {
      // showSuccess('Resumo das notas fiscais carregado com sucesso!');
    },
    onError: (err) => {
      console.error('Erro no React Query ao carregar notas fiscais:', err);
      showError(`Erro ao carregar notas fiscais: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando notas fiscais...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar as notas fiscais: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Visão de Notas Fiscais
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Visualize um resumo das notas fiscais carregadas, incluindo o fornecedor, data de emissão e valor total.
      </p>

      {selectedSupplier && (
        <div className="mb-4">
          <span className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Filtrando por Fornecedor: <span className="font-bold text-primary">{selectedSupplier}</span>
          </span>
        </div>
      )}

      {invoices && invoices.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhuma nota fiscal encontrada.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado arquivos XML na página "Carga de Dados".</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Notas Fiscais Carregadas</CardTitle>
            <CardDescription>
              Lista de todas as notas fiscais com seus detalhes agregados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número da Nota</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data de Emissão</TableHead>
                    <TableHead className="text-right">Total da Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.map((invoice, index) => (
                    <TableRow key={invoice.invoice_id || index}>
                      <TableCell className="font-medium">{invoice.invoice_number_display || 'N/A'}</TableCell>
                      <TableCell>{invoice.supplier_name || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">{invoice.total_invoice_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
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

export default VisaoDeNotasFiscais;
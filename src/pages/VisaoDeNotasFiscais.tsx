import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/SessionContextProvider';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InvoiceSummary {
  invoice_id: string;
  invoice_number_display: string;
  supplier_name: string;
  invoice_date: string;
  total_invoice_value: number;
}

const VisaoDeNotasFiscais: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const fetchInvoiceSummary = async (): Promise<InvoiceSummary[]> => {
    if (!user?.id) {
      return [];
    }

    let query = supabase
      .from('invoice_summary')
      .select('*')
      .eq('user_id', user.id); // Adicionado filtro por user_id

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
    queryKey: ['invoice_summary', user?.id],
    queryFn: fetchInvoiceSummary,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    onSuccess: () => {
      // showSuccess('Resumo das notas fiscais carregado com sucesso!');
    },
    onError: (err) => {
      console.error('Erro no React Query ao carregar notas fiscais:', err);
      showError(`Erro ao carregar notas fiscais: ${err.message}`);
    },
  });

  const handleDeleteInvoice = async (invoiceId: string, invoiceNumberDisplay: string) => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível excluir notas fiscais.');
      return;
    }

    const loadingToastId = showLoading(`Excluindo nota fiscal ${invoiceNumberDisplay}...`);
    try {
      // Excluir todos os itens da tabela 'purchased_items' que pertencem a esta invoice_id
      const { error } = await supabase
        .from('purchased_items')
        .delete()
        .eq('user_id', user.id)
        .eq('invoice_id', invoiceId);

      if (error) {
        throw error;
      }

      showSuccess(`Nota fiscal ${invoiceNumberDisplay} e todos os seus itens foram excluídos com sucesso!`);
      // Invalida as queries relevantes para que os dados sejam recarregados
      queryClient.invalidateQueries({ queryKey: ['invoice_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['purchased_items', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['purchased_items_count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unique_c_prods', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unique_descricoes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unique_u_coms', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unique_x_fants', user?.id] });
    } catch (err: any) {
      console.error('Erro ao excluir nota fiscal:', err);
      showError(`Erro ao excluir nota fiscal ${invoiceNumberDisplay}: ${err.message}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

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
                    <TableHead className="text-center">Ações</TableHead> {/* Nova coluna para ações */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.map((invoice, index) => (
                    <TableRow key={invoice.invoice_id || index}>
                      <TableCell className="font-medium">{invoice.invoice_number_display || 'N/A'}</TableCell>
                      <TableCell>{invoice.supplier_name || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">{invoice.total_invoice_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell className="text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Excluir Nota Fiscal</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso removerá permanentemente a nota fiscal
                                <strong> {invoice.invoice_number_display}</strong> do fornecedor <strong>{invoice.supplier_name}</strong>
                                e todos os seus itens associados do seu banco de dados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteInvoice(invoice.invoice_id, invoice.invoice_number_display)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Sim, Excluir Nota Fiscal
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
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
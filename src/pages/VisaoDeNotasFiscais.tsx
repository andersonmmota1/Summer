import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InvoiceSummary {
  invoice_id: string; // Chave de acesso da NFe (identificador único)
  invoice_number_display: string; // Número sequencial da nota (para exibição)
  supplier_name: string;
  invoice_date: string;
  total_invoice_value: number;
}

const VisaoDeNotasFiscais: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoiceSummary();
  }, []);

  const fetchInvoiceSummary = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando resumo das notas fiscais...');
    try {
      const { data, error } = await supabase
        .from('invoice_summary')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      setInvoices(data || []);
      showSuccess('Resumo das notas fiscais carregado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar resumo das notas fiscais:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando notas fiscais...
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

      {invoices.length === 0 ? (
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
                    <TableHead>Número da Nota</TableHead> {/* Agora exibirá o nNF */}
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data de Emissão</TableHead>
                    <TableHead className="text-right">Total da Nota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice, index) => (
                    <TableRow key={invoice.invoice_id || index}> {/* Usar invoice_id como key única */}
                      <TableCell className="font-medium">{invoice.invoice_number_display || 'N/A'}</TableCell> {/* Exibe o nNF */}
                      <TableCell>{invoice.supplier_name || 'N/A'}</TableCell>
                      <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">R$ {invoice.total_invoice_value.toFixed(2)}</TableCell>
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
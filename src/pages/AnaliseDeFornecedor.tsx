import React, { useMemo } from 'react';
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
import { Download } from 'lucide-react';

interface PurchasedItem {
  id: string;
  user_id: string;
  c_prod: string;
  descricao_do_produto: string;
  u_com: string;
  q_com: number;
  v_un_com: number;
  created_at: string;
  internal_product_name: string | null;
  invoice_id: string | null;
  item_sequence_number: number | null;
  x_fant: string | null; // Nome fantasia do fornecedor
  invoice_number: string | null; // Número sequencial da nota
  invoice_emission_date: string | null; // Adicionado: Data de Emissão da NF
}

const AnaliseDeFornecedor: React.FC = () => {
  const { user } = useSession();

  const fetchPurchasedItems = async (): Promise<PurchasedItem[]> => {
    if (!user?.id) {
      return [];
    }
    const { data, error } = await supabase
      .from('purchased_items')
      .select('*, invoice_emission_date') // Selecionar a nova coluna
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar itens comprados:', error);
      throw error;
    }
    return data || [];
  };

  const { data: purchasedItems, isLoading, isError, error } = useQuery<PurchasedItem[], Error>({
    queryKey: ['all_purchased_items', user?.id],
    queryFn: fetchPurchasedItems,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos de cache
    onError: (err) => {
      showError(`Erro ao carregar itens comprados: ${err.message}`);
    },
  });

  const handleExportToExcel = () => {
    if (!purchasedItems || purchasedItems.length === 0) {
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
      'Descrição do Produto',
      'Unidade de Compra',
      'Quantidade Comprada',
      'Valor Unitário de Compra',
      'Nome Interno do Produto',
      'Data de Emissão da NF', // Adicionado
      'Data de Registro no Sistema', // Renomeado para clareza
    ];

    const formattedData = purchasedItems.map(item => ({
      'ID do Item': item.id,
      'ID da Nota (Chave de Acesso)': item.invoice_id || 'N/A',
      'Número da Nota (Sequencial)': item.invoice_number || 'N/A',
      'Número do Item na Nota': item.item_sequence_number || 'N/A',
      'Nome Fantasia Fornecedor': item.x_fant || 'N/A',
      'Código Fornecedor': item.c_prod,
      'Descrição do Produto': item.descricao_do_produto,
      'Unidade de Compra': item.u_com,
      'Quantidade Comprada': item.q_com,
      'Valor Unitário de Compra': item.v_un_com,
      'Nome Interno do Produto': item.internal_product_name || 'Não Mapeado',
      'Data de Emissão da NF': item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A', // Usando a nova coluna
      'Data de Registro no Sistema': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }), // Mantendo created_at para registro no sistema
    }));

    const blob = createExcelFile(formattedData, headers, 'ItensCompradosXML');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itens_comprados_xml.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Itens comprados exportados para Excel com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando itens comprados...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-red-600 dark:text-red-400">
        <p>Ocorreu um erro ao carregar os itens comprados: {error?.message}</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Por favor, tente novamente mais tarde.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Análise de Fornecedor (Itens Comprados do XML)
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Esta página exibe todos os itens de produtos que foram carregados através de arquivos XML.
        Você pode ver os detalhes de cada item, incluindo informações do fornecedor e da nota fiscal.
      </p>

      {purchasedItems && purchasedItems.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">Nenhum item comprado encontrado.</p>
          <p className="text-sm mt-2">Certifique-se de ter carregado arquivos XML na página "Carga de Dados".</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Itens Comprados Detalhados</CardTitle>
                <CardDescription>
                  Lista completa de todos os itens de produtos carregados via XML.
                </CardDescription>
              </div>
              <Button onClick={handleExportToExcel} variant="outline" className="gap-2">
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
                    <TableHead>Descrição do Produto</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor Unitário</TableHead>
                    <TableHead>Data de Emissão da NF</TableHead> {/* Alterado */}
                    <TableHead>Data de Registro no Sistema</TableHead> {/* Adicionado */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchasedItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.invoice_number || 'N/A'}</TableCell>
                      <TableCell>{item.x_fant || 'N/A'}</TableCell>
                      <TableCell>{item.c_prod}</TableCell>
                      <TableCell>{item.descricao_do_produto}</TableCell>
                      <TableCell>{item.u_com}</TableCell>
                      <TableCell className="text-right">{item.q_com.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{item.v_un_com.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell>{item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</TableCell> {/* Exibe a nova data */}
                      <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell> {/* Mantém a data de criação do registro */}
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

export default AnaliseDeFornecedor;
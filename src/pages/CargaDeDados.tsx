import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createExcelFile, readExcelFile, createEmptyExcelTemplate } from '@/utils/excel';
import { readXmlFile } from '@/utils/xml';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/components/SessionContextProvider';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianFloat, parseBrazilianDate } from '@/lib/utils'; // Importar a nova função de data
import { useQueryClient } from '@tanstack/react-query';

// Interface para os itens comprados diretamente do Supabase (mantida caso seja usada em outro lugar, mas não para preview aqui)
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
  x_fant: string | null;
  invoice_number: string | null;
  invoice_emission_date: string | null; // Adicionado
}

const CargaDeDados: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedXmlFiles, setSelectedXmlFiles] = useState<File[]>([]);
  const [selectedSoldItemsExcelFiles, setSelectedSoldItemsExcelFiles] = useState<File[]>([]);
  const [selectedProductRecipeExcelFile, setSelectedProductRecipeExcelFile] = useState<File | null>(null);
  const [selectedProductNameConversionExcelFile, setSelectedProductNameConversionExcelFile] = useState<File | null>(null);
  const [selectedUnitConversionExcelFile, setSelectedUnitConversionExcelFile] = useState<File | null>(null);

  // Novo estado para a pré-visualização dos dados de produtos vendidos
  const [loadedSoldItemsPreview, setLoadedSoldItemsPreview] = useState<Record<string, any[] | null>>({});
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  // ATUALIZADO: Novos cabeçalhos para produtos vendidos
  const soldItemsTemplateHeaders = ['Data', 'Codigo Produto', 'Produtos Ajustados', 'VALOR AJUSTADO', 'QTDE AJUSTADO', 'Adicional'];
  const productRecipeTemplateHeaders = ['Produto Vendido', 'Nome Interno', 'Quantidade Necessária'];
  const productNameConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Descrição Produto Fornecedor', 'Nome Interno do Produto'];
  const unitConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Descrição Produto Fornecedor', 'Unidade Fornecedor', 'Unidade Interna', 'Fator de Conversão'];

  const handleXmlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedXmlFiles(Array.from(event.target.files));
    } else {
      setSelectedXmlFiles([]);
    }
  };

  const handleSoldItemsExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedSoldItemsExcelFiles(Array.from(event.target.files));
      setLoadedSoldItemsPreview({}); // Limpa a prévia ao selecionar novos arquivos
    } else {
      setSelectedSoldItemsExcelFiles([]);
      setLoadedSoldItemsPreview({}); // Limpa a prévia se nenhum arquivo for selecionado
    }
  };

  const handleProductRecipeExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedProductRecipeExcelFile(event.target.files[0]);
    } else {
      setSelectedProductRecipeExcelFile(null);
    }
  };

  const handleProductNameConversionExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedProductNameConversionExcelFile(event.target.files[0]);
    } else {
      setSelectedProductNameConversionExcelFile(null);
    }
  };

  const handleUnitConversionExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedUnitConversionExcelFile(event.target.files[0]);
    } else {
      setSelectedUnitConversionExcelFile(null);
    }
  };

  const handleUploadXml = async () => {
    if (selectedXmlFiles.length === 0) {
      showError('Por favor, selecione um ou mais arquivos XML para carregar.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar itens comprados.');
      return;
    }

    const loadingToastId = showLoading(`Carregando ${selectedXmlFiles.length} arquivo(s) XML...`);
    let totalItemsLoaded = 0;
    let hasError = false;

    for (const file of selectedXmlFiles) {
      try {
        const data = await readXmlFile(file);

        if (!data || data.length === 0) {
          showError(`O arquivo XML "${file.name}" está vazio ou não contém dados válidos.`);
          hasError = true;
          continue;
        }

        const formattedData = data.map((row: any) => ({
          user_id: user.id,
          c_prod: String(row['ns1:cProd']),
          descricao_do_produto: String(row['descricao_do_produto']),
          u_com: String(row['ns1:uCom']),
          q_com: parseBrazilianFloat(row['ns1:qCom']),
          v_un_com: parseBrazilianFloat(row['ns1:vUnCom']),
          invoice_id: row.invoice_id,
          invoice_number: row.invoice_number,
          item_sequence_number: row.item_sequence_number,
          x_fant: row.x_fant,
          // Formata a data de emissão para YYYY-MM-DD antes de enviar para o Supabase
          invoice_emission_date: row.invoice_emission_date ? format(parseISO(row.invoice_emission_date), 'yyyy-MM-dd') : null,
        }));

        const { error } = await supabase
          .from('purchased_items')
          .upsert(formattedData, { onConflict: 'user_id, invoice_id, item_sequence_number', ignoreDuplicates: true });

        if (error) {
          showError(`Erro ao carregar dados do XML "${file.name}": ${error.message}`);
          hasError = true;
          continue;
        }

        totalItemsLoaded += formattedData.length;
        showSuccess(`Dados de ${formattedData.length} itens de "${file.name}" carregados com sucesso!`);
      } catch (error: any) {
        showError(`Erro ao carregar dados do XML "${file.name}": ${error.message || 'Verifique o console para mais detalhes.'}`);
        hasError = true;
      }
    }

    dismissToast(loadingToastId);

    if (!hasError) {
      showSuccess(`Carga de ${selectedXmlFiles.length} arquivo(s) XML concluída. Total de ${totalItemsLoaded} itens carregados.`);
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] }); // Invalida a query da Análise de Fornecedor
    } else {
      showError('Carga de XML concluída com alguns erros. Verifique as mensagens acima.');
    }
    setSelectedXmlFiles([]);
  };

  const handleUploadSoldItemsExcel = async () => {
    if (selectedSoldItemsExcelFiles.length === 0) {
      showError('Por favor, selecione um ou mais arquivos Excel para carregar produtos vendidos.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar produtos vendidos.');
      return;
    }

    const loadingToastId = showLoading(`Carregando ${selectedSoldItemsExcelFiles.length} arquivo(s) Excel de produtos vendidos...`);
    let totalItemsLoaded = 0;
    let hasError = false;
    const datesToProcess = new Set<string>(); // Para rastrear as datas únicas na carga
    const allFormattedData: any[] = []; // Para acumular todos os dados formatados de todos os arquivos
    const currentFilesData: Record<string, any[]> = {}; // Para a pré-visualização

    for (const file of selectedSoldItemsExcelFiles) {
      try {
        // Lendo o arquivo Excel
        const data = await readExcelFile(file);
        currentFilesData[file.name] = data; // Armazena para pré-visualização

        const fileFormattedData = data.map((row: any) => {
          const saleDateString = parseBrazilianDate(row['Data']);
          if (!saleDateString) {
            throw new Error(`Data inválida "${row['Data']}" encontrada no arquivo "${file.name}". Certifique-se de que está no formato DD/MM/YYYY.`);
          }
          datesToProcess.add(saleDateString); // Adiciona a data ao conjunto de datas a serem processadas

          const quantity = parseBrazilianFloat(row['QTDE AJUSTADO']) || 0;
          const totalValue = parseBrazilianFloat(row['VALOR AJUSTADO']) || 0;
          const calculatedUnitPrice = quantity > 0 ? totalValue / quantity : 0;

          const formattedItem = {
            user_id: user.id,
            sale_date: saleDateString, // Inserir como string YYYY-MM-DD
            group_name: String(row['Adicional'] || ''), // Mapeando 'Adicional' para 'group_name'
            subgroup_name: null, // Subgrupo não está presente nos novos cabeçalhos
            additional_code: String(row['Codigo Produto'] || ''), // Mapeando 'Codigo Produto' para 'additional_code'
            base_product_name: String(row['Produtos Ajustados'] || ''), // 'Produtos Ajustados' do Excel
            product_name: String(row['Produtos Ajustados']), // 'Produtos Ajustados' do Excel, usado como nome principal
            quantity_sold: quantity,
            unit_price: calculatedUnitPrice,
            total_value_sold: totalValue,
          };
          return formattedItem;
        });
        
        allFormattedData.push(...fileFormattedData); // Acumula dados de todos os arquivos

      } catch (error: any) {
        showError(`Erro ao carregar dados de produtos vendidos do Excel "${file.name}": ${error.message || 'Verifique o console para mais detalhes.'}`);
        hasError = true;
      }
    }

    setLoadedSoldItemsPreview(currentFilesData); // Atualiza o estado de pré-visualização

    // Se houve erros durante a leitura dos arquivos, para a execução aqui.
    if (hasError) {
      dismissToast(loadingToastId);
      showError('Carga de produtos vendidos concluída com alguns erros durante a leitura dos arquivos. Verifique as mensagens acima.');
      setSelectedSoldItemsExcelFiles([]);
      return;
    }

    // --- Lógica de exclusão por data (agora fora do loop de arquivos) ---
    // Deleta todos os itens vendidos para as datas encontradas nos arquivos carregados
    for (const dateString of datesToProcess) {
      // Primeiro, verifica se existem registros para esta data e usuário
      const { count, error: countError } = await supabase
        .from('sold_items')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('sale_date', dateString); // Usar eq diretamente com a string YYYY-MM-DD

      if (countError) {
        showError(`Erro ao verificar produtos vendidos existentes para a data ${dateString}: ${countError.message}`);
        hasError = true;
        continue; // Pula a exclusão para esta data se não puder verificar
      }

      if (count && count > 0) { // Se existirem itens, procede com a exclusão e o aviso
        const { error: deleteError } = await supabase
          .from('sold_items')
          .delete()
          .eq('user_id', user.id)
          .eq('sale_date', dateString); // Usar eq diretamente com a string YYYY-MM-DD

        if (deleteError) {
          showError(`Erro ao limpar produtos vendidos para a data ${dateString}: ${deleteError.message}`);
          hasError = true;
        } else {
          showWarning(`Produtos vendidos existentes para a data ${format(parseISO(dateString), 'dd/MM/yyyy')} foram removidos.`);
        }
      }
    }
    // --- Fim da lógica de exclusão por data ---

    // Se houve erros durante a exclusão, para a execução aqui.
    if (hasError) {
      dismissToast(loadingToastId);
      showError('Carga de produtos vendidos concluída com alguns erros durante a limpeza de dados. Verifique as mensagens acima.');
      setSelectedSoldItemsExcelFiles([]);
      return;
    }

    // Inserir todos os dados formatados de uma vez
    if (allFormattedData.length > 0) {
      const { error: insertError } = await supabase
        .from('sold_items')
        .insert(allFormattedData);

      if (insertError) {
        showError(`Erro ao carregar dados de produtos vendidos para o Supabase: ${insertError.message}`);
        hasError = true;
      } else {
        totalItemsLoaded = allFormattedData.length;
        showSuccess(`Total de ${totalItemsLoaded} produtos vendidos carregados com sucesso!`);
      }
    } else {
      showWarning('Nenhum dado válido para produtos vendidos foi encontrado nos arquivos selecionados.');
    }

    dismissToast(loadingToastId);
    if (!hasError) {
      showSuccess(`Carga de ${selectedSoldItemsExcelFiles.length} arquivo(s) Excel de produtos vendidos concluída. Total de ${totalItemsLoaded} itens carregados.`);
      queryClient.invalidateQueries({ queryKey: ['sold_items'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_sold_products'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['consumed_items_from_sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales_by_date', user?.id] }); // Adicionado para invalidar o cache da página Início
      queryClient.invalidateQueries({ queryKey: ['all_sold_items_raw', user?.id] }); // NOVO: Invalida a query específica da página Inicio
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] }); // Invalida a query da página Produtos Sem Ficha Técnica
    } else {
      showError('Carga de produtos vendidos concluída com alguns erros. Verifique as mensagens acima.');
    }
    setSelectedSoldItemsExcelFiles([]);
  };

  const handleUploadProductRecipeExcel = async () => {
    if (!selectedProductRecipeExcelFile) {
      showError('Por favor, selecione um arquivo Excel para carregar a ficha técnica de produtos.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar a ficha técnica.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados da ficha técnica de produtos do Excel...');

    try {
      const data = await readExcelFile(selectedProductRecipeExcelFile);

      if (!data || data.length === 0) {
        showError('O arquivo Excel da ficha técnica está vazio ou não contém dados válidos.');
        dismissToast(loadingToastId);
        return;
      }

      const formattedData = data.map((row: any) => ({
        user_id: user.id,
        sold_product_name: String(row['Produto Vendido']),
        internal_product_name: String(row['Nome Interno']),
        quantity_needed: parseBrazilianFloat(row['Quantidade Necessária']),
      }));

      const { error } = await supabase
        .from('product_recipes')
        .insert(formattedData);

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} fichas técnicas de produtos do Excel carregados com sucesso!`);
      setSelectedProductRecipeExcelFile(null);
      queryClient.invalidateQueries({ queryKey: ['product_recipes'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_usage'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_recipe_details'] });
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] }); // Invalida a query da página Produtos Sem Ficha Técnica
    } catch (error: any) {
      showError(`Erro ao carregar dados da ficha técnica de produtos do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleUploadProductNameConversionExcel = async () => {
    if (!selectedProductNameConversionExcelFile) {
      showError('Por favor, selecione um arquivo Excel para carregar as conversões de nomes de produtos.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar conversões de nomes de produtos.');
      return;
    }

    const loadingToastId = showLoading('Carregando conversões de nomes de produtos do Excel...');

    try {
      const data = await readExcelFile(selectedProductNameConversionExcelFile);

      if (!data || data.length === 0) {
        showError('O arquivo Excel de conversões de nomes de produtos está vazio ou não contém dados válidos.');
        dismissToast(loadingToastId);
        return;
      }

      const formattedData = data.map((row: any) => ({
        user_id: user.id,
        supplier_product_code: String(row['Código Fornecedor']),
        supplier_name: String(row['Nome Fornecedor']),
        supplier_product_name: String(row['Descrição Produto Fornecedor']),
        internal_product_name: String(row['Nome Interno do Produto']),
      }));

      const { error } = await supabase
        .from('product_name_conversions')
        .upsert(formattedData, { onConflict: 'user_id, supplier_product_code, supplier_name' });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} conversões de nomes de produtos do Excel carregados com sucesso!`);
      setSelectedProductNameConversionExcelFile(null);
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product_and_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_for_analysis', user?.id] }); // Invalida a query da Análise de Fornecedor
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_stock', user?.id] }); // Invalida a query da Estoque
    } catch (error: any) {
      showError(`Erro ao carregar conversões de nomes de produtos do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleUploadUnitConversionExcel = async () => {
    if (!selectedUnitConversionExcelFile) {
      showError('Por favor, selecione um arquivo Excel para carregar as conversões de unidades.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar conversões de unidades.');
      return;
    }

    const loadingToastId = showLoading('Carregando conversões de unidades do Excel...');

    try {
      const data = await readExcelFile(selectedUnitConversionExcelFile);

      if (!data || data.length === 0) {
        showError('O arquivo Excel de conversões de unidades está vazio ou não contém dados válidos.');
        dismissToast(loadingToastId);
        return;
      }

      const formattedData = data.map((row: any) => ({
        user_id: user.id,
        supplier_product_code: String(row['Código Fornecedor']),
        supplier_name: String(row['Nome Fornecedor']),
        supplier_product_description: String(row['Descrição Produto Fornecedor']),
        supplier_unit: String(row['Unidade Fornecedor']),
        internal_unit: String(row['Unidade Interna']),
        conversion_factor: parseBrazilianFloat(row['Fator de Conversão']),
      }));

      const { error } = await supabase
        .from('unit_conversions')
        .upsert(formattedData, { onConflict: 'user_id, supplier_product_code, supplier_name, supplier_unit' });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} conversões de unidades do Excel carregados com sucesso!`);
      setSelectedUnitConversionExcelFile(null);
      queryClient.invalidateQueries({ queryKey: ['unit_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_unit_conversions_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
    } catch (error: any) {
      showError(`Erro ao carregar conversões de unidades do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadSoldItemsTemplate = () => {
    const blob = createEmptyExcelTemplate(soldItemsTemplateHeaders, 'Template_ProdutosVendidos');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_produtos_vendidos.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de produtos vendidos baixado com sucesso!');
  };

  const handleDownloadProductRecipeTemplate = () => {
    const blob = createEmptyExcelTemplate(productRecipeTemplateHeaders, 'Template_FichaTecnica');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_ficha_tecnica.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de ficha técnica de produtos baixado com sucesso!');
  };

  const handleDownloadProductNameConversionTemplate = () => {
    const blob = createEmptyExcelTemplate(productNameConversionTemplateHeaders, 'Template_ConversaoNomes');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_conversao_nomes_produtos.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de conversão de nomes de produtos baixado com sucesso!');
  };

  const handleDownloadUnitConversionTemplate = () => {
    const blob = createEmptyExcelTemplate(unitConversionTemplateHeaders, 'Template_ConversaoUnidades');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_conversao_unidades.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de conversão de unidades baixado com sucesso!');
  };

  const handleDownloadAllPurchasedItems = async () => {
    const loadingToastId = showLoading('Baixando todos os itens comprados...');
    try {
      const { data, error } = await supabase
        .from('purchased_items')
        .select('*')
        .eq('user_id', user?.id) // Filtrar por user_id
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhum item comprado encontrado para baixar.');
        return;
      }

      const headers = [
        'ID do Item',
        'Código Fornecedor',
        'Descrição do Produto',
        'Unidade',
        'Quantidade',
        'Valor Unitário',
        'Nome Interno',
        'Nome Fantasia Fornecedor',
        'Número da Nota (Sequencial)',
        'ID da Nota (Chave de Acesso)',
        'Número do Item na Nota',
        'Data de Emissão da NF', // Adicionado
        'Data de Registro no Sistema', // Renomeado para clareza
      ];

      const formattedData = data.map(item => ({
        'ID do Item': item.id,
        'Código Fornecedor': item.c_prod,
        'Descrição do Produto': item.descricao_do_produto,
        'Unidade': item.u_com,
        'Quantidade': item.q_com,
        'Valor Unitário': item.v_un_com,
        'Nome Interno': item.internal_product_name || 'Não Mapeado',
        'Nome Fantasia Fornecedor': item.x_fant || 'N/A',
        'Número da Nota (Sequencial)': item.invoice_number || 'N/A',
        'ID da Nota (Chave de Acesso)': item.invoice_id || 'N/A',
        'Número do Item na Nota': item.item_sequence_number || 'N/A',
        'Data de Emissão da NF': item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A', // Usando a nova coluna, formatada sem hora
        'Data de Registro no Sistema': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }), // Mantendo created_at para registro no sistema
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
      showSuccess(`Dados de ${data.length} itens comprados detalhados baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar itens comprados: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllSoldItems = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar produtos vendidos.');
      return;
    }
    const loadingToastId = showLoading('Baixando todos os produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('sold_items')
        .select('*')
        .eq('user_id', user.id)
        .order('sale_date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhum produto vendido encontrado para baixar.');
        return;
      }

      // ATUALIZADO: Novos cabeçalhos para exportação de produtos vendidos
      const headers = [
        'Data',
        'Codigo Produto',
        'Produtos Ajustados',
        'VALOR AJUSTADO',
        'QTDE AJUSTADO',
        'Adicional',
        'Valor Unitário Calculado', // Adicionado para clareza
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'Data': format(parseISO(item.sale_date), 'dd/MM/yyyy', { locale: ptBR }),
        'Codigo Produto': item.additional_code || 'N/A',
        'Produtos Ajustados': item.product_name,
        'VALOR AJUSTADO': item.total_value_sold,
        'QTDE AJUSTADO': item.quantity_sold,
        'Adicional': item.group_name || 'N/A',
        'Valor Unitário Calculado': item.unit_price,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));

      const blob = createExcelFile(formattedData, headers, 'ProdutosVendidosDetalhado');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'produtos_vendidos_detalhado.xlsx';
      document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} produtos vendidos detalhados baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar produtos vendidos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllProductRecipes = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar fichas técnicas.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as fichas técnicas de produtos...');
    try {
      const { data, error } = await supabase
        .from('product_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('sold_product_name', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhuma ficha técnica de produto encontrada para baixar.');
        return;
      }

      const headers = [
        'ID da Ficha Técnica',
        'Produto Vendido',
        'Nome Interno',
        'Quantidade Necessária',
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'ID da Ficha Técnica': item.id,
        'Produto Vendido': item.sold_product_name,
        'Nome Interno': item.internal_product_name,
        'Quantidade Necessária': item.quantity_needed,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));

      const blob = createExcelFile(formattedData, headers, 'FichaTecnicaDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ficha_tecnica_detalhada.xlsx';
      document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} fichas técnicas detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar fichas técnicas de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllProductNameConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar conversões de nomes de produtos.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as conversões de nomes de produtos...');
    try {
      const { data, error } = await supabase
        .from('product_name_conversions')
        .select('*')
        .eq('user_id', user.id)
        .order('supplier_name', { ascending: true })
        .order('supplier_product_code', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhuma conversão de nome de produto encontrada para baixar.');
        return;
      }

      const headers = [
        'ID da Conversão',
        'Código Fornecedor',
        'Nome Fornecedor',
        'Descrição Produto Fornecedor',
        'Nome Interno do Produto',
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'ID da Conversão': item.id,
        'Código Fornecedor': item.supplier_product_code,
        'Nome Fornecedor': item.supplier_name,
        'Descrição Produto Fornecedor': item.supplier_product_name,
        'Nome Interno do Produto': item.internal_product_name,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));

      const blob = createExcelFile(formattedData, headers, 'ConversaoNomesProdutosDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversao_nomes_produtos_detalhada.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} conversões de nomes de produtos detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar conversões de nomes de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllUnitConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar conversões de unidades.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as conversões de unidades...');
    try {
      const { data, error } = await supabase
        .from('unit_conversions')
        .select('*')
        .eq('user_id', user.id)
        .order('supplier_name', { ascending: true })
        .order('supplier_product_code', { ascending: true })
        .order('supplier_unit', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhuma conversão de unidade encontrada para baixar.');
        return;
      }

      const headers = [
        'ID da Conversão',
        'Código Fornecedor',
        'Nome Fornecedor',
        'Descrição Produto Fornecedor',
        'Unidade Fornecedor',
        'Unidade Interna',
        'Fator de Conversão',
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'ID da Conversão': item.id,
        'Código Fornecedor': item.supplier_product_code,
        'Nome Fornecedor': item.supplier_name,
        'Descrição Produto Fornecedor': item.supplier_product_description || 'N/A',
        'Unidade Fornecedor': item.supplier_unit,
        'Unidade Interna': item.internal_unit,
        'Fator de Conversão': item.conversion_factor,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));

      const blob = createExcelFile(formattedData, headers, 'ConversaoUnidadesDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversao_unidades_detalhada.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} conversões de unidades detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearPurchasedItems = async () => {
    const loadingToastId = showLoading('Limpando todos os itens comprados...');
    try {
      const { error } = await supabase
        .from('purchased_items')
        .delete()
        .eq('user_id', user?.id); // Deleta apenas os registros do usuário logado

      if (error) throw error;

      showSuccess('Todos os itens comprados foram removidos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] }); // Invalida a query da Análise de Fornecedor
    } catch (error: any) {
      showError(`Erro ao limpar itens comprados: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearSoldItems = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar produtos vendidos.');
      return;
    }
    const loadingToastId = showLoading('Limpando todos os produtos vendidos...');
    try {
      const { error } = await supabase
        .from('sold_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess('Todos os produtos vendidos foram removidos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sold_items'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_sold_products'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['consumed_items_from_sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales_by_date', user?.id] }); // Adicionado para invalidar o cache da página Início
      queryClient.invalidateQueries({ queryKey: ['all_sold_items_raw', user?.id] }); // NOVO: Invalida a query específica da página Inicio
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] }); // Invalida a query da página Produtos Sem Ficha Técnica
    } catch (error: any) {
      showError(`Erro ao limpar produtos vendidos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearProductRecipes = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar fichas técnicas.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as fichas técnicas de produtos...');
    try {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess('Todas as fichas técnicas de produtos foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['product_recipes'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_usage'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_recipe_details'] });
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] }); // Invalida a query da página Produtos Sem Ficha Técnica
    } catch (error: any) {
      showError(`Erro ao limpar fichas técnicas de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearProductNameConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar conversões de nomes de produtos.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as conversões de nomes de produtos...');
    try {
      const { error } = await supabase
        .from('product_name_conversions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess('Todas as conversões de nomes de produtos foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product_and_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_for_analysis', user?.id] }); // Invalida a query da Análise de Fornecedor
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_stock', user?.id] }); // Invalida a query da Estoque
    } catch (error: any) {
      showError(`Erro ao limpar conversões de nomes de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearUnitConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar conversões de unidades.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as conversões de unidades...');
    try {
      const { error } = await supabase
        .from('unit_conversions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      showSuccess('Todas as conversões de unidades foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['unit_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_unit_conversions_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
    } catch (error: any) {
      showError(`Erro ao limpar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // Extrai os cabeçalhos de forma dinâmica do primeiro item, se houver
  const getTableHeaders = (data: any[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Carga de Dados
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Gerencie a importação e exportação de dados para o sistema através de arquivos Excel ou XML.
      </p>

      <Tabs defaultValue="xml-purchased" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="xml-purchased">Itens Comprados (XML)</TabsTrigger>
          <TabsTrigger value="excel-sold">Produtos Vendidos (Excel)</TabsTrigger>
          <TabsTrigger value="excel-product-recipe">Ficha Técnica (Excel)</TabsTrigger>
          <TabsTrigger value="excel-conversions">Conversões (Excel)</TabsTrigger>
        </TabsList>

        <TabsContent value="xml-purchased" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (XML)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um ou mais arquivos XML (.xml) contendo os itens comprados.
              O sistema tentará extrair o ID da nota fiscal (chave de acesso) e o número sequencial da nota,
              além do número do item para evitar duplicações. A data de emissão da NF será armazenada sem a hora.
            </p>

            <div className="flex flex-col space-y-2">
              <Label htmlFor="xml-file-upload">Selecionar arquivos XML</Label>
              <Input
                id="xml-file-upload"
                type="file"
                accept=".xml"
                multiple
                onChange={handleXmlFileChange}
                className="flex-grow"
              />
              {selectedXmlFiles.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedXmlFiles.length} arquivo(s) selecionado(s): {selectedXmlFiles.map(f => f.name).join(', ')}
                </p>
              )}
              <Button onClick={handleUploadXml} disabled={selectedXmlFiles.length === 0}>
                Carregar XML(s)
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="excel-sold" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Produtos Vendidos (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um ou mais arquivos Excel (.xlsx) contendo os produtos vendidos.
              O arquivo deve conter as colunas: <code>Data</code> (DD/MM/YYYY), <code>Codigo Produto</code>, <code>Produtos Ajustados</code>, <code>VALOR AJUSTADO</code>, <code>QTDE AJUSTADO</code> e <code>Adicional</code>.
              Para cada data encontrada nos arquivos carregados, todos os produtos vendidos existentes para essa data no banco de dados serão **removidos** e substituídos pelos dados dos arquivos carregados **nesta operação** que correspondem a essa data. Se você carregar um arquivo para uma data já existente, os dados anteriores para essa data serão perdidos e substituídos.
            </p>

            <div className="flex flex-col space-y-2">
              <Label htmlFor="sold-items-excel-file-upload">Selecionar arquivos Excel</Label>
              <Input
                id="sold-items-excel-file-upload"
                type="file"
                accept=".xlsx, .xls, .csv"
                multiple
                onChange={handleSoldItemsExcelFileChange}
                className="flex-grow"
              />
              {selectedSoldItemsExcelFiles.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedSoldItemsExcelFiles.length} arquivo(s) selecionado(s): {selectedSoldItemsExcelFiles.map(f => f.name).join(', ')}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleUploadSoldItemsExcel} disabled={selectedSoldItemsExcelFiles.length === 0}>
                  Carregar Produtos Vendidos
                </Button>
                <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      disabled={Object.keys(loadedSoldItemsPreview).length === 0 && selectedSoldItemsExcelFiles.length === 0}
                      onClick={() => setIsPreviewDialogOpen(true)}
                    >
                      Visualizar Prévia dos Dados
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Prévia dos Dados de Produtos Vendidos</DialogTitle>
                      <DialogDescription>
                        Conteúdo lido dos arquivos Excel selecionados.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-grow pr-4">
                      {Object.keys(loadedSoldItemsPreview).length === 0 ? (
                        <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                          Nenhum dado de prévia disponível. Selecione e carregue arquivos para ver a prévia.
                        </p>
                      ) : (
                        Object.entries(loadedSoldItemsPreview).map(([fileName, data], index) => (
                          <Card key={index} className="mb-6">
                            <CardHeader>
                              <CardTitle className="text-lg">{fileName}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {data && data.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        {getTableHeaders(data).map((header, i) => (
                                          <TableHead key={i}>{header}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {data.map((row, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                          {getTableHeaders(data).map((header, colIndex) => (
                                            <TableCell key={colIndex}>
                                              {typeof row[header] === 'number' 
                                                ? row[header].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                : String(row[header])}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-gray-500 dark:text-gray-400">Nenhum dado encontrado neste arquivo.</p>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Button variant="outline" onClick={handleDownloadSoldItemsTemplate}>
              Baixar Template de Produtos Vendidos (Excel)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="excel-product-recipe" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Ficha Técnica de Produtos (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um arquivo Excel (.xlsx) contendo a ficha técnica dos seus produtos.
              O arquivo deve conter as colunas: <code>Produto Vendido</code>, <code>Nome Interno</code> e <code>Quantidade Necessária</code>.
              Isso define quais produtos internos compõem um produto vendido e em que quantidade.
            </p>

            <div className="flex items-center space-x-2">
              <Input
                id="product-recipe-excel-file-upload"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleProductRecipeExcelFileChange}
                className="flex-grow"
              />
              <Button onClick={handleUploadProductRecipeExcel} disabled={!selectedProductRecipeExcelFile}>
                Carregar Ficha Técnica
              </Button>
            </div>

            <Button variant="outline" onClick={handleDownloadProductRecipeTemplate}>
              Baixar Template de Ficha Técnica (Excel)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="excel-conversions" className="mt-4">
          <div className="space-y-6">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Conversões (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Gerencie as regras de conversão para nomes de produtos e unidades de fornecedores para seus padrões internos.
            </p>

            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Conversão de Nomes de Produtos</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mapeie o código do produto do fornecedor e o nome do fornecedor para um nome de produto interno.
                O arquivo deve conter as colunas: <code>Código Fornecedor</code>, <code>Nome Fornecedor</code>, <code>Descrição Produto Fornecedor</code> e <code>Nome Interno do Produto</code>.
              </p>
              <div className="flex items-center space-x-2">
                <Input
                  id="product-name-conversion-excel-file-upload"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleProductNameConversionExcelFileChange}
                  className="flex-grow"
                />
                <Button onClick={handleUploadProductNameConversionExcel} disabled={!selectedProductNameConversionExcelFile}>
                  Carregar Conversões de Nomes
                </Button>
              </div>
              <Button variant="outline" onClick={handleDownloadProductNameConversionTemplate}>
                Baixar Template de Conversão de Nomes
              </Button>
            </div>

            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Conversão de Unidades</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mapeie a unidade do fornecedor para uma unidade interna, com um fator de conversão.
                O arquivo deve conter as colunas: <code>Código Fornecedor</code>, <code>Nome Fornecedor</code>, <code>Descrição Produto Fornecedor</code>, <code>Unidade Fornecedor</code>, <code>Unidade Interna</code> e <code>Fator de Conversão</code>.
              </p>
              <div className="flex items-center space-x-2">
                <Input
                  id="unit-conversion-excel-file-upload"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleUnitConversionExcelFileChange}
                  className="flex-grow"
                />
                <Button onClick={handleUploadUnitConversionExcel} disabled={!selectedUnitConversionExcelFile}>
                  Carregar Conversões de Unidades
                </Button>
              </div>
              <Button variant="outline" onClick={handleDownloadUnitConversionTemplate}>
                Baixar Template de Conversão de Unidades
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Exportar Dados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Baixe todos os itens comprados, vendidos, fichas técnicas ou conversões atualmente no sistema para arquivos Excel.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button onClick={handleDownloadAllPurchasedItems}>
            Baixar Itens Comprados (Excel)
          </Button>
          <Button onClick={handleDownloadAllSoldItems}>
            Baixar Produtos Vendidos (Excel)
          </Button>
          <Button onClick={handleDownloadAllProductRecipes}>
            Baixar Fichas Técnicas (Excel)
          </Button>
          <Button onClick={handleDownloadAllProductNameConversions}>
            Baixar Conversões de Nomes (Excel)
          </Button>
          <Button onClick={handleDownloadAllUnitConversions}>
            Baixar Conversões de Unidades (Excel)
          </Button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Limpeza de Dados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Use esta opção para remover *todos* os itens das tabelas selecionadas. Esta ação é irreversível.
        </p>
        <div className="flex flex-wrap gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todos os Itens Comprados</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todos os itens comprados do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearPurchasedItems} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todos os Produtos Vendidos</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todos os produtos vendidos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearSoldItems} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todas as Fichas Técnicas</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as fichas técnicas de produtos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearProductRecipes} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Conversões de Nomes</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as conversões de nomes de produtos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearProductNameConversions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Conversões de Unidades</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as conversões de unidades do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearUnitConversions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default CargaDeDados;
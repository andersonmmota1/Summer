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
import { useSession } from '@/components/SessionContextProvider';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CargaDeDados: React.FC = () => {
  const { user } = useSession();
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [selectedXmlFiles, setSelectedXmlFiles] = useState<File[]>([]);
  const [selectedSoldItemsExcelFile, setSelectedSoldItemsExcelFile] = useState<File | null>(null);
  const [selectedProductRecipeExcelFile, setSelectedProductRecipeExcelFile] = useState<File | null>(null);
  const [selectedProductNameConversionExcelFile, setSelectedProductNameConversionExcelFile] = useState<File | null>(null);
  const [selectedUnitConversionExcelFile, setSelectedUnitConversionExcelFile] = useState<File | null>(null);


  const purchasedItemsTemplateHeaders = ['ns1:cProd', 'ns1:xProd', 'ns1:uCom', 'ns1:qCom', 'ns1:vUnCom'];
  const soldItemsTemplateHeaders = ['Grupo', 'Subgrupo', 'Codigo', 'Produto', 'Quantidade', 'Valor'];
  const productRecipeTemplateHeaders = ['Produto Vendido', 'Nome Interno', 'Quantidade Necessária'];
  const productNameConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Descrição Produto Fornecedor', 'Nome Interno do Produto'];
  const unitConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Unidade Fornecedor', 'Unidade Interna', 'Fator de Conversão'];


  const handleExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedExcelFile(event.target.files[0]);
    } else {
      setSelectedExcelFile(null);
    }
  };

  const handleXmlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedXmlFiles(Array.from(event.target.files));
    } else {
      setSelectedXmlFiles([]);
    }
  };

  const handleSoldItemsExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedSoldItemsExcelFile(event.target.files[0]);
    } else {
      setSelectedSoldItemsExcelFile(null);
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

  const handleUploadExcel = async () => {
    if (!selectedExcelFile) {
      showError('Por favor, selecione um arquivo Excel para carregar.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados do Excel...');

    try {
      const data = await readExcelFile(selectedExcelFile);

      if (!data || data.length === 0) {
        showError('O arquivo Excel está vazio ou não contém dados válidos.');
        dismissToast(loadingToastId);
        return;
      }

      const formattedData = data.map((row: any) => ({
        c_prod: String(row['ns1:cProd']),
        descricao_do_produto: String(row['ns1:xProd']),
        u_com: String(row['ns1:uCom']),
        q_com: parseFloat(row['ns1:qCom']),
        v_un_com: parseFloat(row['ns1:vUnCom']),
      }));

      const { error } = await supabase
        .from('purchased_items')
        .insert(formattedData);

      if (error) {
        console.error('Erro detalhado do Supabase (Excel):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} itens comprados do Excel carregados com sucesso!`);
      setSelectedExcelFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar dados do Excel:', error);
      showError(`Erro ao carregar dados do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleUploadXml = async () => {
    if (selectedXmlFiles.length === 0) {
      showError('Por favor, selecione um ou mais arquivos XML para carregar.');
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
          c_prod: String(row['ns1:cProd']),
          descricao_do_produto: String(row['descricao_do_produto']),
          u_com: String(row['ns1:uCom']),
          q_com: parseFloat(row['ns1:qCom']),
          v_un_com: parseFloat(row['ns1:vUnCom']),
          invoice_id: row.invoice_id,
          item_sequence_number: row.item_sequence_number,
          x_fant: row.x_fant,
        }));

        const { error } = await supabase
          .from('purchased_items')
          .upsert(formattedData, { onConflict: 'invoice_id, item_sequence_number', ignoreDuplicates: true });

        if (error) {
          console.error(`Erro detalhado do Supabase ao carregar "${file.name}" (XML):`, error);
          showError(`Erro ao carregar dados do XML "${file.name}": ${error.message}`);
          hasError = true;
          continue;
        }

        totalItemsLoaded += formattedData.length;
        showSuccess(`Dados de ${formattedData.length} itens de "${file.name}" carregados com sucesso!`);
      } catch (error: any) {
        console.error(`Erro ao carregar dados do XML "${file.name}":`, error);
        showError(`Erro ao carregar dados do XML "${file.name}": ${error.message || 'Verifique o console para mais detalhes.'}`);
        hasError = true;
      }
    }

    dismissToast(loadingToastId);
    if (!hasError) {
      showSuccess(`Carga de ${selectedXmlFiles.length} arquivo(s) XML concluída. Total de ${totalItemsLoaded} itens carregados.`);
    } else {
      showError('Carga de XML concluída com alguns erros. Verifique as mensagens acima.');
    }
    setSelectedXmlFiles([]);
  };

  const handleUploadSoldItemsExcel = async () => {
    if (!selectedSoldItemsExcelFile) {
      showError('Por favor, selecione um arquivo Excel para carregar produtos vendidos.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar produtos vendidos.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados de produtos vendidos do Excel...');

    try {
      const data = await readExcelFile(selectedSoldItemsExcelFile);

      if (!data || data.length === 0) {
        showError('O arquivo Excel de produtos vendidos está vazio ou não contém dados válidos.');
        dismissToast(loadingToastId);
        return;
      }

      let fileDate: Date | null = null;
      const fileName = selectedSoldItemsExcelFile.name;
      // Regex para encontrar DD.MM.YYYY no nome do arquivo
      const dateMatch = fileName.match(/(\d{2})\.(\d{2})\.(\d{4})/);

      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1; // Mês é 0-indexado em JS Date
        const year = parseInt(dateMatch[3], 10);
        const parsedDate = new Date(year, month, day);

        // Validação básica para garantir que é uma data válida
        if (!isNaN(parsedDate.getTime()) && parsedDate.getDate() === day && parsedDate.getMonth() === month && parsedDate.getFullYear() === year) {
          fileDate = parsedDate;
          showSuccess(`Data "${format(fileDate, 'dd/MM/yyyy', { locale: ptBR })}" extraída do nome do arquivo e será usada para as vendas.`);
        } else {
          showWarning(`Não foi possível validar a data no nome do arquivo "${fileName}". Tentando usar a data atual.`);
        }
      } else {
        showWarning(`Nenhuma data no formato DD.MM.YYYY encontrada no nome do arquivo "${fileName}". Usando a data atual.`);
      }

      const formattedData = data.map((row: any) => {
        let saleDate: string;
        if (fileDate) {
          saleDate = fileDate.toISOString(); // Prioriza a data do nome do arquivo
        } else {
          saleDate = new Date().toISOString(); // Padrão para a data atual
        }

        const totalValue = Number(row['Valor']) || 0;
        const quantity = Number(row['Quantidade']) || 0;
        
        // Calcula o preço unitário médio: Valor Total / Quantidade
        const calculatedUnitPrice = quantity > 0 ? totalValue / quantity : 0;

        return {
          user_id: user.id,
          product_name: String(row['Produto']),
          quantity_sold: quantity, // Quantidade vendida
          unit_price: calculatedUnitPrice, // Preço unitário médio calculado
          sale_date: saleDate,
        };
      });

      const { error } = await supabase
        .from('sold_items')
        .insert(formattedData);

      if (error) {
        console.error('Erro detalhado do Supabase (Produtos Vendidos Excel):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} produtos vendidos do Excel carregados com sucesso!`);
      setSelectedSoldItemsExcelFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar dados de produtos vendidos do Excel:', error);
      showError(`Erro ao carregar dados de produtos vendidos do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
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
        quantity_needed: parseFloat(row['Quantidade Necessária']),
      }));

      const { error } = await supabase
        .from('product_recipes')
        .insert(formattedData);

      if (error) {
        console.error('Erro detalhado do Supabase (Ficha Técnica Excel):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} fichas técnicas de produtos do Excel carregados com sucesso!`);
      setSelectedProductRecipeExcelFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar dados da ficha técnica de produtos do Excel:', error);
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
        .upsert(formattedData, { onConflict: 'user_id, supplier_product_code, supplier_name' }); // Upsert para evitar duplicatas

      if (error) {
        console.error('Erro detalhado do Supabase (Conversão de Nomes Excel):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} conversões de nomes de produtos do Excel carregados com sucesso!`);
      setSelectedProductNameConversionExcelFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar conversões de nomes de produtos do Excel:', error);
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
        supplier_unit: String(row['Unidade Fornecedor']),
        internal_unit: String(row['Unidade Interna']),
        conversion_factor: parseFloat(row['Fator de Conversão']),
      }));

      const { error } = await supabase
        .from('unit_conversions')
        .upsert(formattedData, { onConflict: 'user_id, supplier_product_code, supplier_name, supplier_unit' }); // Upsert para evitar duplicatas

      if (error) {
        console.error('Erro detalhado do Supabase (Conversão de Unidades Excel):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} conversões de unidades do Excel carregados com sucesso!`);
      setSelectedUnitConversionExcelFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar conversões de unidades do Excel:', error);
      showError(`Erro ao carregar conversões de unidades do Excel: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadPurchasedItemsTemplate = () => {
    const blob = createEmptyExcelTemplate(purchasedItemsTemplateHeaders, 'Template_ItensComprados');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_itens_comprados.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de itens comprados baixado com sucesso!');
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
        'Data da Compra',
        'ID da Nota',
        'Número do Item na Nota',
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
        'Data da Compra': new Date(item.created_at).toLocaleString(),
        'ID da Nota': item.invoice_id || 'N/A',
        'Número do Item na Nota': item.item_sequence_number || 'N/A',
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
      console.error('Erro ao baixar itens comprados:', error);
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
        .eq('user_id', user.id) // Filtrar por user_id
        .order('sale_date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhum produto vendido encontrado para baixar.');
        return;
      }

      const headers = [
        'ID da Venda',
        'Nome do Produto',
        'Quantidade Vendida',
        'Preço Unitário',
        'Data da Venda',
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'ID da Venda': item.id,
        'Nome do Produto': item.product_name,
        'Quantidade Vendida': item.quantity_sold,
        'Preço Unitário': item.unit_price,
        'Data da Venda': new Date(item.sale_date).toLocaleString(),
        'Data de Registro': new Date(item.created_at).toLocaleString(),
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
      console.error('Erro ao baixar produtos vendidos:', error);
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
        .eq('user_id', user.id) // Filtrar por user_id
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
        'Data de Registro': new Date(item.created_at).toLocaleString(),
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
      console.error('Erro ao baixar fichas técnicas de produtos:', error);
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
        'Data de Registro': new Date(item.created_at).toLocaleString(),
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
      console.error('Erro ao baixar conversões de nomes de produtos:', error);
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
        'Unidade Fornecedor',
        'Unidade Interna',
        'Fator de Conversão',
        'Data de Registro',
      ];

      const formattedData = data.map(item => ({
        'ID da Conversão': item.id,
        'Código Fornecedor': item.supplier_product_code,
        'Nome Fornecedor': item.supplier_name,
        'Unidade Fornecedor': item.supplier_unit,
        'Unidade Interna': item.internal_unit,
        'Fator de Conversão': item.conversion_factor,
        'Data de Registro': new Date(item.created_at).toLocaleString(),
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
      console.error('Erro ao baixar conversões de unidades:', error);
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
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta todos os registros

      if (error) throw error;

      showSuccess('Todos os itens comprados foram removidos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao limpar itens comprados:', error);
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
        .eq('user_id', user.id); // Deleta apenas os registros do usuário logado

      if (error) throw error;

      showSuccess('Todos os produtos vendidos foram removidos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao limpar produtos vendidos:', error);
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
        .eq('user_id', user.id); // Deleta apenas os registros do usuário logado

      if (error) throw error;

      showSuccess('Todas as fichas técnicas de produtos foram removidas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao limpar fichas técnicas de produtos:', error);
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
    } catch (error: any) {
      console.error('Erro ao limpar conversões de nomes de produtos:', error);
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
    } catch (error: any) {
      console.error('Erro ao limpar conversões de unidades:', error);
      showError(`Erro ao limpar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Carga de Dados
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Gerencie a importação e exportação de dados para o sistema através de arquivos Excel ou XML.
      </p>

      <Tabs defaultValue="excel-purchased" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="excel-purchased">Itens Comprados (Excel)</TabsTrigger>
          <TabsTrigger value="xml-purchased">Itens Comprados (XML)</TabsTrigger>
          <TabsTrigger value="excel-sold">Produtos Vendidos (Excel)</TabsTrigger>
          <TabsTrigger value="excel-product-recipe">Ficha Técnica (Excel)</TabsTrigger>
          <TabsTrigger value="excel-conversions">Conversões (Excel)</TabsTrigger>
        </TabsList>

        <TabsContent value="excel-purchased" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um arquivo Excel (.xlsx) contendo os itens comprados.
              O arquivo deve conter as colunas: <code>ns1:cProd</code>, <code>ns1:xProd</code> (Descrição do Produto), <code>ns1:uCom</code>, <code>ns1:qCom</code>, <code>ns1:vUnCom</code>.
              Atualmente, cada linha do Excel será inserida como um novo registro.
            </p>

            <div className="flex items-center space-x-2">
              <Input
                id="excel-file-upload"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileChange}
                className="flex-grow"
              />
              <Button onClick={handleUploadExcel} disabled={!selectedExcelFile}>
                Carregar Excel
              </Button>
            </div>

            <Button variant="outline" onClick={handleDownloadPurchasedItemsTemplate}>
              Baixar Template de Itens Comprados (Excel)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="xml-purchased" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (XML)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um ou mais arquivos XML (.xml) contendo os itens comprados.
              O sistema tentará extrair o ID da nota fiscal e o número do item para evitar duplicações.
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
              Faça o upload de um arquivo Excel (.xlsx) contendo os produtos vendidos.
              O arquivo deve conter as colunas: <code>Grupo</code>, <code>Subgrupo</code>, <code>Codigo</code>, <code>Produto</code>, <code>Quantidade</code> e <code>Valor</code>.
              A coluna <code>Valor</code> será tratada como o valor total da venda para a <code>Quantidade</code> informada, e o preço unitário será calculado como <code>Valor / Quantidade</code>.
              A data da venda será extraída do nome do arquivo (formato <code>DD.MM.YYYY</code>, ex: "VENDAS 01.11.2025"). Se nenhuma data for encontrada no nome do arquivo, a data atual será usada.
            </p>

            <div className="flex items-center space-x-2">
              <Input
                id="sold-items-excel-file-upload"
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleSoldItemsExcelFileChange}
                className="flex-grow"
              />
              <Button onClick={handleUploadSoldItemsExcel} disabled={!selectedSoldItemsExcelFile}>
                Carregar Produtos Vendidos
              </Button>
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

            {/* Seção de Conversão de Nomes de Produtos */}
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

            {/* Seção de Conversão de Unidades */}
            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Conversão de Unidades</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mapeie a unidade do fornecedor para uma unidade interna, com um fator de conversão.
                O arquivo deve conter as colunas: <code>Código Fornecedor</code>, <code>Nome Fornecedor</code>, <code>Unidade Fornecedor</code>, <code>Unidade Interna</code> e <code>Fator de Conversão</code>.
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
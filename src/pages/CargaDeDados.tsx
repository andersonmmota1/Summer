import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createExcelFile, readExcelFile, createEmptyExcelTemplate } from '@/utils/excel';
import { readXmlFile } from '@/utils/xml';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

const CargaDeDados: React.FC = () => {
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [selectedXmlFiles, setSelectedXmlFiles] = useState<File[]>([]);
  const templateHeaders = ['ns1:cProd', 'ns1:xProd', 'ns1:uCom', 'ns1:qCom', 'ns1:vUnCom'];

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
        x_prod: String(row['ns1:xProd']),
        u_com: String(row['ns1:uCom']),
        q_com: parseFloat(row['ns1:qCom']),
        v_un_com: parseFloat(row['ns1:vUnCom']),
      }));

      const { error } = await supabase.from('purchased_items').insert(formattedData);

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
          x_prod: String(row['ns1:xProd']),
          u_com: String(row['ns1:uCom']),
          q_com: parseFloat(row['ns1:qCom']),
          v_un_com: parseFloat(row['ns1:vUnCom']),
        }));

        const { error } = await supabase.from('purchased_items').insert(formattedData);

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

  const handleDownloadTemplate = () => {
    const blob = createEmptyExcelTemplate(templateHeaders, 'Template_ItensComprados');
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

  const handleDownloadAllPurchasedItems = async () => {
    const loadingToastId = showLoading('Baixando todos os itens comprados...');
    try {
      // Consulta para agrupar e somar quantidades de itens comprados
      // O PostgREST (Supabase) infere o GROUP BY automaticamente pelas colunas não agregadas
      const { data, error } = await supabase
        .from('purchased_items')
        .select(`
          c_prod,
          x_prod,
          u_com,
          v_un_com,
          internal_product_name,
          q_com:sum(q_com),
          latest_created_at:max(created_at)
        `)
        .order('x_prod', { ascending: true }); // Ordenar para melhor visualização


      if (error) throw error;

      if (!data || data.length === 0) {
        showError('Nenhum item comprado encontrado para baixar.');
        return;
      }

      const headers = [
        'Código Fornecedor',
        'Descrição do Produto',
        'Unidade',
        'Quantidade Total',
        'Valor Unitário',
        'Nome Interno',
        'Última Compra',
      ];

      const formattedData = data.map(item => ({
        'Código Fornecedor': item.c_prod,
        'Descrição do Produto': item.x_prod,
        'Unidade': item.u_com,
        'Quantidade Total': item.q_com,
        'Valor Unitário': item.v_un_com,
        'Nome Interno': item.internal_product_name || 'Não Mapeado',
        'Última Compra': new Date(item.latest_created_at).toLocaleString(),
      }));

      const blob = createExcelFile(formattedData, headers, 'ItensCompradosAgregados');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'itens_comprados_agregados.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} itens comprados agregados baixados com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao baixar itens comprados:', error);
      showError(`Erro ao baixar itens comprados: ${error.message || 'Verifique o console para mais detalhes.'}`);
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
        Gerencie a importação de dados para o sistema através de arquivos Excel ou XML.
      </p>

      <Tabs defaultValue="excel" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="excel">Carga de Excel</TabsTrigger>
          <TabsTrigger value="xml">Carga de XML</TabsTrigger>
        </TabsList>
        <TabsContent value="excel" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um arquivo Excel (.xlsx) contendo os itens comprados.
              O arquivo deve conter as colunas: <code>ns1:cProd</code>, <code>ns1:xProd</code> (Descrição do Produto), <code>ns1:uCom</code>, <code>ns1:qCom</code>, <code>ns1:vUnCom</code>.
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

            <Button variant="outline" onClick={handleDownloadTemplate}>
              Baixar Template de Itens Comprados (Excel)
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="xml" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (XML)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um ou mais arquivos XML (.xml) contendo os itens comprados.
              O sistema tentará extrair dados de tags como <code>&lt;det&gt;</code> ou elementos que contenham <code>&lt;cProd&gt;</code>, <code>&lt;xProd&gt;</code> (Descrição do Produto), <code>&lt;uCom&gt;</code>, <code>&lt;qCom&gt;</code>, <code>&lt;vUnCom&gt;</code>.
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
      </Tabs>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Exportar Dados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Baixe todos os itens comprados atualmente no sistema para um arquivo Excel.
        </p>
        <Button onClick={handleDownloadAllPurchasedItems}>
          Baixar Itens Comprados (Excel)
        </Button>
      </div>
    </div>
  );
};

export default CargaDeDados;
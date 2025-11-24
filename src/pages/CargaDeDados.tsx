import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readExcelFile, createExcelTemplate } from '@/utils/excel';
import { readXmlFile } from '@/utils/xml'; // Importar o utilitário XML
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Importar componentes Tabs

const CargaDeDados: React.FC = () => {
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [selectedXmlFile, setSelectedXmlFile] = useState<File | null>(null);
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
      setSelectedXmlFile(event.target.files[0]);
    } else {
      setSelectedXmlFile(null);
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
    if (!selectedXmlFile) {
      showError('Por favor, selecione um arquivo XML para carregar.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados do XML...');

    try {
      const data = await readXmlFile(selectedXmlFile);

      if (!data || data.length === 0) {
        showError('O arquivo XML está vazio ou não contém dados válidos.');
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
        console.error('Erro detalhado do Supabase (XML):', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} itens comprados do XML carregados com sucesso!`);
      setSelectedXmlFile(null);
    } catch (error: any) {
      console.error('Erro ao carregar dados do XML:', error);
      showError(`Erro ao carregar dados do XML: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = createExcelTemplate(templateHeaders, 'Template_ItensComprados');
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
              O arquivo deve conter as colunas: <code>ns1:cProd</code>, <code>ns1:xProd</code>, <code>ns1:uCom</code>, <code>ns1:qCom</code>, <code>ns1:vUnCom</code>.
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
              Faça o upload de um arquivo XML (.xml) contendo os itens comprados.
              O sistema tentará extrair dados de tags como <code>&lt;det&gt;</code> ou elementos que contenham <code>&lt;cProd&gt;</code>, <code>&lt;xProd&gt;</code>, <code>&lt;uCom&gt;</code>, <code>&lt;qCom&gt;</code>, <code>&lt;vUnCom&gt;</code>.
            </p>

            <div className="flex items-center space-x-2">
              <Input
                id="xml-file-upload"
                type="file"
                accept=".xml"
                onChange={handleXmlFileChange}
                className="flex-grow"
              />
              <Button onClick={handleUploadXml} disabled={!selectedXmlFile}>
                Carregar XML
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CargaDeDados;
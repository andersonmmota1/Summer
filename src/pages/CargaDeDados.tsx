import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readExcelFile, createExcelTemplate } from '@/utils/excel';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

const CargaDeDados: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const templateHeaders = ['ns1:cProd', 'ns1:xProd', 'ns1:uCom', 'ns1:qCom', 'ns1:vUnCom'];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showError('Por favor, selecione um arquivo Excel para carregar.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados...');

    try {
      const data = await readExcelFile(selectedFile);

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
        // Log do erro completo para depuração
        console.error('Erro detalhado do Supabase:', error);
        throw new Error(error.message);
      }

      showSuccess(`Dados de ${formattedData.length} itens comprados carregados com sucesso!`);
      setSelectedFile(null); // Clear selected file after successful upload
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      showError(`Erro ao carregar dados: ${error.message || 'Verifique o console para mais detalhes.'}`);
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
        Gerencie a importação de dados para o sistema.
      </p>

      <div className="space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Faça o upload de um arquivo Excel (.xlsx) contendo os itens comprados.
          O arquivo deve conter as colunas: <code>ns1:cProd</code>, <code>ns1:xProd</code>, <code>ns1:uCom</code>, <code>ns1:qCom</code>, <code>ns1:vUnCom</code>.
        </p>

        <div className="flex items-center space-x-2">
          <Input
            id="excel-file-upload"
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="flex-grow"
          />
          <Button onClick={handleUpload} disabled={!selectedFile}>
            Carregar Excel
          </Button>
        </div>

        <Button variant="outline" onClick={handleDownloadTemplate}>
          Baixar Template de Itens Comprados
        </Button>
      </div>
    </div>
  );
};

export default CargaDeDados;
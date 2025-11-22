import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface FileProcessingResult {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  response?: any;
  errorMessage?: string;
}

const ProcessXml = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processingResults, setProcessingResults] = useState<FileProcessingResult[]>([]);
  const [overallLoading, setOverallLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
      setProcessingResults([]); // Limpa resultados anteriores ao selecionar novos arquivos
    }
  };

  const handleProcessXml = async () => {
    if (selectedFiles.length === 0) {
      showError("Por favor, selecione pelo menos um arquivo XML.");
      return;
    }

    setOverallLoading(true);
    setProcessingResults(
      selectedFiles.map(file => ({
        fileName: file.name,
        status: 'pending',
      }))
    );

    const globalToastId = showLoading("Iniciando processamento de arquivos XML...");

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const currentResult: FileProcessingResult = {
        fileName: file.name,
        status: 'processing',
      };
      // Atualiza o status do arquivo atual para 'processing'
      setProcessingResults(prev => prev.map((res, idx) => idx === i ? currentResult : res));

      try {
        const xmlContent = await file.text(); // Lê o conteúdo do arquivo como texto

        const { data, error } = await supabase.functions.invoke('process-xml', {
          body: { xmlContent },
        });

        if (error) {
          throw new Error(error.message);
        }

        currentResult.status = 'success';
        currentResult.response = data;
        showSuccess(`Arquivo '${file.name}' processado com sucesso!`);
      } catch (err: any) {
        console.error(`Erro ao processar arquivo '${file.name}':`, err);
        currentResult.status = 'error';
        currentResult.errorMessage = err.message;
        showError(`Erro ao processar '${file.name}': ${err.message}`);
      } finally {
        // Atualiza o resultado final do arquivo
        setProcessingResults(prev => prev.map((res, idx) => idx === i ? currentResult : res));
      }
    }

    setOverallLoading(false);
    dismissToast(globalToastId);
    showSuccess("Todos os arquivos XML foram processados.");
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center mb-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-2">Processar Faturas XML</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Carregar Arquivos XML</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            id="xml-files"
            type="file"
            accept=".xml"
            multiple
            onChange={handleFileChange}
            className="mb-4"
          />
          {selectedFiles.length > 0 && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Arquivos Selecionados:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-gray-500" />
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button onClick={handleProcessXml} disabled={overallLoading || selectedFiles.length === 0} className="mt-4 w-full">
            {overallLoading ? "Processando Todos..." : `Processar ${selectedFiles.length} Arquivo(s)`}
          </Button>
        </CardContent>
      </Card>

      {processingResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Processamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {processingResults.map((result, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500 mr-2" />}
                      {result.status === 'error' && <XCircle className="h-5 w-5 text-red-500 mr-2" />}
                      {(result.status === 'pending' || result.status === 'processing') && <Loader2 className="h-5 w-5 text-blue-500 mr-2 animate-spin" />}
                      <h4 className="font-medium">{result.fileName}</h4>
                    </div>
                    <span className={`text-sm font-semibold ${
                      result.status === 'success' ? 'text-green-600' :
                      result.status === 'error' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {result.status === 'success' && 'Sucesso'}
                      {result.status === 'error' && 'Erro'}
                      {result.status === 'processing' && 'Processando...'}
                      {result.status === 'pending' && 'Pendente'}
                    </span>
                  </div>
                  {result.response && (
                    <div className="mt-2">
                      <h5 className="text-sm font-semibold mb-1">Resposta:</h5>
                      <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md overflow-auto text-xs">
                        {JSON.stringify(result.response, null, 2)}
                      </pre>
                    </div>
                  )}
                  {result.errorMessage && (
                    <div className="mt-2">
                      <h5 className="text-sm font-semibold mb-1 text-red-600">Erro:</h5>
                      <p className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-xs text-red-800 dark:text-red-300">
                        {result.errorMessage}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcessXml;
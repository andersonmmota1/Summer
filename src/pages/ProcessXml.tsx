import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showLoading, dismissToast } from "@/utils/toast";
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ProcessXml = () => {
  const [xmlContent, setXmlContent] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleProcessXml = async () => {
    if (!xmlContent.trim()) {
      showError("Por favor, insira o conteúdo XML.");
      return;
    }

    setLoading(true);
    setResponse(null);
    const toastId = showLoading("Processando XML...");

    try {
      const { data, error } = await supabase.functions.invoke('process-xml', {
        body: { xmlContent },
      });

      if (error) {
        throw new Error(error.message);
      }

      setResponse(data);
      showSuccess("XML processado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao invocar Edge Function:", err);
      showError(`Erro ao processar XML: ${err.message}`);
      setResponse({ error: err.message });
    } finally {
      setLoading(false);
      dismissToast(toastId);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex items-center mb-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold ml-2">Processar Fatura XML</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Conteúdo XML da Fatura</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Cole o conteúdo XML da sua fatura aqui..."
            value={xmlContent}
            onChange={(e) => setXmlContent(e.target.value)}
            rows={15}
            className="font-mono"
          />
          <Button onClick={handleProcessXml} disabled={loading} className="mt-4 w-full">
            {loading ? "Processando..." : "Processar XML"}
          </Button>
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle>Resposta da Edge Function</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto text-sm">
              {JSON.stringify(response, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProcessXml;
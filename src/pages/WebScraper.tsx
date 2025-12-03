import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSession } from '@/components/SessionContextProvider';
import { extractPurchasedItemsFromHtml } from '@/utils/html-to-purchased-items'; // Importar a nova função
import { exportPurchasedItemsToXml } from '@/utils/xml-exporter'; // Importar a função de exportação XML
import { NFeDetailedItem } from '@/types/nfe'; // Importar a nova interface
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'; // Importar Dialog
import QrCodeScanner from '@/components/QrCodeScanner'; // Importar o novo componente

const WebScraper: React.FC = () => {
  const { user } = useSession();
  const [targetUrl, setTargetUrl] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false); // Estado para controlar o modal do scanner

  const handleFetchContent = async () => {
    if (!targetUrl) {
      showError('Por favor, insira uma URL.');
      return;
    }

    setLoading(true);
    const loadingToastId = showLoading('Buscando conteúdo da URL...');

    try {
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: targetUrl },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && data.content) {
        setPageContent(data.content);
        showSuccess('Conteúdo da URL obtido com sucesso!');
      } else {
        setPageContent('Nenhum conteúdo retornado ou erro desconhecido.');
        showError('Nenhum conteúdo retornado ou erro desconhecido.');
      }
    } catch (error: any) {
      console.error('Erro ao buscar conteúdo da URL:', error);
      setPageContent(`Erro: ${error.message}`);
      showError(`Erro ao buscar conteúdo: ${error.message}`);
    } finally {
      dismissToast(loadingToastId);
      setLoading(false);
    }
  };

  const handleExtractAndDownloadXml = async () => {
    if (!pageContent) {
      showError('Nenhum conteúdo de página para extrair. Por favor, busque uma URL primeiro.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível extrair e baixar XML.');
      return;
    }

    const loadingToastId = showLoading('Extraindo dados e gerando XML...');
    try {
      // extractPurchasedItemsFromHtml agora retorna NFeDetailedItem[]
      const detailedNFeItems: NFeDetailedItem[] = await extractPurchasedItemsFromHtml(pageContent, user.id);
      
      if (detailedNFeItems.length === 0) {
        showWarning('Nenhum item de produto válido foi extraído do conteúdo HTML. O arquivo XML não será gerado.');
        return;
      }

      // exportPurchasedItemsToXml agora aceita NFeDetailedItem[]
      const xmlContent = exportPurchasedItemsToXml(detailedNFeItems);
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Usar a chave de acesso (Id) do primeiro item como nome do arquivo
      let filename = 'nfe_extraida_do_scraper.xml'; // Fallback
      if (detailedNFeItems.length > 0 && detailedNFeItems[0].Id) {
        // Sanitizar o Id para ser um nome de arquivo válido
        const sanitizedId = detailedNFeItems[0].Id.replace(/[^a-zA-Z0-9-]/g, '_');
        filename = `${sanitizedId}.xml`;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${detailedNFeItems.length} itens extraídos e baixados como XML com sucesso!`);

    } catch (error: any) {
      console.error('Erro ao extrair e baixar XML:', error);
      showError(`Erro ao extrair e baixar XML: ${error.message}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    setTargetUrl(decodedText);
    setIsScannerOpen(false); // Fecha o modal após o sucesso
    showSuccess('URL lida do QR Code com sucesso!');
  };

  const handleScanError = (errorMessage: string) => {
    // Erros de câmera já são tratados dentro do QrCodeScanner,
    // mas podemos adicionar um tratamento adicional aqui se necessário.
    console.error('Erro no scanner de QR Code:', errorMessage);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Acessar Conteúdo de Página Web
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Use esta ferramenta para buscar o conteúdo HTML bruto de uma URL.
        **Atenção**: Esta função busca o HTML inicial da página e não executa JavaScript.
        Páginas dinâmicas podem não ter todo o conteúdo visível no HTML bruto.
        Além disso, o uso desta ferramenta para "raspar" sites pode ter implicações legais e éticas.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurações de Busca</CardTitle>
          <CardDescription>Insira a URL da página que você deseja acessar ou escaneie um QR Code.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="target-url" className="mb-2 block">URL da Página</Label>
            <Input
              id="target-url"
              type="url"
              placeholder="https://www.exemplo.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleFetchContent} disabled={loading} className="flex-1">
              {loading ? 'Buscando...' : 'Buscar Conteúdo'}
            </Button>
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  Escanear QR Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl p-0">
                <DialogHeader className="p-4 pb-0">
                  <DialogTitle>Escanear QR Code</DialogTitle>
                </DialogHeader>
                <QrCodeScanner
                  onScanSuccess={handleScanSuccess}
                  onScanError={handleScanError}
                  onClose={() => setIsScannerOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {pageContent && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Conteúdo da Página</CardTitle>
                <CardDescription>O HTML bruto retornado pela URL.</CardDescription>
              </div>
              <Button onClick={handleExtractAndDownloadXml} disabled={loading || !pageContent} variant="outline">
                Extrair e Baixar como XML de Itens Comprados
              </Button>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
              **Aviso**: A extração de dados para XML é otimizada para o formato HTML de NFC-e.
              Pode não funcionar corretamente com outras estruturas de página.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              value={pageContent}
              readOnly
              className="w-full h-96 font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WebScraper;
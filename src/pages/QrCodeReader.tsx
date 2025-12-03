"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode'; // Importa a classe Html5QrcodeScanner diretamente
import * as Html5QrcodeModule from 'html5-qrcode'; // Importa o módulo inteiro como namespace
import { showError, showSuccess, showWarning } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CameraOff, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QrCodeReader: React.FC = () => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrCodeRegionId = "qr-code-full-region";
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          disableFlip: false,
          supportedScanMethods: [
            Html5QrcodeModule.Html5QrcodeSupportedMethod.CameraScan, // Acessa a propriedade estática via namespace
            Html5QrcodeModule.Html5QrcodeSupportedMethod.FileDragAndDrop,
            Html5QrcodeModule.Html5QrcodeSupportedMethod.Usb
          ]
        },
        false // verbose
      );
    }

    const html5QrcodeScanner = scannerRef.current;

    const qrCodeSuccessCallback = (decodedText: string, decodedResult: any) => {
      console.log(`QR Code success = ${decodedText}`, decodedResult);
      showSuccess('URL lida do QR Code com sucesso!');
      setScannedUrl(decodedText);
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner", error);
      });
      setIsScanning(false);
    };

    const qrCodeErrorCallback = (errorMessage: string) => {
      if (errorMessage.includes("No camera found") || errorMessage.includes("Permission denied")) {
        setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
        showError("Erro na câmera: " + errorMessage);
        html5QrcodeScanner.clear().catch(error => console.error("Failed to clear scanner on camera error", error));
        setIsScanning(false);
      } else {
        console.warn("Erro durante a leitura do QR Code:", errorMessage);
      }
    };

    if (!isScanning && !cameraError && !scannedUrl) {
      setIsScanning(true);
      html5QrcodeScanner.render(qrCodeSuccessCallback, qrCodeErrorCallback)
        .catch(err => {
          console.error("Failed to start scanner:", err);
          setCameraError("Erro ao iniciar o scanner: " + err.message);
          showError("Erro ao iniciar o scanner: " + err.message);
          setIsScanning(false);
        });
    }

    return () => {
      if (html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner on unmount", error);
        });
      }
    };
  }, [navigate, isScanning, cameraError, scannedUrl]);

  const handleCopyToClipboard = async () => {
    if (scannedUrl) {
      try {
        await navigator.clipboard.writeText(scannedUrl);
        showSuccess('URL copiada para a área de transferência!');
      } catch (err) {
        console.error('Erro ao copiar URL:', err);
        showError('Falha ao copiar a URL. Por favor, tente novamente.');
      }
    }
  };

  const handleGoToWebScraper = () => {
    navigate('/web-scraper', { state: { scannedUrl: scannedUrl } });
  };

  const handleRestartScan = () => {
    setScannedUrl(null);
    setCameraError(null);
    setIsScanning(false);
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Leitor de QR Code
      </h2>
      <p className="text-gray-700 dark:text-gray-300 text-center mb-6">
        Aponte a câmera para o QR code que contém a URL.
      </p>
      {cameraError ? (
        <div className="text-center text-red-600 dark:text-red-400 flex flex-col items-center space-y-2">
          <CameraOff className="h-12 w-12" />
          <p className="font-bold">{cameraError}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Certifique-se de que sua câmera está conectada e que você concedeu permissão ao navegador.
          </p>
          <Button onClick={handleRestartScan} variant="outline" className="mt-4">
            Tentar Novamente
          </Button>
        </div>
      ) : (
        <>
          {!isScanning && !scannedUrl && (
            <div className="flex flex-col items-center space-y-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Iniciando câmera...</p>
            </div>
          )}
          <div id={qrCodeRegionId} className="w-full max-w-md aspect-video bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
            {/* O scanner será renderizado aqui */}
          </div>
        </>
      )}

      {scannedUrl && (
        <div className="mt-6 w-full max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scanned-url-input" className="text-lg font-medium">URL Lida:</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="scanned-url-input"
                type="text"
                value={scannedUrl}
                readOnly
                className="flex-grow"
              />
              <Button onClick={handleCopyToClipboard} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
                <span className="sr-only">Copiar URL</span>
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleGoToWebScraper} className="flex-1">
              Usar no Web Scraper
            </Button>
            <Button onClick={handleRestartScan} variant="outline" className="flex-1">
              Escanear Outro QR Code
            </Button>
          </div>
        </div>
      )}

      {!scannedUrl && !cameraError && (
        <Button onClick={() => navigate('/web-scraper')} variant="outline" className="mt-6">
          Voltar para Web Scraper
        </Button>
      )}
    </div>
  );
};

export default QrCodeReader;
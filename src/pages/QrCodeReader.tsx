"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedMethod } from 'html5-qrcode';
import { showError, showSuccess, showWarning } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Importar Input para exibir a URL
import { Label } from '@/components/ui/label'; // Importar Label
import { Loader2, CameraOff, Copy } from 'lucide-react'; // Importar ícone Copy
import { useNavigate } from 'react-router-dom';

const QrCodeReader: React.FC = () => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrCodeRegionId = "qr-code-full-region";
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null); // Estado para armazenar a URL lida

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          disableFlip: false,
          supportedScanMethods: [
            Html5QrcodeSupportedMethod.CameraScan,
            Html5QrcodeSupportedMethod.FileDragAndDrop,
            Html5QrcodeSupportedMethod.Usb
          ]
        },
        false // verbose
      );
    }

    const html5QrcodeScanner = scannerRef.current;

    const qrCodeSuccessCallback = (decodedText: string, decodedResult: any) => {
      console.log(`QR Code success = ${decodedText}`, decodedResult);
      showSuccess('URL lida do QR Code com sucesso!');
      setScannedUrl(decodedText); // Armazena a URL lida
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner", error);
      });
      setIsScanning(false);
      // Não navega automaticamente, permite ao usuário copiar ou voltar
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

    // Inicia o scanner apenas se não estiver escaneando e não houver erro de câmera
    if (!isScanning && !cameraError && !scannedUrl) { // Adicionado !scannedUrl para não reiniciar após uma leitura
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
  }, [navigate, isScanning, cameraError, scannedUrl]); // Adicionado scannedUrl como dependência

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
    // Navega para WebScraper, passando a URL escaneada como estado
    navigate('/web-scraper', { state: { scannedUrl: scannedUrl } });
  };

  const handleRestartScan = () => {
    setScannedUrl(null); // Limpa a URL lida para permitir um novo scan
    setCameraError(null); // Limpa qualquer erro de câmera anterior
    setIsScanning(false); // Força o useEffect a reiniciar o scanner
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
          {!isScanning && !scannedUrl && ( // Mostra o loader apenas se não estiver escaneando e não houver URL lida
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

      {!scannedUrl && !cameraError && ( // Botão de voltar se não houver URL lida e sem erro de câmera
        <Button onClick={() => navigate('/web-scraper')} variant="outline" className="mt-6">
          Voltar para Web Scraper
        </Button>
      )}
    </div>
  );
};

export default QrCodeReader;
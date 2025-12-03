"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as Html5Qrcode from 'html5-qrcode'; // Import de namespace
import { showError, showWarning } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Loader2, CameraOff } from 'lucide-react';

interface QrCodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  onClose: () => void;
}

const QrCodeScanner: React.FC<QrCodeScannerProps> = ({ onScanSuccess, onScanError, onClose }) => {
  const scannerRef = useRef<Html5Qrcode.Html5QrcodeScanner | null>(null);
  const qrCodeRegionId = "qr-code-full-region";
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode.Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          disableFlip: false,
          supportedScanMethods: [
            Html5Qrcode.Html5QrcodeScanner.Html5QrcodeSupportedMethod.CameraScan, // CORRIGIDO AQUI
            Html5Qrcode.Html5QrcodeScanner.Html5QrcodeSupportedMethod.FileDragAndDrop, // E AQUI
            Html5Qrcode.Html5QrcodeScanner.Html5QrcodeSupportedMethod.Usb // E AQUI
          ]
        },
        false // verbose
      );
    }

    const html5QrcodeScanner = scannerRef.current;

    const qrCodeSuccessCallback = (decodedText: string, decodedResult: any) => {
      console.log(`QR Code success = ${decodedText}`, decodedResult);
      onScanSuccess(decodedText);
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
      }
      onScanError?.(errorMessage);
    };

    if (!isScanning && !cameraError) {
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
  }, [onScanSuccess, onScanError, isScanning, cameraError]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Escanear QR Code</h3>
      <p className="text-gray-700 dark:text-gray-300 text-center">
        Aponte a câmera para o QR code que contém a URL.
      </p>
      {cameraError ? (
        <div className="text-center text-red-600 dark:text-red-400 flex flex-col items-center space-y-2">
          <CameraOff className="h-12 w-12" />
          <p className="font-bold">{cameraError}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Certifique-se de que sua câmera está conectada e que você concedeu permissão ao navegador.
          </p>
        </div>
      ) : (
        <>
          {!isScanning && (
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
      <Button onClick={onClose} variant="outline" className="mt-4">
        Fechar Scanner
      </Button>
    </div>
  );
};

export default QrCodeScanner;
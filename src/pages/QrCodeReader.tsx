"use client";

import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Loader2, CameraOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QrCodeReader: React.FC = () => {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrCodeRegionId = "qr-code-full-region";

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        qrCodeRegionId,
        {
          fps: 10,
          qrbox: 300,
        },
        false
      );
    }

    const scanner = scannerRef.current;

    const onSuccess = (decodedText: string) => {
      console.log("QR LIDO:", decodedText);

      showSuccess("QR Code lido!");
      scanner.clear();
      setIsScanning(false);

      navigate("/web-scraper", { state: { scannedUrl: decodedText } });
    };

    const onError = (error: string) => {
      console.warn("Tentando ler:", error);
    };

    if (!isScanning && !cameraError) {
      setIsScanning(true);

      scanner
        .render(onSuccess, onError)
        .catch((err: any) => {
          console.error("Erro ao iniciar scanner:", err);
          setCameraError("Erro ao iniciar a câmera.");
          showError("Erro ao iniciar a câmera.");
        });
    }

    return () => {
      scanner?.clear().catch(() => {});
    };
  }, [navigate, isScanning, cameraError]);

  return (
    <div className="p-6 flex flex-col items-center min-h-[calc(100vh-120px)]">
      <h2 className="text-3xl font-semibold mb-4">Leitor de QR Code</h2>

      {cameraError ? (
        <div className="text-red-600 flex flex-col items-center">
          <CameraOff className="h-12 w-12" />
          <p className="font-bold">{cameraError}</p>
        </div>
      ) : (
        <>
          {!isScanning && (
            <div className="flex flex-col items-center space-y-2 text-gray-600">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Iniciando câmera...</p>
            </div>
          )}

          <div
            id={qrCodeRegionId}
            className="w-full max-w-md aspect-video bg-gray-200 rounded-md"
          ></div>
        </>
      )}

      <Button onClick={() => navigate("/web-scraper")} variant="outline" className="mt-6">
        Voltar
      </Button>
    </div>
  );
};

export default QrCodeReader;

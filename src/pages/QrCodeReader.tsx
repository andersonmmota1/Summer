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
          qrbox: { width: 250, height: 250 },
          disableFlip: false
        },
        false // verbose
      );
    }

    const scanner = scannerRef.current;

    const qrCodeSuccess = (decodedText: string) => {
      showSuccess("URL lida com sucesso!");
      safeClear(scanner);

      navigate("/web-scraper", {
        state: { scannedUrl: decodedText }
      });
    };

    const qrCodeError = (error: string) => {
      if (
        error.includes("No camera found") ||
        error.includes("Permission denied")
      ) {
        setCameraError(
          "Não foi possível acessar a câmera. Verifique as permissões."
        );
        showError("Erro ao acessar a câmera.");
        safeClear(scanner);
      }
    };

    if (!isScanning && !cameraError) {
      setIsScanning(true);

      scanner
        .render(qrCodeSuccess, qrCodeError)
        .catch((err: any) => {
          console.error("Erro ao iniciar o scanner:", err);
          setCameraError("Erro ao iniciar o scanner.");
          showError("Erro ao iniciar o scanner.");
          setIsScanning(false);
        });
    }

    return () => {
      safeClear(scanner);
    };
  }, [navigate, isScanning, cameraError]);

  /** Função segura para limpar sem gerar erros */
  function safeClear(scanner: Html5QrcodeScanner | null) {
    if (!scanner) return;

    try {
      if ((scanner as any).isScanning) {
        scanner.clear();
      }
    } catch (e) {
      console.warn("Erro ao limpar scanner:", e);
    }
  }

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
        </div>
      ) : (
        <>
          {!isScanning && (
            <div className="flex flex-col items-center space-y-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>Iniciando câmera...</p>
            </div>
          )}

          <div
            id={qrCodeRegionId}
            className="w-full max-w-md aspect-video bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden"
          ></div>
        </>
      )}

      <Button
        onClick={() => navigate("/web-scraper")}
        variant="outline"
        className="mt-6"
      >
        Voltar para Web Scraper
      </Button>
    </div>
  );
};

export default QrCodeReader;

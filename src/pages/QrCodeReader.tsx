import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function LeitorQRCode() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => {
    const html5QrcodeScanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 }
    });

    const qrCodeSuccessCallback = (decodedText: string) => {
      if (decodedText.startsWith("http")) {
        navigate(decodedText);
      } else {
        alert("QR Code inválido");
      }

      html5QrcodeScanner.clear().catch(() => {});
      setIsScanning(false);
    };

    const qrCodeErrorCallback = () => {};

    const startScanner = () => {
      html5QrcodeScanner
        .render(qrCodeSuccessCallback, qrCodeErrorCallback)
        .catch((err) => {
          setCameraError("Erro ao iniciar o scanner: " + err.message);
          alert("Erro ao iniciar o scanner: " + err.message);
        });
    };

    if (!isScanning && !cameraError) {
      setIsScanning(true);
      startScanner();
    }

    return () => {
      html5QrcodeScanner.clear().catch(() => {});
    };
  }, [navigate, isScanning, cameraError]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Leitor de QR Code
      </h2>

      <p className="text-gray-700 dark:text-gray-300 text-center mb-6">
        Aponte a câmera para o QR code que contém a URL.
      </p>

      {cameraError ? (
        <div className="text-red-500 font-semibold">{cameraError}</div>
      ) : (
        <div className="relative">
          {/* Container obrigatório do Html5Qrcode */}
          <div id="reader" style={{ width: 300, height: 300 }}></div>

          {/* Overlay do quadrado da área de leitura */}
          <div
            className="absolute inset-0 pointer-events-none border-4 border-green-500 rounded-md"
            style={{
              width: 250,
              height: 250,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)"
            }}
          ></div>
        </div>
      )}
    </div>
  );
}

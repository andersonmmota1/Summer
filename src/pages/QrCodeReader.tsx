import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function LeitorQRCode() {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    const startScanner = () => {
      try {
        scanner = new Html5QrcodeScanner(
          "reader",
          {
            fps: 12,
            qrbox: { width: 300, height: 300 }, // 🔥 QUADRADO DE LEITURA
            aspectRatio: 1.0
          },
          false
        );

        const onSuccess = (decodedText: string) => {
          console.log("QR LIDO:", decodedText);

          scanner?.clear(); // ❗ sem .catch()
          navigate(decodedText);
        };

        const onError = () => {};

        scanner.render(onSuccess, onError);
        setIsScanning(true);
      } catch (err: any) {
        console.error(err);
        setCameraError("Erro ao iniciar a câmera: " + err.message);
      }
    };

    if (!isScanning && !cameraError) {
      startScanner();
    }

    return () => {
      try {
        scanner?.clear(); // ❗ remover .catch()
      } catch {}
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
        <p className="text-red-500">{cameraError}</p>
      ) : (
        <div id="reader" className="w-full max-w-sm" />
      )}
    </div>
  );
}

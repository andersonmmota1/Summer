import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function LeitorQRCode() {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const startScanner = async () => {
      try {
        const cameraId = (await Html5Qrcode.getCameras())[0]?.id;

        if (!cameraId) {
          setCameraError("Nenhuma câmera encontrada.");
          return;
        }

        const html5Qr = new Html5Qrcode("qr-reader");
        scannerRef.current = html5Qr;

        setIsScanning(true);

        await html5Qr.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }, // 🔲 QUADRADO DE LEITURA
          },
          (decodedText) => {
            html5Qr.stop();
            navigate("/verificar-produto?url=" + encodeURIComponent(decodedText));
          },
          (errorMessage) => {
            // Erros de leitura normais — ignorar
          }
        );
      } catch (err: any) {
        setCameraError("Erro ao acessar a câmera: " + err.message);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [navigate]);

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <h2 className="text-3xl font-semibold mb-4">Leitor de QR Code</h2>

      {cameraError && (
        <p className="text-red-600 font-semibold">{cameraError}</p>
      )}

      {!cameraError && (
        <div
          id="qr-reader"
          style={{
            width: "300px",
            height: "300px",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        />
      )}
    </div>
  );
}

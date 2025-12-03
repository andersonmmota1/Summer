import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function LeitorQRCode() {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        // Aguarda lista de câmeras
        const cameras = await Html5Qrcode.getCameras();
        const cameraId = cameras?.[0]?.id;

        if (!cameraId) {
          if (isMounted) setCameraError("Nenhuma câmera encontrada.");
          return;
        }

        // Garantir que o container está LIMPO
        const container = document.getElementById("qr-reader");
        if (container) container.innerHTML = "";

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }, // 🔲 QUADRADO DE LEITURA
            aspectRatio: 1.0,
          },
          (decodedText) => {
            scanner.stop();
            navigate("/verificar-produto?url=" + encodeURIComponent(decodedText));
          },
          () => {} // erros ignorados
        );
      } catch (err: any) {
        if (isMounted) {
          setCameraError("Erro ao acessar a câmera: " + err.message);
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;

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

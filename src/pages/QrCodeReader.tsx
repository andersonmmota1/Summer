import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrCodeReader() {
  const qrCodeRegionId = "qr-reader";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(qrCodeRegionId);
    html5QrCodeRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          console.error("Nenhuma câmera encontrada.");
          return;
        }

        const cameraId = devices[0].id;

        await html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: 250,
          },
          (decodedText) => {
            console.log("QR LIDO:", decodedText);
            alert("QR CODE LIDO:\n" + decodedText);

            // Para pausar depois da leitura
            html5QrCode.stop().catch(() => {});
          },
          (errorMessage) => {
            // Erros de leitura normais (não quebram o app)
          }
        );
      } catch (err) {
        console.error("Erro ao iniciar scanner:", err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="p-4">
      <h2>Leitor de QR Code</h2>
      <div id={qrCodeRegionId} style={{ width: "100%" }}></div>
    </div>
  );
}

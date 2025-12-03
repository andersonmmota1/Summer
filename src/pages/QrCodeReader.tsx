import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrCodeReader() {
  const divId = "reader";
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [qrData, setQrData] = useState<string>("");

  useEffect(() => {
    const html5QrCode = new Html5Qrcode(divId);
    html5QrCodeRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          console.log("QR LIDO:", decodedText);
          setQrData(decodedText);

          // Se quiser parar automaticamente após ler:
          html5QrCode.stop().catch((err) => console.error(err));
        }
      )
      .catch((err) => console.error("Erro ao iniciar câmera:", err));

    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Leitor de QR Code</h1>

      <div id={divId} style={{ width: "300px" }} />

      {qrData && (
        <div className="mt-4 p-3 bg-green-200 rounded">
          <strong>QR lido:</strong> {qrData}
        </div>
      )}
    </div>
  );
}

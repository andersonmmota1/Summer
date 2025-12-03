import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QrCodeReader() {
  const [result, setResult] = useState<string | null>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    qrRef.current = html5QrCode;

    // Solicita a câmera
    Html5Qrcode.getCameras()
      .then(cameras => {
        if (cameras && cameras.length > 0) {
          const camId = cameras[0].id;

          html5QrCode.start(
            camId,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            decodedText => {
              setResult(decodedText);
              html5QrCode.stop(); // Para após ler
            },
            error => {
              // erros de leitura ignorados
            }
          );
        }
      })
      .catch(err => console.error("Erro ao acessar câmera:", err));

    return () => {
      html5QrCode.stop().catch(() => {});
    };
  }, []);

  // Upload para ler QR do arquivo
  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !qrRef.current) return;

    qrRef.current
      .scanFile(file, true)
      .then(decoded => setResult(decoded))
      .catch(err => console.error("Erro ao ler arquivo:", err));
  };

  return (
    <div>
      <h1>Leitor de QR Code</h1>

      <div
        id="reader"
        style={{
          width: "300px",
          height: "300px",
          marginBottom: "20px",
          background: "#00000020",
        }}
      />

      <input type="file" accept="image/*" onChange={handleFile} />

      {result && (
        <div style={{ marginTop: "20px", padding: "10px", background: "#eee" }}>
          <strong>Resultado:</strong>
          <br />
          {result}
        </div>
      )}
    </div>
  );
}

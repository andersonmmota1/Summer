"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client"; // Importar o cliente Supabase

interface XMLUploadButtonProps {
  onUploadSuccess?: () => void; // Callback opcional para quando o upload for bem-sucedido
}

const XMLUploadButton: React.FC<XMLUploadButtonProps> = ({ onUploadSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Nenhum arquivo XML selecionado.");
      return;
    }

    if (file.type !== "text/xml" && !file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Por favor, selecione um arquivo XML válido.");
      event.target.value = ""; // Limpa o input para permitir re-seleção do mesmo arquivo
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const xmlContent = e.target?.result as string;

        // Invocar a Edge Function do Supabase
        const { data, error } = await supabase.functions.invoke('process-xml', {
          body: JSON.stringify({ xmlContent }),
        });

        if (error) {
          console.error("Erro ao invocar Edge Function:", error);
          toast.error(`Erro ao processar XML: ${data?.error || error.message}`);
        } else {
          toast.success("XML processado com sucesso!");
          console.log("Resposta da Edge Function:", data);
          onUploadSuccess?.(); // Chamar callback se houver
        }
      } catch (error: any) {
        console.error("Erro ao ler ou processar XML:", error);
        toast.error(`Erro ao processar arquivo: ${error.message || "Verifique o formato do arquivo."}`);
      } finally {
        setIsLoading(false);
        event.target.value = ""; // Limpa o input após o processamento
      }
    };

    reader.onerror = (error) => {
      console.error("Erro ao ler o arquivo:", error);
      toast.error("Erro ao ler o arquivo XML.");
      setIsLoading(false);
      event.target.value = "";
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="xml-upload" className="sr-only">Importar XML</Label>
      <Input
        id="xml-upload"
        type="file"
        accept=".xml"
        onChange={handleFileChange}
        className="hidden"
        disabled={isLoading}
      />
      <Button
        onClick={() => document.getElementById("xml-upload")?.click()}
        className="flex items-center gap-2"
        disabled={isLoading}
      >
        <Upload className="h-4 w-4" />
        {isLoading ? "Processando XML..." : "Importar XML"}
      </Button>
    </div>
  );
};

export default XMLUploadButton;
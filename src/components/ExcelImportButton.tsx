"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Transaction } from "./TransactionForm";
import { parse, isValid, format } from "date-fns";

interface ExcelImportButtonProps {
  onImportTransactions: (transactions: Transaction[]) => void;
}

// Helper function to parse various date formats, including Brazilian and Excel numbers
const parseDateFromExcel = (excelDate: any): string => {
  // 1. Check if it's already a valid Date object (from cellDates: true)
  if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
    return format(excelDate, "yyyy-MM-dd");
  }
  // 2. Check if it's an Excel date number
  else if (typeof excelDate === 'number') {
    const date = XLSX.SSF.parse_date_code(excelDate);
    if (date) {
      return format(new Date(date.y, date.m - 1, date.d), "yyyy-MM-dd");
    }
  }
  // 3. Check if it's a string in Brazilian or ISO format
  else if (typeof excelDate === 'string') {
    // Try parsing Brazilian format DD/MM/YYYY
    let parsedDate = parse(excelDate, "dd/MM/yyyy", new Date());
    if (isValid(parsedDate)) {
      return format(parsedDate, "yyyy-MM-dd");
    }
    // Try parsing YYYY-MM-DD
    parsedDate = parse(excelDate, "yyyy-MM-dd", new Date());
    if (isValid(parsedDate)) {
      return format(parsedDate, "yyyy-MM-dd");
    }
    // Fallback for other common formats if necessary, or return original
  }
  return ""; // Return empty string if date cannot be parsed
};

const ExcelImportButton: React.FC<ExcelImportButtonProps> = ({ onImportTransactions }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Nenhum arquivo selecionado.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const importedTransactions: Transaction[] = json.map((row, index) => {
          const date = parseDateFromExcel(row.Data || row.Date); // Handle 'Data' or 'Date' column
          if (!date) {
            toast.error(`Erro na linha ${index + 2}: Data inválida. Use DD/MM/YYYY.`);
            throw new Error("Invalid date format in Excel.");
          }

          const typeRaw = (row.Tipo || row.Type)?.toLowerCase();
          let type: "receita" | "despesa";

          if (typeRaw === "receita" || typeRaw === "venda" || typeRaw === "sale") {
            type = "receita";
          } else if (typeRaw === "despesa" || typeRaw === "expense") {
            type = "despesa";
          } else {
            toast.error(`Erro na linha ${index + 2}: Tipo de transação inválido. Use 'Receita' ou 'Despesa'.`);
            throw new Error("Invalid transaction type in Excel.");
          }

          const value = parseFloat(row.Valor || row.Value);
          if (isNaN(value) || value <= 0) {
            toast.error(`Erro na linha ${index + 2}: Valor inválido. Deve ser um número positivo.`);
            throw new Error("Invalid value in Excel.");
          }

          const description = row.Descricao || row.Description || ""; // Capturar descrição

          return {
            id: Date.now().toString() + index, // Unique ID for each imported transaction
            type: type,
            category: row.Categoria || row.Category || "Não Categorizado",
            cashAccount: row["Conta Caixa"] || row["Cash Account"] || "Não Definido",
            value: value,
            date: date,
            description: description, // Incluir descrição
          };
        });

        onImportTransactions(importedTransactions);
        toast.success(`${importedTransactions.length} transações importadas com sucesso!`);
      } catch (error: any) {
        toast.error(`Erro ao importar arquivo: ${error.message || "Verifique o formato do arquivo."}`);
        console.error("Excel import error:", error);
      } finally {
        // Clear the file input after processing
        event.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="excel-upload" className="sr-only">Importar Excel</Label>
      <Input
        id="excel-upload"
        type="file"
        accept=".xls, .xlsx"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button onClick={() => document.getElementById("excel-upload")?.click()} className="flex items-center gap-2">
        <Upload className="h-4 w-4" /> Importar Excel
      </Button>
    </div>
  );
};

export default ExcelImportButton;
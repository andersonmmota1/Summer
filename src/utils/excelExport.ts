import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Transaction } from "@/components/TransactionForm";
import { format, parseISO } from "date-fns";

// Helper function to format date to Brazilian standard (DD/MM/YYYY)
const formatToBrazilianDate = (dateString: string) => {
  if (!dateString) return "";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy");
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return dateString; // Return original if parsing fails
  }
};

export const exportToExcel = (data: Transaction[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(t => ({
    Data: formatToBrazilianDate(t.date), // Format date for Excel export
    Tipo: t.type === "sale" ? "Venda" : "Despesa",
    Categoria: t.category,
    "Conta Caixa": t.cashAccount,
    Valor: t.value,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transacoes");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(dataBlob, `${fileName}.xlsx`);
};

export const exportTemplateToExcel = (fileName: string = "Template_Transacoes") => {
  const templateData = [
    {
      Data: format(new Date(), "dd/MM/yyyy"),
      Tipo: "Venda",
      Categoria: "Salário",
      "Conta Caixa": "Banco",
      Valor: 2500.00,
    },
    {
      Data: format(new Date(), "dd/MM/yyyy"),
      Tipo: "Despesa",
      Categoria: "Alimentação",
      "Conta Caixa": "Dinheiro",
      Valor: 150.50,
    },
    {
      Data: format(new Date(), "dd/MM/yyyy"),
      Tipo: "Venda",
      Categoria: "Serviços",
      "Conta Caixa": "Cartão de Crédito",
      Valor: 500.00,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(dataBlob, `${fileName}.xlsx`);
};
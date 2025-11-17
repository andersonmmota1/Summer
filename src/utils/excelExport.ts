import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Transaction } from "@/components/TransactionForm";

export const exportToExcel = (data: Transaction[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(t => ({
    Date: t.date,
    Type: t.type === "sale" ? "Sale" : "Expense",
    Category: t.category,
    "Cash Account": t.cashAccount,
    Value: t.value,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(dataBlob, `${fileName}.xlsx`);
};
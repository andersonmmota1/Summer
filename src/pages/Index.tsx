"use client";

import React, { useState, useEffect } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Transaction } from "@/components/TransactionForm"; // Manter import para tipo Transaction
import TransactionTable from "@/components/TransactionTable";
import DashboardSummary from "@/components/DashboardSummary";
import CashFlowChart from "@/components/CashFlowChart";
import ExcelImportButton from "@/components/ExcelImportButton";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportTemplateToExcel } from "@/utils/excelExport";
import { Download, FileText, Trash2 } from "lucide-react"; // Importar Trash2
import { toast } from "sonner";

const Index = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    // Load transactions from local storage on initial render
    if (typeof window !== "undefined") {
      const savedTransactions = localStorage.getItem("transactions");
      return savedTransactions ? JSON.parse(savedTransactions) : [];
    }
    return [];
  });

  // Save transactions to local storage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("transactions", JSON.stringify(transactions));
    }
  }, [transactions]);

  const handleImportTransactions = (importedTransactions: Transaction[]) => {
    setTransactions(importedTransactions);
    toast.info("Transações importadas substituíram as transações existentes.");
  };

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.info("Não há transações para exportar.");
      return;
    }
    exportToExcel(transactions, "Relatorio_Financeiro_Mensal");
  };

  const handleDownloadTemplate = () => {
    exportTemplateToExcel();
    toast.info("Template de Excel baixado.");
  };

  const handleClearTransactions = () => {
    if (window.confirm("Tem certeza que deseja limpar todas as transações? Esta ação não pode ser desfeita.")) {
      setTransactions([]);
      localStorage.removeItem("transactions");
      toast.success("Todas as transações foram removidas.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center mb-8">Dashboard Financeiro</h1>

        <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
          <ExcelImportButton onImportTransactions={handleImportTransactions} />
          <Button onClick={handleDownloadTemplate} className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Baixar Template
          </Button>
          <Button onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar para Excel
          </Button>
          <Button onClick={handleClearTransactions} variant="destructive" className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Limpar Dados
          </Button>
        </div>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Resumo do Dashboard</h2>
          <DashboardSummary transactions={transactions} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Projeção de Fluxo de Caixa</h2>
          <CashFlowChart transactions={transactions} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Todas as Transações</h2>
          <TransactionTable transactions={transactions} />
        </section>

        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;
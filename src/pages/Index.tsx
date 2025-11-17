"use client";

import React, { useState, useEffect } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import TransactionForm, { Transaction } from "@/components/TransactionForm";
import TransactionTable from "@/components/TransactionTable";
import DashboardSummary from "@/components/DashboardSummary";
import CashFlowChart from "@/components/CashFlowChart";
import ExcelImportButton from "@/components/ExcelImportButton"; // Import the new component
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/utils/excelExport";
import { Download } from "lucide-react";
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

  const handleAddTransaction = (newTransaction: Transaction) => {
    setTransactions((prevTransactions) => [...prevTransactions, newTransaction]);
  };

  const handleImportTransactions = (importedTransactions: Transaction[]) => {
    // You might want to merge or replace existing transactions
    // For now, let's replace them to keep it simple.
    // A more advanced solution would involve checking for duplicates or asking the user.
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center mb-8">Dashboard Financeiro</h1>

        <div className="flex flex-col sm:flex-row justify-end gap-4 mb-4">
          <ExcelImportButton onImportTransactions={handleImportTransactions} />
          <Button onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar para Excel
          </Button>
        </div>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Adicionar Nova Transação</h2>
          <TransactionForm onAddTransaction={handleAddTransaction} />
        </section>

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
"use client";

import React, { useState, useEffect } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import TransactionForm, { Transaction } from "@/components/TransactionForm";
import TransactionTable from "@/components/TransactionTable";
import DashboardSummary from "@/components/DashboardSummary";
import CashFlowChart from "@/components/CashFlowChart";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/utils/excelExport";
import { Download } from "lucide-react";

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

  const handleExport = () => {
    exportToExcel(transactions, "Monthly_Financial_Report");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center mb-8">Financial Dashboard</h1>

        <div className="flex justify-end">
          <Button onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export to Excel
          </Button>
        </div>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Add New Transaction</h2>
          <TransactionForm onAddTransaction={handleAddTransaction} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Dashboard Summary</h2>
          <DashboardSummary transactions={transactions} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Cash Flow Projection</h2>
          <CashFlowChart transactions={transactions} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">All Transactions</h2>
          <TransactionTable transactions={transactions} />
        </section>

        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;
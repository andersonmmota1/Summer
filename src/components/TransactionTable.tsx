"use client";

import React, { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { Transaction } from "./TransactionForm";

interface TransactionTableProps {
  transactions: Transaction[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(new Date(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Sort descending
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => format(new Date(t.date), "yyyy-MM") === filterMonth)
                       .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending
  }, [transactions, filterMonth]);

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-card">
      <div className="flex items-center gap-4 mb-4">
        <Label htmlFor="filterMonth">Filtrar por Mês:</Label>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger id="filterMonth" className="w-[180px]">
            <SelectValue placeholder="Selecionar mês" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(month => (
              <SelectItem key={month} value={month}>
                {format(parseISO(month + "-01"), "MMMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Conta Caixa</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma transação para este mês.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(parseISO(transaction.date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <span className={`font-medium ${transaction.type === "sale" ? "text-green-600" : "text-red-600"}`}>
                      {transaction.type === "sale" ? "Venda" : "Despesa"}
                    </span>
                  </TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell>{transaction.cashAccount}</TableCell>
                  <TableCell className="text-right">
                    {transaction.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TransactionTable;
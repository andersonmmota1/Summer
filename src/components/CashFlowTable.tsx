"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Transaction } from "./TransactionForm";

interface CashFlowTableProps {
  transactions: Transaction[];
}

const CashFlowTable: React.FC<CashFlowTableProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(parseISO(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const dailyCashFlow = useMemo(() => {
    const start = startOfMonth(parseISO(filterMonth + "-01"));
    const end = endOfMonth(parseISO(filterMonth + "-01"));
    const daysInMonth = eachDayOfInterval({ start, end });

    const dailySummary: { [key: string]: { revenues: number; expenses: number; total: number } } = {};

    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      dailySummary[dateStr] = { revenues: 0, expenses: 0, total: 0 };
    });

    transactions.forEach(t => {
      if (format(parseISO(t.date), "yyyy-MM") === filterMonth) {
        const dateStr = t.date;
        if (dailySummary[dateStr]) {
          if (t.type === "receita") {
            dailySummary[dateStr].revenues += t.value;
          } else {
            dailySummary[dateStr].expenses += t.value;
          }
          dailySummary[dateStr].total = dailySummary[dateStr].revenues - dailySummary[dateStr].expenses;
        }
      }
    });

    return Object.entries(dailySummary)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, summary]) => ({
        date: format(parseISO(date), "dd/MM"),
        revenues: summary.revenues,
        expenses: summary.expenses,
        total: summary.total,
      }));
  }, [transactions, filterMonth]);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Fluxo de Caixa Diário ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Label htmlFor="cashFlowFilterMonth">Mês do Fluxo de Caixa:</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger id="cashFlowFilterMonth" className="w-[180px]">
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
                <TableHead className="text-right">Entradas (Receitas)</TableHead>
                <TableHead className="text-right">Saídas (Despesas)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyCashFlow.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum dado de fluxo de caixa para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                dailyCashFlow.map((daySummary) => (
                  <TableRow key={daySummary.date}>
                    <TableCell>{daySummary.date}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {daySummary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {daySummary.expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${daySummary.total < 0 ? "text-red-600" : ""}`}>
                      {daySummary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowTable;
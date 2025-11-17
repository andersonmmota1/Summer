"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Transaction } from "./TransactionForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DashboardSummaryProps {
  transactions: Transaction[];
}

const DashboardSummary: React.FC<DashboardSummaryProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(new Date(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const monthlySummary = useMemo(() => {
    const summary = { revenues: 0, expenses: 0, net: 0 }; // Alterado de sales para revenues
    transactions.forEach(t => {
      if (format(new Date(t.date), "yyyy-MM") === filterMonth) {
        if (t.type === "receita") { // Alterado de "sale" para "receita"
          summary.revenues += t.value;
        } else {
          summary.expenses += t.value;
        }
      }
    });
    summary.net = summary.revenues - summary.expenses;
    return summary;
  }, [transactions, filterMonth]);

  const dailySummary = useMemo(() => {
    const summaryMap: { [key: string]: { revenues: number; expenses: number; net: number } } = {}; // Alterado de sales para revenues
    const start = startOfMonth(parseISO(filterMonth + "-01"));
    const end = endOfMonth(parseISO(filterMonth + "-01"));
    const daysInMonth = eachDayOfInterval({ start, end });

    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      summaryMap[dateStr] = { revenues: 0, expenses: 0, net: 0 }; // Alterado de sales para revenues
    });

    transactions.forEach(t => {
      const dateStr = t.date;
      if (summaryMap[dateStr]) {
        if (t.type === "receita") { // Alterado de "sale" para "receita"
          summaryMap[dateStr].revenues += t.value;
        } else {
          summaryMap[dateStr].expenses += t.value;
        }
        summaryMap[dateStr].net = summaryMap[dateStr].revenues - summaryMap[dateStr].expenses;
      }
    });
    return summaryMap;
  }, [transactions, filterMonth]);

  const categorySummary = useMemo(() => {
    const summaryMap: { [key: string]: { revenues: number; expenses: number; net: number } } = {}; // Alterado de sales para revenues
    transactions.forEach(t => {
      if (format(new Date(t.date), "yyyy-MM") === filterMonth) {
        if (!summaryMap[t.category]) {
          summaryMap[t.category] = { revenues: 0, expenses: 0, net: 0 }; // Alterado de sales para revenues
        }
        if (t.type === "receita") { // Alterado de "sale" para "receita"
          summaryMap[t.category].revenues += t.value;
        } else {
          summaryMap[t.category].expenses += t.value;
        }
        summaryMap[t.category].net = summaryMap[t.category].revenues - summaryMap[t.category].expenses;
      }
    });
    return summaryMap;
  }, [transactions, filterMonth]);

  const cashAccountSummary = useMemo(() => {
    const summaryMap: { [key: string]: { revenues: number; expenses: number; net: number } } = {}; // Alterado de sales para revenues
    transactions.forEach(t => {
      if (format(new Date(t.date), "yyyy-MM") === filterMonth) {
        if (!summaryMap[t.cashAccount]) {
          summaryMap[t.cashAccount] = { revenues: 0, expenses: 0, net: 0 }; // Alterado de sales para revenues
        }
        if (t.type === "receita") { // Alterado de "sale" para "receita"
          summaryMap[t.cashAccount].revenues += t.value;
        } else {
          summaryMap[t.cashAccount].expenses += t.value;
        }
        summaryMap[t.cashAccount].net = summaryMap[t.cashAccount].revenues - summaryMap[t.cashAccount].expenses;
      }
    });
    return summaryMap;
  }, [transactions, filterMonth]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <Label htmlFor="summaryFilterMonth">Mês do Resumo:</Label>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger id="summaryFilterMonth" className="w-[180px]">
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

      <Card>
        <CardHeader>
          <CardTitle>Resumo Mensal ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Total de Receitas</p> {/* Alterado de "Vendas" para "Receitas" */}
            <p className="text-2xl font-bold text-green-600">
              {monthlySummary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total de Despesas</p>
            <p className="text-2xl font-bold text-red-600">
              {monthlySummary.expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo Líquido</p>
            <p className={`text-2xl font-bold ${monthlySummary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {monthlySummary.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Diário ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Receitas</TableHead> {/* Alterado de "Vendas" para "Receitas" */}
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(dailySummary).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum dado diário para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(dailySummary)
                  .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                  .map(([date, summary]) => (
                    <TableRow key={date}>
                      <TableCell>{format(parseISO(date), "dd/MM")}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {summary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {summary.expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className={`text-right ${summary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {summary.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por Categoria ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Receitas</TableHead> {/* Alterado de "Vendas" para "Receitas" */}
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(categorySummary).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum dado por categoria para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(categorySummary)
                  .sort(([catA], [catB]) => catA.localeCompare(catB))
                  .map(([category, summary]) => (
                    <TableRow key={category}>
                      <TableCell>{category}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {summary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {summary.expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className={`text-right ${summary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {summary.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por Conta Caixa ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta Caixa</TableHead>
                <TableHead className="text-right">Receitas</TableHead> {/* Alterado de "Vendas" para "Receitas" */}
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(cashAccountSummary).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum dado por conta caixa para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(cashAccountSummary)
                  .sort(([accA], [accB]) => accA.localeCompare(accB))
                  .map(([account, summary]) => (
                    <TableRow key={account}>
                      <TableCell>{account}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {summary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {summary.expenses.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell className={`text-right ${summary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {summary.net.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardSummary;
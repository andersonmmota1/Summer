"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Transaction } from "./TransactionForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added import

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
    const summary = { sales: 0, expenses: 0, net: 0 };
    transactions.forEach(t => {
      if (format(new Date(t.date), "yyyy-MM") === filterMonth) {
        if (t.type === "sale") {
          summary.sales += t.value;
        } else {
          summary.expenses += t.value;
        }
      }
    });
    summary.net = summary.sales - summary.expenses;
    return summary;
  }, [transactions, filterMonth]);

  const dailySummary = useMemo(() => {
    const summaryMap: { [key: string]: { sales: number; expenses: number; net: number } } = {};
    const start = startOfMonth(parseISO(filterMonth + "-01"));
    const end = endOfMonth(parseISO(filterMonth + "-01"));
    const daysInMonth = eachDayOfInterval({ start, end });

    daysInMonth.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      summaryMap[dateStr] = { sales: 0, expenses: 0, net: 0 };
    });

    transactions.forEach(t => {
      const dateStr = t.date;
      if (summaryMap[dateStr]) {
        if (t.type === "sale") {
          summaryMap[dateStr].sales += t.value;
        } else {
          summaryMap[dateStr].expenses += t.value;
        }
        summaryMap[dateStr].net = summaryMap[dateStr].sales - summaryMap[dateStr].expenses;
      }
    });
    return summaryMap;
  }, [transactions, filterMonth]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <Label htmlFor="summaryFilterMonth">Summary Month:</Label>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger id="summaryFilterMonth" className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(month => (
              <SelectItem key={month} value={month}>
                {format(new Date(month + "-01"), "MMMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Total Sales</p>
            <p className="text-2xl font-bold text-green-600">
              {monthlySummary.sales.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">
              {monthlySummary.expenses.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Net Balance</p>
            <p className={`text-2xl font-bold ${monthlySummary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {monthlySummary.net.toLocaleString("en-US", { style: "currency", currency: "USD" })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Summary ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
        </CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(dailySummary).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No daily data for this month.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(dailySummary)
                  .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                  .map(([date, summary]) => (
                    <TableRow key={date}>
                      <TableCell>{format(parseISO(date), "MMM dd")}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {summary.sales.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {summary.expenses.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                      </TableCell>
                      <TableCell className={`text-right ${summary.net >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {summary.net.toLocaleString("en-US", { style: "currency", currency: "USD" })}
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
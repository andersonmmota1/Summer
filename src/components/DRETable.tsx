"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Transaction } from "./TransactionForm";

interface DRETableProps {
  transactions: Transaction[];
}

const DRETable: React.FC<DRETableProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(parseISO(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const dreSummary = useMemo(() => {
    let revenues = 0;
    let cmvExpenses = 0;
    let payrollExpenses = 0;

    transactions.forEach(t => {
      if (format(parseISO(t.date), "yyyy-MM") === filterMonth) {
        if (t.type === "receita") {
          revenues += t.value;
        } else if (t.type === "despesa") {
          if (t.category.toLowerCase() === "cmv") {
            cmvExpenses += t.value;
          } else if (t.category.toLowerCase() === "folha") {
            payrollExpenses += t.value;
          }
        }
      }
    });

    const grossOperatingResult = revenues - cmvExpenses;
    const netOperatingResultAfterPayroll = grossOperatingResult - payrollExpenses;

    // Calculate percentages relative to revenues
    const cmvPercentage = revenues > 0 ? (cmvExpenses / revenues) * 100 : 0;
    const grossOperatingResultPercentage = revenues > 0 ? (grossOperatingResult / revenues) * 100 : 0;
    const payrollPercentage = revenues > 0 ? (payrollExpenses / revenues) * 100 : 0;
    const netOperatingResultAfterPayrollPercentage = revenues > 0 ? (netOperatingResultAfterPayroll / revenues) * 100 : 0;

    return {
      revenues,
      cmvExpenses,
      grossOperatingResult,
      grossOperatingResultPercentage,
      payrollExpenses,
      netOperatingResultAfterPayroll,
      cmvPercentage,
      payrollPercentage,
      netOperatingResultAfterPayrollPercentage,
    };
  }, [transactions, filterMonth]);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Demonstrativo de Resultado (DRE) - ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Label htmlFor="dreFilterMonth">Mês do DRE:</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger id="dreFilterMonth" className="w-[180px]">
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
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Receitas</TableCell>
              <TableCell className="text-right text-green-600">
                {dreSummary.revenues.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">(-) CMV (Custo de Mercadoria Vendida)</TableCell>
              <TableCell className="text-right text-red-600">
                {(-dreSummary.cmvExpenses).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.cmvPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow className="font-bold">
              <TableCell>Resultado Operacional Bruto</TableCell>
              <TableCell className={`text-right ${dreSummary.grossOperatingResult < 0 ? "text-red-600" : "text-blue-600"}`}>
                {dreSummary.grossOperatingResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.grossOperatingResultPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">(-) Despesas de Folha</TableCell>
              <TableCell className="text-right text-red-600">
                {(-dreSummary.payrollExpenses).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.payrollPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow className="font-bold">
              <TableCell>Resultado Bruto Pós Folha</TableCell>
              <TableCell className={`text-right ${dreSummary.netOperatingResultAfterPayroll < 0 ? "text-red-600" : "text-blue-600"}`}>
                {dreSummary.netOperatingResultAfterPayroll.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.netOperatingResultAfterPayrollPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default DRETable;
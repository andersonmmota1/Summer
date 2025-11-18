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
    let operationExpenses = 0; // Nova variável para despesas de operação
    let maintenanceExpenses = 0; // Nova variável para despesas de manutenção
    let rentExpenses = 0; // Nova variável para despesas de aluguel

    transactions.forEach(t => {
      if (format(parseISO(t.date), "yyyy-MM") === filterMonth) {
        if (t.type === "receita") {
          revenues += t.value;
        } else if (t.type === "despesa") {
          const categoryLower = t.category.toLowerCase();
          if (categoryLower === "cmv") {
            cmvExpenses += t.value;
          } else if (categoryLower === "folha") {
            payrollExpenses += t.value;
          } else if (categoryLower === "operacao") { // Identifica despesas de operação
            operationExpenses += t.value;
          } else if (categoryLower === "manutencao") { // Identifica despesas de manutenção
            maintenanceExpenses += t.value;
          } else if (categoryLower === "aluguel") { // Identifica despesas de aluguel
            rentExpenses += t.value;
          }
        }
      }
    });

    const grossOperatingResult = revenues - cmvExpenses;
    const netOperatingResultAfterPayroll = grossOperatingResult - payrollExpenses;
    const totalOperatingExpenses = operationExpenses + maintenanceExpenses + rentExpenses;
    const operatingResult = netOperatingResultAfterPayroll - totalOperatingExpenses; // Novo cálculo

    // Calculate percentages relative to revenues
    const cmvPercentage = revenues > 0 ? (cmvExpenses / revenues) * 100 : 0;
    const grossOperatingResultPercentage = revenues > 0 ? (grossOperatingResult / revenues) * 100 : 0;
    const payrollPercentage = revenues > 0 ? (payrollExpenses / revenues) * 100 : 0;
    const netOperatingResultAfterPayrollPercentage = revenues > 0 ? (netOperatingResultAfterPayroll / revenues) * 100 : 0;
    const operationExpensesPercentage = revenues > 0 ? (operationExpenses / revenues) * 100 : 0;
    const maintenanceExpensesPercentage = revenues > 0 ? (maintenanceExpenses / revenues) * 100 : 0;
    const rentExpensesPercentage = revenues > 0 ? (rentExpenses / revenues) * 100 : 0;
    const operatingResultPercentage = revenues > 0 ? (operatingResult / revenues) * 100 : 0;


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
      operationExpenses,
      maintenanceExpenses,
      rentExpenses,
      operatingResult,
      operationExpensesPercentage,
      maintenanceExpensesPercentage,
      rentExpensesPercentage,
      operatingResultPercentage,
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
            <TableRow>
              <TableCell className="font-medium">(-) Despesas de Operação</TableCell>
              <TableCell className="text-right text-red-600">
                {(-dreSummary.operationExpenses).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.operationExpensesPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">(-) Despesas de Manutenção</TableCell>
              <TableCell className="text-right text-red-600">
                {(-dreSummary.maintenanceExpenses).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.maintenanceExpensesPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">(-) Despesas de Aluguel</TableCell>
              <TableCell className="text-right text-red-600">
                {(-dreSummary.rentExpenses).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.rentExpensesPercentage.toFixed(2)}%)
                  </span>
                )}
              </TableCell>
            </TableRow>
            <TableRow className="font-bold">
              <TableCell>Resultado Operacional</TableCell>
              <TableCell className={`text-right ${dreSummary.operatingResult < 0 ? "text-red-600" : "text-blue-600"}`}>
                {dreSummary.operatingResult.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                {dreSummary.revenues > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({dreSummary.operatingResultPercentage.toFixed(2)}%)
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
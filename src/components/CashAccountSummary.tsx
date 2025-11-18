"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { Transaction } from "./TransactionForm";

interface CashAccountSummaryProps {
  transactions: Transaction[];
}

const CashAccountSummary: React.FC<CashAccountSummaryProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(parseISO(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const cashAccountBalances = useMemo(() => {
    let cofreSummerBalance = 0;
    let pagbankBalance = 0;

    transactions.forEach(t => {
      if (format(parseISO(t.date), "yyyy-MM") === filterMonth) {
        if (t.cashAccount.toLowerCase() === "dinheiro") {
          cofreSummerBalance += (t.type === "receita" ? t.value : -t.value);
        } else {
          pagbankBalance += (t.type === "receita" ? t.value : -t.value);
        }
      }
    });

    return { cofreSummerBalance, pagbankBalance };
  }, [transactions, filterMonth]);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Resumo por Conta Caixa ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Label htmlFor="cashAccountFilterMonth">Mês do Resumo:</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger id="cashAccountFilterMonth" className="w-[180px]">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Cofre Summer (Dinheiro)</p>
            <p className={`text-2xl font-bold ${cashAccountBalances.cofreSummerBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {cashAccountBalances.cofreSummerBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">PagBank (Outras Contas)</p>
            <p className={`text-2xl font-bold ${cashAccountBalances.pagbankBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {cashAccountBalances.pagbankBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashAccountSummary;
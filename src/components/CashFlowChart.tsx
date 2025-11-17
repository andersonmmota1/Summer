"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  ReferenceArea,
} from "recharts";
import { Transaction } from "./TransactionForm";

interface CashFlowChartProps {
  transactions: Transaction[];
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({ transactions }) => {
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => months.add(format(new Date(t.date), "yyyy-MM")));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const cashFlowData = useMemo(() => {
    const start = startOfMonth(parseISO(filterMonth + "-01"));
    const end = endOfMonth(parseISO(filterMonth + "-01"));
    const daysInMonth = eachDayOfInterval({ start, end });

    const dailyBalances: { [key: string]: number } = {};
    daysInMonth.forEach(day => {
      dailyBalances[format(day, "yyyy-MM-dd")] = 0;
    });

    transactions.forEach(t => {
      if (format(new Date(t.date), "yyyy-MM") === filterMonth) {
        const value = t.type === "sale" ? t.value : -t.value;
        dailyBalances[t.date] = (dailyBalances[t.date] || 0) + value;
      }
    });

    let runningBalance = 0;
    return daysInMonth.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      runningBalance += dailyBalances[dateStr] || 0;
      return {
        date: format(day, "MMM dd"),
        balance: runningBalance,
        isPositive: runningBalance >= 0,
      };
    });
  }, [transactions, filterMonth]);

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Monthly Cash Flow Projection ({format(parseISO(filterMonth + "-01"), "MMMM yyyy")})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Label htmlFor="cashFlowFilterMonth">Cash Flow Month:</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger id="cashFlowFilterMonth" className="w-[180px]">
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
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart
              data={cashFlowData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" })} />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
              {cashFlowData.map((entry, index) => {
                if (index > 0) {
                  const prevEntry = cashFlowData[index - 1];
                  if (entry.isPositive !== prevEntry.isPositive) {
                    return (
                      <ReferenceArea
                        key={index}
                        x1={prevEntry.date}
                        x2={entry.date}
                        y1={-Infinity}
                        y2={Infinity}
                        fill={entry.isPositive ? "#e0f2f7" : "#ffe0e0"} // Light blue for positive, light red for negative
                        fillOpacity={0.3}
                      />
                    );
                  }
                }
                return null;
              })}
              {/* Highlight individual points based on positive/negative */}
              {cashFlowData.map((entry, index) => (
                <ReferenceArea
                  key={`point-${index}`}
                  x1={entry.date}
                  x2={entry.date}
                  y1={-Infinity}
                  y2={Infinity}
                  fill={entry.isPositive ? "#e0f2f7" : "#ffe0e0"}
                  fillOpacity={0.3}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
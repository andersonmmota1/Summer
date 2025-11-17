"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  type: "sale" | "expense";
  category: string;
  cashAccount: string;
  value: number;
  date: string; // YYYY-MM-DD
}

interface TransactionFormProps {
  onAddTransaction: (transaction: Transaction) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onAddTransaction }) => {
  const [type, setType] = useState<"sale" | "expense">("sale");
  const [category, setCategory] = useState("");
  const [cashAccount, setCashAccount] = useState("");
  const [value, setValue] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !cashAccount || !value || !date) {
      toast.error("Please fill in all fields.");
      return;
    }

    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Please enter a valid positive value.");
      return;
    }

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type,
      category,
      cashAccount,
      value: parsedValue,
      date: format(date, "yyyy-MM-dd"),
    };

    onAddTransaction(newTransaction);
    toast.success("Transaction added successfully!");

    // Reset form
    setCategory("");
    setCashAccount("");
    setValue("");
    setDate(new Date());
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <div>
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={(value: "sale" | "expense") => setType(value)}>
          <SelectTrigger id="type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale">Sale</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Food, Salary, Rent"
        />
      </div>
      <div>
        <Label htmlFor="cashAccount">Cash Account</Label>
        <Input
          id="cashAccount"
          value={cashAccount}
          onChange={(e) => setCashAccount(e.target.value)}
          placeholder="e.g., Bank, Cash, Credit Card"
        />
      </div>
      <div>
        <Label htmlFor="value">Value</Label>
        <Input
          id="value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          step="0.01"
          min="0"
        />
      </div>
      <div>
        <Label htmlFor="date">Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="col-span-full flex justify-end">
        <Button type="submit">Add Transaction</Button>
      </div>
    </form>
  );
};

export default TransactionForm;
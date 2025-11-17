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
  type: "receita" | "despesa"; // Alterado de "sale" para "receita"
  category: string;
  cashAccount: string;
  value: number;
  date: string; // YYYY-MM-DD
}

interface TransactionFormProps {
  onAddTransaction: (transaction: Transaction) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onAddTransaction }) => {
  const [type, setType] = useState<"receita" | "despesa">("receita"); // Alterado de "sale" para "receita"
  const [category, setCategory] = useState("");
  const [cashAccount, setCashAccount] = useState("");
  const [value, setValue] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !cashAccount || !value || !date) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      toast.error("Por favor, insira um valor positivo válido.");
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
    toast.success("Transação adicionada com sucesso!");

    // Reset form
    setCategory("");
    setCashAccount("");
    setValue("");
    setDate(new Date());
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg shadow-sm bg-card">
      <div>
        <Label htmlFor="type">Tipo</Label>
        <Select value={type} onValueChange={(value: "receita" | "despesa") => setType(value)}> {/* Alterado de "sale" para "receita" */}
          <SelectTrigger id="type">
            <SelectValue placeholder="Selecionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="receita">Receita</SelectItem> {/* Alterado de "Venda" para "Receita" */}
            <SelectItem value="despesa">Despesa</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="category">Categoria</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Ex: Alimentação, Salário, Aluguel"
        />
      </div>
      <div>
        <Label htmlFor="cashAccount">Conta Caixa</Label>
        <Input
          id="cashAccount"
          value={cashAccount}
          onChange={(e) => setCashAccount(e.target.value)}
          placeholder="Ex: Banco, Dinheiro, Cartão de Crédito"
        />
      </div>
      <div>
        <Label htmlFor="value">Valor</Label>
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
        <Label htmlFor="date">Data</Label>
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
              {date ? format(date, "dd/MM/yyyy") : <span>Selecione uma data</span>}
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
        <Button type="submit">Adicionar Transação</Button>
      </div>
    </form>
  );
};

export default TransactionForm;
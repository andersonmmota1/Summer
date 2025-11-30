import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse } from 'date-fns'; // Importar format e parse do date-fns

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string ou número para um float, tratando o padrão numérico brasileiro (vírgula como separador decimal)
 * e também o padrão internacional (ponto como separador decimal) de forma mais robusta.
 *
 * Se a string contiver uma vírgula, ela será tratada como separador decimal (padrão brasileiro).
 * Se não contiver vírgula, mas contiver um ponto, o ponto será tratado como separador decimal (padrão internacional).
 * Caso contrário, parseFloat padrão será aplicado.
 */
export function parseBrazilianFloat(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Se a string contém vírgula, assume-se formato brasileiro
    if (value.includes(',')) {
      // Remove pontos de milhar e substitui a vírgula por ponto para o parseFloat
      const cleanedValue = value.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleanedValue);
    } else {
      // Se não contém vírgula, assume-se formato internacional ou inteiro.
      // parseFloat lida com "1000.50" como 1000.50 e "1000" como 1000.
      return parseFloat(value);
    }
  }
  return NaN; // Retorna NaN para valores inválidos
}

/**
 * Converte uma string de data no formato brasileiro (DD/MM/YYYY) ou um número (data serial do Excel)
 * para uma string no formato YYYY-MM-DD, adequado para o Supabase.
 * @param dateString A string de data ou número a ser convertida.
 * @returns A data formatada como YYYY-MM-DD ou null se inválida.
 */
export function parseBrazilianDate(dateString: string | number): string | null {
  if (typeof dateString === 'number') {
    // Assume que é uma data serial do Excel
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel's epoch is Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + dateString * 24 * 60 * 60 * 1000);
    if (isNaN(date.getTime())) {
      return null;
    }
    return format(date, 'yyyy-MM-dd');
  }

  if (typeof dateString === 'string') {
    // Tenta parsear como DD/MM/YYYY
    const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
    if (!isNaN(parsedDate.getTime())) {
      return format(parsedDate, 'yyyy-MM-dd');
    }
    // Se não for DD/MM/YYYY, tenta parsear como YYYY-MM-DD (já que o Supabase pode retornar assim)
    const parsedIsoDate = parse(dateString, 'yyyy-MM-dd', new Date());
    if (!isNaN(parsedIsoDate.getTime())) {
      return format(parsedIsoDate, 'yyyy-MM-dd');
    }
  }
  return null; // Formato de data inválido
}
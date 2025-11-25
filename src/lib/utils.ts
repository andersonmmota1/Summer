import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
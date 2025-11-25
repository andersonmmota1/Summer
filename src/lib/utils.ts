import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string ou número para um float, tratando o padrão numérico brasileiro (vírgula como separador decimal).
 * Remove pontos de milhar e substitui a vírgula por ponto para o parseFloat.
 */
export function parseBrazilianFloat(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove pontos de milhar e substitui a vírgula por ponto para o parseFloat
    const cleanedValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanedValue);
  }
  return NaN; // Retorna NaN para valores inválidos
}
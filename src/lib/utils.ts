import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse } from 'date-fns'; // Importar format e parse do date-fns

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte uma string ou número para um float, tratando o padrão numérico brasileiro (vírgula como separador decimal)
 * de forma mais robusta.
 *
 * A lógica agora é:
 * 1. Remover todos os pontos (considerados separadores de milhar no padrão brasileiro).
 * 2. Substituir todas as vírgulas (consideradas separadores decimais no padrão brasileiro) por pontos.
 * 3. Aplicar parseFloat.
 *
 * Retorna 0 para valores nulos, indefinidos ou strings vazias.
 */
export function parseBrazilianFloat(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (trimmedValue === '') {
      return 0; // Trata string vazia como zero
    }
    // Remove todos os pontos (separadores de milhar)
    let cleanedValue = trimmedValue.replace(/\./g, '');
    // Substitui a vírgula (separador decimal) por ponto
    cleanedValue = cleanedValue.replace(/,/g, '.');
    
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed; // Retorna 0 se o resultado for NaN
  }
  // Se o valor for null, undefined ou outro tipo não string/não número, retorna 0
  return 0;
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
    // Extrai os componentes UTC para garantir que o dia do calendário seja preservado
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth(); // 0-indexed
    const day = date.getUTCDate();
    // Cria um novo objeto Date no fuso horário local usando esses componentes UTC
    // Isso efetivamente "ajusta" a hora para meia-noite local para aquele dia UTC
    return format(new Date(year, month, day), 'yyyy-MM-dd');
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
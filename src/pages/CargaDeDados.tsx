import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createExcelFile, readExcelFile, createEmptyExcelTemplate } from '@/utils/excel';
import { readXmlFile } from '@/utils/xml';
import { exportPurchasedItemsToXml } from '@/utils/xml-exporter'; // Importar a nova função
import { showSuccess, showError, showLoading, dismissToast, showWarning } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSession } from '@/components/SessionContextProvider';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianFloat, parseBrazilianDate, cn } from '@/lib/utils';
import { useQueryClient, useQuery } from '@tanstack/react-query';
// Form imports
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Interface para os itens comprados diretamente do Supabase (mantida caso seja usada em outro lugar, mas não para preview aqui)
export interface PurchasedItem {
  // Exportar a interface para uso no xml-exporter
  id: string;
  user_id: string;
  c_prod: string;
  descricao_do_produto: string;
  u_com: string;
  q_com: number;
  v_un_com: number;
  created_at: string;
  internal_product_name: string | null;
  invoice_id: string | null;
  item_sequence_number: number | null;
  x_fant: string | null;
  invoice_number: string | null;
  invoice_emission_date: string | null;
  is_manual_entry: boolean; // NOVO: Adicionado campo para entrada manual
  // total_invoice_value?: number | null; // REMOVIDO: Este campo não existe na tabela purchased_items
}

// NOVO: Interface para os dados de vendas horárias lidos do Excel
interface HourlySoldItemData {
  Data: string | number; // Pode ser string (DD/MM/YYYY) ou número serial do Excel
  Grupo: string;
  SubGrupo: string;
  Codigo: string;
  Produto: string;
  '0': number;
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
  '6': number;
  '7': number;
  '8': number;
  '9': number;
  '10': number;
  '11': number;
  '12': number;
  '13': number;
  '14': number;
  '15': number;
  '16': number;
  '17': number;
  '18': number;
  '19': number;
  '20': number;
  '21': number;
  '22': number;
  '23': number;
  Total: number; // Adicionado para ler a coluna Total
}

// NOVO: Estrutura de dados combinada para inserção na tabela sold_daily_hourly_data
interface CombinedHourlySoldItem {
  user_id: string;
  sale_date: string; // YYYY-MM-DD
  group_name: string | null;
  subgroup_name: string | null;
  additional_code: string | null;
  product_name: string;
  quantity_0: number;
  quantity_1: number;
  quantity_2: number;
  quantity_3: number;
  quantity_4: number;
  quantity_5: number;
  quantity_6: number;
  quantity_7: number;
  quantity_8: number;
  quantity_9: number;
  quantity_10: number;
  quantity_11: number;
  quantity_12: number;
  quantity_13: number;
  quantity_14: number;
  quantity_15: number;
  quantity_16: number;
  quantity_17: number;
  quantity_18: number;
  quantity_19: number;
  quantity_20: number;
  quantity_21: number;
  quantity_22: number;
  quantity_23: number;
  value_0: number;
  value_1: number;
  value_2: number;
  value_3: number;
  value_4: number;
  value_5: number;
  value_6: number;
  value_7: number;
  value_8: number;
  value_9: number;
  value_10: number;
  value_11: number;
  value_12: number;
  value_13: number;
  value_14: number;
  value_15: number;
  value_16: number;
  value_17: number;
  value_18: number;
  value_19: number;
  value_20: number;
  value_21: number;
  value_22: number;
  value_23: number;
  total_quantity_sold: number; // NOVO: Total de quantidade vendida do Excel
  total_value_sold: number; // NOVO: Total de valor vendido do Excel
}

// Define o schema para o formulário de entrada manual
const manualEntrySchema = z.object({
  c_prod: z.string().min(1, { message: 'Código do Produto é obrigatório.' }),
  descricao_do_produto: z.string().min(1, { message: 'Descrição do Produto é obrigatória.' }),
  u_com: z.string().min(1, { message: 'Unidade de Compra é obrigatória.' }),
  q_com: z.preprocess(
    (val) => parseBrazilianFloat(val as string | number),
    z.number().min(0.01, { message: 'Quantidade deve ser maior que zero.' })
  ),
  v_un_com: z.preprocess(
    (val) => parseBrazilianFloat(val as string | number),
    z.number().min(0, { message: 'Valor unitário não pode ser negativo.' })
  ),
  invoice_id: z.string().optional(), // Opcional
  invoice_number: z.string().optional(),
  item_sequence_number: z.preprocess(
    (val) => (val === '' ? undefined : Number(val)),
    z.number().int().min(1, { message: 'Número do item deve ser um inteiro positivo.' }).optional()
  ),
  x_fant: z.string().min(1, { message: 'Nome do Fornecedor é obrigatório.' }),
  invoice_emission_date: z.date().optional(), // Objeto Date para o seletor de data
});

type ManualEntryFormValues = z.infer<typeof manualEntrySchema>;

const CargaDeDados: React.FC = () => {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [selectedXmlFiles, setSelectedXmlFiles] = useState<File[]>([]); // ATUALIZADO: Agora dois arquivos para produtos vendidos
  const [selectedSoldItemsQuantityExcelFile, setSelectedSoldItemsQuantityExcelFile] = useState<File | null>(null);
  const [selectedSoldItemsValueExcelFile, setSelectedSoldItemsValueExcelFile] = useState<File | null>(null);
  const [selectedProductRecipeExcelFile, setSelectedProductRecipeExcelFile] = useState<File | null>(null);
  const [selectedProductNameConversionExcelFile, setSelectedProductNameConversionExcelFile] = useState<File | null>(null);
  const [selectedUnitConversionExcelFile, setSelectedUnitConversionExcelFile] = useState<File | null>(null);
  // NOVO: Estados para a pré-visualização dos dados de produtos vendidos (separados por tipo)
  const [loadedSoldItemsQuantityPreview, setLoadedSoldItemsQuantityPreview] = useState<Record<string, any[] | null>>({});
  const [loadedSoldItemsValuePreview, setLoadedSoldItemsValuePreview] = useState<Record<string, any[] | null>>({});
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  // ATUALIZADO: Novos cabeçalhos para produtos vendidos (agora para ambos os arquivos)
  const soldItemsTemplateHeaders = ['Data', 'Grupo', 'SubGrupo', 'Codigo', 'Produto', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', 'Total'];
  const productRecipeTemplateHeaders = ['Produto Vendido', 'Nome Interno', 'Quantidade Necessária'];
  const productNameConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Descrição Produto Fornecedor', 'Nome Interno do Produto'];
  const unitConversionTemplateHeaders = ['Código Fornecedor', 'Nome Fornecedor', 'Descrição Produto Fornecedor', 'Unidade Fornecedor', 'Unidade Interna', 'Fator de Conversão'];

  // Hook de formulário para entrada manual
  const form = useForm<ManualEntryFormValues>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      c_prod: '',
      descricao_do_produto: '',
      u_com: '',
      q_com: 0,
      v_un_com: 0,
      invoice_id: '',
      invoice_number: '',
      item_sequence_number: undefined,
      x_fant: '',
      invoice_emission_date: undefined,
    },
  });

  // Queries para buscar valores únicos para datalists
  const { data: uniqueCProds } = useQuery<string[], Error>({
    queryKey: ['unique_c_prods', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('c_prod', { distinct: true })
        .eq('user_id', user.id);
      if (error) throw error;
      // Filtrar null/undefined, remover espaços e garantir unicidade com Set
      const uniqueValues = Array.from(new Set(
        data
          ?.map(item => item.c_prod)
          .filter((val): val is string => val !== null && val !== undefined && val.trim() !== '')
          .map(val => val.trim())
      ));
      return uniqueValues.sort(); // Opcional: ordenar para melhor visualização
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60, // Cache por 1 hora
  });

  const { data: uniqueDescricoes } = useQuery<string[], Error>({
    queryKey: ['unique_descricoes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('descricao_do_produto', { distinct: true })
        .eq('user_id', user.id); // CORRIGIDO: user.id para user_id
      if (error) throw error;
      // Filtrar null/undefined, remover espaços e garantir unicidade com Set
      const uniqueValues = Array.from(new Set(
        data
          ?.map(item => item.descricao_do_produto)
          .filter((val): val is string => val !== null && val !== undefined && val.trim() !== '')
          .map(val => val.trim())
      ));
      return uniqueValues.sort(); // Opcional: ordenar para melhor visualização
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60,
  });

  const { data: uniqueUComs } = useQuery<string[], Error>({
    queryKey: ['unique_u_coms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('u_com', { distinct: true })
        .eq('user_id', user.id);
      if (error) throw error;
      // Filtrar null/undefined, remover espaços e garantir unicidade com Set
      const uniqueValues = Array.from(new Set(
        data
          ?.map(item => item.u_com)
          .filter((val): val is string => val !== null && val !== undefined && val.trim() !== '')
          .map(val => val.trim())
      ));
      return uniqueValues.sort(); // Opcional: ordenar para melhor visualização
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60,
  });

  const { data: uniqueXFants } = useQuery<string[], Error>({
    queryKey: ['unique_x_fants', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('purchased_items')
        .select('x_fant', { distinct: true })
        .eq('user_id', user.id);
      if (error) throw error;
      // Filtrar null/undefined, remover espaços e garantir unicidade com Set
      const uniqueValues = Array.from(new Set(
        data
          ?.map(item => item.x_fant)
          .filter((val): val is string => val !== null && val !== undefined && val.trim() !== '')
          .map(val => val.trim())
      ));
      return uniqueValues.sort(); // Opcional: ordenar para melhor visualização
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 60,
  });

  const handleXmlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedXmlFiles(Array.from(event.target.files));
    } else {
      setSelectedXmlFiles([]);
    }
  };

  // NOVO: Handlers para os dois arquivos de produtos vendidos
  const handleSoldItemsQuantityExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedSoldItemsQuantityExcelFile(event.target.files[0]);
      setLoadedSoldItemsQuantityPreview({}); // Limpa a prévia ao selecionar novos arquivos
    } else {
      setSelectedSoldItemsQuantityExcelFile(null);
      setLoadedSoldItemsQuantityPreview({});
    }
  };

  const handleSoldItemsValueExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedSoldItemsValueExcelFile(event.target.files[0]);
      setLoadedSoldItemsValuePreview({}); // Limpa a prévia ao selecionar novos arquivos
    } else {
      setSelectedSoldItemsValueExcelFile(null);
      setLoadedSoldItemsValuePreview({});
    }
  };

  const handleProductRecipeExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedProductRecipeExcelFile(event.target.files[0]);
    } else {
      setSelectedProductRecipeExcelFile(null);
    }
  };

  const handleProductNameConversionExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedProductNameConversionExcelFile(event.target.files[0]);
    } else {
      setSelectedProductNameConversionExcelFile(null);
    }
  };

  const handleUnitConversionExcelFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedUnitConversionExcelFile(event.target.files[0]);
    } else {
      setSelectedUnitConversionExcelFile(null);
    }
  };

  const handleUploadXml = async () => {
    if (selectedXmlFiles.length === 0) {
      showError('Por favor, selecione um ou mais arquivos XML para carregar.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar itens comprados.');
      return;
    }
    const loadingToastId = showLoading(`Carregando ${selectedXmlFiles.length} arquivo(s) XML...`);
    let totalItemsLoaded = 0;
    let hasError = false;
    for (const file of selectedXmlFiles) {
      try {
        const data = await readXmlFile(file);
        if (!data || data.length === 0) {
          showError(`O arquivo XML "${file.name}" está vazio ou não contém dados válidos.`);
          hasError = true;
          continue;
        }
        const formattedData = data.map((row: any) => {
          const rawInvoiceEmissionDate = row.invoice_emission_date; // This is dhEmi from XML
          let parsedEmissionDate: string | null = null;
          if (rawInvoiceEmissionDate) {
            const dateObj = parseISO(rawInvoiceEmissionDate);
            if (isValid(dateObj)) {
              // Extrai os componentes UTC para garantir que o dia do calendário seja preservado
              const year = dateObj.getUTCFullYear();
              const month = dateObj.getUTCMonth(); // 0-indexed
              const day = dateObj.getUTCDate();
              // Cria um novo objeto Date no fuso horário local usando esses componentes UTC
              parsedEmissionDate = format(new Date(year, month, day), 'yyyy-MM-dd');
            } else {
              console.warn(`Data de emissão inválida encontrada no XML: "${rawInvoiceEmissionDate}". Definindo como NULL.`);
            }
          }
          return {
            user_id: user.id,
            c_prod: String(row['ns1:cProd']),
            descricao_do_produto: String(row['descricao_do_produto']),
            u_com: String(row['ns1:uCom']),
            q_com: parseBrazilianFloat(row['ns1:qCom']), // Usando parseFloat para XML
            v_un_com: parseBrazilianFloat(row['ns1:vUnCom']), // Usando parseFloat para XML
            invoice_id: row.invoice_id,
            invoice_number: row.invoice_number,
            item_sequence_number: row.item_sequence_number,
            x_fant: row.x_fant,
            invoice_emission_date: parsedEmissionDate,
            is_manual_entry: false, // XML uploads are not manual entries
            // total_invoice_value: row.total_invoice_value || null, // REMOVIDO: Este campo não existe na tabela purchased_items
          };
        });
        const { error } = await supabase
          .from('purchased_items')
          .upsert(formattedData, {
            onConflict: 'user_id, invoice_id, item_sequence_number',
            ignoreDuplicates: true
          });
        if (error) {
          showError(`Erro ao carregar dados do XML "${file.name}": ${error.message}`);
          hasError = true;
          continue;
        }
        totalItemsLoaded += formattedData.length;
        showSuccess(`Dados de ${formattedData.length} itens de "${file.name}" carregados com sucesso!`);
      } catch (error: any) {
        showError(`Erro ao carregar dados do XML "${file.name}": ${error.message || 'Verifique o console para mais detalhes.'}`);
        hasError = true;
      }
    }
    dismissToast(loadingToastId);
    if (!hasError) {
      showSuccess(`Carga de ${selectedXmlFiles.length} arquivo(s) XML concluída. Total de ${totalItemsLoaded} itens carregados.`);
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] }); // Invalida a query da Análise de Fornecedor
      queryClient.invalidateQueries({ queryKey: ['unique_c_prods'] }); // Invalida o cache de valores únicos
      queryClient.invalidateQueries({ queryKey: ['unique_descricoes'] });
      queryClient.invalidateQueries({ queryKey: ['unique_u_coms'] });
      queryClient.invalidateQueries({ queryKey: ['unique_x_fants'] });
    } else {
      showError('Carga de XML concluída com alguns erros. Verifique as mensagens acima.');
    }
    setSelectedXmlFiles([]);
  };

  // ATUALIZADO: Lógica de upload para os dois arquivos de produtos vendidos
  const handleUploadSoldItemsExcel = async () => {
    if (!selectedSoldItemsQuantityExcelFile || !selectedSoldItemsValueExcelFile) {
      showError('Por favor, selecione ambos os arquivos Excel (quantidade e valor) para carregar produtos vendidos.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar produtos vendidos.');
      return;
    }

    const loadingToastId = showLoading('Carregando dados de produtos vendidos (quantidade e valor)...');
    let hasOverallError = false;
    const datesToProcess = new Set<string>();
    const combinedDataMap = new Map<string, CombinedHourlySoldItem>();

    try {
      // --- Process Quantity File ---
      console.log("Iniciando leitura do arquivo de quantidade:", selectedSoldItemsQuantityExcelFile.name);
      const quantityData: HourlySoldItemData[] = await readExcelFile(selectedSoldItemsQuantityExcelFile);
      console.log("Dados lidos do arquivo de quantidade:", quantityData);
      setLoadedSoldItemsQuantityPreview({ [selectedSoldItemsQuantityExcelFile.name]: quantityData });

      quantityData.forEach((row, rowIndex) => {
        const saleDateString = parseBrazilianDate(row['Data']);
        console.log(`Linha ${rowIndex + 2} - Data lida:`, row['Data'], " - Data parseada:", saleDateString);
        if (!saleDateString) {
          showWarning(`Arquivo de Quantidade, Linha ${rowIndex + 2}: Data inválida ou vazia "${row['Data']}". Esta linha será ignorada.`);
          hasOverallError = true;
          return;
        }
        datesToProcess.add(saleDateString);
        const key = `${saleDateString}|${row['Grupo'] || ''}|${row['SubGrupo'] || ''}|${row['Codigo'] || ''}|${row['Produto'] || ''}`;
        if (!combinedDataMap.has(key)) {
          combinedDataMap.set(key, {
            user_id: user.id,
            sale_date: saleDateString,
            group_name: row['Grupo'] || null,
            subgroup_name: row['SubGrupo'] || null,
            additional_code: row['Codigo'] || null,
            product_name: row['Produto'] || '',
            quantity_0: 0,
            quantity_1: 0,
            quantity_2: 0,
            quantity_3: 0,
            quantity_4: 0,
            quantity_5: 0,
            quantity_6: 0,
            quantity_7: 0,
            quantity_8: 0,
            quantity_9: 0,
            quantity_10: 0,
            quantity_11: 0,
            quantity_12: 0,
            quantity_13: 0,
            quantity_14: 0,
            quantity_15: 0,
            quantity_16: 0,
            quantity_17: 0,
            quantity_18: 0,
            quantity_19: 0,
            quantity_20: 0,
            quantity_21: 0,
            quantity_22: 0,
            quantity_23: 0,
            value_0: 0,
            value_1: 0,
            value_2: 0,
            value_3: 0,
            value_4: 0,
            value_5: 0,
            value_6: 0,
            value_7: 0,
            value_8: 0,
            value_9: 0,
            value_10: 0,
            value_11: 0,
            value_12: 0,
            value_13: 0,
            value_14: 0,
            value_15: 0,
            value_16: 0,
            value_17: 0,
            value_18: 0,
            value_19: 0,
            value_20: 0,
            value_21: 0,
            value_22: 0,
            value_23: 0,
            total_quantity_sold: 0, // Inicializa o novo campo
            total_value_sold: 0, // Inicializa o novo campo
          });
        }
        const currentItem = combinedDataMap.get(key)!;
        for (let i = 0; i <= 23; i++) {
          currentItem[`quantity_${i}` as keyof CombinedHourlySoldItem] = parseBrazilianFloat(row[String(i)] || 0);
        }
        // --- CORREÇÃO: Leitura da coluna Total de forma robusta ---
        // Encontra a chave real da coluna 'Total' no objeto row
        const totalQuantityKey = Object.keys(row).find(key => key.trim().toLowerCase() === 'total');
        if (totalQuantityKey) {
          currentItem.total_quantity_sold = parseBrazilianFloat(row[totalQuantityKey]);
        } else {
          console.warn(`Coluna 'Total' não encontrada na linha ${rowIndex + 2} do arquivo de quantidade.`);
          // Opcional: Calcular o total manualmente se a coluna não existir
          // let calculatedTotal = 0;
          // for (let i = 0; i <= 23; i++) {
          //   calculatedTotal += currentItem[`quantity_${i}` as keyof CombinedHourlySoldItem] as number;
          // }
          // currentItem.total_quantity_sold = calculatedTotal;
        }
        // ---
        console.log(`Linha ${rowIndex + 2} - Item agregado (quantidade):`, currentItem);
      });

      // --- Process Value File ---
      console.log("Iniciando leitura do arquivo de valor:", selectedSoldItemsValueExcelFile.name);
      const valueData: HourlySoldItemData[] = await readExcelFile(selectedSoldItemsValueExcelFile);
      console.log("Dados lidos do arquivo de valor:", valueData);
      setLoadedSoldItemsValuePreview({ [selectedSoldItemsValueExcelFile.name]: valueData });

      valueData.forEach((row, rowIndex) => {
        const saleDateString = parseBrazilianDate(row['Data']);
        console.log(`Linha ${rowIndex + 2} - Data lida:`, row['Data'], " - Data parseada:", saleDateString);
        if (!saleDateString) {
          showWarning(`Arquivo de Valor, Linha ${rowIndex + 2}: Data inválida ou vazia "${row['Data']}". Esta linha será ignorada.`);
          hasOverallError = true;
          return;
        }
        datesToProcess.add(saleDateString);
        const key = `${saleDateString}|${row['Grupo'] || ''}|${row['SubGrupo'] || ''}|${row['Codigo'] || ''}|${row['Produto'] || ''}`;
        if (!combinedDataMap.has(key)) {
          // If a product exists in value file but not quantity, initialize it
          combinedDataMap.set(key, {
            user_id: user.id,
            sale_date: saleDateString,
            group_name: row['Grupo'] || null,
            subgroup_name: row['SubGrupo'] || null,
            additional_code: row['Codigo'] || null,
            product_name: row['Produto'] || '',
            quantity_0: 0,
            quantity_1: 0,
            quantity_2: 0,
            quantity_3: 0,
            quantity_4: 0,
            quantity_5: 0,
            quantity_6: 0,
            quantity_7: 0,
            quantity_8: 0,
            quantity_9: 0,
            quantity_10: 0,
            quantity_11: 0,
            quantity_12: 0,
            quantity_13: 0,
            quantity_14: 0,
            quantity_15: 0,
            quantity_16: 0,
            quantity_17: 0,
            quantity_18: 0,
            quantity_19: 0,
            quantity_20: 0,
            quantity_21: 0,
            quantity_22: 0,
            quantity_23: 0,
            value_0: 0,
            value_1: 0,
            value_2: 0,
            value_3: 0,
            value_4: 0,
            value_5: 0,
            value_6: 0,
            value_7: 0,
            value_8: 0,
            value_9: 0,
            value_10: 0,
            value_11: 0,
            value_12: 0,
            value_13: 0,
            value_14: 0,
            value_15: 0,
            value_16: 0,
            value_17: 0,
            value_18: 0,
            value_19: 0,
            value_20: 0,
            value_21: 0,
            value_22: 0,
            value_23: 0,
            total_quantity_sold: 0, // Inicializa o novo campo
            total_value_sold: 0, // Inicializa o novo campo
          });
        }
        const combinedItem = combinedDataMap.get(key)!;
        for (let i = 0; i <= 23; i++) {
          combinedItem[`value_${i}` as keyof CombinedHourlySoldItem] = parseBrazilianFloat(row[String(i)] || 0);
        }
        // --- CORREÇÃO: Leitura da coluna Total de forma robusta ---
        // Encontra a chave real da coluna 'Total' no objeto row
        const totalValueKey = Object.keys(row).find(key => key.trim().toLowerCase() === 'total');
        if (totalValueKey) {
          combinedItem.total_value_sold = parseBrazilianFloat(row[totalValueKey]);
        } else {
          console.warn(`Coluna 'Total' não encontrada na linha ${rowIndex + 2} do arquivo de valor.`);
          // Opcional: Calcular o total manualmente se a coluna não existir
          // let calculatedTotal = 0;
          // for (let i = 0; i <= 23; i++) {
          //   calculatedTotal += combinedItem[`value_${i}` as keyof CombinedHourlySoldItem] as number;
          // }
          // combinedItem.total_value_sold = calculatedTotal;
        }
        // ---
        console.log(`Linha ${rowIndex + 2} - Item agregado (valor):`, combinedItem);
      });

      const finalDataToInsert = Array.from(combinedDataMap.values());
      console.log("Dados finais a serem inseridos:", finalDataToInsert);
      if (finalDataToInsert.length === 0) {
        dismissToast(loadingToastId);
        showWarning('Nenhum dado válido para produtos vendidos foi encontrado nos arquivos selecionados após a validação.');
        setSelectedSoldItemsQuantityExcelFile(null);
        setSelectedSoldItemsValueExcelFile(null);
        return;
      }

      // --- Deletion Logic for sold_daily_hourly_data ---
      for (const dateString of datesToProcess) {
        console.log("Verificando/excluindo dados existentes para a data:", dateString);
        const { count, error: countError } = await supabase
          .from('sold_daily_hourly_data')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('sale_date', dateString);

        if (countError) {
          showError(`Erro ao verificar produtos vendidos existentes para a data ${dateString}: ${countError.message}`);
          hasOverallError = true;
          continue;
        }
        if (count && count > 0) {
          const { error: deleteError } = await supabase
            .from('sold_daily_hourly_data')
            .delete()
            .eq('user_id', user.id)
            .eq('sale_date', dateString);
          if (deleteError) {
            showError(`Erro ao limpar produtos vendidos para a data ${dateString}: ${deleteError.message}`);
            hasOverallError = true;
          } else {
            showWarning(`Produtos vendidos existentes para a data ${format(parseISO(dateString), 'dd/MM/yyyy')} foram removidos.`);
          }
        }
      }

      // --- Insertion Logic for sold_daily_hourly_data ---
      console.log("Inserindo novos dados...");
      const { error: insertError } = await supabase
        .from('sold_daily_hourly_data')
        .insert(finalDataToInsert);

      if (insertError) {
        console.error("Erro ao inserir dados:", insertError);
        showError(`Erro ao carregar dados de produtos vendidos para o Supabase: ${insertError.message}`);
        hasOverallError = true;
      } else {
        showSuccess(`Total de ${finalDataToInsert.length} registros de produtos vendidos carregados com sucesso!`);
      }

    } catch (error: any) {
      console.error('Erro geral ao carregar dados de produtos vendidos:', error);
      showError(`Erro geral ao carregar dados de produtos vendidos: ${error.message || 'Verifique o console para mais detalhes.'}`);
      hasOverallError = true;
    } finally {
      dismissToast(loadingToastId);
      if (!hasOverallError) {
        showSuccess('Carga de produtos vendidos concluída com sucesso!');
        // Invalidate all relevant queries that might use the new sold_items view
        queryClient.invalidateQueries({ queryKey: ['sold_items'] });
        queryClient.invalidateQueries({ queryKey: ['aggregated_sold_products'] });
        queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
        queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
        queryClient.invalidateQueries({ queryKey: ['consumed_items_from_sales'] });
        queryClient.invalidateQueries({ queryKey: ['sales_by_date', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['all_sold_items_raw', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['all_sold_items_vendas_por_data', user?.id] }); // For VendasPorData
      } else {
        showError('Carga de produtos vendidos concluída com alguns erros. Verifique as mensagens acima.');
      }
      setSelectedSoldItemsQuantityExcelFile(null);
      setSelectedSoldItemsValueExcelFile(null);
      setLoadedSoldItemsQuantityPreview({});
      setLoadedSoldItemsValuePreview({});
    }
  };

  // NOVO: Função para upload de Ficha Técnica
  const handleUploadProductRecipeExcel = async () => {
    if (!selectedProductRecipeExcelFile) {
      showError('Por favor, selecione um arquivo Excel de ficha técnica para carregar.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar fichas técnicas.');
      return;
    }
    const loadingToastId = showLoading('Carregando ficha técnica de produtos...');
    let hasError = false;
    try {
      const data: any[] = await readExcelFile(selectedProductRecipeExcelFile);
      if (!data || data.length === 0) {
        showError(`O arquivo Excel "${selectedProductRecipeExcelFile.name}" está vazio ou não contém dados válidos.`);
        dismissToast(loadingToastId);
        return;
      }
      // Deduplicar os dados antes de formatar e enviar
      const uniqueRecipes = new Map<string, any>();
      data.forEach((row: any, index: number) => {
        const soldProductName = String(row['Produto Vendido']).trim();
        const internalProductName = String(row['Nome Interno']).trim();
        if (!soldProductName || !internalProductName) {
          showWarning(`Linha ${index + 2} do arquivo de Ficha Técnica ignorada: 'Produto Vendido' ou 'Nome Interno' está vazio.`);
          return;
        }
        const key = `${soldProductName}-${internalProductName}`; // Chave de unicidade
        if (uniqueRecipes.has(key)) {
          showWarning(`Linha ${index + 2} do arquivo de Ficha Técnica: Duplicata para Produto Vendido "${soldProductName}" e Nome Interno "${internalProductName}" encontrada e ignorada.`);
        } else {
          uniqueRecipes.set(key, {
            user_id: user.id,
            sold_product_name: soldProductName,
            internal_product_name: internalProductName,
            quantity_needed: parseBrazilianFloat(row['Quantidade Necessária']),
          });
        }
      });
      const formattedData = Array.from(uniqueRecipes.values());
      if (formattedData.length === 0) {
        showWarning('Nenhuma ficha técnica válida foi encontrada no arquivo após a deduplicação.');
        dismissToast(loadingToastId);
        setSelectedProductRecipeExcelFile(null);
        return;
      }
      const { error } = await supabase
        .from('product_recipes')
        .upsert(formattedData, {
          onConflict: 'user_id, sold_product_name, internal_product_name',
          ignoreDuplicates: false
        }); // Atualiza se houver conflito
      if (error) {
        throw new Error(error.message);
      }
      showSuccess(`Dados de ${formattedData.length} fichas técnicas carregados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao carregar ficha técnica: ${error.message || 'Verifique o console para mais detalhes.'}`);
      hasError = true;
    } finally {
      dismissToast(loadingToastId);
      if (!hasError) {
        queryClient.invalidateQueries({ queryKey: ['product_recipes'] });
        queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
        queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
        queryClient.invalidateQueries({ queryKey: ['internal_product_usage'] });
        queryClient.invalidateQueries({ queryKey: ['sold_product_recipe_details'] });
        queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['product_recipes_internal_products', user?.id] }); // Invalida para Produtos Internos Não Utilizados
      }
      setSelectedProductRecipeExcelFile(null);
    }
  };

  // NOVO: Função para upload de Conversão de Nomes de Produtos
  const handleUploadProductNameConversionExcel = async () => {
    if (!selectedProductNameConversionExcelFile) {
      showError('Por favor, selecione um arquivo Excel de conversão de nomes para carregar.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar conversões de nomes de produtos.');
      return;
    }
    const loadingToastId = showLoading('Carregando conversões de nomes de produtos...');
    let hasError = false;
    try {
      const data: any[] = await readExcelFile(selectedProductNameConversionExcelFile);
      if (!data || data.length === 0) {
        showError(`O arquivo Excel "${selectedProductNameConversionExcelFile.name}" está vazio ou não contém dados válidos.`);
        dismissToast(loadingToastId);
        return;
      }
      // Deduplicar os dados antes de formatar e enviar
      const uniqueConversions = new Map<string, any>();
      data.forEach((row: any, index: number) => {
        const supplierProductCode = String(row['Código Fornecedor']).trim();
        const supplierName = String(row['Nome Fornecedor']).trim();
        if (!supplierProductCode || !supplierName) {
          showWarning(`Linha ${index + 2} do arquivo de Conversão de Nomes ignorada: 'Código Fornecedor' ou 'Nome Fornecedor' está vazio.`);
          return;
        }
        const key = `${user.id}-${supplierProductCode}-${supplierName}`; // Chave de unicidade
        if (uniqueConversions.has(key)) {
          showWarning(`Linha ${index + 2} do arquivo de Conversão de Nomes: Duplicata para Código Fornecedor "${supplierProductCode}" e Nome Fornecedor "${supplierName}" encontrada e ignorada.`);
        } else {
          uniqueConversions.set(key, {
            user_id: user.id,
            supplier_product_code: supplierProductCode,
            supplier_name: supplierName,
            supplier_product_name: String(row['Descrição Produto Fornecedor']),
            internal_product_name: String(row['Nome Interno do Produto']),
          });
        }
      });
      const formattedData = Array.from(uniqueConversions.values());
      if (formattedData.length === 0) {
        showWarning('Nenhuma conversão de nome de produto válida foi encontrada no arquivo após a deduplicação.');
        dismissToast(loadingToastId);
        setSelectedProductNameConversionExcelFile(null);
        return;
      }
      const { error } = await supabase
        .from('product_name_conversions')
        .upsert(formattedData, {
          onConflict: 'user_id, supplier_product_code, supplier_name',
          ignoreDuplicates: false
        });
      if (error) {
        throw new Error(error.message);
      }
      showSuccess(`Dados de ${formattedData.length} conversões de nomes de produtos carregados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao carregar conversões de nomes de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
      hasError = true;
    } finally {
      dismissToast(loadingToastId);
      if (!hasError) {
        queryClient.invalidateQueries({ queryKey: ['product_name_conversions'] });
        queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
        queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
        queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product_and_supplier'] });
        queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
        queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
        queryClient.invalidateQueries({ queryKey: ['product_name_conversions_for_analysis', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['product_name_conversions_stock', user?.id] });
      }
      setSelectedProductNameConversionExcelFile(null);
    }
  };

  // NOVO: Função para upload de Conversão de Unidades
  const handleUploadUnitConversionExcel = async () => {
    if (!selectedUnitConversionExcelFile) {
      showError('Por favor, selecione um arquivo Excel de conversão de unidades para carregar.');
      return;
    }
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar conversões de unidades.');
      return;
    }
    const loadingToastId = showLoading('Carregando conversões de unidades...');
    let hasError = false;
    try {
      const data: any[] = await readExcelFile(selectedUnitConversionExcelFile);
      if (!data || data.length === 0) {
        showError(`O arquivo Excel "${selectedUnitConversionExcelFile.name}" está vazio ou não contém dados válidos.`);
        dismissToast(loadingToastId);
        return;
      }
      const formattedData = data.map((row: any) => ({
        user_id: user.id,
        supplier_product_code: String(row['Código Fornecedor']),
        supplier_name: String(row['Nome Fornecedor']),
        supplier_product_description: String(row['Descrição Produto Fornecedor']),
        supplier_unit: String(row['Unidade Fornecedor']),
        internal_unit: String(row['Unidade Interna']),
        conversion_factor: parseBrazilianFloat(row['Fator de Conversão']),
      }));
      const { error } = await supabase
        .from('unit_conversions')
        .upsert(formattedData, {
          onConflict: 'user_id, supplier_product_code, supplier_name, supplier_unit',
          ignoreDuplicates: false
        });
      if (error) {
        throw new Error(error.message);
      }
      showSuccess(`Dados de ${formattedData.length} conversões de unidades carregados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao carregar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
      hasError = true;
    } finally {
      dismissToast(loadingToastId);
      if (!hasError) {
        queryClient.invalidateQueries({ queryKey: ['unit_conversions'] });
        queryClient.invalidateQueries({ queryKey: ['unmapped_unit_conversions_summary'] });
        queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
        queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
        queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      }
      setSelectedUnitConversionExcelFile(null);
    }
  };

  const handleDownloadSoldItemsTemplate = () => {
    const blob = createEmptyExcelTemplate(soldItemsTemplateHeaders, 'Template_ProdutosVendidos');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_produtos_vendidos.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de produtos vendidos baixado com sucesso!');
  };

  const handleDownloadProductRecipeTemplate = () => {
    const blob = createEmptyExcelTemplate(productRecipeTemplateHeaders, 'Template_FichaTecnica');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_ficha_tecnica.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de ficha técnica de produtos baixado com sucesso!');
  };

  const handleDownloadProductNameConversionTemplate = () => {
    const blob = createEmptyExcelTemplate(productNameConversionTemplateHeaders, 'Template_ConversaoNomes');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_conversao_nomes_produtos.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de conversão de nomes de produtos baixado com sucesso!');
  };

  const handleDownloadUnitConversionTemplate = () => {
    const blob = createEmptyExcelTemplate(unitConversionTemplateHeaders, 'Template_ConversaoUnidades');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_conversao_unidades.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('Template de conversão de unidades baixado com sucesso!');
  };

  const handleDownloadAllPurchasedItems = async () => {
    const loadingToastId = showLoading('Baixando todos os itens comprados...');
    try {
      const { data, error } = await supabase
        .from('purchased_items')
        .select('id, user_id, c_prod, descricao_do_produto, u_com, q_com, v_un_com, created_at, internal_product_name, invoice_id, item_sequence_number, x_fant, invoice_number, invoice_emission_date, is_manual_entry') // Listar explicitamente as colunas, removendo total_invoice_value
        .eq('user_id', user?.id) // Filtrar por user_id
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhum item comprado encontrado para baixar.');
        return;
      }
      const headers = [
        'ID do Item',
        'Código Fornecedor',
        'Descrição do Produto',
        'Unidade',
        'Quantidade',
        'Valor Unitário',
        'Nome Interno',
        'Nome Fantasia Fornecedor',
        'Número da Nota (Sequencial)',
        'ID da Nota (Chave de Acesso)',
        'Número do Item na Nota',
        'Data de Emissão da NF',
        'Data de Registro no Sistema',
        'Entrada Manual',
      ];
      const formattedData = data.map(item => ({
        'ID do Item': item.id,
        'Código Fornecedor': item.c_prod,
        'Descrição do Produto': item.descricao_do_produto,
        'Unidade': item.u_com,
        'Quantidade': item.q_com,
        'Valor Unitário': item.v_un_com,
        'Nome Interno': item.internal_product_name || 'Não Mapeado',
        'Nome Fantasia Fornecedor': item.x_fant || 'N/A',
        'Número da Nota (Sequencial)': item.invoice_number || 'N/A',
        'ID da Nota (Chave de Acesso)': item.invoice_id || 'N/A',
        'Número do Item na Nota': item.item_sequence_number || 'N/A',
        'Data de Emissão da NF': item.invoice_emission_date ? format(parseISO(item.invoice_emission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A',
        'Data de Registro no Sistema': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        'Entrada Manual': item.is_manual_entry ? 'Sim' : 'Não',
      }));
      const blob = createExcelFile(formattedData, headers, 'ItensCompradosDetalhado');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'itens_comprados_detalhado.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} itens comprados detalhados baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar itens comprados: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // NOVO: Função para baixar todos os itens comprados em formato XML
  const handleDownloadAllPurchasedItemsXml = async () => {
    const loadingToastId = showLoading('Baixando todos os itens comprados em XML...');
    try {
      const { data, error } = await supabase
        .from('purchased_items')
        .select('id, user_id, c_prod, descricao_do_produto, u_com, q_com, v_un_com, created_at, internal_product_name, invoice_id, item_sequence_number, x_fant, invoice_number, invoice_emission_date, is_manual_entry') // Removendo total_invoice_value
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhum item comprado encontrado para baixar em XML.');
        return;
      }
      // A função exportPurchasedItemsToXml agora não usará raw_xml_data
      const xmlContent = exportPurchasedItemsToXml(data);
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Determinar o nome do arquivo
      let filename = 'itens_comprados_detalhado.xml';
      if (data.length > 0 && data[0].invoice_id) {
        // Usar o invoice_id do primeiro item e sanitizá-lo para o nome do arquivo
        const sanitizedInvoiceId = data[0].invoice_id.replace(/[^a-zA-Z0-9-]/g, '_');
        filename = `${sanitizedInvoiceId}.xml`;
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} itens comprados detalhados baixados em XML com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar itens comprados em XML: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // ATUALIZADO: Lógica de download para todos os produtos vendidos da nova tabela
  const handleDownloadAllSoldItems = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar produtos vendidos.');
      return;
    }
    const loadingToastId = showLoading('Baixando todos os produtos vendidos...');
    try {
      const { data, error } = await supabase
        .from('sold_daily_hourly_data') // Query a nova tabela
        .select('*')
        .eq('user_id', user.id)
        .order('sale_date', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhum produto vendido encontrado para baixar.');
        return;
      }
      // Definir cabeçalhos detalhados para quantidades e valores horários
      const detailedSoldItemsHeaders = [
        'Data',
        'Grupo',
        'SubGrupo',
        'Codigo',
        'Produto',
        ...Array.from({ length: 24 }, (_, i) => `Qtd_${i}`), // Qtd_0, Qtd_1, ... Qtd_23
        ...Array.from({ length: 24 }, (_, i) => `Valor_${i}`), // Valor_0, Valor_1, ... Valor_23
        'Total Qtd',
        'Total Valor'
      ];
      const formattedData = data.map(item => {
        const row: Record<string, any> = {
          'Data': format(parseISO(item.sale_date), 'dd/MM/yyyy', { locale: ptBR }),
          'Grupo': item.group_name || '',
          'SubGrupo': item.subgroup_name || '',
          'Codigo': item.additional_code || '',
          'Produto': item.product_name,
        };
        // Usa os novos campos total_quantity_sold e total_value_sold
        row['Total Qtd'] = item.total_quantity_sold;
        row['Total Valor'] = item.total_value_sold;
        for (let i = 0; i <= 23; i++) {
          const quantityKey = `quantity_${i}` as keyof CombinedHourlySoldItem;
          const valueKey = `value_${i}` as keyof CombinedHourlySoldItem;
          row[`Qtd_${i}`] = item[quantityKey] as number; // Passa o número puro
          row[`Valor_${i}`] = item[valueKey] as number; // Passa o número puro
        }
        return row;
      });
      const blob = createExcelFile(formattedData, detailedSoldItemsHeaders, 'ProdutosVendidosDetalhado');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'produtos_vendidos_detalhado.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} produtos vendidos detalhados baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar produtos vendidos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllProductRecipes = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar fichas técnicas.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as fichas técnicas de produtos...');
    try {
      const { data, error } = await supabase
        .from('product_recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('sold_product_name', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhuma ficha técnica de produto encontrada para baixar.');
        return;
      }
      const headers = [
        'ID da Ficha Técnica',
        'Produto Vendido',
        'Nome Interno',
        'Quantidade Necessária',
        'Data de Registro',
      ];
      const formattedData = data.map(item => ({
        'ID da Ficha Técnica': item.id,
        'Produto Vendido': item.sold_product_name,
        'Nome Interno': item.internal_product_name,
        'Quantidade Necessária': item.quantity_needed,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));
      const blob = createExcelFile(formattedData, headers, 'FichaTecnicaDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ficha_tecnica_detalhada.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} fichas técnicas detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar fichas técnicas de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllProductNameConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar conversões de nomes de produtos.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as conversões de nomes de produtos...');
    try {
      const { data, error } = await supabase
        .from('product_name_conversions')
        .select('*')
        .eq('user_id', user.id)
        .order('supplier_name', { ascending: true })
        .order('supplier_product_code', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhuma conversão de nome de produto encontrada para baixar.');
        return;
      }
      const headers = [
        'ID da Conversão',
        'Código Fornecedor',
        'Nome Fornecedor',
        'Descrição Produto Fornecedor',
        'Nome Interno do Produto',
        'Data de Registro',
      ];
      const formattedData = data.map(item => ({
        'ID da Conversão': item.id,
        'Código Fornecedor': item.supplier_product_code,
        'Nome Fornecedor': item.supplier_name,
        'Descrição Produto Fornecedor': item.supplier_product_name,
        'Nome Interno do Produto': item.internal_product_name,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));
      const blob = createExcelFile(formattedData, headers, 'ConversaoNomesProdutosDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversao_nomes_produtos_detalhada.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} conversões de nomes de produtos detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar conversões de nomes de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleDownloadAllUnitConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível baixar conversões de unidades.');
      return;
    }
    const loadingToastId = showLoading('Baixando todas as conversões de unidades...');
    try {
      const { data, error } = await supabase
        .from('unit_conversions')
        .select('*')
        .eq('user_id', user.id)
        .order('supplier_name', { ascending: true })
        .order('supplier_product_code', { ascending: true })
        .order('supplier_unit', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        showError('Nenhuma conversão de unidade encontrada para baixar.');
        return;
      }
      const headers = [
        'ID da Conversão',
        'Código Fornecedor',
        'Nome Fornecedor',
        'Descrição Produto Fornecedor',
        'Unidade Fornecedor',
        'Unidade Interna',
        'Fator de Conversão',
        'Data de Registro',
      ];
      const formattedData = data.map(item => ({
        'ID da Conversão': item.id,
        'Código Fornecedor': item.supplier_product_code,
        'Nome Fornecedor': item.supplier_name,
        'Descrição Produto Fornecedor': item.supplier_product_description || 'N/A',
        'Unidade Fornecedor': item.supplier_unit,
        'Unidade Interna': item.internal_unit,
        'Fator de Conversão': item.conversion_factor,
        'Data de Registro': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));
      const blob = createExcelFile(formattedData, headers, 'ConversaoUnidadesDetalhada');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversao_unidades_detalhada.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess(`Dados de ${data.length} conversões de unidades detalhadas baixados com sucesso!`);
    } catch (error: any) {
      showError(`Erro ao baixar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearPurchasedItems = async () => {
    const loadingToastId = showLoading('Limpando todos os itens comprados...');
    try {
      const { error } = await supabase
        .from('purchased_items')
        .delete()
        .eq('user_id', user?.id); // Deleta apenas os registros do usuário logado
      if (error) throw error;
      showSuccess('Todos os itens comprados foram removidos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] }); // Invalida a query da Análise de Fornecedor
      queryClient.invalidateQueries({ queryKey: ['unique_c_prods'] }); // Invalida o cache de valores únicos
      queryClient.invalidateQueries({ queryKey: ['unique_descricoes'] });
      queryClient.invalidateQueries({ queryKey: ['unique_u_coms'] });
      queryClient.invalidateQueries({ queryKey: ['unique_x_fants'] });
    } catch (error: any) {
      showError(`Erro ao limpar itens comprados: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // NOVO: Função para limpar APENAS itens comprados manualmente
  const handleClearManualPurchasedItems = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar itens comprados manualmente.');
      return;
    }
    const loadingToastId = showLoading('Limpando itens comprados manualmente...');
    try {
      const { error } = await supabase
        .from('purchased_items')
        .delete()
        .eq('user_id', user.id)
        .eq('is_manual_entry', true); // Deleta apenas entradas manuais
      if (error) throw error;
      showSuccess('Todos os itens comprados manualmente foram removidos com sucesso!');
      // Invalida as queries relevantes
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['unique_c_prods'] });
      queryClient.invalidateQueries({ queryKey: ['unique_descricoes'] });
      queryClient.invalidateQueries({ queryKey: ['unique_u_coms'] });
      queryClient.invalidateQueries({ queryKey: ['unique_x_fants'] });
    } catch (error: any) {
      showError(`Erro ao limpar itens comprados manualmente: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // ATUALIZADO: Lógica de limpeza para a nova tabela de produtos vendidos
  const handleClearSoldItems = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar produtos vendidos.');
      return;
    }
    const loadingToastId = showLoading('Limpando todos os produtos vendidos...');
    try {
      const { error } = await supabase
        .from('sold_daily_hourly_data') // Deleta da nova tabela
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      showSuccess('Todos os produtos vendidos foram removidos com sucesso!');
      // Invalidate all relevant queries that might use the new sold_items view
      queryClient.invalidateQueries({ queryKey: ['sold_items'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_sold_products'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['consumed_items_from_sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales_by_date', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['all_sold_items_raw', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['all_sold_items_vendas_por_data', user?.id] }); // For VendasPorData
    } catch (error: any) {
      showError(`Erro ao limpar produtos vendidos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearProductRecipes = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar fichas técnicas.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as fichas técnicas de produtos...');
    try {
      const { error } = await supabase
        .from('product_recipes')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      showSuccess('Todas as fichas técnicas de produtos foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['product_recipes'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_cost'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_usage'] });
      queryClient.invalidateQueries({ queryKey: ['sold_product_recipe_details'] });
      queryClient.invalidateQueries({ queryKey: ['products_without_recipes_summary', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['product_recipes_internal_products', user?.id] }); // Invalida para Produtos Internos Não Utilizados
    } catch (error: any) {
      showError(`Erro ao limpar fichas técnicas de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearProductNameConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar conversões de nomes de produtos.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as conversões de nomes de produtos...');
    try {
      const { error } = await supabase
        .from('product_name_conversions')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      showSuccess('Todas as conversões de nomes de produtos foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product_and_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_for_analysis', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['product_name_conversions_stock', user?.id] });
    } catch (error: any) {
      showError(`Erro ao limpar conversões de nomes de produtos: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  const handleClearUnitConversions = async () => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível limpar conversões de unidades.');
      return;
    }
    const loadingToastId = showLoading('Limpando todas as conversões de unidades...');
    try {
      const { error } = await supabase
        .from('unit_conversions')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      showSuccess('Todas as conversões de unidades foram removidas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['unit_conversions'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_unit_conversions_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
    } catch (error: any) {
      showError(`Erro ao limpar conversões de unidades: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  // Extrai os cabeçalhos de forma dinâmica do primeiro item, se houver
  const getTableHeaders = (data: any[]) => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  // Função de submissão do formulário manual
  const onSubmitManualEntry = async (values: ManualEntryFormValues) => {
    if (!user?.id) {
      showError('Usuário não autenticado. Não é possível carregar itens comprados manualmente.');
      return;
    }
    const loadingToastId = showLoading('Carregando item comprado manualmente...');
    try {
      const formattedData = {
        user_id: user.id,
        c_prod: values.c_prod,
        descricao_do_produto: values.descricao_do_produto,
        u_com: values.u_com,
        q_com: values.q_com,
        v_un_com: values.v_un_com,
        invoice_id: values.invoice_id || null,
        invoice_number: values.invoice_number || null,
        item_sequence_number: values.item_sequence_number || null,
        x_fant: values.x_fant,
        invoice_emission_date: values.invoice_emission_date ? format(values.invoice_emission_date, 'yyyy-MM-dd') : null,
        is_manual_entry: true, // NOVO: Marca como entrada manual
        // total_invoice_value: null, // REMOVIDO: Entradas manuais não têm valor total da nota automaticamente
      };
      const { error } = await supabase
        .from('purchased_items')
        .insert([formattedData]);
      if (error) {
        throw new Error(error.message);
      }
      showSuccess('Item comprado adicionado manualmente com sucesso!');
      form.reset(); // Limpa o formulário
      queryClient.invalidateQueries({ queryKey: ['purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['invoice_summary'] });
      queryClient.invalidateQueries({ queryKey: ['aggregated_supplier_products'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_supplier'] });
      queryClient.invalidateQueries({ queryKey: ['total_purchased_by_internal_product'] });
      queryClient.invalidateQueries({ queryKey: ['unmapped_purchased_products_summary'] });
      queryClient.invalidateQueries({ queryKey: ['converted_units_summary'] });
      queryClient.invalidateQueries({ queryKey: ['current_stock_summary'] });
      queryClient.invalidateQueries({ queryKey: ['internal_product_average_cost'] });
      queryClient.invalidateQueries({ queryKey: ['all_purchased_items'] });
      queryClient.invalidateQueries({ queryKey: ['unique_c_prods'] });
      queryClient.invalidateQueries({ queryKey: ['unique_descricoes'] });
      queryClient.invalidateQueries({ queryKey: ['unique_u_coms'] });
      queryClient.invalidateQueries({ queryKey: ['unique_x_fants'] });
    } catch (error: any) {
      showError(`Erro ao adicionar item comprado manualmente: ${error.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Carga de Dados
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Gerencie a importação e exportação de dados para o sistema através de arquivos Excel ou XML.
      </p>
      <Tabs defaultValue="xml-purchased" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="xml-purchased">Itens Comprados (XML)</TabsTrigger>
          <TabsTrigger value="manual-purchased">Entrada Manual (Itens Comprados)</TabsTrigger>
          <TabsTrigger value="excel-sold">Produtos Vendidos (Excel)</TabsTrigger>
          <TabsTrigger value="excel-product-recipe">Ficha Técnica (Excel)</TabsTrigger>
          <TabsTrigger value="excel-conversions">Conversões (Excel)</TabsTrigger>
        </TabsList>
        <TabsContent value="xml-purchased" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Itens Comprados (XML)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um ou mais arquivos XML (.xml) contendo os itens comprados. O sistema tentará extrair o ID da nota fiscal (chave de acesso) e o número sequencial da nota, além do número do item para evitar duplicações. A data de emissão da NF será armazenada sem a hora.
            </p>
            <div className="flex flex-col space-y-2">
              <Label htmlFor="xml-file-upload">Selecionar arquivos XML</Label>
              <Input id="xml-file-upload" type="file" accept=".xml" multiple onChange={handleXmlFileChange} className="flex-grow" />
              {selectedXmlFiles.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedXmlFiles.length} arquivo(s) selecionado(s): {selectedXmlFiles.map(f => f.name).join(', ')}
                </p>
              )}
              <Button onClick={handleUploadXml} disabled={selectedXmlFiles.length === 0}>
                Carregar XML(s)
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="manual-purchased" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Entrada Manual de Itens Comprados</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Insira manualmente os detalhes de um item comprado. Use as sugestões para preencher campos com valores existentes. Itens adicionados aqui serão marcados como "Entrada Manual" no sistema.
            </p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitManualEntry)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="x_fant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Fornecedor</FormLabel>
                        <FormControl>
                          <Input {...field} list="x_fant-suggestions" placeholder="Nome do Fornecedor" />
                        </FormControl>
                        <datalist id="x_fant-suggestions">
                          {uniqueXFants?.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="c_prod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código do Produto</FormLabel>
                        <FormControl>
                          <Input {...field} list="c_prod-suggestions" placeholder="Código do Produto" />
                        </FormControl>
                        <datalist id="c_prod-suggestions">
                          {uniqueCProds?.map((code) => (
                            <option key={code} value={code} />
                          ))}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="descricao_do_produto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição do Produto</FormLabel>
                        <FormControl>
                          <Input {...field} list="descricao_do_produto-suggestions" placeholder="Descrição do Produto" />
                        </FormControl>
                        <datalist id="descricao_do_produto-suggestions">
                          {uniqueDescricoes?.map((desc) => (
                            <option key={desc} value={desc} />
                          ))}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="u_com"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidade de Compra</FormLabel>
                        <FormControl>
                          <Input {...field} list="u_com-suggestions" placeholder="Unidade de Compra" />
                        </FormControl>
                        <datalist id="u_com-suggestions">
                          {uniqueUComs?.map((unit) => (
                            <option key={unit} value={unit} />
                          ))}
                        </datalist>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="q_com"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade Comprada</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^[0-9.,]*$/.test(value)) {
                                field.onChange(value);
                              }
                            }}
                            onBlur={(e) => {
                              const parsed = parseBrazilianFloat(e.target.value);
                              field.onChange(parsed);
                            }}
                            value={field.value === 0 ? '' : String(field.value).replace('.', ',')}
                            placeholder="0,00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="v_un_com"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Unitário de Compra</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            onChange={(e) => {
                              const value = e.target.value;
                              if (/^[0-9.,]*$/.test(value)) {
                                field.onChange(value);
                              }
                            }}
                            onBlur={(e) => {
                              const parsed = parseBrazilianFloat(e.target.value);
                              field.onChange(parsed);
                            }}
                            value={field.value === 0 ? '' : String(field.value).replace('.', ',')}
                            placeholder="0,00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoice_emission_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data de Emissão da NF</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy", { locale: ptBR })
                                ) : (
                                  <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoice_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID da Nota Fiscal (Chave de Acesso)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ID da Nota Fiscal" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoice_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número da Nota Fiscal</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Número da Nota Fiscal" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="item_sequence_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Sequencial do Item na Nota</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : Number(value));
                            }}
                            value={field.value === undefined ? '' : field.value}
                            placeholder="Ex: 1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full">Adicionar Item Comprado</Button>
              </form>
            </Form>
          </div>
        </TabsContent>
        <TabsContent value="excel-sold" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Produtos Vendidos (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de **dois arquivos Excel** (.xlsx): um para as **quantidades vendidas por hora** e outro para os **valores vendidos por hora**. Ambos os arquivos devem conter as colunas: <code>Data</code> (DD/MM/YYYY), <code>Grupo</code>, <code>SubGrupo</code>, <code>Codigo</code>, <code>Produto</code>, e as colunas horárias de <code>0</code> a <code>23</code>, além de <code>Total</code>. Para cada data, grupo, subgrupo, código e produto encontrados nos arquivos carregados, os dados existentes no banco de dados para essa combinação serão **removidos** e substituídos pelos dados dos arquivos carregados **nesta operação**.
            </p>
            <div className="flex flex-col space-y-4">
              <div>
                <Label htmlFor="sold-items-quantity-excel-file-upload">Arquivo Excel de Quantidades</Label>
                <Input id="sold-items-quantity-excel-file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleSoldItemsQuantityExcelFileChange} className="flex-grow mt-1" />
                {selectedSoldItemsQuantityExcelFile && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Selecionado: {selectedSoldItemsQuantityExcelFile.name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="sold-items-value-excel-file-upload">Arquivo Excel de Valores</Label>
                <Input id="sold-items-value-excel-file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleSoldItemsValueExcelFileChange} className="flex-grow mt-1" />
                {selectedSoldItemsValueExcelFile && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Selecionado: {selectedSoldItemsValueExcelFile.name}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUploadSoldItemsExcel} disabled={!selectedSoldItemsQuantityExcelFile || !selectedSoldItemsValueExcelFile}>
                  Carregar Produtos Vendidos
                </Button>
                <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={
                        (Object.keys(loadedSoldItemsQuantityPreview).length === 0 && !selectedSoldItemsQuantityExcelFile) &&
                        (Object.keys(loadedSoldItemsValuePreview).length === 0 && !selectedSoldItemsValueExcelFile)
                      }
                      onClick={() => setIsPreviewDialogOpen(true)}
                    >
                      Visualizar Prévia dos Dados
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Prévia dos Dados de Produtos Vendidos</DialogTitle>
                      <DialogDescription>
                        Conteúdo lido dos arquivos Excel de quantidade e valor selecionados.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-grow pr-4">
                      {Object.keys(loadedSoldItemsQuantityPreview).length === 0 && Object.keys(loadedSoldItemsValuePreview).length === 0 ? (
                        <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                          Nenhum dado de prévia disponível. Selecione e carregue arquivos para ver a prévia.
                        </p>
                      ) : (
                        <>
                          {Object.entries(loadedSoldItemsQuantityPreview).map(([fileName, data], index) => (
                            <Card key={`qty-preview-${index}`} className="mb-6">
                              <CardHeader>
                                <CardTitle className="text-lg">Prévia Quantidade: {fileName}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                {data && data.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          {getTableHeaders(data).map((header, i) => (
                                            <TableHead key={i}>{header}</TableHead>
                                          ))}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {data.map((row, rowIndex) => (
                                          <TableRow key={rowIndex}>
                                            {getTableHeaders(data).map((header, colIndex) => (
                                              <TableCell key={colIndex}>
                                                {typeof row[header] === 'number' ? row[header].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(row[header])}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 dark:text-gray-400">Nenhum dado encontrado neste arquivo.</p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          {Object.entries(loadedSoldItemsValuePreview).map(([fileName, data], index) => (
                            <Card key={`val-preview-${index}`} className="mb-6">
                              <CardHeader>
                                <CardTitle className="text-lg">Prévia Valor: {fileName}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                {data && data.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          {getTableHeaders(data).map((header, i) => (
                                            <TableHead key={i}>{header}</TableHead>
                                          ))}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {data.map((row, rowIndex) => (
                                          <TableRow key={rowIndex}>
                                            {getTableHeaders(data).map((header, colIndex) => (
                                              <TableCell key={colIndex}>
                                                {typeof row[header] === 'number' ? row[header].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(row[header])}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 dark:text-gray-400">Nenhum dado encontrado neste arquivo.</p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <Button variant="outline" onClick={handleDownloadSoldItemsTemplate}>
              Baixar Template de Produtos Vendidos (Excel)
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="excel-product-recipe" className="mt-4">
          <div className="space-y-4">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Ficha Técnica de Produtos (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Faça o upload de um arquivo Excel (.xlsx) contendo a ficha técnica dos seus produtos. O arquivo deve conter as colunas: <code>Produto Vendido</code>, <code>Nome Interno</code> e <code>Quantidade Necessária</code>. Isso define quais produtos internos compõem um produto vendido e em que quantidade.
            </p>
            <div className="flex items-center space-x-2">
              <Input id="product-recipe-excel-file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleProductRecipeExcelFileChange} className="flex-grow" />
              <Button onClick={handleUploadProductRecipeExcel} disabled={!selectedProductRecipeExcelFile}>
                Carregar Ficha Técnica
              </Button>
            </div>
            <Button variant="outline" onClick={handleDownloadProductRecipeTemplate}>
              Baixar Template de Ficha Técnica (Excel)
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="excel-conversions" className="mt-4">
          <div className="space-y-6">
            <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Carga de Conversões (Excel)</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Gerencie as regras de conversão para nomes de produtos e unidades de fornecedores para seus padrões internos.
            </p>
            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Conversão de Nomes de Produtos</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mapeie o código do produto do fornecedor e o nome do fornecedor para um nome de produto interno. O arquivo deve conter as colunas: <code>Código Fornecedor</code>, <code>Nome Fornecedor</code>, <code>Descrição Produto Fornecedor</code> e <code>Nome Interno do Produto</code>.
              </p>
              <div className="flex items-center space-x-2">
                <Input id="product-name-conversion-excel-file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleProductNameConversionExcelFileChange} className="flex-grow" />
                <Button onClick={handleUploadProductNameConversionExcel} disabled={!selectedProductNameConversionExcelFile}>
                  Carregar Conversões de Nomes
                </Button>
              </div>
              <Button variant="outline" onClick={handleDownloadProductNameConversionTemplate}>
                Baixar Template de Conversão de Nomes
              </Button>
            </div>
            <div className="space-y-4 border p-4 rounded-md">
              <h4 className="text-xl font-medium text-gray-900 dark:text-gray-100">Conversão de Unidades</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Mapeie a unidade do fornecedor para uma unidade interna, com um fator de conversão. O arquivo deve conter as colunas: <code>Código Fornecedor</code>, <code>Nome Fornecedor</code>, <code>Descrição Produto Fornecedor</code>, <code>Unidade Fornecedor</code>, <code>Unidade Interna</code> e <code>Fator de Conversão</code>.
              </p>
              <div className="flex items-center space-x-2">
                <Input id="unit-conversion-excel-file-upload" type="file" accept=".xlsx, .xls, .csv" onChange={handleUnitConversionExcelFileChange} className="flex-grow" />
                <Button onClick={handleUploadUnitConversionExcel} disabled={!selectedUnitConversionExcelFile}>
                  Carregar Conversões de Unidades
                </Button>
              </div>
              <Button variant="outline" onClick={handleDownloadUnitConversionTemplate}>
                Baixar Template de Conversão de Unidades
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Exportar Dados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Baixe todos os itens comprados, vendidos, fichas técnicas ou conversões atualmente no sistema para arquivos Excel.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button onClick={handleDownloadAllPurchasedItems}>
            Baixar Itens Comprados (Excel)
          </Button>
          <Button onClick={handleDownloadAllPurchasedItemsXml}>
            {/* NOVO BOTÃO */}
            Baixar Itens Comprados (XML)
          </Button>
          <Button onClick={handleDownloadAllSoldItems}>
            Baixar Produtos Vendidos (Excel)
          </Button>
          <Button onClick={handleDownloadAllProductRecipes}>
            Baixar Fichas Técnicas (Excel)
          </Button>
          <Button onClick={handleDownloadAllProductNameConversions}>
            Baixar Conversões de Nomes (Excel)
          </Button>
          <Button onClick={handleDownloadAllUnitConversions}>
            Baixar Conversões de Unidades (Excel)
          </Button>
        </div>
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <h3 className="text-2xl font-medium text-gray-900 dark:text-gray-100">Limpeza de Dados</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Use esta opção para remover *todos* os itens das tabelas selecionadas. Esta ação é irreversível.
        </p>
        <div className="flex flex-wrap gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todos os Itens Comprados</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todos os itens comprados do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearPurchasedItems} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* NOVO: Botão para limpar apenas entradas manuais */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="bg-yellow-500 hover:bg-yellow-600 text-white">Limpar Itens Comprados Manuais</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente *apenas* os itens comprados que foram adicionados manualmente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearManualPurchasedItems} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Sim, Limpar Entradas Manuais
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todos os Produtos Vendidos</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todos os produtos vendidos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearSoldItems} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Todas as Fichas Técnicas</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as fichas técnicas de produtos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearProductRecipes} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Conversões de Nomes</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as conversões de nomes de produtos do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearProductNameConversions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Limpar Conversões de Unidades</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso removerá permanentemente todas as conversões de unidades do seu banco de dados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearUnitConversions} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, Limpar Dados
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default CargaDeDados;
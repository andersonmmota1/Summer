import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.4.0"; // Usando fast-xml-parser

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { xmlContent } = await req.json();

    if (!xmlContent) {
      return new Response(JSON.stringify({ error: 'No XML content provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // --- XML Parsing Logic using fast-xml-parser ---
    const parser = new XMLParser({
      ignoreAttributes: true, // Para simplificar, ignorar atributos por enquanto
      textNodeName: "#text",
      ignoreDeclaration: true,
      removeNSPrefix: true,
      trimValues: true,
      // Garante que 'Item' seja sempre um array, mesmo que haja apenas um
      isArray: (name, jPath, is ) => {
        if (name === "Item") return true;
        return false;
      }
    });
    const parsedXml = parser.parse(xmlContent);

    // Acessando dados com base na estrutura XML esperada:
    // <Invoice>
    //   <Header>
    //     <InvoiceNumber>INV-2024-001</InvoiceNumber>
    //     <PurchaseDate>2024-07-26</PurchaseDate>
    //   </Header>
    //   <Supplier>
    //     <Name>Fornecedor Exemplo</Name>
    //   </Supplier>
    //   <Items>
    //     <Item>...</Item>
    //     <Item>...</Item>
    //   </Items>
    // </Invoice>

    const invoiceNumber = parsedXml?.Invoice?.Header?.InvoiceNumber;
    const purchaseDate = parsedXml?.Invoice?.Header?.PurchaseDate;
    const supplierName = parsedXml?.Invoice?.Supplier?.Name;
    const xmlItems = parsedXml?.Invoice?.Items?.Item || []; // Deve ser um array devido à configuração isArray

    if (!invoiceNumber || !purchaseDate || !supplierName) {
      throw new Error('Dados essenciais ausentes no XML (InvoiceNumber, PurchaseDate ou SupplierName). Por favor, verifique a estrutura do XML.');
    }

    const items = xmlItems.map((item: any) => ({
      name: item.Name,
      quantity: parseFloat(item.Quantity || '0'),
      unit: item.Unit,
      unitCost: parseFloat(item.UnitCost || '0'),
    }));

    // 1. Encontrar ou Criar Fornecedor
    let { data: supplier, error: supplierError } = await supabaseClient
      .from('suppliers')
      .select('id')
      .eq('name', supplierName)
      .single();

    if (supplierError && supplierError.code === 'PGRST116') { // Nenhuma linha encontrada
      const { data: newSupplier, error: insertSupplierError } = await supabaseClient
        .from('suppliers')
        .insert({ user_id: user.id, name: supplierName })
        .select('id')
        .single();
      if (insertSupplierError) throw insertSupplierError;
      supplier = newSupplier;
    } else if (supplierError) {
      throw supplierError;
    }

    if (!supplier) {
      throw new Error('Falha ao encontrar ou criar fornecedor.');
    }

    const purchaseRecords = [];
    for (const item of items) {
      if (!item.name || !item.unit || isNaN(item.quantity) || isNaN(item.unitCost) || item.quantity <= 0 || item.unitCost <= 0) {
        console.warn(`Ignorando item inválido: ${JSON.stringify(item)}`);
        continue; // Ignorar itens com dados inválidos
      }

      // 2. Encontrar ou Criar Ingrediente
      let { data: ingredient, error: ingredientError } = await supabaseClient
        .from('ingredients')
        .select('id, unit, current_stock')
        .eq('name', item.name)
        .single();

      if (ingredientError && ingredientError.code === 'PGRST116') { // Nenhuma linha encontrada
        const { data: newIngredient, error: insertIngredientError } = await supabaseClient
          .from('ingredients')
          .insert({ user_id: user.id, name: item.name, unit: item.unit, cost_per_unit: item.unitCost, current_stock: item.quantity })
          .select('id, unit, current_stock')
          .single();
        if (insertIngredientError) throw insertIngredientError;
        ingredient = newIngredient;
      } else if (ingredientError) {
        throw ingredientError;
      }

      if (!ingredient) {
        throw new Error(`Falha ao encontrar ou criar ingrediente: ${item.name}`);
      }

      let finalQuantity = item.quantity;
      let finalUnitCost = item.unitCost;

      // 3. Aplicar Conversões de Unidade, se necessário
      if (item.unit !== ingredient.unit) {
        const { data: conversion, error: conversionError } = await supabaseClient
          .from('unit_conversions')
          .select('conversion_factor')
          .eq('ingredient_id', ingredient.id)
          .eq('from_unit', item.unit)
          .eq('to_unit', ingredient.unit)
          .single();

        if (conversionError && conversionError.code === 'PGRST116') {
          console.warn(`Nenhuma conversão direta encontrada para ${item.unit} para ${ingredient.unit} para o ingrediente ${item.name}. Usando a quantidade original.`);
        } else if (conversionError) {
          throw conversionError;
        } else if (conversion) {
          finalQuantity = item.quantity * conversion.conversion_factor;
          finalUnitCost = item.unitCost / conversion.conversion_factor; // Ajustar custo unitário com base na conversão
        }
      }

      // 4. Atualizar Estoque do Ingrediente
      const newStock = ingredient.current_stock + finalQuantity;
      const { error: updateStockError } = await supabaseClient
        .from('ingredients')
        .update({ current_stock: newStock, cost_per_unit: finalUnitCost }) // Atualizar cost_per_unit para refletir a última compra
        .eq('id', ingredient.id);
      if (updateStockError) throw updateStockError;

      // 5. Registrar Compra
      const { data: purchase, error: purchaseError } = await supabaseClient
        .from('purchases')
        .insert({
          user_id: user.id,
          supplier_id: supplier.id,
          ingredient_id: ingredient.id,
          purchase_date: purchaseDate,
          quantity: finalQuantity,
          unit_cost: finalUnitCost,
          total_cost: finalQuantity * finalUnitCost,
          invoice_number: invoiceNumber,
          xml_data: xmlContent, // Armazenar o XML completo para auditoria/reprocessamento, se necessário
        })
        .select();
      if (purchaseError) throw purchaseError;
      purchaseRecords.push(purchase);
    }

    return new Response(JSON.stringify({ message: 'XML processado com sucesso', purchaseRecords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro ao processar XML:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
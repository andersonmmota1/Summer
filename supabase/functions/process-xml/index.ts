import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Usando a versão 2.45.0 conforme exemplo
import { parse } from "https://deno.land/x/xml_parser@v0.2.1/mod.ts"; // Importando o parser XML

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

    // --- XML Parsing Logic ---
    const parsedXml = parse(xmlContent);

    // Assuming a simplified XML structure for a purchase invoice
    // Example structure:
    // <Invoice>
    //   <Header>
    //     <InvoiceNumber>INV-2024-001</InvoiceNumber>
    //     <PurchaseDate>2024-07-26</PurchaseDate>
    //   </Header>
    //   <Supplier>
    //     <Name>Fornecedor Exemplo</Name>
    //   </Supplier>
    //   <Items>
    //     <Item>
    //       <Name>Farinha de Trigo</Name>
    //       <Quantity>10</Quantity>
    //       <Unit>kg</Unit>
    //       <UnitCost>2.50</UnitCost>
    //     </Item>
    //   </Items>
    // </Invoice>

    const invoiceNumber = parsedXml.Invoice?.Header?.InvoiceNumber?.[0]?.content;
    const purchaseDate = parsedXml.Invoice?.Header?.PurchaseDate?.[0]?.content;
    const supplierName = parsedXml.Invoice?.Supplier?.Name?.[0]?.content;
    const xmlItems = parsedXml.Invoice?.Items?.[0]?.Item || [];

    if (!invoiceNumber || !purchaseDate || !supplierName) {
      throw new Error('Missing essential data in XML (InvoiceNumber, PurchaseDate, or SupplierName).');
    }

    const items = xmlItems.map((item: any) => ({
      name: item.Name?.[0]?.content,
      quantity: parseFloat(item.Quantity?.[0]?.content || '0'),
      unit: item.Unit?.[0]?.content,
      unitCost: parseFloat(item.UnitCost?.[0]?.content || '0'),
    }));

    // 1. Find or Create Supplier
    let { data: supplier, error: supplierError } = await supabaseClient
      .from('suppliers')
      .select('id')
      .eq('name', supplierName)
      .single();

    if (supplierError && supplierError.code === 'PGRST116') { // No rows found
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
      throw new Error('Failed to find or create supplier.');
    }

    const purchaseRecords = [];
    for (const item of items) {
      if (!item.name || !item.unit || isNaN(item.quantity) || isNaN(item.unitCost) || item.quantity <= 0 || item.unitCost <= 0) {
        console.warn(`Skipping invalid item: ${JSON.stringify(item)}`);
        continue; // Skip items with invalid data
      }

      // 2. Find or Create Ingredient
      let { data: ingredient, error: ingredientError } = await supabaseClient
        .from('ingredients')
        .select('id, unit, current_stock')
        .eq('name', item.name)
        .single();

      if (ingredientError && ingredientError.code === 'PGRST116') { // No rows found
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
        throw new Error(`Failed to find or create ingredient: ${item.name}`);
      }

      let finalQuantity = item.quantity;
      let finalUnitCost = item.unitCost;

      // 3. Apply Unit Conversions if needed
      if (item.unit !== ingredient.unit) {
        const { data: conversion, error: conversionError } = await supabaseClient
          .from('unit_conversions')
          .select('conversion_factor')
          .eq('ingredient_id', ingredient.id)
          .eq('from_unit', item.unit)
          .eq('to_unit', ingredient.unit)
          .single();

        if (conversionError && conversionError.code === 'PGRST116') {
          console.warn(`No direct conversion found for ${item.unit} to ${ingredient.unit} for ingredient ${item.name}. Using original quantity.`);
        } else if (conversionError) {
          throw conversionError;
        } else if (conversion) {
          finalQuantity = item.quantity * conversion.conversion_factor;
          finalUnitCost = item.unitCost / conversion.conversion_factor; // Adjust unit cost based on conversion
        }
      }

      // 4. Update Ingredient Stock
      const newStock = ingredient.current_stock + finalQuantity;
      const { error: updateStockError } = await supabaseClient
        .from('ingredients')
        .update({ current_stock: newStock, cost_per_unit: finalUnitCost }) // Update cost_per_unit to reflect latest purchase
        .eq('id', ingredient.id);
      if (updateStockError) throw updateStockError;

      // 5. Record Purchase
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
          xml_data: xmlContent, // Store the full XML for auditing/reprocessing if needed
        })
        .select();
      if (purchaseError) throw purchaseError;
      purchaseRecords.push(purchase);
    }

    return new Response(JSON.stringify({ message: 'XML processed successfully', purchaseRecords }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error processing XML:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
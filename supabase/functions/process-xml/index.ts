import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0'; // Corrigido para a versão 2.83.0
// You would typically import an XML parser here, e.g.,
// import { parse } from "https://deno.land/x/xml_parser@v0.2.1/mod.ts";

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

    // --- Placeholder for XML Parsing Logic ---
    // In a real scenario, you would parse the xmlContent here.
    // For example, using a Deno-compatible XML parser:
    // const parsedXml = parse(xmlContent);
    // Then extract data like:
    // const invoiceNumber = parsedXml.NFe.infNFe.ide.nNF;
    // const supplierName = parsedXml.NFe.infNFe.emit.xNome;
    // const purchaseDate = parsedXml.NFe.infNFe.ide.dhEmi;
    // const items = parsedXml.NFe.infNFe.det; // Array of items

    // For demonstration, let's assume we extract some dummy data
    // You will replace this with actual XML parsing logic
    const dummyExtractedData = {
      invoiceNumber: "INV-2024-001",
      supplierName: "Fornecedor Exemplo",
      purchaseDate: "2024-07-26",
      items: [
        { name: "Farinha de Trigo", quantity: 10, unit: "kg", unitCost: 2.50 },
        { name: "Açúcar", quantity: 5, unit: "kg", unitCost: 3.00 },
      ],
    };

    const { invoiceNumber, supplierName, purchaseDate, items } = dummyExtractedData;

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
          // No direct conversion found, you might want to log this or throw an error
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
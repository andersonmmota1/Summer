import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Nova interface para os itens agregados não mapeados
interface AggregatedUnmappedItem {
  c_prod: string;
  descricao_do_produto: string;
  u_com: string;
  total_quantity_purchased: number;
  total_value_purchased: number;
  average_unit_value: number;
}

interface ProductMapping {
  id: string;
  supplier_product_name: string;
  internal_product_name: string;
}

const MapeamentoDeProdutos: React.FC = () => {
  const [unmappedItems, setUnmappedItems] = useState<AggregatedUnmappedItem[]>([]);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  // O estado newMappingInput agora será chaveado por uma combinação de c_prod e descricao_do_produto
  const [newMappingInput, setNewMappingInput] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando itens e mapeamentos...');
    try {
      // Fetch aggregated unmapped purchased items from the new view
      const { data: itemsData, error: itemsError } = await supabase
        .from('unmapped_supplier_products_summary') // Usando a nova view
        .select('*')
        .order('descricao_do_produto', { ascending: true });

      if (itemsError) throw itemsError;

      // Fetch existing product mappings
      const { data: mappingsData, error: mappingsError } = await supabase
        .from('product_mappings')
        .select('*');

      if (mappingsError) throw mappingsError;

      setUnmappedItems(itemsData || []);
      setMappings(mappingsData || []);

      // Initialize newMappingInput state
      const initialInput: { [key: string]: string } = {};
      (itemsData || []).forEach(item => {
        const itemKey = `${item.c_prod}-${item.descricao_do_produto}`;
        // Try to pre-fill from existing mappings if available
        const existingMapping = (mappingsData || []).find(m => m.supplier_product_name === item.descricao_do_produto);
        initialInput[itemKey] = existingMapping ? existingMapping.internal_product_name : '';
      });
      setNewMappingInput(initialInput);

      showSuccess('Dados carregados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      showError(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
      dismissToast(loadingToastId);
    }
  };

  const handleInputChange = (itemKey: string, value: string) => {
    setNewMappingInput(prev => ({ ...prev, [itemKey]: value }));
  };

  const handleApplyMapping = async (item: AggregatedUnmappedItem) => {
    const itemKey = `${item.c_prod}-${item.descricao_do_produto}`;
    const internalName = newMappingInput[itemKey]?.trim();

    if (!internalName) {
      showError('Por favor, insira um nome interno para o produto.');
      return;
    }

    const loadingToastId = showLoading(`Aplicando mapeamento para "${item.descricao_do_produto}"...`);

    try {
      // 1. Check if mapping already exists for supplier_product_name
      const existingMapping = mappings.find(m => m.supplier_product_name === item.descricao_do_produto);

      if (existingMapping) {
        // If mapping exists, update it if the internal name changed
        if (existingMapping.internal_product_name !== internalName) {
          const { error: updateMappingError } = await supabase
            .from('product_mappings')
            .update({ internal_product_name: internalName, updated_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          if (updateMappingError) throw updateMappingError;
          showSuccess(`Mapeamento existente para "${item.descricao_do_produto}" atualizado.`);
        }
      } else {
        // If no mapping exists, create a new one
        const { error: insertMappingError } = await supabase
          .from('product_mappings')
          .insert({ supplier_product_name: item.descricao_do_produto, internal_product_name: internalName });

        if (insertMappingError) throw insertMappingError;
        showSuccess(`Novo mapeamento criado para "${item.descricao_do_produto}".`);
      }

      // 2. Update ALL purchased_items that match the supplier product code and description
      const { error: updateItemsError } = await supabase
        .from('purchased_items')
        .update({ internal_product_name: internalName })
        .eq('c_prod', item.c_prod)
        .eq('descricao_do_produto', item.descricao_do_produto);

      if (updateItemsError) throw updateItemsError;

      showSuccess(`Todos os itens de "${item.descricao_do_produto}" mapeados para "${internalName}" com sucesso!`);
      fetchData(); // Re-fetch data to update the list
    } catch (error: any) {
      console.error('Erro ao aplicar mapeamento:', error);
      showError(`Erro ao aplicar mapeamento: ${error.message}`);
    } finally {
      dismissToast(loadingToastId);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center text-gray-700 dark:text-gray-300">
        Carregando...
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Mapeamento de Produtos
      </h2>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Converta os nomes de produtos dos fornecedores para a sua nomenclatura interna.
        Os itens abaixo são produtos de fornecedores que ainda não possuem um nome interno definido, agrupados por código e descrição.
      </p>

      {unmappedItems.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os produtos de fornecedores já estão mapeados ou não há itens pendentes!</p>
          <p className="text-sm mt-2">Continue carregando mais dados ou verifique a página de Estoque.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Produtos de Fornecedores Pendentes de Mapeamento</CardTitle>
            <CardDescription>
              Insira o nome interno desejado para cada produto do fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Fornecedor</TableHead>
                  <TableHead>Descrição do Produto</TableHead>
                  <TableHead className="w-[200px]">Nome Interno</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedItems.map((item) => {
                  const itemKey = `${item.c_prod}-${item.descricao_do_produto}`;
                  return (
                    <TableRow key={itemKey}>
                      <TableCell>{item.c_prod}</TableCell>
                      <TableCell>{item.descricao_do_produto}</TableCell>
                      <TableCell>
                        <Input
                          value={newMappingInput[itemKey] || ''}
                          onChange={(e) => handleInputChange(itemKey, e.target.value)}
                          placeholder="Nome Interno do Produto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => handleApplyMapping(item)} disabled={!newMappingInput[itemKey]?.trim()}>
                          Mapear
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MapeamentoDeProdutos;
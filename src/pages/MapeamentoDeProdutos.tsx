import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PurchasedItem {
  id: string;
  c_prod: string;
  descricao_do_produto: string; // Renomeado aqui
  u_com: string;
  q_com: number;
  v_un_com: number;
  internal_product_name: string | null;
  created_at: string;
}

interface ProductMapping {
  id: string;
  supplier_product_name: string;
  internal_product_name: string;
}

const MapeamentoDeProdutos: React.FC = () => {
  const [unmappedItems, setUnmappedItems] = useState<PurchasedItem[]>([]);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMappingInput, setNewMappingInput] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const loadingToastId = showLoading('Carregando itens e mapeamentos...');
    try {
      // Fetch unmapped purchased items
      const { data: itemsData, error: itemsError } = await supabase
        .from('purchased_items')
        .select('*')
        .is('internal_product_name', null);

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
        // Try to pre-fill from existing mappings if available
        const existingMapping = (mappingsData || []).find(m => m.supplier_product_name === item.descricao_do_produto); // Usando o novo nome
        initialInput[item.id] = existingMapping ? existingMapping.internal_product_name : '';
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

  const handleInputChange = (itemId: string, value: string) => {
    setNewMappingInput(prev => ({ ...prev, [itemId]: value }));
  };

  const handleApplyMapping = async (item: PurchasedItem) => {
    const internalName = newMappingInput[item.id]?.trim();

    if (!internalName) {
      showError('Por favor, insira um nome interno para o produto.');
      return;
    }

    const loadingToastId = showLoading(`Aplicando mapeamento para "${item.descricao_do_produto}"...`); // Usando o novo nome

    try {
      // 1. Check if mapping already exists for supplier_product_name
      const existingMapping = mappings.find(m => m.supplier_product_name === item.descricao_do_produto); // Usando o novo nome

      if (existingMapping) {
        // If mapping exists, update it if the internal name changed
        if (existingMapping.internal_product_name !== internalName) {
          const { error: updateMappingError } = await supabase
            .from('product_mappings')
            .update({ internal_product_name: internalName, updated_at: new Date().toISOString() })
            .eq('id', existingMapping.id);

          if (updateMappingError) throw updateMappingError;
          showSuccess(`Mapeamento existente para "${item.descricao_do_produto}" atualizado.`); // Usando o novo nome
        }
      } else {
        // If no mapping exists, create a new one
        const { error: insertMappingError } = await supabase
          .from('product_mappings')
          .insert({ supplier_product_name: item.descricao_do_produto, internal_product_name: internalName }); // Usando o novo nome

        if (insertMappingError) throw insertMappingError;
        showSuccess(`Novo mapeamento criado para "${item.descricao_do_produto}".`); // Usando o novo nome
      }

      // 2. Update the purchased_item with the internal_product_name
      const { error: updateItemError } = await supabase
        .from('purchased_items')
        .update({ internal_product_name: internalName })
        .eq('id', item.id);

      if (updateItemError) throw updateItemError;

      showSuccess(`Item "${item.descricao_do_produto}" mapeado para "${internalName}" com sucesso!`); // Usando o novo nome
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
        Os itens abaixo são cargas recentes que ainda não possuem um nome interno definido.
      </p>

      {unmappedItems.length === 0 ? (
        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
          <p className="text-lg">🎉 Todos os itens carregados já estão mapeados ou não há itens pendentes!</p>
          <p className="text-sm mt-2">Continue carregando mais dados ou verifique a página de Estoque.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Itens Pendentes de Mapeamento</CardTitle>
            <CardDescription>
              Insira o nome interno desejado para cada produto do fornecedor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código Fornecedor</TableHead>
                  <TableHead>Descrição do Produto</TableHead> {/* Renomeado aqui */}
                  <TableHead>Unidade</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor Unitário</TableHead>
                  <TableHead className="w-[200px]">Nome Interno</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmappedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.c_prod}</TableCell>
                    <TableCell>{item.descricao_do_produto}</TableCell> {/* Usando o novo nome */}
                    <TableCell>{item.u_com}</TableCell>
                    <TableCell>{item.q_com}</TableCell>
                    <TableCell>{item.v_un_com}</TableCell>
                    <TableCell>
                      <Input
                        value={newMappingInput[item.id] || ''}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        placeholder="Nome Interno do Produto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button onClick={() => handleApplyMapping(item)} disabled={!newMappingInput[item.id]?.trim()}>
                        Mapear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MapeamentoDeProdutos;
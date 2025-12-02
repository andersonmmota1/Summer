import { showWarning } from "./toast";
import { parseBrazilianFloat } from '@/lib/utils'; // Importar a nova função

export const readXmlFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "application/xml");

        // Check for parsing errors
        const errorNode = xmlDoc.querySelector('parsererror');
        if (errorNode) {
          console.error('XML parsing error:', errorNode.textContent);
          reject(new Error('Erro ao analisar o arquivo XML. Verifique a estrutura do XML.'));
          return;
        }

        const items: any[] = [];
        
        // Tentar extrair o ID da nota fiscal (NFe ID - chave de acesso)
        const infNFeElement = xmlDoc.querySelector('infNFe');
        const invoiceId = infNFeElement?.getAttribute('Id') || null;

        // Tentar extrair o Número Sequencial da Nota Fiscal (nNF) e a Data de Emissão (dhEmi)
        const ideElement = infNFeElement?.querySelector('ide');
        const invoiceNumber = ideElement?.querySelector('nNF')?.textContent || null;
        const dhEmi = ideElement?.querySelector('dhEmi')?.textContent || null; // Extrair dhEmi

        if (!invoiceId) {
          showWarning('Não foi possível encontrar o ID da nota fiscal (tag <infNFe> com atributo Id). Itens podem ser tratados como duplicados se não houver outro identificador único.');
        }
        if (!invoiceNumber) {
          showWarning('Não foi possível encontrar o Número Sequencial da Nota Fiscal (tag <nNF> dentro de <ide>).');
        }
        if (!dhEmi) {
          showWarning('Não foi possível encontrar a Data de Emissão da NF (tag <dhEmi> dentro de <ide>).');
        }

        // Tentar extrair o Nome Fantasia do Fornecedor (xFant) ou o Nome (xNome) como fallback
        const emitElement = xmlDoc.querySelector('emit');
        let supplierName: string | null = null;
        if (emitElement) {
          supplierName = emitElement.querySelector('xFant')?.textContent || emitElement.querySelector('xNome')?.textContent || null;
        }
        
        if (!supplierName) {
          showWarning('Não foi possível encontrar o Nome Fantasia (xFant) nem o Nome (xNome) do Fornecedor (dentro de <emit>).');
        }

        let itemElements: NodeListOf<Element>;

        // Prioridade 1: Tentar encontrar elementos <det> (comum em NFe)
        itemElements = xmlDoc.querySelectorAll('det');

        if (itemElements.length > 0) {
          itemElements.forEach(itemElement => {
            const itemSequenceNumber = itemElement.getAttribute('nItem') ? parseInt(itemElement.getAttribute('nItem')!) : null;
            
            const prodElement = itemElement.querySelector('prod');
            if (prodElement) {
              const cProd = prodElement.querySelector('cProd')?.textContent || '';
              const descricaoDoProduto = prodElement.querySelector('xProd')?.textContent || ''; // Renomeado aqui
              const uCom = prodElement.querySelector('uCom')?.textContent || '';
              const qCom = prodElement.querySelector('qCom')?.textContent || '';
              const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';

              if (cProd && descricaoDoProduto) {
                items.push({
                  'ns1:cProd': cProd,
                  'descricao_do_produto': descricaoDoProduto, // Usando o novo nome
                  'ns1:uCom': uCom,
                  'ns1:qCom': parseBrazilianFloat(qCom), // Usando parseBrazilianFloat
                  'ns1:vUnCom': parseBrazilianFloat(vUnCom), // Usando parseBrazilianFloat
                  'invoice_id': invoiceId, // Chave de acesso
                  'invoice_number': invoiceNumber, // Número sequencial da nota
                  'item_sequence_number': itemSequenceNumber,
                  'x_fant': supplierName, // Usando o nome do fornecedor determinado
                  'invoice_emission_date': dhEmi, // Adicionado: Data de Emissão da NF
                });
              }
            }
          });
        } else {
          // Fallback: Se não houver <det>, tentar encontrar elementos <prod> diretamente
          showWarning('Não foi possível encontrar tags <det>. Tentando inferir itens com base em tags <prod>. A unicidade pode ser comprometida sem o número do item.');
          const prodElements = xmlDoc.querySelectorAll('prod');
          prodElements.forEach(prodElement => {
            const cProd = prodElement.querySelector('cProd')?.textContent || '';
            const descricaoDoProduto = prodElement.querySelector('xProd')?.textContent || ''; // Renomeado aqui
            const uCom = prodElement.querySelector('uCom')?.textContent || '';
            const qCom = prodElement.querySelector('qCom')?.textContent || '';
            const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';

            if (cProd && descricaoDoProduto) {
              items.push({
                'ns1:cProd': cProd,
                'descricao_do_produto': descricaoDoProduto, // Usando o novo nome
                'ns1:uCom': uCom,
                'ns1:qCom': parseBrazilianFloat(qCom), // Usando parseBrazilianFloat
                'ns1:vUnCom': parseBrazilianFloat(vUnCom), // Usando parseBrazilianFloat
                'invoice_id': invoiceId, // Chave de acesso
                'invoice_number': invoiceNumber, // Número sequencial da nota
                'item_sequence_number': null,
                'x_fant': supplierName, // Usando o nome do fornecedor determinado
                'invoice_emission_date': dhEmi, // Adicionado: Data de Emissão da NF
              });
            }
          });
        }
        
        if (items.length === 0) {
          reject(new Error('Nenhum item de produto válido foi extraído do arquivo XML.'));
          return;
        }

        resolve(items);
      } catch (error) {
        console.error('Erro inesperado ao processar XML:', error);
        reject(new Error('Erro ao ler o arquivo XML. Certifique-se de que é um arquivo XML válido e bem formatado.'));
      }
    };

    reader.onerror = (error) => {
      reject(new Error('Erro ao carregar o arquivo: ' + error));
    };

    reader.readAsText(file);
  });
};
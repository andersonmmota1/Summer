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
          reject(new Error(`Erro ao analisar o arquivo XML "${file.name}". Verifique a estrutura do XML. Detalhes: ${errorNode.textContent}`));
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

        // Tentar extrair os totais da nota fiscal (vProdTotal, vNFTotal, vTotTribTotal)
        const vProdTotalElement = xmlDoc.querySelector('total > ICMSTot > vProd');
        const vProdTotal = vProdTotalElement?.textContent ? parseFloat(vProdTotalElement.textContent) : null;

        const vNFTotalElement = xmlDoc.querySelector('total > ICMSTot > vNF');
        const vNFTotal = vNFTotalElement?.textContent ? parseFloat(vNFTotalElement.textContent) : null;

        const vTotTribTotalElement = xmlDoc.querySelector('total > ICMSTot > vTotTrib');
        const vTotTribTotal = vTotTribTotalElement?.textContent ? parseFloat(vTotTribTotalElement.textContent) : null;


        let itemElements: NodeListOf<Element>;

        // Prioridade 1: Tentar encontrar elementos <det> (comum em NFe)
        itemElements = xmlDoc.querySelectorAll('det');

        if (itemElements.length > 0) {
          itemElements.forEach(itemElement => {
            const itemSequenceNumber = itemElement.getAttribute('nItem') ? parseInt(itemElement.getAttribute('nItem')!) : null;
            
            const prodElement = itemElement.querySelector('prod');
            if (prodElement) {
              const cProd = prodElement.querySelector('cProd')?.textContent || '';
              const descricaoDoProduto = prodElement.querySelector('xProd')?.textContent || '';
              const uCom = prodElement.querySelector('uCom')?.textContent || '';
              const qCom = prodElement.querySelector('qCom')?.textContent || '';
              const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';
              const vProd = prodElement.querySelector('vProd')?.textContent || ''; // Valor total do produto (item)
              const vTotTribItem = itemElement.querySelector('imposto > vTotTrib')?.textContent || ''; // Valor total de tributos do item

              if (cProd && descricaoDoProduto) {
                items.push({
                  'ns1:cProd': cProd,
                  'descricao_do_produto': descricaoDoProduto,
                  'ns1:uCom': uCom,
                  'ns1:qCom': parseFloat(qCom), // Usando parseFloat para XML
                  'ns1:vUnCom': parseFloat(vUnCom), // Usando parseFloat para XML
                  'vProd': parseFloat(vProd), // Usando parseFloat para XML
                  'vTotTribItem': parseFloat(vTotTribItem), // Usando parseFloat para XML
                  'invoice_id': invoiceId, // Chave de acesso
                  'invoice_number': invoiceNumber, // Número sequencial da nota
                  'item_sequence_number': itemSequenceNumber,
                  'x_fant': supplierName, // Usando o nome do fornecedor determinado
                  'invoice_emission_date': dhEmi, // Adicionado: Data de Emissão da NF
                  'vNFTotal': vNFTotal, // Agora um número
                  'vProdTotal': vProdTotal, // Agora um número
                  'vTotTribTotal': vTotTribTotal, // Agora um número
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
            const descricaoDoProduto = prodElement.querySelector('xProd')?.textContent || '';
            const uCom = prodElement.querySelector('uCom')?.textContent || '';
            const qCom = prodElement.querySelector('qCom')?.textContent || '';
            const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';
            const vProd = prodElement.querySelector('vProd')?.textContent || ''; // Valor total do produto (item)
            const vTotTribItem = prodElement.querySelector('imposto > vTotTrib')?.textContent || ''; // Valor total de tributos do item (se existir aqui)

            if (cProd && descricaoDoProduto) {
              items.push({
                'ns1:cProd': cProd,
                'descricao_do_produto': descricaoDoProduto,
                'ns1:uCom': uCom,
                'ns1:qCom': parseFloat(qCom), // Usando parseFloat para XML
                'ns1:vUnCom': parseFloat(vUnCom), // Usando parseFloat para XML
                'vProd': parseFloat(vProd), // Usando parseFloat para XML
                'vTotTribItem': parseFloat(vTotTribItem), // Usando parseFloat para XML
                'invoice_id': invoiceId, // Chave de acesso
                'invoice_number': invoiceNumber, // Número sequencial da nota
                'item_sequence_number': null,
                'x_fant': supplierName, // Usando o nome do fornecedor determinado
                'invoice_emission_date': dhEmi, // Adicionado: Data de Emissão da NF
                'vNFTotal': vNFTotal, // Agora um número
                'vProdTotal': vProdTotal, // Agora um número
                'vTotTribTotal': vTotTribTotal, // Agora um número
              });
            }
          });
        }
        
        if (items.length === 0) {
          reject(new Error(`Nenhum item de produto válido foi extraído do arquivo XML "${file.name}". Verifique se o arquivo está correto.`));
          return;
        }

        resolve(items);
      } catch (error) {
        console.error('Erro inesperado ao processar XML:', error);
        reject(new Error(`Erro ao ler o arquivo XML "${file.name}". Certifique-se de que é um arquivo XML válido e bem formatado. Detalhes: ${error}`));
      }
    };

    reader.onerror = (error) => {
      reject(new Error('Erro ao carregar o arquivo: ' + error));
    };

    reader.readAsText(file);
  });
};
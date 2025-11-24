import { showWarning } from "./toast";

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
        
        // Tentar extrair o ID da nota fiscal (NFe ID)
        const infNFeElement = xmlDoc.querySelector('infNFe');
        const invoiceId = infNFeElement?.getAttribute('Id') || null;

        if (!invoiceId) {
          showWarning('Não foi possível encontrar o ID da nota fiscal (tag <infNFe> com atributo Id). Itens podem ser tratados como duplicados se não houver outro identificador único.');
        }

        // Tentar extrair o Nome Fantasia do Fornecedor (xFant)
        const emitElement = xmlDoc.querySelector('emit');
        const xFant = emitElement?.querySelector('xFant')?.textContent || null;
        if (!xFant) {
          showWarning('Não foi possível encontrar o Nome Fantasia do Fornecedor (tag <xFant> dentro de <emit>).');
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
                  'ns1:qCom': parseFloat(qCom),
                  'ns1:vUnCom': parseFloat(vUnCom),
                  'invoice_id': invoiceId,
                  'item_sequence_number': itemSequenceNumber,
                  'x_fant': xFant,
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
                'ns1:qCom': parseFloat(qCom),
                'ns1:vUnCom': parseFloat(vUnCom),
                'invoice_id': invoiceId,
                'item_sequence_number': null,
                'x_fant': xFant,
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
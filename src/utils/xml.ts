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
        // Assuming a structure where each item is directly under a root or a specific tag
        // For example, if items are <item> tags, or <det> tags within an <nfeProc>
        // Let's assume a common structure for purchased items, e.g., <item> or <det>
        // We'll look for elements that contain the product details.
        // A common XML structure for NFe items uses <det> for details and <prod> inside it.
        const itemElements = xmlDoc.querySelectorAll('det'); // Common for NFe items

        if (itemElements.length === 0) {
          // Fallback if 'det' is not found, try 'item' or a more generic approach
          const genericElements = xmlDoc.querySelectorAll('*');
          let potentialItems: Element[] = [];
          genericElements.forEach(el => {
            // Heuristic: if an element has children like cProd, xProd, etc., it might be an item
            if (el.querySelector('cProd') || el.querySelector('xProd')) {
              potentialItems.push(el);
            }
          });
          if (potentialItems.length > 0) {
            showWarning('Não foi possível encontrar tags <det>. Tentando inferir itens com base em <cProd>/<xProd>.');
            itemElements.forEach(el => potentialItems.push(el)); // Add existing if any
            potentialItems.forEach(itemElement => {
              const cProd = itemElement.querySelector('cProd')?.textContent || '';
              const xProd = itemElement.querySelector('xProd')?.textContent || '';
              const uCom = itemElement.querySelector('uCom')?.textContent || '';
              const qCom = itemElement.querySelector('qCom')?.textContent || '';
              const vUnCom = itemElement.querySelector('vUnCom')?.textContent || '';

              if (cProd && xProd) { // Only add if essential fields are present
                items.push({
                  'ns1:cProd': cProd,
                  'ns1:xProd': xProd,
                  'ns1:uCom': uCom,
                  'ns1:qCom': parseFloat(qCom),
                  'ns1:vUnCom': parseFloat(vUnCom),
                });
              }
            });
          } else {
            reject(new Error('Nenhum item de produto encontrado no arquivo XML. Verifique a estrutura do XML (esperado <det> ou elementos com <cProd>/<xProd>).'));
            return;
          }
        } else {
          itemElements.forEach(itemElement => {
            // Assuming product details are nested under <prod> within <det>
            const prodElement = itemElement.querySelector('prod');
            if (prodElement) {
              const cProd = prodElement.querySelector('cProd')?.textContent || '';
              const xProd = prodElement.querySelector('xProd')?.textContent || '';
              const uCom = prodElement.querySelector('uCom')?.textContent || '';
              const qCom = prodElement.querySelector('qCom')?.textContent || '';
              const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';

              items.push({
                'ns1:cProd': cProd,
                'ns1:xProd': xProd,
                'ns1:uCom': uCom,
                'ns1:qCom': parseFloat(qCom),
                'ns1:vUnCom': parseFloat(vUnCom),
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
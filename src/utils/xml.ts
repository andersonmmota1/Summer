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
        let itemElements: NodeListOf<Element>;
        let prodElements: NodeListOf<Element>;

        // Prioridade 1: Tentar encontrar elementos <det> (comum em NFe)
        itemElements = xmlDoc.querySelectorAll('det');

        if (itemElements.length > 0) {
          itemElements.forEach(itemElement => {
            // Assumindo que os detalhes do produto estão aninhados sob <prod> dentro de <det>
            const prodElement = itemElement.querySelector('prod');
            if (prodElement) {
              const cProd = prodElement.querySelector('cProd')?.textContent || '';
              const xProd = prodElement.querySelector('xProd')?.textContent || '';
              const uCom = prodElement.querySelector('uCom')?.textContent || '';
              const qCom = prodElement.querySelector('qCom')?.textContent || '';
              const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';

              if (cProd && xProd) { // Apenas adiciona se campos essenciais estiverem presentes
                items.push({
                  'ns1:cProd': cProd,
                  'ns1:xProd': xProd,
                  'ns1:uCom': uCom,
                  'ns1:qCom': parseFloat(qCom),
                  'ns1:vUnCom': parseFloat(vUnCom),
                });
              }
            }
          });
        } else {
          // Prioridade 2: Se não houver <det>, tentar encontrar elementos <prod> diretamente
          prodElements = xmlDoc.querySelectorAll('prod');
          if (prodElements.length > 0) {
            showWarning('Não foi possível encontrar tags <det>. Tentando inferir itens com base em tags <prod>.');
            prodElements.forEach(prodElement => {
              const cProd = prodElement.querySelector('cProd')?.textContent || '';
              const xProd = prodElement.querySelector('xProd')?.textContent || '';
              const uCom = prodElement.querySelector('uCom')?.textContent || '';
              const qCom = prodElement.querySelector('qCom')?.textContent || '';
              const vUnCom = prodElement.querySelector('vUnCom')?.textContent || '';

              if (cProd && xProd) {
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
            // Prioridade 3: Se nem <det> nem <prod> forem encontrados, tentar uma abordagem mais genérica
            // Encontrar elementos que são pais diretos de cProd e xProd para evitar duplicação
            const cProdElements = xmlDoc.querySelectorAll('cProd');
            const xProdElements = xmlDoc.querySelectorAll('xProd');

            if (cProdElements.length > 0 || xProdElements.length > 0) { // Use OR here, as one might be enough to indicate an item
                showWarning('Não foi possível encontrar tags <det> ou <prod>. Tentando inferir itens com base em elementos que contêm <cProd>/<xProd>.');
                const uniqueItemContainers = new Set<Element>();

                cProdElements.forEach(el => {
                    if (el.parentElement) uniqueItemContainers.add(el.parentElement);
                });
                xProdElements.forEach(el => {
                    if (el.parentElement) uniqueItemContainers.add(el.parentElement);
                });

                uniqueItemContainers.forEach(itemContainer => {
                    const cProd = itemContainer.querySelector('cProd')?.textContent || '';
                    const xProd = itemContainer.querySelector('xProd')?.textContent || '';
                    const uCom = itemContainer.querySelector('uCom')?.textContent || '';
                    const qCom = itemContainer.querySelector('qCom')?.textContent || '';
                    const vUnCom = itemContainer.querySelector('vUnCom')?.textContent || '';

                    if (cProd && xProd) {
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
                reject(new Error('Nenhum item de produto encontrado no arquivo XML. Verifique a estrutura do XML (esperado <det>, <prod> ou elementos com <cProd>/<xProd>).'));
                return;
            }
          }
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
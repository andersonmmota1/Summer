import { PurchasedItem } from '@/pages/CargaDeDados';
import { parseBrazilianFloat, parseBrazilianDate } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos

/**
 * Extrai dados de itens comprados de uma string HTML de NFC-e.
 * Esta função é altamente dependente da estrutura HTML específica de uma NFC-e.
 * @param htmlContent A string HTML bruta da página da NFC-e.
 * @param userId O ID do usuário para associar aos itens.
 * @returns Uma Promise que resolve para um array de objetos PurchasedItem.
 */
export const extractPurchasedItemsFromHtml = (htmlContent: string, userId: string): Promise<PurchasedItem[]> => {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      const items: PurchasedItem[] = [];

      // Extrair dados da nota fiscal
      const invoiceIdElement = doc.querySelector('.chave');
      const invoiceId = invoiceIdElement?.textContent?.replace(/\s/g, '') || null; // Remover espaços da chave de acesso

      let invoiceNumber: string | null = null;
      let invoiceEmissionDate: string | null = null;
      let supplierName: string | null = null;

      // Encontrar elementos de número e emissão iterando sobre os strongs na seção #infos
      const infosSection = doc.querySelector('#infos');
      if (infosSection) {
        const strongElements = infosSection.querySelectorAll('strong');
        strongElements.forEach(strong => {
          if (strong.textContent?.includes('Número:')) {
            invoiceNumber = strong.nextSibling?.textContent?.trim() || null;
          } else if (strong.textContent?.includes('Emissão:')) {
            const rawDateString = strong.nextSibling?.textContent?.split('-')[0]?.trim();
            if (rawDateString) {
              invoiceEmissionDate = parseBrazilianDate(rawDateString);
            }
          }
        });
      }
      
      const supplierNameElement = doc.querySelector('#u20.txtTopo');
      supplierName = supplierNameElement?.textContent?.trim() || null;


      // Extrair itens da tabela
      const itemRows = doc.querySelectorAll('#tabResult tr');

      itemRows.forEach((row, index) => {
        // Tenta pegar do ID, senão usa o índice + 1 como número sequencial
        const itemSequenceNumber = row.id ? parseInt(row.id.replace('Item + ', '')) : (index + 1); 

        const txtTitElement = row.querySelector('.txtTit');
        const descricaoDoProduto = txtTitElement?.firstChild?.textContent?.trim() || '';

        const rCodElement = row.querySelector('.RCod');
        const cProdMatch = rCodElement?.textContent?.match(/\(Código:\s*(\d+)\s*\)/);
        const cProd = cProdMatch ? cProd[1] : '';

        const rQtdElement = row.querySelector('.Rqtd strong');
        const qComText = rQtdElement?.nextSibling?.textContent?.trim() || '0';
        const qCom = parseBrazilianFloat(qComText.replace('Qtde.:', ''));

        const rUnElement = row.querySelector('.RUN strong');
        const uComText = rUnElement?.nextSibling?.textContent?.trim() || '';
        const uCom = uComText.replace('UN:', '');

        const rVlUnitElement = row.querySelector('.RvlUnit strong');
        const vUnComText = rVlUnitElement?.nextSibling?.textContent?.trim() || '0';
        const vUnCom = parseBrazilianFloat(vUnComText.replace('Vl. Unit.:', ''));

        if (descricaoDoProduto && cProd && qCom > 0) {
          items.push({
            id: uuidv4(), // Gerar um ID único para cada item
            user_id: userId,
            c_prod: cProd,
            descricao_do_produto: descricaoDoProduto,
            u_com: uCom,
            q_com: qCom,
            v_un_com: vUnCom,
            created_at: new Date().toISOString(),
            internal_product_name: null, // Não disponível no HTML da NFC-e
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            item_sequence_number: itemSequenceNumber,
            x_fant: supplierName,
            invoice_emission_date: invoiceEmissionDate,
            is_manual_entry: false, // Considerado como vindo de um documento, não manual
          });
        }
      });

      if (items.length === 0) {
        reject(new Error('Nenhum item de produto válido foi extraído do conteúdo HTML. Verifique se o HTML é de uma NFC-e e se a estrutura está conforme o esperado.'));
        return;
      }

      console.log('Itens extraídos do HTML:', items); // Log para depuração
      resolve(items);

    } catch (error: any) {
      console.error('Erro ao extrair itens do HTML:', error);
      reject(new Error(`Erro ao processar o conteúdo HTML: ${error.message || 'Verifique o console para mais detalhes.'}`));
    }
  });
};
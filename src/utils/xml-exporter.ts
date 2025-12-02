import { PurchasedItem } from '@/pages/CargaDeDados'; // Importar a interface PurchasedItem
import { format, parseISO } from 'date-fns'; // Para formatar datas

/**
 * Converte uma string para um formato seguro para XML, substituindo caracteres especiais.
 * @param text A string a ser escapada.
 * @returns A string com caracteres XML escapados.
 */
const escapeXml = (text: string | number | boolean | null | undefined): string => {
  if (text === null || text === undefined) {
    return '';
  }
  let str = String(text);
  str = str.replace(/&/g, '&amp;');
  str = str.replace(/</g, '&lt;');
  str = str.replace(/>/g, '&gt;');
  str = str.replace(/"/g, '&quot;');
  str = str.replace(/'/g, '&apos;');
  return str;
};

/**
 * Gera uma string XML representando uma coleção de notas fiscais,
 * onde cada nota fiscal segue uma estrutura simplificada de NFe/NFC-e.
 * Assume que os itens fornecidos podem pertencer a diferentes notas fiscais.
 *
 * @param allItems Array de objetos PurchasedItem, possivelmente de várias notas.
 * @returns Uma string XML contendo múltiplas estruturas de NFe/NFC-e.
 */
export const exportPurchasedItemsToXml = (allItems: PurchasedItem[]): string => {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlString += '<nfeCollection>\n'; // Tag raiz para a coleção de NFes

  // Agrupar itens por nota fiscal (invoice_id é a chave de acesso, a mais confiável)
  const invoicesMap = new Map<string, PurchasedItem[]>();
  allItems.forEach(item => {
    const invoiceKey = item.invoice_id || `${item.invoice_number}-${item.x_fant}`; // Fallback se invoice_id for nulo
    if (!invoiceKey) {
      console.warn('Item sem identificador de nota fiscal válido, ignorado na exportação XML:', item);
      return;
    }
    if (!invoicesMap.has(invoiceKey)) {
      invoicesMap.set(invoiceKey, []);
    }
    invoicesMap.get(invoiceKey)?.push(item);
  });

  invoicesMap.forEach((itemsInInvoice, invoiceKey) => {
    if (itemsInInvoice.length === 0) return;

    const firstItem = itemsInInvoice[0]; // Usar o primeiro item para dados da nota
    const invoiceId = firstItem.invoice_id || `NFe-${invoiceKey}`; // Usar invoice_id como Id da infNFe
    const invoiceNumber = firstItem.invoice_number || 'SEM_NUMERO';
    const supplierName = firstItem.x_fant || 'FORNECEDOR_DESCONHECIDO';
    const emissionDate = firstItem.invoice_emission_date ? format(parseISO(firstItem.invoice_emission_date), 'yyyy-MM-dd') : 'SEM_DATA';
    const totalInvoiceValue = firstItem.total_invoice_value || 0; // NOVO: Pega o valor total da nota

    xmlString += `  <NFe>\n`;
    xmlString += `    <infNFe Id="${escapeXml(invoiceId)}">\n`;
    xmlString += `      <ide>\n`;
    xmlString += `        <nNF>${escapeXml(invoiceNumber)}</nNF>\n`;
    xmlString += `        <dhEmi>${escapeXml(emissionDate)}</dhEemi>\n`;
    xmlString += `      </ide>\n`;
    xmlString += `      <emit>\n`;
    xmlString += `        <xFant>${escapeXml(supplierName)}</xFant>\n`;
    xmlString += `      </emit>\n`;

    itemsInInvoice.forEach(item => {
      // Gera o XML a partir dos campos estruturados
      xmlString += `      <det nItem="${escapeXml(item.item_sequence_number || '1')}">\n`;
      xmlString += `        <prod>\n`;
      xmlString += `          <cProd>${escapeXml(item.c_prod)}</cProd>\n`;
      xmlString += `          <xProd>${escapeXml(item.descricao_do_produto)}</xProd>\n`;
      xmlString += `          <uCom>${escapeXml(item.u_com)}</uCom>\n`;
      xmlString += `          <qCom>${escapeXml(item.q_com)}</qCom>\n`;
      xmlString += `          <vUnCom>${escapeXml(item.v_un_com)}</vUnCom>\n`;
      xmlString += `        </prod>\n`;
      xmlString += `      </det>\n`;
    });

    // NOVO: Adiciona o total da nota fiscal
    xmlString += `      <total>\n`;
    xmlString += `        <ICMSTot>\n`;
    xmlString += `          <vNF>${escapeXml(totalInvoiceValue)}</vNF>\n`;
    xmlString += `        </ICMSTot>\n`;
    xmlString += `      </total>\n`;

    xmlString += `    </infNFe>\n`;
    xmlString += `  </NFe>\n`;
  });

  xmlString += '</nfeCollection>';
  return xmlString;
};
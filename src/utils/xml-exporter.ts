import { PurchasedItem } from '@/pages/CargaDeDados'; // Importar a interface PurchasedItem

/**
 * Converte uma string para um formato seguro para XML, substituindo caracteres especiais.
 * @param text A string a ser escapada.
 * @returns A string com caracteres XML escapados.
 */
const escapeXml = (text: string | number | null | undefined): string => {
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
 * Gera uma string XML representando uma lista de itens comprados.
 * @param items Array de objetos PurchasedItem.
 * @returns Uma string XML.
 */
export const exportPurchasedItemsToXml = (items: PurchasedItem[]): string => {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlString += '<purchasedItems>\n';

  items.forEach(item => {
    xmlString += '  <item>\n';
    xmlString += `    <id>${escapeXml(item.id)}</id>\n`;
    xmlString += `    <userId>${escapeXml(item.user_id)}</userId>\n`;
    xmlString += `    <supplierProductCode>${escapeXml(item.c_prod)}</supplierProductCode>\n`;
    xmlString += `    <productDescription>${escapeXml(item.descricao_do_produto)}</productDescription>\n`;
    xmlString += `    <unitOfMeasure>${escapeXml(item.u_com)}</unitOfMeasure>\n`;
    xmlString += `    <quantity>${escapeXml(item.q_com)}</quantity>\n`;
    xmlString += `    <unitValue>${escapeXml(item.v_un_com)}</unitValue>\n`;
    xmlString += `    <invoiceId>${escapeXml(item.invoice_id)}</invoiceId>\n`;
    xmlString += `    <invoiceNumber>${escapeXml(item.invoice_number)}</invoiceNumber>\n`;
    xmlString += `    <itemSequenceNumber>${escapeXml(item.item_sequence_number)}</itemSequenceNumber>\n`;
    xmlString += `    <supplierFancyName>${escapeXml(item.x_fant)}</supplierFancyName>\n`;
    xmlString += `    <invoiceEmissionDate>${escapeXml(item.invoice_emission_date)}</invoiceEmissionDate>\n`;
    xmlString += `    <isManualEntry>${escapeXml(item.is_manual_entry)}</isManualEntry>\n`;
    xmlString += `    <createdAt>${escapeXml(item.created_at)}</createdAt>\n`;
    xmlString += '  </item>\n';
  });

  xmlString += '</purchasedItems>';
  return xmlString;
};
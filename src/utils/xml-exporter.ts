import { PurchasedItem } from '@/pages/CargaDeDados'; // Importar a interface PurchasedItem

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
 * Gera uma string XML representando uma lista de itens comprados.
 * As tags XML corresponderão aos nomes das propriedades do objeto PurchasedItem.
 * @param items Array de objetos PurchasedItem.
 * @returns Uma string XML.
 */
export const exportPurchasedItemsToXml = (items: PurchasedItem[]): string => {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlString += '<purchasedItems>\n';

  items.forEach(item => {
    xmlString += '  <item>\n';
    xmlString += `    <id>${escapeXml(item.id)}</id>\n`;
    xmlString += `    <user_id>${escapeXml(item.user_id)}</user_id>\n`;
    xmlString += `    <c_prod>${escapeXml(item.c_prod)}</c_prod>\n`;
    xmlString += `    <descricao_do_produto>${escapeXml(item.descricao_do_produto)}</descricao_do_produto>\n`;
    xmlString += `    <u_com>${escapeXml(item.u_com)}</u_com>\n`;
    xmlString += `    <q_com>${escapeXml(item.q_com)}</q_com>\n`;
    xmlString += `    <v_un_com>${escapeXml(item.v_un_com)}</v_un_com>\n`;
    xmlString += `    <invoice_id>${escapeXml(item.invoice_id)}</invoice_id>\n`;
    xmlString += `    <invoice_number>${escapeXml(item.invoice_number)}</invoice_number>\n`;
    xmlString += `    <item_sequence_number>${escapeXml(item.item_sequence_number)}</item_sequence_number>\n`;
    xmlString += `    <x_fant>${escapeXml(item.x_fant)}</x_fant>\n`;
    xmlString += `    <invoice_emission_date>${escapeXml(item.invoice_emission_date)}</invoice_emission_date>\n`;
    xmlString += `    <is_manual_entry>${escapeXml(item.is_manual_entry)}</is_manual_entry>\n`;
    xmlString += `    <created_at>${escapeXml(item.created_at)}</created_at>\n`;
    xmlString += `    <internal_product_name>${escapeXml(item.internal_product_name)}</internal_product_name>\n`; // Adicionado
    xmlString += '  </item>\n';
  });

  xmlString += '</purchasedItems>';
  return xmlString;
};
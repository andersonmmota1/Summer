import { format, parseISO } from 'date-fns'; // Para formatar datas
import { NFeDetailedItem } from '@/types/nfe'; // Importar a nova interface

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
 * onde cada nota fiscal segue uma estrutura detalhada de NFe/NFC-e.
 * Assume que os itens fornecidos podem pertencer a diferentes notas fiscais.
 *
 * @param allItems Array de objetos NFeDetailedItem, possivelmente de várias notas.
 * @returns Uma string XML contendo múltiplas estruturas de NFe/NFC-e.
 */
export const exportPurchasedItemsToXml = (allItems: NFeDetailedItem[]): string => {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xmlString += '<nfeCollection>\n'; // Tag raiz para a coleção de NFes

  // Agrupar itens por nota fiscal (Id da infNFe é a chave de acesso, a mais confiável)
  const invoicesMap = new Map<string, NFeDetailedItem[]>();
  allItems.forEach(item => {
    const invoiceKey = item.Id || `${item.nNF}-${item.xNomeEmit}`; // Fallback se Id for nulo
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

    xmlString += `  <NFe>\n`;
    xmlString += `    <infNFe Id="${escapeXml(firstItem.Id || `NFe-${invoiceKey}`)}">\n`;

    // ide (Identificação da NFe)
    xmlString += `      <ide>\n`;
    xmlString += `        <cUF>${escapeXml(firstItem.cUF)}</cUF>\n`;
    xmlString += `        <cNF>${escapeXml(firstItem.cNF)}</cNF>\n`;
    xmlString += `        <natOp>${escapeXml(firstItem.natOp)}</natOp>\n`;
    xmlString += `        <mod>${escapeXml(firstItem.mod)}</mod>\n`;
    xmlString += `        <serie>${escapeXml(firstItem.serie)}</serie>\n`;
    xmlString += `        <nNF>${escapeXml(firstItem.nNF)}</nNF>\n`;
    xmlString += `        <dhEmi>${escapeXml(firstItem.dhEmi)}</dhEmi>\n`;
    xmlString += `        <tpNF>${escapeXml(firstItem.tpNF)}</tpNF>\n`;
    xmlString += `        <idDest>${escapeXml(firstItem.idDest)}</idDest>\n`;
    xmlString += `        <cMunFG>${escapeXml(firstItem.cMunFG)}</cMunFG>\n`;
    xmlString += `        <tpImp>${escapeXml(firstItem.tpImp)}</tpImp>\n`;
    xmlString += `        <tpEmis>${escapeXml(firstItem.tpEmis)}</tpEmis>\n`;
    xmlString += `        <cDV>${escapeXml(firstItem.cDV)}</cDV>\n`;
    xmlString += `        <tpAmb>${escapeXml(firstItem.tpAmb)}</tpAmb>\n`;
    xmlString += `        <finNFe>${escapeXml(firstItem.finNFe)}</finNFe>\n`;
    xmlString += `        <indFinal>${escapeXml(firstItem.indFinal)}</indFinal>\n`;
    xmlString += `        <indPres>${escapeXml(firstItem.indPres)}</indPres>\n`;
    xmlString += `        <procEmi>${escapeXml(firstItem.procEmi)}</procEmi>\n`;
    xmlString += `        <verProc>${escapeXml(firstItem.verProc)}</verProc>\n`;
    xmlString += `      </ide>\n`;

    // emit (Emitente)
    xmlString += `      <emit>\n`;
    xmlString += `        <CNPJ>${escapeXml(firstItem.emitCNPJ)}</CNPJ>\n`;
    xmlString += `        <xNome>${escapeXml(firstItem.xNomeEmit)}</xNome>\n`;
    if (firstItem.x_fant) { // Adiciona xFant se estiver disponível
      xmlString += `        <xFant>${escapeXml(firstItem.x_fant)}</xFant>\n`;
    }
    xmlString += `        <enderEmit>\n`;
    xmlString += `          <xLgr>${escapeXml(firstItem.xLgrEmit)}</xLgr>\n`;
    xmlString += `          <nro>${escapeXml(firstItem.nroEmit)}</nro>\n`;
    xmlString += `          <xBairro>${escapeXml(firstItem.xBairroEmit)}</xBairro>\n`;
    xmlString += `          <cMun>${escapeXml(firstItem.cMunEmit)}</cMun>\n`;
    xmlString += `          <xMun>${escapeXml(firstItem.xMunEmit)}</xMun>\n`;
    xmlString += `          <UF>${escapeXml(firstItem.UFEmit)}</UF>\n`;
    xmlString += `          <CEP>${escapeXml(firstItem.CEPEmit)}</CEP>\n`;
    xmlString += `          <cPais>${escapeXml(firstItem.cPaisEmit)}</cPais>\n`;
    xmlString += `          <xPais>${escapeXml(firstItem.xPaisEmit)}</xPais>\n`;
    xmlString += `        </enderEmit>\n`;
    xmlString += `        <IE>${escapeXml(firstItem.IEEmit)}</IE>\n`;
    xmlString += `        <CRT>${escapeXml(firstItem.CRTEmit)}</CRT>\n`;
    xmlString += `      </emit>\n`;

    // det (Itens)
    itemsInInvoice.forEach(item => {
      xmlString += `      <det nItem="${escapeXml(item.nItem || '1')}">\n`;
      xmlString += `        <prod>\n`;
      xmlString += `          <cProd>${escapeXml(item.cProd)}</cProd>\n`;
      xmlString += `          <xProd>${escapeXml(item.xProd)}</xProd>\n`;
      xmlString += `          <qCom>${escapeXml(item.qCom)}</qCom>\n`;
      xmlString += `          <uCom>${escapeXml(item.uCom)}</uCom>\n`;
      xmlString += `          <vUnCom>${escapeXml(item.vUnCom)}</vUnCom>\n`;
      xmlString += `          <vProd>${escapeXml(item.vProd)}</vProd>\n`;
      xmlString += `        </prod>\n`;
      xmlString += `        <imposto>\n`;
      xmlString += `          <vTotTrib>${escapeXml(item.vTotTribItem)}</vTotTrib>\n`;
      xmlString += `        </imposto>\n`;
      xmlString += `      </det>\n`;
    });

    // total (Totais)
    xmlString += `      <total>\n`;
    xmlString += `        <ICMSTot>\n`;
    xmlString += `          <vProd>${escapeXml(firstItem.vProdTotal)}</vProd>\n`;
    xmlString += `          <vNF>${escapeXml(firstItem.vNFTotal)}</vNF>\n`;
    xmlString += `          <vTotTrib>${escapeXml(firstItem.vTotTribTotal)}</vTotTrib>\n`;
    xmlString += `        </ICMSTot>\n`;
    xmlString += `      </total>\n`;

    // pag (Pagamento)
    xmlString += `      <pag>\n`;
    xmlString += `        <detPag>\n`;
    xmlString += `          <tPag>${escapeXml(firstItem.tPag)}</tPag>\n`;
    xmlString += `          <vPag>${escapeXml(firstItem.vPag)}</vPag>\n`;
    xmlString += `        </detPag>\n`;
    xmlString += `      </pag>\n`;

    // dest (Destinatário)
    xmlString += `      <dest>\n`;
    xmlString += `        <CNPJ>${escapeXml(firstItem.destCNPJ)}</CNPJ>\n`;
    xmlString += `        <xNome>${escapeXml(firstItem.xNomeDest)}</xNome>\n`;
    xmlString += `      </dest>\n`;

    // infAdic (Informações Adicionais)
    xmlString += `      <infAdic>\n`;
    xmlString += `        <infCpl>${escapeXml(firstItem.infCpl)}</infCpl>\n`;
    xmlString += `      </infAdic>\n`;

    xmlString += `    </infNFe>\n`;

    // protNFe (Protocolo de Autorização)
    xmlString += `    <protNFe>\n`;
    xmlString += `      <infProt>\n`;
    xmlString += `        <tpAmb>${escapeXml(firstItem.tpAmbProt)}</tpAmb>\n`;
    xmlString += `        <verAplic>${escapeXml(firstItem.verAplicProt)}</verAplic>\n`;
    xmlString += `        <chNFe>${escapeXml(firstItem.chNFeProt)}</chNFe>\n`;
    xmlString += `        <dhRecbto>${escapeXml(firstItem.dhRecbtoProt)}</dhRecbto>\n`;
    xmlString += `        <nProt>${escapeXml(firstItem.nProt)}</nProt>\n`;
    xmlString += `        <digVal>${escapeXml(firstItem.digValProt)}</digVal>\n`;
    xmlString += `        <cStat>${escapeXml(firstItem.cStatProt)}</cStat>\n`;
    xmlString += `        <xMotivo>${escapeXml(firstItem.xMotivoProt)}</xMotivo>\n`;
    xmlString += `      </infProt>\n`;
    xmlString += `    </protNFe>\n`;

    xmlString += `  </NFe>\n`;
  });

  xmlString += '</nfeCollection>';
  return xmlString;
};
export interface NFeDetailedItem {
  // infNFe attributes
  Id?: string | null; // Chave de acesso da NFe

  // ide (Identificação da NFe)
  cUF?: string | null;
  cNF?: string | null;
  natOp?: string | null;
  mod?: string | null;
  serie?: string | null;
  nNF?: string | null;
  dhEmi?: string | null; // YYYY-MM-DDTHH:MM:SS-TZ ou YYYY-MM-DD
  tpNF?: string | null;
  idDest?: string | null;
  cMunFG?: string | null;
  tpImp?: string | null;
  tpEmis?: string | null;
  cDV?: string | null;
  tpAmb?: string | null;
  finNFe?: string | null;
  indFinal?: string | null;
  indPres?: string | null;
  procEmi?: string | null;
  verProc?: string | null;

  // emit (Emitente)
  emitCNPJ?: string | null;
  xNomeEmit?: string | null;
  xLgrEmit?: string | null;
  nroEmit?: string | null;
  xBairroEmit?: string | null;
  cMunEmit?: string | null;
  xMunEmit?: string | null;
  UFEmit?: string | null;
  CEPEmit?: string | null;
  cPaisEmit?: string | null;
  xPaisEmit?: string | null;
  IEEmit?: string | null;
  CRTEmit?: string | null;

  // det (Detalhes do Produto/Serviço) - Estes campos serão replicados para cada item
  nItem?: number | null; // Atributo do det
  cProd?: string | null;
  xProd?: string | null;
  qCom?: number | null;
  uCom?: string | null;
  vUnCom?: number | null;
  vProd?: number | null; // Valor total do produto (quantidade * valor unitário)
  vTotTribItem?: number | null; // de imposto.vTotTrib

  // total.ICMSTot (Totais do ICMS)
  vProdTotal?: number | null; // Somatório do valor dos produtos
  vNFTotal?: number | null; // Valor total da nota fiscal
  vTotTribTotal?: number | null; // Somatório do valor total dos tributos

  // pag.detPag (Detalhes do Pagamento)
  tPag?: string | null; // Forma de pagamento
  vPag?: number | null; // Valor do pagamento

  // dest (Destinatário)
  destCNPJ?: string | null;
  xNomeDest?: string | null;

  // infAdic (Informações Adicionais)
  infCpl?: string | null;

  // protNFe.infProt (Protocolo de Autorização)
  tpAmbProt?: string | null;
  verAplicProt?: string | null;
  chNFeProt?: string | null;
  dhRecbtoProt?: string | null;
  nProt?: string | null;
  digValProt?: string | null;
  cStatProt?: string | null;
  xMotivoProt?: string | null;

  // Campos adicionais para uso interno/mapeamento, não diretamente do XML
  user_id: string;
  created_at: string;
  internal_product_name?: string | null; // Para mapeamento a nomes internos
  is_manual_entry?: boolean; // Se foi inserido manualmente
}
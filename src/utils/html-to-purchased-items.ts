import { parseBrazilianFloat, parseBrazilianDate } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid'; // Para gerar IDs únicos
import { NFeDetailedItem } from '@/types/nfe'; // Importar a nova interface

/**
 * Extrai dados de itens comprados de uma string HTML de NFC-e.
 * Esta função é altamente dependente da estrutura HTML específica de uma NFC-e.
 * @param htmlContent A string HTML bruta da página da NFC-e.
 * @param userId O ID do usuário para associar aos itens.
 * @returns Uma Promise que resolve para um array de objetos NFeDetailedItem.
 */
export const extractPurchasedItemsFromHtml = (htmlContent: string, userId: string): Promise<NFeDetailedItem[]> => {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      const items: NFeDetailedItem[] = [];

      // --- Extrair dados da Nota Fiscal (nível superior) ---
      const infNFeId = doc.querySelector('.chave')?.textContent?.replace(/\s/g, '') || null;

      let nNF: string | null = null;
      let dhEmi: string | null = null; // Inicializa dhEmi como null
      let xNomeEmit: string | null = null;
      let emitCNPJ: string | null = null;
      let vNFTotal: number | null = null;
      let vProdTotal: number | null = null;
      let vTotTribTotal: number | null = null;
      let infCpl: string | null = null;
      let tPag: string | null = null;
      let vPag: number | null = null;
      let destCNPJ: string | null = null;
      let xNomeDest: string | null = null;
      let x_fant: string | null = null; // Adicionado para armazenar o nome fantasia

      // Tentativa 1: Lógica existente dentro da seção #infos
      const infosSection = doc.querySelector('#infos');
      if (infosSection) {
        const strongElements = infosSection.querySelectorAll('strong');
        strongElements.forEach(strong => {
          if (strong.textContent?.includes('Número:')) {
            nNF = strong.nextSibling?.textContent?.trim() || null;
          } else if (strong.textContent?.includes('Emissão:')) {
            const rawDateString = strong.nextSibling?.textContent?.split('-')[0]?.trim();
            if (rawDateString) {
              dhEmi = parseBrazilianDate(rawDateString); // Converte para YYYY-MM-DD
            }
          }
        });
      }

      // Tentativa 2: Procurar por classes comuns de data de emissão
      if (!dhEmi) {
        const dateElement = doc.querySelector('.dataEmissao, .dataHoraEmissao, .data');
        if (dateElement) {
          const rawDateString = dateElement.textContent?.split('-')[0]?.trim();
          if (rawDateString) {
            dhEmi = parseBrazilianDate(rawDateString);
          }
        }
      }

      // Tentativa 3: Procurar por texto "Data de Emissão" ou "Emissão" em todo o corpo do documento
      if (!dhEmi) {
        const bodyText = doc.body.textContent;
        if (bodyText) {
          // Regex para "Data de Emissão: DD/MM/YYYY" ou "Emissão: DD/MM/YYYY"
          const emissionDateRegex = /(?:Data de Emissão|Emissão):\s*(\d{2}\/\d{2}\/\d{4})/;
          const match = bodyText.match(emissionDateRegex);
          if (match && match[1]) {
            dhEmi = parseBrazilianDate(match[1]);
          }
        }
      }

      // Tentativa 4: Procurar por um span/div específico que possa conter a data diretamente
      if (!dhEmi) {
        const specificDateElement = doc.querySelector('span.data, div.data, span.data-emissao, div.data-emissao');
        if (specificDateElement) {
          const rawDateString = specificDateElement.textContent?.split('-')[0]?.trim();
          if (rawDateString) {
            dhEmi = parseBrazilianDate(rawDateString);
          }
        }
      }


      // Emitente - Lógica de extração mais robusta para xNomeEmit
      const emitSection = doc.querySelector('#u20'); // Seletor comum para o bloco do emitente
      if (emitSection) {
        xNomeEmit = emitSection.querySelector('.txtTopo')?.textContent?.trim() || null;
        // Fallback se .txtTopo não for encontrado ou estiver vazio dentro de #u20
        if (!xNomeEmit) {
          xNomeEmit = emitSection.querySelector('div.txtTitulo')?.textContent?.trim() || null; // Outro seletor comum
        }
        if (!xNomeEmit) {
          // Tenta encontrar uma tag strong que possa conter o nome
          xNomeEmit = emitSection.querySelector('strong')?.textContent?.trim() || null;
        }
        // Se ainda não encontrado, tenta encontrar o primeiro nó de texto não vazio na seção
        if (!xNomeEmit) {
            const textNodes = Array.from(emitSection.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
            if (textNodes.length > 0) {
                xNomeEmit = textNodes[0].textContent?.trim() || null;
            }
        }

        const cnpjEmitElement = emitSection.querySelector('.txtCNPJ');
        if (cnpjEmitElement) {
          emitCNPJ = cnpjEmitElement.textContent?.replace('CNPJ:', '').trim() || null;
        }
        x_fant = xNomeEmit; // Usar xNomeEmit como x_fant
      }
      // Fallback adicional se #u20 não for encontrado ou não contiver o nome
      if (!xNomeEmit) {
        xNomeEmit = doc.querySelector('.nomeEmitente')?.textContent?.trim() || null; // Seletor genérico
      }
      if (!xNomeEmit) {
        xNomeEmit = doc.querySelector('.razaoSocial')?.textContent?.trim() || null; // Outro seletor genérico
      }
      // Último recurso: procurar uma tag strong que possa conter o nome da empresa na área do cabeçalho
      if (!xNomeEmit) {
        const headerArea = doc.querySelector('body > div:first-child'); // Assumindo que o cabeçalho está na primeira div principal
        if (headerArea) {
          xNomeEmit = headerArea.querySelector('strong')?.textContent?.trim() || null;
        }
      }
      x_fant = x_fant || xNomeEmit; // Garante que x_fant seja preenchido se xNomeEmit foi encontrado por um fallback


      // Totais
      const totalNfElement = doc.querySelector('#totalNf'); // Valor total da nota
      if (totalNfElement) {
        const totalText = totalNfElement.textContent?.replace('R$', '').trim();
        if (totalText) {
          vNFTotal = parseBrazilianFloat(totalText);
        }
      }
      // Outros seletores para totais
      const totalValueElement = doc.querySelector('.total-value strong');
      if (vNFTotal === null && totalValueElement) {
        const totalText = totalValueElement.textContent?.replace('R$', '').trim();
        if (totalText) {
          vNFTotal = parseBrazilianFloat(totalText);
        }
      }

      const vProdTotalElement = doc.querySelector('#totalProdutos'); // Exemplo para total de produtos
      if (vProdTotalElement) {
        const prodTotalText = vProdTotalElement.textContent?.replace('R$', '').trim();
        if (prodTotalText) {
          vProdTotal = parseBrazilianFloat(prodTotalText);
        }
      }

      const vTotTribTotalElement = doc.querySelector('#totalTributos'); // Exemplo para total de tributos
      if (vTotTribTotalElement) {
        const tribTotalText = vTotTribTotalElement.textContent?.replace('R$', '').trim();
        if (tribTotalText) {
          vTotTribTotal = parseBrazilianFloat(tribTotalText);
        }
      }

      // Pagamento
      const pagSection = doc.querySelector('#pag'); // Seletor comum para o bloco de pagamento
      if (pagSection) {
        const tPagElement = pagSection.querySelector('.tipoPagamento'); // Exemplo
        tPag = tPagElement?.textContent?.trim() || null;

        const vPagElement = pagSection.querySelector('.valorPagamento'); // Exemplo
        if (vPagElement) {
          const vPagText = vPagElement.textContent?.replace('R$', '').trim();
          if (vPagText) {
            vPag = parseBrazilianFloat(vPagText);
          }
        }
      }

      // Destinatário
      const destSection = doc.querySelector('#dest'); // Seletor comum para o bloco do destinatário
      if (destSection) {
        const xNomeDestElement = destSection.querySelector('.txtNome');
        xNomeDest = xNomeDestElement?.textContent?.trim() || null;
        const cnpjDestElement = destSection.querySelector('.txtCNPJ');
        if (cnpjDestElement) {
          destCNPJ = cnpjEmitElement.textContent?.replace('CNPJ:', '').trim() || null;
        }
      }

      // Informações Adicionais
      const infAdicElement = doc.querySelector('#infAdic'); // Seletor comum
      if (infAdicElement) {
        infCpl = infAdicElement.textContent?.trim() || null;
      }


      // --- Extrair Itens da Tabela ---
      const itemRows = doc.querySelectorAll('#tabResult tr');

      itemRows.forEach((row, index) => {
        const nItem = row.id ? parseInt(row.id.replace('Item + ', '')) : (index + 1); 

        const xProd = row.querySelector('.txtTit')?.firstChild?.textContent?.trim() || '';

        let cProd = '';
        const rCodElement = row.querySelector('.RCod');
        if (rCodElement && rCodElement.textContent) {
          const cProdMatch = rCodElement.textContent.match(/\(Código:\s*(\d+)\s*\)/);
          if (cProdMatch && cProdMatch[1]) {
            cProd = cProdMatch[1];
          }
        }

        const qComText = row.querySelector('.Rqtd strong')?.nextSibling?.textContent?.trim() || '0';
        const qCom = parseBrazilianFloat(qComText.replace('Qtde.:', ''));

        const uComText = row.querySelector('.RUN strong')?.nextSibling?.textContent?.trim() || '';
        const uCom = uComText.replace('UN:', '');

        const vUnComText = row.querySelector('.RvlUnit strong')?.nextSibling?.textContent?.trim() || '0';
        const vUnCom = parseBrazilianFloat(vUnComText.replace('Vl. Unit.:', ''));

        const vProdElement = row.querySelector('.RvlItem strong'); // Valor total do item
        const vProd = vProdElement ? parseBrazilianFloat(vProdElement.textContent?.trim() || '0') : (qCom * vUnCom);

        const vTotTribItemElement = row.querySelector('.vTotTribItem'); // Exemplo para tributos do item
        const vTotTribItem = vTotTribItemElement ? parseBrazilianFloat(vTotTribItemElement.textContent?.replace('R$', '').trim() || '0') : null;


        if (xProd && cProd && qCom > 0) {
          items.push({
            // Campos da NFeDetailedItem
            Id: infNFeId,
            nNF: nNF,
            dhEmi: dhEmi, // Usando o dhEmi encontrado pelas tentativas
            xNomeEmit: xNomeEmit,
            emitCNPJ: emitCNPJ,
            vNFTotal: vNFTotal,
            vProdTotal: vProdTotal,
            vTotTribTotal: vTotTribTotal,
            infCpl: infCpl,
            tPag: tPag,
            vPag: vPag,
            destCNPJ: destCNPJ,
            xNomeDest: xNomeDest,

            nItem: nItem,
            cProd: cProd,
            xProd: xProd,
            qCom: qCom,
            uCom: uCom,
            vUnCom: vUnCom,
            vProd: vProd,
            vTotTribItem: vTotTribItem,

            // Campos adicionais para uso interno
            user_id: userId,
            created_at: new Date().toISOString(),
            internal_product_name: null, // Será mapeado posteriormente
            is_manual_entry: false,
            x_fant: x_fant, // Atribuindo o nome fantasia extraído
          });
        }
      });

      if (items.length === 0) {
        reject(new Error('Nenhum item de produto válido foi extraído do conteúdo HTML. Verifique se o HTML é de uma NFC-e e se a estrutura está conforme o esperado.'));
        return;
      }

      console.log('Itens extraídos do HTML:', items);
      resolve(items);

    } catch (error: any) {
      console.error('Erro ao extrair itens do HTML:', error);
      reject(new Error(`Erro ao processar o conteúdo HTML: ${error.message || 'Verifique o console para mais detalhes.'}`));
    }
  });
};
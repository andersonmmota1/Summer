import * as XLSX from 'xlsx';

export const readExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (error) {
        reject(new Error('Erro ao ler o arquivo Excel. Certifique-se de que é um arquivo Excel válido.'));
      }
    };

    reader.onerror = (error) => {
      reject(new Error('Erro ao carregar o arquivo: ' + error));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const createExcelTemplate = (headers: string[], sheetName: string = 'Sheet1'): Blob => {
  const ws = XLSX.utils.json_to_sheet([], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
};
import { LogEntry, ColumnDefinition } from './types';

// Robust CSV Line Splitter handling quotes
const splitCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
};

// Robust Date Parser supporting DD/MM/YYYY (priority) and Standard ISO
export const parseDate = (dateStr: string): number => {
  const d = String(dateStr).trim();
  if (!d) return NaN;
  
  // 1. Prioritize DD/MM/YYYY [HH:mm:ss] format (Common in IN/UK)
  // Matches: 1/1/2024, 01/01/2024, 1-1-2024, 01.01.2024, 01/01/2024 10:30, 01/01/2024 10:30:45
  const dmyRegex = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const match = d.match(dmyRegex);

  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
    const yearPart = parseInt(match[3], 10);
    const year = yearPart < 100 ? yearPart + 2000 : yearPart;
    
    // Time parts (optional)
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;
    
    // Validate basics
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
       const dateObj = new Date(year, month, day, hour, minute, second);
       if (!isNaN(dateObj.getTime())) {
          return dateObj.getTime();
       }
    }
  }

  // 2. Fallback to native Date.parse (Handles ISO YYYY-MM-DD, and US MM/DD/YYYY)
  const timestamp = Date.parse(d);
  if (!isNaN(timestamp)) return timestamp;
  
  return NaN;
};

export const parseCSV = async (url: string): Promise<LogEntry[]> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch data');
    const text = await response.text();
    
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]);
    
    const data: LogEntry[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const currentLine = splitCSVLine(lines[i]);
      if (currentLine.length === headers.length) {
        const entry: LogEntry = {};
        headers.forEach((header, index) => {
          const key = header.trim();
          let value: string | number = currentLine[index];
          entry[key] = value;
        });
        data.push(entry);
      }
    }
    return data;
  } catch (error) {
    console.error("Error parsing CSV", error);
    return [];
  }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
};

export const identifyColumns = (data: LogEntry[]): ColumnDefinition[] => {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  
  return keys.map(key => {
    let sampleValue = '';
    // Look for a non-empty value to guess type
    for (let i = 0; i < Math.min(data.length, 10); i++) {
        if (data[i][key]) {
            sampleValue = String(data[i][key]);
            break;
        }
    }
    
    const lowerKey = key.toLowerCase();
    const isDateKey = lowerKey.includes('date') || lowerKey.includes('timestamp') || lowerKey.includes('time');

    let isDate = false;
    if (isDateKey) {
        isDate = true;
    } else if (sampleValue) {
        const parsed = parseDate(sampleValue);
        // Ensure it has date separators to avoid false positives on simple numbers
        const hasDateSeparators = /[\/.-]/.test(sampleValue);
        isDate = !isNaN(parsed) && sampleValue.length > 5 && hasDateSeparators;
    }

    const isNumeric = !isDate && !isNaN(parseFloat(sampleValue.replace(/,/g, ''))) && /[\d]+/.test(sampleValue);
    
    return {
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      isDate,
      isNumeric
    };
  });
};

export const downloadPDF = (title: string, columns: ColumnDefinition[], data: LogEntry[]) => {
  // @ts-ignore
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

  const tableColumn = columns.map(col => col.label);
  const tableRows = data.map(row => columns.map(col => row[col.key]));

  // @ts-ignore
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    theme: 'grid',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }, // Blue-500
  });

  doc.save(`${title.replace(/\s+/g, '_')}_Report.pdf`);
};

export const calculateTotalAmount = (data: LogEntry[]): number => {
  if (data.length === 0) return 0;
  const keys = Object.keys(data[0]);
  const amountKey = keys.find(k => /amount|cost|price|total|value/i.test(k));
  
  if (!amountKey) return 0;

  return data.reduce((sum, row) => {
    const val = String(row[amountKey]).replace(/[^0-9.-]+/g, "");
    return sum + (parseFloat(val) || 0);
  }, 0);
};
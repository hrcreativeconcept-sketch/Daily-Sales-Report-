
import { DailyReport, SalesItem, Totals } from "../types";

export const getLocalDateTimeAndTimezone = () => {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    console.warn("Timezone detection failed", e);
  }

  const now = new Date();
  
  // Use local time values strictly (avoiding UTC conversion issues)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateLocal = `${year}-${month}-${day}`;

  // 24-hour format HH:mm
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeLocal = `${hours}:${minutes}`;

  return { dateLocal, timeLocal, tz };
};

export const computeTotals = (items: SalesItem[], discounts: number = 0): Totals => {
  const gross = items.reduce((sum, it) => sum + (it.quantity * it.unitPrice), 0);
  const net = gross - discounts;
  return { gross, discounts, net };
};

export const formatCurrency = (amount: number, currency = 'AED') => {
  // Ensure thousands separators and 2 decimal places (e.g., AED 1,234.50)
  return new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: currency, 
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
};

export const buildShareMessage = (report: DailyReport): string => {
  // 1. Format Date: 30-Nov-2025
  // Parse string manually to avoid timezone shifts (e.g. T00:00 -> previous day)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let dateFormatted = report.dateLocal;
  
  try {
    const parts = report.dateLocal.split('-'); // yyyy-mm-dd
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      if (months[monthIdx]) {
        dateFormatted = `${day}-${months[monthIdx]}-${year}`;
      }
    }
  } catch (e) {}

  // 2. Build Header
  // Dubai Hill Mall
  // 30-Nov-2025 
  // Sale Report
  let message = `${report.storeName}\n${dateFormatted} \n\nSale Report\n`;

  // 3. Build Item List
  // 1. 1 Iphone Screen Protector 80 AED
  report.items.forEach((item, index) => {
    const lineTotal = item.quantity * item.unitPrice;
    
    // Format number: remove decimals if whole number (80), keep if necessary (80.50)
    const priceStr = lineTotal % 1 === 0 
      ? lineTotal.toString() 
      : lineTotal.toFixed(2);

    // Format: 1. Qty Name Price Currency
    message += `\n${index + 1}. ${item.quantity} ${item.productName} ${priceStr} ${item.currency}`;
  });

  // 4. Build Footer
  // Total: 300 AED
  const netTotal = report.totals.net % 1 === 0 
    ? report.totals.net.toString() 
    : report.totals.net.toFixed(2);

  message += `\n\nTotal: ${netTotal} AED`;

  return message;
};

export const generateId = () => {
  // Fallback for environments where crypto.randomUUID is not available (non-HTTPS or older browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

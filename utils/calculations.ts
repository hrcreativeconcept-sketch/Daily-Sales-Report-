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
  // 1. Format Financials
  const netFormatted = formatCurrency(report.totals.net);
  
  // 2. Format Date
  const dateObj = new Date(`${report.dateLocal}T${report.timeLocal}:00`);
  const datePretty = isNaN(dateObj.getTime()) 
    ? report.dateLocal 
    : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // 3. Construct fixed parts
  const header = `Daily Sales – ${datePretty}, ${report.storeName}`;
  const footer = `(${netFormatted} net).`;
  
  // Format: "{header}: {itemSummary} {footer}"
  // Separator overhead: ": " (2) + " " (1) = 3 chars
  const overhead = 3;
  const MAX_CHARS = 500;
  const availableSpace = MAX_CHARS - header.length - footer.length - overhead;

  let itemSummary = "No items";

  if (report.items.length > 0) {
    // Sort by Total Value (Qty * Price) desc to show most significant items
    const sortedItems = [...report.items].sort((a, b) => (b.quantity * b.unitPrice) - (a.quantity * a.unitPrice));
    
    // Attempt to fit top 3
    const topItems = sortedItems.slice(0, 3);
    const itemStrings: string[] = [];
    let currentLength = 0;
    let itemsIncluded = 0;

    for (let i = 0; i < topItems.length; i++) {
      const item = topItems[i];
      // Truncate product name if excessively long
      const pName = item.productName.length > 30 ? item.productName.substring(0, 29) + '…' : item.productName;
      const str = `${item.quantity}× ${pName}`;
      
      // Calculate length contribution
      // First item has no comma prefix. Subsequent ones have ", " (2 chars)
      const separatorLen = i === 0 ? 0 : 2;
      
      // Reserve space for " (+XX more)" suffix if we can't fit everything
      // Max suffix length approx 15 chars e.g. " (+100 more)"
      const suffixReservation = 15;

      if (currentLength + separatorLen + str.length + suffixReservation <= availableSpace) {
        itemStrings.push(str);
        currentLength += separatorLen + str.length;
        itemsIncluded++;
      } else {
        break;
      }
    }

    itemSummary = itemStrings.join(', ');
    
    const remaining = report.items.length - itemsIncluded;
    if (remaining > 0) {
      itemSummary += ` (+${remaining} more)`;
    }
  }

  return `${header}: ${itemSummary} ${footer}`;
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
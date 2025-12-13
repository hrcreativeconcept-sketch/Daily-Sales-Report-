
export interface SalesItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  notes?: string;
  lowConfidence?: boolean;
}

export interface Totals {
  gross: number;
  discounts: number;
  net: number;
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
}

export type SourceType = 'manual' | 'ocr' | 'speech' | 'upload';

export interface DailyReport {
  reportId: string;
  dateLocal: string; // yyyy-mm-dd
  timeLocal: string; // HH:mm
  timezone: string;
  storeName: string;
  salesRepName: string;
  items: SalesItem[];
  totals: Totals;
  sources: SourceType[];
  attachments: Attachment[];
  shareMessage: string;
  createdAt: number; // Timestamp for sorting
  isOffDay?: boolean;
}

export interface AppConfig {
  salesRepName: string;
  phoneNumber?: string;
  enableReminders?: boolean;
  reminderTime?: string;
}
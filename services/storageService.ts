import { DailyReport, AppConfig } from '../types';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { supabase } from './supabaseClient';

// Helper to map camelCase (App) to snake_case (DB)
const mapToDb = (report: DailyReport) => ({
  report_id: report.reportId,
  date_local: report.dateLocal,
  time_local: report.timeLocal,
  timezone: report.timezone,
  store_name: report.storeName,
  sales_rep_name: report.salesRepName,
  items: report.items,
  totals: report.totals,
  sources: report.sources,
  attachments: report.attachments,
  share_message: report.shareMessage,
  created_at: report.createdAt
});

// Helper to map snake_case (DB) to camelCase (App)
const mapFromDb = (row: any): DailyReport => ({
  reportId: row.report_id,
  dateLocal: row.date_local || '',
  timeLocal: row.time_local || '',
  timezone: row.timezone || '',
  storeName: row.store_name || '',
  salesRepName: row.sales_rep_name || '',
  // Robustly handle potentially null JSONB columns
  items: Array.isArray(row.items) ? row.items : [],
  totals: row.totals || { gross: 0, discounts: 0, net: 0 },
  sources: Array.isArray(row.sources) ? row.sources : [],
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  shareMessage: row.share_message || '',
  // Handle both bigint (number/string) and ISO timestamp strings
  createdAt: (typeof row.created_at === 'string' && row.created_at.includes('T'))
    ? new Date(row.created_at).getTime()
    : parseInt(String(row.created_at || '0'), 10)
});

export const loadReports = async (): Promise<DailyReport[]> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100); // SECURITY: Limit to recent 100 reports to prevent massive payload

  if (error) {
    // Log the specific message so it's readable in console
    console.error('Error loading reports:', error.message, error.details || '');
    return [];
  }

  if (!data) return [];

  // Map safely, filtering out any rows that fail mapping
  return data.map(row => {
    try {
      return mapFromDb(row);
    } catch (e) {
      console.warn('Skipping malformed report row:', row, e);
      return null;
    }
  }).filter(Boolean) as DailyReport[];
};

export const saveReport = async (report: DailyReport): Promise<void> => {
  // Security Check: URL/Content Validation
  // Prevent XSS vectors or malicious schemes in text fields
  const dangerousPatterns = /javascript:|vbscript:|data:|file:/i;
  
  if (dangerousPatterns.test(report.shareMessage)) {
    throw new Error("Security Error: Share message contains unsafe content.");
  }
  
  if (report.items.some(i => i.notes && dangerousPatterns.test(i.notes))) {
    throw new Error("Security Error: Item notes contain unsafe content.");
  }

  if (report.attachments.some(a => dangerousPatterns.test(a.url))) {
    throw new Error("Security Error: Attachment contains unsafe URL.");
  }

  // Security: Client-side size check before sending
  const payload = mapToDb(report);
  const jsonSize = JSON.stringify(payload).length;
  if (jsonSize > 1000000) { // 1MB limit for safety
    throw new Error("Report is too large to save (exceeds 1MB). Please remove some items or notes.");
  }

  const { error } = await supabase
    .from('daily_reports')
    .upsert(payload);

  if (error) {
    console.error('Error saving report:', error.message, error.details || '');
    throw new Error(`Database Error: ${error.message}`);
  }
};

export const clearAllReports = async (): Promise<void> => {
  // Delete all rows where report_id is not a dummy UUID (effectively all rows)
  // We use .gte('created_at', 0) as a safe "all" filter if needed, 
  // but depending on RLS, a simple delete might require a WHERE clause.
  const { error } = await supabase
    .from('daily_reports')
    .delete()
    .gte('created_at', 0);

  if (error) {
    console.error('Error clearing reports:', error.message);
    throw new Error(`Database Error: ${error.message}`);
  }
};

export const deleteReports = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  
  const { error } = await supabase
    .from('daily_reports')
    .delete()
    .in('report_id', ids);

  if (error) {
    console.error('Error deleting reports:', error.message);
    throw new Error(`Database Error: ${error.message}`);
  }
};

export const getReportById = async (id: string): Promise<DailyReport | undefined> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('report_id', id)
    .single();

  if (error) {
    console.error('Error fetching report by ID:', error.message);
    return undefined;
  }
  
  if (!data) return undefined;

  return mapFromDb(data);
};

export const uploadFile = async (file: File): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('uploads') // Assuming 'uploads' bucket. If not present, will error.
      .upload(fileName, file);

    if (error) {
      console.warn('Upload failed (check if bucket "uploads" exists):', error.message);
      return null;
    }

    if (!data?.path) return null;

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (e) {
    console.error('Upload error:', e);
    return null;
  }
};

// Keep Config in LocalStorage for simplicity (per-device preference)
export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(config));
};

export const loadConfig = (): AppConfig => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
  return data ? JSON.parse(data) : { salesRepName: '' };
};
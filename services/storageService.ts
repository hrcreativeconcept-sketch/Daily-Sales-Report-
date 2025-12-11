
import { DailyReport, AppConfig, SalesItem, SourceType } from '../types';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { supabase } from './supabaseClient';
import { generateId } from '../utils/calculations';

// Exported for authService usage
export const getDeviceId = (): string => {
  const KEY = 'dsr_device_id_v1';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY, id);
  }
  return id;
};

// Helper to get current authenticated user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
};

// Helper to map camelCase (App) to snake_case (DB)
const mapToDb = async (report: DailyReport) => {
  const deviceId = getDeviceId();
  const userId = await getCurrentUserId();
  
  // Clean existing tags to avoid duplication
  const cleanSources = report.sources.filter(s => !s.startsWith('device:') && !s.startsWith('user:'));
  
  // Explicitly cast to string[] to allow adding internal tags
  const finalSources: string[] = [...cleanSources];
  
  // Always add device ID for audit/tracking
  finalSources.push(`device:${deviceId}`);
  
  // If user is logged in, add user ID (this becomes the primary isolation key)
  if (userId) {
    finalSources.push(`user:${userId}`);
  }
  
  return {
    report_id: report.reportId,
    // user_id column removed as it does not exist in the schema
    date_local: report.dateLocal,
    time_local: report.timeLocal,
    timezone: report.timezone,
    store_name: report.storeName,
    sales_rep_name: report.salesRepName,
    items: report.items,
    totals: report.totals,
    sources: finalSources,
    attachments: report.attachments,
    share_message: report.shareMessage,
    created_at: report.createdAt
  };
};

// Helper to map snake_case (DB) to camelCase (App)
const mapFromDb = (row: any): DailyReport => {
  let rawSources: any[] = [];
  
  if (Array.isArray(row.sources)) {
    rawSources = row.sources;
  } else if (typeof row.sources === 'string') {
    try {
      const parsed = JSON.parse(row.sources);
      if (Array.isArray(parsed)) rawSources = parsed;
    } catch (e) { }
  }

  // Filter out internal isolation tags so they don't clutter UI
  const cleanSources = rawSources.filter((s: string) => 
    typeof s === 'string' && !s.startsWith('device:') && !s.startsWith('user:')
  ) as SourceType[];

  return {
    reportId: row.report_id,
    dateLocal: row.date_local || '',
    timeLocal: row.time_local || '',
    timezone: row.timezone || '',
    storeName: row.store_name || '',
    salesRepName: row.sales_rep_name || '',
    items: Array.isArray(row.items) ? row.items : [],
    totals: row.totals || { gross: 0, discounts: 0, net: 0 },
    sources: cleanSources,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    shareMessage: row.share_message || '',
    createdAt: (typeof row.created_at === 'string' && row.created_at.includes('T'))
      ? new Date(row.created_at).getTime()
      : parseInt(String(row.created_at || '0'), 10)
  };
};

export const loadReports = async (): Promise<DailyReport[]> => {
  const deviceId = getDeviceId();
  const userId = await getCurrentUserId();
  
  // Fetch recent reports
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Error loading reports:', error.message, error.details || '');
    return [];
  }

  if (!data) return [];

  // ISOLATION LOGIC:
  // If User Logged In -> Show only reports with matching user:${userId}
  // If Guest -> Show only reports with matching device:${deviceId}
  
  return data.filter(row => {
    let sources: string[] = [];
    if (Array.isArray(row.sources)) {
      sources = row.sources;
    } else if (typeof row.sources === 'string') {
      try { sources = JSON.parse(row.sources); } catch {}
    }
    
    if (!Array.isArray(sources)) return false;

    if (userId) {
      // Authenticated Mode: Strict User Isolation
      return sources.includes(`user:${userId}`);
    } else {
      // Guest Mode: Device Isolation
      return sources.includes(`device:${deviceId}`);
    }
  }).map(row => {
    try {
      return mapFromDb(row);
    } catch (e) {
      console.warn('Skipping malformed report row:', row, e);
      return null;
    }
  }).filter(Boolean) as DailyReport[];
};

export const saveReport = async (report: DailyReport): Promise<void> => {
  // Security Checks
  const dangerousPatterns = /javascript:|vbscript:|data:|file:/i;
  if (dangerousPatterns.test(report.shareMessage)) throw new Error("Security Error: Unsafe content.");
  if (report.items.some(i => i.notes && dangerousPatterns.test(i.notes))) throw new Error("Security Error: Unsafe content.");

  const payload = await mapToDb(report); // Now async
  
  const jsonSize = JSON.stringify(payload).length;
  if (jsonSize > 1000000) throw new Error("Report too large (max 1MB).");

  const { error } = await supabase
    .from('daily_reports')
    .upsert(payload);

  if (error) {
    console.error('Error saving report:', error.message);
    throw new Error(`Database Error: ${error.message}`);
  }
};

export const clearAllReports = async (): Promise<void> => {
  const reports = await loadReports();
  const ids = reports.map(r => r.reportId);

  if (ids.length === 0) return;

  const { error } = await supabase
    .from('daily_reports')
    .delete()
    .in('report_id', ids);

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

  if (error) throw new Error(`Database Error: ${error.message}`);
};

export const getReportById = async (id: string): Promise<DailyReport | undefined> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('report_id', id)
    .single();

  if (error || !data) return undefined;
  return mapFromDb(data);
};

export const uploadFile = async (file: File): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${generateId()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('uploads').upload(fileName, file);
    if (error) return null;
    if (!data?.path) return null;
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(data.path);
    return publicUrl;
  } catch (e) {
    return null;
  }
};

export const saveOcrLog = async (imageUrl: string, analysis: SalesItem[]): Promise<void> => {
  const { error } = await supabase
    .from('reports')
    .insert({ image_url: imageUrl, analysis: JSON.stringify(analysis) });
  if (error) console.warn('Error logging OCR:', error.message);
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(config));
};

export const loadConfig = (): AppConfig => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
  return data ? JSON.parse(data) : { salesRepName: '' };
};

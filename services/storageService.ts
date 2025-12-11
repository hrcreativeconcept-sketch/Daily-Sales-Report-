
import { DailyReport, AppConfig, SalesItem, SourceType } from '../types';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { supabase } from './supabaseClient';
import { generateId } from '../utils/calculations';

// Helper to manage Device ID
const getDeviceId = (): string => {
  const KEY = 'dsr_device_id_v1';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY, id);
  }
  return id;
};

// Helper to map camelCase (App) to snake_case (DB)
const mapToDb = (report: DailyReport) => {
  const deviceId = getDeviceId();
  // Filter out any existing device tags to avoid duplication, then add current device tag
  const cleanSources = report.sources.filter(s => !s.startsWith('device:'));
  
  return {
    report_id: report.reportId,
    date_local: report.dateLocal,
    time_local: report.timeLocal,
    timezone: report.timezone,
    store_name: report.storeName,
    sales_rep_name: report.salesRepName,
    items: report.items,
    totals: report.totals,
    // Add device tag to isolate data
    sources: [...cleanSources, `device:${deviceId}`],
    attachments: report.attachments,
    share_message: report.shareMessage,
    created_at: report.createdAt
  };
};

// Helper to map snake_case (DB) to camelCase (App)
const mapFromDb = (row: any): DailyReport => {
  let rawSources: any[] = [];
  
  // Robust handling: field might be returned as array OR string depending on DB driver/column type
  if (Array.isArray(row.sources)) {
    rawSources = row.sources;
  } else if (typeof row.sources === 'string') {
    try {
      const parsed = JSON.parse(row.sources);
      if (Array.isArray(parsed)) rawSources = parsed;
    } catch (e) {
      // If parsing fails, treat as empty or ignore
    }
  }

  // Filter out device tags so they don't appear in UI
  const cleanSources = rawSources.filter((s: string) => typeof s === 'string' && !s.startsWith('device:')) as SourceType[];

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
  
  // FIX: Fetch data without server-side .contains() to avoid "invalid input syntax for type json" errors.
  // We filter the data in memory instead.
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

  // Client-side Isolation Logic
  return data.filter(row => {
    // robust check for sources
    let sources: string[] = [];
    if (Array.isArray(row.sources)) {
      sources = row.sources;
    } else if (typeof row.sources === 'string') {
      try { sources = JSON.parse(row.sources); } catch {}
    }
    
    // Only include rows that are tagged with this device ID
    return Array.isArray(sources) && sources.includes(`device:${deviceId}`);
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
  // Security Check: URL/Content Validation
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

  const payload = mapToDb(report);
  const jsonSize = JSON.stringify(payload).length;
  if (jsonSize > 1000000) { 
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
  // 1. Get IDs of reports belonging to this device (reusing safe loadReports logic)
  const reports = await loadReports();
  const ids = reports.map(r => r.reportId);

  if (ids.length === 0) return;

  // 2. Delete by ID
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
  
  // Just delete by ID (ownership implicitly checked because user can only select what they see)
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
    const fileName = `${Date.now()}_${generateId()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('uploads')
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

export const saveOcrLog = async (imageUrl: string, analysis: SalesItem[]): Promise<void> => {
  const { error } = await supabase
    .from('reports')
    .insert({
      image_url: imageUrl,
      analysis: JSON.stringify(analysis)
    });

  if (error) {
    console.warn('Error logging OCR analysis to reports table:', error.message);
  }
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(config));
};

export const loadConfig = (): AppConfig => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
  return data ? JSON.parse(data) : { salesRepName: '' };
};

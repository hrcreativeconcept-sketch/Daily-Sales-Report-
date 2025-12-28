
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
  
  // Clean existing internal tags to avoid duplication and ensure clean rebuild
  const cleanSources = report.sources.filter(s => 
    !s.startsWith('device:') && 
    !s.startsWith('user:') &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  );
  
  const finalSources: string[] = [...cleanSources];
  finalSources.push(`device:${deviceId}`);
  
  if (userId) {
    finalSources.push(userId);
    finalSources.push(`user:${userId}`);
  }
  
  return {
    report_id: report.reportId,
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

  const cleanSources = rawSources.filter((s: string) => 
    typeof s === 'string' && 
    !s.startsWith('device:') && 
    !s.startsWith('user:') &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
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
      : parseInt(String(row.created_at || '0'), 10) || Date.now()
  };
};

export const loadReports = async (): Promise<DailyReport[]> => {
  try {
    const deviceId = getDeviceId();
    const userId = await getCurrentUserId();
    const targetId = userId || `device:${deviceId}`;
    
    // Fix: Using manual 'cs' (contains) filter with JSON stringified array.
    // This resolves 'invalid input syntax for type json' errors on jsonb columns
    // by ensuring the containment value is a JSON-formatted string.
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .filter('sources', 'cs', JSON.stringify([targetId]))
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Database query error:', error.message);
      return [];
    }

    return (data || []).map(mapFromDb);
  } catch (err) {
    console.error('Critical error in loadReports:', err);
    return [];
  }
};

export const saveReport = async (report: DailyReport): Promise<void> => {
  const payload = await mapToDb(report);
  const { error } = await supabase
    .from('daily_reports')
    .upsert(payload, { onConflict: 'report_id' });

  if (error) {
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
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(data.path);
    return publicUrl;
  } catch (e) {
    return null;
  }
};

export const saveOcrLog = async (imageUrl: string, analysis: SalesItem[]): Promise<void> => {
  const deviceId = getDeviceId();
  const userId = await getCurrentUserId();
  const targetId = userId || `device:${deviceId}`;
  
  const { error } = await supabase
    .from('daily_reports')
    .insert({ 
      report_id: generateId(),
      store_name: 'OCR Log',
      sales_rep_name: 'System',
      attachments: [{ type: 'image', url: imageUrl }], 
      items: analysis, 
      sources: [targetId, 'ocr'],
      share_message: 'OCR log entry created automatically.',
      created_at: Date.now(),
      totals: { gross: 0, discounts: 0, net: 0 } // Default totals for constraints
    });
  if (error) console.warn('OCR Log sync failed:', error.message);
};

export const saveConfig = (config: AppConfig) => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.CONFIG, JSON.stringify(config));
};

export const loadConfig = (): AppConfig => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.CONFIG);
  const parsed = data ? JSON.parse(data) : {};
  return { 
    salesRepName: parsed.salesRepName || '',
    phoneNumber: parsed.phoneNumber || '',
    enableReminders: parsed.enableReminders || false,
    reminderTime: parsed.reminderTime || '22:00'
  };
};

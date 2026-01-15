
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
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch (e) {
    return null; // Handle offline / failed fetch
  }
};

// --- Local Storage Helpers ---
const loadLocalReports = (): DailyReport[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEYS.REPORTS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalReports = (reports: DailyReport[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (e) {
    console.error("Local save failed", e);
  }
};

// Helper to map camelCase (App) to snake_case (DB)
const mapToDb = async (report: DailyReport) => {
  const deviceId = getDeviceId();
  const userId = await getCurrentUserId();
  
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

/**
 * Loads reports from Supabase if available, merges with LocalStorage.
 */
export const loadReports = async (): Promise<DailyReport[]> => {
  const local = loadLocalReports();
  
  try {
    const deviceId = getDeviceId();
    const userId = await getCurrentUserId();
    const targetId = userId || `device:${deviceId}`;
    
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .filter('sources', 'cs', JSON.stringify([targetId]))
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.warn('Database query warning:', error.message);
      return local;
    }

    const remote = (data || []).map(mapFromDb);
    
    // Merge remote and local, unique by reportId
    const merged = [...remote];
    local.forEach(l => {
      if (!merged.find(m => m.reportId === l.reportId)) {
        merged.push(l);
      }
    });

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn('Supabase unreachable, using local fallback:', err);
    return local;
  }
};

export const saveReport = async (report: DailyReport): Promise<void> => {
  // 1. Save Locally first for immediate UI update
  const local = loadLocalReports();
  const existingIndex = local.findIndex(r => r.reportId === report.reportId);
  if (existingIndex > -1) {
    local[existingIndex] = report;
  } else {
    local.unshift(report);
  }
  saveLocalReports(local);

  // 2. Attempt Remote Save
  try {
    const payload = await mapToDb(report);
    const { error } = await supabase
      .from('daily_reports')
      .upsert(payload, { onConflict: 'report_id' });

    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync to cloud, data remains locally.", err);
    // Don't throw, we want the app to keep working locally
  }
};

export const deleteReports = async (ids: string[]): Promise<void> => {
  // 1. Delete Locally
  const local = loadLocalReports().filter(r => !ids.includes(r.reportId));
  saveLocalReports(local);

  // 2. Attempt Remote Delete
  try {
    const { error } = await supabase
      .from('daily_reports')
      .delete()
      .in('report_id', ids);

    if (error) throw error;
  } catch (err) {
    console.warn("Could not sync delete to cloud.", err);
  }
};

export const getReportById = async (id: string): Promise<DailyReport | undefined> => {
  // Check Local first
  const local = loadLocalReports().find(r => r.reportId === id);
  if (local) return local;

  // Attempt Remote
  try {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('report_id', id)
      .single();

    if (error || !data) return undefined;
    return mapFromDb(data);
  } catch (err) {
    return undefined;
  }
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
  try {
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
        totals: { gross: 0, discounts: 0, net: 0 } 
      });
    if (error) console.warn('OCR Log sync failed:', error.message);
  } catch (e) {}
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

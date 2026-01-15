
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Clock, MapPin, User, Calendar, CheckCircle, AlertTriangle, Loader2, Undo2, Redo2, Save } from 'lucide-react';
import { DailyReport, SalesItem, SourceType } from '../types';
import * as StorageService from '../services/storageService';
import * as CalculationUtils from '../utils/calculations';
import { MOCK_STORES, LOCAL_STORAGE_KEYS } from '../constants';
import useUndoRedo from '../hooks/useUndoRedo';

import CapturePanel from '../components/CapturePanel';
import ItemsTable from '../components/ItemsTable';
import TotalsPanel from '../components/TotalsPanel';

const ReportEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { state: report, set: setReport, undo, redo, canUndo, canRedo, init: initReport } = useUndoRedo<DailyReport | null>(null);
  
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [errors, setErrors] = useState<Record<number, { [key in keyof SalesItem]?: string } & { items?: string }>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (isNew) {
        const { dateLocal, timeLocal, tz } = CalculationUtils.getLocalDateTimeAndTimezone();
        const config = StorageService.loadConfig();
        
        const lastStore = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_STORE) || '';
        const defaultName = [config.salesRepName, config.phoneNumber].filter(Boolean).join(' | ');

        const newReport: DailyReport = {
          reportId: CalculationUtils.generateId(),
          dateLocal,
          timeLocal,
          timezone: tz,
          storeName: lastStore,
          salesRepName: defaultName,
          items: [],
          totals: { gross: 0, discounts: 0, net: 0 },
          sources: [],
          attachments: [],
          shareMessage: '',
          createdAt: Date.now()
        };
        initReport(newReport);
        setLoading(false);
      } else {
        const existing = await StorageService.getReportById(id as string);
        if (existing) {
          initReport(existing);
        } else {
          alert("Report not found");
          navigate('/');
        }
        setLoading(false);
      }
    };
    init();
  }, [id, isNew, navigate, initReport]);

  const updateReport = useCallback((changes: Partial<DailyReport>) => {
    if (!report) return;
    
    const updatedReport = { ...report, ...changes };
    const newTotals = CalculationUtils.computeTotals(updatedReport.items, updatedReport.totals.discounts);
    updatedReport.totals = newTotals;
    updatedReport.shareMessage = CalculationUtils.buildShareMessage(updatedReport);

    setReport(updatedReport);
    setIsDirty(true);
  }, [report, setReport]);

  const validate = (reportToValidate: DailyReport | null = report): boolean => {
    if (!reportToValidate) return false;
    let isValid = true;
    const newErrors: Record<number, { [key in keyof SalesItem]?: string } & { items?: string }> = {};
    setGlobalError(null);

    // SalesRepName is now optional per requirements
    if (!reportToValidate.storeName) {
      setGlobalError("Please select a store location.");
      isValid = false;
    }

    if (reportToValidate.items.length === 0) {
      newErrors[-1] = { items: "At least one item is required." }; 
      setGlobalError("Please add at least one item.");
      isValid = false;
    }

    reportToValidate.items.forEach((item, index) => {
      const itemErrors: { [key in keyof SalesItem]?: string } = {};
      if (!item.productName || !(item.productName || '').trim()) {
        itemErrors.productName = "Required";
        isValid = false;
      }
      if (item.quantity <= 0 || isNaN(item.quantity) || !Number.isInteger(item.quantity)) {
        itemErrors.quantity = "Min 1";
        isValid = false;
      }
      if (item.unitPrice < 0 || isNaN(item.unitPrice)) {
        itemErrors.unitPrice = "Invalid";
        isValid = false;
      }
      if (Object.keys(itemErrors).length > 0) {
        newErrors[index] = itemErrors;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = async (showErrorAlert = true): Promise<DailyReport | null> => {
    if (!report) return null;
    if (!validate()) return null;

    setSaving(true);
    try {
      await StorageService.saveReport(report);
      setIsDirty(false);
      setErrors({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return report;
    } catch (e: any) {
      if (showErrorAlert) alert(e.message || "Failed to save report.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    const saved = await handleSave();
    if (saved) navigate('/');
  };

  const handleShare = async () => {
    if (!report) return;
    if (!validate()) return;

    let reportToShare = report;
    if (isDirty || isNew) {
      const saved = await handleSave(false); 
      if (saved) reportToShare = saved;
    }
    navigate(`/share/${reportToShare.reportId}`, { state: { report: reportToShare } });
  };

  const handleItemsCaptured = (newItems: SalesItem[], source: SourceType) => {
    if (!report) return;
    updateReport({
      items: [...report.items, ...newItems],
      sources: Array.from(new Set([...report.sources, source]))
    });
  };

  const handleAddAttachments = useCallback((urls: string[]) => {
    if (!report) return;
    const newAttachments = urls.map(url => ({ type: 'image' as const, url }));
    updateReport({
      attachments: [...(report.attachments || []), ...newAttachments]
    });
  }, [report, updateReport]);

  if (loading || !report) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin mb-3 text-brand-600" size={32} />Loading Editor...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 font-sans">
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 px-4 py-3 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all active:scale-90"><ArrowLeft size={22} strokeWidth={2.5} /></button>
          <div className="h-6 w-px bg-slate-200 mx-1"></div>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-400 disabled:opacity-30 hover:text-slate-900 rounded-xl transition-all active:scale-90" title="Undo"><Undo2 size={20} /></button>
            <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-400 disabled:opacity-30 hover:text-slate-900 rounded-xl transition-all active:scale-90" title="Redo"><Redo2 size={20} /></button>
          </div>
          <div className="ml-2 flex items-center">
             {saveSuccess ? (
                <span className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.15em] flex items-center gap-1.5 animate-in zoom-in-95"><CheckCircle size={12}/> Success</span>
              ) : (
                <span className={`text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${isDirty ? 'text-amber-500' : 'text-slate-300'}`}>{isDirty ? 'Pending' : 'Synced'}</span>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="text-brand-600 hover:bg-brand-50 p-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2" title="Share Preview"><Share2 size={18} strokeWidth={2.5} /> <span className="hidden sm:inline">Preview</span></button>
          <button onClick={handleSaveAndExit} disabled={saving} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl shadow-elevated hover:bg-black active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 text-xs font-black uppercase tracking-widest">{saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={18} strokeWidth={2.5} />} Finish</button>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-8">
        {globalError && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-5 py-4 rounded-[2rem] flex items-center gap-3 animate-in slide-in-from-top-4 shadow-sm">
            <div className="p-2 bg-white rounded-full text-red-500 shadow-sm"><AlertTriangle size={18} /></div>
            <span className="text-xs font-bold uppercase tracking-tight">{globalError}</span>
          </div>
        )}

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-soft space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full blur-3xl -mr-16 -mt-16"></div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Reporting Date</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"><Calendar size={18} strokeWidth={2.5}/></div>
                  <input type="date" value={report.dateLocal} onChange={(e) => updateReport({ dateLocal: e.target.value })} className="w-full text-sm font-bold bg-slate-50 border border-transparent rounded-[1.25rem] pl-12 pr-4 py-4 focus:bg-white focus:border-brand-500 outline-none transition-all shadow-inner" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Logging Time</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"><Clock size={18} strokeWidth={2.5}/></div>
                  <input type="time" value={report.timeLocal} onChange={(e) => updateReport({ timeLocal: e.target.value })} className="w-full text-sm font-bold bg-slate-50 border border-transparent rounded-[1.25rem] pl-12 pr-4 py-4 focus:bg-white focus:border-brand-500 outline-none transition-all shadow-inner" />
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Workspace / Store</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"><MapPin size={18} strokeWidth={2.5}/></div>
              <select 
                value={report.storeName || ''} 
                onChange={(e) => { 
                  const val = e.target.value; 
                  updateReport({ storeName: val }); 
                  if (val) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_STORE, val); 
                }} 
                className={`w-full text-sm font-bold bg-slate-50 border border-transparent rounded-[1.25rem] pl-12 pr-10 py-4 appearance-none focus:bg-white focus:border-brand-500 outline-none transition-all shadow-inner ${!report.storeName ? 'ring-2 ring-red-100' : ''}`}
              >
                <option value="">Choose Location...</option>
                {MOCK_STORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {!report.storeName && (
              <p className="text-[9px] text-red-500 font-black uppercase tracking-widest ml-4 mt-1 animate-pulse">Required</p>
            )}
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Sales Agent <span className="text-[8px] opacity-50 font-medium">(Optional)</span></label>
             <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors"><User size={18} strokeWidth={2.5}/></div>
                <input type="text" placeholder="Your Name" value={report.salesRepName || ''} onChange={(e) => updateReport({ salesRepName: e.target.value })} className="w-full text-sm font-bold bg-slate-50 border border-transparent rounded-[1.25rem] pl-12 pr-4 py-4 focus:bg-white focus:border-brand-500 outline-none transition-all shadow-inner" />
             </div>
          </div>
        </div>

        <CapturePanel onItemsCaptured={handleItemsCaptured} isProcessing={processing} setIsProcessing={setProcessing} onAttachmentsAdded={handleAddAttachments} />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3">
             <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-brand-500 rounded-full"></div> Entry Table
             </h2>
             <span className="text-[9px] font-black text-slate-900 bg-white border border-slate-100 px-3 py-1 rounded-full shadow-soft">{report.items.length} Units</span>
          </div>
          <ItemsTable items={report.items} onChange={(items) => updateReport({ items })} isParsing={processing} errors={errors} />
        </div>

        <TotalsPanel totals={report.totals} onDiscountChange={(d) => updateReport({ totals: { ...report.totals, discounts: d } })} />
      </div>
    </div>
  );
};

export default ReportEditor;

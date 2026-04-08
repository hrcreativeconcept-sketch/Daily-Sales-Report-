
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
import ConfirmModal from '../components/ConfirmModal';

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
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showNotFoundAlert, setShowNotFoundAlert] = useState(false);
  
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
          setShowNotFoundAlert(true);
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

  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      navigate('/');
    }
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
      if (showErrorAlert) setGlobalError(e.message || "Failed to save report.");
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

  if (loading || !report) return <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-screen font-mono text-[10px] uppercase tracking-widest"><Loader2 className="animate-spin mb-4 text-slate-900" size={32} />Initializing Workspace...</div>;

  return (
    <div className="min-h-screen bg-white pb-32 font-sans">
      <ConfirmModal 
        isOpen={showUnsavedModal} 
        onClose={() => setShowUnsavedModal(false)} 
        onConfirm={() => navigate('/')}
        title="Unsaved Changes"
        message="You have unsaved modifications in this report. Are you sure you want to exit? All unsaved data will be lost."
        confirmLabel="Exit Anyway"
        cancelLabel="Stay"
        variant="danger"
      />

      <ConfirmModal 
        isOpen={showNotFoundAlert} 
        onClose={() => navigate('/')} 
        onConfirm={() => navigate('/')}
        title="Record Not Found"
        message="The requested sales report could not be located in the system database. It may have been archived or deleted."
        confirmLabel="Return to Dashboard"
      />

      <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all active:scale-90"><ArrowLeft size={20} strokeWidth={2.5} /></button>
          <div className="h-4 w-px bg-slate-200 mx-1"></div>
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={!canUndo} className="p-2 text-slate-400 disabled:opacity-30 hover:text-slate-900 rounded-xl transition-all active:scale-90" title="Undo"><Undo2 size={18} /></button>
            <button onClick={redo} disabled={!canRedo} className="p-2 text-slate-400 disabled:opacity-30 hover:text-slate-900 rounded-xl transition-all active:scale-90" title="Redo"><Redo2 size={18} /></button>
          </div>
          <div className="ml-2 flex items-center">
             {saveSuccess ? (
                <span className="text-[9px] text-emerald-600 font-mono font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 animate-in zoom-in-95"><CheckCircle size={10}/> Committed</span>
              ) : (
                <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.15em] transition-colors ${isDirty ? 'text-amber-500' : 'text-slate-300'}`}>{isDirty ? 'Modified' : 'Synced'}</span>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="text-slate-600 hover:bg-slate-50 p-2.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2" title="Share Preview"><Share2 size={16} strokeWidth={2.5} /> <span className="hidden sm:inline">Preview</span></button>
          <button onClick={handleSaveAndExit} disabled={saving} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-black active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={16} strokeWidth={2.5} />} Save & Exit</button>
        </div>
      </div>

      <div className="max-w-xl mx-auto p-6 space-y-8">
        {globalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-4">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-tight">{globalError}</span>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Reporting Date</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors"><Calendar size={16} strokeWidth={2.5}/></div>
                  <input type="date" value={report.dateLocal} onChange={(e) => updateReport({ dateLocal: e.target.value })} className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:bg-white focus:border-slate-900 outline-none transition-all" />
                </div>
             </div>
             <div className="space-y-2">
                <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Logging Time</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors"><Clock size={16} strokeWidth={2.5}/></div>
                  <input type="time" value={report.timeLocal} onChange={(e) => updateReport({ timeLocal: e.target.value })} className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:bg-white focus:border-slate-900 outline-none transition-all" />
                </div>
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Workspace Node</label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors"><MapPin size={16} strokeWidth={2.5}/></div>
              <select 
                value={report.storeName || ''} 
                onChange={(e) => { 
                  const val = e.target.value; 
                  updateReport({ storeName: val }); 
                  if (val) localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_STORE, val); 
                }} 
                className={`w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-10 py-3.5 appearance-none focus:bg-white focus:border-slate-900 outline-none transition-all ${!report.storeName ? 'border-red-200' : ''}`}
              >
                <option value="">Choose Location...</option>
                {MOCK_STORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {!report.storeName && (
              <p className="text-[8px] text-red-500 font-mono font-bold uppercase tracking-widest ml-1 mt-1">Required Field</p>
            )}
          </div>

          <div className="space-y-2">
             <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Sales Agent <span className="text-[8px] opacity-50 font-medium">(Optional)</span></label>
             <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors"><User size={16} strokeWidth={2.5}/></div>
                <input type="text" placeholder="Agent Identity" value={report.salesRepName || ''} onChange={(e) => updateReport({ salesRepName: e.target.value })} className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3.5 focus:bg-white focus:border-slate-900 outline-none transition-all" />
             </div>
          </div>
        </div>

        <CapturePanel onItemsCaptured={handleItemsCaptured} isProcessing={processing} setIsProcessing={setProcessing} onAttachmentsAdded={handleAddAttachments} />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <h2 className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
               Data Entry Table
             </h2>
             <span className="text-[8px] font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">{report.items.length} SKU Units</span>
          </div>
          <ItemsTable items={report.items} onChange={(items) => updateReport({ items })} isParsing={processing} errors={errors} />
        </div>

        <TotalsPanel totals={report.totals} onDiscountChange={(d) => updateReport({ totals: { ...report.totals, discounts: d } })} />
      </div>
    </div>
  );
};

export default ReportEditor;

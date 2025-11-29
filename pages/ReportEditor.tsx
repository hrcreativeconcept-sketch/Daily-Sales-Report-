import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Clock, MapPin, User, Calendar, CheckCircle, Globe, AlertTriangle, Loader2, Undo2, Redo2, Save } from 'lucide-react';
import { DailyReport, SalesItem, SourceType } from '../types';
import * as StorageService from '../services/storageService';
import * as CalculationUtils from '../utils/calculations';
import { MOCK_STORES } from '../constants';
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
  
  // Use Custom Hook for State Management
  const { state: report, set: setReport, undo, redo, canUndo, canRedo, init: initReport } = useUndoRedo<DailyReport | null>(null);
  
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dateWarning, setDateWarning] = useState<{msg: string, date: string} | null>(null);
  
  // Validation State
  const [errors, setErrors] = useState<Record<number, { [key in keyof SalesItem]?: string } & { items?: string }>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Initialize Report
  useEffect(() => {
    const init = async () => {
      if (isNew) {
        const { dateLocal, timeLocal, tz } = CalculationUtils.getLocalDateTimeAndTimezone();
        const config = StorageService.loadConfig();
        const newReport: DailyReport = {
          reportId: CalculationUtils.generateId(),
          dateLocal,
          timeLocal,
          timezone: tz,
          storeName: MOCK_STORES[0],
          salesRepName: config.salesRepName || '',
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

  // Atomic Update Function
  // Handles all field updates + re-calculations (Totals, ShareMessage) in one go
  // This ensures history states are always valid and complete.
  const updateReport = useCallback((changes: Partial<DailyReport>) => {
    if (!report) return;
    
    const updatedReport = { ...report, ...changes };
    
    // 1. Recalculate Totals
    const newTotals = CalculationUtils.computeTotals(updatedReport.items, updatedReport.totals.discounts);
    updatedReport.totals = newTotals;

    // 2. Recalculate Share Message
    updatedReport.shareMessage = CalculationUtils.buildShareMessage(updatedReport);

    setReport(updatedReport);
    setIsDirty(true);
  }, [report, setReport]);

  // Timezone & Date Consistency Check
  useEffect(() => {
    if (!report?.timezone || !report?.dateLocal) return;

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA is yyyy-mm-dd
        timeZone: report.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const todayInTz = formatter.format(now);

      if (todayInTz !== report.dateLocal) {
        setDateWarning({
          msg: `It is currently ${todayInTz} in ${report.timezone.split('/')[1] || report.timezone}.`,
          date: todayInTz
        });
      } else {
        setDateWarning(null);
      }
    } catch (e) {
      setDateWarning(null); 
    }
  }, [report?.timezone, report?.dateLocal]);

  const validate = (): boolean => {
    if (!report) return false;
    let isValid = true;
    const newErrors: Record<number, { [key in keyof SalesItem]?: string } & { items?: string }> = {};
    setGlobalError(null);

    // 1. Check Items Length
    if (report.items.length === 0) {
      newErrors[-1] = { items: "At least one item is required." }; 
      setGlobalError("Please add at least one item.");
      isValid = false;
    }

    // 2. Check Item Fields
    report.items.forEach((item, index) => {
      const itemErrors: { [key in keyof SalesItem]?: string } = {};

      if (!item.productName || !item.productName.trim()) {
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

  const handleSave = async () => {
    if (!report) return false;
    
    // Trim string fields
    report.salesRepName = report.salesRepName.trim();
    report.items = report.items.map(i => ({
      ...i,
      productName: i.productName.trim(),
      sku: i.sku.trim(),
      notes: i.notes?.trim() || ''
    }));

    if (!report.salesRepName) {
      alert("Please enter a Sales Rep Name");
      return false;
    }

    if (!validate()) {
      return false;
    }

    setSaving(true);
    try {
      await StorageService.saveReport(report);
      StorageService.saveConfig({ salesRepName: report.salesRepName });
      setIsDirty(false);
      setErrors({});
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (e) {
      alert("Failed to save report. Please check your connection.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    const success = await handleSave();
    if (success) navigate('/');
  };

  const handleShare = async () => {
    if (isDirty || isNew) {
      const success = await handleSave();
      if (!success) return;
    }
    navigate(`/share/${report?.reportId}`);
  };

  const handleItemsCaptured = (newItems: SalesItem[], source: SourceType) => {
    if (!report) return;
    updateReport({
      items: [...report.items, ...newItems],
      sources: Array.from(new Set([...report.sources, source]))
    });
  };

  const handleRemoveAttachment = (index: number) => {
    if (!report) return;
    const newAttachments = [...report.attachments];
    newAttachments.splice(index, 1);
    updateReport({ attachments: newAttachments });
  };

  const handleAddAttachments = (urls: string[]) => {
    if (!report) return;
    const newAttachments = urls.map(url => ({ type: 'image' as const, url }));
    updateReport({ attachments: [...report.attachments, ...newAttachments] });
  };

  if (loading || !report) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin mb-3 text-brand-600" size={32} />Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Sticky Header with Backdrop Blur */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 px-4 py-3 flex items-center justify-between shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
            <ArrowLeft size={22} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-900 leading-tight">{isNew ? 'New Report' : 'Edit Report'}</h1>
              {/* Undo / Redo Buttons */}
              <div className="flex gap-1 ml-2">
                <button 
                  onClick={undo} 
                  disabled={!canUndo} 
                  className="p-1 text-gray-500 disabled:opacity-30 hover:bg-gray-100 rounded-md transition-all active:scale-90"
                  title="Undo"
                >
                  <Undo2 size={18} />
                </button>
                <button 
                  onClick={redo} 
                  disabled={!canRedo} 
                  className="p-1 text-gray-500 disabled:opacity-30 hover:bg-gray-100 rounded-md transition-all active:scale-90"
                  title="Redo"
                >
                  <Redo2 size={18} />
                </button>
              </div>
            </div>

            {saveSuccess ? (
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-1 animate-in fade-in"><CheckCircle size={10}/> Saved</span>
            ) : (
              <span className={`text-[10px] font-medium transition-colors ${isDirty ? 'text-amber-500' : 'text-gray-400'}`}>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            )}
          </div>
        </div>
        
        {/* Updated Actions: Clear Labeled Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={handleShare} 
            className="bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm hover:shadow-md" 
            title="Save & Share"
          >
            <Share2 size={16} /> Share
          </button>
          <button 
            onClick={handleSaveAndExit} 
            disabled={saving}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-gray-900/20 hover:bg-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-bold"
          >
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={16} />}
            Save
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        
        {globalError && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 shadow-sm">
            <div className="p-1.5 bg-white rounded-full text-red-500 shadow-sm"><AlertTriangle size={16} /></div>
            <span className="text-sm font-semibold">{globalError}</span>
          </div>
        )}

        {/* Metadata Card */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Date</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Calendar size={16}/></div>
                  <input 
                    type="date" 
                    value={report.dateLocal}
                    onChange={(e) => updateReport({ dateLocal: e.target.value })}
                    className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                  />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Time</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Clock size={16}/></div>
                  <input 
                    type="time" 
                    value={report.timeLocal}
                    onChange={(e) => updateReport({ timeLocal: e.target.value })}
                    className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                  />
                </div>
             </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Timezone</label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Globe size={16}/></div>
              <input 
                list="timezones"
                type="text" 
                value={report.timezone}
                onChange={(e) => updateReport({ timezone: e.target.value })}
                className={`w-full text-sm font-medium bg-gray-50 border rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all ${!report.timezone ? 'border-red-300' : 'border-gray-200'}`}
                placeholder="Select or type..."
              />
              <datalist id="timezones">
                <option value="Asia/Dubai" />
                <option value="Asia/Riyadh" />
                <option value="Europe/London" />
                <option value="America/New_York" />
              </datalist>
            </div>

            {dateWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-900 flex items-center justify-between animate-in fade-in slide-in-from-top-1 shadow-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={14} className="text-amber-600"/> 
                  {dateWarning.msg}
                </span>
                <button 
                  onClick={() => {
                    updateReport({ dateLocal: dateWarning.date });
                    setDateWarning(null);
                  }}
                  className="bg-white text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 font-bold text-[10px] uppercase hover:bg-amber-50 shadow-sm transition-all active:scale-95"
                >
                  Update
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Store Location</label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><MapPin size={16}/></div>
              <select 
                value={report.storeName}
                onChange={(e) => updateReport({ storeName: e.target.value })}
                className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-8 py-3 appearance-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
              >
                {MOCK_STORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Sales Rep</label>
             <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><User size={16}/></div>
                <input 
                  type="text" 
                  placeholder="Your Name"
                  value={report.salesRepName}
                  onChange={(e) => updateReport({ salesRepName: e.target.value })}
                  className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder-gray-300"
                />
             </div>
          </div>
        </div>

        <CapturePanel 
          onItemsCaptured={handleItemsCaptured} 
          isProcessing={processing}
          setIsProcessing={setProcessing}
          // Pass callback for attachment handling
          onAttachmentsAdded={handleAddAttachments}
        />

        {/* Attachments List */}
        {report.attachments.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Attachments ({report.attachments.length})</h2>
            <div className="grid grid-cols-3 gap-3">
              {report.attachments.map((att, idx) => (
                <div key={idx} className="relative group aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img src={att.url} alt="Attachment" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => handleRemoveAttachment(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowLeft size={12} className="rotate-45" /> {/* Simulating X icon with rotate */}
                  </button>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-0"></a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between px-1 mb-3">
             <h2 className="text-sm font-bold text-gray-800">Sales Items</h2>
             <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">{report.items.length} items</span>
          </div>
          <ItemsTable 
            items={report.items} 
            onChange={(items) => updateReport({ items })}
            isParsing={processing}
            errors={errors}
          />
        </div>

        <TotalsPanel 
          totals={report.totals} 
          onDiscountChange={(d) => updateReport({ totals: { ...report.totals, discounts: d } })} 
        />

        {report.shareMessage && (
          <div className="bg-green-50 p-5 rounded-2xl border border-green-200/60 cursor-pointer hover:bg-green-100 transition-all active:scale-[0.99] shadow-sm group" onClick={handleShare}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xs font-bold text-green-700 uppercase flex items-center gap-1.5">
                 <div className="p-1 bg-white rounded-md shadow-sm text-green-600"><Share2 size={12}/></div>
                 WhatsApp Preview
              </h3>
            </div>
            <p className="text-sm text-green-900 font-medium italic leading-relaxed opacity-90 group-hover:opacity-100">
              "{report.shareMessage}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportEditor;
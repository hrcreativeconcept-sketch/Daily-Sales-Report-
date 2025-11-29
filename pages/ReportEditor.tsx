import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Clock, MapPin, User, Calendar, CheckCircle, Globe, AlertTriangle, Loader2 } from 'lucide-react';
import { DailyReport, SalesItem, SourceType } from '../types';
import * as StorageService from '../services/storageService';
import * as CalculationUtils from '../utils/calculations';
import { MOCK_STORES } from '../constants';

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
  const [report, setReport] = useState<DailyReport | null>(null);
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
        setReport(newReport);
        setLoading(false);
      } else {
        const existing = await StorageService.getReportById(id as string);
        if (existing) {
          setReport(existing);
        } else {
          alert("Report not found");
          navigate('/');
        }
        setLoading(false);
      }
    };
    init();
  }, [id, isNew, navigate]);

  // Recalculate totals
  useEffect(() => {
    if (!report) return;
    const newTotals = CalculationUtils.computeTotals(report.items, report.totals.discounts);
    if (newTotals.net !== report.totals.net || newTotals.gross !== report.totals.gross) {
       setReport(prev => prev ? ({ ...prev, totals: newTotals }) : null);
       setIsDirty(true);
    }
  }, [report?.items, report?.totals.discounts]);

  // Update share message
  useEffect(() => {
    if (!report) return;
    const msg = CalculationUtils.buildShareMessage(report);
    if (msg !== report.shareMessage) {
       setReport(prev => prev ? ({ ...prev, shareMessage: msg }) : null);
       setIsDirty(true);
    }
  }, [report?.items, report?.totals, report?.storeName, report?.dateLocal]);

  // Timezone & Date Consistency Check
  useEffect(() => {
    if (!report?.timezone || !report?.dateLocal) return;

    try {
      // Current instant in the selected timezone
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
      // Invalid timezone string handling, ignore
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
      newErrors[-1] = { items: "At least one item is required." }; // Hack for global error in list
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
    
    // Validate Metadata
    if (!report.salesRepName.trim()) {
      alert("Please enter a Sales Rep Name");
      return false;
    }

    // Run Validation
    if (!validate()) {
      return false;
    }

    setSaving(true);
    try {
      await StorageService.saveReport(report);
      StorageService.saveConfig({ salesRepName: report.salesRepName });
      setIsDirty(false);
      setErrors({});
      
      // Show quick success indicator
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
    // If dirty, save first. If save fails, don't navigate.
    if (isDirty || isNew) {
      const success = await handleSave();
      if (!success) return;
    }
    navigate(`/share/${report?.reportId}`);
  };

  const handleItemsCaptured = (newItems: SalesItem[], source: SourceType) => {
    if (!report) return;
    setReport({
      ...report,
      items: [...report.items, ...newItems],
      sources: Array.from(new Set([...report.sources, source]))
    });
    // Clear errors when new items are added, or just leave them until next save attempt?
    // Let's keep them, but validation will re-run on save.
    setIsDirty(true);
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
            <h1 className="text-base font-bold text-gray-900 leading-tight">{isNew ? 'New Report' : 'Edit Report'}</h1>
            {saveSuccess ? (
              <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-1 animate-in fade-in"><CheckCircle size={10}/> Saved</span>
            ) : (
              <span className={`text-[10px] font-medium transition-colors ${isDirty ? 'text-amber-500' : 'text-gray-400'}`}>{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="text-brand-600 p-2.5 hover:bg-brand-50 rounded-full transition-colors active:scale-95" title="Share">
            <Share2 size={22} />
          </button>
          <button 
            onClick={handleSaveAndExit} 
            disabled={saving}
            className="text-white font-bold text-xs bg-gray-900 px-4 py-2.5 rounded-xl shadow-lg shadow-gray-900/10 hover:bg-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 size={12} className="animate-spin"/>}
            SAVE
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-6">
        
        {/* Global Error Banner */}
        {globalError && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 shadow-sm">
            <div className="p-1.5 bg-white rounded-full text-red-500 shadow-sm"><AlertTriangle size={16} /></div>
            <span className="text-sm font-semibold">{globalError}</span>
          </div>
        )}

        {/* Metadata Card - Modern Grid */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-4">
             {/* Date Input */}
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Date</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Calendar size={16}/></div>
                  <input 
                    type="date" 
                    value={report.dateLocal}
                    onChange={(e) => { setReport({ ...report, dateLocal: e.target.value }); setIsDirty(true); }}
                    className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                  />
                </div>
             </div>
             {/* Time Input */}
             <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Time</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Clock size={16}/></div>
                  <input 
                    type="time" 
                    value={report.timeLocal}
                    onChange={(e) => { setReport({ ...report, timeLocal: e.target.value }); setIsDirty(true); }}
                    className="w-full text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
                  />
                </div>
             </div>
          </div>
          
          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Timezone</label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><Globe size={16}/></div>
              <input 
                list="timezones"
                type="text" 
                value={report.timezone}
                onChange={(e) => { setReport({...report, timezone: e.target.value}); setIsDirty(true); }}
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

            {/* Timezone Warning */}
            {dateWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-900 flex items-center justify-between animate-in fade-in slide-in-from-top-1 shadow-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={14} className="text-amber-600"/> 
                  {dateWarning.msg}
                </span>
                <button 
                  onClick={() => {
                    setReport({...report, dateLocal: dateWarning.date});
                    setIsDirty(true);
                    setDateWarning(null);
                  }}
                  className="bg-white text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 font-bold text-[10px] uppercase hover:bg-amber-50 shadow-sm transition-all active:scale-95"
                >
                  Update
                </button>
              </div>
            )}
          </div>

          {/* Store Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Store Location</label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><MapPin size={16}/></div>
              <select 
                value={report.storeName}
                onChange={(e) => { setReport({...report, storeName: e.target.value}); setIsDirty(true); }}
                className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-8 py-3 appearance-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all"
              >
                {MOCK_STORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ArrowLeft size={14} className="-rotate-90" />
              </div>
            </div>
          </div>

          {/* Sales Rep */}
          <div className="space-y-1.5">
             <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Sales Rep</label>
             <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors"><User size={16}/></div>
                <input 
                  type="text" 
                  placeholder="Your Name"
                  value={report.salesRepName}
                  onChange={(e) => { setReport({ ...report, salesRepName: e.target.value }); setIsDirty(true); }}
                  className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder-gray-300"
                />
             </div>
          </div>
        </div>

        {/* AI Capture Panel */}
        <CapturePanel 
          onItemsCaptured={handleItemsCaptured} 
          isProcessing={processing}
          setIsProcessing={setProcessing}
        />

        {/* Items List */}
        <div>
          <div className="flex items-center justify-between px-1 mb-3">
             <h2 className="text-sm font-bold text-gray-800">Sales Items</h2>
             <span className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">{report.items.length} items</span>
          </div>
          <ItemsTable 
            items={report.items} 
            onChange={(items) => { setReport({ ...report, items }); setIsDirty(true); }}
            isParsing={processing}
            errors={errors}
          />
        </div>

        {/* Totals */}
        <TotalsPanel 
          totals={report.totals} 
          onDiscountChange={(d) => { setReport({ ...report, totals: { ...report.totals, discounts: d } }); setIsDirty(true); }} 
        />

        {/* Live Preview */}
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

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Clock, MapPin, User, Calendar, CheckCircle, Globe, AlertTriangle, Loader2, Undo2, Redo2, Save, Users, X, Split, Percent, Copy, MessageCircle, ArrowRightLeft, ArrowRight, ArrowLeft as ArrowLeftIcon, Plus, Minus } from 'lucide-react';
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

  // Split Feature State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState<0.5 | 0.6 | 0.7>(0.5);
  const [staff2Name, setStaff2Name] = useState('');
  
  // Advanced Split State
  const [splitItemsA, setSplitItemsA] = useState<SalesItem[]>([]);
  const [splitItemsB, setSplitItemsB] = useState<SalesItem[]>([]);
  
  // New State for Success View
  const [createdSplitReports, setCreatedSplitReports] = useState<{a: DailyReport, b: DailyReport} | null>(null);

  // Initialize Report
  useEffect(() => {
    const init = async () => {
      if (isNew) {
        const { dateLocal, timeLocal, tz } = CalculationUtils.getLocalDateTimeAndTimezone();
        const config = StorageService.loadConfig();
        
        let defaultName = config.salesRepName || '';
        // If phone number exists, append it to default name for convenience
        if (config.phoneNumber) {
            defaultName += ` | ${config.phoneNumber}`;
        }

        const newReport: DailyReport = {
          reportId: CalculationUtils.generateId(),
          dateLocal,
          timeLocal,
          timezone: tz,
          storeName: MOCK_STORES[0],
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

  // Reset split state when modal closes/opens
  useEffect(() => {
    if (!isSplitModalOpen) {
      setCreatedSplitReports(null);
      setStaff2Name('');
    }
  }, [isSplitModalOpen]);

  // Atomic Update Function
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

  // Calculate Initial Split when modal opens or ratio changes
  useEffect(() => {
    if (isSplitModalOpen && report && !createdSplitReports) {
      const [itemsA, itemsB] = CalculationUtils.splitSalesItems(report.items, splitRatio);
      setSplitItemsA(itemsA);
      setSplitItemsB(itemsB);
    }
  }, [isSplitModalOpen, splitRatio, report, createdSplitReports]);

  // Manual Move Logic
  const moveOneUnit = (fromList: SalesItem[], toList: SalesItem[], index: number, setFrom: any, setTo: any) => {
    const itemToMove = fromList[index];
    if (!itemToMove) return;

    // 1. Remove 1 unit from source
    const newFrom = [...fromList];
    if (itemToMove.quantity > 1) {
        newFrom[index] = { ...itemToMove, quantity: itemToMove.quantity - 1 };
    } else {
        newFrom.splice(index, 1);
    }

    // 2. Add 1 unit to destination
    const newTo = [...toList];
    const existingIndex = newTo.findIndex(i => 
        i.productName === itemToMove.productName && 
        i.unitPrice === itemToMove.unitPrice && 
        i.sku === itemToMove.sku &&
        i.notes === itemToMove.notes
    );

    if (existingIndex >= 0) {
        newTo[existingIndex] = { ...newTo[existingIndex], quantity: newTo[existingIndex].quantity + 1 };
    } else {
        newTo.push({ ...itemToMove, quantity: 1 });
    }

    // Update state
    setFrom(newFrom);
    setTo(newTo);
  };

  // Helper to calculate totals for the split view
  const getTotal = (items: SalesItem[]) => items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);

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

  // Helper: Sanitize input to prevent XSS (HTML tags) and CSV Injection
  const sanitizeInput = (input: string): string => {
    if (!input) return '';
    
    // 1. Strip HTML tags
    let clean = input.replace(/<\/?[^>]+(>|$)/g, "");
    
    // 2. Prevent CSV Formula Injection
    // If string starts with =, +, -, or @, prepend a single quote to force it as text
    if (/^[=+\-@]/.test(clean)) {
      clean = "'" + clean;
    }
    
    return clean.trim();
  };

  const handleSave = async () => {
    if (!report) return false;
    
    // Sanitize text fields
    const salesRepName = sanitizeInput(report.salesRepName);
    report.salesRepName = salesRepName;
    
    report.items = report.items.map(i => ({
      ...i,
      productName: sanitizeInput(i.productName),
      sku: sanitizeInput(i.sku),
      notes: sanitizeInput(i.notes)
    }));

    if (!salesRepName) {
      alert("Please enter a Sales Rep Name");
      return false;
    }

    if (!validate()) {
      return false;
    }

    setSaving(true);
    try {
      await StorageService.saveReport(report);
      // NOTE: We only save name to config if user manually edits it, but here we just rely on SettingsModal for main config updates.
      // However, for better UX, if user updates name here, we could update config. 
      // StorageService.saveConfig({ salesRepName: report.salesRepName.split(' | ')[0] }); // Risky to parse.
      
      setIsDirty(false);
      setErrors({});
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (e: any) {
      // Improved Error Handling: Show specific message from service
      alert(e.message || "Failed to save report. Please check your connection.");
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

  const handleSplit = () => {
    if (!report) return;
    if (!staff2Name.trim()) {
      alert("Please enter a name for the second staff member.");
      return;
    }

    setSaving(true);
    try {
      // 1. Prepare Report A (Current User/Staff 1)
      const reportA: DailyReport = {
        ...report,
        reportId: CalculationUtils.generateId(), // New ID
        items: splitItemsA,
        totals: CalculationUtils.computeTotals(splitItemsA, 0), // Assuming no discounts split for now
        salesRepName: report.salesRepName,
        createdAt: Date.now()
      };
      reportA.shareMessage = CalculationUtils.buildShareMessage(reportA);

      // 2. Prepare Report B (Staff 2)
      const reportB: DailyReport = {
        ...report,
        reportId: CalculationUtils.generateId(), // New ID
        items: splitItemsB,
        totals: CalculationUtils.computeTotals(splitItemsB, 0),
        salesRepName: staff2Name,
        createdAt: Date.now() + 1 // Ensure distinct timestamps
      };
      reportB.shareMessage = CalculationUtils.buildShareMessage(reportB);

      // NOTE: We do NOT save these to DB or delete the original.
      // This is purely for generating shareable content.
      
      // Save config for convenience
      StorageService.saveConfig({ salesRepName: report.salesRepName });

      // 4. Update State to Show Success View
      setCreatedSplitReports({ a: reportA, b: reportB });
      
    } catch (e: any) {
      console.error(e);
      alert(`Failed to generate split reports: ${e.message}`);
    } finally {
      setSaving(false);
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const shareViaWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading || !report) return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin mb-3 text-brand-600" size={32} />Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Split Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSplitModalOpen(false)}></div>
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
            
            <div className="bg-brand-600 p-4 text-white flex justify-between items-center shrink-0">
               <h2 className="text-lg font-bold flex items-center gap-2">
                 <Users size={20} /> 
                 {createdSplitReports ? 'Reports Generated' : 'Split Report'}
               </h2>
               <button onClick={() => setIsSplitModalOpen(false)} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20">
                 <X size={18} />
               </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-gray-50/50">
              {!createdSplitReports ? (
                <>
                  {/* CONFIGURATION MODE */}
                  {/* Ratio Selector */}
                  <div className="mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block flex items-center gap-2">
                       <Split size={14} /> Auto-Split Ratio
                    </label>
                    <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-xl">
                        {[0.5, 0.6, 0.7].map((r) => (
                          <button
                            key={r}
                            onClick={() => setSplitRatio(r as any)}
                            className={`py-2 rounded-lg text-sm font-bold transition-all ${splitRatio === r ? 'bg-white text-brand-700 shadow-sm ring-1 ring-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            {r * 100} / {100 - (r * 100)}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Staff Names */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-bold text-brand-600 uppercase mb-1 block">Staff A (You)</label>
                      <input 
                          type="text" 
                          value={report.salesRepName} 
                          onChange={(e) => updateReport({ salesRepName: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                          placeholder="Name 1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Staff B</label>
                      <input 
                          type="text" 
                          value={staff2Name} 
                          onChange={(e) => setStaff2Name(e.target.value)}
                          className="w-full bg-white border border-brand-300 rounded-xl px-3 py-2 text-sm font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                          placeholder="Enter Name 2"
                          autoFocus
                      />
                    </div>
                  </div>

                  {/* Detailed Item List */}
                  <div className="flex flex-col sm:flex-row gap-3 h-full min-h-[300px]">
                      {/* Left Column (A) */}
                      <div className="flex-1 bg-brand-50/50 border border-brand-100 rounded-xl overflow-hidden flex flex-col">
                         <div className="p-3 bg-brand-50 border-b border-brand-100 flex justify-between items-center">
                            <span className="font-bold text-brand-900 text-xs">Staff A</span>
                            <span className="font-extrabold text-brand-700 text-sm">{CalculationUtils.formatCurrency(getTotal(splitItemsA))}</span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[250px] sm:max-h-[350px]">
                            {splitItemsA.length === 0 && <div className="text-center p-4 text-xs text-brand-300 font-medium italic">No items</div>}
                            {splitItemsA.map((item, i) => (
                                <div key={i} 
                                   onClick={() => moveOneUnit(splitItemsA, splitItemsB, i, setSplitItemsA, setSplitItemsB)}
                                   className="bg-white p-2 rounded-lg border border-brand-100 shadow-sm cursor-pointer hover:bg-brand-50 active:scale-95 transition-all flex justify-between items-center group"
                                >
                                   <div className="flex items-center gap-2 overflow-hidden">
                                     <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{item.quantity}</span>
                                     <span className="text-xs font-medium text-gray-700 truncate">{item.productName}</span>
                                   </div>
                                   <ArrowRight size={14} className="text-brand-300 group-hover:text-brand-500" />
                                </div>
                            ))}
                         </div>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center justify-center text-gray-300">
                        <ArrowRightLeft className="rotate-90 sm:rotate-0" size={20} />
                      </div>

                      {/* Right Column (B) */}
                      <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                         <div className="p-3 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                            <span className="font-bold text-gray-600 text-xs">Staff B</span>
                            <span className="font-extrabold text-gray-700 text-sm">{CalculationUtils.formatCurrency(getTotal(splitItemsB))}</span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[250px] sm:max-h-[350px]">
                            {splitItemsB.length === 0 && <div className="text-center p-4 text-xs text-gray-300 font-medium italic">No items</div>}
                            {splitItemsB.map((item, i) => (
                                <div key={i} 
                                   onClick={() => moveOneUnit(splitItemsB, splitItemsA, i, setSplitItemsB, setSplitItemsA)}
                                   className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:bg-gray-50 active:scale-95 transition-all flex justify-between items-center group"
                                >
                                   <ArrowLeftIcon size={14} className="text-gray-300 group-hover:text-gray-500 order-first mr-2" />
                                   <div className="flex items-center gap-2 overflow-hidden flex-1">
                                     <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center">{item.quantity}</span>
                                     <span className="text-xs font-medium text-gray-700 truncate">{item.productName}</span>
                                   </div>
                                </div>
                            ))}
                         </div>
                      </div>
                  </div>

                  <div className="mt-3 text-center">
                     <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                       Tip: Tap an item to move 1 unit to the other list
                     </span>
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                      <CheckCircle size={24} />
                    </div>
                    <p className="text-sm text-gray-600">Reports generated. You can now share them.</p>
                  </div>

                  {/* Result Card A */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                     <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md uppercase tracking-wide">Staff A</span>
                          <h4 className="font-bold text-gray-900 mt-1">{createdSplitReports.a.salesRepName}</h4>
                        </div>
                        <span className="font-extrabold text-lg text-brand-700">{CalculationUtils.formatCurrency(createdSplitReports.a.totals.net)}</span>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => copyToClipboard(createdSplitReports.a.shareMessage)}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors border border-gray-100"
                        >
                          <Copy size={14} /> Copy Text
                        </button>
                        <button 
                          onClick={() => shareViaWhatsApp(createdSplitReports.a.shareMessage)}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                          <MessageCircle size={14} fill="white" /> WhatsApp
                        </button>
                     </div>
                  </div>

                  {/* Result Card B */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                     <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md uppercase tracking-wide">Staff B</span>
                          <h4 className="font-bold text-gray-900 mt-1">{createdSplitReports.b.salesRepName}</h4>
                        </div>
                        <span className="font-extrabold text-lg text-gray-700">{CalculationUtils.formatCurrency(createdSplitReports.b.totals.net)}</span>
                     </div>
                     <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => copyToClipboard(createdSplitReports.b.shareMessage)}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-colors border border-gray-100"
                        >
                          <Copy size={14} /> Copy Text
                        </button>
                        <button 
                          onClick={() => shareViaWhatsApp(createdSplitReports.b.shareMessage)}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                        >
                          <MessageCircle size={14} fill="white" /> WhatsApp
                        </button>
                     </div>
                  </div>

                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
               {!createdSplitReports ? (
                 <>
                   <button 
                     onClick={() => setIsSplitModalOpen(false)}
                     className="flex-1 py-3 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleSplit}
                     disabled={saving || !staff2Name}
                     className="flex-[2] py-3 font-bold text-white bg-brand-600 rounded-xl shadow-lg shadow-brand-500/20 hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                   >
                     {saving ? <Loader2 className="animate-spin" size={18} /> : <Split size={18} />}
                     Generate Split
                   </button>
                 </>
               ) : (
                 <button 
                   onClick={() => {
                     setIsSplitModalOpen(false);
                     // Stay on page
                   }}
                   className="w-full py-3 font-bold text-white bg-gray-900 rounded-xl shadow-lg hover:bg-black"
                 >
                   Done
                 </button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header with Backdrop Blur */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-200 z-50 px-3 py-2 flex items-center justify-between shadow-sm transition-all">
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => navigate('/')} className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </button>
          
          <div className="h-6 w-px bg-gray-200 mx-1"></div>

          <div className="flex items-center gap-0.5">
            <button 
              onClick={undo} 
              disabled={!canUndo} 
              className="p-2 text-gray-400 disabled:opacity-30 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-all active:scale-95"
              title="Undo"
            >
              <Undo2 size={18} />
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo} 
              className="p-2 text-gray-400 disabled:opacity-30 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-all active:scale-95"
              title="Redo"
            >
              <Redo2 size={18} />
            </button>
          </div>

          {/* Status Indicator - Mini */}
          <div className="ml-1 flex flex-col justify-center">
             {saveSuccess ? (
                <span className="text-[10px] text-green-600 font-bold uppercase tracking-wide flex items-center gap-1 animate-in fade-in"><CheckCircle size={10}/> Saved</span>
              ) : (
                <span className={`text-[10px] font-bold tracking-wide transition-colors ${isDirty ? 'text-amber-500' : 'text-gray-300'}`}>{isDirty ? 'Unsaved' : 'Saved'}</span>
              )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {report.items.length > 0 && (
            <button 
              onClick={() => setIsSplitModalOpen(true)}
              className="p-2 text-brand-600 hover:bg-brand-50 rounded-full transition-colors active:scale-95 border border-transparent hover:border-brand-100"
              title="Split Report"
            >
              <Users size={18} />
            </button>
          )}

          <button 
            onClick={handleShare} 
            className="text-brand-600 hover:bg-brand-50 p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5" 
            title="Share"
          >
            <Share2 size={18} /> <span className="hidden sm:inline">Share</span>
          </button>
          
          <button 
            onClick={handleSaveAndExit} 
            disabled={saving}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl shadow-lg shadow-gray-900/20 hover:bg-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-bold"
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
                value={report.timezone || ''}
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
                value={report.storeName || ''}
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
                  value={report.salesRepName || ''}
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

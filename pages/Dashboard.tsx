
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, FileText, TrendingUp, Calendar, Filter, RefreshCw, History, LayoutDashboard, Loader2, Trash2, CheckSquare, X, Check, User, UserCircle, Coffee, Settings } from 'lucide-react';
import { DailyReport } from '../types';
import * as StorageService from '../services/storageService';
import * as AuthService from '../services/authService';
import { formatCurrency } from '../utils/calculations';
import AuthModal from '../components/AuthModal';
import SettingsModal from '../components/SettingsModal';

type ViewMode = 'home' | 'history';

// Module-level variables to handle touch interactions safely without Hooks
let longPressTimer: any = null;
let isLongPressEvent = false;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const initData = async () => {
    setLoading(true);
    // 1. Check Auth
    const user = await AuthService.getCurrentUser();
    setCurrentUser(user);
    
    // 2. Load Reports
    const data = await StorageService.loadReports();
    setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    initData();
    
    // Reminder Check Logic
    const checkReminder = () => {
      const config = StorageService.loadConfig();
      if (!config.enableReminders || !config.reminderTime) return;
      
      const now = new Date();
      const [hours, minutes] = config.reminderTime.split(':').map(Number);
      
      if (now.getHours() === hours && now.getMinutes() === minutes) {
         // Check if already notified today
         const lastDate = localStorage.getItem('dsr_last_reminder_date');
         const today = new Date().toDateString();
         
         if (lastDate !== today) {
           if ('Notification' in window && Notification.permission === 'granted') {
             new Notification("Daily Sales Reminder", { 
               body: "Time to post your daily sales report!",
               icon: '/vite.svg' // Fallback icon
             });
             localStorage.setItem('dsr_last_reminder_date', today);
           }
         }
      }
    };

    // Check every minute
    const interval = setInterval(checkReminder, 60000);
    // Initial check
    checkReminder();

    return () => clearInterval(interval);
  }, []);

  const handleAuthSuccess = async () => {
    await initData();
  };
  
  const handleConfigChange = () => {
    // Reload logic if needed, but config is mostly for ReportEditor.
    // Dashboard handles the loop internally via loadConfig() call inside interval.
  };

  // --- Selection Logic ---

  const enterSelectionMode = (initialId?: string) => {
    setIsSelectionMode(true);
    if (initialId) {
      setSelectedIds(new Set([initialId]));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleReportSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const deleteSelectedReports = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    if (selectedIds.size === 0) return;

    setLoading(true);
    try {
      await StorageService.deleteReports(Array.from(selectedIds));
      const data = await StorageService.loadReports();
      setReports(data);
      exitSelectionMode();
    } catch (e) {
      alert("Failed to delete selected reports.");
    } finally {
      setLoading(false);
    }
  };

  // --- Long Press Handlers ---
  const handleTouchStart = (id: string) => {
    if (isSelectionMode) return;
    isLongPressEvent = false;
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isLongPressEvent = true;
      enterSelectionMode(id);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleCardClick = (id: string) => {
    if (isLongPressEvent) {
      isLongPressEvent = false;
      return;
    }
    if (isSelectionMode) {
      toggleReportSelection(id);
    } else {
      navigate(`/report/${id}`);
    }
  };

  // --- Filtering ---
  const filteredReports = reports.filter(r => {
    const matchesSearch = !searchTerm || r.storeName.toLowerCase().includes(searchTerm.toLowerCase());
    const reportDate = r.dateLocal;
    const matchesStart = !startDate || reportDate >= startDate;
    const matchesEnd = !endDate || reportDate <= endDate;
    return matchesSearch && matchesStart && matchesEnd;
  }).sort((a, b) => b.dateLocal.localeCompare(a.dateLocal) || b.createdAt - a.createdAt);

  const mostRecentReport = [...reports].sort((a, b) => b.createdAt - a.createdAt)[0];
  
  // Custom Chart Logic
  const sortedForChart = [...reports].sort((a, b) => a.dateLocal.localeCompare(b.dateLocal));
  const last7Days = sortedForChart.slice(-7);
  const maxVal = Math.max(...last7Days.map(r => r.totals.net), 1);

  const resetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setShowFilters(false);
  };

  const hasFilters = searchTerm || startDate || endDate;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 font-sans">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        user={currentUser}
        onAuthSuccess={handleAuthSuccess}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
        user={currentUser}
      />

      {/* Header Area */}
      <header className={`bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-xl transition-all duration-300 relative overflow-hidden ${viewMode === 'history' ? 'pb-8' : ''}`}>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl opacity-20"></div>
           <div className="absolute bottom-0 left-0 w-60 h-60 bg-brand-300 rounded-full blur-3xl opacity-20"></div>
           <div className="absolute top-1/2 left-1/2 w-full h-32 bg-brand-400 blur-3xl opacity-10 -translate-x-1/2 -translate-y-1/2 rotate-12"></div>
        </div>

        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-extrabold mb-1 tracking-tight">
                  {viewMode === 'home' ? 'Daily Sales' : 'History'}
                </h1>
                <p className="text-brand-100 text-sm font-medium opacity-90">
                  {viewMode === 'home' ? 'Overview & Insights' : 'Archive & Search'}
                </p>
            </div>
            
            <div className="flex gap-2">
              {/* Settings Button */}
               <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-full transition-all active:scale-95 shadow-sm border bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20"
                title="Settings"
              >
                 <Settings size={22} />
              </button>

              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className={`p-2 rounded-full transition-all active:scale-95 shadow-sm border ${currentUser ? 'bg-white text-brand-700 border-white' : 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20'}`}
                title={currentUser ? "Account" : "Sign In"}
              >
                 {currentUser ? <UserCircle size={24} /> : <User size={22} />}
              </button>

              {viewMode === 'history' && (
                <button 
                  type="button"
                  onClick={() => isSelectionMode ? exitSelectionMode() : enterSelectionMode()} 
                  className={`text-xs px-4 py-2 rounded-full flex items-center gap-1.5 transition-all font-bold shadow-sm active:scale-95 ${isSelectionMode ? 'bg-white text-brand-700 shadow-md' : 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30'}`}
                >
                  <CheckSquare size={14} strokeWidth={2.5} /> {isSelectionMode ? 'Done' : 'Select'}
                </button>
              )}
            </div>
        </div>
        
        {viewMode === 'history' && !isSelectionMode && (
          <div className="mt-8 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative flex-1 group">
              <input 
                type="text" 
                placeholder="Search store name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder-brand-200 focus:outline-none focus:bg-white/20 focus:border-white/40 transition-all text-sm shadow-inner group-hover:bg-white/15"
              />
              <Search className="absolute left-4 top-3.5 text-brand-200 group-hover:text-white transition-colors" size={18} />
            </div>
            <button 
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3.5 rounded-2xl border transition-all active:scale-95 ${showFilters ? 'bg-white text-brand-600 border-white shadow-lg' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
            >
              <Filter size={20} />
            </button>
            {hasFilters && (
                <button type="button" onClick={resetFilters} className="p-3.5 bg-brand-800 hover:bg-brand-900 rounded-2xl flex items-center justify-center transition-colors shadow-sm active:scale-95">
                    <RefreshCw size={20} className="text-white"/>
                </button>
            )}
          </div>
        )}

        {viewMode === 'history' && showFilters && !isSelectionMode && (
            <div className="mt-4 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-brand-200 ml-2 tracking-wider">From Date</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:bg-white/20 transition-colors" 
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-brand-200 ml-2 tracking-wider">To Date</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none focus:bg-white/20 transition-colors" 
                    />
                </div>
            </div>
        )}
      </header>

      <div className="px-5 -mt-6 relative z-20">
        {loading ? (
          <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center animate-in fade-in duration-500">
             <Loader2 size={36} className="text-brand-500 animate-spin mb-3"/>
             <span className="text-gray-400 text-sm font-medium">Syncing data...</span>
          </div>
        ) : (
          <>
            {/* Custom Chart Card */}
            {viewMode === 'home' && last7Days.length > 0 && (
              <div className="bg-white p-5 rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                     <div className="p-1.5 bg-brand-50 rounded-lg"><TrendingUp size={16} className="text-brand-600" /></div>
                     Sales Trend
                   </h3>
                   <span className="text-[10px] text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full border border-brand-100">Last 7 Days</span>
                </div>
                <div className="h-32 w-full flex items-end justify-between gap-2 sm:gap-4 px-1">
                   {last7Days.map((r, i) => {
                      const heightPct = Math.max(Math.round((r.totals.net / maxVal) * 100), 10);
                      const isLast = i === last7Days.length - 1;
                      return (
                        <div key={r.reportId} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group cursor-default">
                           {/* Bar */}
                           <div 
                              className={`w-full max-w-[24px] sm:max-w-[32px] rounded-t-lg transition-all duration-700 ease-out relative ${
                                isLast 
                                  ? 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_4px_12px_rgba(2,132,199,0.3)]' 
                                  : 'bg-gradient-to-t from-brand-100 to-brand-50 group-hover:from-brand-200 group-hover:to-brand-100'
                              }`}
                              style={{ height: `${heightPct}%` }}
                           >
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-10 pointer-events-none shadow-xl">
                                {formatCurrency(r.totals.net)}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                              </div>
                           </div>
                           {/* Label */}
                           <span className={`text-[10px] font-bold ${isLast ? 'text-brand-600' : 'text-gray-400'}`}>
                             {r.dateLocal.slice(5)}
                           </span>
                        </div>
                      );
                   })}
                </div>
              </div>
            )}

            {/* HOME VIEW: Latest Report Card */}
            {viewMode === 'home' && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                 {mostRecentReport ? (
                   <div 
                      onClick={() => navigate(`/report/${mostRecentReport.reportId}`)}
                      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl shadow-brand-900/5 active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-10 -mt-10 blur-2xl transition-colors bg-brand-50/50 group-hover:bg-brand-100/50"></div>
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                           <span className="bg-gray-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                              <Calendar size={12}/> {mostRecentReport.dateLocal}
                           </span>
                           <span className="text-gray-400 text-xs font-medium bg-gray-50 px-2 py-1 rounded-md">{mostRecentReport.timeLocal}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">{mostRecentReport.storeName}</h3>
                        
                        <p className="text-xs text-gray-500 mb-4">{mostRecentReport.items.length} items recorded</p>
                        
                        <div className="flex items-end justify-between border-t border-gray-50 pt-4">
                              <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-800">
                                  {formatCurrency(mostRecentReport.totals.net)}
                              </div>
                           
                           <div className="h-8 w-8 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm">
                             <ChevronRight size={18} />
                           </div>
                        </div>
                      </div>
                   </div>
                 ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                       <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <FileText className="text-gray-300" size={24} />
                       </div>
                       <p className="text-gray-500 font-medium">{currentUser ? "No reports in your account." : "No reports on this device."}</p>
                       <p className="text-gray-400 text-sm mt-1">Tap + to start your first report.</p>
                    </div>
                 )}
              </div>
            )}

            {/* HISTORY VIEW: Full List */}
            {viewMode === 'history' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-500 mt-2 pb-4">
                {isSelectionMode && (
                  <div className="text-center text-xs text-brand-700 font-bold bg-brand-50 p-3 rounded-xl mb-4 border border-brand-100 flex justify-center items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <CheckSquare size={14} className="text-brand-600"/> 
                    {selectedIds.size === 0 ? "Select items to delete" : `${selectedIds.size} selected`}
                  </div>
                )}
                {filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm mt-4">
                    <div className="bg-gray-50 p-5 rounded-full mb-4">
                       <FileText size={32} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                        {hasFilters ? 'No reports match your filters.' : 'No reports found.'}
                    </p>
                  </div>
                ) : (
                  filteredReports.map((report) => {
                    const isSelected = selectedIds.has(report.reportId);
                    return (
                      <div 
                        key={report.reportId}
                        onTouchStart={() => handleTouchStart(report.reportId)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                        onClick={() => handleCardClick(report.reportId)}
                        className={`bg-white p-4 rounded-2xl border shadow-sm transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden select-none ${
                          isSelectionMode 
                             ? isSelected 
                                ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/30' 
                                : 'border-gray-100 opacity-100'
                             : 'border-gray-100 hover:border-brand-200 hover:shadow-md active:scale-[0.98]'
                        }`}
                      >
                        {isSelectionMode && (
                          <div className={`mr-4 w-6 h-6 min-w-[1.5rem] rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-brand-500 border-brand-500 scale-110' : 'bg-white border-gray-300'}`}>
                            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded text-gray-600 shadow-sm">
                                <Calendar size={10} className="text-gray-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wide">{report.dateLocal}</span>
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium">{report.timeLocal}</span>
                          </div>
                          <p className={`text-sm font-bold truncate pr-2 ${isSelected ? 'text-brand-900' : 'text-gray-900'}`}>{report.storeName}</p>
                        </div>
                        <div className="text-right">
                              <span className={`block text-base font-bold ${isSelected ? 'text-brand-700' : 'text-brand-600'}`}>{formatCurrency(report.totals.net)}</span>
                          {!isSelectionMode && (
                            <div className="flex items-center justify-end text-gray-400 text-[10px] mt-1 font-medium uppercase tracking-wide group-hover:text-brand-400 transition-colors">
                              {report.items.length} items <ChevronRight size={10} className="ml-1" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[calc(100%-3rem)] max-w-md z-50">
        
        {isSelectionMode ? (
           <div className="flex gap-3 animate-in slide-in-from-bottom-6 duration-300">
              <button 
                type="button"
                onClick={exitSelectionMode}
                className="flex-1 h-14 bg-white/90 backdrop-blur-md border border-gray-200 text-gray-700 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-white active:scale-95 transition-all"
              >
                <X size={20} /> Cancel
              </button>
              <button 
                type="button"
                onClick={deleteSelectedReports}
                disabled={selectedIds.size === 0}
                className="flex-[2] h-14 bg-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                <Trash2 size={20} fill="currentColor" className="text-red-600/20" /> 
                <span>Delete ({selectedIds.size})</span>
              </button>
           </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl border border-white/40 p-2 rounded-[2rem] shadow-2xl shadow-gray-200/50 flex items-center justify-between pl-3 pr-2 gap-4 ring-1 ring-gray-200/50">
            <div className="flex bg-gray-100/80 p-1 rounded-full relative">
               <div 
                 className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-all duration-300 ease-out ${viewMode === 'home' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
               ></div>
               
               <button 
                  type="button"
                  onClick={() => setViewMode('home')}
                  className={`relative z-10 w-12 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${viewMode === 'home' ? 'text-brand-600' : 'text-gray-400'}`}
               >
                  <LayoutDashboard size={20} />
               </button>
               <button 
                  type="button"
                  onClick={() => setViewMode('history')}
                  className={`relative z-10 w-12 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${viewMode === 'history' ? 'text-brand-600' : 'text-gray-400'}`}
               >
                  <History size={20} />
               </button>
            </div>

            <button 
              type="button"
              onClick={() => navigate('/new')}
              className="h-14 px-8 bg-gray-900 text-white rounded-[1.5rem] shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-all group"
            >
              <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold text-sm">New Report</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
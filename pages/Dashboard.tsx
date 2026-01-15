
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, FileText, TrendingUp, History, LayoutDashboard, Loader2, Settings, Key, Sparkles, MapPinned, X, UserCircle, Calendar, Trash2 } from 'lucide-react';
import { DailyReport } from '../types';
import * as StorageService from '../services/storageService';
import * as AuthService from '../services/authService';
import * as GeminiService from '../services/geminiService';
import { formatCurrency } from '../utils/calculations';
import { MOCK_STORES, LOCAL_STORAGE_KEYS } from '../constants';
import AuthModal from '../components/AuthModal';
import SettingsModal from '../components/SettingsModal';

type ViewMode = 'home' | 'history';
type FilterRange = 'all' | 'day' | 'week' | 'month';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [filterRange, setFilterRange] = useState<FilterRange>('all');
  const [hasKey, setHasKey] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStore, setActiveStore] = useState<string>(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_STORE) || '');

  const initData = async (checkKey = true) => {
    setLoading(true);
    if (checkKey) {
      const keyOk = await GeminiService.ensureApiKey();
      setHasKey(keyOk);
    }
    const [user, data] = await Promise.all([
      AuthService.getCurrentUser(),
      StorageService.loadReports()
    ]);
    setCurrentUser(user);
    // Explicitly filter for non-deleted reports just in case
    setReports(data.filter(r => !r.isDeleted));
    setLoading(false);
  };

  useEffect(() => {
    initData();
    const interval = setInterval(() => {
      setHasKey(GeminiService.hasValidKey());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyActivation = async () => {
    const success = await GeminiService.requestKeySelection();
    if (success) {
      setHasKey(true);
      setTimeout(() => initData(true), 1500);
    }
  };

  const handleStoreChange = (store: string) => {
    setActiveStore(store);
    if (store) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_STORE, store);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_STORE);
    }
  };

  const handleDeleteDay = async (date: string) => {
    const reportsToDelete = reports.filter(r => r.dateLocal === date);
    const ids = reportsToDelete.map(r => r.reportId);
    
    if (window.confirm(`Hide all ${ids.length} reports for ${date}? You can recover them from archives later.`)) {
      await StorageService.deleteReports(ids);
      // Remove from active view state
      setReports(prev => prev.filter(r => !ids.includes(r.reportId)));
    }
  };

  const filteredReports = useMemo(() => {
    let list = [...reports];
    
    if (searchTerm) {
      list = list.filter(r => 
        r.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.salesRepName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const now = new Date();
    if (filterRange === 'day') {
      const todayStr = now.toISOString().split('T')[0];
      list = list.filter(r => r.dateLocal === todayStr);
    } else if (filterRange === 'week') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      list = list.filter(r => r.createdAt >= lastWeek.getTime());
    } else if (filterRange === 'month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      list = list.filter(r => r.createdAt >= lastMonth.getTime());
    }

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [reports, searchTerm, filterRange]);

  const groupedReports = useMemo(() => {
    const groups: Record<string, DailyReport[]> = {};
    filteredReports.forEach(report => {
      if (!groups[report.dateLocal]) groups[report.dateLocal] = [];
      groups[report.dateLocal].push(report);
    });
    return groups;
  }, [filteredReports]);

  const mostRecentReport = reports[0];
  const last7Days = reports.slice(0, 7).reverse();
  const maxVal = Math.max(...last7Days.map(r => r.totals.net), 1);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 font-sans overflow-x-hidden pt-safe">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} user={currentUser} onAuthSuccess={() => initData(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onConfigChange={() => {}} user={currentUser} />

      {!hasKey && (
        <div 
          onClick={handleKeyActivation}
          className="bg-brand-600 text-white px-4 py-3 sticky top-0 z-[100] shadow-elevated animate-in slide-in-from-top duration-300 cursor-pointer active:brightness-95 transition-all"
        >
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <Key size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-80">System Engine Offline</p>
                <p className="text-xs font-bold">Tap to activate AI capabilities</p>
              </div>
            </div>
            <div className="bg-white text-brand-600 px-4 py-1.5 rounded-full text-[10px] font-black shadow-sm uppercase tracking-wider">
              Activate
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-br from-slate-900 via-brand-900 to-brand-800 text-white px-6 pt-10 pb-10 rounded-b-[3rem] shadow-elevated relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-400/5 rounded-full blur-2xl -ml-10 -mb-10"></div>

        <div className="relative z-10 flex justify-between items-center mb-8 max-w-lg mx-auto">
          <div>
            <h1 className="text-3xl font-heading font-extrabold mb-1 tracking-tight">Sales Hub</h1>
            <p className="text-brand-200/70 text-xs font-bold uppercase tracking-widest">Performance Tracking</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all hover:bg-white/20">
              <Settings size={20} strokeWidth={2.5} />
            </button>
            <button onClick={() => setIsAuthModalOpen(true)} className={`p-2.5 rounded-2xl active:scale-90 transition-all border ${currentUser ? 'bg-white text-brand-700 border-white' : 'bg-white/10 backdrop-blur-md border-white/10 text-white hover:bg-white/20'}`}>
              <UserCircle size={22} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-4 flex items-center gap-4 shadow-inner max-w-lg mx-auto group hover:border-white/20 transition-colors">
           <div className={`p-3 rounded-2xl transition-all duration-500 ${activeStore ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-white/5 text-white/40'}`}>
              <MapPinned size={20} strokeWidth={2.5} />
           </div>
           <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-200/60 mb-1">Current Workspace</p>
              <select 
                value={activeStore}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-white outline-none appearance-none cursor-pointer pr-8"
              >
                <option value="" className="text-gray-900">Select Branch...</option>
                {MOCK_STORES.map(s => (
                  <option key={s} value={s} className="text-gray-900 font-medium">{s}</option>
                ))}
              </select>
           </div>
           {activeStore ? (
             <button onClick={() => handleStoreChange('')} className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-xl">
               <X size={16} strokeWidth={3} />
             </button>
           ) : (
             <ChevronRight size={20} className="text-white/20 group-hover:translate-x-1 transition-transform" />
           )}
        </div>

        {viewMode === 'history' && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500 max-w-lg mx-auto">
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="Search history..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full bg-white/10 border border-white/10 backdrop-blur-md rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder-brand-200/50 focus:outline-none focus:bg-white/15 focus:ring-4 focus:ring-brand-500/10 transition-all" 
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-200/50" size={18} strokeWidth={2.5} />
            </div>
            
            <div className="flex p-1 bg-white/10 backdrop-blur-md rounded-2xl gap-1">
              {(['all', 'day', 'week', 'month'] as FilterRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setFilterRange(range)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    filterRange === range 
                      ? 'bg-white text-slate-900 shadow-lg scale-[1.02]' 
                      : 'text-brand-100/60 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="px-6 pt-8 relative z-20 max-w-lg mx-auto">
        {loading ? (
          <div className="bg-white p-12 rounded-[2.5rem] shadow-soft border border-slate-100 flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <Loader2 size={32} className="text-brand-500 animate-spin" />
              <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-xl animate-pulse"></div>
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Synchronizing</p>
          </div>
        ) : (
          <>
            {viewMode === 'home' && (
              <>
                {last7Days.length > 0 && (
                  <div className="bg-white p-6 rounded-[2.5rem] shadow-soft border border-slate-100 mb-8 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <TrendingUp size={14} className="text-brand-500" strokeWidth={3} /> Insights
                      </h3>
                      <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">Last 7 Reports</span>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-3 px-1">
                      {last7Days.map((r, i) => {
                        const height = Math.max((r.totals.net / maxVal) * 100, 15);
                        const isLatest = i === last7Days.length - 1;
                        return (
                          <div key={r.reportId} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                            <div 
                              className={`w-full max-w-[12px] rounded-full transition-all duration-1000 group-hover:opacity-80 ${isLatest ? 'bg-brand-500 shadow-lg shadow-brand-500/40' : 'bg-slate-100'}`} 
                              style={{ height: `${height}%` }}
                            ></div>
                            <span className={`text-[8px] font-bold ${isLatest ? 'text-brand-600' : 'text-slate-400'}`}>{r.dateLocal.split('-')[2]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="animate-in slide-in-from-bottom-6 duration-500">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Most Recent</h3>
                  </div>
                  {mostRecentReport ? (
                    <div 
                      onClick={() => navigate(`/report/${mostRecentReport.reportId}`)} 
                      className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-elevated active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group hover:border-brand-100"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform">
                        <FileText size={120} />
                      </div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-slate-900/10">{mostRecentReport.dateLocal}</span>
                          <div className="p-3 bg-brand-50 rounded-2xl text-brand-600 group-hover:bg-brand-600 group-hover:text-white group-hover:rotate-12 transition-all shadow-sm">
                            <ChevronRight size={18} strokeWidth={3} />
                          </div>
                        </div>
                        <h3 className="text-2xl font-heading font-extrabold text-slate-900 mb-1 group-hover:text-brand-900 transition-colors">{mostRecentReport.storeName}</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></span>
                          {mostRecentReport.items.length} Units Logged
                        </p>
                        <div className="text-4xl font-black tracking-tight text-slate-900 font-heading">
                          {formatCurrency(mostRecentReport.totals.net)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><FileText className="text-slate-300" size={32} /></div>
                      <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No active sales yet</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {viewMode === 'history' && (
              <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500 pb-10">
                {Object.keys(groupedReports).length === 0 ? (
                  <div className="text-center py-24 bg-white rounded-[2.5rem] border border-slate-100">
                     <Calendar className="text-slate-200 mx-auto mb-6 animate-pulse" size={48} />
                     <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">History Empty</p>
                  </div>
                ) : (
                  Object.keys(groupedReports).map((date) => {
                    const dayReports = groupedReports[date];
                    return (
                      <div key={date} className="space-y-4">
                        <div className="flex items-center justify-between px-3">
                           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                             <div className="w-1.5 h-1.5 bg-brand-500 rounded-full"></div> {date}
                           </h3>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteDay(date); }}
                             className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                             title="Hide records"
                           >
                             <Trash2 size={16} strokeWidth={2.5} />
                           </button>
                        </div>
                        
                        <div className="space-y-3">
                          {dayReports.map(report => (
                            <div 
                              key={report.reportId} 
                              onClick={() => navigate(`/report/${report.reportId}`)} 
                              className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-soft flex justify-between items-center active:scale-[0.98] transition-all hover:border-brand-200 group"
                            >
                              <div className="flex-1 min-w-0 pr-4">
                                <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-wider">{report.timeLocal}</p>
                                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-brand-600 transition-colors">{report.storeName}</p>
                                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{report.salesRepName || '—'}</p>
                              </div>
                              <div className="text-right">
                                <span className="block text-base font-black text-slate-900 group-hover:text-brand-600 transition-colors">{formatCurrency(report.totals.net)}</span>
                                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{report.items.length} SKU</span>
                              </div>
                            </div>
                          ))}
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

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md z-[60]">
        <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 p-2.5 rounded-[2.5rem] shadow-elevated flex items-center justify-between pl-6 pr-3">
          <div className="flex bg-white/5 p-1 rounded-2xl relative">
            <button 
              onClick={() => setViewMode('home')} 
              className={`relative z-10 w-12 h-11 flex items-center justify-center transition-all ${viewMode === 'home' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutDashboard size={20} strokeWidth={2.5} />
              {viewMode === 'home' && <div className="absolute inset-0 bg-white rounded-xl -z-10 shadow-lg animate-in zoom-in-95 duration-200"></div>}
            </button>
            <button 
              onClick={() => setViewMode('history')} 
              className={`relative z-10 w-12 h-11 flex items-center justify-center transition-all ${viewMode === 'history' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <History size={20} strokeWidth={2.5} />
              {viewMode === 'history' && <div className="absolute inset-0 bg-white rounded-xl -z-10 shadow-lg animate-in zoom-in-95 duration-200"></div>}
            </button>
          </div>
          <button 
            onClick={() => {
              if (!activeStore) {
                alert("Please select a workspace in the header first.");
                return;
              }
              navigate('/new');
            }} 
            className={`h-14 px-8 text-white rounded-[1.75rem] shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all group overflow-hidden relative ${activeStore ? 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/25' : 'bg-slate-700 opacity-60 cursor-not-allowed'}`}
          >
            <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
            <span className="font-black text-xs uppercase tracking-widest">New Report</span>
            {hasKey && (
              <div className="absolute top-0 right-0 p-1">
                <Sparkles size={10} className="text-brand-300 animate-pulse" />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, FileText, TrendingUp, Calendar, Filter, History, LayoutDashboard, Loader2, Trash2, X, Check, User, UserCircle, Settings, Key, AlertCircle, ExternalLink, Sparkles } from 'lucide-react';
import { DailyReport } from '../types';
import * as StorageService from '../services/storageService';
import * as AuthService from '../services/authService';
import * as GeminiService from '../services/geminiService';
import { formatCurrency } from '../utils/calculations';
import AuthModal from '../components/AuthModal';
import SettingsModal from '../components/SettingsModal';

type ViewMode = 'home' | 'history';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [hasKey, setHasKey] = useState(true);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
    setReports(data);
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

  const filteredReports = reports.filter(r => 
    !searchTerm || r.storeName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.createdAt - a.createdAt);

  const mostRecentReport = reports[0];
  const last7Days = reports.slice(0, 7).reverse();
  const maxVal = Math.max(...last7Days.map(r => r.totals.net), 1);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 font-sans overflow-x-hidden">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} user={currentUser} onAuthSuccess={() => initData(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onConfigChange={() => {}} user={currentUser} />

      {/* AI STATUS BANNER */}
      {!hasKey && (
        <div 
          onClick={handleKeyActivation}
          className="bg-amber-600 text-white px-4 py-3 sticky top-0 z-[9999] shadow-lg animate-in slide-in-from-top duration-300 cursor-pointer active:bg-amber-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                <Key size={20} className="text-amber-100" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">AI Features Locked</p>
                <p className="text-[10px] text-amber-100 font-bold opacity-90">Tap to select your Gemini API Key</p>
              </div>
            </div>
            <div className="bg-white text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black shadow-xl">
              ACTIVATE
            </div>
          </div>
          <div className="flex justify-center border-t border-amber-500/50 mt-2 pt-1.5">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[9px] font-bold text-amber-200 flex items-center gap-1 uppercase" onClick={e => e.stopPropagation()}>
              Paid Account Required <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 text-white px-6 pt-12 pb-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden z-10">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold mb-1 tracking-tight">Daily Sales</h1>
            <p className="text-brand-100 text-sm font-medium opacity-90">Store Analytics & Reports</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white active:scale-95 transition-all">
              <Settings size={20} />
            </button>
            <button onClick={() => setIsAuthModalOpen(true)} className={`p-2.5 rounded-full active:scale-95 transition-all border ${currentUser ? 'bg-white text-brand-700 border-white' : 'bg-white/10 backdrop-blur-md border-white/20 text-white'}`}>
              {currentUser ? <UserCircle size={22} /> : <User size={20} />}
            </button>
          </div>
        </div>

        {viewMode === 'history' && (
          <div className="mt-8 flex gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="relative flex-1">
              <input type="text" placeholder="Search stores..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder-brand-200 focus:outline-none focus:bg-white/20" />
              <Search className="absolute left-4 top-3.5 text-brand-200" size={18} />
            </div>
          </div>
        )}
      </header>

      <div className="px-5 pt-6 relative z-20">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center justify-center">
            <Loader2 size={32} className="text-brand-500 animate-spin mb-4" />
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Loading Reports</p>
          </div>
        ) : (
          <>
            {viewMode === 'home' && last7Days.length > 0 && (
              <div className="bg-white p-5 rounded-3xl shadow-lg border border-gray-100 mb-6 animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-brand-500" /> Sales Trend
                  </h3>
                </div>
                <div className="h-32 flex items-end justify-between gap-3 px-1">
                  {last7Days.map((r, i) => {
                    const height = Math.max((r.totals.net / maxVal) * 100, 10);
                    return (
                      <div key={r.reportId} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <div className={`w-full max-w-[12px] rounded-full transition-all duration-1000 ${i === last7Days.length - 1 ? 'bg-brand-500' : 'bg-brand-100'}`} style={{ height: `${height}%` }}></div>
                        <span className="text-[8px] font-bold text-gray-400">{r.dateLocal.split('-').slice(1).join('/')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'home' && (
              <div className="animate-in slide-in-from-bottom-6">
                {mostRecentReport ? (
                  <div onClick={() => navigate(`/report/${mostRecentReport.reportId}`)} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-brand-900/5 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-4">
                        <span className="bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">{mostRecentReport.dateLocal}</span>
                        <div className="p-2 bg-brand-50 rounded-xl text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-all"><ChevronRight size={16} /></div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{mostRecentReport.storeName}</h3>
                      <p className="text-xs text-gray-500 font-medium mb-4">{mostRecentReport.items.length} products logged</p>
                      <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-800">
                        {formatCurrency(mostRecentReport.totals.net)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="text-gray-300" size={24} /></div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No reports found</p>
                  </div>
                )}
              </div>
            )}

            {viewMode === 'history' && (
              <div className="space-y-3 animate-in slide-in-from-bottom-8 duration-500 pb-10">
                {filteredReports.map(report => (
                  <div key={report.reportId} onClick={() => navigate(`/report/${report.reportId}`)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-all">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase">{report.dateLocal}</span>
                        <span className="text-[9px] text-gray-400 font-bold uppercase">{report.timeLocal}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate max-w-[150px]">{report.storeName}</p>
                    </div>
                    <div className="text-right">
                      <span className="block text-sm font-black text-gray-900">{formatCurrency(report.totals.net)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FOOTER BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md z-[60]">
        <div className="bg-white/80 backdrop-blur-xl border border-white/40 p-2 rounded-[2.5rem] shadow-2xl flex items-center justify-between pl-4 pr-2 ring-1 ring-gray-200/50">
          <div className="flex bg-gray-100/80 p-1 rounded-full relative">
            <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-sm transition-all duration-300 ${viewMode === 'home' ? 'left-1' : 'left-[calc(50%+2px)]'}`}></div>
            <button onClick={() => setViewMode('home')} className={`relative z-10 w-12 h-10 flex items-center justify-center ${viewMode === 'home' ? 'text-brand-600' : 'text-gray-400'}`}><LayoutDashboard size={20} /></button>
            <button onClick={() => setViewMode('history')} className={`relative z-10 w-12 h-10 flex items-center justify-center ${viewMode === 'history' ? 'text-brand-600' : 'text-gray-400'}`}><History size={20} /></button>
          </div>
          <button onClick={() => navigate('/new')} className="h-14 px-8 bg-gray-900 text-white rounded-3xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all group overflow-hidden relative">
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            <span className="font-bold text-sm tracking-tight">New Report</span>
            {hasKey && <Sparkles size={12} className="absolute top-2 right-2 text-brand-400 animate-pulse" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
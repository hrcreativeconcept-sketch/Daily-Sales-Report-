
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Database, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  FileSearch, 
  ArrowLeft,
  Terminal,
  RefreshCcw,
  ClipboardCheck
} from 'lucide-react';
import * as GeminiService from '../services/geminiService';
import * as StorageService from '../services/storageService';
import { supabase } from '../services/supabaseClient';

interface DiagnosticReport {
  timestamp: string;
  geminiStatus: 'OK' | 'ERROR' | 'MISSING';
  supabaseStatus: 'OK' | 'ERROR';
  syncStatus: 'OK' | 'WARNING';
  details: string[];
}

const TestPage: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const runFullDiagnostics = async () => {
    setIsTesting(true);
    setReport(null);
    addLog("Starting full system diagnostics...");
    
    const details: string[] = [];
    let geminiStatus: 'OK' | 'ERROR' | 'MISSING' = 'MISSING';
    let supabaseStatus: 'OK' | 'ERROR' = 'ERROR';
    let syncStatus: 'OK' | 'WARNING' = 'WARNING';

    // 1. Check Gemini
    const hasKey = GeminiService.hasValidKey();
    if (hasKey) {
      try {
        await GeminiService.parseFromText("Ping");
        geminiStatus = 'OK';
        details.push("Gemini 3 Flash: Active and responding.");
      } catch (e) {
        geminiStatus = 'ERROR';
        details.push("Gemini 3 Flash: Key present but API rejected request.");
      }
    } else {
      details.push("Gemini 3 Flash: No valid API key found in environment.");
    }

    // 2. Check Supabase
    try {
      const { error } = await supabase.from('daily_reports').select('count', { count: 'exact', head: true });
      if (!error) {
        supabaseStatus = 'OK';
        details.push("Supabase DB: Connection established successfully.");
      } else {
        details.push(`Supabase DB: Connected but returned error: ${error.message}`);
      }
    } catch (e) {
      details.push("Supabase DB: Network connection failed.");
    }

    // 3. Logic Check (The "Sync" Report)
    details.push("Architecture Note: Gemini Keys are environment-scoped; results sync to Supabase.");
    if (geminiStatus === 'OK' && supabaseStatus === 'OK') {
      syncStatus = 'OK';
      details.push("Integration: System is ready to route AI results to Cloud Storage.");
    }

    setReport({
      timestamp: new Date().toLocaleString(),
      geminiStatus,
      supabaseStatus,
      syncStatus,
      details
    });
    
    addLog("Diagnostics complete.");
    setIsTesting(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-600 rounded-xl text-white shadow-lg shadow-brand-200">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">System Report</h1>
        </div>
        <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-gray-200 shadow-sm px-6 text-center mb-8">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
            <Zap className="text-brand-600 animate-pulse" size={32} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Ready to Verify</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Run diagnostics to check your Gemini API Key status and Supabase cloud connectivity.
          </p>
          <button 
            onClick={runFullDiagnostics}
            disabled={isTesting}
            className="w-full max-w-xs py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isTesting ? <RefreshCcw className="animate-spin" size={20} /> : <ClipboardCheck size={20} />}
            {isTesting ? "Testing..." : "Generate Full Report"}
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6 mb-8">
          {/* Status Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-4 rounded-2xl border flex flex-col items-center text-center ${report.geminiStatus === 'OK' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <Zap size={20} className={report.geminiStatus === 'OK' ? 'text-green-600' : 'text-red-600'} />
              <span className="text-[10px] font-black uppercase mt-2 opacity-60">Gemini AI</span>
              <span className="text-xs font-bold">{report.geminiStatus}</span>
            </div>
            <div className={`p-4 rounded-2xl border flex flex-col items-center text-center ${report.supabaseStatus === 'OK' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <Database size={20} className={report.supabaseStatus === 'OK' ? 'text-green-600' : 'text-red-600'} />
              <span className="text-[10px] font-black uppercase mt-2 opacity-60">Supabase</span>
              <span className="text-xs font-bold">{report.supabaseStatus}</span>
            </div>
            <div className={`p-4 rounded-2xl border flex flex-col items-center text-center ${report.syncStatus === 'OK' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              <RefreshCcw size={20} className={report.syncStatus === 'OK' ? 'text-green-600' : 'text-amber-600'} />
              <span className="text-[10px] font-black uppercase mt-2 opacity-60">Integration</span>
              <span className="text-xs font-bold">{report.syncStatus}</span>
            </div>
          </div>

          {/* Detailed Report */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <FileSearch size={16} className="text-brand-600" /> Audit Log
              </h3>
              <span className="text-[10px] font-bold text-gray-400">{report.timestamp}</span>
            </div>
            <div className="p-6 space-y-4">
              {report.details.map((detail, i) => (
                <div key={i} className="flex gap-3">
                  {detail.includes('Active') || detail.includes('successfully') ? (
                    <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-brand-50 border-t border-brand-100">
               <button 
                 onClick={runFullDiagnostics}
                 className="w-full py-2 text-xs font-bold text-brand-700 uppercase tracking-widest hover:text-brand-900"
               >
                 Re-run Diagnostics
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal View */}
      <div className="bg-gray-900 rounded-3xl p-6 shadow-inner border border-gray-800">
        <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-green-500" />
            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live Console</span>
          </div>
          <button 
            onClick={() => setLogs([])}
            className="text-[9px] font-bold text-gray-500 hover:text-white uppercase"
          >
            Clear
          </button>
        </div>
        <div className="h-40 overflow-y-auto no-scrollbar font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-gray-600 italic">Waiting for system events...</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="mb-1 text-gray-400">
                <span className="text-brand-500 mr-2">{'>'}</span>{l}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest px-8 leading-relaxed">
          Your Gemini API Key is stored in your environment/browser session. It is never transmitted to Supabase for security reasons.
        </p>
      </div>
    </div>
  );
};

export default TestPage;

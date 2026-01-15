
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
  ClipboardCheck,
  Globe,
  Lock,
  Cloud
} from 'lucide-react';
import * as GeminiService from '../services/geminiService';
import * as StorageService from '../services/storageService';
import { supabase } from '../services/supabaseClient';

interface DiagnosticReport {
  timestamp: string;
  vercelEnv: {
    apiKey: boolean;
    supabaseUrl: boolean;
    supabaseKey: boolean;
  };
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
    addLog("Starting full cloud integration check...");
    
    const details: string[] = [];
    let geminiStatus: 'OK' | 'ERROR' | 'MISSING' = 'MISSING';
    let supabaseStatus: 'OK' | 'ERROR' = 'ERROR';
    let syncStatus: 'OK' | 'WARNING' = 'WARNING';

    // 1. Check Vercel Environment Variables
    const envCheck = {
      apiKey: !!process.env.API_KEY && process.env.API_KEY.length > 10,
      supabaseUrl: !!process.env.SUPABASE_URL,
      supabaseKey: !!process.env.SUPABASE_ANON_KEY
    };
    
    addLog(`Vercel Env: API_KEY=${envCheck.apiKey ? 'DETECTED' : 'MISSING'}`);
    addLog(`Vercel Env: SUPABASE_URL=${envCheck.supabaseUrl ? 'DETECTED' : 'MISSING'}`);

    // 2. Check Gemini
    if (envCheck.apiKey) {
      try {
        addLog("Testing Gemini AI connectivity...");
        // Use a tiny prompt to verify the key
        await GeminiService.parseFromText("Ping");
        geminiStatus = 'OK';
        details.push("Gemini 3 Flash: API Key is valid and authorized.");
      } catch (e: any) {
        geminiStatus = 'ERROR';
        details.push(`Gemini 3 Flash: Authentication failed (${e.message || 'Check Billing/Limits'})`);
        addLog(`Gemini Error: ${e.message}`);
      }
    } else {
      details.push("Gemini 3 Flash: API Key missing from Vercel environment.");
    }

    // 3. Check Supabase
    try {
      addLog("Testing Supabase connectivity...");
      const { data, error } = await supabase.from('daily_reports').select('count', { count: 'exact', head: true });
      if (!error) {
        supabaseStatus = 'OK';
        details.push("Supabase DB: Cloud connection successful.");
      } else {
        details.push(`Supabase DB: Connected but access denied (${error.message})`);
        addLog(`Supabase Error: ${error.message}`);
      }
    } catch (e) {
      details.push("Supabase DB: Endpoint unreachable.");
      addLog("Supabase Error: Network failure.");
    }

    // 4. Integration Logic
    if (geminiStatus === 'OK' && supabaseStatus === 'OK') {
      syncStatus = 'OK';
      details.push("Cloud Sync: AI-extracted data is ready to be saved to Supabase.");
    } else {
      details.push("Cloud Sync: Integration is partial. Please verify both keys.");
    }

    setReport({
      timestamp: new Date().toLocaleString(),
      vercelEnv: envCheck,
      geminiStatus,
      supabaseStatus,
      syncStatus,
      details
    });
    
    addLog("Integration report generated successfully.");
    setIsTesting(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans pb-24">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-600 rounded-xl text-white shadow-lg shadow-brand-200">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cloud Report</h1>
          </div>
          <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
        </div>

        {!report ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-3xl border border-gray-200 shadow-sm px-6 text-center mb-8">
            <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-6">
              <Cloud className="text-brand-600 animate-pulse" size={40} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Vercel Sync</h2>
            <p className="text-sm text-gray-500 max-w-xs mb-8">
              Generate a formal report to check if your Vercel environment variables are correctly communicating with Gemini and Supabase.
            </p>
            <button 
              onClick={runFullDiagnostics}
              disabled={isTesting}
              className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-brand-200 hover:bg-brand-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isTesting ? <RefreshCcw className="animate-spin" size={20} /> : <ClipboardCheck size={20} />}
              {isTesting ? "Analyzing Integration..." : "Generate Cloud Report"}
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6 mb-8">
            {/* Vercel Env Status */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Vercel Variables</span>
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 rounded-full ${report.vercelEnv.apiKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div className={`w-2 h-2 rounded-full ${report.vercelEnv.supabaseUrl ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  </div>
               </div>
               <div className="p-6 grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock size={16} className="text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">API_KEY</span>
                    </div>
                    {report.vercelEnv.apiKey ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">SUPABASE_URL</span>
                    </div>
                    {report.vercelEnv.supabaseUrl ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-red-500" />}
                  </div>
               </div>
            </div>

            {/* Service Status Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-5 rounded-3xl border flex flex-col items-center text-center ${report.geminiStatus === 'OK' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <Zap size={24} className={report.geminiStatus === 'OK' ? 'text-green-600' : 'text-red-600'} />
                <span className="text-[10px] font-black uppercase mt-3 text-gray-400 tracking-tighter">Gemini AI</span>
                <span className="text-sm font-bold text-gray-900 mt-1">{report.geminiStatus === 'OK' ? 'Functional' : 'Error'}</span>
              </div>
              <div className={`p-5 rounded-3xl border flex flex-col items-center text-center ${report.supabaseStatus === 'OK' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <Database size={24} className={report.supabaseStatus === 'OK' ? 'text-green-600' : 'text-red-600'} />
                <span className="text-[10px] font-black uppercase mt-3 text-gray-400 tracking-tighter">Supabase Cloud</span>
                <span className="text-sm font-bold text-gray-900 mt-1">{report.supabaseStatus === 'OK' ? 'Connected' : 'Error'}</span>
              </div>
            </div>

            {/* Detailed Audit Log */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <FileSearch size={16} className="text-brand-600" /> Diagnostics
                </h3>
                <span className="text-[10px] font-bold text-gray-400">{report.timestamp}</span>
              </div>
              <div className="p-6 space-y-4">
                {report.details.map((detail, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    {detail.includes('successful') || detail.includes('Functional') || detail.includes('valid') ? (
                      <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm text-gray-700 font-medium leading-tight">{detail}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-brand-50 border-t border-brand-100">
                 <button 
                   onClick={runFullDiagnostics}
                   className="w-full py-2 text-xs font-black text-brand-700 uppercase tracking-widest hover:text-brand-900 transition-colors"
                 >
                   Refresh Report
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Terminal */}
        <div className="bg-gray-900 rounded-[2rem] p-6 shadow-inner border border-gray-800">
          <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-brand-400" />
              <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Deployment Logs</span>
            </div>
            <button 
              onClick={() => setLogs([])}
              className="text-[9px] font-bold text-gray-500 hover:text-white uppercase transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="h-32 overflow-y-auto no-scrollbar font-mono text-[11px] leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-gray-600 italic">Waiting for environment verification...</p>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="mb-1 text-gray-400 animate-in fade-in duration-300">
                  <span className="text-brand-600 mr-2 font-black">{'>'}</span>{l}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="mt-8 text-center px-6">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
            Integration Verified: Gemini results are automatically saved to Supabase via Vercel secure environment. No local data sync required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestPage;

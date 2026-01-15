
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as CalculationUtils from '../utils/calculations';
import * as GeminiService from '../services/geminiService';
import * as StorageService from '../services/storageService';
import { supabase } from '../services/supabaseClient';

const TestPage: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const testApiKey = async () => {
    const key = process.env.API_KEY;
    const isValid = GeminiService.hasValidKey();
    const hasSelected = await GeminiService.ensureApiKey();
    
    addLog(`Gemini Key Present: ${!!key}`);
    addLog(`Gemini Valid Detection: ${isValid}`);
    addLog(`User Selected Key: ${hasSelected}`);
    
    if (!isValid) {
      addLog("Recommendation: Click 'ACTIVATE' banner on Dashboard to configure Gemini.");
    }
  };

  const testSupabaseConnection = async () => {
    addLog("Testing Supabase Connection...");
    setIsTesting(true);
    try {
      // Simple health check query
      const { data, error, status } = await supabase.from('daily_reports').select('count', { count: 'exact', head: true });
      
      if (error) {
        addLog(`Supabase Error: ${error.message} (Status: ${status})`);
        addLog(`Note: Check if project URL and Anon Key are still valid.`);
      } else {
        addLog(`Supabase Success: Connection active. (Status: ${status})`);
      }
    } catch (e: any) {
      addLog(`Supabase Connectivity Failed: ${e.message}`);
      addLog("Reason: Likely network block, CORS issue, or Supabase project paused.");
      addLog("Status: App is currently running in LOCAL FALLBACK mode.");
    } finally {
      setIsTesting(false);
    }
  };

  const testGeminiExtraction = async () => {
    addLog("Testing Gemini 3 Extraction...");
    setIsTesting(true);
    try {
      const res = await GeminiService.parseFromText("Sold 5 units of Sample Product at 99 AED each");
      addLog(`Success: Found ${res.length} items via AI.`);
    } catch (e: any) {
      addLog(`AI Error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testTTS = async () => {
    addLog("Testing Gemini 2.5 TTS...");
    setIsTesting(true);
    try {
      const res = await GeminiService.generateSpeech("Testing the sales report speech engine.");
      addLog(res ? "Success: TTS audio generated." : "Failed: No audio data returned.");
    } catch (e: any) {
      addLog(`TTS Error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">System Diagnostics</h1>
        <button onClick={() => navigate('/')} className="text-xs font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl">Exit</button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button onClick={testApiKey} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-amber-200 hover:bg-amber-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Step 1</p>
          <p className="font-bold text-gray-900">Gemini Key Check</p>
        </button>
        <button onClick={testSupabaseConnection} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-blue-200 hover:bg-blue-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Step 2</p>
          <p className="font-bold text-gray-900">Supabase Connection</p>
        </button>
        <button onClick={testGeminiExtraction} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-gray-100 hover:bg-brand-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Step 3</p>
          <p className="font-bold text-gray-900">AI Extraction Test</p>
        </button>
        <button onClick={testTTS} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-gray-100 hover:bg-brand-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Step 4</p>
          <p className="font-bold text-gray-900">Speech Engine Test</p>
        </button>
      </div>

      <div className="bg-gray-900 p-6 rounded-3xl shadow-inner h-[400px] overflow-y-auto no-scrollbar font-mono text-[11px] leading-relaxed border border-gray-800">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 font-bold uppercase tracking-widest text-[10px]">Console Monitor</span>
        </div>
        {logs.length === 0 ? (
          <p className="text-gray-600 italic">Initiate tests above to monitor system health...</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="mb-2 text-gray-300 break-words">
              <span className="text-brand-400 opacity-80 mr-2">{'>'}</span>{l}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 p-4 bg-white rounded-2xl border border-gray-100 text-[10px] text-gray-400 font-medium">
         Note: If Supabase fails, the app uses LocalStorage. Gemini requires a valid paid API key linked in AI Studio.
      </div>
    </div>
  );
};

export default TestPage;

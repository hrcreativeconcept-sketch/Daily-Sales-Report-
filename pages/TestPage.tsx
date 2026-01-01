import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as CalculationUtils from '../utils/calculations';
import * as GeminiService from '../services/geminiService';
import * as StorageService from '../services/storageService';

const TestPage: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const testApiKey = async () => {
    const key = process.env.API_KEY;
    const isValid = GeminiService.hasValidKey();
    const hasSelected = await GeminiService.ensureApiKey();
    
    addLog(`Key Present: ${!!key}`);
    addLog(`Key length: ${key?.length || 0}`);
    addLog(`System valid key: ${isValid}`);
    addLog(`User selected key: ${hasSelected}`);
    
    if (!isValid) {
      addLog("Recommendation: Click 'ACTIVATE' banner on Dashboard.");
    }
  };

  const testGeminiExtraction = async () => {
    addLog("Testing Gemini 3 Extraction...");
    setIsTesting(true);
    try {
      const res = await GeminiService.parseFromText("Sold 5 units of Sample Product at 99 AED each");
      addLog(`Success: Found ${res.length} items.`);
      addLog(`Details: ${JSON.stringify(res[0])}`);
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testTTS = async () => {
    addLog("Testing Gemini 2.5 TTS...");
    setIsTesting(true);
    try {
      const res = await GeminiService.generateSpeech("Testing the sales report speech engine.");
      addLog(res ? "Success: Received audio bytes." : "Failed: No audio data returned.");
    } catch (e: any) {
      addLog(`Error: ${e.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Diagnostics</h1>
        <button onClick={() => navigate('/')} className="text-xs font-bold text-brand-600 bg-brand-50 px-4 py-2 rounded-xl">Exit</button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button onClick={testApiKey} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-amber-200 hover:bg-amber-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Step 1</p>
          <p className="font-bold text-gray-900">Check API Key</p>
        </button>
        <button onClick={testGeminiExtraction} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-gray-100 hover:bg-brand-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Step 2</p>
          <p className="font-bold text-gray-900">Test Extraction</p>
        </button>
        <button onClick={testTTS} disabled={isTesting} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-gray-100 hover:bg-brand-50 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-brand-600 uppercase mb-1">Step 3</p>
          <p className="font-bold text-gray-900">Test TTS Engine</p>
        </button>
        <button onClick={() => { addLog("Clearing logs..."); setLogs([]); }} className="bg-white p-5 rounded-2xl shadow-sm text-left border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all">
          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Action</p>
          <p className="font-bold text-gray-900">Clear Logs</p>
        </button>
      </div>

      <div className="bg-gray-900 p-6 rounded-3xl shadow-inner h-[400px] overflow-y-auto no-scrollbar font-mono text-[11px] leading-relaxed border border-gray-800">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-green-500 font-bold uppercase tracking-widest text-[10px]">System Monitor</span>
        </div>
        {logs.length === 0 ? (
          <p className="text-gray-600 italic">No diagnostic events logged...</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="mb-2 text-gray-300 break-words">
              <span className="text-brand-400 opacity-80 mr-2">{'>'}</span>{l}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TestPage;
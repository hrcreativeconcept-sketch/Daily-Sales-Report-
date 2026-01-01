import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as CalculationUtils from '../utils/calculations';
import * as GeminiService from '../services/geminiService';
import * as StorageService from '../services/storageService';
import { SalesItem } from '../types';

const TestPage: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const testApiKey = () => {
    const key = process.env.API_KEY;
    const isValid = GeminiService.hasValidKey();
    addLog(`Key Present: ${!!key}`);
    addLog(`Key Value (Redacted): ${key ? key.substring(0, 4) + '...' + key.substring(key.length - 4) : 'NONE'}`);
    addLog(`Valid Detection: ${isValid}`);
    if (!isValid && typeof window !== 'undefined' && window.aistudio) {
      addLog("Recommendation: Click 'Select Key' on Dashboard to trigger picker.");
    }
  };

  const testTimezone = () => {
    const { tz, dateLocal, timeLocal } = CalculationUtils.getLocalDateTimeAndTimezone();
    addLog(`Timezone: ${tz}, Local: ${dateLocal} ${timeLocal}`);
  };

  const testGeminiText = async () => {
    addLog("Testing Gemini Text Parse...");
    try {
      const res = await GeminiService.parseFromText("Sold 3x iPad Air at 2500 AED each");
      addLog(`Success: ${JSON.stringify(res, null, 2)}`);
    } catch (e: any) {
      addLog(`Error: ${e.message || JSON.stringify(e)}`);
    }
  };

  const testSupabase = async () => {
    addLog("Testing Supabase Connection...");
    try {
      const reports = await StorageService.loadReports();
      addLog(`Success: Connected. Found ${reports.length} reports.`);
    } catch (e: any) {
      addLog(`Error: ${e.message || JSON.stringify(e)}`);
      console.error(e);
    }
  };

  const testShareGen = () => {
    const mockReport: any = {
       dateLocal: '2025-11-29',
       timeLocal: '14:30',
       storeName: 'Test Store',
       items: [
         { quantity: 2, productName: 'iPhone 15', unitPrice: 3500 },
         { quantity: 1, productName: 'Case', unitPrice: 100 }
       ],
       totals: { net: 7100 }
    };
    const msg = CalculationUtils.buildShareMessage(mockReport);
    addLog(`Share Message: ${msg}`);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="text-blue-600 underline">Back</button>
        <h1 className="text-xl font-bold">System Diagnostics</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button onClick={testApiKey} className="bg-white p-4 rounded-lg shadow text-left hover:bg-gray-50 border border-amber-200 font-bold text-amber-700">
          Check API Key Status
        </button>
        <button onClick={testTimezone} className="bg-white p-4 rounded-lg shadow text-left hover:bg-gray-50 border border-gray-200 font-medium">
          Test Local Time & Timezone
        </button>
        <button onClick={testGeminiText} className="bg-white p-4 rounded-lg shadow text-left hover:bg-gray-50 border border-gray-200 font-medium">
          Test Gemini Text Parse
        </button>
         <button onClick={testShareGen} className="bg-white p-4 rounded-lg shadow text-left hover:bg-gray-50 border border-gray-200 font-medium">
          Test Share Message Gen
        </button>
        <button onClick={testSupabase} className="bg-white p-4 rounded-lg shadow text-left hover:bg-gray-50 border border-green-200 font-medium text-green-700">
          Test Supabase Connection
        </button>
      </div>

      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs h-96 overflow-auto border border-gray-700 shadow-inner">
        {logs.length === 0 && <span className="opacity-50">Logs will appear here...</span>}
        {logs.map((l, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{l}</div>)}
      </div>
    </div>
  );
};

export default TestPage;
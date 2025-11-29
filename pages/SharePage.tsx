import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, ArrowLeft, MessageCircle, Loader2 } from 'lucide-react';
import * as StorageService from '../services/storageService';
import { DailyReport } from '../types';

const SharePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<DailyReport | null | undefined>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      if (id) {
        const data = await StorageService.getReportById(id);
        setReport(data);
      }
      setLoading(false);
    };
    fetchReport();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 flex flex-col items-center"><Loader2 className="animate-spin mb-2" />Loading report...</div>;
  }

  if (!report) {
    return <div className="p-8 text-center text-gray-500">Report not found. <button onClick={() => navigate('/')} className="underline">Go Home</button></div>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(report.shareMessage);
    alert('Message copied to clipboard');
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(report.shareMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-200 sticky top-0">
         <button onClick={() => navigate(`/report/${report.reportId}`)} className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100">
           <ArrowLeft size={24} />
         </button>
         <h1 className="font-bold text-lg ml-2">Share Report</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full">
        
        <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-brand-100 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 to-brand-500"></div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Message Preview</h2>
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <p className="text-base font-medium text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
              {report.shareMessage}
            </p>
          </div>
        </div>

        <div className="w-full space-y-4">
          <button 
            onClick={handleWhatsApp}
            className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-lg shadow-xl shadow-green-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <MessageCircle size={26} fill="white" className="text-white" />
            Send via WhatsApp
          </button>
          
          <button 
            onClick={handleCopy}
            className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-base hover:bg-gray-50 flex items-center justify-center gap-3 transition-colors"
          >
            <Copy size={20} />
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePage;
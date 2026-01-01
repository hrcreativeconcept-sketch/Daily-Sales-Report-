import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Copy, ArrowLeft, MessageCircle, Loader2, Volume2, VolumeX } from 'lucide-react';
import * as StorageService from '../services/storageService';
import { DailyReport } from '../types';
import * as GeminiService from '../services/geminiService';
import * as AudioUtils from '../utils/audioUtils';

const SharePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [report, setReport] = useState<DailyReport | null | undefined>(location.state?.report || null);
  const [loading, setLoading] = useState(!location.state?.report);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (report) return;

    const fetchReport = async () => {
      if (id) {
        try {
          const data = await StorageService.getReportById(id);
          setReport(data);
        } catch (error) {
           console.error("Error fetching report:", error);
        }
      }
      setLoading(false);
    };
    fetchReport();

    return () => {
      stopSpeech();
    };
  }, [id, report]);

  const stopSpeech = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  };

  const handleTTS = async () => {
    if (isSpeaking) {
      stopSpeech();
      return;
    }

    if (!report?.shareMessage) return;

    setIsSpeaking(true);
    try {
      const base64Audio = await GeminiService.generateSpeech(report.shareMessage);
      if (!base64Audio) {
        setIsSpeaking(false);
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const audioBuffer = await AudioUtils.decodeAudioData(AudioUtils.decode(base64Audio), ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      
      sourceNodeRef.current = source;
      source.start();
    } catch (e) {
      console.error("TTS failed", e);
      setIsSpeaking(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-screen"><Loader2 className="animate-spin mb-3 text-brand-600" size={32} />Loading report...</div>;
  }

  if (!report) {
    return (
        <div className="p-8 text-center text-gray-500 min-h-screen flex flex-col items-center justify-center">
            <p className="mb-4">Report not found or unavailable.</p>
            <button onClick={() => navigate('/')} className="text-brand-600 font-bold underline hover:text-brand-800">
                Go to Dashboard
            </button>
        </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(report.shareMessage);
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(report.shareMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-200 sticky top-0 z-50">
         <button onClick={() => navigate(`/report/${report.reportId}`)} className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors">
           <ArrowLeft size={24} />
         </button>
         <h1 className="font-bold text-lg ml-2">Share Report</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full">
        
        <div className="w-full bg-white p-6 rounded-2xl shadow-lg border border-brand-100 mb-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-500 to-brand-500"></div>
          
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Message Preview</h2>
            <button 
              onClick={handleTTS}
              className={`p-2 rounded-full transition-all active:scale-95 ${
                isSpeaking 
                  ? 'bg-red-100 text-red-600 animate-pulse' 
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}
              title={isSpeaking ? "Stop" : "Listen to report"}
            >
              {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>

          <div className="bg-green-50 p-4 rounded-xl border border-green-100 max-h-[50vh] overflow-y-auto no-scrollbar">
            <p className="text-base font-medium text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
              {report.shareMessage}
            </p>
          </div>
        </div>

        <div className="w-full space-y-4 animate-in slide-in-from-bottom-6 duration-700">
          <button 
            onClick={handleWhatsApp}
            className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-lg shadow-xl shadow-green-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95 group"
          >
            <MessageCircle size={26} fill="white" className="text-white group-hover:rotate-12 transition-transform" />
            Send via WhatsApp
          </button>
          
          <button 
            onClick={handleCopy}
            className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-base hover:bg-gray-50 flex items-center justify-center gap-3 transition-colors active:scale-95"
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
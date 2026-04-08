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
    return <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-screen font-mono text-[10px] uppercase tracking-widest"><Loader2 className="animate-spin mb-4 text-slate-900" size={32} />Syncing Data...</div>;
  }

  if (!report) {
    return (
        <div className="p-8 text-center text-slate-400 min-h-screen flex flex-col items-center justify-center font-mono text-[10px] uppercase tracking-widest">
            <p className="mb-6">Report Node Not Found</p>
            <button onClick={() => navigate('/')} className="text-slate-900 font-bold underline hover:text-black">
                Return to Hub
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
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="bg-white/90 backdrop-blur-xl px-4 py-3 flex items-center border-b border-slate-200 sticky top-0 z-50">
         <button onClick={() => navigate(`/report/${report.reportId}`)} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all active:scale-90">
           <ArrowLeft size={20} strokeWidth={2.5} />
         </button>
         <h1 className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] ml-2 text-slate-900">Output Preview</h1>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full">
        
        <div className="w-full bg-white p-6 rounded-3xl border border-slate-200 mb-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">Buffer Content</h2>
            <button 
              onClick={handleTTS}
              className={`p-2.5 rounded-xl transition-all active:scale-95 border ${
                isSpeaking 
                  ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' 
                  : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'
              }`}
              title={isSpeaking ? "Stop" : "Listen to report"}
            >
              {isSpeaking ? <VolumeX size={18} strokeWidth={2.5} /> : <Volume2 size={18} strokeWidth={2.5} />}
            </button>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 max-h-[50vh] overflow-y-auto no-scrollbar">
            <p className="text-sm font-mono font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
              {report.shareMessage}
            </p>
          </div>
        </div>

        <div className="w-full space-y-3 animate-in slide-in-from-bottom-6 duration-700">
          <button 
            onClick={handleWhatsApp}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-mono font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 group"
          >
            <MessageCircle size={20} className="group-hover:rotate-12 transition-transform" />
            Transmit via WhatsApp
          </button>
          
          <button 
            onClick={handleCopy}
            className="w-full py-4 bg-white border border-slate-200 text-slate-400 rounded-2xl font-mono font-bold text-[10px] uppercase tracking-[0.2em] hover:text-slate-900 hover:border-slate-900 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <Copy size={18} />
            Copy Buffer
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePage;
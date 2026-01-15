
import React, { useState, useEffect } from 'react';
import { Camera, Mic, Upload, Loader2, Clipboard, StopCircle, ArrowRight, Check, X, Volume2, AlertTriangle, Sparkles } from 'lucide-react';
import { SalesItem } from '../types';
import * as GeminiService from '../services/geminiService';
import { formatCurrency } from '../utils/calculations';
import * as StorageService from '../services/storageService';

interface CapturePanelProps {
  onItemsCaptured: (items: SalesItem[], method: 'ocr' | 'speech' | 'manual' | 'upload') => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onAttachmentsAdded?: (urls: string[]) => void;
}

type TabType = 'snap' | 'copy' | 'speech' | 'upload';

const CapturePanel: React.FC<CapturePanelProps> = ({ onItemsCaptured, isProcessing, setIsProcessing, onAttachmentsAdded }) => {
  const [activeTab, setActiveTab] = useState<TabType>('snap');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [pendingItems, setPendingItems] = useState<SalesItem[] | null>(null);
  const [pendingSource, setPendingSource] = useState<'ocr' | 'speech' | 'manual' | 'upload'>('manual');

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 2048; 
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85); 
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (activeTab !== 'copy' || !inputText.trim() || isProcessing || pendingItems) return;
    const timer = setTimeout(() => {
      if (inputText.length > 5 && inputText.length < 5000) { handleTextSubmit(); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [inputText, activeTab, pendingItems]);

  useEffect(() => {
    if (pendingItems && pendingSource === 'speech') { speakItems(pendingItems); }
  }, [pendingItems]);

  const speakItems = (items: SalesItem[]) => {
    if (!items.length || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const summary = items.length === 1 
      ? `Captured 1 item. ${items[0].quantity} ${items[0].productName} at ${items[0].unitPrice} ${items[0].currency}.`
      : `Captured ${items.length} items. Top item: ${items[0].quantity} ${items[0].productName}.`;
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const handleCapturedResults = (items: SalesItem[], source: 'ocr' | 'speech' | 'manual' | 'upload') => {
    if (items.length === 0) {
      alert("No identifiable items found.");
      return;
    }
    setPendingSource(source);
    setPendingItems(items);
  };

  const confirmPendingItems = () => {
    if (pendingItems) {
      onItemsCaptured(pendingItems, pendingSource);
      setPendingItems(null);
      setInputText('');
      window.speechSynthesis.cancel();
    }
  };

  const discardPendingItems = () => {
    setPendingItems(null);
    window.speechSynthesis.cancel();
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const items = await GeminiService.parseFromText(inputText);
      handleCapturedResults(items, 'manual');
    } catch (e: any) {
      alert(`Parsing failed: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = async (file: File, type: 'ocr' | 'upload') => {
    if (!file) return;
    setIsProcessing(true);
    const uploadPromise = StorageService.uploadFile(file);
    try {
      let items: SalesItem[] = [];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const content = (reader.result as string).slice(0, 20000);
            items = await GeminiService.parseFromText(content);
            handleCapturedResults(items, 'manual');
          } finally { setIsProcessing(false); }
        };
        reader.readAsText(file);
      } else if (file.type.startsWith('image/')) {
        const base64 = await compressImage(file);
        items = await GeminiService.parseFromFile(base64, 'image/jpeg');
        const publicUrl = await uploadPromise;
        if (publicUrl) {
          await StorageService.saveOcrLog(publicUrl, items);
          if (onAttachmentsAdded) onAttachmentsAdded([publicUrl]);
        }
        handleCapturedResults(items, type);
        setIsProcessing(false);
      } else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          items = await GeminiService.parseFromFile(base64, file.type);
          const publicUrl = await uploadPromise;
          if (publicUrl && onAttachmentsAdded) onAttachmentsAdded([publicUrl]);
          handleCapturedResults(items, type);
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (e) {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      const localChunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) localChunks.push(event.data); };
      recorder.onstop = async () => {
        setIsProcessing(true);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const audioBlob = new Blob(localChunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
           try {
             const base64 = (reader.result as string).split(',')[1];
             const items = await GeminiService.parseFromAudio(base64, mimeType);
             handleCapturedResults(items, 'speech');
           } finally { setIsProcessing(false); }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) { alert("Mic access required."); }
  };

  const stopRecording = () => { if (mediaRecorder && isRecording) { mediaRecorder.stop(); setIsRecording(false); } };

  const TabButton = ({ id, icon: Icon, label }: { id: TabType, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      disabled={isProcessing || !!pendingItems}
      className={`relative flex-1 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all rounded-2xl z-10 ${
        activeTab === id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
      } ${isProcessing || pendingItems ? 'opacity-30' : ''}`}
    >
      <Icon size={16} strokeWidth={2.5} />
      <span className="hidden sm:inline">{label}</span>
      {activeTab === id && (
        <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-slate-100 -z-10 animate-in fade-in zoom-in-95 duration-300"></div>
      )}
    </button>
  );

  return (
    <div className="bg-white rounded-[2.5rem] shadow-soft border border-slate-100 overflow-hidden mb-8 relative">
      {pendingItems && (
        <div className="absolute inset-0 bg-white z-[30] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-brand-50/50 px-6 py-4 border-b border-brand-100 flex justify-between items-center">
            <h3 className="font-black text-brand-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="text-brand-500" size={14} /> Intelligence Review
            </h3>
            {pendingSource === 'speech' && (
              <button onClick={() => speakItems(pendingItems)} className="p-2 text-brand-600 hover:bg-brand-100 rounded-xl transition-colors">
                <Volume2 size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {pendingItems.map((item, i) => (
              <div key={i} className={`flex justify-between items-center p-4 rounded-2xl border ${item.lowConfidence ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex-1 min-w-0 pr-4">
                   <div className="flex items-center gap-2 mb-0.5">
                     <span className="font-extrabold text-slate-900 text-sm">{item.quantity}×</span> 
                     <span className={`text-sm font-bold truncate ${item.lowConfidence ? 'text-amber-900' : 'text-slate-800'}`}>{item.productName}</span>
                   </div>
                   <p className="text-[10px] text-slate-400 font-medium truncate italic">{item.notes || 'No extra notes'}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-brand-600">{formatCurrency(item.unitPrice, item.currency)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
            <button 
              onClick={discardPendingItems}
              className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-2xl hover:text-slate-600 transition-all active:scale-95"
            >
              Discard
            </button>
            <button 
              onClick={confirmPendingItems}
              className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl shadow-elevated hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Check size={16} strokeWidth={3} /> Save Selection
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-100/50 p-1.5 flex gap-1 border-b border-slate-100">
        <TabButton id="snap" icon={Camera} label="Camera" />
        <TabButton id="copy" icon={Clipboard} label="Text" />
        <TabButton id="speech" icon={Mic} label="Voice" />
        <TabButton id="upload" icon={Upload} label="Upload" />
      </div>

      <div className="p-6 min-h-[220px] flex items-center justify-center relative">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-10 w-full animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-brand-500/10 rounded-full animate-ping opacity-25"></div>
              <div className="relative bg-white p-6 rounded-[2rem] shadow-elevated border border-slate-50">
                 <Loader2 className="animate-spin text-brand-600" size={32} strokeWidth={2.5} />
              </div>
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] animate-pulse">Processing Agent</span>
            <span className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Applying AI Logic...</span>
          </div>
        ) : (
          <div className="w-full h-full animate-in slide-in-from-bottom-2 duration-500">
            {activeTab === 'snap' && (
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-slate-100 border-dashed rounded-[2rem] cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-all group active:scale-[0.99] border-brand-200/50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-4 bg-white rounded-2xl shadow-soft mb-4 group-hover:scale-110 group-hover:shadow-elevated transition-all border border-slate-50">
                        <Camera className="w-8 h-8 text-brand-500" strokeWidth={2} />
                      </div>
                      <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest">Snap Receipt</p>
                      <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Automatic Data Extraction</p>
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'ocr')} />
              </label>
            )}

            {activeTab === 'copy' && (
              <div className="space-y-4">
                <div className="relative group">
                  <textarea
                    className="w-full p-5 border border-slate-100 rounded-[2rem] text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 focus:bg-white outline-none shadow-soft min-h-[160px] resize-none bg-slate-50/50 font-medium transition-all"
                    placeholder="Paste messy notes here..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  {inputText && (
                    <div className="absolute bottom-4 right-4 animate-in fade-in zoom-in duration-300">
                       <button onClick={handleTextSubmit} className="bg-slate-900 text-white p-3 rounded-2xl shadow-elevated hover:bg-black transition-all active:scale-90">
                         <ArrowRight size={20} strokeWidth={3} />
                       </button>
                    </div>
                  )}
                </div>
                <div className="flex justify-between px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Live Auto-Parser</span>
                  </div>
                  <span className="text-[9px] text-slate-300 font-bold uppercase">{inputText.length} / 5000</span>
                </div>
              </div>
            )}

            {activeTab === 'speech' && (
              <div className="flex flex-col items-center justify-center h-full py-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-elevated transition-all duration-500 ${
                    isRecording ? 'bg-red-500 scale-105 ring-[12px] ring-red-50' : 'bg-slate-900 hover:shadow-slate-900/30 ring-[12px] ring-slate-100'
                  }`}
                >
                  {isRecording ? <StopCircle size={44} className="text-white" strokeWidth={2.5} /> : <Mic size={44} className="text-white" strokeWidth={2.5} />}
                  {isRecording && <span className="absolute w-full h-full rounded-[2.5rem] animate-ping bg-red-500 opacity-20"></span>}
                </button>
                <p className="mt-8 text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{isRecording ? "Listening..." : "Tap to Speak"}</p>
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest text-center max-w-[180px]">Describe your sales naturally</p>
              </div>
            )}

            {activeTab === 'upload' && (
              <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-slate-100 border-dashed rounded-[2rem] cursor-pointer bg-white hover:bg-slate-50 transition-all group active:scale-[0.99]">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-4 bg-slate-50 rounded-2xl mb-4 group-hover:bg-white group-hover:shadow-elevated transition-all border border-transparent group-hover:border-slate-50">
                        <Upload className="w-8 h-8 text-slate-300 group-hover:text-brand-500 transition-colors" strokeWidth={2.5} />
                      </div>
                      <p className="text-[10px] text-slate-900 font-black uppercase tracking-widest">Select Files</p>
                      <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">PDF, CSV, or Image</p>
                  </div>
                  <input type="file" accept="image/*, application/pdf, .csv, text/csv" className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'upload')} />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CapturePanel;

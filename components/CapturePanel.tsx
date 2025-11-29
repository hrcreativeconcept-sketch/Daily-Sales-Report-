
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Upload, Loader2, Clipboard, StopCircle, ArrowRight, Check, X, Volume2, AlertTriangle } from 'lucide-react';
import { SalesItem } from '../types';
import * as GeminiService from '../services/geminiService';
import { formatCurrency } from '../utils/calculations';
import * as StorageService from '../services/storageService';

interface CapturePanelProps {
  onItemsCaptured: (items: SalesItem[], method: 'ocr' | 'speech' | 'manual' | 'upload') => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
}

type TabType = 'snap' | 'copy' | 'speech' | 'upload';

const CapturePanel: React.FC<CapturePanelProps> = ({ onItemsCaptured, isProcessing, setIsProcessing }) => {
  const [activeTab, setActiveTab] = useState<TabType>('snap');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Review Mode State
  const [pendingItems, setPendingItems] = useState<SalesItem[] | null>(null);
  const [pendingSource, setPendingSource] = useState<'ocr' | 'speech' | 'manual' | 'upload'>('manual');
  
  // Note: We are not exposing attachments state directly to the parent in this component version based on props,
  // but we are uploading files. Ideally, onItemsCaptured should accept attachments or we handle it differently.
  // For now, we follow the existing pattern.

  // Helper: Client-side image compression
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Increased resolution to 2048 to preserve text details on screenshots
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
        
        // JPEG quality 0.85 for better text clarity
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85); 
        resolve(dataUrl.split(',')[1]); // Return base64 only
      };

      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Debounce timer for auto-parsing text
  useEffect(() => {
    if (activeTab !== 'copy' || !inputText.trim() || isProcessing || pendingItems) return;

    const timer = setTimeout(() => {
      // Auto-parse if text is substantial (e.g. pasted)
      if (inputText.length > 5 && inputText.length < 5000) {
        handleTextSubmit();
      }
    }, 1200); // 1.2s debounce

    return () => clearTimeout(timer);
  }, [inputText, activeTab, pendingItems]);

  // Audio Read Back Effect
  useEffect(() => {
    if (pendingItems && pendingSource === 'speech') {
      speakItems(pendingItems);
    }
  }, [pendingItems]);

  const speakItems = (items: SalesItem[]) => {
    if (!items.length || !window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const summary = items.length === 1 
      ? `Captured 1 item. ${items[0].quantity} ${items[0].productName} at ${items[0].unitPrice} ${items[0].currency}.`
      : `Captured ${items.length} items. Top item: ${items[0].quantity} ${items[0].productName}.`;

    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  // --- Handlers ---

  const handleCapturedResults = (items: SalesItem[], source: 'ocr' | 'speech' | 'manual' | 'upload') => {
    if (items.length === 0) {
      alert("No items found. Please try again.");
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
    // Security: Strict length limit prevents DoS
    if (inputText.length > 5000) {
      alert("Text is too long (max 5000 chars). Please reduce the content.");
      return;
    }

    setIsProcessing(true);
    try {
      const items = await GeminiService.parseFromText(inputText);
      handleCapturedResults(items, 'manual');
    } catch (e: any) {
      alert(`Failed to parse text: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = async (file: File, type: 'ocr' | 'upload') => {
    if (!file) return;
    
    // Security: File size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large (max 10MB).");
      return;
    }

    setIsProcessing(true);

    // 1. Initiate Upload to Storage (Parallel)
    const uploadPromise = StorageService.uploadFile(file);

    try {
      let items: SalesItem[] = [];

      // 2. Process with Gemini
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const text = reader.result as string;
            // Security: Limit CSV text size processed
            const content = text.length > 20000 ? text.slice(0, 20000) : text;
            items = await GeminiService.parseFromText(content);
            finishProcessing(items);
          } catch (e: any) {
             console.error(e);
             alert(`Failed to parse CSV: ${e.message}`);
             setIsProcessing(false);
          }
        };
        reader.readAsText(file);
        return; // Exit here, let onloadend handle completion
      } 
      
      // Image Handling (OCR)
      else if (file.type.startsWith('image/')) {
        try {
          // Compress/Resize image on client before sending to AI
          const base64 = await compressImage(file);
          items = await GeminiService.parseFromFile(base64, 'image/jpeg');
          
          // Wait for upload to complete to log it
          const publicUrl = await uploadPromise;
          if (publicUrl) {
            // Log the OCR attempt to the new 'reports' table
            await StorageService.saveOcrLog(publicUrl, items);
          }

          handleCapturedResults(items, type);
        } catch (err: any) {
          console.error(err);
          alert(`Image processing failed: ${err.message || 'Unknown error'}. Please check your API Key configuration.`);
        }
      } 
      
      // PDF/Other Handling
      else {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            items = await GeminiService.parseFromFile(base64, file.type);
            handleCapturedResults(items, type);
          } catch (err: any) {
            console.error(err);
            alert(`File processing failed: ${err.message}. Please check your API Key configuration.`);
          }
        };
        reader.readAsDataURL(file);
        return; // Exit here
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!file.type.endsWith('.csv') && !file.type.startsWith('application/pdf')) {
        setIsProcessing(false);
      }
    }
  };

  const finishProcessing = (items: SalesItem[]) => {
      handleCapturedResults(items, 'manual'); // CSV treated as manual/text
      setIsProcessing(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        const reader = new FileReader();
        reader.onloadend = async () => {
           try {
             const base64 = (reader.result as string).split(',')[1];
             const items = await GeminiService.parseFromAudio(base64, mimeType);
             handleCapturedResults(items, 'speech');
           } catch (e: any) {
             console.error(e);
             alert(`Speech processing failed: ${e.message}`);
           } finally {
             setIsProcessing(false);
           }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const TabButton = ({ id, icon: Icon, label }: { id: TabType, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      disabled={isProcessing || !!pendingItems}
      className={`relative flex-1 py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all rounded-xl z-10 ${
        activeTab === id 
          ? 'text-brand-700' 
          : 'text-gray-400 hover:bg-gray-50'
      } ${isProcessing || pendingItems ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon size={18} strokeWidth={2.5} />
      <span>{label}</span>
      {activeTab === id && (
        <div className="absolute inset-0 bg-white rounded-xl shadow-sm border border-gray-100 -z-10 animate-in fade-in zoom-in-95 duration-200"></div>
      )}
    </button>
  );

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden mb-6 relative">
      {/* Review Overlay */}
      {pendingItems && (
        <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 flex justify-between items-center">
            <h3 className="font-bold text-brand-900 text-sm flex items-center gap-2">
              <Check className="text-green-500" size={16} /> 
              Review Captured Items ({pendingItems.length})
            </h3>
            {pendingSource === 'speech' && (
              <button onClick={() => speakItems(pendingItems)} className="p-1.5 text-brand-600 hover:bg-brand-100 rounded-full">
                <Volume2 size={16} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {pendingItems.map((item, i) => (
              <div key={i} className={`flex justify-between items-center text-sm p-3 rounded-xl border ${item.lowConfidence ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-gray-900">{item.quantity}x</span> 
                     <span className={item.lowConfidence ? 'text-amber-900' : ''}>{item.productName}</span>
                     {item.lowConfidence && (
                       <span title="Low Confidence">
                         <AlertTriangle size={14} className="text-amber-500" />
                       </span>
                     )}
                   </div>
                   <div className="text-xs text-gray-400">{item.notes}</div>
                </div>
                <span className="font-bold text-brand-600">{formatCurrency(item.unitPrice, item.currency)}</span>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-3">
            <button 
              onClick={discardPendingItems}
              className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={confirmPendingItems}
              className="flex-1 py-3 text-sm font-bold text-white bg-brand-600 rounded-2xl shadow-lg shadow-brand-200 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={16} /> Confirm
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-gray-100/50 p-1.5 flex gap-1 rounded-t-3xl border-b border-gray-100">
        <TabButton id="snap" icon={Camera} label="Snap" />
        <TabButton id="copy" icon={Clipboard} label="Copy" />
        <TabButton id="speech" icon={Mic} label="Speech" />
        <TabButton id="upload" icon={Upload} label="Upload" />
      </div>

      {/* Content */}
      <div className="p-4 min-h-[180px] flex items-center justify-center bg-white">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-8 w-full animate-in fade-in duration-300">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-brand-200 rounded-full animate-ping opacity-75 duration-1000"></div>
              <div className="relative bg-white p-4 rounded-full shadow-md border border-brand-50">
                 <Loader2 className="animate-spin text-brand-600" size={32} />
              </div>
            </div>
            <span className="text-sm font-bold text-gray-800 animate-pulse">Analyzing Content...</span>
            <span className="text-xs text-gray-400 mt-1">Extracting product details</span>
          </div>
        ) : (
          <div className="w-full h-full animate-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'snap' && (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-brand-200 border-dashed rounded-2xl cursor-pointer bg-brand-50/50 hover:bg-brand-50 transition-all group active:scale-[0.99]">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:shadow-md group-hover:scale-110 transition-all">
                        <Camera className="w-8 h-8 text-brand-500" />
                      </div>
                      <p className="text-sm text-brand-900 font-bold">Take a Photo</p>
                      <p className="text-xs text-brand-500/70 mt-1 font-medium">Receipts, tags, handwritten notes</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="hidden" 
                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'ocr')} 
                  />
              </label>
            )}

            {activeTab === 'copy' && (
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-sm min-h-[140px] resize-none bg-gray-50/50"
                    placeholder="Paste text here... (e.g. '3x iPhone 15 @ 3499')"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    maxLength={5000} // Security Limit
                  />
                  {inputText && (
                    <div className="absolute bottom-3 right-3 animate-in fade-in zoom-in">
                       <button 
                         onClick={handleTextSubmit}
                         className="bg-brand-600 text-white p-2.5 rounded-full shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-colors"
                       >
                         <ArrowRight size={18} />
                       </button>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-bold px-2 uppercase tracking-wide">
                  <span>Auto-parsing active</span>
                  <span>{inputText.length}/5000</span>
                </div>
              </div>
            )}

            {activeTab === 'speech' && (
              <div className="flex flex-col items-center justify-center h-full py-2">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isRecording 
                      ? 'bg-red-500 scale-105 ring-8 ring-red-100' 
                      : 'bg-gradient-to-br from-brand-500 to-brand-600 hover:shadow-brand-500/40 ring-8 ring-brand-50'
                  }`}
                >
                  {isRecording ? <StopCircle size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
                  {isRecording && (
                    <>
                      <span className="absolute w-full h-full rounded-full animate-ping bg-red-500 opacity-20"></span>
                      <span className="absolute w-full h-full rounded-full animate-pulse bg-red-500 opacity-10 animation-delay-500"></span>
                    </>
                  )}
                </button>
                <p className="mt-5 text-base font-bold text-gray-800">
                  {isRecording ? "Listening..." : "Tap to Speak"}
                </p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] text-center font-medium">
                  {isRecording ? "Tap again to finish" : "Dictate items, prices, and quantities naturally"}
                </p>
              </div>
            )}

            {activeTab === 'upload' && (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-200 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-gray-50 transition-all group active:scale-[0.99]">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-3 bg-gray-50 rounded-full mb-3 group-hover:bg-white group-hover:shadow-sm transition-all group-hover:scale-110">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-brand-500 transition-colors" />
                      </div>
                      <p className="text-sm text-gray-600 font-bold group-hover:text-brand-700 transition-colors">Upload File</p>
                      <p className="text-xs text-gray-400 mt-1 font-medium">Screenshots, Photos, PDF, CSV</p>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*, application/pdf, .csv, text/csv" 
                    className="hidden" 
                    onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], 'upload')} 
                  />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CapturePanel;

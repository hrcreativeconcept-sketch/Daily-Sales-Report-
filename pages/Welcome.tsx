
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Camera, Mic, Upload, Clipboard, ArrowRight, Check, FileText } from 'lucide-react';

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleComplete = () => {
    // Set flag so user isn't redirected here again automatically
    localStorage.setItem('dsr_intro_shown', 'true');
    navigate('/');
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const slides = [
    {
      id: 'copy',
      title: 'Smart Text Parse',
      desc: 'Simply copy & paste sales text from WhatsApp or Notes. Our AI automatically structures messy text into a clean report.',
      icon: Clipboard,
      color: 'text-emerald-600',
      bgBase: 'bg-emerald-50',
      bgCircle: 'bg-emerald-100',
      gradient: 'from-emerald-400 to-emerald-600',
      indicatorColor: 'bg-emerald-600'
    },
    {
      id: 'snap',
      title: 'Snap & Extract',
      desc: 'Take a photo of a receipt, handwritten log, or price tag. We instantly extract product names and prices using advanced OCR.',
      icon: Camera,
      color: 'text-brand-600',
      bgBase: 'bg-brand-50',
      bgCircle: 'bg-brand-100',
      gradient: 'from-brand-400 to-brand-600',
      indicatorColor: 'bg-brand-600'
    },
    {
      id: 'upload',
      title: 'Upload Anything',
      desc: 'Have a screenshot or PDF? Upload existing files directly from your gallery. We handle multiple formats seamlessly.',
      icon: Upload,
      color: 'text-violet-600',
      bgBase: 'bg-violet-50',
      bgCircle: 'bg-violet-100',
      gradient: 'from-violet-400 to-violet-600',
      indicatorColor: 'bg-violet-600'
    },
    {
      id: 'voice',
      title: 'Just Say It',
      desc: 'Dictate your sales naturally. "Sold 3 iPhones and a case." Our voice engine listens and logs it for you.',
      icon: Mic,
      color: 'text-red-500',
      bgBase: 'bg-red-50',
      bgCircle: 'bg-red-100',
      gradient: 'from-red-400 to-red-600',
      indicatorColor: 'bg-red-500'
    }
  ];

  const currentSlide = slides[currentIndex];
  const CurrentIcon = currentSlide.icon;

  return (
    <div className={`min-h-screen relative overflow-hidden flex flex-col font-heading transition-colors duration-700 ${currentSlide.bgBase}`}>
      
      {/* Background Decor (Blob) */}
      <div className={`absolute top-[-20%] right-[-20%] w-[100vw] h-[100vw] rounded-full blur-3xl opacity-40 pointer-events-none transition-colors duration-700 ${currentSlide.bgCircle}`}></div>
      
      {/* Header / Skip */}
      <div className="absolute top-6 right-6 z-20">
        <button 
          onClick={handleComplete}
          className="text-gray-400 font-bold text-sm hover:text-gray-900 transition-colors py-2 px-4"
        >
          Skip
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 pt-10 pb-6">
        
        {/* Illustration Container */}
        <div className="relative w-72 h-72 mb-10 flex items-center justify-center">
           {/* Pulsing Background Ring */}
           <div className={`absolute inset-0 rounded-full animate-pulse-slow opacity-30 transition-colors duration-700 ${currentSlide.bgCircle}`}></div>
           
           {/* Main Icon Card */}
           <div 
             key={currentIndex} // Key change triggers animation restart
             className={`relative w-32 h-32 rounded-3xl shadow-2xl flex items-center justify-center animate-float z-10 rotate-3 bg-gradient-to-br ${currentSlide.gradient}`}
           >
              <CurrentIcon className="text-white w-16 h-16" strokeWidth={1.5} />
              
              {/* Decor element on card */}
              <div className="absolute -top-3 -right-3 bg-white p-2 rounded-2xl shadow-lg">
                 <Sparkles className={`w-5 h-5 fill-current ${currentSlide.color}`} />
              </div>
           </div>

           {/* Dynamic Floating Particles based on Slide */}
           {currentIndex === 0 && ( // Copy Paste Decor
              <div className="absolute top-10 left-4 bg-white p-3 rounded-xl shadow-lg animate-bounce duration-[3000ms]">
                <div className="w-8 h-2 bg-emerald-100 rounded-full mb-1"></div>
                <div className="w-5 h-2 bg-emerald-100 rounded-full"></div>
              </div>
           )}

           {currentIndex === 1 && ( // Snap Decor
              <div className="absolute bottom-10 right-4 bg-white p-3 rounded-xl shadow-lg animate-bounce duration-[3000ms]">
                 <FileText size={20} className="text-brand-300" />
              </div>
           )}

           {currentIndex === 3 && ( // Voice Decor
              <>
                <div className="absolute right-0 top-1/2 w-2 h-8 bg-red-400/20 rounded-full animate-pulse"></div>
                <div className="absolute left-0 top-1/2 w-2 h-12 bg-red-400/20 rounded-full animate-pulse delay-75"></div>
              </>
           )}
        </div>

        {/* Text Content */}
        <div key={`text-${currentIndex}`} className="text-center space-y-4 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
             {currentSlide.title}
          </h1>
          <p className="text-gray-500 font-sans text-base leading-relaxed">
             {currentSlide.desc}
          </p>
        </div>

      </div>

      {/* Bottom Action */}
      <div className="p-6 pb-10 z-20 w-full max-w-md mx-auto">
        {/* Indicators */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((slide, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${idx === currentIndex ? `w-8 ${slide.indicatorColor}` : 'w-2 bg-gray-200'}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <button 
          onClick={nextSlide}
          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-gray-900/10 flex items-center justify-center gap-2 group active:scale-[0.98] transition-all hover:bg-black"
        >
          {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          {currentIndex === slides.length - 1 ? <Check size={20} /> : <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />}
        </button>
      </div>

    </div>
  );
};

export default Welcome;

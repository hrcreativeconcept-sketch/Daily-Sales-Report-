
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Explicitly extend Component from react to ensure 'props' and 'state' are correctly recognized by the TypeScript compiler
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center font-sans">
          <div className="bg-red-100 p-4 rounded-full mb-4">
             <AlertTriangle className="text-red-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 mb-6 max-w-xs mx-auto">The application encountered an unexpected error.</p>
          
          <div className="w-full max-w-md bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 text-left overflow-hidden">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Error Details</p>
             <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap break-words">
               {this.state.error?.message || 'Unknown Error'}
             </pre>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-500/30 flex items-center gap-2 hover:bg-brand-700 transition-all active:scale-95"
          >
            <RefreshCw size={18} />
            Reload Application
          </button>
        </div>
      );
    }

    // Accessing children through this.props which is now properly typed via generic Component<Props, State>
    return this.props.children;
  }
}

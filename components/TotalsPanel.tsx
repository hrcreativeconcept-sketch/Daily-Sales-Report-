
import React from 'react';
import { Totals } from '../types';
import { formatCurrency } from '../utils/calculations';

interface TotalsPanelProps {
  totals: Totals;
  onDiscountChange: (val: number) => void;
  currency?: string;
}

const TotalsPanel: React.FC<TotalsPanelProps> = ({ totals, onDiscountChange, currency = 'AED' }) => {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-soft relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -mr-16 -mt-16"></div>
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-brand-500 rounded-full"></div> Financials
      </h3>
      <div className="space-y-5">
        <div className="flex justify-between items-center px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Subtotal</span>
          <span className="font-bold text-slate-900">{formatCurrency(totals.gross, currency)}</span>
        </div>
        
        <div className="flex justify-between items-center px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Adjustments</span>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-slate-100 focus-within:border-brand-200 transition-colors">
             <span className="text-slate-300 font-black text-xs">-</span>
            <input 
              type="number"
              min="0"
              step="0.01"
              value={totals.discounts || ''}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="w-20 text-right bg-transparent focus:outline-none text-sm font-extrabold text-slate-900 placeholder-slate-300"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="pt-8 mt-4 border-t border-slate-100 flex flex-col items-center text-center">
          <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.3em] mb-3">Total Net Revenue</span>
          <span className="text-5xl font-heading font-black tracking-tight text-slate-900">
            {formatCurrency(totals.net, currency)}
          </span>
          <div className="mt-4 px-4 py-1.5 bg-brand-50 rounded-full">
            <span className="text-[9px] font-black text-brand-600 uppercase tracking-widest">Final Amount Due</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalsPanel;

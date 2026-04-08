
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
    <div className="bg-white p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
      <h3 className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
        Financial Summary // {currency}
      </h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
          <span className="font-mono font-bold text-slate-900">{formatCurrency(totals.gross, currency)}</span>
        </div>
        
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Adjustments</span>
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1 border border-slate-200 focus-within:border-slate-900 transition-colors">
             <span className="text-slate-300 font-mono font-bold text-[10px]">-</span>
            <input 
              type="number"
              min="0"
              step="0.01"
              value={totals.discounts || ''}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="w-20 text-right bg-transparent focus:outline-none text-[10px] font-mono font-bold text-slate-900 placeholder-slate-300"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="pt-6 mt-2 border-t border-slate-200 flex flex-col items-center text-center">
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-[0.3em] mb-2">Net Revenue</span>
          <span className="text-4xl font-mono font-bold tracking-tighter text-slate-900">
            {formatCurrency(totals.net, currency)}
          </span>
          <div className="mt-4 px-3 py-1 bg-slate-900 rounded-md">
            <span className="text-[8px] font-mono font-bold text-white uppercase tracking-widest">Finalized Output</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TotalsPanel;

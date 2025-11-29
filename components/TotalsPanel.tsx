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
    <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Financial Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 font-medium">Gross Sales</span>
          <span className="font-bold text-gray-900">{formatCurrency(totals.gross, currency)}</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600 font-medium">Discounts</span>
          <div className="flex items-center space-x-2">
             <span className="text-gray-400 font-bold">-</span>
            <input 
              type="number"
              min="0"
              step="0.01"
              value={totals.discounts || ''}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="w-24 text-right px-2 py-1 rounded-lg border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none text-sm font-semibold bg-gray-50 transition-all placeholder-gray-300"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div className="border-t border-dashed border-gray-200 pt-4 mt-2 flex justify-between items-end">
          <span className="text-sm font-bold text-gray-900 mb-1">Net Sales</span>
          <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-800">
            {formatCurrency(totals.net, currency)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TotalsPanel;

import React from 'react';
import { SalesItem } from '../types';
import { Trash2, Plus, AlertCircle, X, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

interface ItemsTableProps {
  items: SalesItem[];
  onChange: (items: SalesItem[]) => void;
  isParsing?: boolean;
  errors?: Record<number, { [key in keyof SalesItem]?: string } & { items?: string }>;
}

const SkeletonItem = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse space-y-4">
    <div className="flex justify-between gap-4">
      <div className="h-4 bg-slate-50 rounded-full w-1/2"></div>
      <div className="h-4 bg-slate-50 rounded-full w-1/4"></div>
    </div>
    <div className="flex gap-3">
      <div className="h-10 bg-slate-50 rounded-lg flex-1"></div>
      <div className="h-10 bg-slate-50 rounded-lg w-24"></div>
    </div>
  </div>
);

const ItemsTable: React.FC<ItemsTableProps> = ({ items, onChange, isParsing = false, errors = {} }) => {
  const handleItemChange = (index: number, field: keyof SalesItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { 
      ...newItems[index], 
      [field]: value,
      lowConfidence: false 
    };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    onChange([
      ...items,
      { productName: '', sku: '', quantity: 1, unitPrice: 0, currency: 'AED', notes: '' }
    ]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const itemErrors = errors[index] || {};
        const hasError = Object.keys(itemErrors).length > 0;
        const isLowConfidence = item.lowConfidence;
        
        return (
          <div key={`${index}-${item.productName}`} className={`bg-white p-5 rounded-2xl border transition-all duration-300 group relative ${
            hasError ? 'border-red-300 bg-red-50/10' : 
            isLowConfidence ? 'border-amber-300 bg-amber-50/10' :
            'border-slate-200 hover:border-slate-900'
          }`}>
            
            <div className="absolute top-4 right-4 z-10">
              <button 
                type="button"
                onClick={() => removeItem(index)}
                className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all active:scale-90"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {isLowConfidence && (
              <div className="absolute -top-2.5 left-4 bg-amber-500 text-white text-[8px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                <AlertTriangle size={10} strokeWidth={3} /> Review required
              </div>
            )}
            
            <div className="space-y-4">
              <div className="pr-8">
                <input 
                  type="text" 
                  value={item.productName || ''}
                  onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                  className={`w-full bg-transparent text-base font-bold text-slate-900 placeholder-slate-200 focus:outline-none transition-colors border-b border-transparent focus:border-slate-900 pb-1 ${
                    itemErrors.productName ? 'text-red-600' : ''
                  }`}
                  placeholder="Product Title"
                />
                {itemErrors.productName && (
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                    <AlertCircle size={10} /> {itemErrors.productName}
                  </p>
                )}
                
                <input 
                  type="text" 
                  value={item.sku || ''}
                  onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                  className="w-full text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest bg-transparent focus:outline-none focus:text-slate-600 placeholder-slate-200 mt-1"
                  placeholder="SKU // ID"
                />
              </div>
              
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-3 bg-slate-50 rounded-xl p-2.5 border border-slate-200 focus-within:border-slate-900 transition-colors">
                  <label className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Qty</label>
                  <input 
                    type="number" 
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent font-mono font-bold text-slate-900 focus:outline-none text-sm"
                  />
                </div>
                
                <div className="col-span-5 bg-slate-50 rounded-xl p-2.5 border border-slate-200 focus-within:border-slate-900 transition-colors">
                  <label className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Unit Price</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono font-bold text-slate-400">{item.currency || 'AED'}</span>
                    <input 
                      type="number" 
                      value={item.unitPrice}
                      step="0.01"
                      onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent font-mono font-bold text-slate-900 focus:outline-none text-sm text-right"
                    />
                  </div>
                </div>

                <div className="col-span-4 flex flex-col justify-center items-end bg-slate-900 rounded-xl px-3 py-2">
                  <span className="text-[8px] text-slate-400 font-mono font-bold uppercase tracking-widest block mb-0.5">Total</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {formatCurrency((item.quantity || 0) * (item.unitPrice || 0), item.currency)}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                 <textarea 
                  rows={1}
                  value={item.notes || ''}
                  onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                  className="w-full text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2.5 focus:bg-white border border-slate-100 focus:border-slate-900 focus:outline-none transition-all placeholder-slate-300 resize-none font-medium"
                  placeholder="Additional specifications..."
                />
              </div>
            </div>
          </div>
        );
      })}

      {isParsing && (
        <>
          <SkeletonItem />
          <SkeletonItem />
        </>
      )}

      {!isParsing && items.length === 0 && (
        <div className={`text-center py-16 border border-dashed rounded-3xl bg-white transition-all ${errors[-1]?.items ? 'border-red-300 bg-red-50/10' : 'border-slate-200'}`}>
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Plus className="text-slate-300" size={20} />
          </div>
          <p className={`${errors[-1]?.items ? 'text-red-500 font-bold' : 'text-slate-400 font-bold'} text-[9px] font-mono uppercase tracking-widest mb-6`}>
            {errors[-1]?.items || 'Buffer Empty'}
          </p>
          <button 
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black active:scale-95 transition-all"
          >
            <Plus size={14} strokeWidth={3} />
            Initialize Entry
          </button>
        </div>
      )}

      {!isParsing && items.length > 0 && (
        <div className="flex gap-2 pt-2">
          <button 
            type="button"
            onClick={clearAll}
            className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 hover:border-red-200 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Trash2 size={14} strokeWidth={2.5} />
            Clear
          </button>
          <button 
            type="button"
            onClick={addItem}
            className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Plus size={14} strokeWidth={3} />
            Add Node
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemsTable;

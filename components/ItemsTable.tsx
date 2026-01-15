
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
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-soft animate-pulse space-y-4">
    <div className="flex justify-between gap-4">
      <div className="h-4 bg-slate-50 rounded-full w-1/2"></div>
      <div className="h-4 bg-slate-50 rounded-full w-1/4"></div>
    </div>
    <div className="flex gap-3">
      <div className="h-12 bg-slate-50 rounded-2xl flex-1"></div>
      <div className="h-12 bg-slate-50 rounded-2xl w-24"></div>
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
          <div key={`${index}-${item.productName}`} className={`bg-white p-6 rounded-[2rem] border transition-all duration-300 shadow-soft group relative ${
            hasError ? 'border-red-200 ring-4 ring-red-50' : 
            isLowConfidence ? 'border-amber-200 ring-4 ring-amber-50' :
            'border-slate-100 hover:border-slate-300 hover:shadow-elevated'
          }`}>
            
            <div className="absolute top-4 right-4 z-10">
              <button 
                type="button"
                onClick={() => removeItem(index)}
                className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all active:scale-90"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {isLowConfidence && (
              <div className="absolute -top-3 left-6 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-amber-500/20 uppercase tracking-widest">
                <AlertTriangle size={10} strokeWidth={3} /> Review required
              </div>
            )}
            
            <div className="space-y-5">
              <div className="pr-8">
                <input 
                  type="text" 
                  value={item.productName || ''}
                  onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                  className={`w-full bg-transparent text-lg font-heading font-extrabold text-slate-900 placeholder-slate-200 focus:outline-none transition-colors border-b-2 border-transparent focus:border-brand-500 pb-1 ${
                    itemErrors.productName ? 'text-red-600' : ''
                  }`}
                  placeholder="Product Title"
                />
                {itemErrors.productName && (
                  <p className="text-[10px] text-red-500 font-black uppercase tracking-wider mt-2 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {itemErrors.productName}
                  </p>
                )}
                
                <input 
                  type="text" 
                  value={item.sku || ''}
                  onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                  className="w-full text-[10px] text-slate-400 font-black uppercase tracking-[0.15em] bg-transparent focus:outline-none focus:text-slate-600 placeholder-slate-200 mt-2"
                  placeholder="Unique SKU (Optional)"
                />
              </div>
              
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4 bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 focus-within:border-brand-200 transition-colors">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Qty</label>
                  <input 
                    type="number" 
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent font-extrabold text-slate-900 focus:outline-none text-base"
                  />
                </div>
                
                <div className="col-span-5 bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 focus-within:border-brand-200 transition-colors">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Unit Price</label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">{item.currency || 'AED'}</span>
                    <input 
                      type="number" 
                      value={item.unitPrice}
                      step="0.01"
                      onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full bg-transparent font-extrabold text-slate-900 focus:outline-none text-base text-right"
                    />
                  </div>
                </div>

                <div className="col-span-3 flex flex-col justify-center items-end bg-brand-50/30 rounded-2xl px-3 py-2 border border-brand-100/30">
                  <span className="text-[9px] text-brand-400 font-black uppercase tracking-widest block mb-1">Total</span>
                  <span className="text-sm font-black text-brand-600 font-heading">
                    {formatCurrency((item.quantity || 0) * (item.unitPrice || 0), item.currency)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                 <textarea 
                  rows={1}
                  value={item.notes || ''}
                  onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                  className="w-full text-xs text-slate-500 bg-slate-50/50 rounded-xl p-3 focus:bg-white border border-transparent focus:border-brand-200 focus:outline-none transition-all placeholder-slate-300 resize-none font-medium"
                  placeholder="Additional notes or specifications..."
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
        <div className={`text-center py-16 border-2 border-dashed rounded-[2.5rem] bg-white transition-all ${errors[-1]?.items ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Plus className="text-slate-300" size={24} />
          </div>
          <p className={`${errors[-1]?.items ? 'text-red-500 font-black' : 'text-slate-400 font-bold'} text-[10px] uppercase tracking-widest mb-6`}>
            {errors[-1]?.items || 'Item list is empty'}
          </p>
          <button 
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:bg-black active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={3} />
            Start Adding
          </button>
        </div>
      )}

      {!isParsing && items.length > 0 && (
        <div className="flex gap-3 pt-2">
          <button 
            type="button"
            onClick={clearAll}
            className="px-6 py-4 bg-white border border-slate-100 rounded-[1.75rem] text-[10px] font-black uppercase tracking-widest text-red-500 shadow-soft hover:bg-red-50 hover:border-red-100 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Trash2 size={16} strokeWidth={2.5} />
            Clear
          </button>
          <button 
            type="button"
            onClick={addItem}
            className="flex-1 py-4 bg-slate-900 text-white rounded-[1.75rem] text-[10px] font-black uppercase tracking-widest shadow-elevated hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Plus size={16} strokeWidth={3} />
            Add Item
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemsTable;

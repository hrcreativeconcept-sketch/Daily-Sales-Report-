import React from 'react';
import { SalesItem } from '../types';
import { Trash2, Plus, AlertCircle, X } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';

interface ItemsTableProps {
  items: SalesItem[];
  onChange: (items: SalesItem[]) => void;
  isParsing?: boolean;
  errors?: Record<number, { [key in keyof SalesItem]?: string } & { items?: string }>;
}

const SkeletonItem = () => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-3">
    <div className="flex justify-between gap-4">
      <div className="h-4 bg-gray-100 rounded w-1/3"></div>
      <div className="h-4 bg-gray-100 rounded w-1/4"></div>
    </div>
    <div className="flex gap-3 pt-2">
      <div className="h-10 bg-gray-50 rounded-xl flex-1"></div>
      <div className="h-10 bg-gray-50 rounded-xl w-20"></div>
    </div>
  </div>
);

const ItemsTable: React.FC<ItemsTableProps> = ({ items, onChange, isParsing = false, errors = {} }) => {
  const handleItemChange = (index: number, field: keyof SalesItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    if (confirm('Remove this item?')) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  const addItem = () => {
    onChange([
      ...items,
      { productName: '', sku: '', quantity: 1, unitPrice: 0, currency: 'AED', notes: '' }
    ]);
  };

  return (
    <div className="space-y-3">
      {/* List Items */}
      {items.map((item, index) => {
        const itemErrors = errors[index] || {};
        const hasError = Object.keys(itemErrors).length > 0;
        
        return (
          <div key={`${index}-${item.productName}`} className={`bg-white p-4 rounded-2xl border transition-all shadow-sm group relative ${hasError ? 'border-red-300 ring-2 ring-red-50' : 'border-gray-100 hover:border-gray-300 hover:shadow-md'}`}>
            
            {/* Elegant Delete Button */}
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                type="button"
                onClick={() => removeItem(index)}
                className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                aria-label="Remove item"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="grid grid-cols-12 gap-x-3 gap-y-3">
              {/* Row 1: Product & SKU */}
              <div className="col-span-12 pr-6">
                <input 
                  type="text" 
                  value={item.productName}
                  maxLength={200}
                  onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                  className={`w-full bg-transparent text-base font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:placeholder-gray-400 transition-colors border-b border-transparent focus:border-brand-500 pb-1 ${
                    itemErrors.productName ? 'border-red-500 text-red-900 placeholder-red-300' : ''
                  }`}
                  placeholder="Item Name"
                />
                {itemErrors.productName && (
                  <p className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {itemErrors.productName}
                  </p>
                )}
                
                {/* SKU - Quiet Input */}
                <input 
                  type="text" 
                  value={item.sku}
                  maxLength={50}
                  onChange={(e) => handleItemChange(index, 'sku', e.target.value)}
                  className="w-full text-xs text-gray-500 font-mono bg-transparent focus:outline-none focus:text-gray-800 placeholder-gray-300 mt-1"
                  placeholder="ADD SKU (OPTIONAL)"
                />
              </div>
              
              {/* Row 2: Qty, Price, Total */}
              <div className="col-span-4 bg-gray-50 rounded-xl px-2 py-1.5 flex flex-col justify-center">
                <label className="text-[9px] font-bold text-gray-400 uppercase text-center mb-0.5">Qty</label>
                <input 
                  type="number" 
                  value={item.quantity}
                  min="1"
                  max="999999"
                  onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                  className={`w-full bg-transparent text-center font-bold text-gray-900 focus:outline-none transition-colors ${itemErrors.quantity ? 'text-red-600' : ''}`}
                />
              </div>
              
              <div className="col-span-5 bg-gray-50 rounded-xl px-3 py-1.5 flex flex-col justify-center">
                <label className="text-[9px] font-bold text-gray-400 uppercase text-right mb-0.5">Price ({item.currency})</label>
                <input 
                  type="number" 
                  value={item.unitPrice}
                  min="0"
                  max="99999999"
                  step="0.01"
                  onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className={`w-full bg-transparent text-right font-bold text-gray-900 focus:outline-none transition-colors ${itemErrors.unitPrice ? 'text-red-600' : ''}`}
                />
              </div>

              <div className="col-span-3 flex flex-col justify-center items-end pr-1">
                <span className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Total</span>
                <span className="text-sm font-extrabold text-brand-600">
                  {formatCurrency(item.quantity * item.unitPrice, item.currency)}
                </span>
              </div>

              {/* Row 3: Notes */}
              <div className="col-span-12 pt-1">
                 <input 
                  type="text" 
                  value={item.notes || ''}
                  maxLength={500}
                  onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                  className="w-full text-xs text-gray-500 border-b border-gray-100 focus:border-brand-500 focus:outline-none py-2 italic bg-transparent placeholder-gray-300 transition-colors"
                  placeholder="Add notes..."
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Skeletons while parsing */}
      {isParsing && (
        <>
          <SkeletonItem />
          <SkeletonItem />
        </>
      )}

      {/* Empty State / Add Button */}
      {!isParsing && items.length === 0 && (
        <div className={`text-center py-12 border-2 border-dashed rounded-2xl bg-gray-50/50 ${errors[-1]?.items ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}>
          <p className={`${errors[-1]?.items ? 'text-red-500 font-bold' : 'text-gray-400'} text-sm mb-4`}>
            {errors[-1]?.items || 'List is empty'}
          </p>
          <button 
            onClick={addItem}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Add First Item
          </button>
        </div>
      )}

      {/* Footer Add Button (only if items exist) */}
      {!isParsing && items.length > 0 && (
        <button 
          onClick={addItem}
          className="w-full py-4 bg-white border border-gray-200 border-dashed rounded-2xl text-sm text-gray-400 font-bold hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600 transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-sm"
        >
          <Plus size={18} />
          Add Item
        </button>
      )}
    </div>
  );
};

export default ItemsTable;
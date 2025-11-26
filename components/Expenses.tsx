import React, { useState, useRef } from 'react';
import { Camera, Upload, PieChart as PieIcon, List, X, Image as ImageIcon } from 'lucide-react';
import { Expense, TranslationDictionary, BaseViewProps } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';
import { parseReceipt } from '../services/geminiService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ExpensesProps extends BaseViewProps {
  expenses: Expense[];
  onAdd: (expense: Expense) => void;
}

const Expenses: React.FC<ExpensesProps> = ({ expenses, onAdd, t, currentLang }) => {
  const [view, setView] = useState<'list' | 'chart'>('chart');
  const [isScanning, setIsScanning] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowScanOptions(false);
    setIsScanning(true);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1]; // remove prefix

      const result = await parseReceipt(base64Data);

      const newExpense: Expense = {
        id: Date.now().toString(),
        amount: result.total,
        merchant: result.merchant,
        category: result.category,
        date: result.date,
        receiptUrl: base64
      };

      onAdd(newExpense);
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
    
    // Clear input so same file can be selected again if needed
    e.target.value = '';
  };

  // Chart Data Preparation
  const chartData = EXPENSE_CATEGORIES.map(cat => ({
    name: cat.split(' ')[0], // Short name
    amount: expenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0)
  })).filter(d => d.amount > 0);

  const COLORS = ['#4e649b', '#647ac0', '#a3b1da', '#d1d9f0', '#f0f4ff', '#888888'];

  return (
    <div className="px-4 pt-16 pb-24 h-full animate-slide-up relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-brand-text">{t['expenses.title']}</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setView('chart')}
            className={`p-2 rounded-lg ${view === 'chart' ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}
          >
            <PieIcon size={20} />
          </button>
          <button 
            onClick={() => setView('list')}
            className={`p-2 rounded-lg ${view === 'list' ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'}`}
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Total Card */}
      <div className="bg-brand-primary text-white p-6 rounded-2xl shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <p className="text-brand-accent opacity-80 text-sm font-medium mb-1">{t['expenses.total_month']}</p>
        <h2 className="text-4xl font-bold">${expenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}</h2>
      </div>

      {/* Scan Button */}
      <div className="mb-8">
        <button 
          onClick={() => setShowScanOptions(true)}
          disabled={isScanning}
          className="w-full py-4 rounded-xl border-2 border-dashed border-brand-secondary text-brand-primary font-semibold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors text-sm"
        >
          {isScanning ? (
             <span className="animate-pulse">{t['expenses.analyzing']}</span>
          ) : (
             <><Camera size={20} /> {t['expenses.scan_receipt']}</>
          )}
        </button>
      </div>

      {view === 'chart' ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm h-64">
          <h3 className="text-gray-800 font-bold mb-4">{t['expenses.breakdown']}</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="space-y-3 pb-10">
          {expenses.map(expense => (
            <div key={expense.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
                  <DollarSignIcon size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{expense.merchant}</p>
                  <p className="text-xs text-gray-400">{expense.category} â€¢ {new Date(expense.date).toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <span className="font-bold text-lg text-gray-800">-${expense.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scan Options Modal */}
      {showScanOptions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800">{t['expenses.scan_receipt']}</h3>
                    <button 
                        onClick={() => setShowScanOptions(false)}
                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="space-y-3">
                    <button 
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full py-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center gap-3 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <Camera size={20} />
                        {t['profile.take_photo']}
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center gap-3 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        <ImageIcon size={20} />
                        {t['profile.choose_library']}
                    </button>
                </div>
                
                <input 
                    type="file" 
                    ref={cameraInputRef} 
                    accept="image/*" 
                    capture="environment"
                    className="hidden" 
                    onChange={handleFileUpload}
                />
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileUpload}
                />
            </div>
        </div>
      )}
    </div>
  );
};

const DollarSignIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
);

export default Expenses;
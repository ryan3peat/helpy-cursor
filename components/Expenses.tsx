
import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  PieChart as PieIcon,
  List,
  X,
  Image as ImageIcon,
  AlertCircle,
  Check,
  Edit,
  Trash2,
} from 'lucide-react';
import { Expense, BaseViewProps } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';
import {
  uploadReceiptImage,
  createReceiptRecord,
  updateReceiptWithOCR,
  linkReceiptToExpense,
  // NEW: delete the receipt row & storage by expense id
  deleteReceiptByExpenseId,
  // Optional alternative: only unlink the receipt from the expense (keep the receipt row)
  // unlinkReceiptFromExpenseByExpenseId,
} from '../services/receiptService';
import { processReceipt, ParsedReceipt } from '../services/visionService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ExpensesProps extends BaseViewProps {
  expenses: Expense[];
  householdId: string;
  onAdd: (expense: Expense) => void;

  /** callbacks for editing/deleting existing expenses in your DB */
  onUpdate?: (expense: Expense) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** Pending receipt data before user confirmation (OCR) */
interface PendingReceipt {
  receiptId: string;
  imageUrl: string;
  thumbnailBase64: string; // For displaying preview
  parsed: ParsedReceipt;
}

const Expenses: React.FC<ExpensesProps> = ({
  expenses,
  householdId,
  onAdd,
  onUpdate,
  onDelete,
  t,
  currentLang,
}) => {
  const [view, setView] = useState<'list' | 'chart'>('chart');
  const [isScanning, setIsScanning] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ---------- OCR CONFIRMATION STATE (existing feature) ----------- */
  const [pendingReceipt, setPendingReceipt] = useState<PendingReceipt | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editMerchant, setEditMerchant] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  /** ---------- EXISTING EXPENSE MODAL (new feature) ----------- */
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [confirmDeleteExisting, setConfirmDeleteExisting] = useState(false);
  const [savingExisting, setSavingExisting] = useState(false);

  // Separate edit fields for existing expense edit
  const [exAmount, setExAmount] = useState<string>('');
  const [exMerchant, setExMerchant] = useState<string>('');
  const [exCategory, setExCategory] = useState<string>('');
  const [exDate, setExDate] = useState<string>('');

  /** ---------- NEW: local copy for optimistic UI ---------- */
  const [localExpenses, setLocalExpenses] = useState<Expense[]>(expenses);

  // Keep local state in sync with parent prop
  useEffect(() => {
    setLocalExpenses(expenses);
  }, [expenses]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  /** Keep existing expense edit form in sync when opening modal */
  useEffect(() => {
    if (!selectedExpense) return;
    setExAmount(selectedExpense.amount.toFixed(2));
    setExMerchant(selectedExpense.merchant || '');
    setExCategory(selectedExpense.category || EXPENSE_CATEGORIES[0]);
    const iso = new Date(selectedExpense.date).toISOString().slice(0, 10);
    setExDate(iso);
  }, [selectedExpense]);

  /** --------------------- Receipt Scanning Flow --------------------- */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowScanOptions(false);
    setIsScanning(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const thumbnailBase64 = base64;
      const base64Data = base64.split(',')[1];
      const fileType = file.type.split('/')[1] ?? 'jpeg';

      const { url, path } = await uploadReceiptImage(householdId, base64Data, fileType);
      const receiptId = await createReceiptRecord(householdId, path, url);
      const parsed = await processReceipt(base64Data);
      await updateReceiptWithOCR(receiptId, parsed);

      setPendingReceipt({ receiptId, imageUrl: url, thumbnailBase64, parsed });
      setEditAmount(parsed.total.toFixed(2));
      setEditMerchant(parsed.merchant);
      setEditCategory(parsed.category);
      setEditDate(parsed.date);
    } catch (err) {
      console.error('Receipt processing failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to process receipt');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingReceipt) return;
    setIsSaving(true);
    try {
      const newExpense: Expense = {
        id: Date.now().toString(),
        amount: parseFloat(editAmount) || 0,
        merchant: editMerchant || 'Unknown',
        category: editCategory || 'Miscellaneous',
        date: editDate || new Date().toISOString().split('T')[0],
        receiptUrl: pendingReceipt.imageUrl,
      };

      // link in DB
      await linkReceiptToExpense(pendingReceipt.receiptId, newExpense.id);

      // add to parent (if it updates its state) and update local for instant UI
      onAdd(newExpense);
      setLocalExpenses((prev) => [...prev, newExpense]);

      setPendingReceipt(null);
    } catch (err) {
      console.error('Failed to save expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelReceipt = () => {
    setPendingReceipt(null);
    setEditAmount('');
    setEditMerchant('');
    setEditCategory('');
    setEditDate('');
  };

  /** --------------------- Existing Expense Modal (NEW) --------------------- */
  function openExistingModal(exp: Expense) {
    setSelectedExpense(exp);
    setIsEditingExisting(false);
    setConfirmDeleteExisting(false);
  }

  function closeExistingModal() {
    setSelectedExpense(null);
    setIsEditingExisting(false);
    setConfirmDeleteExisting(false);
  }

  async function saveExistingEdit() {
    if (!selectedExpense) return;
    setSavingExisting(true);
    try {
      const updated: Expense = {
        ...selectedExpense,
        amount: parseFloat(exAmount) || selectedExpense.amount,
        merchant: exMerchant || selectedExpense.merchant,
        category: exCategory || selectedExpense.category,
        date: exDate || selectedExpense.date,
      };

      if (onUpdate) {
        await onUpdate(updated);
      }

      // Optimistically update local list
      setLocalExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedExpense(updated);
      setIsEditingExisting(false);
    } catch (err) {
      console.error('Failed to update expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setSavingExisting(false);
    }
  }

  async function confirmExistingDelete() {
    if (!selectedExpense) return;
    setSavingExisting(true);
    try {
      // 1) Delete receipt rows & storage in Supabase for this expense
      await deleteReceiptByExpenseId(selectedExpense.id);
      // Or, if you prefer not to delete the receipt, just unlink it:
      // await unlinkReceiptFromExpenseByExpenseId(selectedExpense.id);

      // 2) Call parent to delete the expense record from your expenses table
      if (onDelete) {
        await onDelete(selectedExpense.id);
      }

      // 3) Optimistically update local list & total
      setLocalExpenses((prev) => prev.filter((e) => e.id !== selectedExpense.id));

      // 4) Close the modal
      closeExistingModal();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setSavingExisting(false);
    }
  }

  /** --------------------- Chart Preparation --------------------- */
  const chartData = EXPENSE_CATEGORIES.map((cat) => ({
    name: cat.split(' ')[0],
    amount: localExpenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0),
  })).filter((d) => d.amount > 0);

  const COLORS = ['#4e649b', '#647ac0', '#a3b1da', '#d1d9f0', '#f0f4ff', '#888888'];

  return (
    <div className="px-4 pt-16 pb-24 h-full animate-slide-up relative">
      {/* Header */}
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

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Scan Failed</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Total Card (uses localExpenses) */}
      <div className="bg-brand-primary text-white p-6 rounded-2xl shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <p className="text-brand-accent opacity-80 text-sm font-medium mb-1">{t['expenses.total_month']}</p>
        <h2 className="text-4xl font-bold">
          ${localExpenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}
        </h2>
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
            <>
              <Camera size={20} /> {t['expenses.scan_receipt']}
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {view === 'chart' ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm h-64">
          <h3 className="text-gray-800 font-bold mb-4">{t['expenses.breakdown']}</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'transparent' }} />
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
          {localExpenses.map((expense) => (
            <button
              key={expense.id}
              type="button"
              onClick={() => openExistingModal(expense)}
              className="w-full bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500">
                  <DollarSignIcon size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-800">{expense.merchant}</p>
                  <p className="text-xs text-gray-400">
                    {expense.category} •{' '}
                    {new Date(expense.date).toLocaleDateString(
                      currentLang === 'en' ? 'en-GB' : currentLang,
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </p>
                </div>
              </div>
              <span className="font-bold text-lg text-gray-800">-${expense.amount.toFixed(2)}</span>
            </button>
          ))}
          {localExpenses.length === 0 && <p className="text-sm text-gray-500">No expenses yet.</p>}
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
                <Camera size={20} /> {t['profile.take_photo']}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center gap-3 font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ImageIcon size={20} /> {t['profile.choose_library']}
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

      {/* OCR Confirmation Modal (existing) */}
      {pendingReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Confirm Receipt</h3>
              <button onClick={handleCancelReceipt} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <X size={20} />
              </button>
            </div>

            {/* Receipt Thumbnail */}
            <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
              <img src={pendingReceipt.thumbnailBase64} alt="Receipt" className="w-full h-32 object-cover" />
            </div>

            {/* Editable Fields (OCR) */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Amount (HKD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-brand-primary outline-none text-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Shop Name</label>
                <input
                  type="text"
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  placeholder="Store name"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={handleCancelReceipt}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving || !editAmount}
                className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50"
              >
                {isSaving ? <span className="animate-pulse">Saving...</span> : (<><Check size={18} /> Save</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Expense Modal (NEW) */}
      {selectedExpense && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{selectedExpense.merchant}</h3>
                <p className="text-xs text-gray-500">
                  {selectedExpense.category || 'Uncategorized'} •{' '}
                  {new Date(selectedExpense.date).toLocaleDateString(
                    currentLang === 'en' ? 'en-GB' : currentLang,
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  )}
                </p>
              </div>
              <button
                onClick={closeExistingModal}
                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Receipt Thumbnail */}
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
              {selectedExpense.receiptUrl ? (
                <img src={selectedExpense.receiptUrl} alt="Receipt" className="w-full max-h-64 object-contain bg-gray-50" />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-500">
                  No receipt image
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">Amount</span>
              <span className="font-semibold text-gray-900">
                -${selectedExpense.amount.toFixed(2)}
              </span>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
                onClick={() => {
                  setIsEditingExisting((v) => !v);
                  setConfirmDeleteExisting(false);
                }}
                disabled={savingExisting}
              >
                <Edit size={18} /> {isEditingExisting ? 'Cancel Edit' : 'Edit'}
              </button>

              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
                onClick={() => {
                  setConfirmDeleteExisting((v) => !v);
                  setIsEditingExisting(false);
                }}
                disabled={savingExisting}
              >
                <Trash2 size={18} /> Delete
              </button>
            </div>

            {/* Edit Existing */}
            {isEditingExisting && (
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm text-gray-600">Merchant</span>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={exMerchant}
                      onChange={(e) => setExMerchant(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Category</span>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={exCategory}
                      onChange={(e) => setExCategory(e.target.value)}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Amount</span>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={exAmount}
                      onChange={(e) => setExAmount(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-600">Date</span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      value={exDate}
                      onChange={(e) => setExDate(e.target.value)}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    className="rounded-lg bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
                    onClick={() => setIsEditingExisting(false)}
                    disabled={savingExisting}
                  >
                    Cancel
                  </button>
                  <button
                    className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                    onClick={saveExistingEdit}
                    disabled={savingExisting}
                  >
                    {savingExisting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Delete Existing Confirmation */}
            {confirmDeleteExisting && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete this receipt/expense?
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
                    onClick={confirmExistingDelete}
                    disabled={savingExisting}
                  >
                    {savingExisting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
                    onClick={() => setConfirmDeleteExisting(false)}
                    disabled={savingExisting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DollarSignIcon = ({ size }: { size: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

export default Expenses;

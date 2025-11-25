
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { ShoppingItem, ShoppingCategory, BaseViewProps } from '../types';

interface ShoppingListProps extends BaseViewProps {
  items: ShoppingItem[];
  onAdd: (item: ShoppingItem) => Promise<void>;
  onUpdate: (id: string, data: Partial<ShoppingItem>) => void;
  onDelete: (id: string) => void;
}

const ShoppingList: React.FC<ShoppingListProps> = ({ items, onAdd, onUpdate, onDelete, t }) => {
  const [filter, setFilter] = useState<ShoppingCategory | 'All'>('All');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [optimisticItems, setOptimisticItems] = useState<ShoppingItem[]>([]);

  // Add Item (detailed form) state
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShoppingCategory>(
    filter === 'All' ? ShoppingCategory.SUPERMARKET : filter
  );

  // Quick-add state (single text input)
  const [quickAddName, setQuickAddName] = useState('');

  const [showCompleted, setShowCompleted] = useState(false);

  // Optimistic completion state to eliminate lag
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});

  // Input Refs for focus management
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Stable timestamps for ordering to avoid “jump” when optimistic item is replaced
  const [addTimes, setAddTimes] = useState<Record<string, number>>({});

  const makeKey = (item: ShoppingItem) =>
    `${item.name.trim().toLowerCase()}|${item.category}|${(item.quantity ?? '1').trim()}|${item.completed ? '1' : '0'}`;

  useEffect(() => {
    if (filter !== 'All') {
      setSelectedCategory(filter);
    }
  }, [filter]);

  // Auto-focus when detailed form opens
  useEffect(() => {
    if (isFormVisible && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isFormVisible]);

  // Clean up optimisticCompleted entries once backend-provided items match the override
  useEffect(() => {
    setOptimisticCompleted(prev => {
      const next = { ...prev };
      items.forEach(item => {
        if (next[item.id] !== undefined && next[item.id] === item.completed) {
          delete next[item.id];
        }
      });
      return next;
    });
  }, [items]);

  // --- Helper: Get Translated Label ---
  const getCategoryLabel = (cat: ShoppingCategory | 'All') => {
    if (cat === 'All') return t['filter.all'];
    if (cat === ShoppingCategory.SUPERMARKET) return t['category.supermarket'];
    if (cat === ShoppingCategory.WET_MARKET) return t['category.wet_market'];
    if (cat === ShoppingCategory.OTHERS) return t['category.others'];
    return cat;
  };

  // --- Derived Data (merge items, avoid duplicates, keep stable order, apply optimistic overrides) ---
  const filteredItems = useMemo(() => {
    const realItems = items;

    // Filter out optimistic items that already exist in real list (name+category+qty+completed match)
    const optimisticFiltered = optimisticItems.filter(opt =>
      !realItems.some(real =>
        real.name.trim().toLowerCase() === opt.name.trim().toLowerCase() &&
        real.category === opt.category &&
        (real.quantity ?? '1').trim() === (opt.quantity ?? '1').trim() &&
        real.completed === opt.completed
      )
    );

    // Merge
    const merged = [...realItems, ...optimisticFiltered];

    // Apply optimistic completion overrides
    const withOverrides = merged.map(item => ({
      ...item,
      completed: optimisticCompleted[item.id] ?? item.completed,
    }));

    // Apply category filter
    let filtered = withOverrides;
    if (filter !== 'All') {
      filtered = withOverrides.filter(i => i.category === filter);
    }

    // Remove items being deleted (optimistic delete)
    const validItems = filtered.filter(i => !deletingIds.has(i.id));

    // Sort: newest first by a stable time
    const getTime = (item: ShoppingItem) => {
      if (item.id.startsWith('temp-')) {
        // Use timestamp embedded in temp id
        return parseInt(item.id.replace('temp-', ''), 10);
      }
      // Use stored addTimes if this item was just added (matches identity)
      const key = makeKey(item);
      return addTimes[key] ?? 0;
    };

    return validItems.sort((a, b) => getTime(b) - getTime(a)); // Descending order (newest first)
  }, [items, optimisticItems, filter, deletingIds, addTimes, optimisticCompleted]);

  const activeItems = filteredItems.filter(i => !i.completed);
  const completedItems = filteredItems.filter(i => i.completed);

  // Generate Suggestions
  const suggestions = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeNames = new Set(items.filter(i => !i.completed).map(i => i.name.toLowerCase()));
    items.forEach(item => {
      const lowerName = item.name.toLowerCase();
      if (!activeNames.has(lowerName)) {
        counts[item.name] = (counts[item.name] ?? 0) + 1;
      }
    });

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);
  }, [items]);

  // --- Handlers ---
  const resetForm = () => {
    setNewItemName('');
    setNewItemAmount('');
    setNewItemUnit('');
    setSelectedCategory(filter === 'All' ? ShoppingCategory.SUPERMARKET : filter);
  };

  const addOptimisticAndTrack = (newItem: ShoppingItem) => {
    const ts = Date.now();
    setAddTimes(prev => ({ ...prev, [makeKey(newItem)]: ts }));
    setOptimisticItems(prev => [...prev, newItem]);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    const qtyString = newItemAmount ? `${newItemAmount} ${newItemUnit}`.trim() : '1';
    const newItem: ShoppingItem = {
      id: `temp-${Date.now()}`, // Temporary ID for optimistic update
      name: newItemName,
      category: selectedCategory,
      quantity: qtyString,
      completed: false,
    };

    // Optimistic add + stable order
    addOptimisticAndTrack(newItem);

    // Collapse form and clear inputs
    setIsFormVisible(false);
    resetForm();

    // Sync with backend (do NOT remove optimistic on success; dedupe logic will handle replacement)
    try {
      await onAdd(newItem);
    } catch (error) {
      // Rollback optimistic item on failure
      setOptimisticItems(prev => prev.filter(item => item.id !== newItem.id));
      console.error('❌ Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    }
  };

  const handleSuggestionClick = async (suggestionName: string) => {
    const newItem: ShoppingItem = {
      id: `temp-${Date.now()}`, // Temporary ID
      name: suggestionName,
      category: filter === 'All' ? ShoppingCategory.SUPERMARKET : filter,
      quantity: '1',
      completed: false,
    };

    addOptimisticAndTrack(newItem);

    try {
      await onAdd(newItem);
    } catch (error) {
      setOptimisticItems(prev => prev.filter(item => item.id !== newItem.id));
      console.error('❌ Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    }
  };

  const handleQuickAddSubmit = async () => {
    const name = quickAddName.trim();
    if (!name) return;

    const newItem: ShoppingItem = {
      id: `temp-${Date.now()}`,
      name,
      category: filter === 'All' ? ShoppingCategory.SUPERMARKET : filter,
      quantity: '1',
      completed: false,
    };

    addOptimisticAndTrack(newItem);
    setQuickAddName(''); // clear the quick add box

    try {
      await onAdd(newItem);
    } catch (error) {
      setOptimisticItems(prev => prev.filter(item => item.id !== newItem.id));
      console.error('❌ Failed to add item:', error);
      alert('Failed to add item. Please try again.');
    }
  };

  // Optimistic toggle complete (eliminate lag)
  const handleCompleteToggle = async (id: string, completed: boolean) => {
    // Apply optimistic override
    setOptimisticCompleted(prev => ({ ...prev, [id]: completed }));

    try {
      await onUpdate(id, { completed });
      // Success will be reflected by parent items; cleanup happens in useEffect(items)
    } catch (error) {
      // Roll back on failure
      setOptimisticCompleted(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      console.error('❌ Failed to update item:', error);
      alert('Failed to update item. Please try again.');
    }
  };

  const handleClearCompleted = async () => {
    if (!window.confirm(t['common.confirm_clear'])) return;

    const idsToDelete = completedItems.map(item => item.id);

    setDeletingIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.add(id));
      return next;
    });

    const deletePromises = completedItems.map(item =>
      onDelete(item.id).catch(error => {
        console.error(`Failed to delete ${item.name}:`, error);
        return item.id;
      })
    );

    try {
      const results = await Promise.allSettled(deletePromises);
      const failedIds = results
        .map((result, index) =>
          result.status === 'rejected' ? completedItems[index].id : null
        )
        .filter(Boolean) as string[];

      if (failedIds.length > 0) {
        setDeletingIds(prev => {
          const next = new Set(prev);
          failedIds.forEach(id => next.delete(id));
          return next;
        });
        alert(`Failed to delete ${failedIds.length} item(s). Please try again.`);
      }
    } catch (error) {
      setDeletingIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
      console.error('Clear all failed:', error);
      alert('Failed to clear items. Please try again.');
    }
  };

  const getCategoryColor = (cat: ShoppingCategory) => {
    switch (cat) {
      case ShoppingCategory.SUPERMARKET:
        return 'text-blue-500 bg-blue-50 border-blue-200';
      case ShoppingCategory.WET_MARKET:
        return 'text-green-600 bg-green-50 border-green-200';
      case ShoppingCategory.OTHERS:
        return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  // Get left border color for item rows
  const getCategoryBorderColor = (cat: ShoppingCategory) => {
    switch (cat) {
      case ShoppingCategory.SUPERMARKET:
        return 'border-l-blue-500';
      case ShoppingCategory.WET_MARKET:
        return 'border-l-green-500';
      case ShoppingCategory.OTHERS:
        return 'border-l-gray-400';
    }
  };

  const getUncheckedCount = (cat: ShoppingCategory | 'All') => {
    if (cat === 'All') return items.filter(i => !i.completed).length;
    return items.filter(i => !i.completed && i.category === cat).length;
  };

  // Touch tracking for swipe right to complete (mobile)
  const touchStart = useRef<Record<string, { x: number; y: number }>>({});

  const onItemTouchStart = (id: string, e: React.TouchEvent<HTMLDivElement>) => {
    const t0 = e.touches[0];
    touchStart.current[id] = { x: t0.clientX, y: t0.clientY };
  };

  const onItemTouchEnd = (id: string, e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current[id];
    if (!start) return;
    const t1 = e.changedTouches[0];
    const dx = t1.clientX - start.x;
    const dy = t1.clientY - start.y;
    // Simple right-swipe detection: horizontal movement large, vertical small
    if (dx > 60 && Math.abs(dy) < 30) {
      handleCompleteToggle(id, true);
    }
    delete touchStart.current[id];
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-slide-up relative">
      {/* Header & Filters */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm pt-16 pb-2 px-4 border-b border-gray-200/50">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-brand-text">{t['shopping.title']}</h1>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {(['All', ...Object.values(ShoppingCategory)] as const).map(cat => {
            const count = getUncheckedCount(cat);
            const isSelected = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-brand-primary text-white border-brand-primary shadow-md font-medium'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 font-normal'
                }`}
              >
                <span>{getCategoryLabel(cat)}</span>
                <span className={`font-bold ${isSelected ? 'text-white/90' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slim Quick-Add box (kept) */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t['shopping.quick_add_single'] ?? 'Quick add item…'}
            value={quickAddName}
            onChange={(e) => setQuickAddName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAddSubmit()}
            className="flex-1 h-9 bg-white border border-gray-300 rounded-full px-3 text-sm outline-none focus:border-brand-primary transition-colors"
          />
          <button
            title={t['shopping.open_detailed_form'] ?? 'Open detailed form'}
            onClick={() => setIsFormVisible(true)}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-brand-primary text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Collapsible Add Form (detailed) */}
      {isFormVisible && (
        <div className="sticky top-[168px] z-30 px-4 pt-4 bg-gray-50 animate-slide-up">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Circle size={22} className="text-gray-300 shrink-0" />
              <input
                ref={nameInputRef}
                type="text"
                placeholder={t['shopping.item_name']}
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                className="bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 outline-none flex-1 w-full"
              />
              {/* Submit (tick) */}
              <button
                onClick={handleAddItem}
                className="p-1.5 rounded-full bg-brand-primary text-white shadow-sm hover:bg-brand-secondary transition-colors"
                title={t['shopping.add_item'] ?? 'Add item'}
              >
                <Check size={18} />
              </button>
              {/* Close (minimise) */}
              <button
                onClick={() => setIsFormVisible(false)}
                className="p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title={t['common.close'] ?? 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            <div className="pl-9 space-y-4">
              {/* Inputs Row */}
              <div className="flex gap-3">
                <input
                  type="number"
                  placeholder="1"
                  value={newItemAmount}
                  onChange={e => setNewItemAmount(e.target.value)}
                  className="w-24 bg-gray-50 rounded-lg border border-gray-200 p-2 text-center text-sm outline-none focus:border-brand-primary transition-colors"
                />
                <input
                  type="text"
                  placeholder={t['shopping.unit_placeholder']}
                  value={newItemUnit}
                  onChange={e => setNewItemUnit(e.target.value)}
                  className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-2 px-3 text-sm outline-none focus:border-brand-primary transition-colors"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2">
                {Object.values(ShoppingCategory).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedCategory === cat
                        ? getCategoryColor(cat) + ' ring-1 ring-offset-1 ring-gray-200'
                        : 'bg-white text-gray-500 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="pt-2 border-t border-gray-200/50">
                  <p className="text-sm font-bold text-gray-400 mb-2">{t['shopping.quick_add']}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="px-2 py-1 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-colors"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        {/* Active Items Group */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {activeItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-4 transition-colors hover:bg-gray-50 border-l-4 ${getCategoryBorderColor(item.category)} ${
                index !== activeItems.length - 1 ? 'border-b border-gray-100' : ''
              }`}
              onTouchStart={(e) => onItemTouchStart(item.id, e)}
              onTouchEnd={(e) => onItemTouchEnd(item.id, e)}
            >
              <button
                onClick={() => handleCompleteToggle(item.id, true)}
                className="text-gray-300 hover:text-brand-primary transition-colors shrink-0"
              >
                <Circle size={22} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800 text-sm leading-tight">{item.name}</span>
                  {item.quantity && item.quantity !== '1' && (
                    <span className="text-sm font-medium text-gray-400 ml-2 shrink-0">{item.quantity}</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty State in Active List */}
          {activeItems.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <p className="text-sm">{t['shopping.no_items']}</p>
            </div>
          )}
        </div>

        {/* Completed Section */}
        {completedItems.length > 0 && (
          <div className="mt-6">
            <div
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center justify-between mb-2 px-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {showCompleted ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
                <h3 className="text-sm font-bold text-gray-500">
                  {t['shopping.completed']} ({completedItems.length})
                </h3>
              </div>

              {showCompleted && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearCompleted(); }}
                  className="text-red-400 text-sm font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  {t['shopping.clear_all']}
                </button>
              )}
            </div>

            {showCompleted && (
              <div className="bg-gray-100/50 rounded-2xl overflow-hidden border border-gray-200/50">
                {completedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-4 border-l-4 ${getCategoryBorderColor(item.category)} ${
                      index !== completedItems.length - 1 ? 'border-b border-gray-200/50' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleCompleteToggle(item.id, false)}
                      className="text-green-500 shrink-0"
                    >
                      <CheckCircle2 size={22} />
                    </button>

                    <div className="flex-1 opacity-50 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700 line-through text-sm">{item.name}</span>
                        {item.quantity && item.quantity !== '1' && (
                          <span className="text-sm text-gray-500 ml-2 shrink-0">{item.quantity}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        setDeletingIds(prev => new Set(prev).add(item.id));
                        try {
                          await onDelete(item.id);
                        } catch (error) {
                          setDeletingIds(prev => {
                            const next = new Set(prev);
                            next.delete(item.id);
                            return next;
                          });
                          console.error('Delete failed:', error);
                          alert('Failed to delete item. Please try again.');
                        }
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShoppingList;

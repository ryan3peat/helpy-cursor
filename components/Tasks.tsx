
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Circle, CheckCircle2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Database } from '../src/types/supabase';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TasksProps {
  tasks: Task[];
  onAdd: (task: Partial<Task>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const categoryColors: Record<string, string> = {
  Cleaning: 'border-l-green-500',
  Repair: 'border-l-yellow-500',
  'Pick-ups': 'border-l-blue-500',
  Cooking: 'border-l-red-500',
  Other: 'border-l-gray-400',
};

const Tasks: React.FC<TasksProps> = ({ tasks, onAdd, onUpdate, onDelete }) => {
  const [filter, setFilter] = useState<'All' | keyof typeof categoryColors>('All');
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [isFormVisible, setIsFormVisible] = useState(false);

  // Detailed form state
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof categoryColors>('Other');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState('None');

  // Optimistic state
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});
  const [addTimes, setAddTimes] = useState<Record<string, number>>({});

  const makeKey = (task: Task) =>
    `${task.title.trim().toLowerCase()}${task.category}${task.due_date}${task.completed ? '1' : '0'}`;

  const mergedTasks = useMemo(() => {
    const realTasks = tasks.map((t) => ({
      ...t,
      completed: optimisticCompleted[t.id] ?? t.completed,
    }));
    const optimisticFiltered = optimisticTasks.filter(
      (opt) =>
        !realTasks.some(
          (real) =>
            real.title.trim().toLowerCase() === opt.title.trim().toLowerCase() &&
            real.category === opt.category &&
            real.due_date === opt.due_date &&
            real.completed === opt.completed
        )
    );
    const merged = [...realTasks, ...optimisticFiltered];
    return merged.sort((a, b) => (addTimes[makeKey(b)] ?? 0) - (addTimes[makeKey(a)] ?? 0));
  }, [tasks, optimisticTasks, optimisticCompleted, addTimes]);

  const activeTasks = mergedTasks.filter((t) => !t.completed && (filter === 'All' || t.category === filter));
  const completedTasks = mergedTasks.filter((t) => t.completed && (filter === 'All' || t.category === filter));

  const handleQuickAdd = async () => {
    const name = quickAddTitle.trim();
    if (!name) return;
    const today = new Date().toISOString().split('T')[0];
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      household_id: '',
      title: name,
      category: filter === 'All' ? 'Other' : filter,
      due_date: today,
      due_time: null,
      completed: false,
      assignees: null,
      recurrence: null,
      created_at: new Date().toISOString(),
    };
    const ts = Date.now();
    setAddTimes((prev) => ({ ...prev, [makeKey(newTask)]: ts }));
    setOptimisticTasks((prev) => [...prev, newTask]);
    setQuickAddTitle('');
    try {
      await onAdd({
        title: name,
        category: newTask.category,
        due_date: today,
        completed: false,
      });
    } catch (err) {
      console.error('Failed to add task:', err);
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== newTask.id));
    }
  };

  const handleAddDetailed = async () => {
    if (!title.trim() || !dueDate) return;
    const newTask: Task = {
      id: `temp-${Date.now()}`,
      household_id: '',
      title,
      category: selectedCategory,
      due_date: dueDate,
      due_time: dueTime || null,
      completed: false,
      assignees: null,
      recurrence: recurrence === 'None' ? null : { type: recurrence.toLowerCase() },
      created_at: new Date().toISOString(),
    };
    const ts = Date.now();
    setAddTimes((prev) => ({ ...prev, [makeKey(newTask)]: ts }));
    setOptimisticTasks((prev) => [...prev, newTask]);
    setIsFormVisible(false);
    resetForm();
    try {
      await onAdd({
        title,
        category: selectedCategory,
        due_date: dueDate,
        due_time: dueTime || null,
        completed: false,
        recurrence: recurrence === 'None' ? null : { type: recurrence.toLowerCase() },
      });
    } catch (err) {
      console.error('Failed to add task:', err);
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== newTask.id));
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    setOptimisticCompleted((prev) => ({ ...prev, [id]: completed }));
    try {
      await onUpdate(id, { completed });
    } catch (err) {
      console.error('Failed to update task:', err);
      setOptimisticCompleted((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setOptimisticTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await onDelete(id);
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedCategory('Other');
    setDueDate('');
    setDueTime('');
    setRecurrence('None');
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* Header & Filters */}
      <div className="sticky top-0 z-10 bg-gray-50 pt-16 pb-2 px-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold mb-4">Tasks</h1>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(['All', ...Object.keys(categoryColors)] as const).map((cat) => {
            const count =
              cat === 'All'
                ? mergedTasks.filter((t) => !t.completed).length
                : mergedTasks.filter((t) => !t.completed && t.category === cat).length;
            const isSelected = filter === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span>{cat}</span>
                <span className={`ml-2 font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Add */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Quick add task..."
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
            className="flex-1 h-9 bg-white border border-gray-300 rounded-full px-3 text-sm outline-none focus:border-blue-600"
          />
          <button
            onClick={() => setIsFormVisible(true)}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:scale-105"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Detailed Form */}
      {isFormVisible && (
        <div className="sticky top-[168px] z-30 px-4 pt-4 bg-gray-50">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <input
              type="text"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mb-3 border rounded px-3 py-2"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as keyof typeof categoryColors)}
              className="w-full mb-3 border rounded px-3 py-2"
            >
              {Object.keys(categoryColors).map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mb-3 border rounded px-3 py-2"
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full mb-3 border rounded px-3 py-2"
            />
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full mb-3 border rounded px-3 py-2"
            >
              <option>None</option>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsFormVisible(false)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button onClick={handleAddDetailed} className="px-4 py-2 bg-blue-600 text-white rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        {/* Active Tasks */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {activeTasks.map((task, index) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-4 hover:bg-gray-50 border-l-4 ${
                categoryColors[task.category] || categoryColors['Other']
              } ${index !== activeTasks.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <button
                onClick={() => handleToggleComplete(task.id, true)}
                className="text-gray-300 hover:text-blue-600 transition-colors"
              >
                <Circle size={22} />
              </button>
              <div className="flex-1">
                <span className="font-medium text-gray-800 text-sm">{task.title}</span>
                <p className="text-xs text-gray-500">
                  Due: {task.due_date}
                  {task.due_time ? ` at ${task.due_time}` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {activeTasks.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <p className="text-sm">No tasks yet.</p>
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <div>
            <div
              onClick={() => setIsFormVisible(!isFormVisible)}
              className="flex items-center justify-between mb-2 px-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {isFormVisible ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <h3 className="text-sm font-bold text-gray-500">Completed ({completedTasks.length})</h3>
              </div>
            </div>
            <div className="bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
              {completedTasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 p-4 border-l-4 ${
                    categoryColors[task.category] || categoryColors['Other']
                  } ${index !== completedTasks.length - 1 ? 'border-b border-gray-200' : ''}`}
                >
                  <button
                    onClick={() => handleToggleComplete(task.id, false)}
                    className="text-green-500"
                  >
                    <CheckCircle2 size={22} />
                  </button>
                  <div className="flex-1 opacity-50">
                    <span className="font-medium text-gray-700 line-through text-sm">{task.title}</span>
                  </div>
                  <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;

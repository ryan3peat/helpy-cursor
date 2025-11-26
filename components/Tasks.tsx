
import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Database } from '../src/types/supabase';

type Task = Database['public']['Tables']['tasks']['Row'];

interface TasksProps {
  tasks: Task[];
  onAdd: (task: Partial<Task>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const categoryColors: Record<string, string> = {
  Cleaning: 'bg-green-100 text-green-800',
  Repair: 'bg-yellow-100 text-yellow-800',
  'Pick-ups': 'bg-blue-100 text-blue-800',
  Cooking: 'bg-red-100 text-red-800',
  Other: 'bg-gray-100 text-gray-800',
};

const Tasks: React.FC<TasksProps> = ({ tasks, onAdd, onUpdate, onDelete }) => {
  const [quickTitle, setQuickTitle] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState('None');

  // Optimistic UI
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<Record<string, boolean>>({});

  const mergedTasks = useMemo(() => {
    const realTasks = tasks.map((t) => ({
      ...t,
      completed: optimisticCompleted[t.id] ?? t.completed,
    }));
    return [...optimisticTasks, ...realTasks];
  }, [tasks, optimisticTasks, optimisticCompleted]);

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    const tempTask: Task = {
      id: `temp-${Date.now()}`,
      household_id: '',
      title: quickTitle,
      category: 'Other',
      due_date: today,
      due_time: null,
      completed: false,
      assignees: null,
      recurrence: null,
      created_at: new Date().toISOString(),
    };
    setOptimisticTasks((prev) => [...prev, tempTask]);
    setQuickTitle('');
    try {
      await onAdd({
        title: quickTitle,
        category: 'Other',
        due_date: today,
        completed: false,
      });
    } catch (err) {
      console.error('Failed to add task:', err);
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempTask.id));
    }
  };

  const handleAddDetailed = async () => {
    if (!title.trim() || !dueDate) return;
    const tempTask: Task = {
      id: `temp-${Date.now()}`,
      household_id: '',
      title,
      category,
      due_date: dueDate,
      due_time: dueTime || null,
      completed: false,
      assignees: null,
      recurrence: recurrence === 'None' ? null : { type: recurrence.toLowerCase() },
      created_at: new Date().toISOString(),
    };
    setOptimisticTasks((prev) => [...prev, tempTask]);
    setIsModalOpen(false);
    resetModal();
    try {
      await onAdd({
        title,
        category,
        due_date: dueDate,
        due_time: dueTime || null,
        completed: false,
        recurrence: recurrence === 'None' ? null : { type: recurrence.toLowerCase() },
      });
    } catch (err) {
      console.error('Failed to add task:', err);
      setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempTask.id));
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

  const resetModal = () => {
    setTitle('');
    setCategory('Other');
    setDueDate('');
    setDueTime('');
    setRecurrence('None');
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Tasks</h2>

      {/* Quick Add */}
      <div className="flex mb-4">
        <input
          type="text"
          placeholder="Quick add task..."
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          className="flex-1 border rounded px-3 py-2 mr-2"
        />
        <button
          onClick={handleQuickAdd}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
      </div>

      {/* Task List */}
      <ul className="space-y-2">
        {mergedTasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between border rounded p-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => handleToggleComplete(task.id, e.target.checked)}
              />
              <div>
                <p className={`font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>
                  {task.title}
                </p>
                <p className="text-sm text-gray-500">
                  Due: {task.due_date}
                  {task.due_time ? ` at ${task.due_time}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  categoryColors[task.category] || categoryColors['Other']
                }`}
              >
                {task.category}
              </span>
              <button onClick={() => handleDelete(task.id)} className="text-red-500 hover:text-red-700">
                <Trash2 size={18} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Floating Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg"
      >
        <Plus size={20} />
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">Add Task</h3>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            >
              {Object.keys(categoryColors).map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            />
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-3"
            >
              <option>None</option>
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button onClick={handleAddDetailed} className="px-4 py-2 bg-blue-600 text-white rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
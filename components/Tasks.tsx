
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, X, Check, Calendar, Clock, Repeat, Trash2, RotateCcw } from 'lucide-react';
import { Task, User, RecurrenceRule, RecurrenceFrequency, BaseViewProps } from '../types';

interface TasksProps extends BaseViewProps {
  tasks: Task[];
  users: User[];
  onAdd: (task: Task) => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

type FilterType = 'All' | 'Today' | 'Overdue' | 'Later';

const Tasks: React.FC<TasksProps> = ({ tasks, users, onAdd, onUpdate, onDelete, t, currentLang }) => {
  const [filter, setFilter] = useState<FilterType>('All');
  const [isAdding, setIsAdding] = useState(false);

  // --- Add Task State ---
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>(''); 
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  // --- Recurrence State ---
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  // Form defaults
  const [recFreq, setRecFreq] = useState<RecurrenceFrequency>('WEEKLY');
  const [recInterval, setRecInterval] = useState(1);
  const [recWeekDays, setRecWeekDays] = useState<number[]>([]); // 0=Sun
  const [recEndType, setRecEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [recEndDate, setRecEndDate] = useState<string>('');
  const [recEndCount, setRecEndCount] = useState<number>(13);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isAdding]);

  // Initialize Weekdays based on selected date if empty when enabling weekly
  useEffect(() => {
    if (recurrenceEnabled && recFreq === 'WEEKLY' && recWeekDays.length === 0 && selectedDate) {
      const day = new Date(selectedDate).getDay();
      setRecWeekDays([day]);
    }
  }, [recurrenceEnabled, recFreq, selectedDate]);

  // --- Helpers ---
  const getFilterLabel = (f: FilterType) => {
     switch(f) {
       case 'All': return t['filter.all'];
       case 'Today': return t['filter.today'];
       case 'Overdue': return t['filter.overdue'];
       case 'Later': return t['filter.later'];
       default: return f;
     }
  };

  const getEmptyStateMessage = (f: FilterType) => {
     switch(f) {
       case 'Today': return t['tasks.no_tasks_today'];
       case 'Overdue': return t['tasks.no_tasks_overdue'];
       case 'Later': return t['tasks.no_tasks_later'];
       default: return t['tasks.no_tasks_all'];
     }
  };

  const isTaskDueOnDate = (task: Task, targetDateStr: string): boolean => {
    if (!task.recurrence) {
      return task.dueDate === targetDateStr;
    }

    const start = new Date(task.dueDate);
    const target = new Date(targetDateStr);
    // Normalize times to midnight for comparison
    start.setHours(0,0,0,0);
    target.setHours(0,0,0,0);

    if (target < start) return false;

    // Check End Condition
    const { endCondition, endDate } = task.recurrence;
    if (endCondition === 'ON_DATE' && endDate) {
       if (target > new Date(endDate)) return false;
    }

    // Calculate difference in days
    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const { frequency, interval, weekDays } = task.recurrence;

    if (frequency === 'DAILY') {
      return diffDays % interval === 0;
    }

    if (frequency === 'WEEKLY') {
      const weeksPassed = Math.floor(diffDays / 7);
      if (weeksPassed % interval !== 0) return false;
      return (weekDays || []).includes(target.getDay());
    }

    if (frequency === 'MONTHLY') {
      if (target.getDate() !== start.getDate()) return false;
      const monthDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
      return monthDiff % interval === 0;
    }

    if (frequency === 'YEARLY') {
        return target.getMonth() === start.getMonth() && target.getDate() === start.getDate() && 
               (target.getFullYear() - start.getFullYear()) % interval === 0;
    }

    return false;
  };

  // --- Filter Logic ---
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.completed) return false;
      
      const taskDateStr = task.dueDate; // Start date

      switch (filter) {
        case 'Today':
          return isTaskDueOnDate(task, todayStr);
        case 'Overdue':
          return !task.recurrence && taskDateStr < todayStr;
        case 'Later':
          return taskDateStr > todayStr;
        case 'All':
        default:
          return true;
      }
    });
  }, [tasks, filter, todayStr]);

  const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);
  const [showCompleted, setShowCompleted] = useState(false);

  // --- Handlers ---

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;

    let recurrenceRule: RecurrenceRule | undefined = undefined;
    if (recurrenceEnabled) {
        recurrenceRule = {
            frequency: recFreq,
            interval: recInterval,
            weekDays: recFreq === 'WEEKLY' ? recWeekDays : undefined,
            endCondition: recEndType,
            endDate: recEndType === 'ON_DATE' ? recEndDate : undefined,
            endCount: recEndType === 'AFTER_OCCURRENCES' ? recEndCount : undefined
        };
    }
    
    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      assignees: assignedUserIds,
      dueDate: selectedDate,
      dueTime: selectedTime,
      completed: false,
      recurrence: recurrenceRule
    };

    onAdd(newTask);
    resetForm();
  };

  const resetForm = () => {
    setNewTaskTitle('');
    setSelectedDate(todayStr);
    setSelectedTime('');
    setAssignedUserIds([]);
    setRecurrenceEnabled(false);
    setShowRecurrenceOptions(false);
    // Reset recur defaults
    setRecFreq('WEEKLY');
    setRecInterval(1);
    setRecWeekDays([]);
    setRecEndType('NEVER');
    setRecEndDate('');
    setIsAdding(false);
  };

  const toggleAssignee = (uid: string) => {
    setAssignedUserIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const formatRecurrenceText = (task: Task) => {
    if (!task.recurrence) return t['tasks.once'];
    const { frequency, interval, weekDays } = task.recurrence;
    
    // Use translated frequency text
    const freqKey = `tasks.${frequency.toLowerCase()}`;
    const freqLabel = t[freqKey] || frequency; // Fallback if missing
    
    const intervalStr = interval > 1 
        ? `${t['tasks.repeat_every']} ${interval} ${freqLabel}` 
        : freqLabel;
    
    if (frequency === 'WEEKLY' && weekDays) {
        const dayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
        // @ts-ignore
        const dayStr = weekDays.map(d => t[`day.short.${dayKeys[d]}`] || dayKeys[d]).join(', ');
        return `${intervalStr} ${t['tasks.on']} ${dayStr}`;
    }
    return intervalStr;
  };

  const dayLetters = [
      t['day.letter.sun'], t['day.letter.mon'], t['day.letter.tue'], t['day.letter.wed'], 
      t['day.letter.thu'], t['day.letter.fri'], t['day.letter.sat']
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 animate-slide-up relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm pt-16 pb-2 px-4 border-b border-gray-200/50">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-brand-text">{t['tasks.title']}</h1>
        </div>
        
        {/* Filter Pills */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {(['All', 'Today', 'Overdue', 'Later'] as const).map(tab => {
            const isSelected = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-5 py-2 rounded-full text-sm transition-all whitespace-nowrap flex items-center gap-2 border ${
                  isSelected 
                    ? 'bg-brand-primary text-white border-brand-primary shadow-md font-medium' 
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 font-normal'
                }`}
              >
                <span>{getFilterLabel(tab)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-6">
        
        {/* Active Tasks */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {filteredTasks.map((task, index) => {
             const assignedUsers = users.filter(u => task.assignees?.includes(u.id));
             const assignedNames = assignedUsers.map(u => u.name.split(' ')[0]).join(', ');

             return (
                <div 
                  key={task.id}
                  className={`flex items-start gap-3 p-4 transition-colors hover:bg-gray-50 ${index !== filteredTasks.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <button 
                    onClick={() => onUpdate(task.id, { completed: true })}
                    className="mt-0.5 text-gray-300 hover:text-brand-primary transition-colors"
                  >
                    <Circle size={22} />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-gray-800 text-sm leading-tight">{task.title}</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                        {/* Assignee Text */}
                        {assignedNames && (
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {assignedNames}
                            </span>
                        )}

                        {/* Date Badge */}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={12} />
                            <span>{new Date(task.dueDate).toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, { day: 'numeric', month: 'short' })}</span>
                            {task.dueTime && <span>• {task.dueTime}</span>}
                        </div>

                        {/* Recurrence Badge */}
                        {task.recurrence && (
                            <div className="flex items-center gap-1 text-xs text-brand-primary bg-blue-50 px-1.5 py-0.5 rounded">
                                <Repeat size={10} />
                                <span>{formatRecurrenceText(task)}</span>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
             );
          })}

          {/* Empty State */}
          {filteredTasks.length === 0 && !isAdding && (
             <div className="p-8 text-center text-gray-400">
                <p className="text-sm">{getEmptyStateMessage(filter)}</p>
             </div>
          )}

          {/* Inline Add Form */}
          {isAdding ? (
            <div className="p-4 bg-gray-50/50 border-t border-gray-100 animate-fade-in">
              
              {/* Header: Input + Actions */}
              <div className="flex items-center gap-3 mb-4">
                <Circle size={22} className="text-gray-300 shrink-0" />
                <input 
                  ref={nameInputRef}
                  type="text"
                  placeholder={t['tasks.task_name']}
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="bg-transparent text-sm font-medium text-gray-800 placeholder-gray-400 outline-none flex-1 w-full"
                />
                
                {/* Action Buttons */}
                <div className="flex items-center gap-3 ml-2">
                  <button 
                    onClick={resetForm} 
                    className="p-1.5 rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <button 
                    onClick={handleAddTask} 
                    className="p-1.5 rounded-full bg-brand-primary text-white shadow-sm hover:bg-brand-secondary transition-colors"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>

              <div className="pl-9 space-y-5">
                
                {/* Row 1: Date & Time */}
                <div className="flex gap-3">
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 gap-2 focus-within:border-brand-primary transition-colors">
                        <Calendar size={16} className="text-gray-400" />
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full text-sm text-gray-600 outline-none bg-transparent"
                        />
                    </div>
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 gap-2 focus-within:border-brand-primary transition-colors">
                        <Clock size={16} className="text-gray-400" />
                        <input 
                            type="time" 
                            value={selectedTime}
                            onChange={e => setSelectedTime(e.target.value)}
                            className="w-full text-sm text-gray-600 outline-none bg-transparent"
                        />
                    </div>
                </div>

                {/* Row 2: Assignees (Checkbox List) */}
                <div>
                    <label className="text-xs font-bold text-gray-400 mb-2 block">{t['tasks.assignees']}</label>
                    <div className="space-y-2">
                        {users.map(user => {
                             const isSelected = assignedUserIds.includes(user.id);
                             return (
                                <div 
                                    key={user.id}
                                    onClick={() => toggleAssignee(user.id)}
                                    className="flex items-center gap-3 cursor-pointer group"
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-brand-primary border-brand-primary' : 'bg-white border-gray-300 group-hover:border-brand-primary'}`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className={`text-sm ${isSelected ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                                        {user.name}
                                    </span>
                                </div>
                             )
                        })}
                    </div>
                </div>

                {/* Row 3: Recurrence (Custom) */}
                <div className="pt-2 border-t border-gray-200/50">
                     <div 
                        className="flex items-center justify-between cursor-pointer mb-2"
                        onClick={() => {
                            if (!recurrenceEnabled) {
                                setRecurrenceEnabled(true);
                                setShowRecurrenceOptions(true);
                            } else {
                                setShowRecurrenceOptions(!showRecurrenceOptions);
                            }
                        }}
                     >
                         <div className="flex items-center gap-2 text-gray-600">
                             <RotateCcw size={16} />
                             <span className="text-sm font-medium">
                                 {recurrenceEnabled ? t['tasks.custom_recurrence'] : t['tasks.recurrence']}
                             </span>
                         </div>
                         {recurrenceEnabled && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); setRecurrenceEnabled(false); setShowRecurrenceOptions(false); }}
                                className="text-xs text-red-500 font-bold hover:underline"
                             >
                                {t['common.remove']}
                             </button>
                         )}
                     </div>

                     {recurrenceEnabled && showRecurrenceOptions && (
                         <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 mt-2 animate-slide-up">
                             {/* Interval & Frequency */}
                             <div className="flex items-center gap-3">
                                 <span className="text-sm text-gray-500">{t['tasks.repeat_every']}</span>
                                 <input 
                                    type="number" 
                                    min="1" 
                                    value={recInterval}
                                    onChange={e => setRecInterval(parseInt(e.target.value) || 1)}
                                    className="w-12 text-center border border-gray-300 rounded-md py-1 text-sm"
                                 />
                                 <select 
                                    value={recFreq}
                                    onChange={e => setRecFreq(e.target.value as RecurrenceFrequency)}
                                    className="bg-gray-50 border border-gray-300 rounded-md py-1 px-2 text-sm outline-none"
                                 >
                                    <option value="DAILY">{t['tasks.daily']}</option>
                                    <option value="WEEKLY">{t['tasks.weekly']}</option>
                                    <option value="MONTHLY">{t['tasks.monthly']}</option>
                                    <option value="YEARLY">{t['tasks.yearly']}</option>
                                 </select>
                             </div>

                             {/* Weekly Bubbles */}
                             {recFreq === 'WEEKLY' && (
                                 <div>
                                     <span className="text-xs text-gray-400 block mb-2">{t['tasks.repeat_on']}</span>
                                     <div className="flex justify-between">
                                         {dayLetters.map((d, i) => {
                                             const isSelected = recWeekDays.includes(i);
                                             return (
                                                 <button
                                                     key={i}
                                                     onClick={() => setRecWeekDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                                                     className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                                                         isSelected ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-400'
                                                     }`}
                                                 >
                                                     {d}
                                                 </button>
                                             )
                                         })}
                                     </div>
                                 </div>
                             )}

                             {/* Ends Condition */}
                             <div>
                                 <span className="text-xs text-gray-400 block mb-2">{t['tasks.ends']}</span>
                                 <div className="space-y-2">
                                     <label className="flex items-center gap-2 cursor-pointer">
                                         <input 
                                            type="radio" 
                                            checked={recEndType === 'NEVER'} 
                                            onChange={() => setRecEndType('NEVER')}
                                            className="accent-brand-primary"
                                         />
                                         <span className="text-sm text-gray-700">{t['tasks.never']}</span>
                                     </label>

                                     <label className="flex items-center gap-2 cursor-pointer">
                                         <input 
                                            type="radio" 
                                            checked={recEndType === 'ON_DATE'} 
                                            onChange={() => setRecEndType('ON_DATE')}
                                            className="accent-brand-primary"
                                         />
                                         <span className="text-sm text-gray-700">{t['tasks.on']}</span>
                                         <input 
                                            type="date" 
                                            value={recEndDate}
                                            disabled={recEndType !== 'ON_DATE'}
                                            onChange={(e) => setRecEndDate(e.target.value)}
                                            className="ml-auto border border-gray-200 rounded px-2 py-1 text-xs disabled:opacity-50"
                                         />
                                     </label>

                                     <label className="flex items-center gap-2 cursor-pointer">
                                         <input 
                                            type="radio" 
                                            checked={recEndType === 'AFTER_OCCURRENCES'} 
                                            onChange={() => setRecEndType('AFTER_OCCURRENCES')}
                                            className="accent-brand-primary"
                                         />
                                         <span className="text-sm text-gray-700">{t['tasks.after']}</span>
                                         <div className="ml-auto flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={recEndCount}
                                                disabled={recEndType !== 'AFTER_OCCURRENCES'}
                                                onChange={(e) => setRecEndCount(parseInt(e.target.value) || 1)}
                                                className="w-12 border border-gray-200 rounded px-2 py-1 text-xs text-center disabled:opacity-50"
                                            />
                                            <span className="text-xs text-gray-400">{t['tasks.occurrences']}</span>
                                         </div>
                                     </label>
                                 </div>
                             </div>
                         </div>
                     )}
                </div>

              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full p-4 flex items-center gap-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors border-t border-gray-100"
            >
              <div className="w-6 h-6 rounded-full border border-dashed border-gray-400 flex items-center justify-center">
                  <Check size={14} className="opacity-0" />
              </div>
              <span className="font-medium text-sm">{t['tasks.new_task']}</span>
            </button>
          )}
        </div>

        {/* Completed Section */}
        {completedTasks.length > 0 && (
          <div className="mt-6">
             <div 
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center justify-between mb-2 px-2 cursor-pointer"
             >
                <div className="flex items-center gap-2">
                    {showCompleted ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronRight size={16} className="text-gray-400"/>}
                    <h3 className="text-sm font-bold text-gray-500">
                        {t['shopping.completed']} ({completedTasks.length})
                    </h3>
                </div>
                {showCompleted && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); if(window.confirm(t['common.confirm_clear'])) completedTasks.forEach(t => onDelete(t.id)); }}
                        className="text-red-400 text-sm font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                        {t['shopping.clear_all']}
                    </button>
                )}
             </div>
             
             {showCompleted && (
                <div className="bg-gray-100/50 rounded-2xl overflow-hidden border border-gray-200/50">
                    {completedTasks.map((task, index) => (
                        <div 
                            key={task.id}
                            className={`flex items-center gap-3 p-4 ${index !== completedTasks.length - 1 ? 'border-b border-gray-200/50' : ''}`}
                        >
                            <button 
                                onClick={() => onUpdate(task.id, { completed: false })}
                                className="text-green-500"
                            >
                                <CheckCircle2 size={22} />
                            </button>
                            <div className="flex-1 opacity-50">
                                <span className="font-medium text-gray-700 line-through text-sm">{task.title}</span>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                    <span>{new Date(task.dueDate).toLocaleDateString(currentLang === 'en' ? 'en-GB' : currentLang, { day: 'numeric', month: 'short' })}</span>
                                    {task.recurrence && <span>• {formatRecurrenceText(task)}</span>}
                                </div>
                            </div>
                            <button 
                                onClick={() => onDelete(task.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
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

export default Tasks;

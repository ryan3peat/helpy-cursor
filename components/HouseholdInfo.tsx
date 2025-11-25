
import React, { useState } from 'react';
import { BookOpen, Phone, Wifi, Plus, X, Save, Trash2, FileText, Settings, Folder } from 'lucide-react';
import { Section, BaseViewProps } from '../types';

interface HouseholdInfoProps extends BaseViewProps {
  sections: Section[];
  onAdd: (section: Section) => void;
  onUpdate: (id: string, data: Partial<Section>) => void;
  onDelete: (id: string) => void;
}

const HouseholdInfo: React.FC<HouseholdInfoProps> = ({ sections, onAdd, onUpdate, onDelete, t }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: 'General' });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Extract unique categories from sections
  const allCategories = Array.from(new Set(sections.map(s => s.category))) as string[];
  const categoriesForFilter = ['All', ...allCategories];

  // Helper to translate categories if they match known keys (e.g. House Rules)
  const getCategoryLabel = (cat: string) => {
      if (cat === 'All') return t['filter.all'];
      
      // Try to match key 'info.cat.house_rules' for 'House Rules'
      const key = `info.cat.${cat.toLowerCase().replace(/\s+/g, '_')}`;
      return t[key] || cat;
  };

  const handleEditClick = (section: Section) => {
    setCurrentSection(section);
    setFormData({ title: section.title, content: section.content, category: section.category });
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setCurrentSection(null);
    setFormData({ title: '', content: '', category: selectedCategory === 'All' ? 'General' : selectedCategory });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    const categoryToSave = formData.category.trim() || 'General';

    if (currentSection) {
      onUpdate(currentSection.id, { ...formData, category: categoryToSave });
    } else {
      const newSection: Section = {
        id: Date.now().toString(),
        title: formData.title,
        content: formData.content,
        category: categoryToSave
      };
      onAdd(newSection);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (currentSection) {
      onDelete(currentSection.id);
      setIsModalOpen(false);
    }
  };

  const getIconForTitle = (title: string, category: string) => {
    const lowerTitle = title.toLowerCase();
    const lowerCat = category.toLowerCase();
    
    if (lowerCat.includes('safety') || lowerCat.includes('emergency')) return <Phone size={18} className="text-red-500"/>;
    if (lowerTitle.includes('wifi') || lowerTitle.includes('password')) return <Wifi size={18} className="text-brand-primary"/>;
    if (lowerCat.includes('meal') || lowerCat.includes('grocery')) return <FileText size={18} className="text-green-600"/>;
    if (lowerCat.includes('child')) return <FileText size={18} className="text-orange-500"/>;
    if (lowerCat.includes('clean') || lowerCat.includes('laundry')) return <FileText size={18} className="text-blue-400"/>;
    return <BookOpen size={18} className="text-brand-primary"/>;
  };

  const filteredSections = selectedCategory === 'All' 
    ? sections 
    : sections.filter(s => s.category === selectedCategory);

  return (
    <div className="px-4 pt-16 pb-24 h-full animate-slide-up flex flex-col w-full">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h1 className="text-3xl font-bold text-brand-text">{t['info.title']}</h1>
      </div>

      {/* Category Filter Bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2 shrink-0">
        {categoriesForFilter.map(cat => (
            <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-sm font-bold rounded-full whitespace-nowrap transition-all shadow-sm ${
                    selectedCategory === cat
                    ? 'bg-brand-primary text-white scale-105'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
            >
                {getCategoryLabel(cat)}
            </button>
        ))}
      </div>

      <div className="space-y-3 pb-6 overflow-y-auto no-scrollbar flex-1 min-h-0">
        {filteredSections.map((section) => (
            <div 
                key={section.id} 
                onClick={() => handleEditClick(section)}
                className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-brand-secondary cursor-pointer group active:scale-[0.98] transition-transform hover:shadow-md"
            >
                <div className="flex items-center gap-3 mb-2 justify-between">
                    <div className="flex items-center gap-3">
                        {getIconForTitle(section.title, section.category)}
                        <div>
                            <h4 className="font-semibold text-gray-800">{section.title}</h4>
                            {selectedCategory === 'All' && (
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                                    {getCategoryLabel(section.category)}
                                </span>
                            )}
                        </div>
                    </div>
                    <Settings size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm text-gray-500 whitespace-pre-line pl-8 leading-relaxed">
                    {section.content}
                </p>
            </div>
        ))}
        
        <button 
            onClick={handleAddClick}
            className="w-full bg-gray-50 border-2 border-dashed border-gray-300 p-4 rounded-2xl flex items-center justify-center text-gray-500 font-medium text-sm gap-2 hover:bg-white hover:border-brand-primary hover:text-brand-primary transition-colors"
        >
            <Plus size={18} />
            <span>{t['info.add_section']}</span>
        </button>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl animate-slide-up flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                        {currentSection ? t['info.edit_info'] : t['info.new_info']}
                    </h3>
                    <button 
                        onClick={() => setIsModalOpen(false)}
                        className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto px-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t['info.category']}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                list="categories"
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                                placeholder={t['info.placeholder.category']}
                            />
                            <datalist id="categories">
                                {allCategories.map(c => <option key={c} value={c} />)}
                            </datalist>
                            <div className="absolute right-3 top-3 text-gray-400 pointer-events-none">
                                <Folder size={16} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t['info.title_label']}</label>
                        <input 
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({...formData, title: e.target.value})}
                            placeholder={t['info.placeholder.title']}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none font-semibold text-gray-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">{t['info.content_label']}</label>
                        <textarea 
                            value={formData.content}
                            onChange={(e) => setFormData({...formData, content: e.target.value})}
                            placeholder={t['info.placeholder.content']}
                            rows={6}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-primary outline-none text-gray-600 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6 pt-2 border-t border-gray-100">
                    {currentSection && (
                        <button 
                            onClick={handleDelete}
                            className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={!formData.title || !formData.content}
                        className="flex-1 bg-brand-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={18} />
                        {t['common.save']}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdInfo;

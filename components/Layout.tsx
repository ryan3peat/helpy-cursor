
import React from 'react';
import { Home, ShoppingCart, CheckSquare, Utensils, DollarSign, Info } from 'lucide-react';
import { NavItem, TranslationDictionary } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  t: TranslationDictionary;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate, t }) => {
  
  const navItems: NavItem[] = [
    { id: 'dashboard', label: t['nav.home'], icon: <Home size={24} /> },
    { id: 'shopping', label: t['nav.shop'], icon: <ShoppingCart size={24} /> },
    { id: 'tasks', label: t['nav.tasks'], icon: <CheckSquare size={24} /> },
    { id: 'meals', label: t['nav.meals'], icon: <Utensils size={24} /> },
    { id: 'expenses', label: t['nav.cost'], icon: <DollarSign size={24} /> },
    { id: 'info', label: t['nav.info'], icon: <Info size={24} /> },
  ];

  return (
    <div className="app-background h-[100dvh] max-w-md mx-auto relative shadow-2xl overflow-hidden flex flex-col">
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative w-full">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 pb-safe pt-2 px-2 z-40">
        <div className="flex justify-between items-center h-16">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex flex-col items-center justify-center w-full transition-all duration-300 ${
                  isActive ? 'text-brand-primary -translate-y-1' : 'text-gray-400'
                }`}
              >
                <div className={`p-1 rounded-full transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                    {item.icon}
                </div>
                <span className={`text-[10px] font-medium mt-1 ${isActive ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;

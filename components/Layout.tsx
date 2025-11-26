
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
    <div className="flex flex-col min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1">{children}</div>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} // ✅ Safe area support
      >
        <div className="flex justify-around py-2">
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
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;

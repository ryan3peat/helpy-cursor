import React from 'react';
import { Home, ClipboardList, Utensils, DollarSign, Info } from 'lucide-react';
import { NavItem, TranslationDictionary } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  t: TranslationDictionary;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate, t }) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: t['nav.home'], icon: Home },
    { id: 'todo', label: t['nav.todo'] || 'To Do', icon: ClipboardList },
    { id: 'meals', label: t['nav.meals'], icon: Utensils },
    { id: 'expenses', label: t['nav.cost'], icon: DollarSign },
    { id: 'info', label: t['nav.info'], icon: Info },
  ];

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Main Content Area */}
      <div className="flex-1">{children}</div>

      {/* Bottom Navigation - iOS Style */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 
          bg-white/70 dark:bg-black/70 
          backdrop-blur-xl backdrop-saturate-150
          border-t border-black/5 dark:border-white/10"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center gap-0.5 w-full h-full"
              >
                <Icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 1.75}
                  className={`transition-colors duration-200 ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  }`}
                />
                <span 
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  }`}
                >
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

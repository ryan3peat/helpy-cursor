import React from 'react';
import { NavItem, TranslationDictionary } from '../types';
import { NAV_ITEMS } from '../config/navConfig';
import { haptics } from '../utils/haptics';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: string) => void;
  t: TranslationDictionary;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate, t }) => {
  // Build nav items from shared config
  const navItems: NavItem[] = [
    { id: NAV_ITEMS.dashboard.id, label: t[NAV_ITEMS.dashboard.labelKey], icon: NAV_ITEMS.dashboard.icon },
    { id: NAV_ITEMS.todo.id, label: t[NAV_ITEMS.todo.labelKey] || 'To Do', icon: NAV_ITEMS.todo.icon },
    { id: NAV_ITEMS.meals.id, label: t[NAV_ITEMS.meals.labelKey], icon: NAV_ITEMS.meals.icon },
    { id: NAV_ITEMS.expenses.id, label: t[NAV_ITEMS.expenses.labelKey], icon: NAV_ITEMS.expenses.icon },
    { id: NAV_ITEMS.info.id, label: t[NAV_ITEMS.info.labelKey], icon: NAV_ITEMS.info.icon },
  ];

  const handleNavClick = (itemId: string) => {
    haptics.selection(); // Subtle haptic on nav change
    onNavigate(itemId);
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      {/* Main Content Area - key forces remount, animation triggers on mount */}
      <div key={activeView} className="flex-1 page-fade-in">{children}</div>

      {/* Bottom Navigation - iOS Style */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 
          bg-background
          border-t border-black/5 dark:border-white/5"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)',
          transform: 'translateZ(0)',  // GPU layer for stable positioning on iOS
        }}
      >
        <div className="flex justify-around items-stretch h-16">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="flex flex-col items-center w-full pt-2"
              >
                {/* Icon container with fixed height to keep icon position stable */}
                <div className="h-6 flex items-center justify-center">
                  <Icon 
                    size={22} 
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={`transition-colors duration-200 ${
                      isActive 
                        ? 'text-primary' 
                        : 'text-muted-foreground'
                    }`}
                  />
                </div>
                {/* Text with truncation to prevent wrapping */}
                <span 
                  className={`text-micro transition-colors duration-200 mt-0.5 max-w-full px-1 truncate ${
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

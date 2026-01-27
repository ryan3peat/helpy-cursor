"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export const Navbar = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuDesktopRef = useRef<HTMLDivElement>(null);
  const languageMenuMobileRef = useRef<HTMLDivElement>(null);
  const t = translations[language];

  // Handle language change
  const handleLanguageChange = (lang: 'en' | 'zh-HK') => {
    setLanguage(lang);
    setLanguageMenuOpen(false);
  };

  // Close language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const desktopRef = languageMenuDesktopRef.current;
      const mobileRef = languageMenuMobileRef.current;
      
      // Check if click is outside both menus (only one will be visible at a time)
      const isOutsideDesktop = !desktopRef || !desktopRef.contains(target);
      const isOutsideMobile = !mobileRef || !mobileRef.contains(target);
      
      if (isOutsideDesktop && isOutsideMobile) {
        setLanguageMenuOpen(false);
      }
    };

    if (languageMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [languageMenuOpen]);

  const navItems = [
    { href: "/home", label: t.nav.home },
    { href: "/features", label: t.nav.features },
    { href: "/plan", label: t.nav.subscription },
    { href: "/faq", label: t.nav.faq }
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[#fafafa] px-4 sm:px-6 lg:px-8">
      <nav className="mx-auto flex max-w-6xl items-center justify-between py-3">
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/helpy-logo-text.png"
            alt="helpy"
            width={75}
            height={36}
            className="h-9 w-auto"
            priority
          />
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 transition ${
                  isActive
                    ? "bg-primary text-white"
                    : "hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          
          {/* Language Switcher - Desktop (inside nav) */}
          <div className="relative" ref={languageMenuDesktopRef}>
            <button
              onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
              className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition"
              aria-label="Select language"
            >
              <Languages className="h-5 w-5 text-primary" />
            </button>
            {languageMenuOpen && (
              <div className="absolute right-0 top-full mt-2 bg-card rounded-lg shadow-md border border-border overflow-hidden z-50 min-w-[120px]">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={`w-full text-left px-4 py-2 text-sm transition ${
                    language === 'en'
                      ? 'bg-primary text-white'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => handleLanguageChange('zh-HK')}
                  className={`w-full text-left px-4 py-2 text-sm transition ${
                    language === 'zh-HK'
                      ? 'bg-primary text-white'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  繁體中文
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition sm:hidden"
          aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border bg-[#fafafa]">
          <div className="flex flex-col px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            
            {/* Language Switcher - Mobile (inside menu) */}
            <div className="relative mt-2 pt-2 border-t border-border" ref={languageMenuMobileRef}>
              <button
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition"
                aria-label="Select language"
              >
                <Languages className="h-5 w-5 text-primary" />
                <span>Language</span>
              </button>
              {languageMenuOpen && (
                <div className="mt-2 bg-card rounded-lg shadow-md border border-border overflow-hidden">
                  <button
                    onClick={() => {
                      handleLanguageChange('en');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition ${
                      language === 'en'
                        ? 'bg-primary text-white'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => {
                      handleLanguageChange('zh-HK');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition ${
                      language === 'zh-HK'
                        ? 'bg-primary text-white'
                        : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    繁體中文
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};



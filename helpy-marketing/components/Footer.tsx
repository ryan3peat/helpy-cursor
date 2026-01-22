"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export const Footer = () => {
  const pathname = usePathname();
  const { language } = useLanguage();
  const t = translations[language];
  
  // Use light (white) variant on home page to blend with hero background
  const isHomePage = pathname === "/home" || pathname === "/";
  
  return (
    <footer 
      className={`mt-10 border-t ${
        isHomePage 
          ? "border-white/30 bg-transparent" 
          : "border-border bg-background"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className={`text-xs ${isHomePage ? "text-white/80" : "text-muted-foreground"}`}>
            {t.footer.copyright(new Date().getFullYear())}
          </p>
          <Link 
            href="/privacy" 
            className={`text-xs transition ${
              isHomePage 
                ? "text-white/80 hover:text-white" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};

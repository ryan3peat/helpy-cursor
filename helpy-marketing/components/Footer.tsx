"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export const Footer = () => {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {t.footer.copyright(new Date().getFullYear())}
          </p>
          <Link 
            href="/privacy" 
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};

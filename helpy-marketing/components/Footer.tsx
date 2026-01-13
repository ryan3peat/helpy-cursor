"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export const Footer = () => {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <p>{t.footer.copyright(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
};

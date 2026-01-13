"use client";

import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export function MetadataUpdater() {
  const { language } = useLanguage();
  const t = translations[language];

  useEffect(() => {
    // Update document title
    document.title = t.metadata.title;
    
    // Update html lang attribute
    document.documentElement.lang = language === 'zh-HK' ? 'zh-HK' : 'en';
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', t.metadata.description);
    }
  }, [language, t]);

  // Update JSON-LD schema
  useEffect(() => {
    const scriptId = 'helpy-json-ld';
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const softwareAppJsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Helpy",
      "description": t.metadata.descriptionLong,
      "applicationCategory": "LifestyleApplication",
      "operatingSystem": "Web, iOS, Android",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": t.metadata.freeStarterPlan
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "150"
      },
      "featureList": t.metadata.featureList
    };

    script.textContent = JSON.stringify(softwareAppJsonLd);
  }, [language, t]);

  return null;
}


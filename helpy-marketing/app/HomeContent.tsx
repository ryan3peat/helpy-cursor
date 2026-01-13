"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users, HeartHandshake } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export default function HomeContent() {
  const { language } = useLanguage();
  const t = translations[language];
  return (
    <div className="relative min-h-screen">
      {/* Full-width background wallpaper */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/homepage-hero.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={90}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/55" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              <Image
                src="/helpy-logo-white.png"
                alt="helpy"
                width={288}
                height={101}
                className="h-[69.12px] sm:h-[80.64px] lg:h-[92.16px] w-auto mb-2"
                priority
              />
              <span className="block mt-2 sm:mt-3">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white">
                  {t.home.headline}
                </span>
              </span>
            </h1>

            {/* Buttons - Mobile: side by side, Desktop: original layout */}
            <div className="flex flex-row gap-3 sm:flex-row sm:items-center pt-2 sm:pt-2">
              <Link
                href="/features"
                className="inline-flex items-center justify-center rounded-full border border-white bg-white/10 backdrop-blur-md px-6 py-3 text-sm font-semibold text-white transition-colors flex-1 sm:flex-initial"
              >
                {t.home.seeAllFeatures}
              </Link>
              <a
                href="https://app.helpyfam.com"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors flex-1 sm:flex-initial"
              >
                {t.home.getTheApp}
              </a>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 pt-2">
              <div className="rounded-2xl bg-card p-6 sm:p-8 shadow-soft hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-5">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{t.home.forFamilies}</h3>
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {t.home.forFamiliesDesc}
                </p>
              </div>
              <div className="rounded-2xl bg-card p-6 sm:p-8 shadow-soft hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-5">
                  <div className="rounded-full bg-primary/10 p-3">
                    <HeartHandshake className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{t.home.forHelpers}</h3>
                </div>
                <p className="text-base text-muted-foreground leading-relaxed">
                  {t.home.forHelpersDesc}
                </p>
              </div>
            </div>

            <p className="text-xs text-white -mt-4">
              {t.home.quote}
              <br />
              {t.home.quoteAuthor}
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  );
}


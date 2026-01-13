"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  Home,
  ClipboardList,
  Utensils,
  DollarSign,
  BookUser,
  HeartHandshake
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export default function FeaturesContent() {
  const { language } = useLanguage();
  const t = translations[language];

  const featureItems = [
    {
      icon: Home,
      title: t.features.cards.home.title,
      body: t.features.cards.home.body,
      features: t.features.cards.home.features
    },
    {
      icon: ClipboardList,
      title: t.features.cards.todo.title,
      body: t.features.cards.todo.body,
      features: t.features.cards.todo.features
    },
    {
      icon: Utensils,
      title: t.features.cards.meals.title,
      body: t.features.cards.meals.body,
      features: t.features.cards.meals.features
    },
    {
      icon: DollarSign,
      title: t.features.cards.expenses.title,
      body: t.features.cards.expenses.body,
      features: t.features.cards.expenses.features
    },
    {
      icon: BookUser,
      title: t.features.cards.family.title,
      body: t.features.cards.family.body,
      features: t.features.cards.family.features
    },
    {
      icon: HeartHandshake,
      title: t.features.cards.helper.title,
      body: t.features.cards.helper.body,
      features: t.features.cards.helper.features
    }
  ];

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8 sm:space-y-12 lg:space-y-20">
        {/* Split Hero Section */}
        <section className="grid gap-12 lg:grid-cols-2 lg:items-start">
          {/* Left: Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl lg:text-5xl">
              {t.features.title1}
              <br />
              {t.features.title2}
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg leading-relaxed max-w-lg">
              {t.features.description}
            </p>
            <a
              href="https://app.helpyfam.com"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors"
            >
              {t.features.getStarted}
            </a>
          </motion.div>

          {/* Right: Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mx-auto w-full aspect-[4/3]"
          >
            <Image
              src="/features-mobile-screens.png"
              alt="Helpy app screens showing dashboard, tasks, meals, expenses, and family book features"
              fill
              className="object-contain"
              priority
            />
          </motion.div>
        </section>

        {/* Feature Cards */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {featureItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative flex flex-col rounded-2xl bg-card p-6 shadow-soft"
              >
                <div className="absolute right-6 top-6 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="pr-8 text-base font-semibold text-foreground mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {item.body}
                </p>
                <div className="border-t border-border mb-4" />
                <p className="text-sm text-primary leading-relaxed">
                  {item.features}
                </p>
              </div>
            );
          })}
        </motion.section>
      </div>
    </div>
  );
}


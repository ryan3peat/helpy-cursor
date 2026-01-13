"use client";

import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

export default function FAQContent() {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <div className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t.faq.title}
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            {t.faq.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="space-y-4"
        >
          {t.faq.items.map((item, index) => (
            <FAQItem 
              key={index}
              question={item.question}
              answer={item.answer}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: React.ReactNode; answer: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-card overflow-hidden shadow-soft">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-base font-semibold text-foreground pr-4">{question}</span>
        <span className="flex-shrink-0 text-primary">
          {isOpen ? <Minus size={20} /> : <Plus size={20} />}
        </span>
      </button>
      <div
        className={`px-6 text-sm text-muted-foreground transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 pb-6 opacity-100" : "max-h-0 pb-0 opacity-0"
        }`}
      >
        <div className="leading-relaxed border-t border-border/50 pt-4">
          {answer}
        </div>
      </div>
    </div>
  );
}


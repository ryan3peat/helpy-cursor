"use client";

import { motion } from "framer-motion";
import { Plus, Minus } from "lucide-react";
import { useState } from "react";

export default function FAQContent() {
  return (
    <div className="bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-16"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Common Questions
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Everything you need to know about setting up your Helpy home.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="space-y-4"
        >
          <FAQItem 
            question="What is Helpy?"
            answer="Helpy is the home management app that simplifies daily life. It gathers meals, tasks, and spending in one spot. The ideal family collaboration app for families and helpers to work as a team."
          />

          <FAQItem 
            question="My partner and I juggle chores. Can this family task manager help?"
            answer="We built Helpy to be the ultimate family task manager. You can assign tasks, set reminders, and see when things are done. It's a family collaboration app designed to stop the 'nagging' and start the teamwork."
          />

          <FAQItem 
            question="I'm about to hire a domestic helper in Hong Kong. Is this app for me?"
            answer="Absolutely. While we aren't a recruitment agency, Helpy is the essential domestic helper app to use after you hire a domestic helper in Hong Kong. It bridges the communication gap from day one with built-in training guides, making it the perfect home helper app to set your new relationship up for success."
          />

          <FAQItem 
            question="How does the shared shopping list app feature work?"
            answer="It's a real-time shared shopping list app where anyone can add items instantly. It seamlessly connects with our household chore app features, so you can manage 'buy milk' and 'clean windows' in the same easy flow."
          />

          <FAQItem 
            question="We struggle with dinner. Is Helpy a good meal planning app for families?"
            answer="Helpy makes decisions easy. As a dedicated meal planning app for families, it lets you organize favorite recipes for the week. Use our family meal scheduler to assign them to specific days, so your helper knows exactly what to prep."
          />

          <FAQItem 
            question="Can I use Helpy as a family expense tracker for petty cash?"
            answer="Definitely. Helpy includes a built-in family expense tracker. It works as a shared household expense manager where your helper can snap photos of receipts, and you can approve them instantly. No more lost paper receipts."
          />

          <FAQItem 
            question="My helper doesn't speak English well. Can she use it?"
            answer="Yes. Helpy translates to many common languages with one click, making it an accessible home helper app for helpers of any background."
          />

          <FAQItem 
            question="Can I set daily schedules for my kids and the house?"
            answer="You can. Helpy acts as a detailed daily routine planner for families. You can create morning routines, cleaning schedules, or bedtime checklists. It turns complex days into simple, followable steps."
          />

          <FAQItem 
            question="Can I create step-by-step instructions for my helper?"
            answer="Yes. Helpy works as a daily routine planner for families where you can write simple guides for any task. From how to fold laundry to the school pickup routine, your helper can follow along at their own pace."
          />

          <FAQItem 
            question="How do I share household info with my spouse or helper?"
            answer="Just invite them to your digital home in the app. Helpy is a family collaboration app where everyone shares the same view of tasks, meals, and notes. No more forwarding screenshots."
          />

          <FAQItem 
            question="How does the family meal scheduler help plan the whole week?"
            answer="Our family meal scheduler covers everything from breakfast to snacks. You can map out the entire week at once, ensuring your helper always knows the plan without needing to ask."
          />

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


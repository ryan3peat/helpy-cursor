import type { Metadata } from "next";
import FAQContent from "./FAQContent";

export const metadata: Metadata = {
  title: "Helpy FAQ - Home Management App & Domestic Helper App Questions",
  description: "Common questions about Helpy, the home management app for families and domestic helpers. Learn about meal planning, expense tracking, task management, and more.",
  alternates: {
    canonical: '/faq',
  },
};

// FAQ data for JSON-LD schema
const faqData = [
  {
    question: "What is Helpy?",
    answer: "Helpy is the home management app that simplifies daily life. This family management app gathers meals, tasks, and spending in one spot. The ideal family collaboration app for families and helpers to work as a team."
  },
  {
    question: "My partner and I constantly juggle chores. How does this help?",
    answer: "We built Helpy to be the ultimate family task manager. You can assign tasks, set reminders, and see when things are done. It's a family collaboration app designed to stop the nagging and start the teamwork."
  },
  {
    question: "I'm about to hire a domestic helper in Hong Kong. Is this app for me?",
    answer: "Absolutely. While we aren't a recruitment agency, Helpy is the essential domestic helper app to use after you hire a domestic helper in Hong Kong. It bridges the communication gap from day one with built-in training guides, making it the perfect home helper app to set your new relationship up for success."
  },
  {
    question: "How does the grocery list feature work?",
    answer: "It's a real-time shared shopping list app. Anyone in the family (or your helper) can add items when they run out. It also doubles as a household chore app, so you can add 'buy milk' and 'clean windows' in the same easy flow."
  },
  {
    question: "We struggle to decide what to cook. Can Helpy suggest meals?",
    answer: "Yes. Helpy is a dedicated meal planning app for families. You can plan meals for the week and use our family meal scheduler to assign them to specific days, so your helper knows exactly what to prep without asking."
  },
  {
    question: "Can I track the petty cash I give to my helper?",
    answer: "Definitely. Helpy includes a built-in family expense tracker. It works as a shared household expense manager where your helper can snap photos of receipts, and you can approve them instantly. No more lost paper receipts."
  },
  {
    question: "My helper doesn't speak English well. Can she use it?",
    answer: "Yes. Helpy is translatable to many common languages with one click, making it an accessible home helper app for helpers of any background."
  },
  {
    question: "Can I set daily schedules for my kids and the house?",
    answer: "You can. Helpy acts as a detailed daily routine planner for families. You can create morning routines, cleaning schedules, or bedtime checklists. It turns complex days into simple, followable steps."
  },
  {
    question: "Can I create step-by-step instructions for my helper?",
    answer: "Yes. Helpy works as a daily routine planner for families where you can write simple guides for any task. From how to fold laundry to the school pickup routine, your helper can follow along at their own pace."
  },
  {
    question: "How do I share household info with my spouse or helper?",
    answer: "Just invite them to your home. Helpy is a family collaboration app where everyone sees the same tasks, meals, and notes. No more forwarding screenshots or repeating yourself."
  },
  {
    question: "Can I plan meals for the whole week?",
    answer: "Yes. Our family meal scheduler lets you plan breakfast, lunch, dinner, and snacks for each day. Your helper always knows what to cook without asking."
  }
];

// Generate FAQ JSON-LD schema
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqData.map(item => ({
    "@type": "Question",
    "name": item.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.answer
    }
  }))
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FAQContent />
    </>
  );
}

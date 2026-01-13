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

export default function FeaturesContent() {
  const featureItems = [
    {
      icon: Home,
      title: "Home",
      body: "Discover a serene dashboard that unites your family's plans, reminders, and essential tools into a single, intuitive overview for effortless home management.",
      features: "Family Board, Widgets with quick action buttons, App Translations"
    },
    {
      icon: ClipboardList,
      title: "To Do",
      body: "Keep everyone in sync with a shared task and shopping list.",
      features: "Task list with due dates and recurring settings. Shopping list with Shopping Mode"
    },
    {
      icon: Utensils,
      title: "Meals",
      body: "Family meal scheduler to organize the week and guide your helper.",
      features: "Meal planner for adults and kids. Quick recipe search on YouTube. RSVP system to join the meal. PDF export for printing."
    },
    {
      icon: DollarSign,
      title: "Expenses",
      body: "Stay on budget with a simple family expense tracker. It works as a household expense manager that lets you snap and track receipts in seconds.",
      features: "Expenses list and summary. AI receipt scanner"
    },
    {
      icon: BookUser,
      title: "Family",
      body: "A \"Family Book\" storing all of the important information about the family for everyone to know. Important and common places that you often visit (such as school, doctors, etc.), and how to do things your way, all on one page.",
      features: "Places and practices list, including contact details and instructions, and notes."
    },
    {
      icon: HeartHandshake,
      title: "Helper",
      body: "Nestled in the Family page. Managing salary slips has never been easier! Generate the slip in one click and sign it digitally!",
      features: "Helper's start date, salary, and salary slip"
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
              A household planner app
              <br />
              made for real homes
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg leading-relaxed max-w-lg">
              Helpy is the home management app that simplifies daily life.
              It gathers meals, tasks, and spending in one spot.
              The ideal family collaboration app for families and helpers to work as a team.
            </p>
            <a
              href="https://app.helpyfam.com"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors"
            >
              Get Started
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


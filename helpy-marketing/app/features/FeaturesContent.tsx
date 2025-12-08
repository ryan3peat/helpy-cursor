"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  Home,
  ClipboardList,
  Utensils,
  DollarSign,
  Info,
  BookOpen,
  Quote
} from "lucide-react";

export default function FeaturesContent() {
  const featureItems = [
    {
      icon: Home,
      title: "Home Dashboard",
      body: (
        <>
          Experience a calm <span className="text-red-500">home organization tool</span> that brings all your plans and reminders into one clear overview.
        </>
      )
    },
    {
      icon: ClipboardList,
      title: "To-Do & Shopping",
      body: (
        <>
          Keep everyone in sync with a <span className="text-red-500">shared shopping list app</span> that doubles as a <span className="text-red-500">household chore app</span> for stress-free coordination.
        </>
      )
    },
    {
      icon: Utensils,
      title: "Meal Planning",
      body: (
        <>
          Finally, a <span className="text-red-500">meal planning app for families</span> that works. Use our <span className="text-red-500">family meal scheduler</span> to organize the week and guide your helper.
        </>
      )
    },
    {
      icon: DollarSign,
      title: "Expense Tracking",
      body: (
        <>
          Stay on budget with a simple <span className="text-red-500">family expense tracker</span>. It works as a <span className="text-red-500">household expense manager</span> that lets you snap and track receipts in seconds.
        </>
      )
    },
    {
      icon: Info,
      title: "Family Info",
      body: (
        <>
          Store important details in one <span className="text-red-500">family notes app</span>. It serves as a <span className="text-red-500">family profile manager</span> for all your contacts, routines, and house rules.
        </>
      )
    },
    {
      icon: BookOpen,
      title: "Training Guides",
      body: (
        <>
          Use our <span className="text-red-500">daily routine planner for families</span> to build bespoke training modules. Helpers can reference instructions anytime, ensuring clarity and confidence for everyone.
        </>
      )
    }
  ];

  return (
    <div className="bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-20">
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
              A <span className="text-red-500">household planner app</span>
              <br />
              made for real homes
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg leading-relaxed max-w-lg">
              Helpy is the <span className="text-red-500">home management app</span> that simplifies daily life.
              It gathers meals, tasks, and spending in one spot.
              The ideal <span className="text-red-500">family collaboration app</span> for families and helpers to work as a team.
            </p>
            <a
              href="https://www.helpyfam.com"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-colors"
            >
              Get Started
            </a>
          </motion.div>

          {/* Right: Hero Image with Colored Shadow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mx-auto w-full aspect-[4/3]"
          >
            {/* The "Glow" Image (Behind) */}
            <div className="absolute inset-0 translate-y-4 scale-95 opacity-60 blur-2xl">
              <Image
                src="/website/features-hero.jpg"
                alt=""
                fill
                className="object-cover rounded-3xl"
                aria-hidden="true"
              />
            </div>

            {/* The Main Image (Front) */}
            <div className="relative h-full w-full overflow-hidden rounded-3xl bg-secondary shadow-sm">
              <Image
                src="/website/features-hero.jpg"
                alt="Family using Helpy home management app to organize household tasks together"
                fill
                className="object-cover"
                priority
              />
            </div>
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
                className="relative flex flex-col gap-3 rounded-2xl bg-card p-6 shadow-soft hover:shadow-md transition-shadow"
              >
                <div className="absolute right-6 top-6 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="pr-8 text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
            );
          })}
        </motion.section>

        {/* Testimonials Section */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="space-y-8"
        >
          <div className="border-t border-border pt-12">
            <p className="helpy-logo text-4xl font-normal tracking-tight mb-8">
              Their Stories
            </p>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  quote:
                    "Helpy turned our busy home into a team effort. I don't have to repeat myself, and our helper feels much more confident.",
                  name: "Lina, mom of two",
                  role: "Singapore"
                },
                {
                  quote:
                    "I used to worry I would forget details about the kids' routines. Now I just open Helpy and follow the guides. It feels respectful and clear.",
                  name: "Marites, live-in helper",
                  role: "Hong Kong"
                },
                {
                  quote:
                    "We live in different countries from my parents, but still support their helper. Helpy lets us share instructions and check-ins in one place.",
                  name: "Kenji and Aiko",
                  role: "Tokyo"
                }
              ].map((item, idx) => (
                <div key={idx} className={`${idx === 0 ? '' : 'border-l border-border'} pl-6 py-2`}>
                  <Quote className="h-8 w-8 text-primary fill-current mb-4" />
                  <p className="text-base text-foreground leading-relaxed">
                    &quot;{item.quote}&quot;
                  </p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}


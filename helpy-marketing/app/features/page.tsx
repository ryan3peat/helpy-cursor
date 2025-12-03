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

export default function FeaturesPage() {
  const featureItems = [
    {
      icon: Home,
      title: "Home",
      body:
        "Like a calm fridge door for your household. See today's plans and reminders at a glance, so everyone feels ready for the day."
    },
    {
      icon: ClipboardList,
      title: "To-Do (shopping and tasks)",
      body:
        "Turn 'can you please...' messages into clear lists. Everyone sees what needs doing and ticks things off without pressure."
    },
    {
      icon: Utensils,
      title: "Meals",
      body:
        "Plan weekly meals and save family favourites. Helpers know what to cook, and families feel cared for in small ways."
    },
    {
      icon: DollarSign,
      title: "Expenses",
      body:
        "Snap a receipt, add a note, and move on. Easy for the family to see where money went and talk about spending together."
    },
    {
      icon: Info,
      title: "Info",
      body:
        "Keep household details in one place: emergency contacts, routines, house rules. No repeating, no guessing."
    },
    {
      icon: BookOpen,
      title: "Training",
      body:
        "Turn routines into friendly guides. Helpers learn at their own pace, and families update instructions easily."
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
              Made for real homes,
              <br />
              not perfect ones
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg leading-relaxed max-w-lg">
              Helpy doesn't expect your family to be perfectly organized. It
              simply gathers what matters: meals, tasks, routines, and spending.
              From what to cook on Wednesdays, to how you like the kids'
              bedtime, to where the grocery receipts go. Helpy keeps it all in
              one calm place, so families and helpers can work as a team.
            </p>
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
                src="https://images.unsplash.com/photo-1606787841656-b09a1dd4184c?auto=format&fit=crop&w=1200&q=80"
                alt=""
                fill
                className="object-cover rounded-3xl"
                aria-hidden="true"
              />
            </div>

            {/* The Main Image (Front) */}
            <div className="relative h-full w-full overflow-hidden rounded-3xl bg-secondary shadow-sm">
              <Image
                src="https://images.unsplash.com/photo-1606787841656-b09a1dd4184c?auto=format&fit=crop&w=1200&q=80"
                alt="Family preparing food together in a bright kitchen"
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
                    "{item.quote}"
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

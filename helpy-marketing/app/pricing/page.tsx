"use client";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Check } from "lucide-react";

type FormValues = {
  email: string;
};

export default function PricingPage() {
  const { register, handleSubmit, reset } = useForm<FormValues>();
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(data: FormValues) {
    console.log("Sign-up form submitted:", data);
    setSubmitted(true);
    reset();
    setTimeout(() => setSubmitted(false), 4000);
  }

  const plans = [
    {
      name: "Starter (Free)",
      price: "$0 / month",
      description:
        "For families trying Helpy for the first time or with a single helper.",
      features: [
        "1 home space with shared tasks and simple routines",
        "Basic meal plans and grocery lists",
        "Receipt notes for monthly spending overview"
      ]
    },
    {
      name: "Plus",
      price: "$9 / month",
      description:
        "For growing homes that want clearer routines and better tracking.",
      features: [
        "Up to 3 home spaces (e.g., parents, grandparents, shared flat)",
        "Detailed routines for cleaning, kids, and special days",
        "Organized receipt history with simple tags",
        "Priority support if you ever need a hand"
      ],
      highlight: true
    },
    {
      name: "Family",
      price: "$19 / month",
      description:
        "For busy families with multiple helpers or complex schedules.",
      features: [
        "Unlimited home spaces and routines",
        "Advanced meal planning and shared calendars",
        "Full receipt tracking for household spending",
        "Best for families coordinating across countries"
      ]
    }
  ];

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 bg-background">
      <div className="mx-auto max-w-5xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center space-y-4"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Start simple and grow as your family does
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Begin with what you need today. You can always grow into more
            features later, when your routines are ready.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid gap-6 md:grid-cols-3"
        >
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`flex flex-col rounded-2xl bg-card p-5 shadow-soft ${
                (plan as any).highlight ? "border border-primary" : "border border-card-border"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {plan.name}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {plan.price}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {plan.description}
              </p>
              <ul className="mt-4 space-y-2 text-xs text-foreground">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="max-w-md mx-auto"
        >
          <div className="rounded-2xl bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold text-foreground">
              Sign up for early access
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Leave your email and we'll send you a gentle welcome guide when
              Helpy is ready for your home.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-4 space-y-4"
              aria-label="Helpy sign-up form"
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  {...register("email", { required: true })}
                  className="mt-1 w-full rounded-2xl border border-border bg-secondary px-3 py-2 text-sm text-foreground shadow-sm focus:bg-card"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors"
              >
                Join the waiting list
              </button>
              {submitted && (
                <p className="text-xs text-green-600">
                  Thank you. We'll be in touch with simple next steps very soon.
                </p>
              )}
            </form>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

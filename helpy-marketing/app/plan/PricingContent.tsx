"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

export default function PricingContent() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'free',
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: "For families just getting started with Helpy.",
      features: [
        "Up to 3 family members",
        "1 helper",
        "Basic meal planning",
        "Shopping lists"
      ],
      highlight: false
    },
    {
      id: 'core',
      name: "Core",
      monthlyPrice: 88,
      yearlyPrice: 850,
      description: "For growing families who need more organization.",
      features: [
        "Up to 6 family members",
        "2 helpers",
        "Receipt scanning",
        "Priority support"
      ],
      highlight: false
    },
    {
      id: 'pro',
      name: "Pro",
      monthlyPrice: 118,
      yearlyPrice: 1080,
      description: "For busy families with multiple helpers or complex schedules.",
      features: [
        "Up to 10 family members",
        "Unlimited helpers",
        "Advanced AI",
        "Data export",
        "Premium support"
      ],
      highlight: true
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
            Simple pricing for your home management app
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Begin with what you need today. You can always grow into more
            features later, when your routines are ready.
          </p>
        </motion.section>

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-3 rounded-full bg-muted p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Yearly
              <span className="ml-1.5 text-xs text-primary font-semibold">Save 20%</span>
            </button>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid gap-6 md:grid-cols-3"
        >
          {plans.map((plan) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl bg-card p-5 shadow-soft"
              >
                {plan.highlight && (
                  <span className="absolute -top-3 right-4 px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
                    Popular
                  </span>
                )}
                <p className="text-xs font-semibold tracking-wide text-primary">
                  {plan.name}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {price === 0 ? 'Free' : `HK$${price}`}
                  {price > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {billingPeriod === 'monthly' ? ' / month' : ' / year'}
                    </span>
                  )}
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
            );
          })}
        </motion.section>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { translations } from "@/translations";

// Helpy brand colors
const HELPY_BLUE = '#3EAFD2';
const HELPY_PINK = '#F06292';

export default function PricingContent() {
  const { language } = useLanguage();
  const t = translations[language];
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Feature sections with translations
  const featureSections = useMemo(() => [
    {
      id: 'users',
      title: t.pricing.sections.users,
      features: [
        { 
          id: 'family', 
          name: t.pricing.sections.familyMembers,
          isLimit: true 
        },
        { 
          id: 'helpers', 
          name: t.pricing.sections.helpers,
          isLimit: true 
        },
      ]
    },
    {
      id: 'basic_features',
      title: t.pricing.sections.basicFeatures,
      features: [
        { id: 'home', name: t.pricing.sections.home, isLimit: false },
        { id: 'todo', name: t.pricing.sections.todo, isLimit: false },
        { id: 'meal_planning', name: t.pricing.sections.mealPlanning, isLimit: false },
        { id: 'family_info', name: t.pricing.sections.familyInfo, isLimit: false },
        { id: 'ai_translations', name: t.pricing.sections.aiTranslations, isLimit: false },
      ]
    },
    {
      id: 'expenses',
      title: t.pricing.sections.expenses,
      features: [
        { 
          id: 'manual_expenses', 
          name: t.pricing.sections.addExpensesManually,
          description: t.pricing.sections.addExpensesDesc,
          isLimit: false 
        },
        { 
          id: 'ai_scan', 
          name: t.pricing.sections.aiReceiptScanning,
          description: t.pricing.sections.aiReceiptDesc,
          isLimit: false 
        },
        { 
          id: 'spending_summary', 
          name: t.pricing.sections.monthlySpendingSummary,
          description: t.pricing.sections.spendingSummaryDesc,
          isLimit: false 
        },
      ]
    },
    {
      id: 'helper_management',
      title: t.pricing.sections.helperManagement,
      features: [
        { 
          id: 'helper_records', 
          name: t.pricing.sections.helperPayslips,
          description: t.pricing.sections.payslipsDesc,
          isLimit: false 
        },
      ]
    }
  ], [t]);

  const plans = useMemo(() => [
    {
      id: 'free',
      name: t.pricing.free,
      monthlyPrice: 0,
      yearlyPrice: 0,
      accentColor: null,
      featureValues: {
        family: { included: true, value: '3' },
        helpers: { included: true, value: '1' },
        home: { included: true },
        todo: { included: true },
        meal_planning: { included: true },
        family_info: { included: true },
        ai_translations: { included: true },
        manual_expenses: { included: true },
        ai_scan: { included: false },
        spending_summary: { included: false },
        helper_records: { included: false },
      },
      badge: null,
      isFree: true
    },
    {
      id: 'core',
      name: t.pricing.core,
      monthlyPrice: 88,
      yearlyPrice: 845,
      accentColor: HELPY_BLUE,
      featureValues: {
        family: { included: true, value: '4' },
        helpers: { included: true, value: '1' },
        home: { included: true },
        todo: { included: true },
        meal_planning: { included: true },
        family_info: { included: true },
        ai_translations: { included: true },
        manual_expenses: { included: true },
        ai_scan: { included: true },
        spending_summary: { included: true },
        helper_records: { included: true },
      },
      badge: null,
      isFree: false
    },
    {
      id: 'pro',
      name: t.pricing.pro,
      monthlyPrice: 118,
      yearlyPrice: 1133,
      accentColor: HELPY_PINK,
      featureValues: {
        family: { included: true, value: '8' },
        helpers: { included: true, value: '4' },
        home: { included: true },
        todo: { included: true },
        meal_planning: { included: true },
        family_info: { included: true },
        ai_translations: { included: true },
        manual_expenses: { included: true },
        ai_scan: { included: true },
        spending_summary: { included: true },
        helper_records: { included: true },
      },
      badge: true,
      isFree: false
    }
  ], [t]);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center space-y-4"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t.pricing.title}
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t.pricing.subtitle}
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
              {t.pricing.monthly}
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'yearly'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.pricing.yearly}
              <span className="ml-1.5 text-xs font-semibold" style={{ color: HELPY_BLUE }}>{t.pricing.save20}</span>
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
            const hasColoredBg = plan.accentColor !== null;
            
            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl p-6 shadow-soft hover:shadow-md transition-shadow overflow-hidden"
                style={{ 
                  backgroundColor: plan.accentColor || 'hsl(var(--card))',
                  color: hasColoredBg ? 'white' : 'hsl(var(--foreground))'
                }}
              >
                {/* Star badge */}
                {plan.badge && (
                  <div className="absolute top-6 right-6">
                    <Star size={36} strokeWidth={2} color="white" fill="white" />
                  </div>
                )}

                {/* Header */}
                <div className="mb-5">
                  <p className="text-sm font-bold tracking-wide" style={{ color: hasColoredBg ? 'white' : plan.accentColor || HELPY_BLUE }}>
                    {plan.name}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {price === 0 ? t.pricing.free : `HK$${price}`}
                    {price > 0 && (
                      <span className="text-sm font-normal" style={{ color: hasColoredBg ? 'rgba(255,255,255,0.8)' : 'hsl(var(--muted-foreground))' }}>
                        {billingPeriod === 'monthly' ? t.pricing.perMonth : t.pricing.perYear}
                      </span>
                    )}
                  </p>
                </div>

                {/* Feature sections */}
                <div className="space-y-4 flex-1">
                  {featureSections.map((section, sectionIndex) => (
                    <div key={section.id}>
                      {/* Divider */}
                      {sectionIndex > 0 && (
                        <div 
                          className="border-t my-4"
                          style={{ borderColor: hasColoredBg ? 'rgba(255,255,255,0.2)' : 'hsl(var(--border))' }}
                        />
                      )}
                      
                      {/* Section title */}
                      <p 
                        className="text-sm font-semibold mb-3"
                        style={{ color: hasColoredBg ? 'rgba(255,255,255,0.6)' : 'hsl(var(--muted-foreground))' }}
                      >
                        {section.title}
                      </p>
                      
                      {/* Features */}
                      <div className="space-y-3">
                        {section.features.map((feature) => {
                          const featureValue = plan.featureValues[feature.id as keyof typeof plan.featureValues];
                          const isIncluded = featureValue?.included ?? false;
                          const limitValue = featureValue && 'value' in featureValue ? featureValue.value : null;

                          // Limit features (family/helpers)
                          if (feature.isLimit && limitValue) {
                            return (
                              <div key={feature.id} className="flex items-start gap-3">
                                <span 
                                  className="text-base font-bold flex-shrink-0 w-5 text-center"
                                  style={{ color: hasColoredBg ? 'white' : HELPY_BLUE }}
                                >
                                  {limitValue}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold">{feature.name}</p>
                                  {'description' in feature && feature.description && (
                                    <p 
                                      className="text-sm font-normal"
                                      style={{ color: hasColoredBg ? 'rgba(255,255,255,0.7)' : 'hsl(var(--muted-foreground))' }}
                                    >
                                      {feature.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Regular features
                          return (
                            <div key={feature.id} className="flex items-start gap-3">
                              <div className="w-5 flex justify-center flex-shrink-0">
                                {isIncluded ? (
                                  <Check 
                                    size={18} 
                                    className="mt-0.5" 
                                    style={{ color: hasColoredBg ? 'white' : HELPY_BLUE }} 
                                  />
                                ) : (
                                  <X 
                                    size={18} 
                                    className="mt-0.5" 
                                    style={{ color: hasColoredBg ? 'rgba(255,255,255,0.4)' : 'hsl(var(--muted-foreground) / 0.4)' }}
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p 
                                  className="text-sm font-semibold"
                                  style={{ 
                                    color: hasColoredBg 
                                      ? (isIncluded ? 'white' : 'rgba(255,255,255,0.5)')
                                      : (isIncluded ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.5)')
                                  }}
                                >
                                  {feature.name}
                                </p>
                                {'description' in feature && feature.description && (
                                  <p 
                                    className="text-sm font-normal"
                                    style={{ 
                                      color: hasColoredBg 
                                        ? (isIncluded ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)')
                                        : (isIncluded ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground) / 0.4)')
                                    }}
                                  >
                                    {feature.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.section>
      </div>
    </div>
  );
}

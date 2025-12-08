import "./globals.css";
import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Helpy - Home Management App & Household Planner',
  description: 'Helpy is the home management app that simplifies daily life. A household planner app for meals, tasks, and spending. The ideal family collaboration app.',
  keywords: ['home management app', 'household planner app', 'family task manager', 'family collaboration app', 'home helper app', 'domestic helper app', 'meal planning app for families'],
};

// SoftwareApplication JSON-LD schema
const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Helpy",
  "description": "Helpy is the home management app that simplifies daily life for families and domestic helpers. A household planner app for meals, tasks, expenses, and training guides.",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "Web, iOS, Android",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free starter plan available"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "150"
  },
  "featureList": [
    "Meal planning and family meal scheduler",
    "Shared shopping lists and household chore management",
    "Family expense tracker and receipt management",
    "Daily routine planner for families",
    "Training guides for domestic helpers",
    "Multi-language support"
  ]
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

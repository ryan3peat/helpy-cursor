import HomeContent from "../HomeContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Helpy - Home Management App & Household Planner",
  description: "Helpy is the home management app that brings families and helpers closer. A household planner app for meals, tasks, and spending.",
  alternates: {
    canonical: '/home',
  },
};

// Organization JSON-LD schema for the home page
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Helpy",
  "description": "Helpy is the home management app that brings families and helpers closer. A household planner app for meals, tasks, and spending.",
  "url": "https://helpyfam.com",
  "logo": "https://helpyfam.com/helpy-logo.PNG",
  "sameAs": []
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <HomeContent />
    </>
  );
}


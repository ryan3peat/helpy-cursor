import type { Metadata } from "next";
import PricingContent from "./PricingContent";

export const metadata: Metadata = {
  title: "Helpy Pricing - Plans for Families and Domestic Helpers",
  description: "Simple, affordable pricing for Helpy home management app. Free starter plan, Plus for growing homes, Family for complex households. Start organizing your home today.",
};

export default function PricingPage() {
  return <PricingContent />;
}
